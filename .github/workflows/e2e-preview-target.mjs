import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Decide si un deployment de Vercel habilita el E2E privilegiado contra su Preview.
 *
 * El evento es el `repository_dispatch` que publica la integración Vercel ↔ GitHub
 * (`client_payload`: https://github.com/vercel/repository-dispatch). Corre siempre con el workflow de la rama
 * por defecto, así que esta decisión no la puede reescribir la PR que se está probando. Todo lo que llega en
 * el payload es dato: se valida y se cruza contra GitHub antes de entregar un secreto a código de una rama.
 */

export const STATUS_CONTEXT = 'e2e-preview';
export const BLOCKED_BY_MIGRATION = 'BLOCKED / REQUIRES DEVELOP MIGRATION';

const SHA = /^[0-9a-f]{40}$/;
// Solo el origen de un deployment de Vercel: sin path, query, puerto ni credenciales.
const PREVIEW_URL = /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/;
const DEPLOYMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * @typedef {{ full_name: string } | null} ApiRepo
 * @typedef {{
 *   number: number,
 *   state: string,
 *   base: { ref: string, repo: ApiRepo },
 *   head: { sha: string, repo: ApiRepo },
 * }} ApiPull
 * @typedef {{ sha: string, url: string, deploymentId: string, pullNumber: number }} PreviewTarget
 * @typedef {{ outcome: 'skip' | 'reject', reason: string } | { outcome: 'match', reason: string, target: PreviewTarget }} MatchResult
 * @typedef {{ context: string, description: string }} ApiStatus
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

/** @param {unknown} payload @returns {string} */
function payloadSha(payload) {
  return text(record(record(payload).git).sha);
}

/** @param {string} deploymentId */
export function deploymentMarker(deploymentId) {
  return `[${deploymentId}]`;
}

/**
 * @param {{ payload: unknown, expectedProjectId: string, repository: string, pulls: ApiPull[] }} input
 * @returns {MatchResult}
 */
export function matchPreview({ payload, expectedProjectId, repository, pulls }) {
  if (!expectedProjectId) {
    return { outcome: 'reject', reason: 'Falta VERCEL_PROJECT_ID en el Environment develop.' };
  }
  const data = record(payload);
  // Otro proyecto de Vercel conectado al mismo repo (por ejemplo staging) no es asunto de este gate.
  if (text(record(data.project).id) !== expectedProjectId) {
    return { outcome: 'skip', reason: 'El deployment no pertenece al proyecto Vercel de develop.' };
  }

  const sha = payloadSha(payload);
  const url = text(data.url);
  const deploymentId = text(data.id);
  if (!SHA.test(sha)) return { outcome: 'reject', reason: 'El payload no trae un SHA completo.' };
  if (!PREVIEW_URL.test(url)) {
    return { outcome: 'reject', reason: 'La URL del deployment no es un origen *.vercel.app.' };
  }
  if (!DEPLOYMENT_ID.test(deploymentId)) {
    return { outcome: 'reject', reason: 'El payload no trae un id de deployment válido.' };
  }

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
    target: { sha, url, deploymentId, pullNumber: pull.number },
  };
}

/**
 * @param {{ target: PreviewTarget, changedFiles: string[], statuses: ApiStatus[], runAttempt: number }} input
 * @returns {{ outcome: 'run' | 'blocked' | 'duplicate', reason: string }}
 */
export function gatePreview({ target, changedFiles, statuses, runAttempt }) {
  // Vercel puede avisar el mismo deployment con más de un tipo de evento. Un re-run manual sí vuelve a correr.
  const marker = deploymentMarker(target.deploymentId);
  const alreadyHandled = statuses.some(
    (status) => status.context === STATUS_CONTEXT && status.description.includes(marker)
  );
  if (runAttempt === 1 && alreadyHandled) {
    return { outcome: 'duplicate', reason: 'Ese deployment ya tiene una corrida de e2e-preview.' };
  }
  // Supabase Develop es compartido: una rama no le aplica esquema. Sin ese esquema el E2E no es evidencia.
  if (changedFiles.some((file) => file.startsWith('supabase/migrations/'))) {
    return { outcome: 'blocked', reason: BLOCKED_BY_MIGRATION };
  }
  return { outcome: 'run', reason: 'Preview listo para E2E.' };
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
  const payload = record(event).client_payload;
  const expectedProjectId = process.env.VERCEL_PROJECT_ID ?? '';

  // El SHA se valida antes de usarlo en una ruta; con un SHA inválido no hay PR que buscar.
  const sha = payloadSha(payload);
  const pulls = SHA.test(sha)
    ? (await githubList(repository, token, `/commits/${sha}/pulls`)).map(parsePull)
    : [];
  const match = matchPreview({ payload, expectedProjectId, repository, pulls });
  console.log(match.reason);
  if (match.outcome !== 'match') {
    if (match.outcome === 'reject') throw new Error('Preview rechazado (fail-closed).');
    appendFileSync(outputPath, 'run=false\n');
    return;
  }

  const { target } = match;
  const files = (await githubList(repository, token, `/pulls/${target.pullNumber}/files`)).map(
    record
  );
  const statuses = (await githubList(repository, token, `/commits/${target.sha}/statuses`)).map(
    record
  );
  const gate = gatePreview({
    target,
    changedFiles: files.flatMap((file) => [text(file.filename), text(file.previous_filename)]),
    statuses: statuses.map((status) => ({
      context: text(status.context),
      description: text(status.description),
    })),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT ?? '1'),
  });
  console.log(gate.reason);
  if (gate.outcome === 'duplicate') {
    appendFileSync(outputPath, 'run=false\n');
    return;
  }

  const blocked = gate.outcome === 'blocked';
  await githubApi(repository, token, `/statuses/${target.sha}`, {
    method: 'POST',
    body: JSON.stringify({
      context: STATUS_CONTEXT,
      // `error`, no `success`: un E2E que no corrió no es evidencia verde.
      state: blocked ? 'error' : 'pending',
      description: `${blocked ? BLOCKED_BY_MIGRATION : 'E2E contra el Preview en cola'} ${deploymentMarker(target.deploymentId)}`,
      target_url: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }),
  });
  appendFileSync(
    outputPath,
    [
      `run=${blocked ? 'false' : 'true'}`,
      `sha=${target.sha}`,
      `url=${target.url}`,
      `deployment_id=${target.deploymentId}`,
      `pr=${target.pullNumber}`,
      '',
    ].join('\n')
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((/** @type {unknown} */ error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
