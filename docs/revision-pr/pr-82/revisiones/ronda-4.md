# Informe de Revisión — PR #82 — Ronda 4

- **Tarea:** `T-204`
- **Autor:** `asako669` (P2)
- **SHA revisado:** `4af41865f55f59d2da1595ee2c180801bb993841`
- **develop actual:** `bdafee8ff04d6b620eb46dd885b62fe0d675ca49`
- **Fecha:** 2026-09-26
- **Resultado:** ❌ **CON BLOQUEANTES (3)** · 0 decisiones pendientes
- **CI:** no inspeccionado: hay bloqueantes estáticos/arquitectónicos previos.

## Preflight

- Dos commits nuevos desde la documentación R3: arreglo `bfdddc7` + cierre/log `4af4186`.
- El autor no escribió `docs/revision-pr/pr-82/**`.
- Diff propio R4: 8 archivos, todos dentro del scope de T-204 vigente antes de D03.
- La rama volvió a divergir: **ahead 17 / behind 5** respecto de `develop`.
- `develop` nuevo agrega CC-008 y `src/server/rpc/trips.ts#getTripDetailsServer`.

## Revalidación de Ronda 3

- **H09:** el happy path ahora consulta ofertas pending del usuario y deriva `hasMyOffer/myOfferAmountArs`; el test nuevo cubre ese camino. Pasa a `arreglado-sin-verificar`; la degradación ante error se separa en H20.
- **H10:** el camino actual mezcla `{id,status}` fresco con `initialTrip` y distingue `null` de `undefined`; los dos tests nuevos atacan shape y stale fallback. Pasa a `arreglado-sin-verificar`. D03 reemplazará la lectura browser por CC-008.
- **H18:** **arreglado-verificado por barrido estático independiente**: 0 non-null assertions TypeScript en los archivos T-204 revisados. Los `!` dentro de strings de joins Supabase no cuentan.
- **H11/H12/H14/H15:** no presentan regresión en los cambios de R4; H14 queda históricamente cerrado y el drift nuevo se registra como H21.

## BLOQUEANTES

### PR82-H19 — lecturas Supabase browser dentro de features

Los tres hooks de datos vivos importan `createClient` desde `@/lib/supabase/browser` y ejecutan consultas `.from(...)`:

- `src/features/offers/hooks/use-available-requests.ts`
- `src/features/requests/hooks/use-request-offers.ts`
- `src/features/trips/hooks/use-trip.ts`

Esto contradice `.agents/rules/25-stack-y-patrones.md §7`: **«Sin SQL ni clientes Supabase en features: todo pasa por src/server»**.

`useRealtimeInvalidation` NO forma parte del hallazgo: vive en `src/lib`, y T-204 sí necesita una suscripción Realtime cliente. Lo que se mueve es la lectura/refetch de datos.

Para viaje el problema ya tiene una fuente canónica en develop: CC-008 + `getTripDetailsServer`. No se debe mantener una segunda lectura directa de `delivery_requests` en el hook.

**Decisión D03 / Lautaro073 1-A:** corregir ahora en T-204 mediante frontera server/API exacta; ver sección Implementación obligatoria.

### PR82-H20 — error de fuente representado como dato válido

Clase completa:

- `useAvailableRequests`: fallo de cliente/query → `[]`; fallo de auth/ofertas → continúa con mapa vacío y puede degradar `hasMyOffer` a `false`.
- `useRequestOffers`: fallo de query → devuelve `initialOffers` como si fueran frescas.
- `useTrip`: fallo de query → `null`, sin distinguir error de ausencia.
- `CourierFeed`: `[]` se renderiza como «No hay pedidos disponibles».
- `RequestOffersList`: `[]` se renderiza como «Esperando ofertas».

Un fallo de red/base no es un conjunto vacío. D03 exige que los endpoints respondan no-2xx, los hooks hagan `throw`, TanStack conserve el último dato exitoso durante un refetch fallido y la UI muestre error + reintento. Una respuesta 200 con `data: []` sigue significando vacío real.

### PR82-H21 — branch detrás de develop

La rama está 5 commits detrás. El nuevo develop trae justamente CC-008, contratos y `getTripDetailsServer`, por lo que **se debe mergear antes de implementar H19**. Sin rebase, force-push ni amend.

## Implementación obligatoria aprobada por D03

Después de mergear `origin/develop`, la ficha T-204 debe conservar D01 y agregar **solo** estos paths nuevos:

- `src/lib/live-contracts.ts`
- `src/lib/live-contracts.test.ts`
- `src/server/live/t204.ts`
- `src/server/live/t204.test.ts`
- `src/app/api/live/available-requests/route.ts`
- `src/app/api/live/available-requests/route.test.ts`
- `src/app/api/live/requests/[requestId]/offers/route.ts`
- `src/app/api/live/requests/[requestId]/offers/route.test.ts`
- `src/app/api/live/trips/[tripId]/route.ts`
- `src/app/api/live/trips/[tripId]/route.test.ts`
- `src/features/requests/components/request-offers-list.tsx`
- `src/features/requests/components/request-offers.test.tsx`
- `src/features/offers/copy.ts`
- `src/features/requests/copy.ts`

### Contratos HTTP internos

`src/lib/live-contracts.ts` será client-safe y contendrá Zod para parsear las respuestas exitosas:

- available requests: `{ data: AvailableRequestLiveItem[] }` con la misma forma pública de `AvailableRequestItem`.
- request offers: `{ data: MerchantOfferLiveItem[] }` con la misma forma pública de `MerchantOfferItem`.
- trip: `{ data: { id, status } | null }`, donde `status` solo admite los estados expuestos por CC-008.
- error: `{ error: string }`.

Los hooks deben parsear `await response.json()` con estos schemas. No usar casts como sustituto de validación.

### `src/server/live/t204.ts`

Debe llevar `import 'server-only'` y ser el único código nuevo de T-204 que haga lecturas Supabase para feed/ofertas:

1. `getAvailableRequestsLiveServer()`:
   - usa `@/server/supabase/server`;
   - exige usuario autenticado;
   - consulta las `delivery_requests` published con las mismas columnas públicas del feed;
   - consulta las ofertas `pending` del courier actual para esas request IDs;
   - deriva `hasMyOffer`/`myOfferAmountArs`;
   - **si falla auth, requests u offers, falla la operación**; no devuelve datos parciales ni `[]` salvo vacío real.

2. `getRequestOffersLiveServer(requestId)`:
   - autentica usuario;
   - verifica que la solicitud `requestId` pertenece al merchant actual antes de devolver ofertas;
   - obtiene y mapea ofertas/courier/profile con la misma forma que `MerchantOfferItem`;
   - error de DB/autorización no se convierte en `initialOffers`.

3. `getTripLiveStateServer(requestId)`:
   - **no consulta tablas directamente**;
   - llama `getTripDetailsServer({ requestId })` de CC-008;
   - en success retorna solo `{ id: requestId, status }` para no enviar contactos/direcciones a un endpoint que solo refresca estado;
   - NOT_FOUND puede mapearse a ausencia; auth/forbidden/internal son error.

### Route handlers

- `GET /api/live/available-requests`
- `GET /api/live/requests/[requestId]/offers`
- `GET /api/live/trips/[tripId]`

Cada route solo llama a `src/server/live/t204.ts`, devuelve `{data: ...}` en 200 y status no-2xx en error. Sin SQL/Supabase en `src/app`.

### Hooks

- Eliminar `createClient` y toda `.from(...)` de los tres hooks.
- QueryFn por defecto usa `fetch` same-origin contra el endpoint correspondiente.
- `response.ok === false` → `throw new Error(...)`.
- Parsear JSON con `live-contracts.ts`.
- `options.fetcher` puede quedar solo como seam de tests si sigue siendo útil, pero los tests productivos obligatorios deben ejercer el camino default HTTP.
- Realtime sigue en `useRealtimeInvalidation`: solo invalida; nunca escribe la cache.
- En `useRequestOffers`, eliminar `bufferedMockOffersRef`, `RawRealtimeOfferPayload` y normalización asociada si quedan únicamente como soporte del antiguo fetch directo.
- `useTrip` puede dejar de ser genérico si eso elimina casts inseguros; su forma pública mínima puede ser `TripDetailItem` y mezclar `{id,status}` fresco con `initialTrip` cuando exista.

### Error UI

- `useAvailableRequests` y `useRequestOffers` retornan al menos `isError` + `refetch`; `useTrip` expone `isError` para T-115.
- `CourierFeed`: si el refetch falla y hay datos previos, conservar tarjetas y mostrar aviso `role=alert` + botón Reintentar; si no hay datos, mostrar error en lugar de EmptyState.
- `RequestOffersList`: mismo patrón; no mostrar «Esperando ofertas» cuando la query falló.
- Textos nuevos en `offers/copy.ts` y `requests/copy.ts`, no hardcodeados en componentes.

## Pruebas/mutaciones mínimas

1. H19: barrido de los tres hooks debe dar 0 imports de `@/lib/supabase/browser` y 0 `.from(`. Mutación: reintroducir `createClient().from(...)` en un hook; el control debe fallar.
2. Feed: endpoint/server retorna request + oferta pending propia → hook default HTTP conserva `hasMyOffer=true`. Mutación `hasMyOffer:false` → rojo.
3. Offers: merchant dueño obtiene ofertas; merchant distinto/unauth no. Mutación quitar la comprobación de owner → rojo.
4. Trip: route/server usa mock de `getTripDetailsServer`; state cambia matched→in_transit sin perder campos de `initialTrip`. Mutación volver a leer `delivery_requests` o devolver snapshot → rojo.
5. Error vs empty: HTTP 500 después de datos iniciales → último dato sigue visible + alerta; HTTP 200 `{data:[]}` → empty real. Mutación volver a `return []`/`initialOffers`/`null` en error → rojo.
6. Cleanup/focus/reconnect/polling/H11/H12 deben seguir verdes.
7. Como `request-offers.test.tsx` entra ahora al scope, eliminar su `realtimeCallback!` preexistente y dejar 0 non-null assertions en todos los archivos tocados.

## Decisiones

- **D03 / 1-A — RESUELTA:** aplicar exactamente la arquitectura anterior.
- No quedan decisiones 🔵 pendientes.
