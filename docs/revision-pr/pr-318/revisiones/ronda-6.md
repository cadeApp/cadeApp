# Revisión independiente — PR #318 / T-340 — Ronda 6

**Fecha:** 2026-10-12 · **SHA del autor auditado:** `5a6daeed09f82804b4bb0a3ad57ef003ec027aeb` · PR **Draft**, base `develop` `267e9810`, `behind=0` y `mergeable=true` al consultar GitHub. Dos commits de Asako desde la ronda 5; **18 archivos cambiados**. Asako NO editó `docs/revision-pr/pr-318/**`. Sin conflictos advertidos por GitHub.

## Dictamen: CON BLOQUEANTES — NO APROBAR NI MERGEAR

Se resolvieron varios defectos de R5, incluidos los fixtures legacy y la conexión visual de acciones por entrega. **No está completo el Paso 2:** el historial, los listados y el detalle del comercio siguen fabricando valores desde el request padre en vez de consultar las N entregas; el test Playwright de privacidad sigue teniendo verificaciones que pasan cuando la API falla; falta probar el paso completo contenedor→server action para entregar cada drop. El E2E real del nuevo Paso 2 sigue **bloqueado por migración pendiente en Supabase Develop** (no es un RED válido de producto).

## Decisiones de Lautaro073

**NINGUNA NUEVA PENDIENTE.** R4 A, `get_trip_details` → `drops[]`, scalars de respuesta compatibles sin depender de notas/cambio legacy DB; R5 A, modificación de **solo fixtures** de `cc008_trip_details.sql` y `cc023_private_columns.sql` sin tocar aserciones. Las dos siguen vigentes en `docs/tasks/T-340.md` de la rama. Pasos 3/4 a cargo de Kira, **solo tras merge y checkpoint** del Paso 2.

## Reevaluación de hallazgos R5

### H01/H02 — Gate 0: conservan verificación anterior

No se tocó el spec legacy `e2e/specs/t340-legacy-checkpoint.spec.ts` en el delta de R6. Mantener evidencia de rondas 2/3, pero **no sustituye un E2E del nuevo lector de N**.

### H03 — ARREGLADO-VERIFICADO R5

Sin cambios nuevos en el wrapper `callRequestRpc`: `mark_drop_delivered` manda solo `p_drop_id`, `mark_drop_failed` manda `p_drop_id,p_reason`; spy estricto y unit CI existentes. Sin regresión detectada en R6.

### H04 — ARREGLADO-VERIFICADO R6 para la compatibilidad pgTAP y fuentes SQL

La nueva migración `20261012010000_t340_readers.sql` continúa agregando `drops[]` ordenado por `position`, la salida escalar viene del primer drop y **no vuelve a leer** `delivery_requests.notes` / `cash_change_amount`. Asako creó filas child coherentes en los fixtures de `supabase/tests/cc008_trip_details.sql` y `cc023_private_columns.sql`, **sin editar sus aserciones** (el diff de cada archivo agrega únicamente datos). En CI de código `5a6daeed` se ejecutaron enteras las suites legacy, sin los errores `NOT_FOUND` de R5; el bloque pgTAP de T-340 ejecutó y pasó sus 90 asserts originales más **2 assertions reales de más**. La migración SQL no se desplegó manualmente en remoto; la cobertura funcional de N remota queda dentro de H09.

### H05 — PARCIAL; se resolvió N>1 pero el fallback para 1 sin drop sigue fabricando estado

`src/features/offers/queries.ts` y `src/server/live/t204.ts` ahora proyectan atributos del child incluso cuando el parent tiene enums nullable; ambos detectan `dropsResult.error`, N>1 sin hijos o N declarado con cantidad de hijos distinta. Unit tests de esos casos pasan en CI. Correcto y más estricto que la ronda anterior.

**Residual de compatibilidad/integridad:** cuando el padre anuncia 1 drop y la consulta devuelve **cero** hijos, ambos servidores aún fabrican un `PublicDropSummary` desde `delivery_requests.package_type`, `recipient_payment_method`, `needs_change`, `dropoff_zone`; ese resultado puede esconder inconsistencia de datos tras backfill/puente. El Paso 1 ya garantiza 1 child para publicación legacy y el nuevo contrato hace que todos los lectores dependan de los children, no del parent, antes de limpieza legacy. Recomendación técnica: para requests `published`, exigir 1 child real aun si `drops_count=1`; usar fallback solo con **caso histórico respaldado por evidencia y test**, nunca inventar una entrega por defecto. Añadir RED en feed y live para `drops_count=1` y 0 children (versus un legacy 1 child normal).

### H06 — ALTO, SIGUE PARCIAL: historial, listas y detalle merchant no migraron al modelo N

`src/features/requests/queries.ts:211–239` mapea **`dropoff_zone`**, `package_type`, `recipient_payment_method` y `needs_change` desde `delivery_requests`; cuando columnas nullable son `NULL`, **fabrica** `packageType='chico'`, `recipientPaymentMethod='cash'` y `needsChange=false`, ignorando que los hijos pueden tener `grande` / `transfer`. La ronda añadió `drops_count` al `select` de historial, lista y detalle, **pero ningún `from('delivery_request_drops')` en este archivo**, ninguna colección `drops[]` en `MerchantRequestSummary`/`MerchantRequestDetail`, y las UI:
- `src/features/requests/components/merchant-history-view.tsx:196,220`: solo muestran `req.dropoffZoneName` escalar y un `req.packageType`.
- `src/features/requests/components/merchant-requests-list.tsx:144,157`: igual.

`src/features/requests/queries.ts:642–734` (detalle `getMerchantRequestWithOffers`) conserva la misma fuente del padre; solo agrega `dropsCount`, no 3 destinos. Esto es un **bug real de datos** por inspección: con `parent.package_type=NULL` y tres hijos `mediano/grande/chico`, se muestra un `chico` inventado.

**Obligatorio:** definir `MerchantDropSummary[]` público/propietario mínimo ordenado, consultar children por lotes para los requests paginados (sin N+1) en `getMerchantRequestsHistory` y listado activo; en detalle leer children de ese request y contactos privados solo mediante acceso al merchant dueño/RPC aprobada. Mantener compatibilidad escalar **derivada del primer child**, nunca de parent nullable. Representar 1/3 destinos, estados, medios de pago y conteo; no inventar pantalla admin que no existe; inventariar realmente lectores admin operativos. Tests RTL + query con parent null / 3 children dispares y verificación del render.

### H07 — ARREGLADO-VERIFICADO R6: CI completo verde tras corrección mínima del revisor

Asako corrigió la **FK** de `supabase/tests/t340_multi_drop.sql` (request creado antes de offer; luego update matched) y las 13 aserciones finales del test SQL ya se ejecutan. En CI del SHA de autor `5a6daeed`, `db-tests` job `114947979154` produjo:
```text
All 90 subtests passed
... t340_multi_drop.sql (Wstat: 0 Tests: 92 Failed: 2)
Failed tests: 91-92
Bad plan. You planned 90 tests but ran 92.
Files=21, Tests=1995, Result: FAIL
```
Esas 2 no fueron fallos de contrato: **hay 92 assertions efectivas** y pgTAP las consideró fuera del `plan(90)`. **Corrección mínima hecha directamente por el revisor:** cambiar **solo** `select plan(90)`→`select plan(92)` en `supabase/tests/t340_multi_drop.sql`, commit `c1ac1cfa6486813ba948c4b4d122e9dae8d7fdce`. No se eliminó ni cambió ninguna aserción, fixture, SQL de implementación, secret o workflow. CI automático del nuevo SHA: `38296144089`, job `db-tests` `114967582555`. **Verificación independiente REAL:** el job `db-tests` [114967582555](https://github.com/cadeApp/cadeApp/actions/jobs/114967582555) del SHA `c1ac1cfa` terminó `success`; 21 suites SQL, **1995 tests, Result PASS**, incluyendo `cc008_trip_details.sql`, `cc023_private_columns.sql` y `t340_multi_drop.sql`, con **92 aserciones** del archivo T-340. El mismo workflow ejecutó y restauró el control de mutación H15; no se desactivó ninguna aserción. No reescribir historia del test para ocultar fallo.

### H08 — ARREGLADO-VERIFICADO R5

`unit` continúa PASS. En SHA de fix `c1ac1cfa` job `114967582574`: **128/128 Test Files, 2092/2092 Tests PASS**; `rpc-fake.ts` 95,32 % statements / 91,35 % branches (>90 %). Umbrales intactos.

### H09 — ALTO ABIERTO: los oráculos Playwright siguen siendo falsos GREEN posibles

`e2e/specs/multi-drop.spec.ts:159–169` ahora consulta el endpoint real JSON `/api/live/available-requests`, pero **protege todas las aserciones con `if (liveRes.ok())`**. Si el endpoint responde **401, 403 o 500**, ninguna aserción corre y el test puede quedar verde. Tampoco exige encontrar la solicitud propia entre la respuesta ni tres drops públicos. Las aserciones negativas DOM no demuestran privacidad en respuesta JSON.

`e2e/specs/multi-drop.spec.ts:198–212` permite `foreignCourier` opcional y valida `expect(foreignTrip).toBeNull()` sin verificar `foreignErr?.code/message === P0001/UNAUTHORIZED_ACTOR`; una RPC inexistente/timeout/unauthorized previo erróneo también devolvería `data=null` y aparentaría cumplir privacidad. Además, `zone2=dbZones?.[1]?.id ?? zone1` y `zone3=...??zone1` **no garantizan zonas distintas**; el test debe crear zonas controladas por el fixture o documentar la limitación sin atribuirse esa cobertura. `admin.from('delivery_request_drops').delete` tampoco comprueba `error`. Falta RED→GREEN real y registro de jobs para propiedades nuevas.

**Test seguro recomendado:** `expect(liveRes.status()).toBe(200)`; parsear `await liveRes.json()`, validar con `liveFeedResponseSchema`, localizar request por `requestId` y exigir `dropsCount===3`, posiciones/zona/tipo/pago y ausencia recursiva de PII en el JSON de ESE request. Para tercer actor, `expect(foreignCourier).toBeDefined()`, `expect(foreignTrip).toBeNull()` y **comprobar `foreignErr.code==='P0001'` y `foreignErr.message==='UNAUTHORIZED_ACTOR'`** (o formato RPC real). Pruebas negativas de oráculo unitarias/fixture que den RED si API es 500 o si el error es `PGRST202` en vez del esperado. El spec no debe tocar escritor multi-drop del Paso 4.

**Límite de entorno importante:** el `e2e-preview` del SHA `5a6daeed` marcó status `error: BLOCKED / REQUIRES DEVELOP MIGRATION` run `38295234609`. Workflow `e2e-preview.yml` apunta Preview a Supabase Develop; `migrate.yml` instala migraciones al mergear a Develop. **No exigir GREEN imposible del lector nuevo en backend remoto viejo ni permitir `db push` manual en Develop.** La revisión de código/CI efímero debe cerrarse premerge; E2E nuevo queda como **checkpoint post-migración pendiente** y, hasta entonces, no declarar el rollout completado ni empezar Paso 3 de Kira. La estrategia exacta de habilitación de merge/checkpoint se discutirá cuando no queden bloqueantes de código.

### H10 — PARCIAL: interfaz y cableado de drop entregado/fallido presentes, falta prueba de integración del contenedor

`src/features/trips/components/trip-courier-container.tsx:54–76` invoca ya `markDropDeliveredAction({requestId:trip.id,dropId})` y `markDropFailedAction({requestId:trip.id,dropId,reason})`; `TripCourierView` muestra botones `Entregada` / `No se pudo entregar` **solo a drops pending cuando `in_transit` y N>1**, suprime botón legacy global N y deja retiro + 1 drop legacy. El diálogo usa validación local de motivo y la acción server conserva su schema. **Buena corrección de la lógica de R5.**

Pero los cuatro nuevos tests de `src/features/trips/components.test.tsx:456–526` solo montan `TripCourierView` con **callbacks simulados**, sin montar `TripCourierContainer` ni espiar `markDropDeliveredAction/markDropFailedAction`. El cableado real contenedor→server action puede dejar de existir y esos tests quedar verdes. **Prueba adicional requerida:** RTL con contenedor y mocks de actions/navegación, clicar el botón de drop2 y afirmar `markDropDeliveredAction({requestId,dropId:d2})` exactamente una vez, `markTripDeliveredAction` nunca para N; para drop3 motivo válido, exacto `markDropFailedAction`; reason blanco jamás invoca; éxito hace `router.refresh`; falla muestra toast; 1 legacy conserva `markTripDeliveredAction`. RED por mutar en memoria mock dispatch a `markTripDeliveredAction` o desactivar callback; GREEN normal. Esto es prueba faltante, **no afirmación de fallo productivo**.

## Comprobaciones independientes y límite

- **CI del autor `5a6daeed`:** typecheck, lint, build, unit, audit, bundle-budget PASS, `db-tests` FAIL únicamente por desajuste de plan pgTAP `90/92`; Vercel SUCCESS, `e2e-preview=error` por migración pendiente; approval-policy FAIL.
- **CI del fix mínimo del revisor `c1ac1cfa`:** typecheck/lint/build/audit/bundle-budget y unit PASS (2092 tests), **db-tests PASS (21 suites/1995 tests)**. `approval-policy` continúa FAIL por política/revisión; E2E status de implementación anterior indica `BLOCKED / REQUIRES DEVELOP MIGRATION` y no está verde.
- **Sonda propia, realmente ejecutada en memoria contra blobs exactos de GitHub del SHA del autor:** **6/6 detectores estructurales** positivos de H06 historia/lista, H09 HTTP/actor y H10 falta de test de contenedor; cada detector invirtió resultado con una **mutación de texto en memoria** (sin tocar branch ni SQL). Esta sonda NO representa RED Playwright ni prueba ejecución de los nuevos flujos. Harness y limitaciones en `evidencia/comandos.md`.
- **No se ejecutaron** Docker/Supabase local, Playwright real, SQL remoto ni dispatch manual de workflows por el revisor. Todas las afirmaciones de ejecución están vinculadas a GitHub Actions.
- Los cambios de esta ronda del revisor son **1 línea en pgTAP** y la carpeta `docs/revision-pr/pr-318/**` solamente.

## Informe revisar-pr

Informe revisar-pr — T-340 / PR #318 — 2026-10-12 — revisión independiente, ronda 6.

**Resultado: CON BLOQUEANTES (H06, H09; residuos de H05/H10).** H01/H02/H03/H08 siguen verificados. H04 verificado por CI de fixtures legacy. H07: **arreglado-verificado** por `db-tests` job `114967582555` del SHA `c1ac1cfa` (21 files, 1995 tests PASS). **No hay decisiones de producto nuevas.**

**Pruebas y checks:** typecheck/lint/build/unit/audit/bundle-budget PASS; `db-tests` rojo por desajuste 90 vs 92 en SHA autor, corregido 1 línea y **GREEN** en SHA `c1ac1cfa` (1995 tests); E2E Preview bloqueado por migración remota no aplicada; approval-policy FAIL. Checks locales de revisor: n.e. (sin clone/Supabase). Sonda in-memory estructural: ejecutada, 6/6 detectores y 6/6 inversiones; no es runtime del producto.

**Asako debe completar** mappers e historial N, eliminar falsos fallback de hijos, hacer asserts E2E fail-closed para HTTP y actor, añadir test real de contenedor y registrar RED→GREEN verificable en bitácora. No modificar `docs/revision-pr/**`, ficha, CC o migraciones desplegadas. Mantener PR Draft. **No aprobar, no mergear, no comenzar Paso 3 de Kira.**
