# Informe revisar-pr — T-374 · PR #429 · ronda 1 · 2026-10-19

**Resultado: CON BLOQUEANTES (2).**  
**SHA revisado:** `78ffecaebb97ae54a43a52d593f66919a2d58aa1`  
**Base:** `develop` @ `59fb3daa82eb1c0394dca9bad143d7fd246ec34b`

## BLOQUEANTES

- **PR429-H01 — `docs/tasks/T-374.md:31`:** la ficha permitía `docs/revision-pr/pr-427/**`, pero el contrato mecánico exige `docs/revision-pr/**`; tampoco autorizaba documentar la revisión de #429.
- **PR429-H02 — `docs/implementation-plan.md` §8:** no existía fila T-374 y la ficha no autorizaba editar el plan.

## Evidencia

`pnpm vitest run tools/verify-fichas.test.ts` produjo 2 fallos y 5 casos verdes: «toda ficha permite la carpeta de revisión de PR» y «toda ficha no exceptuada tiene una fila en docs/implementation-plan.md».

La ficha sí autorizaba específicamente `.github/workflows/e2e-staging.yml`, limitaba el cambio futuro a `jobs.e2e.timeout-minutes: 20 → 45` y no modificaba T-315. No se aprobó ni mergeó.
