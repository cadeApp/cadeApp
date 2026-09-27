# Informe de Revisión — PR #82 — Ronda 3

- **Tarea:** `T-204`
- **Rama:** `feat/T-204-realtime-tanstack` → `develop`
- **SHA revisado:** `d439457ae681b7af660eac3f68b8146973e9874f`
- **develop:** `ac4587f3c76f3ce8d63f3abbafff0847b89d9b54`
- **Fecha:** 2026-09-25
- **Resultado:** ❌ **CON BLOQUEANTES (3)** · 0 decisiones pendientes
- **CI:** no inspeccionado en esta ronda porque siguen existiendo bloqueantes.
- **Checks del autor:** bitácora reporta `typecheck ✅ · lint ✅ · test ✅ (60/60 suites, 641/641 tests) · verify-fichas 6/6`.

## Preflight

- Nuevo HEAD confirmado: `d439457`.
- Commits posteriores a la Ronda 2: merge `b6e7774`, fixes `45d3d5d`, bitácora `d439457`.
- El diff propio posterior al merge toca 12 archivos, todos dentro del scope autorizado D01.
- `develop...rama`: **ahead 10 / behind 0**; H14 queda resuelto.
- El autor no tocó `docs/revision-pr/pr-82/**`.
- La bitácora ahora incluye rojo/verde explícito para H09, H10, H11, H12, H07 y H13; H15 queda resuelto.

## Revalidación de Ronda 2

### Cerrados / arreglados

- **H11:** `pendingKeysRef` acumula query keys distintas y el timeout invalida todas las keys únicas.
- **H12:** `serializedConfig` entra en las dependencias del efecto; el test hace rerender A→B con mismo canal.
- **H14:** develop está integrado y la ficha incluye exactamente `courier-feed.tsx` y `courier-panel.test.tsx`.
- **H15:** la bitácora documenta fase roja y verde por hallazgo.
- **H07:** hay control de polling 30 s + background y rojo/verde del autor.
- **H13:** callbacks movidos a `useEffect` y prueba de orden post-render.

H07/H11/H12/H13 quedan `arreglado-sin-verificar` hasta una ejecución independiente; H14/H15 sí se verifican mecánicamente con GitHub/bitácora.

## BLOQUEANTES

### PR82-H09 · PARCIAL — el feed vivo pierde “ya ofertaste” y todavía conserva un fallback al snapshot

El cableado principal sí quedó: `CourierFeed` consume `useAvailableRequests` y el hook consulta `delivery_requests`.

Pero el fetch cliente no es semánticamente equivalente a `getAvailableRequests()` del servidor:

- servidor: obtiene el usuario actual, consulta sus ofertas `pending` y calcula `hasMyOffer` / `myOfferAmountArs`;
- hook vivo: hardcodea `hasMyOffer: false` y `myOfferAmountArs: null`.

Consecuencia: después del primer focus/polling/invalidation, una solicitud donde el repartidor ya ofertó puede volver a mostrar el botón **Ofertar**, aunque el SSR la había mostrado como “ya ofertaste”.

Además, el queryFn todavía contiene `return [...initialRequests]` si `createClient()` falla o no expone `.from`, pese a que D01 pidió eliminar el refetch no-op al snapshot.

**Control reviewer R3 (rojo sobre el SHA actual):**
- `getAvailableRequests` servidor: auth + query a `offers` + `hasMyOffer` dinámico → PASS.
- `useAvailableRequests` vivo: auth + query a `offers` + estado dinámico → **FAIL**.
- ausencia de `return [...initialRequests]` en queryFn → **FAIL**.

**Arreglo esperado:** replicar la semántica de `getAvailableRequests` para ofertas propias usando el cliente autenticado, sin datos privados extra. En error real, dejar que TanStack Query trate el error (o una política explícita), no reemplazar silenciosamente la fuente por el snapshot SSR.

### PR82-H10 · PARCIAL — el refetch es real, pero rompe el shape del viaje y aún revive datos stale

El queryFn ahora consulta Supabase, pero solo selecciona `id, status` y luego hace `return data as unknown as T`.

Si `T`/el `initialTrip` contiene dirección, destinatario u otros campos permitidos, el primer refetch reemplaza el objeto completo por uno de dos campos. El test H10 solo mira `status`, así que no detecta la pérdida.

Además el retorno público sigue siendo `trip: query.data ?? initialTrip ?? null`. Si la consulta devuelve `null` por ausencia/error, reaparece `initialTrip`, es decir, el hook puede volver a presentar un viaje stale.

**Control reviewer R3 (rojo):**
- fetch default conserva el shape de T → **FAIL** (`select('id, status')` + cast a `T`).
- resultado no revive `initialTrip` cuando la fuente viva retorna `null` → **FAIL**.

**Arreglo esperado:** si la fuente viva solo actualiza estado, mezclar el estado fresco con los campos estáticos ya autorizados del `initialTrip` en vez de castear un objeto parcial a `T`; y distinguir claramente “sin dato/error” de “usar snapshot”. No ampliar lectura de datos sensibles ni tocar contratos.

### PR82-H18 · `!` non-null prohibido por AGENTS.md — clase completa

`AGENTS.md §4` dice explícitamente: **Prohibido: `!` non-null**.

Clase enumerada en T-204:

Producción:
1. `use-available-requests.ts:54` → `fallbackClient!`
2. `use-request-offers.ts:97` → `fallbackClient!`
3. `use-trip.ts:40` → `fallbackClient!`
4. `use-realtime-invalidation.ts:40` → `fallbackClient!`

Tests:
5. `use-realtime-invalidation.test.tsx:104` → `realtimeCallbacks[0]!`
6. línea 171 → `realtimeCallbacks[0]!`
7. línea 172 → `realtimeCallbacks[1]!`
8. línea 245 → callback final con `!`.

No cuentan los `!` de las cadenas Supabase `zones!pickup_zone_id`: son texto de sintaxis de join, no TypeScript non-null assertions.

**Control reviewer R3:** scan estático sobre los archivos T-204 → **8 ocurrencias**, rojo.

**Arreglo esperado:** tipar/crear el fallback de forma que siempre sea `QueryClient` (sin `null` forzado), y estrechar callbacks de test con guard/expect antes de invocarlos.

## Decisiones

No hay decisiones 🔵 pendientes.

## Resultado

No está lista para merge. H11/H12/H14/H15 quedaron resueltos y la Ronda 2 mejoró de forma sustancial, pero H09 y H10 aún tienen semántica incorrecta en el camino vivo y H18 viola una regla raíz explícita.
