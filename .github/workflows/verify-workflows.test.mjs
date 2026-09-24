import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/** @param {string} name */
function workflow(name) {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

function projectPackage() {
  return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
}

/** @param {string} yaml @param {string} name */
function job(yaml, name) {
  const normalized = yaml.replace(/\r\n/g, '\n');
  const start = normalized.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `Missing ${name} job`);
  const next = normalized.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? normalized.slice(start) : normalized.slice(start, start + next + 1);
}

test('CI gates pull requests with typecheck, lint, unit tests, build and cached dependencies', () => {
  const ci = workflow('ci.yml');
  for (const required of [
    'pull_request:',
    'typecheck:',
    'lint:',
    'unit:',
    'db-tests:',
    'build:',
    'pnpm typecheck',
    'pnpm lint',
    'pnpm test',
    'pnpm build',
    'cache: pnpm',
  ]) {
    assert.ok(ci.includes(required), `CI must include ${required}`);
  }
});

test('pnpm test includes workflow behavior tests', () => {
  assert.match(
    projectPackage().scripts.test,
    /node --test \.github\/workflows\/verify-workflows\.test\.mjs/
  );
});

test('pnpm lint checks workflow modules despite the hidden directory', () => {
  assert.match(projectPackage().scripts.lint, /eslint --no-ignore --ext \.mjs \.github\/workflows/);
});

test('workflow lint rejects unused code and debugger statements', () => {
  const eslint = fileURLToPath(new URL('../../node_modules/eslint/bin/eslint.js', import.meta.url));
  const probe = fileURLToPath(new URL(`lint-probe-${process.pid}.mjs`, import.meta.url));
  writeFileSync(probe, 'const unused = 1;\ndebugger;\n');
  try {
    const result = spawnSync(
      process.execPath,
      [eslint, '--no-ignore', '--ext', '.mjs', '.github/workflows'],
      { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8' }
    );
    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /no-unused-vars/);
    assert.match(result.stdout, /no-debugger/);
  } finally {
    unlinkSync(probe);
  }
});

test('pnpm typecheck checks workflow modules as JavaScript', () => {
  assert.match(
    projectPackage().scripts.typecheck,
    /tsc --project \.github\/workflows\/tsconfig\.json/
  );
  const config = JSON.parse(readFileSync(new URL('tsconfig.json', import.meta.url), 'utf8'));
  assert.equal(config.compilerOptions.checkJs, true);
  assert.ok(config.include.includes('*.mjs'));
});

test('CI compares generated Supabase types with the committed types against the local database', () => {
  // Contra la base local, no contra staging: es la comparación que responde
  // «¿los tipos commiteados coinciden con las migraciones de este repo?», y la
  // única que tiene sentido en un PR. El porqué está en el test de abajo.
  const dbTests = job(workflow('ci.yml'), 'db-tests');
  assert.match(dbTests, /pnpm db:types --local/);
  assert.match(dbTests, /git diff --exit-code -- src\/types\/database\.types\.ts/);
});

test('bundle budget reports route sizes and checks the 180 KB limit', () => {
  const ci = workflow('ci.yml');
  const budget = workflow('check-bundle-budget.mjs');
  assert.match(ci, /bundle-budget:/);
  assert.match(ci, /180/);
  assert.match(budget, /GITHUB_STEP_SUMMARY/);
});

test('bundle budget fails a route over 180 KB and keeps route names in the report', async () => {
  const { evaluateBundleBudget } = await import('./check-bundle-budget.mjs');
  const buildOutput = [
    'Route (app)                              Size     First Load JS',
    '┌ ○ /                                    154 B          87.2 kB',
    '└ ƒ /courier/requests                    4.2 kB         181 kB',
  ].join('\n');
  const result = evaluateBundleBudget(buildOutput, 180);
  assert.equal(result.ok, false);
  assert.match(result.report, /\/courier\/requests/);
  assert.match(result.report, /181 kB/);
});

test('bundle budget reports an over-budget route without failing the job', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cadeapp-bundle-'));
  try {
    const outputPath = join(directory, 'build-output.txt');
    writeFileSync(outputPath, '└ ○ /courier 4.2 kB 181 kB\n');
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./check-bundle-budget.mjs', import.meta.url)), outputPath],
      {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_STEP_SUMMARY: '' },
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Supera el límite/);
    assert.match(result.stderr, /::warning::/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('bundle budget fails when no route can be read from the build output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cadeapp-bundle-'));
  try {
    const outputPath = join(directory, 'build-output.txt');
    writeFileSync(outputPath, 'Next.js output in an unknown format\n');
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./check-bundle-budget.mjs', import.meta.url)), outputPath],
      { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /No se pudo leer el resultado de Next.js/);
    assert.match(result.stderr, /::error::/);
    assert.doesNotMatch(result.stderr, /Alguna ruta supera/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('migration workflow serializes staging and production pushes', () => {
  const migrate = workflow('migrate.yml');
  assert.match(migrate, /staging/);
  assert.match(migrate, /main/);
  assert.match(migrate, /concurrency:/);
  assert.match(migrate, /cancel-in-progress:\s*false/);
  assert.match(job(migrate, 'staging'), /^\s+environment: staging$/m);
  assert.match(job(migrate, 'production'), /^\s+environment: production$/m);
  assert.match(migrate, /pnpm supabase db push/);
});

test('the remote type comparison runs where staging is the truth, not in a pull request', () => {
  // develop va adelante de staging por diseño: migrate.yml solo corre al
  // pushear a staging o main. Comparar los tipos commiteados contra el esquema
  // remoto durante un PR a develop falla siempre que haya una migración
  // mergeada y todavía no promovida. Pasó en T-003 y volvería a pasar en el
  // primer PR que no toque supabase/migrations.
  const ci = workflow('ci.yml');
  assert.ok(
    !/^ {2}db-types:$/m.test(ci),
    'ci.yml no debe comparar los tipos contra el remoto: develop va adelante de staging'
  );
  assert.doesNotMatch(ci, /SUPABASE_ACCESS_TOKEN/, 'ci.yml no necesita el token de Supabase');

  // Y el drift de staging se verifica justo después de aplicarle las
  // migraciones, que es el único momento en que staging es la verdad.
  const staging = job(workflow('migrate.yml'), 'staging');
  const push = staging.indexOf('pnpm supabase db push');
  const genTypes = staging.indexOf('pnpm db:types');
  assert.notEqual(push, -1, 'el job de staging debe aplicar las migraciones');
  assert.notEqual(genTypes, -1, 'el job de staging debe regenerar los tipos');
  assert.ok(
    push < genTypes,
    'los tipos se regeneran después del db push, no antes: si no, se comparan contra el esquema viejo'
  );
  assert.match(staging, /git diff --exit-code -- src\/types\/database\.types\.ts/);
});

test('production migration fails visibly for an unauthorized actor and uses a distinct project', () => {
  const migrate = workflow('migrate.yml');
  const production = job(migrate, 'production');
  assert.match(production, /if:\s*github\.ref_name == 'main'/);
  assert.doesNotMatch(production, /github\.actor/);
  assert.match(production, /GITHUB_ACTOR/);
  assert.match(production, /SUPABASE_PRODUCTION_PROJECT_REF/);
  assert.match(production, /SUPABASE_STAGING_PROJECT_REF/);
  assert.match(production, /"\$SUPABASE_PROJECT_REF" = "\$SUPABASE_STAGING_PROJECT_REF"/);
});

test('every third-party action is pinned to a full commit SHA', () => {
  const names = readdirSync(new URL('.', import.meta.url)).filter((name) => name.endsWith('.yml'));
  assert.ok(names.length >= 3, 'CI, migration and approval workflows must exist');
  for (const name of names) {
    const yaml = workflow(name);
    for (const match of yaml.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      const action = match[1];
      assert.ok(action, `${name} has a blank action`);
      if (action.startsWith('./')) continue;
      assert.match(action, /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/, `${name}: ${action}`);
    }
  }
});

test('approval workflow evaluates trusted base code after edits and submitted reviews', () => {
  const policy = workflow('approval-policy.yml');
  assert.match(policy, /pull_request_review:/);
  assert.match(policy, /pull_request_target:/);
  assert.match(policy, /edited/);
  assert.match(policy, /approval-policy\.mjs/);
});

test('P2/P3 pull requests require Lautaro073 approval', async () => {
  const { evaluateApprovalPolicy } = await import('./approval-policy.mjs');
  const pending = evaluateApprovalPolicy({ author: 'KiraK72', reviews: [], body: '' });
  assert.equal(pending.ok, false);
  const approved = evaluateApprovalPolicy({
    author: 'KiraK72',
    reviews: [{ user: 'Lautaro073', state: 'APPROVED', submittedAt: '2026-09-21T12:00:00Z' }],
    body: '',
  });
  assert.equal(approved.ok, true);
});

test('comments do not revoke an approval, but a later change request does', async () => {
  const { evaluateApprovalPolicy } = await import('./approval-policy.mjs');
  const approval = { user: 'Lautaro073', state: 'APPROVED', submittedAt: '2026-09-21T12:00:00Z' };
  const comment = { user: 'Lautaro073', state: 'COMMENTED', submittedAt: '2026-09-21T12:05:00Z' };
  const changes = {
    user: 'Lautaro073',
    state: 'CHANGES_REQUESTED',
    submittedAt: '2026-09-21T12:10:00Z',
  };
  assert.equal(
    evaluateApprovalPolicy({ author: 'KiraK72', reviews: [approval, comment], body: '' }).ok,
    true
  );
  assert.equal(
    evaluateApprovalPolicy({ author: 'KiraK72', reviews: [approval, comment, changes], body: '' })
      .ok,
    false
  );
});

const INFORME_COMPLETO =
  '### Informe de revisión de agy\n\nInforme revisar-pr — T-003 — 2026-09-21 — generado por la revisión independiente\nResultado: SIN BLOQUEANTES\nChecks locales: typecheck ✅ · lint ✅ · test ✅ · test:db n.a.\nBLOQUEANTES:\n- ninguno\nMEJORAS:\n- ninguna\nNo revisado / dudas para Lautaro073:\n- ninguna';

test('Lautaro073 pull requests require a complete agy review report', async () => {
  const { evaluateApprovalPolicy } = await import('./approval-policy.mjs');
  const reviews = [{ user: 'KiraK72', state: 'APPROVED', submittedAt: '2026-09-21T12:00:00Z' }];
  assert.equal(evaluateApprovalPolicy({ author: 'Lautaro073', reviews, body: '' }).ok, false);
  assert.equal(
    evaluateApprovalPolicy({ author: 'Lautaro073', reviews, body: INFORME_COMPLETO }).ok,
    true
  );
});

test('Lautaro073 merges his own pull requests: no peer approval is required', async () => {
  // P2 y P3 no programan, asi que no pueden revisar codigo, y GitHub no permite
  // aprobar el propio PR. Exigir una aprobacion de par seria un check que nadie
  // puede satisfacer. Lo que la reemplaza es el informe de revisar-pr en el
  // cuerpo, que este mismo control exige. Ver implementation-plan.md §2.
  const { evaluateApprovalPolicy } = await import('./approval-policy.mjs');
  const sinReviews = evaluateApprovalPolicy({
    author: 'Lautaro073',
    reviews: [],
    body: INFORME_COMPLETO,
  });
  assert.equal(sinReviews.ok, true, sinReviews.reason);
  assert.equal(evaluateApprovalPolicy({ author: 'Lautaro073', reviews: [], body: '' }).ok, false);
});

// T-010: con el repositorio privado, un push de solo docs sobre una corrida en verde
// se saltea los jobs pesados. Es el unico caso: cualquier otra cosa corre todo.

/** Un push que cumple las siete guardas: el unico que se saltea los jobs pesados. */
const PUSH_SEGURO = Object.freeze({
  isPrivate: true,
  eventName: 'pull_request',
  action: 'synchronize',
  isFastForward: true,
  changedFiles: Object.freeze([
    'docs/tasks/log/T-010.md',
    'docs/revision-pr/pr-99/hallazgos.jsonl',
  ]),
  previousRunConclusion: 'success',
  branchContainsBase: true,
});

test('heavy CI jobs are skipped only for a proven docs-only push', async () => {
  const { decideSkipHeavy } = await import('./ci-changes.mjs');
  const decision = decideSkipHeavy(PUSH_SEGURO);
  assert.equal(decision.skipHeavy, true, decision.reason);
});

// Cada guarda, rota sola, tiene que forzar el CI completo. Si alguna de estas pruebas
// sigue en verde con su guarda borrada, esa guarda no protege nada (AG-61, AG-63).
/** @type {Array<[string, Partial<import('./ci-changes.mjs').SkipInput>]>} */
const GUARDAS_ROTAS = [
  ['a public repository', { isPrivate: false }],
  ['a push to a protected branch', { eventName: 'push', action: undefined }],
  ['a newly opened pull request', { action: 'opened' }],
  ['a reopened pull request', { action: 'reopened' }],
  ['a force push', { isFastForward: false }],
  ['an empty diff', { changedFiles: [] }],
  ['a source file next to docs', { changedFiles: ['docs/tasks/log/T-010.md', 'src/app/page.tsx'] }],
  ['TypeScript under docs, which tsc compiles', { changedFiles: ['docs/notes.ts'] }],
  ['JSON under docs', { changedFiles: ['docs/data.json'] }],
  ['the root README', { changedFiles: ['README.md'] }],
  ['a workflow change', { changedFiles: ['.github/workflows/ci.yml'] }],
  ['docs over a failed run, like a71ec25 in T-006', { previousRunConclusion: 'failure' }],
  ['docs over a cancelled run', { previousRunConclusion: 'cancelled' }],
  ['docs with no previous run found', { previousRunConclusion: null }],
  ['a branch behind its base', { branchContainsBase: false }],
];

for (const [caso, cambio] of GUARDAS_ROTAS) {
  test(`heavy CI jobs run on ${caso}`, async () => {
    const { decideSkipHeavy } = await import('./ci-changes.mjs');
    const decision = decideSkipHeavy({ ...PUSH_SEGURO, ...cambio });
    assert.equal(decision.skipHeavy, false, `se salteo con ${caso}`);
    assert.ok(decision.reason.length > 0, 'la decision tiene que decir por que');
  });
}

/** @param {string} cwd */
function gitEn(cwd) {
  /** @param {string[]} args */
  return (...args) => {
    const r = spawnSync(
      'git',
      [
        '-c',
        'user.name=ci',
        '-c',
        'user.email=ci@example.invalid',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd, encoding: 'utf8' }
    );
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
}

test('a move from src to docs is not mistaken for a docs-only change', async () => {
  // Con deteccion de renames, `git diff --name-only` lista solo el destino: mover
  // src/x.ts a docs/x.md pareceria un cambio de solo docs y se saltearia el build
  // que ese movimiento rompe.
  const { listChangedFiles } = await import('./ci-changes.mjs');
  const repo = mkdtempSync(join(tmpdir(), 'ci-changes-'));
  try {
    const git = gitEn(repo);
    git('init', '-q');
    mkdirSync(join(repo, 'src'));
    mkdirSync(join(repo, 'docs'));
    writeFileSync(join(repo, 'src', 'x.ts'), 'export const x = 1;\n'.repeat(20));
    git('add', '-A');
    git('commit', '-q', '-m', 'antes');
    const antes = git('rev-parse', 'HEAD');
    git('mv', 'src/x.ts', 'docs/x.md');
    git('commit', '-q', '-m', 'despues');
    const despues = git('rev-parse', 'HEAD');
    assert.deepEqual(listChangedFiles(antes, despues, repo).sort(), ['docs/x.md', 'src/x.ts']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('ancestry answers false instead of failing on an unknown commit', async () => {
  // Un push forzado puede dejar la cabeza anterior fuera del clon. La respuesta
  // segura es "no es ancestro", que obliga a correr todo.
  const { isAncestor } = await import('./ci-changes.mjs');
  const repo = mkdtempSync(join(tmpdir(), 'ci-changes-'));
  try {
    const git = gitEn(repo);
    git('init', '-q');
    writeFileSync(join(repo, 'a.md'), 'a\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'a');
    const a = git('rev-parse', 'HEAD');
    writeFileSync(join(repo, 'b.md'), 'b\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'b');
    const b = git('rev-parse', 'HEAD');
    assert.equal(isAncestor(a, b, repo), true);
    assert.equal(isAncestor(b, a, repo), false);
    assert.equal(isAncestor('0'.repeat(40), b, repo), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('the previous run counts only if it is CI on the same branch', async () => {
  const { previousRunConclusion } = await import('./ci-changes.mjs');
  /** @param {object[]} runs @param {number} [status] */
  const api = (runs, status = 200) =>
    /** @type {typeof fetch} */ (
      async () => new Response(JSON.stringify({ workflow_runs: runs }), { status })
    );
  /** @param {string} conclusion */
  const ci = (conclusion) => ({
    conclusion,
    head_branch: 'feat/T-999-x',
    path: '.github/workflows/ci.yml',
  });
  const q = { repo: 'o/r', token: 't', headSha: 'abc', headRef: 'feat/T-999-x' };

  assert.equal(await previousRunConclusion({ ...q, fetchImpl: api([ci('success')]) }), 'success');
  assert.equal(await previousRunConclusion({ ...q, fetchImpl: api([ci('failure')]) }), 'failure');
  // El verde de approval-policy no es un CI en verde.
  const otroWorkflow = { ...ci('success'), path: '.github/workflows/approval-policy.yml' };
  assert.equal(await previousRunConclusion({ ...q, fetchImpl: api([otroWorkflow]) }), null);
  // Tampoco el CI en verde de otra rama que comparte la cabeza.
  const otraRama = { ...ci('success'), head_branch: 'feat/T-998-y' };
  assert.equal(await previousRunConclusion({ ...q, fetchImpl: api([otraRama]) }), null);
  // Si la API falla, no hay evidencia de verde.
  assert.equal(await previousRunConclusion({ ...q, fetchImpl: api([], 500) }), null);
});

test('unit always runs: it validates fichas, logs, the plan and the ADRs', () => {
  const unit = job(workflow('ci.yml'), 'unit');
  assert.doesNotMatch(unit, /needs:/, 'unit no puede depender de la decision');
  assert.doesNotMatch(unit, /skip_heavy/);
});

test('each heavy job runs unless the decision proved a skip', () => {
  const ci = workflow('ci.yml');
  for (const nombre of ['typecheck', 'lint', 'build', 'db-tests', 'audit']) {
    const bloque = job(ci, nombre);
    assert.match(bloque, /\n {4}needs: changes\n/, `${nombre} tiene que esperar la decision`);
    // `!cancelled()` hace que un decisor salteado (repositorio publico) o caido signifique
    // correr todo; comparar con != 'true' hace lo mismo con una salida vacia.
    assert.ok(
      bloque.includes("if: ${{ !cancelled() && needs.changes.outputs.skip_heavy != 'true' }}"),
      `${nombre} no tiene la condicion que corre todo ante la duda`
    );
  }
  const budget = job(ci, 'bundle-budget');
  assert.match(budget, /\n {4}needs: build\n/);
  // Sin un if propio, el success() implicito de GitHub mira toda la cadena de needs: con
  // `changes` salteado (repo publico, PR recien abierta) bundle-budget quedaba salteado
  // aunque build pasara. No lo vio ninguna prueba local; lo mostro la primera corrida real
  // de la PR #74 (run 35942161677: build success, bundle-budget skipped).
  assert.ok(
    budget.includes("if: ${{ !cancelled() && needs.build.result == 'success' }}"),
    'bundle-budget tiene que correr siempre que build haya pasado'
  );
});

test('the decision job does not start while the repository is public', () => {
  const changes = job(workflow('ci.yml'), 'changes');
  // Se mira la linea del if y no el bloque entero: el env IS_PRIVATE tambien nombra
  // github.event.repository.private y satisfacia la asercion sin proteger nada. Lo
  // encontro la bateria de mutacion de T-010: el mismo caso que PR64-H01.
  const condicion = changes.match(/\n {4}if: (.*)\n/)?.[1] ?? '';
  assert.match(
    condicion,
    /github\.event\.repository\.private &&/,
    'con el repo publico no arranca'
  );
  assert.match(condicion, /github\.event\.action == 'synchronize'/);
  assert.match(changes, /actions: read/);
  assert.match(changes, /fetch-depth: 0/);
  // Un error del decisor no puede poner el CI en rojo: se corre todo y listo.
  assert.match(changes, /continue-on-error: true/);
});
