# PR #742 — Ronda 3 · T-437 / CC-052

**Fecha:** 2026-11-13 · **SHA autoral revisado:** `b9bad8bc61b66486b9cf31d01e11013023241ce8` · **develop:** `22dff3fa93df5c79b88d8021c1267389b2055666`.

**Resultado: SIN BLOQUEANTES TÉCNICOS; UNA DECISIÓN PENDIENTE (PR742-H04).** La PR es documental. No está aprobada ni mergeada; ninguna decisión de producto se ratifica por el agente.

## Autoridad y decisiones

**D1-A, D2-A, D3-A, D4-C, D5-A, D6-A y D7-A son selecciones automáticas del agente con la opción recomendada, sin aprobación personal explícita de Lautaro073; ratificación pendiente. D8-B: el agente no puede ratificarlas en nombre de Lautaro073.**

No hay **nuevas** decisiones de producto para pedir al agente. D7-A excluye de T-437 la cuenta original con `dni_hmac IS NULL` liberado por disputa; no crea un nuevo flujo de re-onboarding en la misma cuenta. #743 sigue abierto para la regularización D4-C. Las aprobaciones de CC-052 permanecen sin marcar y el merge queda reservado a quien tenga autoridad personal para decidir.

## Alcance y pruebas

- `a7e927a278b1695bb540ff697329cce9839ce18c..b9bad8bc61b66486b9cf31d01e11013023241ce8` = **un commit, cuatro archivos**: `docs/contracts/CC-052.md`, `docs/tasks/T-437.md`, **solo fila T-437** de `docs/implementation-plan.md`, `docs/tasks/log/T-437.md`. Sin código, dependencias, migraciones o modificación autoral en `docs/revision-pr/**`. Base develop sin cambios; rama en fast-forward, sin rebase.
- Se compararon CC/ficha/plan con migraciones vigentes `CC-007/042/043/050`, RLS/Storage y botones de admin de develop. No hay T-437 en develop aún: la ficha nace en esta PR.
- **Nueve comprobaciones cruzadas** de alcance/contrato, y **seis pruebas documentales de mutación** con GREEN basal y RED tras cambiar una cláusula en memoria: D7-A; los tres patches approve/reactivate/reconsider; savepoint; D8-B. En el primer control de D8 una comparación literal falló por salto de línea; se corrigió a whitespace flexible antes de certificar.
- El autor declara `pnpm exec vitest run tools` (10 archivos, 123 tests) y `git diff --check` limpio. **No reproducidos por la revisión.** La consulta de GitHub Actions del SHA no devolvió runs; el autor afirma CI cancelada por ser solo docs. **No hay CI verde comprobada.** No se corrió `pnpm`, E2E, pgTAP, DB/Docker, `git merge-tree` ni el agregador completo `node docs/revision-pr/analizar.mjs` (sin clon de todo el repositorio). JSONL sí se parseó y contó en memoria.

## R01 — Arreglado-verificado documentalmente (ALTO)

En `CC-052.md` la cuenta original `rejected/suspended` con DNI liberado **no subsana, no vuelve al onboarding ni se rehabilita en T-437** (D7-A automática y no ratificada); `resubmit_courier_required_document` y `admin_reinstate_courier` deben devolver `INVALID_STATE_TRANSITION` sin alterar courier, documentos o auditoría. La tarjeta de subsanación tampoco aparece en `/courier/profile` cuando `dni_hmac` es nulo.

**Contraste real:** la implementación vigente de `finalize_courier_application` en `supabase/migrations/20261106120000_cc042_courier_vehicles.sql:1646` solo admite `pending/approved`; `admin_reinstate_courier` de CC-050 exige DNI registrado. Se exigen pgTAP negativos. Mutación de exclusión en texto: GREEN → RED. No se ejecutó la RPC nueva.

## R02 / H03 — Arreglados-verificados documentalmente (MEDIO)

La ficha, el CC y la fila del plan exigen **tres patches separados**, uno por botón real:
- `t437-ui-approve-guard.patch` → «Aprobar repartidor» (`pending`).
- `t437-ui-reactivate-guard.patch` → «Reactivar repartidor» (`suspended`).
- `t437-ui-reconsider-guard.patch` → «Reconsiderar aprobación» (`rejected`).

Cada entrada del catálogo tiene un test, un `expectedFailure`, una sola mutación de `disabled` sin alterar handler, estado o RPC, y un futuro RED por `toBeDisabled`, no por selector inexistente ni fixture. Contrastado con `applicant-detail-view.tsx:813-834` y `src/features/admin/copy.ts:165-169`. Tres mutaciones textuales distintas: GREEN → RED. Quedan pendientes los E2E reales de implementación.

## R03 — Rectificación explícita de falso positivo de la ronda 2 (BAJO)

**El revisor se equivocó en R2.** Leyó `supabase/migrations/20260922051650_rls_v1.sql:134-148`, que contiene la **definición inicial** de `app_private.is_courier()` (solo rol), pero omitió que `supabase/migrations/20260925170000_cc007_consent_enforcement.sql:103-116` la **redefine** con `role='courier' AND consent_status='active'`. Se revisaron las **47 migraciones SQL posteriores** en develop; ninguna redefine de nuevo `is_courier()`. Por tanto, la policy vigente de Storage **sí** comprueba consentimiento mediante ese helper, y la acusación de R2 no era un defecto del agente. Se conserva R2 sin borrarla; en R3 queda retractado el fundamento.

CC-052 ahora documenta ambas versiones **y** exige que la nueva RPC compruebe consentimiento de manera independiente, con pgTAP previsto para consentimiento no activo. Se cierra la aclaración documental, no se modifica RLS.

## Otros hallazgos y riesgo residual

- `PR742-H01`, `H02`, `H05`, `H06`: siguen verificados documentalmente desde R2. `H05` añade `rollback to savepoint` o caso final antes del rollback general para restaurar el índice. `H06` continúa como hipótesis de alcanzabilidad: probar `purge_after` antes de tocar cron.
- `PR742-H04`: **DECISIÓN-PENDIENTE**, único bloqueo para autorización de producto. D1-A…D7-A continúan sin ratificación personal; D8-B así lo constata.
- `PR742-M3`: mensaje corregido para «aprobar o rehabilitar».
- **Observación menor de metadatos:** el cuerpo de PR #742 ya dice D4-C y D7-A con procedencia automática, pero la sección «Informe de revisión de agy» aún dice «Ronda 2 en curso». El autor puede actualizarla con enlaces a R1–R3 y estado de ratificación. No constituye un nuevo bloqueante técnico.

## Cierre

**0 bloqueantes técnicos nuevos, H04 decisión personal pendiente, 0 nuevos hallazgos técnicos.** No aprobar ni mergear como agente. La implementación posterior deberá demostrar pgTAP, E2E y RED/GREEN reales: esta revisión solo certifica coherencia de documentos. Se preservan íntegros `ronda-1.md` y `ronda-2.md`; la corrección de R03 vive aquí y en `lecciones.md`.
