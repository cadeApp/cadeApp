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
