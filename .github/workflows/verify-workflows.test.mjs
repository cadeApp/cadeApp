import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
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

test('deploy runs only after a successful migrate push, never before the database', () => {
  // T-315: primero la base, después la app. Si la migración falla, la app nueva no se publica contra un
  // esquema viejo.
  const deploy = workflow('deploy.yml');
  assert.match(deploy, /workflow_run:\r?\n\s+workflows: \[migrate\]\r?\n\s+types: \[completed\]/);
  assert.match(deploy, /branches: \[staging, main\]/);
  for (const name of ['staging', 'production']) {
    const body = job(deploy, name);
    assert.match(
      body,
      /github\.event\.workflow_run\.conclusion == 'success'/,
      `${name}: exige migrate verde`
    );
    assert.match(body, /github\.event\.workflow_run\.event == 'push'/, `${name}: solo pushes`);
    assert.match(
      body,
      /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/,
      `${name}: commit exacto`
    );
  }
  assert.match(deploy, /concurrency:/);
  assert.match(deploy, /cancel-in-progress:\s*false/);
});

test('deploy targets the right environment and pins the Vercel CLI', () => {
  const deploy = workflow('deploy.yml');
  const staging = job(deploy, 'staging');
  const production = job(deploy, 'production');
  assert.match(staging, /head_branch == 'staging'/);
  assert.match(staging, /^\s+environment: staging$/m);
  assert.match(production, /head_branch == 'main'/);
  assert.match(production, /^\s+environment: production$/m);
  for (const match of deploy.matchAll(/pnpm dlx (vercel\S*)/g)) {
    assert.equal(match[1], 'vercel@61.0.0', 'la versión del CLI de Vercel va fijada');
  }
  for (const body of [staging, production]) {
    assert.match(body, /vercel@61\.0\.0 build --prod/);
    assert.match(body, /vercel@61\.0\.0 deploy --prebuilt --prod/);
  }
});

/** @param {string} jobBody @param {string} name */
function step(jobBody, name) {
  const normalized = jobBody.replace(/\r\n/g, '\n');
  const start = normalized.indexOf(`\n      - name: ${name}\n`);
  assert.notEqual(start, -1, `Missing step ${name}`);
  const next = normalized.slice(start + 1).search(/\n {6}- /);
  return next === -1 ? normalized.slice(start) : normalized.slice(start, start + next + 1);
}

/**
 * Comandos shell activos del bloque `run: |` de un step: sin líneas vacías ni comentarios, y con las
 * continuaciones `\` unidas en un solo comando lógico. PR128-H02: las propiedades se afirman sobre lo que
 * se ejecuta, no sobre texto que puede estar comentado o dentro de un `echo`.
 * @param {string} stepBody
 */
function shellCommands(stepBody) {
  const lines = stepBody.replace(/\r\n/g, '\n').split('\n');
  const runIndex = lines.findIndex((line) => /^\s*run: \|\s*$/.test(line));
  assert.notEqual(runIndex, -1, 'el step no tiene un bloque run: |');
  const runIndent = (lines[runIndex] ?? '').search(/\S/);
  /** @type {string[]} */
  const commands = [];
  let pending = '';
  for (const raw of lines.slice(runIndex + 1)) {
    if (raw.trim() !== '' && raw.search(/\S/) <= runIndent) break;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (line.endsWith('\\')) {
      pending += `${line.slice(0, -1).trimEnd()} `;
      continue;
    }
    commands.push(pending + line);
    pending = '';
  }
  if (pending) commands.push(pending.trimEnd());
  return commands;
}

test('each deploy job pulls, builds and deploys in that order, then checks health', () => {
  // PR128-H02: la secuencia se valida sobre los comandos activos del step de Vercel de cada job.
  const deploy = workflow('deploy.yml');
  for (const name of ['staging', 'production']) {
    const body = job(deploy, name);
    const commands = shellCommands(step(body, `Build and deploy to Vercel (${name})`));
    const pull = commands.findIndex((command) =>
      command.startsWith('pnpm dlx vercel@61.0.0 pull --yes --environment=production')
    );
    const build = commands.findIndex((command) =>
      command.startsWith('pnpm dlx vercel@61.0.0 build --prod')
    );
    const deployCommand = commands.findIndex((command) =>
      /^url="\$\(pnpm dlx vercel@61\.0\.0 deploy --prebuilt --prod .*\)"$/.test(command)
    );
    assert.notEqual(pull, -1, `${name}: falta el vercel pull activo`);
    assert.notEqual(build, -1, `${name}: falta el vercel build activo`);
    assert.notEqual(deployCommand, -1, `${name}: falta el vercel deploy activo`);
    assert.ok(pull < build && build < deployCommand, `${name}: el orden es pull → build → deploy`);
    const normalized = body.replace(/\r\n/g, '\n');
    assert.ok(
      normalized.indexOf(`- name: Build and deploy to Vercel (${name})`) <
        normalized.indexOf('- name: Health check'),
      `${name}: el health check va después del deploy`
    );
  }
});

test('production deploy fails visibly for an unauthorized actor', () => {
  // PR128-H01: se autoriza a quien hizo el push que disparó migrate (workflow_run.actor), no a quien
  // relanzó el run (triggering_actor): un re-run de otra persona no puede publicar producción.
  const production = job(workflow('deploy.yml'), 'production');
  assert.doesNotMatch(production, /if:.*github\.actor/);
  const guard = step(production, 'Require authorized release actor');
  assert.match(guard, /RUN_ACTOR: \$\{\{ github\.event\.workflow_run\.actor\.login \}\}/);
  assert.doesNotMatch(production, /workflow_run\.triggering_actor\.login/);
  const branch = guard.match(/if \[ "\$RUN_ACTOR" != 'Lautaro073' \]; then\n([\s\S]*?)\n\s+fi\n/);
  assert.ok(branch, 'la guarda compara "$RUN_ACTOR" contra Lautaro073');
  const [, unauthorized = ''] = branch;
  assert.match(unauthorized, /^\s+exit 1$/m, 'el actor no autorizado corta con exit 1');
  assert.doesNotMatch(unauthorized, /exit 0/, 'el actor no autorizado no puede salir con exit 0');
});

test('each deploy fails the job unless /api/health answers 200', () => {
  const deploy = workflow('deploy.yml');
  for (const name of ['staging', 'production']) {
    const body = job(deploy, name);
    assert.doesNotMatch(body, /continue-on-error/, `${name}: el job no puede ignorar fallos`);
    const commands = shellCommands(step(body, 'Health check'));
    assert.equal(commands.length, 1, `${name}: el health check es un único comando`);
    const [health = ''] = commands;
    assert.ok(health.startsWith('curl --fail '), `${name}: el comando empieza con curl --fail`);
    for (const flag of ['--retry 6', '--retry-delay 10', '--retry-all-errors']) {
      assert.ok(health.includes(` ${flag} `), `${name}: conserva ${flag}`);
    }
    assert.ok(
      health.endsWith(' "$APP_URL/api/health"'),
      `${name}: el comando termina en "$APP_URL/api/health"`
    );
  }
});

test('vercel.json only schedules daily crons and no longer runs the uptime check', () => {
  // T-316: el plan Hobby de Vercel rechaza el deploy si un cron corre más de una vez por día
  // (run deploy 36543241685). El chequeo de uptime pasó a GitHub Actions.
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  /** @type {{ path: string, schedule: string }[]} */
  const crons = vercel.crons ?? [];
  for (const cron of crons) {
    // PR132-H01: minuto 0–59 y hora 0–23 como enteros; el resto exactamente `*`. `99 99 * * *` no pasa.
    const fields = cron.schedule.split(' ');
    assert.equal(fields.length, 5, `${cron.path}: el cron tiene 5 campos`);
    const [minute = '', hour = '', dayOfMonth, month, dayOfWeek] = fields;
    assert.match(minute, /^\d+$/, `${cron.path}: minuto fijo`);
    assert.match(hour, /^\d+$/, `${cron.path}: hora fija`);
    assert.ok(Number(minute) >= 0 && Number(minute) <= 59, `${cron.path}: minuto entre 0 y 59`);
    assert.ok(Number(hour) >= 0 && Number(hour) <= 23, `${cron.path}: hora entre 0 y 23`);
    assert.deepEqual(
      [dayOfMonth, month, dayOfWeek],
      ['*', '*', '*'],
      `${cron.path}: corre todos los días`
    );
  }
  assert.ok(
    crons.every((cron) => cron.path !== '/api/cron/health'),
    '/api/cron/health ya no se programa en Vercel'
  );
});

test('the uptime check runs every 10 minutes from Actions with CRON_SECRET', () => {
  const healthCron = workflow('health-cron.yml');
  assert.match(healthCron, /schedule:\r?\n\s+- cron: '\*\/10 \* \* \* \*'/);
  assert.match(healthCron, /workflow_dispatch:/);
  // PR132-H01: un grupo fijo y sin cancelar, así dos chequeos no se pisan ni se cortan.
  assert.match(
    healthCron,
    /^concurrency:\r?\n {2}group: health-cron\r?\n {2}cancel-in-progress: false\r?$/m
  );

  const jobs = [
    {
      name: 'staging',
      environment: 'staging',
      appUrl: 'https://cadeapp-staging.vercel.app',
      condition: null,
    },
    {
      name: 'production',
      environment: 'production',
      appUrl: '${{ vars.PRODUCTION_APP_URL }}',
      condition: "vars.PRODUCTION_APP_URL != ''",
    },
  ];
  for (const { name, environment, appUrl, condition } of jobs) {
    const body = job(healthCron, name).replace(/\r\n/g, '\n');
    assert.ok(
      body.includes(`\n    environment: ${environment}\n`),
      `${name}: environment ${environment}`
    );
    assert.ok(body.includes(`\n      APP_URL: ${appUrl}\n`), `${name}: APP_URL ${appUrl}`);
    if (condition) assert.ok(body.includes(`\n    if: ${condition}\n`), `${name}: if ${condition}`);

    const call = step(body, 'Call /api/cron/health');
    assert.ok(
      call.includes('\n          CRON_SECRET: ${{ secrets.CRON_SECRET }}\n'),
      `${name}: CRON_SECRET sale de secrets`
    );
    const commands = shellCommands(call);
    const guardStart = commands.indexOf('if [ -z "$CRON_SECRET" ]; then');
    assert.notEqual(guardStart, -1, `${name}: falta la guarda de CRON_SECRET`);
    const guardEnd = commands.indexOf('fi', guardStart);
    assert.notEqual(guardEnd, -1, `${name}: la guarda de CRON_SECRET cierra con fi`);
    const missingSecret = commands.slice(guardStart + 1, guardEnd);
    assert.ok(missingSecret.includes('exit 1'), `${name}: sin CRON_SECRET corta con exit 1`);
    assert.ok(!missingSecret.includes('exit 0'), `${name}: sin CRON_SECRET no sale con exit 0`);

    const curls = commands.filter((command) => /\bcurl\b/.test(command));
    assert.equal(curls.length, 1, `${name}: un solo llamado a curl`);
    const [curl = ''] = curls;
    assert.ok(commands.indexOf(curl) > guardEnd, `${name}: el curl va después de la guarda`);
    assert.ok(curl.startsWith('curl --fail '), `${name}: el llamado empieza con curl --fail`);
    assert.ok(
      curl.includes(' -H "Authorization: Bearer $CRON_SECRET" '),
      `${name}: el llamado manda el Bearer con CRON_SECRET`
    );
    assert.ok(
      curl.endsWith(' "$APP_URL/api/cron/health"'),
      `${name}: el llamado termina en "$APP_URL/api/cron/health"`
    );
  }
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

test('board-sync automatically unblocks dependent issues and marks merged PR tasks as hecha', async () => {
  const { computeBoardTransitions } = await import('./board-sync.mjs');
  const phase0 = Array.from({ length: 10 }, (_, idx) => ({
    number: idx + 1,
    title: idx === 0 ? 'T-000: Scaffold mínimo' : `[T-00${idx}] Tarea base ${idx}`,
    body: '**Depende de:** ninguna.',
    state: 'CLOSED',
    labels: ['bloqueada'],
  }));
  const issues = [
    ...phase0,
    {
      number: 13,
      title: '[T-103] Ciclo de solicitud',
      body: '**Depende de:** T-102.',
      state: 'OPEN',
      labels: ['en-review'],
    },
    {
      number: 30,
      title: '[T-203] Emisor de push',
      body: '**Depende de:** T-103.',
      state: 'OPEN',
      labels: ['bloqueada'],
    },
  ];
  const transitions = computeBoardTransitions({
    issues,
    pullRequests: [],
    mergedTaskIds: ['T-103'],
  });
  const t103 = transitions.find((item) => item.taskId === 'T-103');
  const t203 = transitions.find((item) => item.taskId === 'T-203');

  assert.equal(t103?.targetState, 'hecha');
  assert.equal(t103?.shouldCloseIssue, true);
  assert.deepEqual(t103?.addLabels, ['hecha']);
  assert.deepEqual(t103?.removeLabels, ['en-review']);

  assert.equal(t203?.targetState, 'lista');
  assert.deepEqual(t203?.addLabels, ['lista']);
  assert.deepEqual(t203?.removeLabels, ['bloqueada']);
});

test('board-sync ignores docs/* PR branches and normalizes Unicode hyphens in issue titles', async () => {
  const { computeBoardTransitions, extractPrTaskId } = await import('./board-sync.mjs');
  assert.equal(
    extractPrTaskId('docs/T-118-integracion-visual-navegacion', 'Crear ficha T-118'),
    ''
  );
  assert.equal(
    extractPrTaskId('feat/T-118-integracion-visual-stitch', '[T-118] Integración'),
    'T-118'
  );

  const issues = [
    {
      number: 85,
      title: '[T\u2011118] Integración visual Stitch, shells y navegación canónica',
      body: '- **Depende de:** T-008',
      state: 'OPEN',
      labels: ['lista'],
    },
    {
      number: 28,
      title: '[T-201] Manifest, íconos maskable, service worker',
      body: '- **Depende de:** T-000, T-008, T-118',
      state: 'OPEN',
      labels: ['lista'],
    },
  ];
  const pullRequests = [
    {
      number: 87,
      title: '[T-118] Integración visual Stitch',
      headRefName: 'feat/T-118-integracion-visual-stitch',
      isDraft: false,
    },
  ];
  const transitions = computeBoardTransitions({
    issues,
    pullRequests,
    mergedTaskIds: ['T-000', 'T-008'],
  });
  const t118 = transitions.find((item) => item.taskId === 'T-118');
  const t201 = transitions.find((item) => item.taskId === 'T-201');

  assert.equal(t118?.targetState, 'en-review');
  assert.equal(t118?.targetColumn, 'En review');
  assert.equal(t201?.targetState, 'bloqueada');
  assert.equal(t201?.targetColumn, 'Bloqueada');
});

test('board-sync preserves Lautaro073 task assignments and assigns unassigned tasks to KiraK72', async () => {
  const { computeBoardTransitions } = await import('./board-sync.mjs');
  const issues = [
    {
      number: 1,
      title: '[T-301] Arnés E2E',
      body: '- **Depende de:** Fase 1',
      state: 'OPEN',
      labels: [],
      assignees: ['Lautaro073'],
    },
    {
      number: 2,
      title: '[T-312] Checklist',
      body: '- **Depende de:** Fase 1',
      state: 'OPEN',
      labels: [],
      assignees: ['Lautaro073', 'asako669'],
    },
    {
      number: 3,
      title: '[T-302] Nueva tarea sin asignar',
      body: '- **Depende de:** Fase 1',
      state: 'OPEN',
      labels: [],
      assignees: [],
    },
    {
      number: 4,
      title: '[T-303] Tarea de Asako',
      body: '- **Depende de:** Fase 1',
      state: 'OPEN',
      labels: [],
      assignees: ['asako669'],
    },
  ];
  const transitions = computeBoardTransitions({
    issues,
    pullRequests: [],
  });

  const t301 = transitions.find((t) => t.taskId === 'T-301');
  const t312 = transitions.find((t) => t.taskId === 'T-312');
  const t302 = transitions.find((t) => t.taskId === 'T-302');
  const t303 = transitions.find((t) => t.taskId === 'T-303');

  assert.equal(t301?.targetAssignees, undefined);
  assert.equal(t312?.targetAssignees, undefined);
  assert.deepEqual(t302?.targetAssignees, ['KiraK72']);
  assert.equal(t303?.targetAssignees, undefined);
});

test('staging E2E gate runs core specs and includes request-states when the target SHA contains it', () => {
  const e2eJob = job(workflow('e2e-staging.yml'), 'e2e');

  assert.match(e2eJob, /specs=\(e2e\/specs\/smoke\.spec\.ts e2e\/specs\/main-flow\.spec\.ts\)/);
  assert.match(
    e2eJob,
    /if \[ -f e2e\/specs\/request-states\.spec\.ts \]; then[\s\S]*specs\+=\(e2e\/specs\/request-states\.spec\.ts\)/,
    'staging must include T-304 request-states when that spec exists in the exact target SHA'
  );
  assert.match(e2eJob, /pnpm exec playwright test "\$\{specs\[@\]\}" --project=chromium --workers=1/);
  assert.match(
    e2eJob,
    /--workers=1/,
    'staging E2E must run serially because specs share the remote staging database'
  );
  assert.doesNotMatch(e2eJob, /continue-on-error/, 'E2E failures must fail the staging gate');
});

test('deploy-staging calls reusable E2E with the exact migrated SHA after deploy succeeds', () => {
  const deploy = workflow('deploy.yml');
  const e2e = workflow('e2e-staging.yml');
  const e2eJob = job(deploy, 'e2e-staging');

  assert.match(
    e2e,
    /workflow_call:/,
    'e2e-staging must be reusable instead of chaining workflow_run'
  );
  assert.doesNotMatch(
    e2e,
    /workflow_run:/,
    'a second workflow_run loses the original staging branch/SHA'
  );
  assert.match(
    e2e,
    /ref:\s*\$\{\{\s*inputs\.target_sha\s*\}\}/,
    'E2E checks out the propagated staging SHA'
  );

  assert.match(e2eJob, /needs:\s*staging/, 'E2E must wait for deploy-staging');
  assert.match(
    e2eJob,
    /uses:\s*\.\/\.github\/workflows\/e2e-staging\.yml/,
    'deploy calls reusable E2E'
  );
  assert.match(
    e2eJob,
    /target_sha:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/,
    'deploy propagates the exact SHA that migrate ran on'
  );
  assert.match(e2eJob, /head_branch == 'staging'/, 'E2E call is staging-only');
});

test('CI build supplies required public env and propagates next build failures through tee', () => {
  const ci = workflow('ci.yml');
  const build = job(ci, 'build');

  assert.match(build, /NEXT_PUBLIC_APP_URL:\s*http:\/\/localhost:3000/);
  assert.match(build, /NEXT_PUBLIC_SUPABASE_URL:\s*http:\/\/127\.0\.0\.1:54321/);
  assert.match(build, /NEXT_PUBLIC_SUPABASE_ANON_KEY:\s*ci-public-anon-placeholder/);

  const buildStep = step(build, 'Build and capture route sizes');
  assert.match(buildStep, /set -o pipefail/);
  assert.match(buildStep, /pnpm build 2>&1 \| tee build-output\.txt/);
});

const PREVIEW_REPOSITORY = 'cadeApp/cadeApp';
const PREVIEW_SHA = 'a'.repeat(40);
const PREVIEW_PROJECT = 'project-under-test';
const PREVIEW_TARGET = {
  sha: PREVIEW_SHA,
  url: 'https://cadeapp-develop-abc123-team.vercel.app',
  deploymentId: 'dpl_example123',
  pullNumber: 321,
};

/** @param {Record<string, unknown>} [overrides] */
function previewPayload(overrides = {}) {
  return {
    environment: 'preview',
    git: { ref: 'fix/T-999-example', sha: PREVIEW_SHA, shortSha: PREVIEW_SHA.slice(0, 7) },
    id: PREVIEW_TARGET.deploymentId,
    project: { id: PREVIEW_PROJECT, name: 'cadeapp-develop' },
    state: { type: 'success' },
    url: PREVIEW_TARGET.url,
    ...overrides,
  };
}

/** @param {{ number?: number, state?: string, baseRef?: string, headSha?: string, headRepo?: string | null }} [overrides] */
function previewPull({
  number = PREVIEW_TARGET.pullNumber,
  state = 'open',
  baseRef = 'develop',
  headSha = PREVIEW_SHA,
  headRepo = PREVIEW_REPOSITORY,
} = {}) {
  return {
    number,
    state,
    base: { ref: baseRef, repo: { full_name: PREVIEW_REPOSITORY } },
    head: { sha: headSha, repo: headRepo === null ? null : { full_name: headRepo } },
  };
}

/** @param {{ payload?: unknown, expectedProjectId?: string, pulls?: import('./e2e-preview-target.mjs').ApiPull[] }} [overrides] */
async function matchPreviewWith({
  payload = previewPayload(),
  expectedProjectId = PREVIEW_PROJECT,
  pulls = [previewPull()],
} = {}) {
  const { matchPreview } = await import('./e2e-preview-target.mjs');
  return matchPreview({ payload, expectedProjectId, repository: PREVIEW_REPOSITORY, pulls });
}

test('preview gate matches the internal PR whose head is the exact deployed SHA', async () => {
  const result = await matchPreviewWith();
  assert.equal(result.outcome, 'match');
  assert.deepEqual(result.outcome === 'match' && result.target, PREVIEW_TARGET);

  // Un commit viejo de la rama, una PR cerrada o una PR contra otra base no habilitan nada.
  for (const pull of [
    previewPull({ headSha: 'b'.repeat(40) }),
    previewPull({ state: 'closed' }),
    previewPull({ baseRef: 'staging' }),
  ]) {
    const other = await matchPreviewWith({ pulls: [pull] });
    assert.equal(other.outcome, 'skip', JSON.stringify(pull));
  }
});

test('preview gate never hands develop secrets to a fork pull request', async () => {
  for (const headRepo of ['someone/cadeApp', null]) {
    const result = await matchPreviewWith({ pulls: [previewPull({ headRepo })] });
    assert.equal(result.outcome, 'skip', `head repo ${headRepo}`);
    assert.ok(!('target' in result), 'un fork no produce target');
  }
});

test('preview gate ignores other Vercel projects and fails closed without the configured id', async () => {
  const staging = await matchPreviewWith({
    payload: previewPayload({ project: { id: 'another-project', name: 'cadeapp-staging' } }),
  });
  assert.equal(staging.outcome, 'skip');
  const missingProject = await matchPreviewWith({
    payload: previewPayload({ project: undefined }),
  });
  assert.equal(missingProject.outcome, 'skip');
  // Sin el id configurado, un payload sin proyecto no puede "coincidir" con vacío.
  const unconfigured = await matchPreviewWith({
    payload: previewPayload({ project: { id: '' } }),
    expectedProjectId: '',
  });
  assert.equal(unconfigured.outcome, 'reject');
});

test('preview gate rejects ambiguous pull requests and untrusted payload shapes', async () => {
  const ambiguous = await matchPreviewWith({
    pulls: [previewPull(), previewPull({ number: 322 })],
  });
  assert.equal(ambiguous.outcome, 'reject');

  for (const url of [
    'https://cadeapp-staging.vercel.app/path',
    'http://cadeapp-develop-abc.vercel.app',
    'https://evil.example.com',
    'https://cadeapp-develop-abc.vercel.app.evil.example.com',
    'https://user@cadeapp-develop-abc.vercel.app',
    'https://cadeapp-develop-abc.vercel.app\nrun=true',
  ]) {
    const result = await matchPreviewWith({ payload: previewPayload({ url }) });
    assert.equal(result.outcome, 'reject', url);
  }
  for (const git of [{ sha: 'abc1234' }, { sha: `${PREVIEW_SHA}\nrun=true` }, undefined]) {
    const result = await matchPreviewWith({ payload: previewPayload({ git }) });
    assert.equal(result.outcome, 'reject', JSON.stringify(git));
  }
  const badId = await matchPreviewWith({ payload: previewPayload({ id: 'dpl_1\nrun=true' }) });
  assert.equal(badId.outcome, 'reject');
});

test('preview gate blocks pull requests with migrations instead of reporting green', async () => {
  const { gatePreview, BLOCKED_BY_MIGRATION } = await import('./e2e-preview-target.mjs');
  const clean = gatePreview({
    target: PREVIEW_TARGET,
    changedFiles: ['src/features/offers/queries.ts', 'docs/supabase/migrations/notes.md'],
    statuses: [],
    runAttempt: 1,
  });
  assert.equal(clean.outcome, 'run');
  const withMigration = gatePreview({
    target: PREVIEW_TARGET,
    changedFiles: ['src/app/page.tsx', 'supabase/migrations/20261002120000_example.sql'],
    statuses: [],
    runAttempt: 1,
  });
  assert.equal(withMigration.outcome, 'blocked');
  assert.equal(withMigration.reason, BLOCKED_BY_MIGRATION);
  assert.equal(BLOCKED_BY_MIGRATION, 'BLOCKED / REQUIRES DEVELOP MIGRATION');

  // El script publica el bloqueo como estado no verde y sin habilitar el job de E2E.
  const script = workflow('e2e-preview-target.mjs');
  assert.match(script, /state: blocked \? 'error' : 'pending'/);
  assert.match(script, /`run=\$\{blocked \? 'false' : 'true'\}`/);
  assert.doesNotMatch(script, /state: '?success/);
});

test('preview gate runs once per deployment but honours a manual re-run', async () => {
  const { gatePreview, STATUS_CONTEXT, deploymentMarker } =
    await import('./e2e-preview-target.mjs');
  const handled = [
    {
      context: STATUS_CONTEXT,
      description: `en cola ${deploymentMarker(PREVIEW_TARGET.deploymentId)}`,
    },
  ];
  const input = { target: PREVIEW_TARGET, changedFiles: [], statuses: handled };
  assert.equal(gatePreview({ ...input, runAttempt: 1 }).outcome, 'duplicate');
  assert.equal(gatePreview({ ...input, runAttempt: 2 }).outcome, 'run');
  // Un deployment nuevo del mismo SHA, o el status de otro check, no cuenta como ya corrido.
  const others = [
    { context: STATUS_CONTEXT, description: `en cola ${deploymentMarker('dpl_other')}` },
    { context: 'Vercel', description: deploymentMarker(PREVIEW_TARGET.deploymentId) },
  ];
  assert.equal(gatePreview({ ...input, statuses: others, runAttempt: 1 }).outcome, 'run');
});

test('preview workflow only reacts to the Vercel deployment event and never deploys', () => {
  const preview = workflow('e2e-preview.yml').replace(/\r\n/g, '\n');
  const trigger = preview.slice(preview.indexOf('\non:\n'), preview.indexOf('\npermissions:'));
  assert.equal(
    trigger.trim(),
    [
      'on:',
      '  repository_dispatch:',
      '    types:',
      '      - vercel.deployment.success',
      '      - vercel.deployment.ready',
    ].join('\n'),
    'un único disparador: el aviso de Vercel. Sin pull_request_target ni workflow_dispatch con URL libre'
  );
  assert.match(preview, /^permissions: \{\}$/m, 'cada job declara lo mínimo');
  assert.doesNotMatch(preview, /continue-on-error/);
  assert.doesNotMatch(preview, /\bsleep\b/);
  // Vercel despliega por Git Integration: acá no hay CLI, ni token, ni build.
  assert.doesNotMatch(
    preview,
    /pnpm dlx vercel|vercel@|vercel (deploy|build|pull)|--prebuilt|--prod/
  );
  assert.doesNotMatch(preview, /VERCEL_TOKEN|VERCEL_ORG_ID/);
  // Una feature PR no muta Supabase Develop.
  assert.doesNotMatch(preview, /supabase (db push|link|migration)/);
  assert.doesNotMatch(preview, /SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD/);
});

test('preview target is resolved by trusted code with the project id from the develop environment', () => {
  const preview = workflow('e2e-preview.yml').replace(/\r\n/g, '\n');
  const resolveJob = job(preview, 'resolve');
  assert.match(resolveJob, /^ {4}environment: develop$/m);
  const checkout = step(resolveJob, 'Checkout trusted default branch');
  assert.doesNotMatch(checkout, /\bref:/, 'el resolvedor corre el código de la rama por defecto');
  const target = step(resolveJob, 'Resolve trusted preview target');
  assert.match(target, /run: node \.github\/workflows\/e2e-preview-target\.mjs\n/);
  assert.ok(
    target.includes('\n          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}\n'),
    'el Project ID sale del secreto existente del Environment develop'
  );
  assert.equal(
    [...resolveJob.matchAll(/\$\{\{ secrets\.(\w+) \}\}/g)].map((match) => match[1]).join(),
    'VERCEL_PROJECT_ID',
    'el resolvedor no recibe ningún otro secreto'
  );

  // Nada del payload se interpola en shell ni llega directo al job con secretos: solo nombra un grupo.
  const payloadUses = preview
    .split('\n')
    .filter((line) => line.includes('client_payload') && !line.trimStart().startsWith('#'));
  assert.deepEqual(payloadUses, [
    '      group: e2e-preview-resolve-${{ github.event.client_payload.git.sha }}',
  ]);

  // Ni el id ni una URL quedan escritos en el repo.
  for (const name of readdirSync(new URL('.', import.meta.url))) {
    if (name === 'verify-workflows.test.mjs') continue;
    assert.doesNotMatch(workflow(name), /prj_[A-Za-z0-9]{6,}/, `${name}: Project ID hardcodeado`);
  }
  assert.doesNotMatch(
    preview,
    /https:\/\/[\w.-]+\.vercel\.app/,
    'sin URL fija de develop ni de staging'
  );
});

test('preview E2E runs core specs and conditionally request-states against the resolved SHA and URL', () => {
  const preview = workflow('e2e-preview.yml').replace(/\r\n/g, '\n');
  const e2eJob = job(preview, 'e2e');
  assert.match(e2eJob, /^ {4}needs: resolve$/m);
  assert.match(
    e2eJob,
    /^ {4}if: needs\.resolve\.outputs\.run == 'true'$/m,
    'sin PR interna resuelta, el job con secretos no arranca'
  );
  assert.match(e2eJob, /^ {4}environment: develop$/m);
  assert.doesNotMatch(e2eJob, /environment: (staging|production)/);
  assert.match(e2eJob, /^ {10}ref: \$\{\{ needs\.resolve\.outputs\.sha \}\}$/m);
  assert.match(e2eJob, /^ {6}PREVIEW_URL: \$\{\{ needs\.resolve\.outputs\.url \}\}$/m);
  assert.match(
    e2eJob,
    /^ {4}permissions:\n {6}contents: read\n {4}# /m,
    'el job que ejecuta código de la PR no puede escribir statuses'
  );
  assert.match(
    e2eJob,
    /^ {4}concurrency:\n {6}group: cadeapp-develop-e2e\n {6}cancel-in-progress: false$/m,
    'un grupo fijo, igual para todas las PR, y en cola'
  );

  const run = step(e2eJob, 'Run preview E2E gate');
  assert.match(run, /specs=\(e2e\/specs\/smoke\.spec\.ts e2e\/specs\/main-flow\.spec\.ts\)/);
  assert.match(
    run,
    /if \[ -f e2e\/specs\/request-states\.spec\.ts \]; then[\s\S]*specs\+=\(e2e\/specs\/request-states\.spec\.ts\)/,
    'T-304 request-states must run when the exact Preview SHA contains the spec'
  );
  assert.match(run, /pnpm exec playwright test "\$\{specs\[@\]\}" --project=chromium --workers=1/);
  assert.ok(
    run.includes('\n          PLAYWRIGHT_TEST_BASE_URL: ${{ needs.resolve.outputs.url }}\n'),
    'Playwright apunta al Preview resuelto'
  );
  assert.match(
    workflow('../../playwright.config.ts'),
    /baseURL: process\.env\.PLAYWRIGHT_TEST_BASE_URL \|\|/,
    'esa es la variable que lee playwright.config.ts'
  );

  // Los secretos privilegiados solo existen en el step de Playwright, no en install ni en el resto del job.
  const outsideRun = e2eJob.replace(run, '');
  assert.doesNotMatch(outsideRun, /SUPABASE_SERVICE_ROLE_KEY|DNI_HMAC_SECRET|CRON_SECRET/);
  assert.doesNotMatch(preview, /NEXT_PUBLIC_\w*(SERVICE|SECRET)/);

  // El health check exige 200: el 302 de Vercel Authentication no pasa por sano.
  const health = shellCommands(step(e2eJob, 'Health check'));
  assert.ok(health[0]?.includes('"$PREVIEW_URL/api/health"'));
  assert.equal(health[1], `if [ "$code" != '200' ]; then`);
  assert.ok(health.slice(2, health.indexOf('fi')).includes('exit 1'));
});

test('preview E2E refuses to seed unless the develop environment points to Supabase Develop', () => {
  const e2eJob = job(workflow('e2e-preview.yml'), 'e2e').replace(/\r\n/g, '\n');
  const verify = step(e2eJob, 'Verify Supabase Develop target');
  assert.ok(
    e2eJob.indexOf('- name: Verify Supabase Develop target') <
      e2eJob.indexOf('- name: Run preview E2E gate')
  );
  for (const line of [
    'NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}',
    'SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_DEVELOP_PROJECT_REF }}',
    'SUPABASE_STAGING_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}',
  ]) {
    assert.ok(verify.includes(`\n          ${line}\n`), line);
  }
  const commands = shellCommands(verify);
  for (const guard of [
    'if [ -z "$SUPABASE_PROJECT_REF" ] || [ -z "$SUPABASE_STAGING_PROJECT_REF" ]; then',
    'if [ "$SUPABASE_PROJECT_REF" = "$SUPABASE_STAGING_PROJECT_REF" ]; then',
    'if [ "$NEXT_PUBLIC_SUPABASE_URL" != "https://$SUPABASE_PROJECT_REF.supabase.co" ]; then',
  ]) {
    const start = commands.indexOf(guard);
    assert.notEqual(start, -1, guard);
    assert.equal(commands[start + 2], 'exit 1', `${guard}: corta con exit 1`);
  }
  // El seed identifica el proyecto con el ref de develop, no con el de staging.
  const run = step(e2eJob, 'Run preview E2E gate');
  assert.ok(
    run.includes('\n          SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_DEVELOP_PROJECT_REF }}\n')
  );
});

test('preview result is published on the tested SHA and only a passing E2E is green', () => {
  const report = job(workflow('e2e-preview.yml'), 'report').replace(/\r\n/g, '\n');
  assert.match(report, /^ {4}needs: \[resolve, e2e\]$/m);
  assert.match(report, /^ {4}if: always\(\) && needs\.resolve\.outputs\.run == 'true'$/m);
  assert.doesNotMatch(report, /environment:/, 'publicar el estado no necesita secretos de develop');
  const publish = step(report, 'Publish e2e-preview commit status');
  assert.ok(publish.includes('\n          RESULT: ${{ needs.e2e.result }}\n'));
  assert.ok(publish.includes('\n          TARGET_SHA: ${{ needs.resolve.outputs.sha }}\n'));
  const commands = shellCommands(publish);
  const greens = commands.filter((command) => command.includes('state=success'));
  assert.equal(greens.length, 1);
  assert.ok(greens[0]?.startsWith('success) '), 'solo un E2E que pasó publica success');
  assert.ok(commands.some((command) => command.startsWith('failure) state=failure;')));
  assert.ok(commands.some((command) => command.startsWith('*) state=error;')));
  assert.ok(
    commands.some((command) =>
      command.includes('"repos/$GITHUB_REPOSITORY/statuses/$TARGET_SHA" -f context=e2e-preview ')
    )
  );
});

test('develop migrations run only after a push to develop, against its own project', () => {
  const migrate = workflow('migrate.yml').replace(/\r\n/g, '\n');
  const trigger = migrate.slice(migrate.indexOf('\non:\n'), migrate.indexOf('\npermissions:'));
  assert.equal(
    trigger.trim(),
    'on:\n  push:\n    branches: [develop, staging, main]',
    'migrate solo corre por push a ramas protegidas: nunca por pull_request'
  );
  assert.match(
    migrate,
    /group: migrate-\$\{\{ github\.ref_name == 'main' && 'production' \|\| github\.ref_name \}\}/,
    'develop, staging y production no comparten cola'
  );

  const develop = job(migrate, 'develop');
  assert.match(develop, /^ {4}if: github\.ref_name == 'develop'$/m);
  assert.match(develop, /^ {4}environment: develop$/m);
  const apply = step(develop, 'Apply migrations to develop');
  assert.ok(
    apply.includes('\n          SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_DEVELOP_PROJECT_REF }}\n')
  );
  const commands = shellCommands(apply);
  const push = commands.indexOf('pnpm supabase db push --yes');
  assert.notEqual(push, -1);
  for (const guard of [
    'if [ -z "$SUPABASE_STAGING_PROJECT_REF" ] || [ "$SUPABASE_PROJECT_REF" = "$SUPABASE_STAGING_PROJECT_REF" ]; then',
    'if [ "$NEXT_PUBLIC_SUPABASE_URL" != "https://$SUPABASE_PROJECT_REF.supabase.co" ]; then',
  ]) {
    const start = commands.indexOf(guard);
    assert.notEqual(start, -1, guard);
    assert.equal(commands[start + 2], 'exit 1');
    assert.ok(start < push, 'la guarda va antes del db push');
  }
  const drift = shellCommands(step(develop, 'Detect committed types drift against develop'));
  assert.deepEqual(drift, ['pnpm db:types', 'git diff --exit-code -- src/types/database.types.ts']);
  assert.ok(
    develop.indexOf('- name: Apply migrations to develop') <
      develop.indexOf('- name: Detect committed types drift against develop')
  );

  // staging y production siguen con su ambiente y su ref.
  const staging = job(migrate, 'staging');
  assert.match(staging, /^ {4}if: github\.ref_name == 'staging'$/m);
  assert.match(staging, /^ {4}environment: staging$/m);
  assert.doesNotMatch(staging, /SUPABASE_DEVELOP_PROJECT_REF/);
  assert.doesNotMatch(job(migrate, 'production'), /SUPABASE_DEVELOP_PROJECT_REF/);

  // Ningún workflow que corre en una PR aplica esquema a una base remota.
  for (const name of ['ci.yml', 'e2e-preview.yml', 'approval-policy.yml']) {
    assert.doesNotMatch(workflow(name), /supabase (db push|link)/, name);
  }
});

test('develop is not deployed from Actions and staging keeps its own gate', () => {
  const deploy = workflow('deploy.yml').replace(/\r\n/g, '\n');
  assert.match(deploy, /^ {4}branches: \[staging, main\]$/m, 'un migrate de develop no despliega');
  assert.doesNotMatch(deploy, /head_branch == 'develop'|environment: develop/);

  const stagingE2e = workflow('e2e-staging.yml').replace(/\r\n/g, '\n');
  const staging = job(stagingE2e, 'e2e');
  assert.match(staging, /^ {4}environment: staging$/m);
  assert.match(staging, /PLAYWRIGHT_TEST_BASE_URL: https:\/\/cadeapp-staging\.vercel\.app/);
  assert.match(stagingE2e, /^ {2}group: e2e-staging$/m);
  assert.doesNotMatch(stagingE2e, /cadeapp-develop-e2e|SUPABASE_DEVELOP_PROJECT_REF/);
});

test('preview gate stays fail-closed for payloads and API items of the wrong shape', async () => {
  const { parsePull } = await import('./e2e-preview-target.mjs');

  // Payloads que no son un objeto, o cuyos campos anidados no lo son: nunca coinciden ni lanzan.
  for (const payload of [null, 'dpl_example123', 42, [previewPayload()]]) {
    const result = await matchPreviewWith({ payload });
    assert.equal(result.outcome, 'skip', `payload ${JSON.stringify(payload)}`);
  }
  for (const overrides of [
    { project: PREVIEW_PROJECT },
    { project: [{ id: PREVIEW_PROJECT }] },
    { project: { id: { toString: () => PREVIEW_PROJECT } } },
  ]) {
    const result = await matchPreviewWith({ payload: previewPayload(overrides) });
    assert.equal(result.outcome, 'skip', JSON.stringify(overrides));
  }
  for (const overrides of [
    { git: PREVIEW_SHA },
    { git: [PREVIEW_SHA] },
    { git: { sha: 123 } },
    { url: { href: PREVIEW_TARGET.url } },
    { url: [PREVIEW_TARGET.url] },
    { id: 7 },
    { id: null },
  ]) {
    const result = await matchPreviewWith({ payload: previewPayload(overrides) });
    assert.equal(result.outcome, 'reject', JSON.stringify(overrides));
  }

  // Lo que devuelve la API de GitHub también es dato: se normaliza campo por campo.
  assert.deepEqual(parsePull(previewPull()), previewPull());
  assert.deepEqual(parsePull(previewPull({ headRepo: null })).head.repo, null);
  for (const item of [
    null,
    'pull',
    7,
    [],
    {},
    { number: 321 },
    { base: 'develop', head: PREVIEW_SHA },
  ]) {
    const result = await matchPreviewWith({ pulls: [parsePull(item)] });
    assert.equal(result.outcome, 'skip', `item ${JSON.stringify(item)}`);
  }
  // Una PR que coincide en todo pero sin número utilizable no puede terminar en un target.
  for (const number of ['321', 3.5, null, -1]) {
    const result = await matchPreviewWith({
      pulls: [parsePull({ ...previewPull(), number })],
    });
    assert.equal(result.outcome, 'reject', `number ${JSON.stringify(number)}`);
  }
  // Un repo de head con forma inesperada no se confunde con el repo propio.
  const oddRepo = parsePull({
    ...previewPull(),
    head: { sha: PREVIEW_SHA, repo: { full_name: [PREVIEW_REPOSITORY] } },
  });
  assert.equal((await matchPreviewWith({ pulls: [oddRepo] })).outcome, 'skip');
});

test('preview target helper declares no any in its types', () => {
  const script = workflow('e2e-preview-target.mjs');
  const typed = script.match(/\/\*\*[\s\S]*?\*\//g) ?? [];
  assert.ok(typed.length > 5, 'el helper conserva sus anotaciones JSDoc');
  for (const comment of typed) {
    assert.doesNotMatch(comment, /@(type|typedef|param|returns)\b[^\n]*\bany\b/, comment);
    assert.doesNotMatch(comment, /[<,[(|]\s*any\s*[>,\])|]|\bany\[\]/, comment);
  }
  assert.doesNotMatch(script, /@ts-(ignore|expect-error|nocheck)|eslint-disable/);
});
