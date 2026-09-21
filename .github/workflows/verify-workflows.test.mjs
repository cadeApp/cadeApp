import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

function workflow(name) {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
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

test('CI compares generated Supabase types with the committed types', () => {
  const ci = workflow('ci.yml');
  assert.match(ci, /SUPABASE_PROJECT_REF/);
  assert.match(ci, /pnpm db:types/);
  assert.match(ci, /git diff --exit-code -- src\/types\/database\.types\.ts/);
});

test('bundle budget reports route sizes and checks the 180 KB limit', () => {
  const ci = workflow('ci.yml');
  assert.match(ci, /bundle-budget:/);
  assert.match(ci, /180/);
  assert.match(ci, /GITHUB_STEP_SUMMARY/);
});

test('migration workflow serializes staging and production pushes', () => {
  const migrate = workflow('migrate.yml');
  assert.match(migrate, /staging/);
  assert.match(migrate, /main/);
  assert.match(migrate, /concurrency:/);
  assert.match(migrate, /cancel-in-progress:\s*false/);
  assert.match(migrate, /environment:\s*(staging|production)/);
  assert.match(migrate, /pnpm supabase db push/);
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

test('approval workflow rechecks edits and submitted reviews', () => {
  const policy = workflow('approval-policy.yml');
  assert.match(policy, /pull_request_review:/);
  assert.match(policy, /pull_request:/);
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

test('Lautaro073 pull requests require a complete agy review report', async () => {
  const { evaluateApprovalPolicy } = await import('./approval-policy.mjs');
  const reviews = [{ user: 'KiraK72', state: 'APPROVED', submittedAt: '2026-09-21T12:00:00Z' }];
  assert.equal(evaluateApprovalPolicy({ author: 'Lautaro073', reviews, body: '' }).ok, false);
  assert.equal(
    evaluateApprovalPolicy({
      author: 'Lautaro073',
      reviews,
      body: '### Informe de revisión de agy\n\nAlcance, pruebas y seguridad revisados. No quedan hallazgos bloqueantes. Evidencia de los checks y riesgos documentada.',
    }).ok,
    true
  );
});
