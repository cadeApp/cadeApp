# PR #624 — revisión independiente · ronda 2

**T-419 / CC-042 · 2026-11-06 · SHA revisado: 67df8e87bb33296be402c4295451b594a0c3e7a8**
**Resultado: CON BLOQUEANTES (2: PR624-R01 y PR624-R02), y una mejora parcial (H07).**
No aprobar ni mergear. D01=A permanece resuelta por Lautaro073; no hay nueva decisión 🔵.

## Estado y controles

La comparación R1→R2 consta de dos commits de correcciones (97eb3288 y 67df8e87) sobre el commit de revisión R1 00aecd9f. develop avanzó un commit a 5a8f6dc5 (CC-046 y cambios en sheet / revisión pr-631). No hay nombres de archivos solapados entre ese commit de develop y los 52 archivos modificados por el PR; GitHub reporta mergeable=true, sin ejecución de git merge-tree local.

La ficha T-419 fue leída desde develop. La ampliación src/types/database.types.ts **está expresamente permitida** y corresponde a las dos columnas application_vehicle_type y application_vehicle_plate. En la ejecución actual del CI pasó la comparación de tipos generados: no es desvío de alcance. La carpeta de ronda 1 permaneció intacta y el autor registró su trabajo en docs/tasks/log/T-419.md.

CI del SHA exacto: run https://github.com/cadeApp/cadeApp/actions/runs/42262625810. Todos los jobs (typecheck, lint, unit, db-tests, build, audit y bundle-budget) están successful. db-tests: **Files=43, Tests=3577, Result: PASS**, incluido cc042_courier_vehicles.sql y comprobación de tipos. Unit: 196 archivos pasaron. El run 42260809564 anterior tenía pgTAP 3577 PASS pero terminó con diff de tipos: corregido en el head actual. Los FAIL intermedios del job de base son de mutaciones intencionales restauradas: no son el resultado final.

E2E sigue BLOCKED / REQUIRES DEVELOP MIGRATION. No se corrieron E2E, Supabase/Docker local ni workflows manuales, y no se verificó ejecución real de los casos de cleanup. Tampoco se corrieron suites propias en un worktree local; los resultados semánticos RED/GREEN son del autor. Esta revisión **sí** leyó personalmente los parches exactos de las PR #641–#645 (cerradas sin merge) y sus logs de CI, además de ejecutar cuatro sondas estáticas propias sobre código del SHA. No se confunden las sondas estructurales con una prueba PostgreSQL/Playwright.

## H01–H07, uno por uno

- **H01 — arreglado-sin-verificar:** finalize calcula licencia y seguro desde documentos actuales por vehículo, enlaza los documentos y sincroniza reflejo. El mutante #641 recupera el reflejo antiguo y elimina sync: fallo pgTAP tests 161–162 de 179. GREEN actual 3577. No reproducido por el revisor.
- **H02 — arreglado-sin-verificar:** backfill pone a none licencia/seguro del reflejo para bike/walk y conserva históricos. Mutante #642 elimina la limpieza: falló test 35 de 179. GREEN actual. No reproducido por el revisor.
- **H03 — arreglado-sin-verificar con residual R02:** snapshot application_vehicle_type/plate, backfill antes de crear activo, trigger de inmutabilidad y policy con columnas congeladas; reintento normal compara snapshot. Mutante #643 fuerza comparación contra reflejo y aborta en la línea 509 con INVALID_STATE_TRANSITION (164 pruebas corridas). Mutante #644 elimina guarda snapshot y fallan tests 173–176. El fallback para snapshot NULL necesita límite más estrecho.
- **H04 — arreglado-sin-verificar:** ambas RPC incorporaron vehicle_id en rama de idempotencyKey. Mutante #645 quita comparación y fallan tests 133 y 136. GREEN actual.
- **H05 — arreglado-sin-verificar:** helper de queries y perfil ahora distinguen DNI/selfie/avatar de licencia/seguro por vehículo activo y caso previo a activo. Tests nuevos cubren matriz; RED 3 fallidas de 36 declarado por autor, no repetido por el revisor.
- **H06 — parcial / bloqueante cubierto por R01:** helper intenta retirar oferta y restaurar moto por RPC, avance correcto, pero borra por tipo sin ID exacto y otro spec muta antes de try/finally. RED E2E pendiente.
- **H07 — parcial / mejora:** la query usa vehicle_id para ordenar; el test agregado solo cuenta dos pestañas de un mock directo en ApplicantDetailView: no visita getApplicantDetail ni verifica la agrupación. Falta RED y aserción que distinga el comparador antiguo del nuevo.

## Bloqueantes

### PR624-R01 — ALTO · cleanup E2E afecta vehículos históricos

En e2e/specs/courier-vehicles.spec.ts, líneas 46–51, y e2e/specs/courier-onboarding.spec.ts, líneas 233–238, restoreSeedVehicle usa DELETE sobre courier_id + vehicle_type, sin restringir al ID creado ni excluir archivados. Puede borrar un vehículo histórico del mismo tipo ajeno al test, o fallar por su FK de documentos. En el caso E2E de viaje, líneas 1514–1529, se agrega el auto y se ejecuta una aserción **antes** de try/finally; un fallo entre esos pasos filtra fixture. Estos dos hechos se comprobaron por inspección y sonda estática, no por ejecución E2E.

**Arreglo:** snapshot inicial de IDs, descubrir/capturar ID creado, cleanup exclusivamente de ese ID, retirar oferta, restaurar moto y cubrir toda mutación bajo try/finally. Probar histórico archivado preexistente y fallos intermedios. La ausencia de RED de H06 se mantiene declarada hasta disponer de E2E post migrate-develop.

### PR624-R02 — MEDIO · fallback de snapshot nulo no asegura histórico inmutable

En supabase/migrations/20261106120000_cc042_courier_vehicles.sql, líneas 1664–1670, cuando application_vehicle_type IS NULL se compara el pedido con couriers.vehicle_type/plate, sin limitarlo a submitted_at NULL ni active_vehicle_id NULL. El caso histórico excepcional de CC-043 (cc043_courier_application.sql líneas 229–241) sí necesita compatibilidad, pero después de activar otro vehículo el reflejo ya es mutable y no representa necesariamente la postulación. No se afirma que el flujo normal cree filas sin snapshot: finalize y backfill lo escriben. El riesgo afecta el caso excepcional introducido como ampliación y una posible reparación/importación futura.

**Arreglo:** aplicar fallback únicamente a snapshot NULL + submitted_at NULL + active_vehicle_id NULL; cualquier otro NULL rechaza INVALID_STATE_TRANSITION sin cambios. Cubrir caso histórico sin activo y caso posterior al switch, y mutación RED eliminando el nuevo predicado. No renegociar D01=A.

## Mejora parcial H07

La ordenación actual por vehicle_id es sólida. Pero el test PR624-H07 en applicant-detail-view.test.tsx renderiza un objeto ApplicantDetail construido directamente y solo cuenta dos tabs. Un cambio de producción en getApplicantDetail que restituya tipo+patente dejaría la prueba verde. Agregar prueba en el archivo existente src/features/admin/queries.test.ts que ejecute getApplicantDetail con dos vehículos de igual tipo/patente e IDs distintos y cuatro docs de fechas intercaladas, asertando secuencia exacta por vehículo. Ejecutar mutación del comparador viejo: RED. Con vehicle_id: GREEN.

## Evidencia y decisiones

La misma observación hecha en R1 sobre tipos estaba superada: el archivo src/types/database.types.ts sí está permitido por la ficha de develop y requerido por los tipos generados. Se acepta. Las PR mutantes #641–#645 son evidencia del agente **verificada en sus parches/logs**, no reproducción independiente; por eso H01–H05 conservan estado arreglado-sin-verificar con verificado_en_sha NULL.

No hay decisión 🔵 adicional. D01=A sigue vigente. La compatibilidad del caso histórico se puede conservar sin permitir que el vehículo activo cambiante reemplace la identidad histórica. La ronda 1 se conserva intacta.


## Prompt de corrección

### Para tu agy — copiá desde acá

Tarea: T-419 · PR #624 · rama feat/T-419-vehiculos.
0. git pull (trae el commit documental de la ronda 2). SIN rebase, amend, force-push ni merge. Leer docs/revision-pr/pr-624/revisiones/ronda-2.md y las entradas H06/H07/R01/R02 de hallazgos.jsonl. D01=A sigue firme. No hay decisiones 🔵 nuevas.

Podés tocar SOLO los archivos existentes:
- e2e/specs/courier-vehicles.spec.ts
- e2e/specs/courier-onboarding.spec.ts
- supabase/migrations/20261106120000_cc042_courier_vehicles.sql
- supabase/tests/cc042_courier_vehicles.sql
- src/features/admin/queries.test.ts
- src/features/admin/components/applicant-detail-view.test.tsx (solo expectativas de la mejora)
- docs/tasks/log/T-419.md

Prohibido tocar: docs/revision-pr/**, docs/tasks/T-419.md, docs/contracts/**, docs/implementation-plan.md, docs/master-plan.md, src/types/database.types.ts (ya coincide con CI) y todo lo demás. No archivos nuevos, dependencias nuevas, tests falsos o adulterados para verde, mocks que no recorran producción, ni condiciones para test dentro de producción. Scripts temporales en /tmp. No levantar Supabase/Docker local, no tocar .env, secretos, datos privados, entornos remotos o workflows manualmente.

1. PR624-H06 + PR624-R01 — limpieza E2E por identidad, nunca por tipo. Los dos restoreSeedVehicle hacen DELETE por courier_id+vehicle_type y pueden alcanzar otro vehículo histórico archivado del seed. Guardar ANTES del test un conjunto de IDs previos del tipo (incluidos archivados). En alta por RPC guardar el vehicleId devuelto; en alta por UI recuperar el único ID nuevo por diferencia del conjunto de IDs, incluso si el render posterior falla. Una vez retirada la oferta pendiente y restaurada la moto con set_active_courier_vehicle de sesión, borrar por ID exacto nuevo; nunca hacer DELETE masivo por tipo. El spec e2e/specs/courier-onboarding.spec.ts tiene un alta de auto y un expect ANTES del try: meter ambas operaciones y lectura posterior DENTRO de try/finally para garantizar limpieza si falla el seed o el primer assert. El helper solo puede borrar lo creado en ese test. Conservar el error primario si también falla cleanup, y reportar el problema residual.

Pruebas E2E exigidas: fixture con un vehículo del MISMO tipo ya archivado y documento histórico, además del vehículo nuevo; después del cleanup el histórico debe seguir, el nuevo debe desaparecer y la moto inicial debe seguir activa. Cubrir éxito, fallo justo tras alta, fallo tras activar bici y fallo tras crear oferta antes de retirarla; oferta retirada por RPC cuando existe. No borrar activo si un viaje impide restaurar. RED: mutar únicamente filtro por ID a filtro por vehicle_type en REVIEW ONLY/NEVER MERGE y comprobar el fallo de prueba de histórico; restaurar y GREEN. El E2E real sigue BLOCKED / REQUIRES DEVELOP MIGRATION hasta migrate-develop. Si no se puede ejecutar, registrar RED/GREEN pendiente, sin inventarlos.

2. PR624-R02 — acotar fallback histórico del snapshot NULL en public.finalize_courier_application. Para application_vehicle_type != NULL siempre comparar tipo/patente con snapshot, como D01=A. Para snapshot NULL admitir fallback a couriers.vehicle_type/plate SOLO cuando submitted_at IS NULL y active_vehicle_id IS NULL (histórico extraordinario de CC-043). En cualquier otro estado con snapshot NULL, INVALID_STATE_TRANSITION sin mutaciones; jamás dar éxito basándose en el vehículo activo mutable después de un cambio de activo. Mantener el pgTAP anterior cc043_courier_application.sql intacto.
Prueba nueva en supabase/tests/cc042_courier_vehicles.sql: fixture enviado fuera de finalize DESPUÉS del backfill con snapshot null, submitted_at null y sin activo; reintento idéntico devuelve idempotent=true y fecha sigue null. Activar otro vehículo por add_courier_vehicle y reintentar usando el nuevo activo: INVALID_STATE_TRANSITION, activo/fecha/snapshot intactos. Probar snapshot NULL + submitted_at no null: nunca idempotente. Con snapshot presente conservar (moto → bici → reintento original OK) incluso tras cambio de patente. RED: eliminar en memoria el nuevo guard de fecha/activo y correr el mismo pgTAP: tiene que fallar; restaurar GREEN por db-tests en CI.

3. PR624-H07 — test de query que detecte mutación. El código src/features/admin/queries.ts ya ordena por vehicle_id y NO requiere modificación. La prueba nueva en ApplicantDetailView solo cuenta dos tabs, y seguiría verde si el query vuelve a agrupar por tipo+patente. Agregar en src/features/admin/queries.test.ts (archivo existente) un test que realmente llame a getApplicantDetail con cuatro documentos vigentes intercalados por fecha: vehículo A y vehículo B distintos por vehicle_id pero mismo tipo y patente, licencia y seguro para ambos. Comprobar orden EXACTO de IDs/documentos con ambos de A juntos y ambos de B juntos, según el comparador real. Mantener prioridad de is_current sobre histórico. Mockear la consulta Supabase que utiliza getApplicantDetail, no un comparador duplicado ni un fake que no pase por código de producción. RED: mutar temporalmente el vehicleKey real a tipo+patente; el nuevo test de query debe fallar. Restaurar vehicle_id → GREEN. El test de dos pestañas puede quedar como validación de etiqueta, no como prueba de agrupación.

Cierre: Registrar en docs/tasks/log/T-419.md qué cambió, qué prueba y mutación RED real se ejecutó, GREEN y qué sigue pendiente; NO escribir "verificado". Correr pnpm typecheck; pnpm lint; pnpm exec vitest run src/features/admin/queries.test.ts; pnpm test (salida larga en /tmp); pnpm exec playwright test --list e2e/specs/courier-vehicles.spec.ts e2e/specs/courier-onboarding.spec.ts; node docs/revision-pr/analizar.mjs verificacion; git diff --check origin/develop...HEAD. Base SQL solo a través del job db-tests CI: verificar SHA, Files, Tests, Result y comparación de tipos; NO levantar Docker/Supabase ni disparar workflows manualmente. No exigir otro CI verde solo por bitácora. Commit Conventional Commits [T-419], push normal y pegar git ls-remote origin feat/T-419-vehiculos. NO MERGE.
