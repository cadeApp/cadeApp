# PR #489 — Revisión independiente — Ronda 2

**Fecha:** 2026-10-21 (Argentina)  
**HEAD revisado:** `be515ec74e9f0da54e4f5f709c247250251db840`  
**Base:** `develop@824c4fdb8a4277220e14b575eaf6a15e40df8406`  
**Ronda 1:** `25ad3cf36cf580bdc632448ad88d926220b1dec6`  
**Resultado:** **CON BLOQUEANTES — NO MERGEAR**, 3 altos + 2 medios nuevos, 1 mejora baja; los 12 de R1 fueron corregidos documentalmente.

## Metodología y alcance
- Verificadas las 10 fichas T-400..T-409 y sus filas §8 en HEAD; la comparación R1→R2 (`60e1f249...be515ec7`) incluye solo `docs/implementation-plan.md`, T-400..T-409. El autor **no modificó** `docs/revision-pr/pr-489/**`.
- Se leyó la referencia fuente de T-408/T-409: `docs/tasks/log/T-312.md` en la rama abierta de PR #491 (`81d3266e`). Esta bitácora aún NO está en develop. Se leyó también CC-036 y T-390/T-391 desde la rama de PR #497 (`74ba30a0`), todavía abierta. Nunca presentar estos contratos como mergeados en develop.
- Se contrastaron definiciones actuales de las policies `rls_v1.sql`, el contrato `admin_set_subscription` y la escritura compartida de `merchants.notes` desde `update_my_merchant_profile`, además de `src/features/admin/actions.ts` y migraciones de auditoría.
- Se revisaron comentarios y diff GitHub y la carpeta de R1. No se usó service role, no se consultó Supabase remoto, ni se levantó Docker local; ningún dato de destinatarios fue consultado.
- Todas las aserciones de R2 sobre futuras implementaciones son **análisis documental**, no RED/pgTAP ejecutado. Los únicos tests ejecutados citados son del CI oficial del HEAD y el detector independiente de igualdad documental.

## Verificación específica R1→R2

| Hallazgo R1 | Resultado documental en be515ec7 | Verificación |
|---|---|---|
| H01 | Primer DoD de las 10 fichas coincide exactamente con columna DoD del plan | **Comprobado:** comparación independiente 10/10, mutaciones en memoria 10/10; `tools/verify-fichas.test.ts` 7/7 en CI |
| H02 | T-403 depende del CC #498, búsqueda SQL normalizada antes de contar/paginar | Inspección del DoD; CC todavía pendiente |
| H03 | T-403/T-404 dependen de #499, usan `submitted_at`, null sin fecha | Inspección del DoD; CC todavía pendiente |
| H04 | T-404 distingue `profiles.created_at`, `submitted_at` y registros reales de `audit_log` | Inspección |
| H05 | T-405 usa `audit_log` por comercio y enlaza al filtro `targetId` de T-407 | Inspección; ver nuevo H16 sobre filtro de acción |
| H06 | T-406: open+reviewing, resolved, dismissed con schemas permitidos | Inspección |
| H07 | T-407: ventana `gte`/`lt`, frontera correcta de día AR | Inspección |
| H08 | T-400: test de catálogo de acción/entidad + acciones dinámicas | Inspección; test futuro, no ejecutado |
| H09 | T-402/T-403/T-407 permiten E2E nuevos | Inspección |
| H10 | T-400: resolver IDs completos antes de serializar | Inspección |
| H11 | T-404: conservar visor y URL de 60 segundos | Inspección |
| H12 | T-405: Todos y Cancelados explícitos | Inspección |

## CI del SHA revisado
- **CI oficial run #39700774152**: `unit` ✅ (155 archivos, 3170/3170 tests; `tools/verify-fichas.test.ts` 7/7), `typecheck` ✅, `lint` ✅, `build` ✅, `audit` ✅, `bundle-budget` ✅. `db-tests` estaba **en progreso** en el corte de lectura; no se declara verde sin revisar job.
- `e2e-preview` estaba pendiente al inicio; no se le atribuye una ejecución verde o roja sin evidencia.
- La PR es solo documentación: los E2E/pgTAP de las futuras tareas aún no deben correr para sus DoD.

## Hallazgos nuevos

| ID | Sev. | Tarea | Descripción |
|---|---|---|---|
| PR489-H13 | alto | T-408 | MFA en la RLS no impide escrituras directas sin RPC con aal2 |
| PR489-H14 | alto | T-408 | admin_notes y backfill no garantizan separación de datos |
| PR489-H15 | alto | T-408 | La inmutabilidad de auditoría omite revocar TRUNCATE y trigger de defensa |
| PR489-H16 | medio | T-405 | La lista de cambios de plan incluye eventos ajenos al plan |
| PR489-H17 | medio | T-409 | La ficha paraguas pide crear hijas fuera de sus archivos permitidos |
| PR489-H18 | bajo | T-409 | SEC-12 debe verificarse antes de imponer un CHECK que anule datos reales |

### PR489-H13 — ALTO — MFA en la RLS no impide escrituras directas sin RPC con aal2
**Archivo:** `docs/tasks/T-408.md:35`  
**Estado:** [ANÁLISIS] — no se ejecutó explotación contra una BD; el defecto es de especificación futura.

**Diagnóstico / evidencia:** La ficha reemplaza app_private.is_admin() por is_admin_aal2() en todas las policies, pero NO exige retirar las policies admin UPDATE/ALL que autorizan cambios directos con aal2. T-312 (PR #491, log SEC-01) exige explícitamente borrar UPDATE admin donde la escritura tiene RPC. Un admin aal2 aún podría omitir validaciones y audit_log.

**Arreglo concreto:** Precisar una matriz tabla/operación: eliminar policies/grants de escritura directa administrada exclusivamente por RPC (p.ej. profiles.role, couriers.status, merchants.subscription_stat

**Pruebas futuras:** pgTAP con JWT de admin aal1/aal2, UPDATE directo debe ser denegado; RPC permitida crea audit_log. Mutación que reintroduce UPDATE directo da rojo.


### PR489-H14 — ALTO — admin_notes y backfill no garantizan separación de datos
**Archivo:** `docs/tasks/T-408.md:39`  
**Estado:** [ANÁLISIS] — no se ejecutó explotación contra una BD; el defecto es de especificación futura.

**Diagnóstico / evidencia:** merchants.notes tiene doble escritura (admin_set_subscription y update_my_merchant_profile); con la columna nueva merchants.admin_notes una RLS de filas NO oculta columnas de la propia fila al comercio cuando tiene SELECT de tabla. Tampoco puede inferirse autor de un valor actual de notes solo por su texto; la ficha pide migrarlo «si la escribió el admin».

**Arreglo concreto:** En el CC preferir tabla merchant_admin_notes separada con SELECT/WRITE solo RPC admin y RLS/grants explícitos (o si se elige columna, revocar SELECT de tabla y dar grants de columnas pr

**Pruebas futuras:** pgTAP SELECT y UPDATE como comercio y admin, con DB grants y RPC; en modelo compartido probar notes normal y adminNotes privado. Mutación de GRANT SELECT a comercio falla.


### PR489-H15 — ALTO — La inmutabilidad de auditoría omite revocar TRUNCATE y trigger de defensa
**Archivo:** `docs/tasks/T-408.md:35`  
**Estado:** [ANÁLISIS] — no se ejecutó explotación contra una BD; el defecto es de especificación futura.

**Diagnóstico / evidencia:** T-312 SEC-02 exige policy SELECT, REVOKE INSERT/UPDATE/DELETE/TRUNCATE para anon/authenticated y trigger contra modificaciones; T-408 enumera solo «audit_log solo SELECT» y pgTAP UPDATE/DELETE. Un `TRUNCATE` se autoriza por grant, no pasa por RLS y exige control explícito. La inserción via service_role de viewCourierDocumentAction debe seguir funcionando.

**Arreglo concreto:** Agregar al DoD/apartado seguridad: revocar INSERT, UPDATE, DELETE y TRUNCATE a anon/authenticated, reemplazar policy FOR ALL por SELECT con aal2; trigger anti-UPDATE/DELETE como defensa

**Pruebas futuras:** pgTAP 42501/privilegios para INSERT, UPDATE, DELETE y TRUNCATE; creación por service-role sigue insertando. Mutación GRANT TRUNCATE falla.


### PR489-H16 — MEDIO — La lista de cambios de plan incluye eventos ajenos al plan
**Archivo:** `docs/tasks/T-405.md:69`  
**Estado:** [ANÁLISIS] — no se ejecutó explotación contra una BD; el defecto es de especificación futura.

**Diagnóstico / evidencia:** La query especificada filtra audit_log por target_type=merchant y target_id, pero existen también admin_grant_publication_credits y merchant_profile_update con el mismo target; solo el apartado de «Contratos a leer» menciona admin_set_subscription/admin_register_plan_period sin exigir .in(action) en DoD. Puede mostrar créditos o ediciones de dirección entre los últimos cinco «cambios de plan».

**Arreglo concreto:** Añadir condición `action IN ('admin_set_subscription','admin_register_plan_period')` antes del ORDER BY y LIMIT 5. Probar con eventos intercalados de los dos planes, un grant de crédito

**Pruebas futuras:** Unit con eventos intercalados (planes + créditos + merchant_profile_update) y dos comercios; solo plan muestra, LIMIT tras filtrar action. Mutación que elimina filtro action falla.


### PR489-H17 — MEDIO — La ficha paraguas pide crear hijas fuera de sus archivos permitidos
**Archivo:** `docs/tasks/T-409.md:32`  
**Estado:** [ANÁLISIS] — no se ejecutó explotación contra una BD; el defecto es de especificación futura.

**Diagnóstico / evidencia:** T-409 exige que cada tarea hija tenga ficha, fila del plan e issue y que se abra CC, pero su lista solo permite docs/tasks/T-409.md, plan y log, no nuevas docs/tasks/T-xxx.md ni docs/contracts/CC-xxx.md. No indica procedimiento de PR separado para crear esos artefactos. Si el agente hace exactamente el DoD en la misma rama, viola «Sin cambios fuera de Archivos permitidos».

**Arreglo concreto:** Separar «T-409 inventaría y decide la división» de «hijas/CC se crean en PR/issues separados con fichas propias», o autorizar rutas exactas una vez asignados números y hacer explícito e

**Pruebas futuras:** Test documental tipo verify-fichas: ninguna tarea debe mandar al agente escribir una ruta fuera de permitidos salvo cuando la creación se declare como PR independiente.


### PR489-H18 — BAJO — SEC-12 debe verificarse antes de imponer un CHECK que anule datos reales
**Archivo:** `docs/tasks/T-409.md:24`  
**Estado:** [ANÁLISIS] — no se ejecutó explotación contra una BD; el defecto es de especificación futura.

**Diagnóstico / evidencia:** El hallazgo de T-312 marca SEC-12 como «sospecha», y plantea CHECK que mantiene notes y cash_change_amount en null. Sin aclarar tabla/estado, imponer null puede deshabilitar necesidad de cambio en efectivo y notas legítimas. T-409 sólo menciona SEC-12/CC pendiente, no prueba el flujo real.

**Arreglo concreto:** Anotar expresamente en T-409: capturar Realtime real en Develop con actor permitido/no permitido; distinguir delivery_requests vs delivery_request_contacts y estados, sin PII en logs. E

**Pruebas futuras:** E2E de Realtime con datos artificiales y prueba de flujo legítimo de cambio; no forzar nulos en campos habilitados sin evidencia.


## NO TOCAR
- En PR #489 el agente solo podrá editar `docs/tasks/T-405.md`, `docs/tasks/T-408.md`, `docs/tasks/T-409.md` y `docs/implementation-plan.md` si quiere resolver estos hallazgos. Los cambios productivos, contratos de seguridad, migraciones, pgTAP y E2E corresponden a futuras CC y tareas postlanzamiento.
- `docs/revision-pr/pr-489/**` pertenece al revisor. El autor no debe actualizar `hallazgos.jsonl`, escribir ronda-3 ni marcar verificaciones.
- No alterar `tools/verify-fichas.test.ts`, mover expectativas ni fabricar tests/mutaciones para pasar a verde.
- **Las decisiones D01=C, D02=C y D03=C ya quedaron cerradas en la Ronda 1.** No se piden de nuevo.
- **La aceptación del riesgo para el primer lanzamiento de SEC-01/02/03/10/11 es una decisión previa de Lautaro073**, registrada en PR #491. Esta revisión no la revoca ni declara que los riesgos estén corregidos: requiere que la futura T-408 especifique cómo cerrarlos.
- T-390/T-391 y CC-036 viven en PR #497 (abierta); no declarar dependencias completadas hasta el merge.

## Por qué checks verdes no garantizan esta ronda
`tools/verify-fichas.test.ts` valida que **el primer** DoD coincida literalmente con la sexta celda del plan. No verifica que las políticas de AAL2 impidan UPDATE directo con AAL2, que `admin_notes` no se lea mediante GRANT SELECT de tabla, que `audit_log` sea inmune a TRUNCATE, ni que la query de movimientos filtre acciones y que la ficha paraguas tenga permisos para crear sus hijas. Los tests de la app actual tampoco ejercitan esas futuras tareas.

## Próxima ronda
- Corregir H13–H17 dentro de la documentación autorizada y añadir cautela H18, sin tocar código.
- Mantener DoD del plan estrictamente igual al primer punto de cada ficha, más pruebas/validación `verify-fichas`.
- En ronda 3, revisar SHA nuevo y el diseño final de especificaciones. Sin aprobación/merge en R2.

**Anexos:** [comandos.md](../evidencia/comandos.md), [hallazgos.jsonl](../hallazgos.jsonl).
