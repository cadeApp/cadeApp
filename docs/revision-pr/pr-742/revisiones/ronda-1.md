# Informe independiente — PR #742 — T-437 / CC-052 — Ronda 1

**Fecha:** 2026-11-13 · **Resultado: CON BLOQUEANTES (4)** · **Mejoras: 2**  
**SHA verificado por inspección:** `a8166b5b0f037c561e8652142e90768cda698b37`; `develop` `22dff3fa93df5c79b88d8021c1267389b2055666`.  
**No se aprueba ni se mergea.** Esta PR todavía es exclusivamente documental; la implementación de T-437 va en otra PR.

## 0. Precondiciones del protocolo

- Leídos `docs/revision-pr/{COMO-ENTREGAR,README}.md` y `.agents/skills/revisar-pr/SKILL.md` de `develop`. Contrastadas lecciones `pr-56/AG-37`, `pr-62/AG-57..60`, `pr-64/AG-61..63`, `pr-63/AG-64..71`, `pr-68/AG-73..75` y `pr-82/AG-76..77`. No se reutilizaron identificadores AG ambiguos.
- Head remoto de la PR: `a8166b5b0f037c561e8652142e90768cda698b37`; base remota `develop`: `22dff3fa93df5c79b88d8021c1267389b2055666`. La comparación GitHub indica `ahead 1 / behind 0`, `mergeable=true`, tres archivos (`CC-052.md` +188, `T-437.md` +134, fila `implementation-plan.md` +1). No hay otros diffs. La API confirma lo pusheado; no se ejecutó `git fetch` ni `git merge-tree` por no disponer de clon local.
- Comentarios y review threads: no hay comentarios humanos ni revisiones; solo comentario automático Vercel. `docs/revision-pr/pr-742/` no existía en HEAD y no tiene histórico previo que restaurar.
- `docs/tasks/T-437.md` NO existe en `develop`: es creación, no edición de ficha anterior. `docs/tasks/log/T-437.md` tampoco existe en la rama; se registra la ausencia, sin atribuirle sesiones que no ocurrieron.
- Comparación directa con las versiones finales de `admin_decide_courier` y `admin_reinstate_courier` en `20261113120000_cc050_courier_dni_hardening.sql`; obligatorios en `20261104200000_cc043_courier_application.sql`; verificación en `20261106120000_cc042_courier_vehicles.sql`; reemplazo en `20261016210000_cc025_courier_document_replacement.sql`. Confirmado el orden `couriers FOR UPDATE` → documento en los writers.
- La PR declara `pnpm exec vitest run tools: 10 archivos, 123 tests`, sin salida reproducible en bitácora. **No se ejecutó** `pnpm`, `test:db`, Docker, Supabase ni E2E; no hay clon montado. El workflow CI para ese SHA figura **cancelled**. Por protocolo, con bloqueantes esta ronda es inspección y probes documentales en memoria, no un certificado de CI.
- Se probaron seis probes estáticos propios contra contenido exacto de GitHub del SHA (6 controles baseline GREEN; 6 mutaciones documentales RED); ver `evidencia/comandos.md`. Es evidencia sobre el texto, **no** prueba de runtime SQL, locks o UI.

## 1. Lo que está correctamente especificado

1. CC-043 obliga a `dni_front`, `dni_back`, `selfie` y `avatar`, no licencia ni seguro; CC-052 mantiene esa clase completa y exige estado `verified`, versión actual, `purged_at IS NULL`, exactamente una fila por tipo.
2. Las dos RPC de CC-050 hacen `FOR UPDATE` de `couriers`. CC-042 `admin_verify_document` y el reemplazo de CC-025 toman primero el mismo lock. Es coherente agregar la guarda antes de `UPDATE couriers` y `audit_log`. El rechazo no debe adquirir la nueva precondición.
3. `admin_reinstate_courier` conserva salida idempotente al encontrar `approved`, aun sin documentación. Las RPC conservan `assert_admin_aal2()` y el helper interno no tiene `EXECUTE` para clientes.
4. La ficha cubre la lista de suites y archivos que el propio `Impacto exacto` declaró. El problema es que esa enumeración original es incompleta respecto del código actual, especialmente consulta/tipo admin y camino de subsanación.
5. El seed E2E `finalizeSeededCourierApplication` coloca los cuatro documentos en `submitted`; son reales los fixtures positivos a adaptar, no un riesgo supuesto.

## 2. Bloqueantes

### PR742-H01 — Sin camino operativo para subsanar documentación de un rechazado o suspendido (ALTO)

**Ubicación documental:** `docs/contracts/CC-052.md:50-52, 91-92, 111-127`; `docs/tasks/T-437.md:67-73, 125-134`.  
**Contraste en develop:** `20261106120000_cc042_courier_vehicles.sql:905,1129,1334`; `20261016210000_cc025_courier_document_replacement.sql:169-183,235-250`.

La propuesta exige documentación verificada antes de rehabilitar, pero las RPC vigentes `submit_courier_onboarding_documents` y `replace_courier_document` bloquean a `rejected`/`suspended`. Además, `replace_courier_document` normalmente exige documento actual `rejected`: un documento `verified` que ya fue purgado no se puede recargar por ese camino. El resultado no es solo un error UI: hay cuentas que no tienen transición operativa de recuperación.

**Corrección contractual necesaria (D5-A, selección automática NO ratificada):** diseñar y delimitar la subsanación autorizada de obligatorios para esos dos estados **sin** aprobar, reabrir indebidamente el alta ni modificar la guarda MFA. Preferir RPC dedicada o extensión acotada de writers existentes tras analizar reutilización: actor repartidor autenticado, consentimiento, `couriers FOR UPDATE` primero, tipos obligatorios solamente, path canónico + objeto de Storage verificado, idempotencia, un vigente por tipo, nueva versión `submitted`, auditoría sin PII, y verificación posterior exclusiva de admin aal2. Cubrir faltante, purgado, rechazado, reemplazo de histórico, permisos cruzados, race y reintentos. Enumerar explícitamente archivos/acciones/tests en CC, ficha y fila del plan, o declarar dependencia previa verificable. **No implementar código en esta PR documental.**

### PR742-H02 — Paridad RPC/UI imposible con el dato actualmente consultado (ALTO)

**Ubicación documental:** `docs/contracts/CC-052.md:50-52,143-156`; `docs/tasks/T-437.md:52-62`.  
**Contraste en develop:** `src/features/admin/queries.ts:191-200,230-260` y `src/features/admin/types.ts:53-62`.

El contrato exige no purgados y afirma que la UI calcula el estado con datos ya cargados. Pero `getApplicantDetail` no pide `purged_at` y `ApplicantDocumentDetail` no tiene `purgedAt`. Un documento actual `verified` purgado puede habilitar un botón que la RPC rechaza. `queries.ts`, `queries.test.ts` y `types.ts` faltan en **Archivos permitidos** y en `Impacto exacto`.

**Corrección (D6-A, selección automática NO ratificada):** permitir estos tres archivos; proyectar `purged_at` en la consulta, convertir a `purgedAt: string | null` en el tipo, comprobar los cuatro tipos con exactamente uno vigente, `verified` y no purgado, manteniendo la RPC como barrera. Sumar tests de query con registros purgados y caso de duplicados; evitar cambios RLS o exposición al repartidor. La UI debe mostrar motivo al deshabilitar ambos botones.

### PR742-H03 — Batería RED de UI no mata regresión en Rehabilitar (MEDIO)

**Ubicación documental:** `docs/contracts/CC-052.md:165-186`; `docs/tasks/T-437.md:106-120`.

La mutación propuesta `t437-ui-approve-guard` solo habilita «Aprobar» y espera RED en `toBeDisabled`. Quitar únicamente la guarda de «Rehabilitar» deja intacta esa mutación y no hay una batería independiente obligatoria. Es `P08-control-no-cubre-lo-que-dice` y refuerza `pr-64/AG-62` / `pr-82/AG-76`.

**Corrección:** agregar entrada separada `t437-ui-reinstate-guard` que quite solo `disabled` de Rehabilitar/Reconsiderar, con aserción RED específica en estado `suspended` y `rejected`. Para ambas, verificar que el control normal sea GREEN y la mutación sea RED por el comportamiento real, no por falta de seed, timeout o mock inválido. Mantener además el bypass de RPC con token MFA.

### PR742-H04 — Registro contractual de decisiones no reconciliado (MEDIO / DECISIÓN)

**Ubicación documental:** `docs/contracts/CC-052.md:115-128`; `docs/tasks/T-437.md:21-24,67-73`; fila T-437 de `docs/implementation-plan.md`.

El texto actual anuncia D4-A, no menciona D5 ni D6 y dice «Decisiones abiertas: 0» sin ratificación personal. La nueva selección automática registrada para esta ronda es: **D1-A, D2-A, D3-A, D4-C, D5-A y D6-A**, **SIN aprobación personal explícita de Lautaro073**. La declaración del agente no equivale a una decisión del responsable.

**Corrección documental:** escribir el set completo, su carácter automático y no ratificado, las alternativas y los riesgos. Sustituir D4-A por D4-C: sin backfill ni suspensión automática de aprobados, pero regularización controlada y seguimiento mediante tarea/issue separado; `RAISE NOTICE` con conteo no es por sí solo una acción de regularización. Agregar D5-A/D6-A y reconciliar «Impacto exacto», «Archivos permitidos», DoD y fila del plan. Conservar explícito que la ratificación humana queda pendiente antes de cambios de producto/alcance.

## 3. Mejoras / riesgos no demostrados

### PR742-H05 — Un fixture de dos documentos vigentes exige una estrategia explícita (BAJO)

**Ubicación:** `docs/contracts/CC-052.md:153,171-176`; `docs/tasks/T-437.md:83-90`.

El índice único parcial `courier_documents_unique_current` vigente en CC-042 (`:55-63`) impide normalmente dos documentos actuales del mismo tipo para los cuatro obligatorios (`vehicle_id` nulo). Insertar dos y esperar `DOCUMENTS_NOT_VERIFIED` caería antes por `unique_violation`: falso rojo. Mantener un pgTAP que demuestre el índice y, para verificar la defensa adicional del helper ante datos corruptos, introducir duplicado solo en caso aislado que desactive/restaure índice dentro de transacción, con control inicial y limpieza. No debilitar el índice en implementación.

### PR742-H06 — La purga no participa en el lock de `couriers` (BAJO, hipótesis)

**Ubicación:** `docs/contracts/CC-052.md:70-79`. Contraste: `src/server/cron/sweep.ts:144-195`.

El cron consulta filas con `purge_after <= now()`, borra de Storage y luego marca `purged_at` sin lock de `couriers`. Por tanto, la frase «no hay deadlock nuevo» es plausible para admin_verify/reemplazo, pero no prueba serialización completa con purga. **No se demostró** un caso alcanzable de documento *vigente* con `purge_after` vencido: la retención habitual marca históricos. Documentar la precondición e investigar en implementación con fixture real; si se comprueba una carrera alcanzable, escalar en nueva ronda. No exigir cambio del cron en esta PR sin evidencia.

## 4. Cobertura exacta de fixtures inspeccionada

- **pgTAP positivos que hoy aprueban/rehabilitan sin los cuatro `verified`:** `supabase/tests/rpc_admin.sql` (aprobar pending 1), `cc034_admin_reinstate_courier.sql` (suspended/rejected), `cc043_courier_application.sql` (c13), `cc050_courier_dni_hardening.sql` (c18, c15). Es correcta la lista inicial del CC.
- **Integración:** `supabase/tests/integration/cc034_concurrency.mjs` llama a la RPC real en carreras; debe preparar los cuatro verificados para no convertir el test de locks en uno de validación documental.
- **Fake/unit:** `src/domain/domain.test.ts`, `cc034-admin-reinstate-courier.test.ts`, `cc050-courier-dni-hardening.test.ts`, `src/features/admin/actions.test.ts`, `src/server/rpc/admin.test.ts`, `applicant-detail-view.test.tsx`. El fake hoy no modela `purged_at`, debe modelarlo para la nueva guarda y conservar orden de errores.
- **E2E:** `courier-onboarding.spec.ts` llama a `finalizeSeededCourierApplication` (cuatro `submitted`) y aprueba por RPC/UI; `admin-courier-reinstate.spec.ts` y `admin-audit-filters.spec.ts` se apoyan en seeds aprobados con docs `submitted`. Sembrar/validar `verified` en rutas positivas y conservar negativos sin alterar aserciones. `src/server/e2e/staging-seed.ts` es el origen común. El DoD debe distinguir seeds que necesitan verificación de casos intencionalmente no verificados.
- **Casos sin necesidad de cambiar por la nueva guarda:** fixtures que hacen `UPDATE couriers SET status='approved'` como preparación para otros dominios, sin llamar a `admin_decide_courier`/`admin_reinstate_courier`. Enumerados para no forzar cambios innecesarios fuera de alcance: por ejemplo `cc042_courier_vehicles.sql`, `cc044_admin_list_applicants.sql`, `cc047_admin_hardening.sql`. No se justifica modificar cada test que contenga la palabra `approved`.

## 5. Decisiones: registro exacto, **sin ratificación**

**Las seis elecciones son selección AUTOMÁTICA del agente con la opción recomendada. Lautaro073 NO prestó aprobación personal explícita.** El mensaje de usuario pidió registrar esa condición, no concedió autoridad para mergear ni para ejecutar ampliaciones.

| ID | Selección automática | Coste / alternativa descartada | Pendiente |
|---|---|---|---|
| D1-A | 4 obligatorios verificados y vigentes | B: excluir avatar degrada cotejo | Ratificación |
| D2-A | `DOCUMENTS_NOT_VERIFIED` tipado | B: `INVALID_STATE_TRANSITION` pierde causa; C: error estructurado añade complejidad | Ratificación |
| D3-A | Ambos botones deshabilitados + motivo; RPC autoritativa | B: error al click; C: checklist detallado exige UI extra | Ratificación |
| D4-C | No suspensión automática + regularización auditada posterior | A: solo conteo crea deuda; B: suspensión masiva interrumpe piloto | Ratificación y seguimiento |
| D5-A | Subsanación controlada para suspendidos/rechazados | B: soporte manual bloquea; C: volver a pending amplía transiciones | Contrato seguro y ratificación |
| D6-A | Extender queries/types/tests admin y reflejar `purged_at` | B: UI divergente; C: consulta privilegiada nueva no aporta aquí | Ratificación |

Se mantienen separados hechos inspeccionados y riesgos hipotéticos. Una selección automática no permite tildar aprobaciones P1/P2 ni afirmar «decisiones aprobadas».

## 6. Estado y salida

**4 bloqueantes abiertos + 2 mejoras.** No se aprobó, no se mergeó, no se alteró ningún archivo productivo. Los seis probes documentales se hicieron sobre contenido remoto e incluyen mutaciones en memoria; no se ejecutó la batería de CI de T-437 ni mutaciones pgTAP porque la implementación no está en la PR.

Para quien arregle: seguir el **prompt acotado del comentario único de cierre de PR #742**. Limitar esta corrección a contrato, ficha, fila de plan y bitácora; no implementar ni modificar `docs/revision-pr/**`. Hacer `git pull` del commit de esta revisión antes de empezar; sin `rebase`, `force-push` ni `amend`. Después de nuevo SHA, será necesaria ronda 2.
