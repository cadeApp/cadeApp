import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE_LABELS = ['bloqueada', 'lista', 'en-curso', 'en-review', 'hecha'];

const PROJECT_ID = 'PVT_kwDOE706PM4Bj_G5';
const STATUS_FIELD_ID = 'PVTSSF_lADOE706PM4Bj_G5zhixcFY';

/** @type {Record<string, { column: string, optionId: string }>} */
const STATE_METADATA = {
  bloqueada: { column: 'Bloqueada', optionId: '95978306' },
  lista: { column: 'Lista', optionId: '0784b30a' },
  'en-curso': { column: 'En curso', optionId: '4e3fce02' },
  'en-review': { column: 'En review', optionId: '7ccff904' },
  hecha: { column: 'Hecha', optionId: '9904ad35' },
};

const PHASE_0_TASKS = [
  'T-000',
  'T-001',
  'T-002',
  'T-003',
  'T-004',
  'T-005',
  'T-006',
  'T-007',
  'T-008',
  'T-009',
];

/**
 * @typedef {{
 *   number: number,
 *   nodeId?: string,
 *   title: string,
 *   body: string,
 *   state: string,
 *   labels: string[],
 * }} IssueSnapshot
 */

/**
 * @typedef {{
 *   number: number,
 *   title: string,
 *   headRefName: string,
 *   isDraft: boolean,
 * }} PullRequestSnapshot
 */

/**
 * @typedef {{
 *   number: number,
 *   nodeId?: string,
 *   taskId: string,
 *   targetState: string,
 *   targetColumn: string,
 *   optionId: string,
 *   shouldCloseIssue: boolean,
 *   shouldReopenIssue?: boolean,
 *   addLabels: string[],
 *   removeLabels: string[],
 * }} BoardTransition
 */

/** @param {string} text */
export function extractTaskId(text) {
  const normalized = text.replace(/[\u2010-\u2015]/g, '-');
  const bracketMatch = normalized.match(/\[(T-\d+|CC-\d+)\]/i);
  if (bracketMatch?.[1]) return bracketMatch[1].toUpperCase();

  const prefixMatch = normalized.match(/^(?:feat\/|cc\/)?(T-\d+|CC-\d+)(?:[:\s-]|$)/i);
  if (prefixMatch?.[1]) return prefixMatch[1].toUpperCase();

  const fallbackMatch = normalized.match(/\b(T-\d+|CC-\d+)\b/i);
  return fallbackMatch?.[1]?.toUpperCase() ?? '';
}

/**
 * Extracts task ID from a Pull Request only when it represents the actual implementation
 * (`feat/T-xxx...` or `cc/CC-xxx...`), ignoring `docs/T-xxx...` or `fix/...` branches
 * that only create or adjust markdown task cards.
 *
 * @param {string} headRefName
 * @param {string} title
 */
export function extractPrTaskId(headRefName, title) {
  const normalizedRef = headRefName.replace(/[\u2010-\u2015]/g, '-').trim();
  const branchMatch = normalizedRef.match(/^(?:feat|cc)\/(T-\d+|CC-\d+)\b/i);
  if (branchMatch?.[1]) return branchMatch[1].toUpperCase();
  if (/^(?:docs|chore|fix|ci)\//i.test(normalizedRef)) return '';
  return extractTaskId(title);
}

/** @param {string} body */
export function parseDependencies(body) {
  const normalized = body.replace(/[\u2010-\u2015]/g, '-');
  const depLineMatch = normalized.match(
    /(?:\*\*Depende de:\*\*|\*\*Dependencias[^*]*\*\*)\s*([^\n\r]+)/i
  );
  if (!depLineMatch?.[1]) return [];
  // Truncate if the line was ever collapsed into subsequent markdown sections
  const raw = (depLineMatch[1].split(/\s+---\s+|\s+###?\s+/)[0] ?? '').trim();
  if (/^(ninguna|nada|none|-|—)(\s|$|\.)/i.test(raw)) return [];

  /** @type {Set<string>} */
  const deps = new Set();

  // Expand ranges like T-302…T-311 or T-302..T-311
  for (const rangeMatch of raw.matchAll(/T-(\d{3})\s*(?:…|\.\.+|-)\s*T-(\d{3})/gi)) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start <= 50) {
      for (let n = start; n <= end; n += 1) {
        deps.add(`T-${String(n).padStart(3, '0')}`);
      }
    }
  }

  for (const match of raw.matchAll(/T-\d+/gi)) {
    deps.add(match[0].toUpperCase());
  }
  if (/contracts-v1/i.test(raw)) {
    deps.add('contracts-v1');
  }
  if (/\bFase\s*1\b/i.test(raw)) {
    deps.add('Fase 1');
  }
  if (/\bFase\s*2\b/i.test(raw)) {
    deps.add('Fase 2');
  }
  return [...deps];
}

/** @param {string} taskId */
function loadTaskCardDependencies(taskId) {
  const cardPath = resolve(process.cwd(), 'docs', 'tasks', `${taskId}.md`);
  if (!existsSync(cardPath)) return null;
  try {
    const content = readFileSync(cardPath, 'utf8');
    const parsed = parseDependencies(content);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   issues: IssueSnapshot[],
 *   pullRequests: PullRequestSnapshot[],
 *   mergedTaskIds?: string[],
 *   useLocalTaskCards?: boolean,
 * }} input
 * @returns {BoardTransition[]}
 */
export function computeBoardTransitions({
  issues,
  pullRequests,
  mergedTaskIds = [],
  useLocalTaskCards = false,
}) {
  /** @type {Set<string>} */
  const completedTasks = new Set(mergedTaskIds.map((id) => id.toUpperCase()));

  /** @type {Map<string, PullRequestSnapshot>} */
  const openPrByTask = new Map();
  for (const pr of pullRequests) {
    const taskId = extractPrTaskId(pr.headRefName, pr.title);
    if (taskId) {
      openPrByTask.set(taskId, pr);
      // If an implementation PR is still open, the task is NOT completed yet
      completedTasks.delete(taskId);
    }
  }

  for (const issue of issues) {
    const taskId = extractTaskId(issue.title);
    if (!taskId) continue;
    if (issue.state.toUpperCase() === 'CLOSED' && !openPrByTask.has(taskId)) {
      completedTasks.add(taskId);
    }
  }

  if (PHASE_0_TASKS.every((taskId) => completedTasks.has(taskId))) {
    completedTasks.add('contracts-v1');
  }

  const phase1Issues = issues
    .map((issue) => extractTaskId(issue.title))
    .filter((id) => /^T-1\d{2}$/.test(id));
  if (phase1Issues.length > 0 && phase1Issues.every((id) => completedTasks.has(id))) {
    completedTasks.add('Fase 1');
  }

  /** @type {BoardTransition[]} */
  const transitions = [];

  for (const issue of issues) {
    const taskId = extractTaskId(issue.title);
    if (!taskId) continue;

    let targetState = 'lista';
    const openPr = openPrByTask.get(taskId);
    const isClosed = issue.state.toUpperCase() === 'CLOSED';
    const isCompleted = (isClosed || completedTasks.has(taskId)) && !openPr;

    if (isCompleted) {
      targetState = 'hecha';
    } else if (openPr) {
      targetState = openPr.isDraft ? 'en-curso' : 'en-review';
    } else {
      const cardDeps = useLocalTaskCards ? loadTaskCardDependencies(taskId) : null;
      const deps = cardDeps ?? parseDependencies(issue.body);
      const unblocked = deps.every((dep) => completedTasks.has(dep));
      targetState = unblocked ? 'lista' : 'bloqueada';
    }

    const currentLabels = new Set(issue.labels);
    const addLabels = currentLabels.has(targetState) ? [] : [targetState];
    const removeLabels = STATE_LABELS.filter(
      (label) => label !== targetState && currentLabels.has(label)
    );

    const meta = STATE_METADATA[targetState] ?? { column: 'Bloqueada', optionId: '95978306' };
    transitions.push({
      number: issue.number,
      nodeId: issue.nodeId,
      taskId,
      targetState,
      targetColumn: meta.column,
      optionId: meta.optionId,
      shouldCloseIssue: isCompleted && !isClosed,
      shouldReopenIssue: Boolean(openPr && isClosed),
      addLabels,
      removeLabels,
    });
  }

  return transitions;
}

/**
 * @param {string} repository
 * @param {string} token
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function githubApi(repository, token, path, init = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API devolvió ${response.status} en ${path}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

/**
 * @param {string} token
 * @param {string} query
 * @param {Record<string, unknown>} variables
 */
async function githubGraphql(token, query, variables) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL devolvió ${response.status}`);
  }
  return response.json();
}

/**
 * @param {string} token
 * @param {BoardTransition[]} transitions
 */
async function syncProjectBoard(token, transitions) {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                }
              }
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  optionId
                }
              }
            }
          }
        }
      }
    }
  `;
  const result = await githubGraphql(token, query, { projectId: PROJECT_ID });
  const items = result?.data?.node?.items?.nodes;
  if (!Array.isArray(items)) {
    console.log('Sin acceso de escritura al Project #2 con el token actual; etiquetas al día.');
    return;
  }

  /** @type {Map<number, { itemId: string, optionId: string }>} */
  const itemByIssueNumber = new Map();
  for (const item of items) {
    const issueNumber = item?.content?.number;
    if (typeof issueNumber === 'number' && typeof item?.id === 'string') {
      itemByIssueNumber.set(issueNumber, {
        itemId: item.id,
        optionId: item?.fieldValueByName?.optionId ?? '',
      });
    }
  }

  const addMutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId,
        contentId: $contentId
      }) {
        item { id }
      }
    }
  `;

  const updateMutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId,
        itemId: $itemId,
        fieldId: $fieldId,
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  `;

  for (const transition of transitions) {
    let projectItem = itemByIssueNumber.get(transition.number);
    if (!projectItem && transition.nodeId) {
      const added = await githubGraphql(token, addMutation, {
        projectId: PROJECT_ID,
        contentId: transition.nodeId,
      });
      const newItemId = added?.data?.addProjectV2ItemById?.item?.id;
      if (typeof newItemId === 'string') {
        projectItem = { itemId: newItemId, optionId: '' };
      }
    }
    if (!projectItem || projectItem.optionId === transition.optionId) continue;
    await githubGraphql(token, updateMutation, {
      projectId: PROJECT_ID,
      itemId: projectItem.itemId,
      fieldId: STATUS_FIELD_ID,
      optionId: transition.optionId,
    });
    console.log(
      `Project #2: #${transition.number} [${transition.taskId}] -> ${transition.targetColumn}`
    );
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const projectToken = process.env.PROJECT_TOKEN || token;
  if (!repository || !token) {
    throw new Error('Faltan GITHUB_REPOSITORY o GITHUB_TOKEN.');
  }

  /** @type {IssueSnapshot[]} */
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubApi(
      repository,
      token,
      `/issues?state=all&per_page=100&page=${page}`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const raw of batch) {
      if (raw.pull_request) continue;
      issues.push({
        number: raw.number,
        nodeId: raw.node_id ?? undefined,
        title: raw.title ?? '',
        body: raw.body ?? '',
        state: raw.state ?? 'open',
        labels: Array.isArray(raw.labels)
          ? raw.labels.map((/** @type {{ name?: string }} */ l) => l.name ?? '').filter(Boolean)
          : [],
      });
    }
    if (batch.length < 100) break;
  }

  const openPullsRaw = await githubApi(
    repository,
    token,
    '/pulls?state=open&base=develop&per_page=100'
  );
  /** @type {PullRequestSnapshot[]} */
  const pullRequests = Array.isArray(openPullsRaw)
    ? openPullsRaw.map((pr) => ({
        number: pr.number,
        title: pr.title ?? '',
        headRefName: pr.head?.ref ?? '',
        isDraft: Boolean(pr.draft),
      }))
    : [];

  /** @type {string[]} */
  const mergedTaskIds = [];
  for (let page = 1; page <= 3; page += 1) {
    const closedPullsRaw = await githubApi(
      repository,
      token,
      `/pulls?state=closed&base=develop&per_page=100&page=${page}`
    );
    if (!Array.isArray(closedPullsRaw) || closedPullsRaw.length === 0) break;
    for (const pr of closedPullsRaw) {
      if (!pr.merged_at) continue;
      const taskId = extractPrTaskId(pr.head?.ref ?? '', pr.title ?? '');
      if (taskId) {
        mergedTaskIds.push(taskId);
      }
    }
    if (closedPullsRaw.length < 100) break;
  }

  const transitions = computeBoardTransitions({
    issues,
    pullRequests,
    mergedTaskIds,
    useLocalTaskCards: true,
  });

  for (const transition of transitions) {
    if (transition.shouldReopenIssue) {
      await githubApi(repository, token, `/issues/${transition.number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'open' }),
      });
      console.log(`Issue #${transition.number} [${transition.taskId}]: reabierta por PR activo`);
    }
    if (transition.shouldCloseIssue) {
      await githubApi(repository, token, `/issues/${transition.number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      });
      console.log(`Issue #${transition.number} [${transition.taskId}]: cerrada automáticamente`);
    }
    for (const label of transition.removeLabels) {
      await githubApi(
        repository,
        token,
        `/issues/${transition.number}/labels/${encodeURIComponent(label)}`,
        { method: 'DELETE' }
      );
    }
    if (transition.addLabels.length > 0) {
      await githubApi(repository, token, `/issues/${transition.number}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: transition.addLabels }),
      });
    }
    if (transition.addLabels.length > 0 || transition.removeLabels.length > 0) {
      console.log(
        `Issue #${transition.number} [${transition.taskId}]: estado -> ${transition.targetState}`
      );
    }
  }

  if (projectToken) {
    await syncProjectBoard(projectToken, transitions);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
