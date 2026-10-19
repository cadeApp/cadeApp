# Informe de revisión — PR #427 / T-315

**HEAD revisado:** `6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46`  
**Fecha:** 2026-10-19  
**Resultado:** CON BLOQUEANTES (1)

## Bloqueante

### PR427-H01 — archivo no autorizado por la ficha

**Archivo:** `.github/workflows/e2e-staging.yml:29`  
**Estado:** `[VERIFICADO]`

La PR cambia únicamente `timeout-minutes` de 20 a 45 y conserva intactos comando, cobertura, aserciones, specs, workers y triggers. Sin embargo, `docs/tasks/T-315.md` leído desde `origin/develop` limita el alcance a `deploy.yml`, `verify-workflows.test.mjs`, la ficha, su bitácora y `docs/revision-pr/**`; no autoriza `e2e-staging.yml`.

Regularizar la autorización mediante una tarea/ficha que incluya expresamente el workflow, manteniendo el diff funcional en una sola línea, y pedir una nueva revisión del HEAD resultante.

## Checks

- `git diff --check origin/develop...6f3cba7`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, sin warnings.
- `node --test .github/workflows/verify-workflows.test.mjs`: 79/79 PASS.
- `pnpm vitest run src/server/supabase/clients.test.ts`: 10/10 PASS.
- Suite local completa: 2889/2890; un timeout ambiental de 5 s en el test anterior, que pasó aislado.
- CI del HEAD: typecheck, lint, unit/coverage, db-tests, build, audit y bundle-budget PASS; E2E Preview estaba pendiente al cerrar la inspección.

No se aprobó ni mergeó la PR.
