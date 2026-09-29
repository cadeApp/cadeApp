# Revisión PR #128 — T-315

- PR: #128 `[T-315] Deploy a Vercel desde GitHub Actions`
- Rama: `feat/T-315-deploy-vercel`
- SHA revisado: `f5a11f0f8f4e85e83f675c56afbef47b529a81d1`
- Base: `develop@b659027f49a96762d020e23f159f898b2895d938`
- Ronda actual: 1
- Estado: **CON BLOQUEANTES (2)**
- Decisiones de Lautaro073: D01 = 1-A; D02 = 2-A.

## Resumen

La implementación conserva el orden `migrate -> deploy`, fija Actions y Vercel CLI, usa el `head_sha` del run de migración, separa environments y ejecuta health después del deploy.

Quedan dos bloqueantes:

1. `deploy-production` usa `workflow_run.triggering_actor.login`, mientras T-315 exige el mismo criterio que `migrate-production`: el actor original que inició el run. Lautaro073 decidió 2-A: usar `workflow_run.actor.login`.
2. Los tests nuevos no cubren propiedades que sus nombres/DoD dicen proteger. El harness independiente deja verdes las aserciones actuales al quitar `vercel pull`, al convertir el health en `... || true` y al hacer que el actor no autorizado termine con `exit 0`.

La ausencia previa de `docs/tasks/T-315.md` en develop se registró como desvío de proceso aceptado por decisión 1-A; no bloquea esta ronda.

## Checks

- Rama: HEAD coincide con el PR al iniciar y antes de cerrar la ronda.
- Comparación con develop: ahead 1 / behind 0.
- Comentarios/reviews previos: ninguno.
- CI general: **no inspeccionado todavía**, porque hay bloqueantes y el procedimiento indica mirarlo recién cuando la ronda esté para aprobar.
- Checkout local completo: no disponible en este entorno por resolución de red a github.com; no se presenta evidencia ajena como propia.
- Mutaciones H02: reproducidas con harness independiente sobre el contenido exacto de `deploy.yml` y las aserciones nuevas del SHA revisado; ver `evidencia/comandos.md`.

## Siguiente ronda

Corregir H01 y H02 sin tocar la ficha ni `docs/revision-pr/**`; después revalidar las tres mutaciones en RED, los tests en GREEN y recién entonces inspeccionar CI del SHA corregido.
