# PR #742 · T-437 / CC-052 — Informe independiente de Ronda 2

**Fecha:** 2026-11-13 · **SHA revisado:** `5c8095cb42441245e4d12c45456d496bb4c27b73` · **develop:** `22dff3fa93df5c79b88d8021c1267389b2055666`.

**RESULTADO: CON BLOQUEANTES (2 nuevos) · 1 mejora nueva · ratificación humana pendiente.** Ninguna aprobación ni merge.

## Decisiones y autoridad
**D1-A, D2-A, D3-A, D4-C, D5-A, D6-A y D7-A son selecciones automáticas del agente con la opción recomendada, sin aprobación personal explícita de Lautaro073; todas siguen pendientes de ratificación. D8-B es la declaración del agente de que no puede ratificarlas por Lautaro073.**

D7-A: la cuenta original con `dni_hmac` liberado no vuelve a subsanar o rehabilitarse dentro de T-437; no equivale a un mecanismo de recuperación nuevo. D8-B: se mantiene la falta de ratificación de **todas** las selecciones D1-A…D7-A. No marcar aprobaciones P1/P2/usuario ni usar estas elecciones del agente como permiso de implementar cambios de producto.

## Precondiciones y alcance

- PR autor Lautaro073; informe en la rama del PR, bajo carpeta exclusiva del revisor. `docs/revision-pr/pr-742/revisiones/ronda-1.md` se mantiene intacto.
- GitHub `9967b14166bc58e8261954622fc07361011bc80b..5c8095cb42441245e4d12c45456d496bb4c27b73`: 1 commit, solo `docs/contracts/CC-052.md`, `docs/tasks/T-437.md`, fila T-437 en `docs/implementation-plan.md` y nueva bitácora `docs/tasks/log/T-437.md`. No hubo cambios del autor en `docs/revision-pr/**` ni archivos productivos. GitHub indica `mergeable=true`, `develop` sin avance.
- No existe `docs/tasks/T-437.md` en develop: su fuente es el PR documental. Se contrastaron CC-025/042/043/050, RLS, UI admin y perfil del repartidor de develop. Issue de seguimiento #743 comprobado.
- CI del SHA revisado: `completed/cancelled`, **no verde**. Bitácora del autor declara `pnpm exec vitest run tools` 10 archivos / 123 tests y `git diff --check` limpio: **no se reprodujo** aquí. Sin clon local; `pnpm`, pgTAP, Docker/Supabase, E2E y `git merge-tree` no corridos.
- Revisión independiente de documento: **7 probes basales GREEN / 7 mutaciones de texto RED** del SHA remoto. Una tentativa global de H05 resultó ciega, se descartó y se corrigió acotando la sección. La evidencia es **documental**, no runtime; `evidencia/comandos.md`.

## Seguimiento de ronda 1

| Hallazgo | Estado de R2 | Motivo |
|---|---|---|
| `PR742-H01` | **Arreglado-verificado documentalmente** | RPC `resubmit_courier_required_document` descrita con lock `couriers→docs`, tipos obligatorios, estados, idempotencia, Storage, auditoría sin PII, verificación admin, UI /courier/profile. Nuevo error de redacción DNI liberado: **R01**. |
| `PR742-H02` | **Arreglado-verificado documentalmente** | `getApplicantDetail` debe seleccionar `purged_at`, el tipo proyecta `purgedAt` y `requiredDocumentsVerified` coincide con los 4 obligatorios; ficha permite `queries/queries.test/types`. |
| `PR742-H03` | **Parcial** | Dos patches independientes approve/reinstate ahora figuran; queda **R02**: reinstate usa dos ramas/labels reales que no están fijados como targets de mutación. |
| `PR742-H04` | **Decisión pendiente** | CC/ficha/plan reconciliaron D1–D6, D4-C, issue #743 y origen automático; D7-A y D8-B continúan automáticas, sin ratificación, deben añadirse al CC/ficha/plan con esa condición. |
| `PR742-H05` | **Arreglado-verificado documentalmente** | Se separa el `unique_violation` del índice frente a `DOCUMENTS_NOT_VERIFIED` del helper en estado duplicado aislado; evitar rollback global que invalide pgTAP ya ejecutado. |
| `PR742-H06` | **Arreglado-verificado documentalmente** | La purga se reconoce como hipótesis, con prueba pgTAP de `purge_after` de documento vigente antes de tocar cron. |
| `PR742-M3` | **Corregida por inspección** | Texto «antes de aprobar o rehabilitar». |

`arreglado-verificado` en los cuatro hallazgos indicados significa **verificación independiente ejecutada de especificación/documentación**, no de implementación de SQL/UI ni de CI.

## Bloqueantes nuevos

### PR742-R01 — ALTO — DNI liberado: historia de re-alta inalcanzable

**CC `docs/contracts/CC-052.md:104-107`** señala que al liberar `dni_hmac` «la identidad tiene que volver a declararse por el alta». Pero `finalize_courier_application` vigente, `supabase/migrations/20261104200000_cc043_courier_application.sql`, rechaza `couriers.status NOT IN ('pending','approved')`; `admin_reinstate_courier` de CC-050 exige `dni_hmac IS NOT NULL`. **La cuenta original** rechazada/suspendida no puede recorrer ese alta. La descripción actual de la PR **ya dice D7-A y exclusión**, pero el texto contractual conserva la promesa equivocada.

**Solución:** borrar la promesa de re-onboarding para la misma cuenta. En CC, ficha y fila T-437 precisar D7-A como elección **automática, no ratificada**: la cuenta original con DNI liberado queda fuera de subsanación/rehabilitación T-437; cualquier reclamo legítimo sigue su procedimiento independiente y no se crea transición nueva. Tests pgTAP exigen `resubmit`/`reinstate` → `INVALID_STATE_TRANSITION`, sin `update` ni `audit_log`. No tocar CC-043 ni CC-050. Patrón `P11-api-publica-inconsistente`; surgió al corregir H01.

### PR742-R02 — MEDIO — Un único mutante no identifica las dos acciones de rehabilitación

**CC `docs/contracts/CC-052.md:310-359` y ficha `docs/tasks/T-437.md:157-180`** piden eliminar el `disabled` de «Rehabilitar» y esperan RED en suspendido y rechazado. En código real `src/features/admin/components/applicant-detail-view.tsx:826-834` renderiza **dos `<Button>` distintos**: `openDecisionModal('reactivate')` y `('reconsider')`. `src/features/admin/copy.ts:165-169` define labels **«Reactivar repartidor»** y **«Reconsiderar aprobación»**. No existe botón con nombre literal «Rehabilitar». Un selector con ese nombre fallaría aunque ambos guards funcionasen; quitar solo un `disabled` no demostraría el otro.

**Solución:** mantener mutación de aprobar separada; especificar exactamente que `t437-ui-reinstate-guard.patch` quite los `disabled` **en ambas ramas**, con RED en `toBeDisabled` para cada etiqueta/estado real y baseline GREEN. Alternativa técnica es separar dos patches por rama si el arnés lo exige, reflejándolo en CC, ficha, fila del plan y catálogo; no cambiar expectativas para fabricar RED. Rehabilitación usa RPC `reinstateCourierAction` con AAL2. Patrón `P08-control-no-cubre-lo-que-dice`; H03 quedó parcial.

## Mejora nueva

### PR742-R03 — BAJO — Control de consentimiento atribuido a policy errónea

**CC `docs/contracts/CC-052.md:36-38`** dice que `courier_docs_insert_own_folder` exige rol courier **con consentimiento activo** por `app_private.is_courier()`. En `supabase/migrations/20260922051650_rls_v1.sql:134-148`, el helper `is_courier` solo comprueba `role = 'courier'`; la policy de Storage asegura bucket/carpeta propios. **La nueva RPC de subsanación** sí exige explícitamente `consent_status='active'` al registrar documento. No se demostró un bypass; es un comentario de seguridad falso.

**Solución:** separar explícitamente garantía de Storage (rol/carpeta) de garantía RPC (rol/consentimiento/estado/objeto). Agregar en la ficha prueba de consentimiento revocado sin escritura a documentos/audit. No cambiar RLS ni grants sin nuevo contrato. Patrón `P03-comentario-contradice-codigo`.

## Metadatos de PR y límites

**La descripción de PR ya fue corregida a D4-C, D5-A, D6-A, D7-A y ratificación pendiente**; verificado en vivo por GitHub en esta ronda. No exigir ni realizar esa corrección dos veces. La bitácora del autor distingue «hecho», tests declarados y pendientes; es admisible. `src/features/admin/audit-catalog.test.ts` debe correrse **en la implementación** cuando se agregue la acción de auditoría: no forma parte de esta PR solo docs.

## Cierre de R2

**Dos bloqueantes nuevos (R01/R02), una mejora (R03), H03 parcial, H04 decisión personal pendiente.** Se solicita corrección en la misma PR y ronda 3. Las selecciones D1-A…D7-A, incluida D7-A aportada por el agente, **NO** están ratificadas personalmente por Lautaro073 (D8-B). No aprobar, no mergear.
