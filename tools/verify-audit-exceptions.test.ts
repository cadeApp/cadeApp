import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

  it('CI sigue corriendo pnpm audit con umbral high y sin bypass', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\r\n/g, '\n');
    const start = ci.indexOf('- name: Audit dependencies');
    expect(start, 'ci.yml must keep the audit step').toBeGreaterThan(-1);
    // El step va hasta el próximo step o job, o hasta el final del archivo.
    const rest = ci.slice(start + 1);
    const next = rest.search(/\n {6}- |\n {2}\S/);
    const step = next === -1 ? rest : rest.slice(0, next);
    expect(step).toMatch(/^\s+pnpm audit --audit-level=high$/m);
    expect(step).not.toMatch(
      /\|\|\s*true|--ignore|continue-on-error|--prod|--audit-level=critical/
    );
  });
});
