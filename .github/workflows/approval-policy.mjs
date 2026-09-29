import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {{ user: string, state: string, submittedAt: string }} ReviewState */
/** @typedef {{ user?: { login?: string } | null, state: string, submitted_at?: string | null }} ApiReview */

/** @param {ReviewState[]} reviews */
function latestReviewStates(reviews) {
  const latest = new Map();
  for (const review of reviews) {
    if (!review.user || !review.submittedAt) continue;
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    const previous = latest.get(review.user);
    if (!previous || review.submittedAt >= previous.submittedAt) {
      latest.set(review.user, review);
    }
  }
  return latest;
}

/** @param {string} body */
function hasCompleteReport(body) {
  const section = body
    .split(/^### Informe de revisión de agy[^\n]*$/m)[1]
    ?.split(/^### /m)[0]
    ?.replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (!section) return false;
  return [
    /Informe revisar-pr\s*—\s*T-\d{3}/,
    /Resultado:\s*SIN BLOQUEANTES/,
    /Checks locales:/,
    /BLOQUEANTES:/,
    /MEJORAS:/,
    /No revisado \/ dudas para Lautaro073:/,
  ].every((part) => part.test(section));
}

/** @param {{ author: string, reviews: ReviewState[], body: string }} input */
export function evaluateApprovalPolicy({ author, reviews, body }) {
  const latest = latestReviewStates(reviews);
  if (author === 'Lautaro073') {
    // No se exige la aprobación de un par: P2 y P3 no programan, así que no
    // pueden revisar código, y GitHub tampoco permite aprobar el propio PR.
    // Sería un check que nadie puede satisfacer. Lo que lo reemplaza es el
    // informe de revisar-pr en el cuerpo, que es exactamente lo que §2 le pide
    // a este control (docs/implementation-plan.md).
    if (!hasCompleteReport(body)) {
      return { ok: false, reason: 'Falta el informe completo de revisar-pr sin bloqueantes.' };
    }
    return { ok: true, reason: 'Informe de revisar-pr completo y sin bloqueantes.' };
  }

  if (latest.get('Lautaro073')?.state !== 'APPROVED') {
    return { ok: false, reason: 'El PR requiere aprobación vigente de Lautaro073.' };
  }
  return { ok: true, reason: 'Aprobación de Lautaro073 vigente.' };
}

/** @param {string} repository @param {string} token @param {string} path */
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

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!repository || !token || !eventPath) {
    throw new Error('Faltan variables obligatorias de GitHub Actions.');
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repositorio inválido.');
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const number = event.pull_request?.number;
  if (!Number.isSafeInteger(number))
    throw new Error('El evento no contiene un número de PR válido.');

  const pull = await githubApi(repository, token, `/pulls/${number}`);
  const reviews = [];
  for (let page = 1; ; page += 1) {
    /** @type {ApiReview[]} */
    const batch = await githubApi(
      repository,
      token,
      `/pulls/${number}/reviews?per_page=100&page=${page}`
    );
    reviews.push(
      ...batch.map((review) => ({
        user: review.user?.login ?? '',
        state: review.state,
        submittedAt: review.submitted_at ?? '',
      }))
    );
    if (batch.length < 100) break;
  }
  const result = evaluateApprovalPolicy({
    author: pull.user?.login ?? '',
    reviews,
    body: pull.body ?? '',
  });
  console.log(result.reason);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
