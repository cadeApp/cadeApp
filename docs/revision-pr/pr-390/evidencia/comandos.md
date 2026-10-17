# Evidencia y comandos — PR #390, ronda 1

**Fuente revisada:** GitHub #390 HEAD `6f8ff6d81862e21c622c0e5d88a803867d68f403` y `develop` observado `50c99b00e1235b426dc98a98aa0183592d6fba50`.
**Hecho:** inspección vía API GitHub del patch (+32 líneas `docs/tasks/log/T-365.md`), ficha, bitácora, SQL y TypeScript; conector `compare_commits` informó status diverged, ahead 2/behind 2.
**No hecho:** no hay clon local de codebase en este entorno (red GitHub no resuelve DNS para git), por ello no se ejecutaron comandos git locales, tests, TypeScript, lint, pgTAP, E2E ni mutaciones sobre repositorio. Los reportes GREEN de bitácora son atribuidos al autor y al baseline, no a esta revisión.

## Verificación en checkout limpio (para ejecutar en ronda 2)
```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/develop
git diff --stat origin/develop...HEAD
git diff --name-only origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
git log --oneline -- docs/revision-pr/pr-390/
# No leer secretos / .env*; no levantar Docker/Supabase local.
pnpm typecheck > /tmp/t365-typecheck.log 2>&1; tail -n 12 /tmp/t365-typecheck.log
pnpm lint > /tmp/t365-lint.log 2>&1; tail -n 12 /tmp/t365-lint.log
pnpm test > /tmp/t365-test.log 2>&1; grep -E 'Test Files|Tests |Duration' /tmp/t365-test.log | tail -n 7
pnpm vitest run src/server/live/t204.test.ts src/features/requests/queries.test.ts src/features/requests/components/request-offers.test.tsx src/features/requests/hooks/use-request-offers.test.tsx
node docs/revision-pr/analizar.mjs verificacion
```

## Checker independiente estático con mutaciones EN MEMORIA (NO EQUIVALE A TEST RUNTIME)
Este harness es de la revisión, no reutiliza uno del autor. Copiar íntegro `cat` a `/tmp`, luego ejecutarlo desde la raíz del repo con `node /tmp/pr390-audit.cjs`. En el HEAD previo al fix debe indicar RED para ambos filtros ausentes; simula un GREEN inyectando el filtro en memoria y RED volviendo a quitarlo. **Sin ejecución acreditada en esta ronda**. Después del fix el original debe ser GREEN y quitar cada filtro debe ser RED.

```bash
cat >/tmp/pr390-audit.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const paths = {
  live: 'src/server/live/t204.ts',
  ssr: 'src/features/requests/queries.ts',
};
function source(path) { return fs.readFileSync(path, 'utf8'); }
function queryBlock(s, anchor, method = ".from('offers')") {
  const start = s.indexOf(anchor);
  assert(start >= 0, 'falta símbolo ' + anchor);
  const from = s.indexOf(method, start);
  assert(from >= 0, 'falta consulta offers');
  const finish = s.indexOf('.limit(', from);
  assert(finish > from, 'falta paginación de offers');
  return s.slice(from, finish + 30);
}
const pending = /\.eq\(\s*['"]status['"]\s*,\s*['"]pending['"]\s*\)/;
function hasFilter(q) { return pending.test(q); }
function inject(q) {
  const replaced = q.replace(/(\.eq\(\s*['"]request_id['"]\s*,\s*[^)]+\))/, "$1\n      .eq('status', 'pending')");
  assert(replaced !== q, 'no se encontró request_id en el builder');
  return replaced;
}
const blocks = {
  live: queryBlock(source(paths.live), 'export async function getRequestOffersLiveServer'),
  ssr: queryBlock(source(paths.ssr), 'export async function getMerchantRequestWithOffers'),
};
for (const [name, original] of Object.entries(blocks)) {
  const originalGreen = hasFilter(original);
  const candidateGreen = originalGreen ? original : inject(original);
  const mutant = candidateGreen.replace(pending, '');
  assert(hasFilter(candidateGreen), 'instrumento no detecta la inclusión ' + name);
  assert(!hasFilter(mutant), 'mutante debía dar RED para ' + name);
  console.log(name + ': original=' + (originalGreen ? 'GREEN' : 'RED') +
    '; inyección en memoria=GREEN; mutación de sustracción=RED');
}
if (Object.values(blocks).some(b => !hasFilter(b))) {
  process.exitCode = 1; // baseline o corrección incompleta
}
NODE
node /tmp/pr390-audit.cjs
```

### Mutaciones FUNCIONALES que se deben demostrar en ronda 2
- Quitar solo el filtro `status=pending` en `t204.ts` -> test de servicio con ofertas mixtas falla; restaurarlo -> GREEN.
- Quitar solo el filtro `status=pending` en `queries.ts` -> test SSR con 51+ filas mixtas/cursor falla; restaurarlo -> GREEN.
- Quitar guarda `offer.status==='pending'` en CTA Y modal -> pruebas UI con `cancelled` / `expired` / `undefined` fallan; restaurar -> GREEN.
- Desactivar invalidación de caché al cancelar/reconectar -> test de integración con respuesta stale falla; restaurar -> GREEN.
- CC separado: cambiar autorización de dueño por `true` o retornar `reason` libre -> pgTAP con actor ajeno/campo prohibido RED; restaurar -> GREEN, CI db-tests del SHA.
- E2E Preview `match→courier_cancel→offers→historial→nueva oferta→rematch`, dos cuentas segregadas; observar rechazo real de oferta vieja (RPC).

**No ejecutar mutaciones en producción ni desplegar código inseguro.** Ninguna prueba está presentada como ya ejecutada.