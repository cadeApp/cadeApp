import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

// T-332: `pnpm audit --audit-level=high` sigue bloqueando en CI. La única forma de que un advisory no lo haga es
// listarlo en `pnpm.auditConfig.ignoreGhsas`, y eso solo vale para un advisory sin versión corregida, de un paquete
// que no llega a producción y documentado en el runbook. Agregar uno nuevo exige cambiar esta tabla y el runbook.
const AUDIT_EXCEPTIONS: Record<string, string> = {
  'GHSA-vfj7-8cjw-p6xm': 'braces',
};

const RUNBOOK = 'docs/runbooks/excepciones-de-auditoria.md';

type PnpmWhyEntry = { dependencies?: Record<string, unknown> };

const BLOCKING_CONDITION =
  'if [ -f src/domain/rpc-contracts.ts ] && [ -d supabase/migrations ]; then';

const indentOf = (line: string) => line.length - line.trimStart().length;

/** Líneas del job `name` de un workflow: desde `  name:` hasta la próxima clave de indentación ≤ 2. */
function extractJob(workflow: string, name: string): string[] | undefined {
  const lines = workflow.replace(/\r\n/g, '\n').split('\n');
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) return undefined;
  const end = lines.findIndex((line, i) => i > start && line.trim() !== '' && indentOf(line) <= 2);
  return lines.slice(start, end === -1 ? lines.length : end);
}

/** Líneas del step del job cuyo `name:` empieza por `prefix`: desde su `- ` hasta el próximo ítem o clave. */
function extractStep(job: string[], prefix: string): string[] | undefined {
  const starts = job.flatMap((line, i) => (/^ {6}- /.test(line) ? [i] : []));
  for (const start of starts) {
    const end = job.findIndex((line, i) => i > start && line.trim() !== '' && indentOf(line) <= 6);
    const step = job.slice(start, end === -1 ? job.length : end);
    if (
      step.some((line) => /^ {6}(- | {2})name: /.test(line) && line.includes(`name: ${prefix}`))
    ) {
      return step;
    }
  }
  return undefined;
}

/** Todos los steps del job, partidos en cada línea `      - `. Lo anterior al primer step no entra. */
function extractSteps(job: string[]): string[][] {
  const starts = job.flatMap((line, i) => (/^ {6}- /.test(line) ? [i] : []));
  return starts.map((start, n) => job.slice(start, starts[n + 1] ?? job.length));
}

/** Líneas con contenido, sin comentarios de línea completa ni espacios finales (conserva la indentación). */
const meaningful = (lines: string[]) =>
  lines
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));

/** Claves directas de un step: la del `- ` y las de indentación 8. */
const stepKeys = (step: string[]) =>
  meaningful(step)
    .filter((line) => /^ {6}- \S/.test(line) || /^ {8}\S/.test(line))
    .map((line) => line.trim().replace(/^- /, ''));

// Allowlist del job `audit` tal como está revisado. Cualquier clave o step nuevo tiene que pasar por revisión.
const AUDIT_JOB_KEYS = ['name: audit', 'runs-on: ubuntu-latest', 'timeout-minutes: 10', 'steps:'];
const AUDIT_JOB_SETUP_STEPS = [
  [
    '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4',
    '        with:',
    '          persist-credentials: false',
  ],
  [
    '      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4',
    '        with:',
    '          version: 10.28.0',
  ],
  [
    '      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4',
    '        with:',
    '          node-version: 22.14.0',
    '          cache: pnpm',
  ],
  ['      - run: pnpm install --frozen-lockfile'],
];
const AUDIT_STEP_KEYS = ['name: Audit dependencies (advisory until contracts-v1)', 'run: |'];

// PR234-H01 (Ronda 3): claves de nivel superior del workflow. Un `defaults:` o `env:` global cambiaría el contexto
// de ejecución de todos los jobs, así que cualquier clave nueva obliga a revisión explícita.
const CI_TOP_LEVEL_KEYS = ['name: CI', 'on:', 'permissions:', 'concurrency:', 'jobs:'];

function topLevelKeys(workflow: string): string[] {
  return meaningful(workflow.replace(/\r\n/g, '\n').split('\n'))
    .filter((line) => indentOf(line) === 0)
    .map((line) => line.trim());
}

// PR234-H01 (Ronda 4): el audit solo protege si CI corre en las PRs y pushes de las ramas compartidas.
const CI_ON_BLOCK = [
  'on:',
  '  pull_request:',
  '    branches: [develop, staging, main]',
  '  push:',
  '    branches: [develop, staging, main]',
];

/** Bloque de una clave de nivel superior, con su indentación y sin comentarios ni líneas vacías. */
function topLevelBlock(workflow: string, key: string): string[] | undefined {
  const lines = workflow.replace(/\r\n/g, '\n').split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start === -1) return undefined;

  const end = lines.findIndex((line, i) => i > start && line.trim() !== '' && indentOf(line) === 0);

  return meaningful(lines.slice(start, end === -1 ? lines.length : end));
}

/** Script de `run: |` del step, sin la indentación común. */
function runScript(step: string[]): string[] {
  const start = step.findIndex((line) => /^ {8}run: \|$/.test(line));
  expect(start, 'the audit step must use a `run: |` block').toBeGreaterThan(-1);
  const body = step.slice(start + 1).filter((line) => line.trim() !== '');
  const base = Math.min(...body.map(indentOf));
  return body.map((line) => line.slice(base));
}

const substantive = (lines: string[]) =>
  lines.map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('#'));

/** Proyectos que alcanzan `name` desde las dependencias de producción, según `pnpm why --prod`. */
function productionPathsTo(name: string): PnpmWhyEntry[] {
  const result = spawnSync('pnpm', ['why', name, '--prod', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  expect(result.status, `pnpm why ${name} --prod failed:\n${result.stderr}`).toBe(0);
  const entries = JSON.parse(result.stdout) as PnpmWhyEntry[];
  return entries.filter(
    (entry) => entry.dependencies && Object.keys(entry.dependencies).length > 0
  );
}

describe('excepciones de pnpm audit (T-332)', () => {
  const auditConfig = (pkg.pnpm as { auditConfig?: Record<string, unknown> }).auditConfig ?? {};

  it('solo ignora los GHSA aprobados y no usa otras vías para silenciar el audit', () => {
    expect(Object.keys(auditConfig)).toEqual(['ignoreGhsas']);
    expect(auditConfig.ignoreGhsas).toEqual(Object.keys(AUDIT_EXCEPTIONS));
  });

  it('cada excepción está documentada en el runbook con su paquete, alcance y revisión', () => {
    const runbook = readFileSync(RUNBOOK, 'utf8');
    for (const [ghsa, name] of Object.entries(AUDIT_EXCEPTIONS)) {
      const section = runbook.split(/^## /m).find((block) => block.startsWith(ghsa));
      expect(section, `${RUNBOOK} must have a "## ${ghsa}" section`).toBeDefined();
      expect(section).toContain(`\`${name}\``);
      expect(section).toMatch(/\*\*Versión corregida:\*\* ninguna/);
      expect(section).toMatch(/\*\*Alcance:\*\* solo desarrollo/);
      expect(section).toMatch(/\*\*Se quita cuando:\*\*/);
    }
  });

  it('pnpm why --prod detecta una dependencia de producción (control de la sonda)', () => {
    expect(productionPathsTo('zod')).not.toHaveLength(0);
  });

  it('ningún paquete exceptuado llega a producción', () => {
    for (const name of new Set(Object.values(AUDIT_EXCEPTIONS))) {
      expect(productionPathsTo(name), `${name} must stay out of production dependencies`).toEqual(
        []
      );
    }
  });

  it('CI sigue corriendo pnpm audit con umbral high, bloqueante y sin bypass', () => {
    // PR234-H01: se valida la estructura del job y del step, no solo palabras sueltas.
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(topLevelKeys(workflow), 'CI top-level keys must match the reviewed allowlist').toEqual(
      CI_TOP_LEVEL_KEYS
    );
    expect(
      topLevelBlock(workflow, 'on'),
      'CI trigger block must match the reviewed allowlist'
    ).toEqual(CI_ON_BLOCK);
    const job = extractJob(workflow, 'audit');
    expect(job, 'ci.yml must keep the `audit` job').toBeDefined();
    // PR234-H01 (Ronda 2): allowlist. Las claves directas del job son exactamente las revisadas, así que
    // `if:`, `continue-on-error:`, `defaults:`, `env:`, `container:` o cualquier otra nueva lo dejan RED.
    const jobKeys = meaningful(job ?? [])
      .filter((line) => indentOf(line) === 4)
      .map((line) => line.trim());
    expect(jobKeys, 'audit job keys must match the reviewed allowlist').toEqual(AUDIT_JOB_KEYS);

    // Exactamente cinco steps, en orden: los cuatro de preparación tal cual y el audit al final.
    const steps = extractSteps(job ?? []);
    expect(steps, 'audit job must have exactly the reviewed steps').toHaveLength(5);
    expect(
      steps.slice(0, 4).map(meaningful),
      'audit setup steps must match the reviewed allowlist'
    ).toEqual(AUDIT_JOB_SETUP_STEPS);

    const step = extractStep(job ?? [], 'Audit dependencies');
    expect(step, 'the audit job must keep the `Audit dependencies` step').toBeDefined();
    expect(steps[4], 'the audit step must be the fifth and last step').toEqual(step);
    expect(stepKeys(step ?? []), 'audit step keys must match the reviewed allowlist').toEqual(
      AUDIT_STEP_KEYS
    );
    const stepText = (step ?? []).join('\n');
    expect(stepText).not.toMatch(
      /--prod|--audit-level=critical|--ignore|\|\|\s*true|continue-on-error/
    );

    // La rama bloqueante depende de que existan los contratos y las migraciones: tienen que existir.
    expect(existsSync('src/domain/rpc-contracts.ts')).toBe(true);
    expect(
      readdirSync('supabase/migrations').filter((file) => file.endsWith('.sql'))
    ).not.toHaveLength(0);

    // El script arranca con la condición, y entre su `then` y su `else` hay un único comando: el audit.
    const script = runScript(step ?? []);
    expect(substantive(script)[0]).toBe(BLOCKING_CONDITION);
    const condition = script.findIndex((line) => line === BLOCKING_CONDITION);
    const elseLine = script.findIndex((line, i) => i > condition && line === 'else');
    expect(elseLine, 'the blocking branch must end in a top-level `else`').toBeGreaterThan(
      condition
    );
    expect(substantive(script.slice(condition + 1, elseLine))).toEqual([
      'pnpm audit --audit-level=high',
    ]);
  });
});
