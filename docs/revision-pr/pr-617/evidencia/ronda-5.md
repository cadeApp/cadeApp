# Evidencia de aceptación — PR #617 / ronda 5

**Código con D06:** `7411c8656f1001738431ff9f4d7d8b66438a516a`. **SHA de checkout E2E / CI:** `7d966e77bc3dbd33e74e28e4f79822a30d4e8373`. Comparación GitHub: solo documentos de `docs/revision-pr/pr-617/**` entre ambos.

## E2E oficial (lectura independiente de logs, no reporte del autor)

- Workflow `42154936711`, intento 1, completado success; job `e2e-preview` `127686799555`, completado success.
- El log contiene `ref: 7d966e77bc3dbd33e74e28e4f79822a30d4e8373`, `git checkout --progress --force 7d966e77bc3dbd33e74e28e4f79822a30d4e8373`, y `HEAD is now at 7d966e7`.
- `✓ admin-audit-filters.spec.ts:69` 18.1s; `✓ admin-courier-reinstate.spec.ts:80` 28.4s, primer intento. `117 passed (28.9m)`; `6 passed (2.3m)` (global-settings).
- No hay resumen de failed/flaky; el status `e2e-preview` publicado al commit es success.
- [Link al workflow](https://github.com/cadeApp/cadeApp/actions/runs/42154936711).

## CI oficial (lectura independiente de jobs y logs)

- Workflow `42151756302`, **intento 2**, head exacto `7d966e77bc3dbd33e74e28e4f79822a30d4e8373`; siete jobs success: build/audit/typecheck/unit/lint/db-tests/bundle-budget.
- `Test Files 193 passed (193)`, `Tests 3654 passed (3654)`. `All tests successful. Files=42, Tests=3396` y `Result: PASS`. Suite multisesión 9/9.
- `next build`: compiled successfully; approval-policy `42151754006`: success.
- **Warnings no bloqueantes:** el format check encontró 333 archivos con diferencias (CI lint está configurado para advisory); bundle-budget reporta `/admin/audit 267 kB` (límite recomendado 180 kB).
- [Link al workflow](https://github.com/cadeApp/cadeApp/actions/runs/42151756302).

## Método y límites

Se examinaron **logs reales del runner oficial y el SHA de checkout** con GitHub connector. El revisor no disparó workflows, no instaló Supabase/Docker, no editó código ni ejecutó tests locales en esta ronda. Las pruebas de mutación y oráculos independientes de H01-H03, y las inspecciones de D06, permanecen registradas en `evidencia/comandos.md` y las rondas previas. No se corrió `git merge-tree` local; GitHub reportó `mergeable=true`.

Para repetir la consulta: abrir los dos links de workflows, seleccionar el intento 2 del CI, inspeccionar los jobs unit/db-tests, y en el E2E leer el checkout en la sección `actions/checkout` antes de tomar como válido el resumen de Playwright.
