import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
  const next = normalized.slice(start + 1).search(/\n  [\w-]+:\n/);
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

test('pnpm typecheck checks workflow modules as JavaScript', () => {
  assert.match(
    projectPackage().scripts.typecheck,
    /tsc --project \.github\/workflows\/tsconfig\.json/
  );
  const config = JSON.parse(readFileSync(new URL('tsconfig.json', import.meta.url), 'utf8'));
  assert.equal(config.compilerOptions.checkJs, true);
  assert.ok(config.include.includes('*.mjs'));
});

test('CI compares generated Supabase types with the committed types', () => {
  const ci = workflow('ci.yml');
  assert.match(ci, /SUPABASE_PROJECT_REF/);
  assert.match(ci, /pnpm db:types/);
  assert.match(ci, /git diff --exit-code -- src\/types\/database\.types\.ts/);
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

test('Lautaro073 pull requests require a complete agy review report', async () => {
  const { evaluateApprovalPolicy } = await import('./approval-policy.mjs');
  const reviews = [{ user: 'KiraK72', state: 'APPROVED', submittedAt: '2026-09-21T12:00:00Z' }];
  assert.equal(evaluateApprovalPolicy({ author: 'Lautaro073', reviews, body: '' }).ok, false);
  assert.equal(
    evaluateApprovalPolicy({
      author: 'Lautaro073',
      reviews,
      body: '### Informe de revisión de agy\n\nInforme revisar-pr — T-003 — 2026-09-21 — generado por KiraK72\nResultado: SIN BLOQUEANTES\nChecks locales: typecheck ✅ · lint ✅ · test ✅ · test:db n.a.\nBLOQUEANTES:\n- ninguno\nMEJORAS:\n- ninguna\nNo revisado / dudas para Lautaro073:\n- ninguna',
    }).ok,
    true
  );
});
