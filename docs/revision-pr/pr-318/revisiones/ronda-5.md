# Revisión independiente — PR #318 / T-340 — Ronda 5

**Fecha:** 2026-10-12. **SHA de código de Asako verificado:** `58811a3038dc819c5e0e6e3136f450bf5fb47b7c`. **Rama:** `feat/T-340-lectores` → `develop` (sin atraso, Draft, no mergeada). **Alcance:** comparación de los dos commits posteriores a R4 `9ad7c333`, 27 archivos; pruebas y SQL nuevos, diff total de 30 commits.

**DICTAMEN: CON BLOQUEANTES.** H03 y H08 se corrigieron y se verificaron; H04–H07 quedan parcialmente corregidos; H09 sigue abierto; **nuevo PR318-H10**: no existe la acción de entrega por drop en la interfaz del repartidor. **Gate 0 H01/H02 permanece cerrado**. El Paso 2 no está listo para Ready, aprobación ni merge.

## Autorización de producto cerrada — Opción A (2026-10-12, usuario Lautaro073)

Además de la opción A de R4 (ampliar `get_trip_details` con `drops[]` y mantener campos escalares de **respuesta** derivados del primer drop, **sin** fallback a columnas legacy de DB), Lautaro073 aprobó **opción A de R5**: modificar **exclusivamente los fixtures**, NO las aserciones, de `supabase/tests/cc008_trip_details.sql` y `supabase/tests/cc023_private_columns.sql` para crear drops + drop_contacts legítimos de solicitudes publicadas/matcheadas. Queda escrito en `docs/tasks/T-340.md` de esta rama (commit `ea4ab8ce`). No se necesita decidir nada más. No habilita fallback SQL productivo, cambios de checks ni los pasos 3 y 4 (Kira).

## Hallazgos preexistentes — reevaluados

### PR318-H03 — ARREGLADO-VERIFICADO (firma RPC por drop)

`src/server/rpc/requests.ts:44–49` ahora separa `mark_drop_delivered` (solo `p_drop_id`) y `mark_drop_failed` (`p_drop_id,p_reason`) antes de construir argumentos de RPC por request. `src/server/rpc/requests.test.ts:257–334` compara **payload exacto y keys**, y cubre mapeo P0001; `unit` CI job `114886529521` PASS en SHA auditado. Las firmas SQL del Paso 1 se mantienen. **Sin cambios exigidos**, conservar la prueba.

### PR318-H04 — PARCIAL: SQL `drops[]` correcto en fuente, pero regresiones legacy bloquean db-tests

La nueva `supabase/migrations/20261012010000_t340_readers.sql:110–143` construye `jsonb_agg(... ORDER BY d.position)` para todos los drops; el escalar se deriva de `v_first_drop` y `get_merchant_request_private_fields` lee de `drop_contacts`. No hay `v_request.notes` ni `v_request.cash_change_amount` como fallback. Zod añade `tripDropSchema` y `drops[]`. **La implementación está alineada conceptualmente con la opción A**, pero dos suites históricas crean viajes publicados/matcheados **sin filas child** y fallan en runtime al invocar la nueva RPC:
- `supabase/tests/cc008_trip_details.sql:75–94,112–119`: matched + offer, sin drop. `NOT_FOUND` en línea 117; plan 13, ejecutadas 2 (job `114886529374`).
- `supabase/tests/cc023_private_columns.sql:89–119,168–189,397–418`: published/matched con datos privados solo en columnas DB legacy, sin drop/contacts; `get_merchant_request_private_fields` retorna nulos y falla aserción #7; luego `get_trip_details` causa `NOT_FOUND` en línea 403; plan 42, ejecutadas 36.

**Corrección autorizada:** incorporar SOLO en la preparación de esos **dos tests** las filas child con los datos originales, guardando mismo request ID, notas, cash, zona, destinatario y roles. No editar asserts, error codes, grants o asserts de privacidad. Mantener draft sin privados comportándose como antes. **No introducir fallback SQL a legacy DB.** Ejecutar los tests históricos completos más pgTAP de T-340 con `db-tests` hasta PASS; documentar RED actual y GREEN real en nuevo SHA.

### PR318-H05 — PARCIAL: proyección por drop implementada, pero nullability y fallbacks incorrectos

`src/features/offers/queries.ts:120–180` y `src/server/live/t204.ts:124–190` sí consultan `delivery_request_drops` por lotes, seleccionando solo columnas públicas, con `PublicDropSummary`; los componentes muestran 3 drops. **No se observa consulta a `delivery_request_drop_contacts` en esas proyecciones**. Sin embargo:
1. `src/features/offers/queries.ts:190–198` y `src/server/live/t204.ts:195–201` validan `req.package_type` / `req.recipient_payment_method` del PADRE como obligatorios, **aunque el esquema CC-022 los hizo nullable para solicitudes con N drops**. Si son `NULL` y los 3 hijos son válidos, el feed **throw** y SSE responde 500.
2. `src/features/offers/queries.ts:209–237` y `src/server/live/t204.ts:206–236` crean un **drop inventado desde parent** si la consulta de hijos no devuelve filas, incluso cuando `req.drops_count=3`; su `dropsCount` resultante se convierte falsamente en 1 y oculta inconsistencia.
3. Feed normal ignora `dropsResult.error`, mientras live lo propaga. Un fallo DB puede parecer como feed de un drop. Además el feed usa `continue` para tipo inválido de child y degrada silenciosamente.
**Corrección:** derivar proyección de hijos para N; solo para caso legacy genuino de 1 drop aplicar fallback muy acotado si está **explícitamente permitido y probado**, o fallar cerrado ante inconsistencia; no fabricar un drop para N ni ignorar error de consulta. Probar fixture parent `package_type=NULL,recipient_payment_method=NULL,drops_count=3` con 3 hijos válidos y test adversarial `3 anunciados / 0 rows`: debe error controlado, nunca 1 drop fantasma; comprobar feed y live, 0 PII en payload serializado.

### PR318-H06 — PARCIAL: viaje/WhatsApp adelantados, historial y admin todavía no migrados

`src/features/trips/components/trip-{merchant,courier}-view.tsx` y `trip-route-map.tsx` ya iteran `drops[]`; hay un botón WhatsApp por destinatario, con `cashChangeAmount` específico; `getTripDetails` deriva `totalAmountArs` y `collectibleAmountArs` de los estados. Sin embargo:
- **Sin cambios desde R4** en `src/features/requests/queries.ts:261–280,432–445,648–720`: historial/listas/detalle del comercio siguen dependiendo de `dropoff_zone`, `package_type`, `recipient_payment_method` de `delivery_requests` y muestran solo un destino. Con request padre nullable, podrían mostrar datos nulos/falsos o no listar N.
- `src/features/admin/queries.ts` solo agregó la clave de setting; **no se verificó actualización de lectores existentes** de solicitudes. Asako debe inventariar rutas reales y adaptar únicamente las que existan, sin inventar pantallas.
- `src/features/trips/components/trip-{courier,merchant}-view.tsx:173/63` incorpora **`(trip as any).requestId`** y fuerza `packageType: 'chico'` en un fallback artificial. Si `drops[]` es obligatorio en Zod, **no se debe duplicar un drop ficticio ni suprimir tipos**.
- `trip-route-map.tsx:159–177` construye Google Maps externo solo **origen→último destino**, aunque la UI pinta polilínea con 3 puntos. Si se ofrece navegación multi-drop, corresponde utilizar waypoints en orden o dejar explícita navegación simple sin prometer la ruta completa. Resolver según interfaz actual de `src/features/trips/maps.ts`, sin agregar deps.
**Corrección:** mappers y listas de requests/admin que existan deben mostrar N y no leer datos nullable parent como verdad de multi-drop; remover `any`/datos fabricados; cubrir UI/WhatsApp mapa/total.

### PR318-H07 — PARCIAL: UUID duplicado solucionado, nuevo FK roto

El fixture nuevo ya usa `30000000-0000-4000-8000-000000003600–3605` (sin PK previa duplicada), pero `supabase/tests/t340_multi_drop.sql:1286–1306` **inserta `delivery_requests` con `accepted_offer_id=v_offer_id` ANTES de crear la fila de `offers`**. FK inmediato `delivery_requests_accepted_offer_fk` falla en función `pg_temp.test_readers_post_match()` línea 10. `db-tests` job `114886529374`: `planned 90, ran 77`, `Result: FAIL`; no es falla de migración, esta sí aplicó en DB efímero.
**Corrección:** (a) INSERT request **sin** `accepted_offer_id`, status inicial válido, (b) INSERT offers referenciando request, (c) UPDATE request `status='matched',accepted_offer_id=v_offer_id,matched_at=now()`, en el mismo fixture/transaction; (d) cargar 3 drops/contactos y ejecutar todos los asserts. Mantener `plan(90)` o actualizarlo solo cuando se agreguen asserts reales. Si hay otro constraint de estado, resolver conservando integridad, no desactivar triggers/FKs.

### PR318-H08 — ARREGLADO-VERIFICADO (unit fake coverage)

Log auténtico `unit` job `114886529521` en SHA auditado: `src/domain/testing/rpc-fake.ts` **95,32 % statements y 91,35 % branches**, functions 100; job CI PASS (cumple mínimo 90/90). Las nuevas pruebas ejercitan ramas reales del fake; no se cambiaron thresholds en diff. **Sin trabajo adicional**, conservar tests.

### PR318-H09 — ABIERTO: E2E nuevo no ejecutado en Preview y no hay RED→GREEN acreditado del Paso 2

Existe `e2e/specs/multi-drop.spec.ts` (218 líneas), pero para SHA auditado solo hay CI run `38271482164` (fallo db-tests), **sin run e2e-preview ni status success confirmado**. No se verificó ejecución de la nueva prueba; el autor tampoco aportó **RED de los nuevos lectores** con comando, log y comparación de expectativa/resultado. El E2E:
- Testea PII principalmente con `getByText(...).toHaveCount(0)`, **no verifica payload HTTP/SSE completo** ni un courier ajeno tras match.
- Prepara 3 drops **todos en la misma zona** (`zoneId`) y no demuestra que se diferencien zonas/tramos según posición.
- Ignora `error` de `admin.from('delivery_requests').update({drops_count:3})`; el seed modifica request publicado de fixture, borra hijos preexistentes y reemplaza datos; la ejecución real debe comprobar checks, integridad y cleanup por `testRunId`/cascade antes de darla por válida.
- No comprobar exclusivamente un UI nuevo y decir que «3 drops, privacidad y flujo» completo está probado.
**Corrección:** E2E transaccional seguro de 3 drops en Supabase Develop de CI Preview, usando infraestructura stagingContext/cleanup existente, 2–3 zonas distintas si las fixtures las aportan, verificación explícita de mutaciones de seed, before-match respuesta pública y ausencia de claves/valores privados en payload, courier no asignado tras match, merchant/courier aceptado, 3 links WA aislados y legado 1 drop. Exigir RED verdadero de una propiedad nueva y GREEN de SHA final; no SQL remoto manual, workflows nuevos ni falsos tests. Si el spec no puede ejecutarse porque CI falla o preview no se dispara, escribir PENDIENTE y corregir primero el gate técnico.

## Hallazgo nuevo ronda 5

### PR318-H10 — ALTO — No se puede completar una entrega multi-drop desde la pantalla de courier

**`src/features/trips/components/trip-courier-container.tsx:14–18,30–49,73–80`; `src/features/trips/components/trip-courier-view.tsx:169–243,271–285`; `src/features/trips/actions.ts:184–222`.**

**Defecto verificado por inspección cruzada:** se agregó listado de 3 drops, pero cada botón se presenta como estado/cliente pasivo. El único botón de avance `onAdvanceTrip` en `TripCourierView` invoca en `TripCourierContainer` `markTripDeliveredAction({requestId:trip.id})` cuando `in_transit`, **sin elegir `dropId`**. Para N drops, CC-022 exige `mark_drop_delivered(p_drop_id)` o `mark_drop_failed(p_drop_id,p_reason)`; `mark_delivered` legacy rechaza N>1. Por lo tanto, **la UI no tiene camino funcional para marcar las entregas individuales** (se puede ver, pero no completarlas).

**Corrección guiada:** mantener `markTripPickedUpAction` para retiro inicial; después del pickup, para `dropsCount>1` renderizar un botón habilitado por cada `drop.status='pending'`: **Entregada** → `markDropDeliveredAction({requestId:trip.id,dropId:drop.id})`, **No se pudo entregar** → diálogo para motivo no vacío y `markDropFailedAction({requestId:trip.id,dropId:drop.id,reason})`. Las acciones ya existen y revalidan la ruta; manejar estado pending/error y `router.refresh()`; no mostrar la acción legacy global para N>1; cerrar automáticamente cuando no queden pending (RPC existente). Mantener botón `markTripDeliveredAction` únicamente para 1 drop si contrato lo autoriza. **Pruebas RED→GREEN:** RTL con 3 drops pending: selección de drop2 debe llamar únicamente RPC de drop2 y no `markTripDeliveredAction`; motivo vacío no despacha; marcar failed no hace cobrable; 2 delivered + 1 failed lleva fin de viaje; 1 drop legacy conserva comportamiento. No añadir escritores UI del Paso 4: marcar estado por drop es capacidad lectora/operación del courier ya autorizada por CC-022 §§5,10.

## Checks reales del SHA auditado

| Check | Resultado |
|---|---|
| typecheck | PASS |
| lint | PASS |
| build | PASS |
| unit | PASS (cobertura fake 95,32/91,35 %) |
| audit | PASS |
| bundle-budget | PASS |
| db-tests | **FAIL** (dos suites legacy sin child rows, FK inválida fixture nuevo) |
| e2e-preview | **SIN GREEN / no run constatado** |
| approval-policy | FAIL; no es aprobación del autor ni se salta |
| Supabase Preview | SKIPPED en check del SHA |

CI real: https://github.com/cadeApp/cadeApp/actions/runs/38271482164 — `db-tests` job https://github.com/cadeApp/cadeApp/actions/jobs/114886529374; `unit` job https://github.com/cadeApp/cadeApp/actions/jobs/114886529521. `db-tests` aplicó la migración nueva **solo en DB efímero del runner**, después fallaron fixtures. **No se ejecutaron localmente Docker, Supabase o Playwright por el revisor**; no hay afirmación falsa de E2E ni de RED de H04–H06/H09/H10.

## Informe revisar-pr

Informe revisar-pr — T-340 Paso 2/4 — PR #318 — 2026-10-12 — revisión independiente — ronda 5.

**Resultado: CON BLOQUEANTES.** En este HEAD H03/H08 **arreglado-verificado**; H04/H05/H06/H07 **parcial**; H09 **abierto**; PR318-H10 **abierto**. H01/H02 Gate 0 mantienen verificación previa. **Bloquean:** test/fixture de compatibilidad legacy, null-parent y phantom drop de feed/live, historial/admin sin N, FK de pgTAP, E2E sin correr/RED sin certificar y acciones drop por courier ausentes.

**Decisiones pendientes:** NINGUNA; Lautaro073 eligió la opción A de R5 y de R4, ambas registradas en ficha.  
**Checks propios locales:** typecheck n.e., lint n.e., unit n.e., db-tests n.e., E2E n.e.; se verificó **GitHub Actions exact SHA**, fuente cruzada y condiciones de rama/contrato; el revisor no corrió DB local.  
**No revisado:** próximo SHA de correcciones/entorno Develop tras merge. **No Ready, no aprobar, no mergear ni comenzar paso 3 de Kira**.


### Nota de entorno sobre H09 — límite real para E2E de Paso 2 ANTES del merge

Inspección independiente de `.github/workflows/e2e-preview.yml:3–4,22,53,60` y `.github/workflows/migrate.yml:3–7,17–18`: el Vercel Preview de las PRs se prueba contra **Supabase Develop COMPARTIDO**, pero las migraciones de feature se aplican a Supabase Develop **exclusivamente después del merge/push a la rama `develop`**. Por ello, aunque `e2e/specs/multi-drop.spec.ts` tuviera oráculos correctos, la RPC remota `get_trip_details` todavía carece de `drops[]` de Paso 2 hasta desplegar `20261012010000_t340_readers.sql`. **No exigir GREEN E2E nuevo premerge sobre ese backend viejo ni declarar falla de implementación por esa incompatibilidad de entorno**. **No autorizar a Asako a ejecutar `db push` manual sobre Supabase Develop**, y no inventar un nuevo workflow ni conexiones remotas.

Orden técnicamente seguro de validación: (1) obtener `db-tests` del SHA (migraciones nuevas probadas en DB efímero) + unit/typecheck/lint/build en verde, (2) auditar a nivel código/fixture los asserts del E2E nuevo con pruebas negativas unitarias/in-memory y dejar anotado **E2E POST-MIGRACIÓN PENDIENTE**, (3) resolver explícitamente el gate de release/premerge con Lautaro073 antes del eventual merge, (4) tras el merge y migración automática Develop, ejecutar el checkpoint E2E real contra ese backend y **NO** empezar Paso 3 con Kira hasta que esté verde. **Este informe NO autoriza el merge saltándose el gate ni convierte un spec no ejecutado en «verificado»**.

