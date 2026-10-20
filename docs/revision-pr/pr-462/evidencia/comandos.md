# Evidencia reproducible — PR #462

## Datos observados (GitHub)
- Base develop al revisar: `cf2fbe13ab7ee8348b4805dadccef5416abb9265`.
- PR HEAD revisado: `aadfb2e47953da5db38916a31913475c0e5b440d`.
- GitHub PR/files: migración `renamed`, 0 líneas alteradas; bitácora +20, runner 1+/1-.
- Blob viejo/nuevo: `836466307e4c1aa9dd4fce12b61b95bf7597d743`.
- RED operativo real: https://github.com/cadeApp/cadeApp/actions/runs/39460281895, job `118757652445`, error de migración fuera de orden.
- GREEN DB en base efímera: https://github.com/cadeApp/cadeApp/actions/runs/39467922609, `db-tests` job `118784085061`, CC-034→CC-035→CC-033; `Files=34, Tests=3019, Result: PASS`, `[CC-033] mutación RED detectada y migración original GREEN restaurada.`
- E2E status **no verde**: https://github.com/cadeApp/cadeApp/actions/runs/39468001103, `BLOCKED / REQUIRES DEVELOP MIGRATION`.
- El VERDE operativo remoto aún no existe: debe obtenerse en `migrate-develop` post-merge.

## Arnés independiente para ejecutar en clon local (sólo lectura de Git; no DB)
Copiar completo a `/tmp/pr462-check.cjs` y ejecutar desde la raíz del repo tras `git fetch origin`. No usa Docker, secretos ni remoto Supabase.

```js
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const head = 'aadfb2e47953da5db38916a31913475c0e5b440d';
const base = 'cf2fbe13ab7ee8348b4805dadccef5416abb9265';
const oldPath = 'supabase/migrations/20261020065319_cc033_add_courier_optional_document.sql';
const newPath = 'supabase/migrations/20261020190000_cc033_add_courier_optional_document.sql';
const runnerPath = 'supabase/tests/integration/cc033_concurrency.mjs';
function git(...args) { return execFileSync('git', args, {encoding:'utf8'}).trimEnd(); }
const paths = new Set(git('ls-tree','-r','--name-only',head).split('\n'));
assert(paths.has(newPath), 'Falta el archivo nuevo');
assert(!paths.has(oldPath), 'Sigue el archivo viejo en HEAD');
assert.equal(git('rev-parse',base+':'+oldPath), git('rev-parse',head+':'+newPath), 'El SQL cambió');
const runner = git('show', head+':'+runnerPath);
assert(runner.includes(newPath), 'Runner no apunta a la ruta nueva');
assert(!runner.includes(oldPath), 'Runner aún apunta a ruta vieja');
const alreadyApplied = [20261020113000, 20261020123000];
function assertOrdering(candidate) {
  assert(Number(candidate) > Math.max(...alreadyApplied), 'La migración queda antes de una ya aplicada');
}
let negativeCaught = false;
try { assertOrdering('20261020065319'); } catch (error) {
  assert.match(error.message, /antes de una ya aplicada/);
  negativeCaught = true;
}
assert(negativeCaught, 'El control no detectó la mutación RED (timestamp viejo)');
console.log('MUTACIÓN RED detectada: timestamp anterior rechazado');
assertOrdering('20261020190000');
console.log('GREEN: timestamp, blob y referencias consistentes');
```

Ejecutar:
```bash
node /tmp/pr462-check.cjs
node --check supabase/tests/integration/cc033_concurrency.mjs
git diff --check origin/develop...aadfb2e47953da5db38916a31913475c0e5b440d
git merge-tree --write-tree origin/develop aadfb2e47953da5db38916a31913475c0e5b440d
node --test tools/verify-fichas.test.ts
node docs/revision-pr/analizar.mjs verificacion
```

**Límite:** el arnés anterior queda entregado para reproducción, no fue ejecutado por este revisor (clon Git no disponible en el runtime). El test de orden es un control de consistencia del nombre; **no** reemplaza la prueba de `supabase db push` de `migrate-develop` sobre el remoto.

## Pruebas CI exactas
`unit`: `Test Files 152 passed`, `Tests 2989 passed`.
`db-tests`: el log contiene el orden de aplicación correcto repetido en reseteos, pgTAP 3019/3019 PASS, las dos carreras CC-033 y la mutación de locks; el paso de comparación de tipos terminó success.
`approval-policy` (antes del informe): fail por sección ausente en PR body; el script sólo acepta `### Informe de revisión de agy` que contenga `Informe revisar-pr — T-384`, `Resultado: SIN BLOQUEANTES`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:`, `No revisado / dudas para Lautaro073:`.
