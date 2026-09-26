# Evidencia y comandos reproducibles — PR #82 (Ronda 1)

- **SHA verificado:** `a2ab69a01eaec4b6b6a918e7298023cfa03ea373`
- **Rama:** `feat/T-204-realtime-tanstack`
- **Base (`origin/develop`):** `9ab71cb`

---

## 1. Verificación de alcance y diff contra `origin/develop`

### Comando
```bash
git log --oneline origin/develop..origin/feat/T-204-realtime-tanstack
git diff origin/develop...origin/feat/T-204-realtime-tanstack --stat
```

### Salida
```text
a2ab69a docs(T-204): update session log with PR #82 reference [T-204]
75c50da chore(T-204): start task [T-204]
 docs/tasks/T-204.md                                |   8 +-
 docs/tasks/log/T-204.md                            |  13 ++
 .../offers/hooks/use-available-requests.test.tsx   | 122 +++++++++++++++++
 .../requests/hooks/use-request-offers.test.tsx     | 150 +++++++++++++++++++++
 src/features/trips/hooks/use-trip.test.tsx         |  95 +++++++++++++
 src/lib/hooks/use-realtime-invalidation.test.tsx   | 135 +++++++++++++++++++
 6 files changed, 517 insertions(+), 6 deletions(-)
```

---

## 2. Ejecución de `pnpm typecheck` (`PR82-H02`)

### Comando
```bash
pnpm typecheck
```

### Salida (código de salida `2`)
```text
> cadeapp@0.1.0 typecheck
> tsc --noEmit && tsc --project .github/workflows/tsconfig.json

src/features/offers/hooks/use-available-requests.test.tsx(5,38): error TS2307: Cannot find module './use-available-requests' or its corresponding type declarations.
src/features/offers/hooks/use-available-requests.test.tsx(109,42): error TS7006: Parameter 'r' implicitly has an 'any' type.
src/features/requests/hooks/use-request-offers.test.tsx(96,11): error TS2353: Object literal may only specify known properties, and 'fetcher' does not exist in type 'UseRequestOffersOptions'.
src/features/trips/hooks/use-trip.test.tsx(5,25): error TS2307: Cannot find module './use-trip' or its corresponding type declarations.
src/lib/hooks/use-realtime-invalidation.test.tsx(5,41): error TS2307: Cannot find module './use-realtime-invalidation' or its corresponding type declarations.
ELIFECYCLE Command failed with exit code 2.
```

---

## 3. Ejecución de `pnpm lint`

### Comando
```bash
pnpm lint
```

### Salida (código de salida `0`)
```text
✔ No ESLint warnings or errors
```

---

## 4. Ejecución de las suites de `T-204` y demostración en vivo de `PR82-H04` (`AG-76`)

### Comando
```bash
pnpm vitest run src/lib/hooks/use-realtime-invalidation.test.tsx src/features/requests/hooks/use-request-offers.test.tsx src/features/offers/hooks/use-available-requests.test.tsx src/features/trips/hooks/use-trip.test.tsx
```

### Salida resumida
- `src/lib/hooks/use-realtime-invalidation.test.tsx`: **FAIL** (`Failed to resolve import "./use-realtime-invalidation"`)
- `src/features/offers/hooks/use-available-requests.test.tsx`: **FAIL** (`Failed to resolve import "./use-available-requests"`)
- `src/features/trips/hooks/use-trip.test.tsx`: **FAIL** (`Failed to resolve import "./use-trip"`)
- `src/features/requests/hooks/use-request-offers.test.tsx`: **1 failed | 2 passed (3)**:
  - `× DoD: Con el push apagado, la oferta nueva aparece al volver a la app (refetchOnWindowFocus)` → `AssertionError: expected [ { id: 'offer-initial-1', …(11) } ] to have a length of 2 but got 1`
  - `✓ DoD: al desmontar la pantalla se cierra el canal`
  - `✓ DoD: Realtime no escribe la caché a mano, solo invalida queries` (**PASA EN VERDE sobre el `use-request-offers.ts` de T-113 que NO usa TanStack Query y muta `offers` a mano con `setOffers`, porque `invalidateSpy` en la línea 130 nunca se afirma**).

---

# Ronda 2 — evidencia por inspección y sondas reproducibles

- **SHA revisado:** `d085677e1a108a09083927fc47cd20008b578a34`
- **develop observado:** `ac4587f3c76f3ce8d63f3abbafff0847b89d9b54`
- **Comparación GitHub:** `diverged` · ahead 6 · behind 28 · merge-base `9ab71cb`
- **PR:** `mergeable=true` según GitHub.
- **CI:** deliberadamente no inspeccionado porque la ronda tiene bloqueantes.
- **Carpeta de revisión:** historial desde R1 = solo `ce79858` (Lautaro073); no hubo escritura del autor.

## Limitación de ejecución

El contenedor de esta revisión no contiene el clon del proyecto. El intento de materializarlo con:

```bash
git clone https://github.com/cadeApp/cadeApp.git /tmp/cadeapp-review
```

falló con:

```text
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/': Could not resolve host: github.com
```

Por eso esta ronda **no atribuye verificación runtime** a H02–H06 y no inventa mutaciones ejecutadas. Las sondas siguientes son los controles concretos que deben quedar en rojo antes del arreglo y verdes después.

## Sonda S-R2-01 — feed productivo realmente cableado (H09)

Sobre `src/features/offers/courier-panel.test.tsx`, mockear la fuente viva para que el snapshot inicial contenga `req-1` y el refetch produzca `req-2`. Renderizar `CourierFeed`, disparar focus/invalidación y afirmar que `req-2` aparece.

**Estado actual por inspección:** `CourierFeed` no importa ni llama `useAvailableRequests`; el resultado del hook no puede afectar el DOM.

Mutación que el test debe matar después del arreglo: reemplazar temporalmente el resultado vivo por el prop `requests` original. El caso debe quedar rojo.

## Sonda S-R2-02 — `useTrip` no acepta un refetch no-op (H10)

La API final debe impedir o fallar si la query está habilitada sin fuente real. Prueba de frescura:

1. initial status = `matched`;
2. la fuente devuelve `in_transit`;
3. focus/Realtime/refetch;
4. resultado = `in_transit`.

Mutación que debe quedar roja: hacer que `queryFn` vuelva a `return initialTrip ?? null`.

## Sonda S-R2-03 — dos query keys dentro del mismo debounce (H11)

Agregar al test de `useRealtimeInvalidation`:

```ts
const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
// subs: requests -> ['requests']; offers -> ['offers']
realtimeCallbacks[0]?.({ eventType: 'UPDATE' });
vi.advanceTimersByTime(50);
realtimeCallbacks[1]?.({ eventType: 'INSERT' });
vi.advanceTimersByTime(300);

expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['requests'] });
expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['offers'] });
expect(invalidateSpy).toHaveBeenCalledTimes(2);
```

**Código actual:** el segundo callback cancela el timeout del primero; solo sobrevive la última key.

Mutación que debe quedar roja tras el arreglo: volver a un único `debounceTimerRef` que guarda una sola `targetKey`.

## Sonda S-R2-04 — rerender con configuración nueva (H12)

```ts
const { rerender } = renderHook(
  ({ key }) => useRealtimeInvalidation({
    channelName: 'same-channel',
    table: 'offers',
    filter: `request_id=eq.${key}`,
    queryKey: ['offers', key],
  }),
  { initialProps: { key: 'A' }, wrapper }
);

rerender({ key: 'B' });
// disparar el callback de la suscripción vigente
expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['offers', 'B'] });
```

Mutación que debe quedar roja tras el arreglo: volver a omitir la firma/configuración de suscripciones de las dependencias del efecto.

## Sonda S-R2-05 — polling de H07

Con fake timers:
- query visible + 29.999 ms → 0 fetches por polling;
- +1 ms → 1 fetch;
- background/hidden → avanzar otros 30 s y demostrar que no agrega un fetch.

Mutación que debe matar: cambiar `refetchInterval` a otro valor o `refetchIntervalInBackground` a `true`.

## Sonda S-R2-06 — callbacks fuera del render (H13)

Pasar `onOfferAdded` que actualice estado de un wrapper padre y hacer que el fetch agregue una oferta. El callback debe ejecutarse después de commit, una vez por cambio observado.

Mutación que debe quedar roja: volver a invocarlo directamente en el cuerpo de `useRequestOffers`.

## Evidencia de drift (H14)

GitHub compare de `develop...feat/T-204-realtime-tanstack`:

```text
status: diverged
ahead_by: 6
behind_by: 28
merge_base: 9ab71cb
develop: ac4587f
PR head: d085677
```

La ficha `develop:docs/tasks/T-204.md` contiene al final la lectura obligatoria de `docs/design/visual-task-directive.md` y `docs/guia-prompts.md`; la rama conserva la sección anterior `Notas para quien retome`.

## Evidencia del autor vs. bitácora (H15)

El cuerpo del PR marca el ítem “Cada prueba nueva se demostró fallando al romper la regla”. La bitácora final solo registra:

```text
typecheck ✅ · lint ✅ · test ✅ (46/46 suites, 388/388 tests)
```

El rojo documentado antes es la fase TDD inicial por módulos inexistentes/desalineados; no hay una línea roja de mutación para H04/H05/H06/H07 ni para los nuevos controles de esta ronda.
 
---

# Ronda 3 — controles reviewer sobre `d439457`

## Preflight

```text
PR head revisado: d439457ae681b7af660eac3f68b8146973e9874f
develop: ac4587f3c76f3ce8d63f3abbafff0847b89d9b54
develop...branch: ahead 10 / behind 0
fixes propios tras merge b6e7774: 12 archivos, todos dentro del scope D01
```

## H09 — paridad SSR vs fetch vivo

Control estático comparando `src/features/offers/queries.ts#getAvailableRequests` con `use-available-requests.ts`:

```json
{
  "serverTracksOwnOffer": true,
  "liveTracksOwnOffer": false,
  "noInitialSnapshotFallback": false
}
```

El servidor consulta usuario + ofertas pendientes y deriva `hasMyOffer`; el hook vivo hardcodea `false/null` y aún contiene `return [...initialRequests]` en caminos de fallback.

Test requerido: solicitud SSR con `hasMyOffer=true`; refetch vivo devuelve la misma solicitud + oferta pending del usuario; después del refetch la UI debe seguir mostrando “ya ofertaste” y nunca el botón “Ofertar”.

## H10 — shape y stale fallback

Control estático:

```json
{
  "defaultFetchPreservesShape": false,
  "noStaleInitialFallback": false
}
```

Causa: `.select('id, status')` + `return data as unknown as T`, y salida `query.data ?? initialTrip`.

Test requerido: `initialTrip` con campos extra permitidos; fuente actualiza `status`; después del refetch esos campos deben conservarse. Segunda prueba: fuente devuelve `null`; el resultado no debe revivir silenciosamente el snapshot como si fuera fresco.

## H18 — non-null assertions

Control reviewer, excluyendo `!` dentro de strings SQL/Supabase:

```text
use-available-requests.ts:54           fallbackClient!
use-request-offers.ts:97               fallbackClient!
use-trip.ts:40                         fallbackClient!
use-realtime-invalidation.ts:40        fallbackClient!
use-realtime-invalidation.test.tsx:104 realtimeCallbacks[0]!
use-realtime-invalidation.test.tsx:171 realtimeCallbacks[0]!
use-realtime-invalidation.test.tsx:172 realtimeCallbacks[1]!
use-realtime-invalidation.test.tsx:245 latest callback !
TOTAL: 8
```

`AGENTS.md §4` prohíbe explícitamente non-null assertions.

## CI

No inspeccionado en Ronda 3 porque la ronda conserva bloqueantes; se difiere hasta una ronda sin defectos estáticos abiertos.
---

# Ronda 4 — evidencia por inspección sobre `4af4186`

## Preflight

```text
PR head: 4af41865f55f59d2da1595ee2c180801bb993841
develop: bdafee8ff04d6b620eb46dd885b62fe0d675ca49
develop...branch: diverged · ahead 17 · behind 5
commits nuevos desde R3 docs: 2
```

## H18 — barrido non-null

El barrido independiente sobre los archivos T-204 revisados encontró 0 non-null assertions TypeScript. Las coincidencias restantes con `!` pertenecen a strings de joins Supabase (`zones!pickup_zone_id`, etc.) o a `expect.any`, no al operador non-null.

## H19 — clase completa de lecturas browser en features

```text
use-available-requests.ts  -> import createClient(browser) + .from('delivery_requests') + .from('offers')
use-request-offers.ts      -> import createClient(browser) + .from('offers')
use-trip.ts                -> import createClient(browser) + .from('delivery_requests')
use-realtime-invalidation  -> excluido: src/lib + suscripción Realtime, no lectura de feature
```

Regla aplicable: `.agents/rules/25-stack-y-patrones.md §7`: «Sin SQL ni clientes Supabase en features: todo pasa por src/server».

## H20 — clase completa de errores silenciosos

```text
useAvailableRequests: client/from/query error -> []
useAvailableRequests: auth/offers error -> continúa sin ofertas propias
useRequestOffers: query error -> initialOffers
useTrip: query error -> null
CourierFeed: [] -> empty state
RequestOffersList: [] -> «Esperando ofertas»
```

## H21 — drift relevante

Los 5 commits de develop agregan, entre otros, `docs/contracts/CC-008.md`, `src/server/rpc/trips.ts`, `src/domain/rpc-contracts.ts` y tipos/migraciones de `get_trip_details`. D03 depende de esa fuente y por eso el merge debe ocurrir antes del arreglo.

## Decisión

Lautaro073 respondió `1-A`: mover lecturas/refetch a server/API, usar CC-008 para viaje y tratar fallos como error de Query conservando el último dato válido.

## CI

No inspeccionado en R4: H19/H20/H21 bloquean antes de CI.
