# Informe revisar-pr — T-388 — PR #477 — 2026-10-21
Revisión independiente (ChatGPT). SHA: 620d92c04a95ebdee8e8c28f9f798c2a4e39bdc5. Base develop: 214404e0a2baca7ba7e4c87c35ef78c3de3d2109.
**Resultado: CON BLOQUEANTES (2).**

## Revisado
Leídos COMO-ENTREGAR, README, skill, lecciones históricas, ficha T-388 desde develop, bitácora, comentarios y 17 patches. Los 17 archivos cumplen «Archivos permitidos». La rama está 4 commits adelante y 0 atrás; GitHub marca mergeable. Sin clon local para ejecutar merge-tree.

Las consultas de feed, Mis ofertas, live, lista, historial y detalle de comercio seleccionan route_distance_m. El formateador común distingue null de 0. Las lecturas por drop siguen en approx_distance_m. El grant CC-023 y la escritura de route_distance_m de la migración T-369 fueron cotejados. Sin defectos funcionales nuevos demostrados en inspección.

## BLOQUEANTE PR477-H01 · El test no observa el .select() real
**Rutas:** src/features/requests/queries.test.ts:2983 y src/server/live/t204.test.ts:1353.

El primer test lee el archivo con readFileSync y busca select() por regex; el segundo toma un slice textual. Ninguno de esos tests nuevos invoca los tres lectores del comercio o getAvailableRequestsLiveServer ni recibe el argumento realmente pasado a Supabase. El DoD de T-388 exige verificar la proyección real del cliente en cada lector.

**Arreglo exigido:** reemplazar los tests estáticos por pruebas con un mock que registre el argumento de .select() sobre delivery_requests. Invocar individualmente getMerchantHistoryRequests, getMerchantRequests, getMerchantRequestWithOffers y getAvailableRequestsLiveServer. Para cada función, exigir route_distance_m presente y approx_distance_m ausente en esa tabla, sin prohibir approx_distance_m de delivery_request_drops. Usar un fixture fiel (route_distance_m=3500, approx_distance_m=null) y afirmar mapping donde corresponda.

**Prueba RED:** mutar por separado el campo proyectado en cada una de las cuatro funciones, mostrar un test rojo por aserción y restaurar; luego GREEN sin mutaciones.

## BLOQUEANTE PR477-H02 · La etiqueta no se prueba en el DOM
**Ruta:** src/features/requests/components/merchant-requests-list.test.tsx:874.

Solo busca una expresión fuente con regex y prueba approxDistanceLabel en forma aislada. No monta MerchantRequestsList. Dejar la expresión como comentario JSX y mostrar req.approxDistanceKm crudo preserva el regex verde mientras el usuario pierde «≈».

**Arreglo exigido:** utilizar Testing Library render + screen, disponibles en el test, con tres MerchantRequestSummary y MerchantMetrics; exigir textos visibles exactos «≈ 3,5 km», «Menos de 0,5 km» y «Distancia no calculada».

**Prueba RED:** sustituir temporalmente el JSX por el string crudo, demostrar rojo del test DOM y restaurar para GREEN.

## Pruebas y pendientes
No se corrieron Vitest/typecheck/lint localmente: el contenedor no tiene clon, pnpm ni salida git a github.com. Los RED/GREEN y M1–M5 de la bitácora son afirmaciones del autor, no reproducciones independientes. Al observar estado CI del SHA, unit, lint, typecheck y build estaban en success; db-tests en progreso; approval-policy en fail y E2E Preview no confirmado. No se acredita CI por existir bloqueantes.

El body dice que la evidencia de E2E del Preview figura en bitácora, pero la entrada consultada dice «pendiente»: debe conciliarse y aportarse resultado auténtico antes de merge.

## Decisiones
Ninguna nueva. «Mis ofertas muestra distancia» y «0 m = Menos de 0,5 km» ya quedaron fijadas en T-388 desde PR #475. No aprobar ni mergear hasta la ronda 2.
