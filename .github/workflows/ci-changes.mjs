import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// T-010. Con el repositorio privado, decide si un push a una PR abierta puede saltearse
// typecheck, lint, build, bundle-budget, db-tests y audit. Se saltea SOLO cuando se puede
// demostrar que su resultado no puede cambiar respecto de una corrida que paso; ante
// cualquier duda se corre todo. unit no depende de esto: valida fichas, bitacoras, el plan
// y los ADR, que son justamente lo que cambia en un push de docs.

/**
 * Lo que cuenta como "solo docs": Markdown y los .jsonl de las revisiones, bajo docs/.
 * Un .ts o un .json bajo docs/ no entra: tsc incluye **\/*.ts y el bundler puede leer JSON.
 */
export const DOCS_ONLY_PATTERN = /^docs\/.+\.(md|jsonl)$/;

const CI_WORKFLOW = '.github/workflows/ci.yml';

/**
 * @typedef {object} SkipInput
 * @property {boolean} isPrivate Con el repositorio publico los minutos no se cobran.
 * @property {string} eventName
 * @property {string | undefined} action
 * @property {boolean} isFastForward La cabeza anterior es ancestro de la nueva.
 * @property {readonly string[]} changedFiles Entre la cabeza anterior y la nueva, sin renames.
 * @property {string | null} previousRunConclusion Del CI sobre la cabeza anterior, misma rama.
 * @property {boolean} branchContainsBase La rama contiene la base del merge que prueba este CI.
 */

/** @typedef {{ skipHeavy: boolean, reason: string }} Decision */

/** @param {string} reason @returns {Decision} */
function runEverything(reason) {
  return { skipHeavy: false, reason };
}

/**
 * Las siete guardas, en orden. Cualquiera que falle obliga a correr todo.
 * @param {SkipInput} input
 * @returns {Decision}
 */
export function decideSkipHeavy(input) {
  if (!input.isPrivate) {
    return runEverything('repositorio publico: los minutos no se cobran');
  }
  if (input.eventName !== 'pull_request' || input.action !== 'synchronize') {
    return runEverything(
      `evento ${input.eventName}/${input.action ?? '-'}: solo se ahorra en pushes a una PR abierta`
    );
  }
  if (!input.isFastForward) {
    return runEverything('el push reescribio la historia: el incremento no se puede medir');
  }
  if (input.changedFiles.length === 0) {
    return runEverything('diff vacio: no hay nada que demuestre que es solo docs');
  }
  const fuera = input.changedFiles.filter((file) => !DOCS_ONLY_PATTERN.test(file));
  if (fuera.length > 0) {
    return runEverything(
      `toca ${fuera.length} archivo(s) fuera de docs/**/*.md|jsonl: ${fuera.slice(0, 3).join(' ')}`
    );
  }
  // Sin esta guarda, un push de docs sobre un CI rojo se saltea los jobs que fallaban y
  // la PR queda en verde con el codigo roto. Paso de verdad: a71ec25 en T-006.
  if (input.previousRunConclusion !== 'success') {
    return runEverything(
      `la corrida anterior no paso (${input.previousRunConclusion ?? 'no encontrada'}): ` +
        'su codigo nunca quedo verificado'
    );
  }
  // Sin esta, un push de docs despues de que develop se movio se saltea la prueba de la
  // integracion nueva: el merge que corre este CI no es el que probo la corrida anterior.
  if (!input.branchContainsBase) {
    return runEverything('la rama no contiene la base del merge: lo que prueba el CI cambio');
  }
  return {
    skipHeavy: true,
    reason:
      `solo docs (${input.changedFiles.length} archivo(s)) sobre una corrida en verde ` +
      'y con la rama al dia: el resultado de los jobs pesados no puede cambiar',
  };
}

/** @param {string[]} args @param {string} [cwd] */
function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Archivos que cambian entre dos commits. Sin deteccion de renames: con ella,
 * `--name-only` lista solo el destino, y mover src/x.ts a docs/x.md pareceria solo docs.
 * @param {string} before @param {string} after @param {string} [cwd]
 * @returns {string[]}
 */
export function listChangedFiles(before, after, cwd) {
  return git(['diff', '--no-renames', '--name-only', before, after], cwd)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Si `ancestor` es ancestro de `descendant`. Ante un commit que no esta en el clon responde
 * false, que es la respuesta segura: obliga a correr todo.
 * @param {string} ancestor @param {string} descendant @param {string} [cwd]
 */
export function isAncestor(ancestor, descendant, cwd) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/** @typedef {{ path?: string, head_branch?: string, conclusion?: string | null }} WorkflowRun */

/**
 * Conclusion del CI sobre `headSha` en la misma rama. El verde de otro workflow
 * (approval-policy) o de otra rama con la misma cabeza no cuenta.
 * @param {{ repo: string, token: string, headSha: string, headRef: string, fetchImpl?: typeof fetch }} query
 * @returns {Promise<string | null>}
 */
export async function previousRunConclusion({ repo, token, headSha, headRef, fetchImpl = fetch }) {
  const url =
    `https://api.github.com/repos/${repo}/actions/runs` +
    `?head_sha=${encodeURIComponent(headSha)}&event=pull_request&per_page=20`;
  const response = await fetchImpl(url, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = /** @type {{ workflow_runs?: WorkflowRun[] }} */ (await response.json());
  const runs = (body.workflow_runs ?? []).filter(
    (run) => run.path === CI_WORKFLOW && run.head_branch === headRef
  );
  if (runs.some((run) => run.conclusion === 'success')) return 'success';
  return runs[0]?.conclusion ?? null;
}

/**
 * Los comandos de workflow cortan el mensaje en %, \r y \n.
 * @param {string} text
 */
function escapeCommand(text) {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

async function main() {
  const env = process.env;
  /** @type {Decision} */
  let decision;
  try {
    const before = env.BEFORE ?? '';
    const after = env.AFTER ?? '';
    // El checkout de pull_request es refs/pull/N/merge: su segundo padre es la cabeza de la
    // PR y el primero, la base contra la que corre este CI. Si el segundo padre no es la
    // cabeza que dice el evento, el merge no es el que creemos y no se decide nada.
    const head = git(['rev-parse', 'HEAD^2']);
    if (head !== after) {
      throw new Error(`el merge probado no es la cabeza del evento (${head} contra ${after})`);
    }
    const isFastForward = isAncestor(before, after);
    decision = decideSkipHeavy({
      isPrivate: env.IS_PRIVATE === 'true',
      eventName: env.EVENT_NAME ?? '',
      action: env.ACTION,
      isFastForward,
      changedFiles: isFastForward ? listChangedFiles(before, after) : [],
      previousRunConclusion: isFastForward
        ? await previousRunConclusion({
            repo: env.REPO ?? '',
            token: env.GITHUB_TOKEN ?? '',
            headSha: before,
            headRef: env.HEAD_REF ?? '',
          })
        : null,
      branchContainsBase: isAncestor('HEAD^1', after),
    });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    decision = runEverything(`no se pudo decidir, se corre todo: ${detalle}`);
  }

  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `skip_heavy=${decision.skipHeavy}\n`);
  // Sin comas en el title: GitHub las usa para separar propiedades y lo trunca.
  const title = decision.skipHeavy ? 'Jobs pesados salteados' : 'CI completo';
  console.log(`::notice title=${title}::${escapeCommand(decision.reason)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
