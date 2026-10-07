import { spawn } from 'node:child_process';
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * T-347: mutaciones RED de E2E contra un build efímero en el runner trusted.
 *
 * Corre siempre con el workflow de la rama por defecto (`repository_dispatch`), y este módulo, el manifest y los
 * patches se leen de ese checkout. El `client_payload` y todo lo que llega de la API de GitHub es dato: se valida
 * antes de resolver el SHA objetivo o de tocar un secreto. Del SHA objetivo solo se usan el código de la app y el
 * spec. La mutación se aplica al checkout efímero de ese SHA y nunca se commitea, se pushea ni se despliega.
 */

export const MUTATION_EVENT_TYPE = 'e2e.mutation.requested';
export const BLOCKED_BY_MIGRATION = 'BLOCKED / REQUIRES DEVELOP MIGRATION';

/** @typedef {'RED_CONFIRMED' | 'CONTROL_NOT_GREEN' | 'MUTANT_SURVIVED' | 'UNEXPECTED_FAILURE' | 'PATCH_DID_NOT_APPLY'} Outcome */
export const OUTCOMES = /** @type {const} */ ([
  'RED_CONFIRMED',
  'CONTROL_NOT_GREEN',
  'MUTANT_SURVIVED',
  'UNEXPECTED_FAILURE',
  'PATCH_DID_NOT_APPLY',
]);

const SHA = /^[0-9a-f]{40}$/;
const MUTATION_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const PATCH_FILE = /^[a-z0-9][a-z0-9-]{2,63}\.patch$/;
// Solo specs del proyecto chromium: el workflow corre `--project=chromium`.
const SPEC_PATH = /^e2e\/specs\/[a-z0-9][a-z0-9-]*\.spec\.ts$/;
const PROJECT_REF = /^[a-z0-9]{8,40}$/;
const LOCAL_BASE_URL = /^http:\/\/127\.0\.0\.1:([0-9]{2,5})$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
// Una expectativa genérica («Error», «expect(») haría pasar cualquier falla por RED_CONFIRMED.
const MIN_EXPECTED_FAILURE_LENGTH = 20;

/** @param {unknown} value @returns {string} */
function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function record(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @returns {unknown[]} */
function list(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @typedef {{ kind: 'pr', number: number } | { kind: 'develop' }} Target
 * @typedef {{ ok: true, target: Target, mutation: string } | { ok: false, reason: string }} PayloadResult
 */

/**
 * Valida el `client_payload`: `{ target, mutation }` y nada más interpretable.
 * @param {unknown} payload
 * @returns {PayloadResult}
 */
export function parsePayload(payload) {
  const data = record(payload);
  const mutation = data.mutation;
  if (typeof mutation !== 'string' || !MUTATION_ID.test(mutation)) {
    return { ok: false, reason: 'client_payload.mutation no es un id de catálogo válido.' };
  }
  const target = data.target;
  if (target === 'develop') return { ok: true, target: { kind: 'develop' }, mutation };
  // Un número de PR llega como número o como string de dígitos; nada de rutas, SHAs ni refs libres.
  const number =
    typeof target === 'number'
      ? target
      : typeof target === 'string' && /^[1-9][0-9]{0,9}$/.test(target)
        ? Number(target)
        : Number.NaN;
  if (!Number.isSafeInteger(number) || number <= 0) {
    return {
      ok: false,
      reason: 'client_payload.target tiene que ser un número de PR o «develop».',
    };
  }
  return { ok: true, target: { kind: 'pr', number }, mutation };
}

/**
 * @typedef {{
 *   id: string,
 *   invariant: string,
 *   patch: string,
 *   spec: string,
 *   grep: string,
 *   expectedFailure: string[],
 * }} Mutation
 */

/**
 * Valida el manifest completo del catálogo de la rama por defecto.
 * @param {unknown} manifest
 * @returns {{ ok: true, mutations: Mutation[] } | { ok: false, reason: string }}
 */
export function parseManifest(manifest) {
  const data = record(manifest);
  if (data.version !== 1) return { ok: false, reason: 'manifest.json: version tiene que ser 1.' };
  if (!Array.isArray(data.mutations) || data.mutations.length === 0) {
    return { ok: false, reason: 'manifest.json: mutations tiene que ser una lista no vacía.' };
  }
  /** @type {Mutation[]} */
  const mutations = [];
  const seen = new Set();
  for (const item of data.mutations) {
    const entry = record(item);
    const id = text(entry.id);
    const where = `manifest.json (${id || 'sin id'})`;
    if (!MUTATION_ID.test(id)) return { ok: false, reason: `${where}: id inválido.` };
    if (seen.has(id)) return { ok: false, reason: `${where}: id repetido.` };
    seen.add(id);
    const invariant = text(entry.invariant).trim();
    if (!invariant) return { ok: false, reason: `${where}: falta invariant.` };
    const patch = text(entry.patch);
    if (!PATCH_FILE.test(patch) || patch !== `${id}.patch`) {
      return { ok: false, reason: `${where}: patch tiene que ser <id>.patch.` };
    }
    const spec = text(entry.spec);
    if (!SPEC_PATH.test(spec)) {
      return {
        ok: false,
        reason: `${where}: spec tiene que ser un e2e/specs/*.spec.ts del proyecto chromium.`,
      };
    }
    const grep = text(entry.grep).trim();
    if (!grep) return { ok: false, reason: `${where}: falta grep (título exacto del caso).` };
    const expected = entry.expectedFailure;
    if (
      !Array.isArray(expected) ||
      expected.length === 0 ||
      !expected.every((value) => typeof value === 'string' && value.trim().length > 0) ||
      !expected.some(
        (value) => typeof value === 'string' && value.trim().length >= MIN_EXPECTED_FAILURE_LENGTH
      )
    ) {
      return {
        ok: false,
        reason: `${where}: expectedFailure tiene que nombrar la aserción concreta (al menos un texto de ${MIN_EXPECTED_FAILURE_LENGTH} caracteres).`,
      };
    }
    mutations.push({
      id,
      invariant,
      patch,
      spec,
      grep,
      expectedFailure: expected.map((value) => String(value)),
    });
  }
  return { ok: true, mutations };
}

/**
 * Rutas que toca un patch de git (`diff --git`, `---`, `+++`, renombres y copias).
 * @param {string} patchText
 * @returns {{ paths: string[], binary: boolean }}
 */
export function patchPaths(patchText) {
  const paths = new Set();
  let binary = false;
  for (const line of patchText.replace(/\r\n/g, '\n').split('\n')) {
    const header = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line);
    if (header) {
      paths.add(header[1]);
      paths.add(header[2]);
      continue;
    }
    const side = /^(?:---|\+\+\+) (?:[ab]\/)?(\S+)/.exec(line);
    if (side && side[1] !== '/dev/null') {
      paths.add(side[1]);
      continue;
    }
    const moved = /^(?:rename|copy) (?:from|to) (\S+)$/.exec(line);
    if (moved) paths.add(moved[1]);
    if (line.startsWith('GIT binary patch') || line.startsWith('Binary files ')) binary = true;
  }
  return { paths: [...paths].filter((path) => path !== undefined), binary };
}

/**
 * La mutación rompe código de producción, nunca el test, el entorno ni el control plane.
 * @param {string} patchText
 * @returns {{ ok: true, paths: string[] } | { ok: false, reason: string }}
 */
export function validatePatch(patchText) {
  const { paths, binary } = patchPaths(patchText);
  if (binary) return { ok: false, reason: 'El patch no puede ser binario.' };
  if (paths.length === 0) return { ok: false, reason: 'El patch no toca ningún archivo.' };
  const rejected = paths.filter(
    (path) =>
      !path.startsWith('src/') ||
      path.split('/').some((segment) => segment === '..' || segment === '.' || segment === '') ||
      TEST_FILE.test(path) ||
      path.startsWith('src/server/e2e/')
  );
  if (rejected.length > 0) {
    return {
      ok: false,
      reason: `El patch solo puede tocar src/** (sin tests ni src/server/e2e/**): ${rejected.join(', ')}`,
    };
  }
  return { ok: true, paths };
}

/**
 * @typedef {{ number: number, state: string, base: { ref: string, repo: string }, head: { sha: string, repo: string } }} Pull
 */

/** @param {unknown} item @returns {Pull} */
export function parsePull(item) {
  const pull = record(item);
  const base = record(pull.base);
  const head = record(pull.head);
  return {
    number: typeof pull.number === 'number' ? pull.number : Number.NaN,
    state: text(pull.state),
    base: { ref: text(base.ref), repo: text(record(base.repo).full_name) },
    head: { sha: text(head.sha), repo: text(record(head.repo).full_name) },
  };
}

/**
 * La PR tiene que ser interna, abierta, contra develop y con un SHA completo. Con migraciones no hay evidencia:
 * Supabase Develop no tiene ese esquema hasta el merge.
 * @param {{ pull: Pull, expectedNumber: number, repository: string, changedFiles: string[] }} input
 * @returns {{ ok: true, sha: string } | { ok: false, reason: string }}
 */
export function validatePull({ pull, expectedNumber, repository, changedFiles }) {
  if (pull.number !== expectedNumber) return { ok: false, reason: 'La API devolvió otra PR.' };
  if (pull.state !== 'open')
    return { ok: false, reason: `La PR #${expectedNumber} no está abierta.` };
  if (pull.base.ref !== 'develop' || pull.base.repo !== repository) {
    return { ok: false, reason: `La PR #${expectedNumber} no apunta a develop de este repo.` };
  }
  if (pull.head.repo !== repository) {
    return {
      ok: false,
      reason: `La PR #${expectedNumber} viene de un fork: no recibe secretos de develop.`,
    };
  }
  if (!SHA.test(pull.head.sha)) return { ok: false, reason: 'La PR no trae un head SHA completo.' };
  if (changedFiles.some((file) => file.startsWith('supabase/migrations/'))) {
    return { ok: false, reason: BLOCKED_BY_MIGRATION };
  }
  return { ok: true, sha: pull.head.sha };
}

/**
 * Producción nunca: el ref de producción tiene que existir y ser distinto, y la URL tiene que ser la de Develop.
 * @param {{ supabaseUrl: string, developRef: string, stagingRef: string, productionRef: string }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkEnvironmentRefs({ supabaseUrl, developRef, stagingRef, productionRef }) {
  if (!PROJECT_REF.test(productionRef)) {
    return {
      ok: false,
      reason: 'Falta SUPABASE_PRODUCTION_PROJECT_REF: sin él no se puede excluir producción.',
    };
  }
  if (!PROJECT_REF.test(developRef) || !PROJECT_REF.test(stagingRef)) {
    return { ok: false, reason: 'Falta SUPABASE_DEVELOP_PROJECT_REF o SUPABASE_PROJECT_REF.' };
  }
  if (developRef === productionRef) {
    return { ok: false, reason: 'El ref de develop coincide con el de producción.' };
  }
  if (developRef === stagingRef)
    return { ok: false, reason: 'El ref de develop debe ser distinto al de staging.' };
  if (supabaseUrl !== `https://${developRef}.supabase.co`) {
    return {
      ok: false,
      reason: 'NEXT_PUBLIC_SUPABASE_URL no apunta a SUPABASE_DEVELOP_PROJECT_REF.',
    };
  }
  return { ok: true };
}

/**
 * El mutante solo existe en el runner: la base URL es exactamente `http://127.0.0.1:<puerto>`.
 * @param {string} url
 * @returns {{ ok: true, port: number } | { ok: false, reason: string }}
 */
export function checkBaseUrl(url) {
  const match = LOCAL_BASE_URL.exec(url);
  const port = match ? Number(match[1]) : Number.NaN;
  if (!match || port < 1024 || port > 65535) {
    return {
      ok: false,
      reason: 'La base URL tiene que ser exactamente http://127.0.0.1:<puerto>.',
    };
  }
  return { ok: true, port };
}

/** @param {string} value */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Los mismos comandos para el control y el mutante: mismo runtime, mismo spec, sin retries ni repeticiones.
 * @param {{ spec: string, grep: string, port: number }} input
 */
export function phaseCommands({ spec, grep, port }) {
  return {
    build: ['pnpm', 'build'],
    start: ['pnpm', 'start', '-H', '127.0.0.1', '-p', String(port)],
    test: [
      'pnpm',
      'exec',
      'playwright',
      'test',
      spec,
      '--project=chromium',
      '--workers=1',
      '--retries=0',
      `--grep=${escapeRegExp(grep)}`,
      '--reporter=list,json',
    ],
  };
}

// Secuencias de color ANSI (ESC [ ... letra) que Playwright deja en los mensajes de error.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');

/** @param {string} value */
export function stripAnsi(value) {
  return value.replace(ANSI, '');
}

/**
 * @typedef {{ status: string, errors: string[] }} CaseResult
 */

/**
 * Busca en el reporte JSON de Playwright los resultados del caso con ese título exacto.
 * @param {unknown} report
 * @param {string} title
 * @returns {CaseResult[]}
 */
export function caseResults(report, title) {
  /** @type {CaseResult[]} */
  const found = [];
  /** @param {unknown} suite */
  const visit = (suite) => {
    const node = record(suite);
    for (const spec of list(node.specs)) {
      const specNode = record(spec);
      if (text(specNode.title) !== title) continue;
      for (const test of list(specNode.tests)) {
        for (const result of list(record(test).results)) {
          const res = record(result);
          found.push({
            status: text(res.status),
            errors: list(res.errors).map((error) => stripAnsi(text(record(error).message))),
          });
        }
      }
    }
    for (const child of list(node.suites)) visit(child);
  };
  for (const suite of list(record(report).suites)) visit(suite);
  return found;
}

/**
 * @param {{
 *   control: CaseResult[] | null,
 *   patchApplied: boolean | null,
 *   mutant: CaseResult[] | null,
 *   expectedFailure: string[],
 * }} input
 * @returns {{ outcome: Outcome, reason: string }}
 */
export function classify({ control, patchApplied, mutant, expectedFailure }) {
  const [controlCase] = control ?? [];
  if (!control || control.length !== 1 || controlCase?.status !== 'passed') {
    return {
      outcome: 'CONTROL_NOT_GREEN',
      reason:
        'El caso sin mutar no pasó exactamente una vez: no hay base para atribuir el RED a la mutación.',
    };
  }
  if (patchApplied !== true) {
    return {
      outcome: 'PATCH_DID_NOT_APPLY',
      reason: 'El patch no se aplica limpio sobre el SHA objetivo.',
    };
  }
  const [mutantCase] = mutant ?? [];
  if (!mutant || mutant.length !== 1 || !mutantCase) {
    return {
      outcome: 'UNEXPECTED_FAILURE',
      reason:
        'El mutante no produjo exactamente un resultado del caso (¿falló el build o el servidor?).',
    };
  }
  if (mutantCase.status === 'passed') {
    return {
      outcome: 'MUTANT_SURVIVED',
      reason: 'El caso pasa con la mutación: no protege esa regla.',
    };
  }
  const errors = mutantCase.errors.join('\n');
  const missing = expectedFailure.filter((expected) => !errors.includes(expected));
  if (mutantCase.status !== 'failed' || missing.length > 0) {
    return {
      outcome: 'UNEXPECTED_FAILURE',
      reason: `El mutante falló (${mutantCase.status}) pero no por la aserción esperada. Falta: ${missing.join(' | ') || '(estado distinto de failed)'}`,
    };
  }
  return {
    outcome: 'RED_CONFIRMED',
    reason: 'Control GREEN y mutante RED por la aserción esperada.',
  };
}

// --------------------------------------------------------------------------------------------------------------
// CLI: cada subcomando es un paso del workflow. Nunca imprime variables de entorno.
// --------------------------------------------------------------------------------------------------------------

/**
 * @param {string} repository @param {string} token @param {string} path
 * @returns {Promise<unknown>}
 */
async function githubApi(repository, token, path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
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
    const batch = await githubApi(repository, token, `${path}?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`GitHub API no devolvió una lista en ${path}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

/** @param {string} name */
function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}.`);
  return value;
}

/**
 * @param {Mutation[]} mutations @param {string} id
 * @returns {{ ok: true, mutation: Mutation } | { ok: false, reason: string }}
 */
export function findMutation(mutations, id) {
  const mutation = mutations.find((item) => item.id === id);
  return mutation
    ? { ok: true, mutation }
    : { ok: false, reason: `La mutación «${id}» no está en el catálogo de la rama por defecto.` };
}

/** @param {string} catalogDir @param {string} id */
function loadMutation(catalogDir, id) {
  const manifest = parseManifest(
    JSON.parse(readFileSync(join(catalogDir, 'manifest.json'), 'utf8'))
  );
  if (!manifest.ok) throw new Error(manifest.reason);
  const found = findMutation(manifest.mutations, id);
  if (!found.ok) throw new Error(found.reason);
  return found.mutation;
}

/** Paso `resolve`: valida el payload y la PR, y fija el SHA, el patch y el caso. */
async function resolveCommand() {
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const token = requiredEnv('GITHUB_TOKEN');
  const outputPath = requiredEnv('GITHUB_OUTPUT');
  const catalogDir = requiredEnv('MUTATION_CATALOG_DIR');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repositorio inválido.');

  const event = record(JSON.parse(readFileSync(requiredEnv('GITHUB_EVENT_PATH'), 'utf8')));
  if (text(event.action) !== MUTATION_EVENT_TYPE)
    throw new Error('Evento distinto de e2e.mutation.requested.');
  const payload = parsePayload(event.client_payload);
  if (!payload.ok) throw new Error(payload.reason);

  const mutation = loadMutation(catalogDir, payload.mutation);
  const patchText = readFileSync(join(catalogDir, mutation.patch), 'utf8');
  const patch = validatePatch(patchText);
  if (!patch.ok) throw new Error(patch.reason);

  /** @type {string} */
  let sha;
  if (payload.target.kind === 'develop') {
    const branch = record(await githubApi(repository, token, '/branches/develop'));
    sha = text(record(branch.commit).sha);
    if (!SHA.test(sha)) throw new Error('develop no trae un SHA completo.');
  } else {
    const pull = parsePull(await githubApi(repository, token, `/pulls/${payload.target.number}`));
    const files = (
      await githubList(repository, token, `/pulls/${payload.target.number}/files`)
    ).map(record);
    const checked = validatePull({
      pull,
      expectedNumber: payload.target.number,
      repository,
      changedFiles: files.flatMap((file) => [text(file.filename), text(file.previous_filename)]),
    });
    if (!checked.ok) throw new Error(checked.reason);
    sha = checked.sha;
  }

  console.log(`Mutación ${mutation.id} sobre ${sha} (${mutation.spec} › ${mutation.grep}).`);
  appendFileSync(
    outputPath,
    [`sha=${sha}`, `mutation=${mutation.id}`, `patch=${mutation.patch}`, ''].join('\n')
  );
}

/** Paso `check-env`: los guardas contra producción, antes de cualquier build con secretos. */
function checkEnvCommand() {
  const refs = checkEnvironmentRefs({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    developRef: process.env.SUPABASE_PROJECT_REF ?? '',
    stagingRef: process.env.SUPABASE_STAGING_PROJECT_REF ?? '',
    productionRef: process.env.SUPABASE_PRODUCTION_PROJECT_REF ?? '',
  });
  if (!refs.ok) throw new Error(refs.reason);
  const base = checkBaseUrl(process.env.PLAYWRIGHT_TEST_BASE_URL ?? '');
  if (!base.ok) throw new Error(base.reason);
  console.log('Entorno verificado: Supabase Develop, producción excluida y base URL local.');
}

/**
 * @param {string[]} command @param {string} cwd @param {string} logPath
 * @returns {Promise<number>}
 */
function run(command, cwd, logPath) {
  const [bin, ...args] = command;
  if (!bin) return Promise.resolve(1);
  const log = createWriteStream(logPath, { flags: 'a' });
  log.write(`$ ${command.join(' ')}\n`);
  return new Promise((resolveExit) => {
    const child = spawn(bin, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      log.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      log.write(chunk);
    });
    child.on('close', (code) => {
      log.end();
      resolveExit(code ?? 1);
    });
  });
}

/** @param {string} url @param {number} attempts */
async function waitForHealth(url, attempts) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.status === 200) return true;
    } catch {
      // El servidor todavía no escucha.
    }
    await new Promise((done) => setTimeout(done, 2_000));
  }
  return false;
}

/**
 * Paso `run-phase <control|mutant>`: build limpio, servidor en 127.0.0.1, el caso y el reporte. El resultado lo
 * decide `classify`; este paso no falla el job por un RED.
 */
async function runPhaseCommand(/** @type {string} */ phase) {
  if (phase !== 'control' && phase !== 'mutant') throw new Error('Fase inválida.');
  const catalogDir = requiredEnv('MUTATION_CATALOG_DIR');
  const targetDir = requiredEnv('MUTATION_TARGET_DIR');
  const evidenceDir = requiredEnv('MUTATION_EVIDENCE_DIR');
  const mutation = loadMutation(catalogDir, requiredEnv('MUTATION_ID'));
  const base = checkBaseUrl(process.env.PLAYWRIGHT_TEST_BASE_URL ?? '');
  if (!base.ok) throw new Error(base.reason);

  const commands = phaseCommands({ spec: mutation.spec, grep: mutation.grep, port: base.port });
  const logPath = join(evidenceDir, `${phase}.log`);
  const reportPath = join(evidenceDir, `${phase}.json`);
  rmSync(join(targetDir, '.next'), { recursive: true, force: true });
  rmSync(reportPath, { force: true });

  if ((await run(commands.build, targetDir, logPath)) !== 0) {
    console.log(`::warning::El build de la fase ${phase} falló.`);
    return;
  }
  const [startBin, ...startArgs] = commands.start;
  if (!startBin) throw new Error('Comando de start vacío.');
  const server = spawn(startBin, startArgs, {
    cwd: targetDir,
    env: process.env,
    stdio: 'ignore',
    detached: true,
  });
  try {
    if (!(await waitForHealth(`http://127.0.0.1:${base.port}`, 60))) {
      console.log(`::warning::El servidor de la fase ${phase} no respondió /api/health.`);
      return;
    }
    process.env.PLAYWRIGHT_JSON_OUTPUT_NAME = reportPath;
    const code = await run(commands.test, targetDir, logPath);
    console.log(`Fase ${phase}: playwright terminó con ${code}.`);
  } finally {
    if (server.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        // Ya terminó.
      }
    }
  }
}

/** @param {string} path @returns {unknown} */
function readJsonIfPresent(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

/** Paso `classify`: escribe la evidencia y falla el job salvo RED_CONFIRMED. */
function classifyCommand() {
  const catalogDir = requiredEnv('MUTATION_CATALOG_DIR');
  const evidenceDir = requiredEnv('MUTATION_EVIDENCE_DIR');
  const mutation = loadMutation(catalogDir, requiredEnv('MUTATION_ID'));
  const patchText = readFileSync(join(catalogDir, mutation.patch), 'utf8');
  const controlReport = readJsonIfPresent(join(evidenceDir, 'control.json'));
  const mutantReport = readJsonIfPresent(join(evidenceDir, 'mutant.json'));
  const applied = process.env.MUTATION_PATCH_APPLIED;
  const result = classify({
    control: controlReport === null ? null : caseResults(controlReport, mutation.grep),
    patchApplied: applied === 'true' ? true : applied === 'false' ? false : null,
    mutant: mutantReport === null ? null : caseResults(mutantReport, mutation.grep),
    expectedFailure: mutation.expectedFailure,
  });
  const port = checkBaseUrl(process.env.PLAYWRIGHT_TEST_BASE_URL ?? '');
  const commands = phaseCommands({
    spec: mutation.spec,
    grep: mutation.grep,
    port: port.ok ? port.port : 0,
  });
  const summary = {
    baseSha: process.env.MUTATION_TARGET_SHA ?? '',
    mutation: mutation.id,
    invariant: mutation.invariant,
    patch: mutation.patch,
    patchSha256: createHash('sha256').update(patchText).digest('hex'),
    spec: mutation.spec,
    grep: mutation.grep,
    expectedFailure: mutation.expectedFailure,
    commands: Object.fromEntries(
      Object.entries(commands).map(([name, cmd]) => [name, cmd.join(' ')])
    ),
    outcome: result.outcome,
    reason: result.reason,
  };
  writeFileSync(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(evidenceDir, mutation.patch), patchText);
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    appendFileSync(
      stepSummary,
      [
        `## e2e-mutation: ${result.outcome}`,
        '',
        `- Mutación: \`${mutation.id}\` (${mutation.invariant})`,
        `- SHA base: \`${summary.baseSha}\``,
        `- Caso: \`${mutation.spec}\` › ${mutation.grep}`,
        `- Patch SHA-256: \`${summary.patchSha256}\``,
        `- ${result.reason}`,
        '',
      ].join('\n')
    );
  }
  console.log(`${result.outcome}: ${result.reason}`);
  if (result.outcome !== 'RED_CONFIRMED') process.exitCode = 1;
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === 'resolve') return resolveCommand();
  if (command === 'check-env') return checkEnvCommand();
  if (command === 'run-phase') return runPhaseCommand(arg ?? '');
  if (command === 'classify') return classifyCommand();
  throw new Error(
    'Uso: e2e-mutation.mjs <resolve|check-env|run-phase control|run-phase mutant|classify>'
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((/** @type {unknown} */ error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
