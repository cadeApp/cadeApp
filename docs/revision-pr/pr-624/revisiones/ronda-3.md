# PR #624 — revisión independiente, ronda 3

**T-419 / CC-042 · 2026-11-06 · HEAD inspeccionado f727d37fe448e9f838793861c31d2ec81fe68141. Código inspeccionado 41b05270e8bb1dbaa1f263fa3cbffe3eb2faf7a9.**
**Resultado: CON BLOQUEANTES (1: PR624-R03).** H06 continúa parcial hasta E2E RED/GREEN postmigración. No aprobar ni mergear. Sin decisiones 🔵 nuevas: D01=A permanece vigente.

## Estado de PR, alcance y controles

- PR abierta Draft, mergeable=true, rama feat/T-419-vehiculos; base histórica b5ceef11... de develop. develop avanzado a 5a8f6dc5... (contrato CC-046, pr-631, src/ui/sheet), sin rutas superpuestas. No hay merge-tree local (el entorno de esta revisión no tiene clon).
- Se leyó la ficha T-419 de develop, las reglas de entrega, la skill revisar-pr, los archivos de ronda 1 y 2, la bitácora del autor, diff de todos los seis archivos cambiados desde R2 y el nuevo E2E; no se identificó un desvío de archivos permitidos en esta ronda.
- Dos commits desde d88874c6: 41b05270 corrige R01/R02/H07 y f727d37f solo agrega una sección a docs/tasks/log/T-419.md. No hay cambios de código entre 41b05270 y f727d37f. El run del segundo commit, 42268673348, quedó CANCELLED; NO se lo presenta como verde ni se exige un nuevo run por ese único cambio de documentación.
- [Run verde 42266983349](https://github.com/cadeApp/cadeApp/actions/runs/42266983349) contra el SHA exacto 41b05270: jobs unit, lint, audit, build, typecheck, db-tests y bundle-budget exitosos. db-tests: **Files=43, Tests=3582, Result: PASS**; cc042_courier_vehicles.sql ok; tipos generados sin diff. Unit: **196 archivos PASS**. E2E **no ejecutado**, sigue BLOCKED / REQUIRES DEVELOP MIGRATION.
- [#646](https://github.com/cadeApp/cadeApp/pull/646) es mutación RED del autor, cerrada sin mergear. El parche elimina solo submitted_at IS NULL y active_vehicle_id IS NULL del fallback SQL. Run 42266988721, db-tests job 128061359021: **fallan test 180 y test 181 de 184**; es RED real observado en CI, pero no una mutación ejecutada por el revisor. H07: bitácora declara mutación local del comparador viejo (1 failed / 82 passed), restaurado 83/83; no fue ejecutada por el revisor.
- Se ejecutaron nueve sondas estructurales independientes en memoria sobre los textos exactos del head. Confirmaron: helper borra por diferencia de IDs; viejo alta antes de try ya quedó dentro; guard R02 presente; query H07 atraviesa getApplicantDetail y tiene comparador por ID; **nuevo test E2E solo llama restoreSeedVehicle antes de finally y el finally solo elimina archivo histórico, sin comprobar deleteError**. Este instrumento NO reemplaza una prueba funcional en DB.
- No se ejecutó Docker, Supabase, pgTAP independiente, E2E ni tests unitarios locales en worktree. Los GREEN y RED semánticos de código corresponden a CI y al autor, no a reproducción propia. Las pruebas automáticas actuales **no** acreditan seguridad del cleanup del test nuevo cuando falla antes de llamar al helper.

## Seguimiento de hallazgos

| ID | Estado de esta ronda | Evidencia y alcance |
|---|---|---|
| H01 | arreglado-sin-verificar | Cálculo de estados del onboarding y reflejo correcto por lectura, CI verde/RED #641 del autor. |
| H02 | arreglado-sin-verificar | Backfill de bici/pie normaliza espejo, conserva documento; CI verde/RED #642 del autor. |
| H03 | arreglado-sin-verificar | Snapshot original inmutable. R02 corrige la excepción histórica, sin nuevas regresiones por inspección. |
| H04 | arreglado-sin-verificar | Ambas RPC consideran vehicle_id en idempotencia; CI verde/RED #645 del autor. |
| H05 | arreglado-sin-verificar | Documento visible por kind y activo; RED local del autor no repetida. |
| H06 | **parcial** | Los dos helpers usan IDs en vez del tipo y la mutación del test de viaje está dentro del try, pero sigue pendiente RED/GREEN E2E; el nuevo escenario de corte introduce R03. |
| H07 | arreglado-sin-verificar | Nuevo test invoca realmente getApplicantDetail, con dos vehículos del mismo tipo/patente pero distintos IDs, documentos intercalados e histórico; mutación de comparator RED local declarada. |
| R01 | arreglado-sin-verificar | Borrado por IDs calculados contra Set preexistingIds, incluye archivados; pre-try corregido. Pendiente prueba E2E real y nuevo R03. |
| R02 | arreglado-sin-verificar | fallback exige snapshot NULL, submitted_at NULL, active_vehicle_id NULL; pgTAP agrega cinco asserts; RED #646 falló precisamente en 180–181 y GREEN 3582. |

## Bloqueante nuevo: PR624-R03 · ALTO · E2E de regresión deja fixture sucia ante interrupción

**Archivo:** e2e/specs/courier-vehicles.spec.ts, escenario «PR624-R01: la limpieza, cortada con la bici activa y una oferta pendiente» (aproximadamente líneas 190–255).

El nuevo E2E siembra una bici histórica archivada, agrega una bici activa y envía una oferta. En el cuerpo try llama explícitamente a restoreSeedVehicle solo después de todas las operaciones de setup; el finally **solo** ejecuta delete del archivedId y **no** llama a restoreSeedVehicle. Si falla la RPC de oferta, el assert posterior al alta, la obtención del ID o cualquier paso previo a ese llamado de limpieza, Playwright pasa al finally dejando la bici recién creada activa y/o una oferta pendiente. La única limpieza intenta borrar el registro histórico sembrado para probar la preservación, sin comprobar el error del DELETE. El resultado invalida el aislamiento del test de regresión H06 y puede contaminar las pruebas siguientes, precisamente en la situación que declara cubrir.

**Corrección:** hacer el nuevo test también fail-safe. Llevar TODOS sus writes (histórico, bici, oferta) a try/finally; guardar preexistingIds, archivedId, offerId y primaryError en ámbito del finally; invocar restoreSeedVehicle siempre en finally después de todo fallo intermedio (admitir reintento idempotente si ya se llamó en cuerpo), comprobar resultados y luego limpiar solo la fila histórica que el propio test creó. El helper ya corregido puede reutilizarse sin cambiar SQL ni app. Demostrar con fallas intencionales aisladas después de alta y oferta que se restaura moto y se retira pending, y que una bici histórica anterior no desaparece. No dar por ejecutado ese E2E mientras requiera migrate-develop; documentar bloqueo y la tarea manual futura.

La semilla del histórico está hoy fuera del try y el error de borrar archivedId no se comprueba; ambos deben quedar cubiertos. Si el test simula un fallo, asegurar que la prueba de regresión captura ese fallo de forma controlada sin dejar la suite permanentemente roja. No generar falsos resultados.

## Balance de R01, R02 y H07

R01 corrigió el borrado excesivo por tipo: ahora vehicleIdsOfType conserva un Set del estado previo, incluye archivados y en cleanup se usan IDs concretos para la diferencia. El caso de viaje tiene el alta bajo try/finally. No se declara resuelto en ejecución E2E: pendiente postmigración. El nuevo test de interrupción tiene el hallazgo R03, no se atribuye a los helpers existentes un fallo ya corregido.

R02 cumple el predicado acordado, y las nuevas pruebas distinguen histórico compatible de un snapshot NULL con fecha o activo. El mutante #646 demuestra que los tests fallan si se eliminan ambas guardas. CC-043 no se tocó.

H07 cubre por primera vez getApplicantDetail en vez de limitarse al render de pestañas, con oráculo sobre orden de cinco documentos, y RED local declarada con comparación anterior. El agrupamiento actual por vehicle_id queda sin objeción por inspección.

## Decisiones, limitaciones y siguiente acción

**Ninguna decisión 🔵 nueva**. D01=A no se renegocia. El único arreglo de código solicitado en esta ronda es el teardown del E2E nuevo y la bitácora; no se deben tocar contratos, fichas, tipos ni SQL. La ejecución del E2E queda como **tarea manual pendiente tras migrate-develop**, antes de afirmar el DoD completo. No aprobar ni mergear.


## Prompt de corrección para el agente

### Para tu agy — copiá desde acá

Tarea T-419 · PR #624 · rama feat/T-419-vehiculos. Revisar docs/revision-pr/pr-624/revisiones/ronda-3.md y docs/revision-pr/pr-624/hallazgos.jsonl. Primer paso: git pull (sin rebase, amend, force-push ni merge). Decisión D01=A sigue cerrada: snapshot inmutable original. No hay decisiones 🔵 nuevas.

**ÚNICA corrección técnica nueva: PR624-R03 (bloqueante).** El nuevo test E2E de regresión «PR624-R01: la limpieza, cortada con la bici activa y una oferta pendiente...» en e2e/specs/courier-vehicles.spec.ts (~líneas 187–255) simula un caso de interrupción pero NO se limpia él mismo si falla antes del llamado explícito a restoreSeedVehicle. Su finally actual solo ejecuta dbAdmin.from('courier_vehicles').delete().eq('id', archivedId), sin verificar error. Si add_courier_vehicle pasa y luego submit_offer falla o cualquier expect se corta, la bici nueva queda activa; si la oferta fue creada, puede quedar pending. Es exactamente el estado sucio que H06 intentaba impedir.

Arreglo acotado en **e2e/specs/courier-vehicles.spec.ts**:
1. Tomá preexistingBikes (incluyendo archivados) y motoId ANTES de cualquier inserción que sea propiedad de la prueba. Guardá variables de alcance externo al try: archivedId, offerId, primaryError, y el Set preexistingBikes; incluí el archivedId en el Set antes de crear la bici nueva. Si la semilla de bici archivada falla, manejá el error con cleanup también (no insertar fuera de try dejando basura). No borres nunca vehículos preexistentes del seed.
2. Encerrá en try/catch/finally TODAS las mutaciones de esa prueba: inserción de bici archivada, alta de bici activa, oferta pendiente, expectativas y restauración explícita. En finally SIEMPRE invocá restoreSeedVehicle(courierClient, courier.id, motoId, 'bike', preexistingBikes, offerId) cuando se intentó crear algo; hacé esa invocación de nuevo aun cuando la prueba ya la haya hecho en el cuerpo (idempotencia). El helper primero retira oferta pendiente, luego activa moto por RPC y por último elimina SOLO los IDs nuevos del tipo, nunca el histórico.
3. Después del helper, eliminá exclusivamente el archivedId insertado por esta prueba, pero SOLO cuando sea seguro hacerlo. Comprobá de manera explícita el error de delete y el resultado del cleanup; si el helper falla, informar ese error y NO borrar una fila que no se haya podido demostrar que está fuera de uso. Conservá el error principal del test sin ocultarlo, pero reportá todo problema de limpieza; si no hubo error principal, una limpieza fallida debe fallar el test.
4. El propio escenario debe afirmar que el archivedId sigue durante restoreSeedVehicle, que el nuevo ID deja de existir, que la moto queda activa, que la oferta quedó withdrawn si fue creada y que el histórico se borra por ID en el teardown controlado. No uses afirmaciones vacuas con ID undefined o con filas faltantes. Sembrá un documento histórico en la bici archivada si hace falta para que el test sea sensible al borrado accidental y verificá su preservación sin crear datos que no puedas limpiar. No crees archivos nuevos.

**Pruebas y RED obligatorios cuando haya ambiente:** en el mismo spec E2E, cubrir fallo inyectado SOLO en el escenario de prueba justo después de activar bici y justo después de enviar oferta; capturar ese error artificial dentro del test de falla, asegurar finally y comprobar en DB que la moto quedó activa, oferta withdrawn y el histórico intacto antes de limpiar el propio histórico. La mutación REVIEW ONLY / NEVER MERGE que quita el restore del finally debe dar RED real, el código restaurado GREEN. Por ahora E2E sigue BLOCKED / REQUIRES DEVELOP MIGRATION. NO ejecutes E2E contra preview sin migración, no declares RED/GREEN como hechos antes de correrlos; mantené esta dependencia manual señalada.

H01–H05, R01 (borrado por ID), R02 (fallback histórico acotado) y H07 (test query real) no se vuelven a modificar si no encontrás una regresión objetiva adicional. CI del código 41b05270 en run 42266983349 está verde, con pgTAP Files=43 Tests=3582 y tipos sin diff. Commit f727d37f solo documentó bitácora; su CI cancelado NO invalida los checks del código ni obliga a rerun solo por documentación.

Límites de edición: **e2e/specs/courier-vehicles.spec.ts y docs/tasks/log/T-419.md**. NO tocar docs/revision-pr/** (propiedad del revisor), fichas, contratos, SQL, src, tests existentes fuera del spec ni tipos generados. Sin dependencias nuevas, archivos nuevos, mocks tautológicos, falsos positivos, expectativas alteradas para verde, borrado masivo por vehicle_type ni bypass de guards para tests. Scripts en /tmp. No Supabase/Docker local ni workflows manuales. Si no se puede probar sin un archivo nuevo o depende de migrate-develop, anotá el bloqueo y no amplíes el alcance por cuenta propia.

Al cerrar: pnpm typecheck; pnpm lint; pnpm test (log en /tmp); pnpm exec playwright test --list e2e/specs/courier-vehicles.spec.ts e2e/specs/courier-onboarding.spec.ts; node docs/revision-pr/analizar.mjs verificacion; git diff --check origin/develop...HEAD; git diff --name-only origin/develop...HEAD. La ejecución de PostgreSQL es solo por db-tests CI, no levantando Docker/Supabase. En la bitácora: pruebas realmente ejecutadas, pruebas bloqueadas, RED que se pudo o no ejecutar, GREEN, resultado y SHA. NO marcar verificado_en_sha ni escribir docs/revision-pr. Hacé commit Conventional Commits [T-419], push normal, pegá SHA remoto. No aprobar ni mergear.
