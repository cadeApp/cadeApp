# Evidencia reproducible — PR #416 ronda 1

**Código auditado:** `a5a3dc5a5dabb0e07aee922f2857f67f8b9fb6bc`; ref base `1958c9aba18543c233a8809385adb65adfd023f1`. Se consultaron archivos en GitHub y logs de CI. No se ejecutó pnpm ni Docker local.

## Evidencia real del CI

- [Unit run 39099606622 / job 117592990643](https://github.com/cadeApp/cadeApp/actions/runs/39099606622/job/117592990643): `FAIL tools/verify-fichas.test.ts > Fichas de tarea: sincronía con el plan > el primer ítem del DoD de cada ficha coincide con su fila del plan`; `Desincronizadas: T-372`; `Test Files 1 failed | 144 passed`; `Tests 1 failed | 2764 passed`.
- [E2E run 39098068311 / job 117588556782](https://github.com/cadeApp/cadeApp/actions/runs/39098068311/job/117588556782): checkout `b6396784`, `Flujo 2: Deduplicación de DNI ...` PASS, 87 Chromium PASS, 3 global-settings de **T-306** PASS.
- [RED anterior de PR #411](https://github.com/cadeApp/cadeApp/actions/runs/39094918384): `duplicate key value violates unique constraint "couriers_dni_hmac_key"` en DNI fijo; es la causa anterior, no un RED de la sincronía DoD.
- [CI nuevo 39099606622](https://github.com/cadeApp/cadeApp/actions/runs/39099606622): logs de unit y estado actual; `db-tests` en progreso y `e2e-preview` pendiente al consultar. El informe de revisión en body estaba sin completar y `approval-policy` FAIL.
- [Comparación de commits](https://github.com/cadeApp/cadeApp/compare/b6396784...a5a3dc5): solo `docs/tasks/log/T-372.md` cambió después del código que pasó E2E.

## Oráculo de igualdad literal, ejecutado por el revisor en memoria

Recuperé `docs/tasks/T-372.md` y `docs/implementation-plan.md` de la PR y repliqué exactamente la lógica de `tools/verify-fichas.test.ts:127-157` (columna 6 del split y primer `- [ ]` en `## DoD`). El original devuelve falso, la sustitución del primer ítem por la columna DoD devuelve verdadero.

Script autocontenido reproducible en un checkout del mismo SHA, sin dependencias externas:

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const task = fs.readFileSync('docs/tasks/T-372.md', 'utf8').replace(/\r\n/g, '\n');
const plan = fs.readFileSync('docs/implementation-plan.md', 'utf8').replace(/\r\n/g, '\n');
const row = plan.split('\n').find(x => /^\|\s*T-372\s*\|/.test(x));
assert.ok(row);
const expected = row.split('|').map(s => s.trim())[6];
const section = task.match(/## DoD\n([\s\S]*?)(?:\n## |$)/);
assert.ok(section);
const first = section[1].match(/^- \[[ x]\] (.*)$/m);
assert.ok(first);
assert.notEqual(first[1].trim(), expected, 'RED: la ficha debería estar desincronizada en el SHA original');
const fixed = task.replace(first[0], '- [ ] ' + expected);
const fixedSection = fixed.match(/## DoD\n([\s\S]*?)(?:\n## |$)/);
const fixedFirst = fixedSection[1].match(/^- \[[ x]\] (.*)$/m)[1].trim();
assert.equal(fixedFirst, expected, 'GREEN: el ítem corregido coincide con el plan');
console.log('Control independiente de sincronía T-372: RED original + GREEN con un único cambio de viñeta');
```

Esta comprobación analiza **texto**, no ejecuta la suite Vitest ni PostgreSQL. La ejecución original que falló está en Actions. El primer ítem debe copiarse literalmente desde la fila, sin cambiar expectations en el test.

## Comandos para agy (no ejecutados por revisor)

```bash
git fetch origin
git switch feat/T-372-dni-unico-onboarding
git pull --ff-only origin feat/T-372-dni-unico-onboarding
pnpm exec vitest run tools/verify-fichas.test.ts
pnpm typecheck && pnpm lint && pnpm test
git diff --check origin/develop...HEAD
git status --short
git rev-parse HEAD
git ls-remote origin feat/T-372-dni-unico-onboarding
```

No usar `--updateSnapshot`, `.skip`, modificaciones de `tools/verify-fichas.test.ts` ni usar un falso `RED` generado por logs.