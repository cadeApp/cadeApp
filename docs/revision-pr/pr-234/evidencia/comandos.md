# Comandos reproducibles — PR #234

Los bloques de esta ronda no mutan la rama. H01 usa copias en memoria del workflow para demostrar que la lógica actual del test acepta bypasses.

## H01 · El guard acepta bypasses del audit

Ejecutar desde la raíz del repo sobre `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d`:

```bash
node <<'NODE'
const { readFileSync } = require('node:fs');

const original = readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\r\n/g, '\n');

function currentGuard(ci) {
  const start = ci.indexOf('- name: Audit dependencies');
  if (start <= -1) return false;

  const rest = ci.slice(start + 1);
  const next = rest.search(/\n {6}- |\n {2}\S/);
  const step = next === -1 ? rest : rest.slice(0, next);

  return (
    /^\s+pnpm audit --audit-level=high$/m.test(step) &&
    !/\|\|\s*true|--ignore|continue-on-error|--prod|--audit-level=critical/.test(step)
  );
}

const mutations = [
  ['baseline', original],
  [
    'exit 0 antes del audit',
    original.replace(
      '        run: |\n          if [ -f src/domain/rpc-contracts.ts ]',
      '        run: |\n          exit 0\n          if [ -f src/domain/rpc-contracts.ts ]'
    ),
  ],
  [
    'if: false en el step',
    original.replace(
      '      - name: Audit dependencies (advisory until contracts-v1)\n        run: |',
      '      - name: Audit dependencies (advisory until contracts-v1)\n        if: $' + '{{ false }}\n        run: |'
    ),
  ],
  [
    'continue-on-error en el job',
    original.replace(
      '  audit:\n    name: audit',
      '  audit:\n    continue-on-error: true\n    name: audit'
    ),
  ],
];

for (const [name, content] of mutations) {
  console.log(name.padEnd(34), currentGuard(content) ? 'GREEN' : 'RED');
}
NODE
```

Resultado observado por la revisión:

```
baseline                           GREEN
exit 0 antes del audit            GREEN
if: false en el step              GREEN
continue-on-error en el job       GREEN
```

Las tres últimas deberían ser RED porque rompen la propiedad “audit se ejecuta y bloquea”.

### Mutaciones obligatorias para el arreglo

Después de corregir `tools/verify-audit-exceptions.test.ts`, demostrar **una por vez** y restaurar cada cambio:

1. insertar `exit 0` como primera línea del `run: |` del step Audit dependencies;
2. agregar `if: ${{ false }}` al step Audit dependencies;
3. agregar `continue-on-error: true` al job `audit`.

Para cada una:

```bash
pnpm vitest run tools/verify-audit-exceptions.test.ts
```

Esperado: RED por la aserción específica del gate, no por TypeScript, parseo roto ni un mock inválido. Restaurado el workflow: GREEN.

## H02 · Regla 00 y runbook

```bash
grep -n "pnpm audit\|ignoreGhsas" .agents/rules/00-confianza-y-seguridad.md docs/runbooks/excepciones-de-auditoria.md
```

Antes del arreglo, la regla 00 prohíbe cualquier silenciamiento y el runbook admite la excepción por GHSA. Después de D01 ambos deben describir la misma política.

## Batería al terminar el arreglo

```bash
pnpm vitest run tools/verify-audit-exceptions.test.ts
pnpm vitest run tools/verify-fichas.test.ts
pnpm typecheck
pnpm lint
pnpm test
git diff --check
node docs/revision-pr/analizar.mjs verificacion
```

No crear tests falsos, no cambiar expectativas para acomodar el bug y no adulterar fixtures/mocks para fabricar verde. La mutación debe romper la propiedad y la aserción debe detectar esa misma rotura.
