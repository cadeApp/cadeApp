# Revisión independiente — PR #376 / CC-025 Fase B — Ronda 1

**Fecha:** 2026-10-15 · **PR:** https://github.com/cadeApp/cadeApp/pull/376 · **Rama:** `fix/CC-025-onboarding-compatible` · **SHA funcional auditado:** `680b1accd134fbcbcf33ae87fd0478c13dc9a5a2`.

## Dictamen: CON BLOQUEANTES (3) — NO APROBAR NI MERGEAR

**Resumen técnico:** la sustitución de `.upsert()` por `.insert()` es real, el esquema expansivo de PR #374 ya está mergeado, hay tests unitarios nuevos y CI verde sobre el SHA. La nueva detección de duplicados es mejor que usar un Map que los oculta. **Sin embargo**, los checks no cubren una carrera viable entre dos peticiones reales con **rutas distintas**, el reintento inicial acepta un documento `rejected` con path idéntico, y la post-verificación posterior a INSERT sólo cuenta filas sin validar estados/paths.

**Decisiones previas confirmadas:** 1C, 2C, 3B, 4C; retención B (30 días desde reemplazo); rollout A (Expand→App→Contract). No modificar producto ni ejecutar fase C. **Una decisión técnica adicional de alcance queda pendiente** para H01: si se permite una RPC transaccional ADITIVA durante la fase B. No inventar autorización: los cambios de RLS/RPC requieren trámite de contrato.

## PR376-H01 — ALTO: la post-verificación no elimina una carrera con rutas distintas

**Producción:** `src/features/courier-onboarding/actions.ts:182–217, 284–324`. **Modelo real:** `supabase/migrations/20260922031435_schema_v1.sql` declara `storage_path text NOT NULL UNIQUE`, pero el conjunto `(courier_id,kind)` no tiene índice único hasta la **fase C**. La migración expansiva `20261015153311_cc025_expand_courier_documents.sql` añade columnas y CHECK, no unicidad por kind.

**Interleaving válido:** A y B (mismo courier, `dni_front`, pero **storage_path diferente**) leen cero documentos. A inserta 4 filas y hace commit; A ejecuta post-SELECT (ve sus 4) y devuelve éxito/actualiza courier; **después** B inserta otras 4 con paths distintos, también sin violar `UNIQUE(storage_path)`; B post-SELECT observa 2 por kind y devuelve INTERNAL_ERROR. **Resultado**: A ya marcó el onboarding como completo y DB conserva dos `is_current=true` por kind. Si las postlecturas caen antes de que el otro commit aparezca, incluso ambos podrían devolver éxito. La lectura posterior **no es un lock/constraint** y no retira duplicados ya insertados. No se ejecutaron dos conexiones PostgREST reales por este revisor; el escenario es una consecuencia de la secuencia de statements y del esquema inspeccionado.

**Instrumento engañoso:** `actions.test.ts:1805-1885` titula el caso n "dos envíos simultáneos", pero sólo invoca `courierOnboardingAction` **una vez**; simula duplicados de los mismos paths, algo imposible en la DB real con `storage_path UNIQUE`. Este test protege la detección de un snapshot duplicado, **no** la carrera que pretende garantizar.

**Solución técnica recomendada:** una operación atómica de alta inicial por repartidor (RPC ADITIVA para la fase B / pequeña etapa B0 autorizada), bloqueando fila `couriers(profile_id) FOR UPDATE`, consultando todos los `courier_documents` vigentes, rechazando duplicados/paths o status incompatibles y creando el lote en **una sola transacción**, con check `auth.uid()` y rol courier y SEARCH_PATH fijo, permisos mínimos. Debe preservar writer previo mientras se publica; no añadir de golpe RLS/revocación/índice de fase C. Dos peticiones con paths distintos deben producir un solo lote y un error seguro para la otra; mismos paths deben converger idempotentemente; nunca terminar con dos current por kind. **Requiere autorización del usuario** para agregar RPC/migración aditiva a B y revisión de contrato, no implementarla silenciosamente. Alternativa index/unique anticipado requiere backfill/limpieza y altera la fase C; la opción sólo frontend o post-SELECT no ofrece atomicidad. Ver opciones completas al final.

**RED→GREEN esperado:** runner verdadero de dos sesiones o requests HTTP con barreras (no sleeps), DB efímera con migración A pero **sin C**, actor `authenticated`, escenarios paths iguales/distintos, ambos `INSERT` válidos bajo viejas policies y test de unicidad/current + finalización de courier. Una mutación de producción que quite `FOR UPDATE` de la RPC o el guard del mismo kind debe producir RED real con mismas aserciones; restauración GREEN. La suite Vitest puede complementar, **no sustituye** test concurrente DB.

## PR376-H02 — ALTO: se permite idempotencia de documento `rejected`

**Producción:** `actions.ts:204–212` sólo compara `storage_path` cuando hay un kind vigente. No comprueba `existing.status` antes de considerar el documento satisfecho; a diferencia del recovery `actions.ts:271–279`, que sí exige `submitted` o `verified`. Por tanto un `rejected` con idéntico path pasa por la rama de reintento y `couriers.update` marca el onboarding como completado. **No es autoaprobación administrativa**, pero se registra como onboarding exitoso pese a requerir corrección documental.

**Fix acotado:** comprobar de forma explícita `existing.status === 'submitted' || existing.status === 'verified'` también en primer SELECT y en la post-verificación; `rejected`, `none`, valores desconocidos => error seguro, sin INSERT de reemplazo ni `couriers.update`. No cambiar estado admin. **Test RED** actual nuevo: 4 paths coincidentes, uno `rejected`, asegurar `ok:false`, sin escritura/actualización; debe fallar contra el código actual; **GREEN** con guard, mismo test.

## PR376-H03 — MEDIO: post-INSERT no valida resultados exactos

**Producción:** `actions.ts:289–309` relee pero únicamente cuenta duplicados. Si entre el SELECT inicial y la postlectura el admin cambia el status de uno ya existente a `rejected`, puede haber una sola fila por kind y aun así devolverse éxito. También faltan las aserciones `storage_path === entrada` y `status` permitido tras el INSERT exitoso, que la rama de recovery 42501 ya hace.

**Fix:** factorizar una función pura `validateCurrentDocumentSet(expectedEntries, docs)` para clasificar `match` / `missing` / `duplicate` / `different_path` / `invalid_status`, y usarla tanto en lectura inicial, relectura 23505/42501 y postverificación; no aceptar estado rechazado. Mantener la distinción entre reintento `same path` y nuevo documento `different path` para errores seguros. **Test RED→GREEN:** primer SELECT válido con 3 docs, INSERT del cuarto devuelve éxito, postSELECT trae los 4 con uno previo cambiado a `rejected` o path distinto; `couriers.update` NO ocurre. Mutación de producción que omita validación de postlectura => RED con mismo test. No usar un mock que siempre devuelve el estado deseado.

## CI comprobado, alcance y limitaciones

[Run 38792087496](https://github.com/cadeApp/cadeApp/actions/runs/38792087496) sobre SHA `680b1accd134fbcbcf33ae87fd0478c13dc9a5a2`: lint, typecheck, unit, build, audit, db-tests, bundle-budget SUCCESS. Log unit: **133 suites / 2377 tests PASS**. db-tests: **24 archivos / 2283 pgTAP PASS**. Las pruebas de concurrencia reales de DB en ese job corresponden a **T-340/CC-024/CC-026**; no se incorporó un runner de dos sesiones del writer fase B. `approval-policy` aparece verde para HEAD actual; el cuerpo del PR afirma **2374** tests, que no coincide con el log real **2377** (mejora de documentación, no gate). No hay cambio de migraciones/RLS/CI en la PR B; diff sólo en `actions.ts`, `actions.test.ts`, contrato y bitácora. Rama con compare ahead 3 / behind 0 frente a develop al revisar, mergeability mecánica true.

**No ejecuté Docker, Supabase local ni remoto**; inspeccioné fuente de los SHAs y logs CI. No afirmar reproducción viva del interleaving; estas tres fallas se clasifican **por análisis** y esperan tests que lo confirmen. No fabriqué ni adulteré tests y NO se marcaron como verificados. No aprobaciones ni merge.

## Decisión pendiente — arquitectura de serialización para fase B

- **Opción A — Recomendada: RPC de alta atómica ADITIVA entre A y C (B0).** Beneficios: transacción/row lock real, no deja huérfanos, pruebas multisesión y autorización centralizada; mantiene compatible la DB expandida con la app vieja. Inconvenientes: una pequeña migración adicional con timestamp/PR ordenado, cambio de alcance de fase B y contrato, SECURITY DEFINER cuidadosamente auditada si es imprescindible. Riesgo: liberar RPC a actores incorrectos si no se prueba auth/privilegios.
- **Opción B: adelantar backfill e índice parcial de unicidad a fase B.** Beneficios: invariant de unicidad garantizado por PostgreSQL, menos lógica especial de RPC. Inconvenientes: exige resolver históricos y política de reemplazos antes de fase C; puede afectar writer antiguo, despliegue, índices y rollbacks. Riesgo: romper la secuencia Expand/App/Contract que se eligió, sin análisis de filas duplicadas preexistentes.
- **Alternativa C: aceptar post-SELECT como mitigación hasta C.** Beneficio: sin nueva migración. Inconvenientes: **no garantiza** unicidad ni ausencia de finalización prematura; en presencia de dos paths distintos las duplicaciones pueden persistir. Desaconsejada para el DoD acordado.
- **Recomendación:** A; permite una fase B segura antes del contract final sin adelantar backfill/RLS/índice, si se acompaña de control de permisos, migración aditiva y test dual-session. No recomendar B por su impacto temprano en históricos; no recomendar C porque falla el invariante. Falta confirmar si la autorización de fase B incluye una pequeña RPC B0. El revisor **no la creó**.

**Acción manual del usuario:** elegir si autoriza A (B0) o prefiere B (rediseñar etapas). Si no autoriza ninguna ampliación, H01 permanece bloqueante y no se mergea B.

## Archivos de revisión

`README.md`, `revisiones/ronda-1.md`, `hallazgos.jsonl`, `evidencia/comandos.md`, `lecciones.md`, `prompt-agy.md`.