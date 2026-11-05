import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Decide si una corrida terminada de CI habilita el E2E privilegiado sobre el SHA de su PR.
 *
 * El evento es `workflow_run` (T-422): corre siempre con el workflow de la rama por defecto, así que esta decisión
 * no la puede reescribir la PR que se está probando. Todo lo que llega en el evento es dato: se valida y se cruza
 * contra GitHub antes de entregar un secreto a código de una rama.
 */

export const STATUS_CONTEXT = 'e2e-preview';
export const BLOCKED_BY_MIGRATION = 'BLOCKED / REQUIRES DEVELOP MIGRATION';

const SHA = /^[0-9a-f]{40}$/;

/**
 * @typedef {{ full_name: string } | null} ApiRepo
 * @typedef {{
 *   number: number,
 *   state: string,
 *   base: { ref: string, repo: ApiRepo },
 *   head: { sha: string, repo: ApiRepo },
 * }} ApiPull
 * @typedef {{ sha: string, pullNumber: number }} PullTarget
 * @typedef {{ outcome: 'skip' | 'reject', reason: string } | { outcome: 'match', reason: string, target: PullTarget }} MatchResult
 */

/** @param {unknown} value @returns {string} */
function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Un objeto plano para leer campos de un dato no confiable. Lo que no es objeto se lee como vacío.
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function record(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @returns {ApiRepo} */
function parseRepo(value) {
  return value === null || value === undefined
    ? null
    : { full_name: text(record(value).full_name) };
}

/**
 * Normaliza una PR devuelta por la API de GitHub. Un campo ausente o de otro tipo queda en un valor que no
 * puede coincidir con nada.
 * @param {unknown} item
 * @returns {ApiPull}
 */
export function parsePull(item) {
  const pull = record(item);
  const base = record(pull.base);
  const head = record(pull.head);
  return {
    number: typeof pull.number === 'number' ? pull.number : Number.NaN,
    state: text(pull.state),
    base: { ref: text(base.ref), repo: parseRepo(base.repo) },
    head: { sha: text(head.sha), repo: parseRepo(head.repo) },
  };
}

/** @param {unknown} run @returns {string} */
export function runSha(run) {
  return text(record(run).head_sha);
}

/**
 * @param {{ run: unknown, repository: string, pulls: ApiPull[] }} input
 * @returns {MatchResult}
 */
export function matchPullRequest({ run, repository, pulls }) {
  const data = record(run);
  // Solo una corrida de CI disparada por una PR y en verde: un push a develop, un CI rojo o cancelado no.
  if (text(data.event) !== 'pull_request') {
    return { outcome: 'skip', reason: 'La corrida de CI no viene de una PR.' };
  }
  if (text(data.conclusion) !== 'success') {
    return { outcome: 'skip', reason: 'El CI de la PR no terminó en verde.' };
  }

  const sha = runSha(run);
  if (!SHA.test(sha)) return { outcome: 'reject', reason: 'La corrida no trae un SHA completo.' };

  const candidates = pulls.filter(
    (pull) =>
      pull.state === 'open' &&
      pull.base.ref === 'develop' &&
      pull.base.repo?.full_name === repository &&
      pull.head.sha === sha
  );
  if (candidates.length === 0) {
    return { outcome: 'skip', reason: 'No hay una PR abierta contra develop con ese head SHA.' };
  }
  const [pull] = candidates;
  if (candidates.length > 1 || !pull) {
    return { outcome: 'reject', reason: 'Más de una PR abierta comparte ese head SHA.' };
  }
  if (pull.head.repo?.full_name !== repository) {
    return { outcome: 'skip', reason: 'La PR viene de un fork: no recibe secretos de develop.' };
  }
  if (!Number.isSafeInteger(pull.number) || pull.number <= 0) {
    return { outcome: 'reject', reason: 'La PR encontrada no trae un número válido.' };
  }
  return {
    outcome: 'match',
    reason: `PR interna #${pull.number} contra develop.`,
    target: { sha, pullNumber: pull.number },
  };
}

/**
 * @param {{ changedFiles: string[] }} input
 * @returns {{ outcome: 'run' | 'blocked', reason: string }}
 */
export function gatePullRequest({ changedFiles }) {
  // Supabase Develop es compartido: una rama no le aplica esquema. Sin ese esquema el E2E no es evidencia.
  if (changedFiles.some((file) => file.startsWith('supabase/migrations/'))) {
    return { outcome: 'blocked', reason: BLOCKED_BY_MIGRATION };
  }
  return { outcome: 'run', reason: 'PR lista para E2E.' };
}

/**
 * @param {string} repository @param {string} token @param {string} path @param {RequestInit} [init]
 * @returns {Promise<unknown>}
 */
async function githubApi(repository, token, path, init) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GitHub API devolvió ${response.status} al consultar ${path}`);
  return response.json();
}

/**
 * @param {string} repository @param {string} token @param {string} path
 * @returns {Promise<unknown[]>}
 */
async function githubList(repository, token, path) {
  /** @type {unknown[]} */
  const items = [];
  for (let page = 1; ; page += 1) {
    /** @type {unknown} */
    const batch = await githubApi(repository, token, `${path}?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`GitHub API no devolvió una lista en ${path}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!repository || !token || !eventPath || !outputPath) {
    throw new Error('Faltan variables obligatorias de GitHub Actions.');
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repositorio inválido.');
  /** @type {unknown} */
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const run = record(event).workflow_run;

  // El SHA se valida antes de usarlo en una ruta; con un SHA inválido no hay PR que buscar.
  const sha = runSha(run);
  const pulls = SHA.test(sha)
    ? (await githubList(repository, token, `/commits/${sha}/pulls`)).map(parsePull)
    : [];
  const match = matchPullRequest({ run, repository, pulls });
  console.log(match.reason);
  if (match.outcome !== 'match') {
    if (match.outcome === 'reject') throw new Error('Corrida rechazada (fail-closed).');
    appendFileSync(outputPath, 'run=false\n');
    return;
  }

  const { target } = match;
  const files = (await githubList(repository, token, `/pulls/${target.pullNumber}/files`)).map(
    record
  );
  const gate = gatePullRequest({
    changedFiles: files.flatMap((file) => [text(file.filename), text(file.previous_filename)]),
  });
  console.log(gate.reason);

  const blocked = gate.outcome === 'blocked';
  await githubApi(repository, token, `/statuses/${target.sha}`, {
    method: 'POST',
    body: JSON.stringify({
      context: STATUS_CONTEXT,
      // `error`, no `success`: un E2E que no corrió no es evidencia verde.
      state: blocked ? 'error' : 'pending',
      description: blocked ? BLOCKED_BY_MIGRATION : 'E2E contra el build del runner en cola',
      target_url: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }),
  });
  appendFileSync(
    outputPath,
    [`run=${blocked ? 'false' : 'true'}`, `sha=${target.sha}`, `pr=${target.pullNumber}`, ''].join(
      '\n'
    )
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((/** @type {unknown} */ error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
