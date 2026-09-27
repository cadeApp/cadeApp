# Informe de Revisión — PR #82 — Ronda 1

- **Tarea:** `T-204` — Datos en vivo con TanStack Query y Supabase Realtime (Issue #31)
- **Rama:** `feat/T-204-realtime-tanstack` → `develop`
- **Autor / Zona:** `asako669` (P2)
- **SHA revisado:** `a2ab69a01eaec4b6b6a918e7298023cfa03ea373`
- **Base (`origin/develop`):** `9ab71cb` (`[T-001] Fichas de Fase 2 y Fase 3 (#84)`)
- **Fecha:** 2026-09-24
- **Revisor:** Revisión independiente (Antigravity)
- **Resultado:** ❌ **CON BLOQUEANTES (6)** · 2 mejoras · 0 decisiones pendientes
- **Checks locales (`a2ab69a`):** `typecheck` ❌ (5 errores TS) · `lint` ✅ (0 errores) · `test` ❌ (4 suites de T-204 en rojo) · `test:db` n.a.
- **Checks de CI (`a2ab69a`, run `35968073295`):** `typecheck` ❌ · `unit` ❌ · `approval-policy` ❌ · `lint` ✅ · `build` ✅ · `db-tests` ✅ · `audit` ✅ · `bundle-budget` ✅

---

## Resumen ejecutivo

La PR #82 se encuentra en la fase inicial de `tomar-tarea` (Draft, fase roja de TDD): solo contiene las 4 suites de prueba preliminares (`use-realtime-invalidation.test.tsx`, `use-request-offers.test.tsx`, `use-available-requests.test.tsx`, `use-trip.test.tsx`), la ficha `docs/tasks/T-204.md` y la primera entrada de bitácora en `docs/tasks/log/T-204.md`. **No existe aún ningún archivo de implementación de T-204 en la rama.**

Además de faltar toda la implementación productiva (`PR82-H01`) y de estar `typecheck` (`PR82-H02`) y `unit` (`PR82-H03`) en rojo, **la auditoría de las 4 suites de prueba reveló tres defectos estructurales de control (`P08-control-no-cubre-lo-que-dice`) que deben corregirse antes o junto con la implementación (`PR82-H04`, `PR82-H05`, `PR82-H06`)**, porque de lo contrario la fase verde dará por cumplidos invariantes del DoD que las pruebas en realidad no ejercen.

---

## Hallazgos BLOQUEANTES

### 1. `PR82-H01` · Entregables de producción de T-204 ausentes en la rama · **BLOQUEANTE**

- **Archivo:** `docs/tasks/log/T-204.md:8-14`, `src/lib/hooks/use-realtime-invalidation.test.tsx:5`
- **Severidad:** `critico` | **Categoría:** `correctness` | **Patrón:** `P15-entregable-declarado-pero-no-ejecutable`
- **Qué pasa:** En el SHA `a2ab69a`, `git diff origin/develop...HEAD --stat` muestra únicamente los 4 archivos `.test.tsx` de la fase roja de TDD, `docs/tasks/T-204.md` y `docs/tasks/log/T-204.md`. Faltan por completo todos los módulos de producción exigidos por la ficha:
  1. `src/lib/hooks/use-realtime-invalidation.ts` (hook compartido de suscripción a Supabase Realtime con 1 canal por pantalla, desuscripción al desmontar e invalidación de TanStack Query con debounce).
  2. `src/features/requests/query-keys.ts` (`requestKeys`).
  3. `src/features/offers/query-keys.ts` (`offerKeys`).
  4. `src/features/trips/query-keys.ts` (`tripKeys`).
  5. `src/features/offers/hooks/use-available-requests.ts` (`useAvailableRequests`).
  6. `src/features/trips/hooks/use-trip.ts` (`useTrip`).
  7. `src/features/requests/hooks/use-request-offers.ts` sigue con la implementación provisional de `T-113` (líneas 60-95), que guarda las ofertas en `useState` (`setOffers`) y **escribe la caché del cliente a mano** desde el payload crudo de Realtime (`normalizeRealtimeOffer(raw)`), violando el invariante central del DoD de `T-204`.
- **Qué hay que hacer:** Implementar los 3 archivos `query-keys.ts`, el hook `src/lib/hooks/use-realtime-invalidation.ts`, los hooks `useAvailableRequests` y `useTrip`, y migrar `useRequestOffers` a TanStack Query (`useQuery`) + `useRealtimeInvalidation` eliminando `normalizeRealtimeOffer` y la mutación manual del estado con el payload de Realtime.

---

### 2. `PR82-H02` · `pnpm typecheck` y el job `typecheck` de CI fallan con 5 errores TypeScript (incluyendo `TS7006` por `any` implícito y `TS2353`) · **BLOQUEANTE**

- **Archivo:** `src/features/offers/hooks/use-available-requests.test.tsx:5, 109`, `src/features/requests/hooks/use-request-offers.test.tsx:96`, `src/features/trips/hooks/use-trip.test.tsx:5`, `src/lib/hooks/use-realtime-invalidation.test.tsx:5`
- **Severidad:** `alto` | **Categoría:** `correctness` | **Patrón:** `P01-contrato-de-framework-no-verificado`
- **Qué pasa:** `pnpm typecheck` (y el job `typecheck` de CI en el run `35968073295`) falla con 5 errores:
  1. `src/features/offers/hooks/use-available-requests.test.tsx(5,38): error TS2307: Cannot find module './use-available-requests' or its corresponding type declarations.`
  2. `src/features/offers/hooks/use-available-requests.test.tsx(109,42): error TS7006: Parameter 'r' implicitly has an 'any' type.` (en `result.current.requests.some((r) => r.id === 'req-2')`).
  3. `src/features/requests/hooks/use-request-offers.test.tsx(96,11): error TS2353: Object literal may only specify known properties, and 'fetcher' does not exist in type 'UseRequestOffersOptions'.` (`UseRequestOffersOptions` en `src/features/requests/hooks/use-request-offers.ts:7-10` no declara la propiedad `fetcher?: () => Promise<MerchantOfferItem[]>`).
  4. `src/features/trips/hooks/use-trip.test.tsx(5,25): error TS2307: Cannot find module './use-trip' or its corresponding type declarations.`
  5. `src/lib/hooks/use-realtime-invalidation.test.tsx(5,41): error TS2307: Cannot find module './use-realtime-invalidation' or its corresponding type declarations.`
- **Qué hay que hacer:** Implementar los módulos con tipos explícitos de entrada/salida, agregar `readonly fetcher?: () => Promise<MerchantOfferItem[]>` en `UseRequestOffersOptions`, y verificar que `pnpm typecheck` finalice con código `0`.

---

### 3. `PR82-H03` · Suite de pruebas unitarias (`pnpm test`) y job `unit` de CI en rojo (4 suites de T-204 fallando) · **BLOQUEANTE**

- **Archivo:** `src/lib/hooks/use-realtime-invalidation.test.tsx:1`, `src/features/requests/hooks/use-request-offers.test.tsx:110`, `src/features/offers/hooks/use-available-requests.test.tsx:1`, `src/features/trips/hooks/use-trip.test.tsx:1`
- **Severidad:** `alto` | **Categoría:** `test-coverage` | **Patrón:** `P15-entregable-declarado-pero-no-ejecutable`
- **Qué pasa:** Tanto localmente (`pnpm test --run`) como en el job `unit` de CI (`35968073295`), las 4 suites de `T-204` fallan (`3` por módulos inexistentes y `use-request-offers.test.tsx` en la línea 110: `expected [ { id: 'offer-initial-1', …(11) } ] to have a length of 2 but got 1`).
- **Qué hay que hacer:** Completar la implementación hasta dejar todas las suites unitarias y el job `unit` de CI en verde.

---

### 4. `PR82-H04` · Prueba ciega en `use-request-offers.test.tsx:128-149` (y ausente en `use-available-requests.test.tsx` y `use-trip.test.tsx`): declara `invalidateSpy` sin afirmarlo y pasa hoy en verde sobre código que muta el estado a mano y no usa TanStack Query · **BLOQUEANTE**

- **Archivo:** `src/features/requests/hooks/use-request-offers.test.tsx:128-149`, `src/features/offers/hooks/use-available-requests.test.tsx:112-122`, `src/features/trips/hooks/use-trip.test.tsx:85-95`
- **Severidad:** `critico` | **Categoría:** `test-coverage` | **Patrón:** `P08-control-no-cubre-lo-que-dice`
- **Qué pasa:** Enumerando la clase entera (`AG-37`) sobre los tres hooks de features (`useRequestOffers`, `useAvailableRequests`, `useTrip`):
  1. En `src/features/requests/hooks/use-request-offers.test.tsx:128-149`, el caso `'DoD: Realtime no escribe la caché a mano, solo invalida queries'` declara en las líneas 129-130:
     ```ts
     const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
     const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
     ```
     Pero en el desenlace (línea 148) **solo afirma `expect(setQueryDataSpy).not.toHaveBeenCalled()` y jamás afirma `invalidateSpy` (`AG-66`) ni verifica que `result.current.offers` no haya sido mutado a mano por `setOffers(...)`**.
     **Demostración en vivo:** Al correr `pnpm vitest run src/features/requests/hooks/use-request-offers.test.tsx` sobre el árbol actual (`a2ab69a`), donde `use-request-offers.ts` **todavía tiene el código de T-113 que NO usa TanStack Query y muta `offers` a mano en cliente con `setOffers([...currentOffers, normalizeRealtimeOffer(raw)])`**, **¡este test pasa en verde (`✓ DoD: Realtime no escribe la caché a mano, solo invalida queries`)!**
     Pasa porque `use-request-offers.ts` escribe su propio `useState` en lugar de llamar a `queryClient.setQueryData`, y como el test nunca exige `expect(invalidateSpy).toHaveBeenCalledWith(...)` ni comprueba que `result.current.offers` permanezca en `1` oferta hasta que corra el `fetcher` de TanStack Query, el control aprueba exactamente el antipatrón que el DoD prohíbe (`AG-76`).
  2. En `src/features/offers/hooks/use-available-requests.test.tsx` y `src/features/trips/hooks/use-trip.test.tsx` falta por completo el test de este invariante del DoD.
- **Qué hay que hacer:**
  1. En `src/features/requests/hooks/use-request-offers.test.tsx:128-149`: con `vi.useFakeTimers()`, disparar `realtimeCallback` con `{ eventType: 'INSERT', new: { id: 'offer-3', amount_ars: 1700 } }`, verificar inmediatamente que `expect(result.current.offers).toHaveLength(1)` (no se inyectó el payload crudo en el estado), `expect(setQueryDataSpy).not.toHaveBeenCalled()` y `expect(invalidateSpy).not.toHaveBeenCalled()`; luego avanzar el reloj más allá del debounce (`vi.advanceTimersByTime(300)`) y afirmar `expect(invalidateSpy).toHaveBeenCalledTimes(1)` con la clave de `requestKeys` y `expect(setQueryDataSpy).not.toHaveBeenCalled()`.
  2. Añadir ese mismo caso de prueba (con fake timers, verificación de no mutación inmediata, `setQueryDataSpy` en 0 llamadas e `invalidateSpy` llamado 1 vez tras el debounce con `offerKeys` / `tripKeys`) en `src/features/offers/hooks/use-available-requests.test.tsx` y en `src/features/trips/hooks/use-trip.test.tsx`.

---

### 5. `PR82-H05` · Prueba ciega en `use-realtime-invalidation.test.tsx`: `DoD 3` anuncia múltiples tablas/eventos pero pasa una sola tabla, y `DoD 1` no verifica que el `unmount` cancele el timer de debounce pendiente · **BLOQUEANTE**

- **Archivo:** `src/lib/hooks/use-realtime-invalidation.test.tsx:54-72, 118-134`
- **Severidad:** `alto` | **Categoría:** `test-coverage` | **Patrón:** `P08-control-no-cubre-lo-que-dice`
- **Qué pasa:**
  1. En `src/lib/hooks/use-realtime-invalidation.test.tsx:118-134`, el test se titula `'DoD 3: un canal por pantalla aunque se escuchen múltiples tablas o eventos'`, pero su cuerpo llama a `useRealtimeInvalidation` con **una única tabla (`table: 'offers'`)** y solo verifica `expect(channelSpy).toHaveBeenCalledTimes(1)` y `expect(channelSpy).toHaveBeenCalledWith('merchant-dashboard')`. Cualquier implementación que solo acepte una tabla (o que no soporte múltiples filtros/tablas sobre el mismo canal) pasa el test sin ejercer lo que su título declara.
  2. En `DoD 1: al desmontar la pantalla se cierra el canal` (líneas 54-72), se afirma `expect(mockRemoveChannel).toHaveBeenCalledTimes(1)` sin verificar `expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)`, y sin comprobar qué ocurre si llega un evento Realtime y la pantalla se desmonta **antes** de que venza el debounce (`300ms`). Si el cleanup del `useEffect` no ejecuta `clearTimeout`, `queryClient.invalidateQueries` se dispara después del `unmount`.
- **Qué hay que hacer:**
  1. En `DoD 1`: afirmar `expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)` y demostrar que si se invoca `realtimeCallback(...)`, luego `unmount()`, y luego `vi.advanceTimersByTime(300)`, `invalidateSpy` **no** es llamado (`expect(invalidateSpy).not.toHaveBeenCalled()`).
  2. En `DoD 3`: pasar múltiples tablas/eventos (p. ej. `tables` o arreglo de suscripciones en el mismo canal de pantalla, o el contrato multi-evento que defina `useRealtimeInvalidation`) y verificar que `supabase.channel('merchant-dashboard')` y `.subscribe()` se llamen **una sola vez**, registrando múltiples `.on('postgres_changes', ...)` sobre ese único canal.

---

### 6. `PR82-H06` · Los 3 tests de hooks inyectan `refetchOnWindowFocus: true` y omiten el `staleTime: 60 * 1000` de `src/app/providers.tsx`, ocultando que con `initialData` el foco de ventana NO refetchea en producción durante los primeros 60 segundos · **BLOQUEANTE**

- **Archivo:** `src/features/requests/hooks/use-request-offers.test.tsx:34-41`, `src/features/offers/hooks/use-available-requests.test.tsx:34-41`, `src/features/trips/hooks/use-trip.test.tsx:24-31`
- **Severidad:** `alto` | **Categoría:** `test-coverage` | **Patrón:** `P08-control-no-cubre-lo-que-dice`
- **Qué pasa:** Enumerando los 3 archivos (`use-request-offers.test.tsx`, `use-available-requests.test.tsx`, `use-trip.test.tsx`), en los tres el `beforeEach` construye el `QueryClient` de prueba así:
  ```ts
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
  ```
  Esto introduce una doble trampa (`AG-77`):
  1. En producción (`src/app/providers.tsx:13`), `QueryClient` se instancia con `staleTime: 60 * 1000` (`60s`). En TanStack Query v5, cuando `useQuery` recibe `initialData` (`initialOffers`, `initialRequests`, `initialTrip`), esa data se marca como recién actualizada (`Date.now()`) y permanece **fresca (`fresh`) durante 60 segundos**. Con `refetchOnWindowFocus: true` (booleano), el evento `focus` de ventana **solo refetchea queries `stale`**, por lo que si un comerciante o repartidor con el push apagado sale a WhatsApp y vuelve a la app a los 20 segundos, **la oferta nueva NO aparece**. Para que el DoD (*"Con el push apagado, la oferta nueva aparece al volver a la app"*) se cumpla con `initialData` bajo el `staleTime: 60 * 1000` de `src/app/providers.tsx`, cada hook de datos en vivo debe pasar explícitamente `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'` (o `staleTime: 0`) en su `useQuery`.
  2. Como el `QueryClient` de los 3 tests omite `staleTime: 60 * 1000` (dejándolo en `0`) y además preconfigura `refetchOnWindowFocus: true` en el cliente, **los 3 tests pasan aunque el hook olvide por completo configurar `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`**.
- **Qué hay que hacer:**
  1. En los 3 archivos de test (`use-request-offers.test.tsx`, `use-available-requests.test.tsx`, `use-trip.test.tsx`), configurar el `QueryClient` del `beforeEach` con `staleTime: 60 * 1000, refetchOnWindowFocus: false, refetchOnReconnect: false` para que el test solo pueda pasar si el hook (`useRequestOffers`, `useAvailableRequests`, `useTrip`) declara explícitamente `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'` en `useQuery`.
  2. Verificar por mutación que al quitar `refetchOnWindowFocus: 'always'` del hook, el test se pone en rojo.

---

## Hallazgos NO BLOQUEANTES (MEJORAS)

### 7. `PR82-H07` · Falta ejercitar en los tests las fábricas de `query-keys.ts`, el polling de 30 s solo en pantallas activas y `refetchOnReconnect` · **MEJORA**

- **Archivo:** `docs/tasks/T-204.md:8`, `src/features/requests/hooks/use-request-offers.test.tsx`, `src/features/offers/hooks/use-available-requests.test.tsx`, `src/features/trips/hooks/use-trip.test.tsx`
- **Severidad:** `medio` | **Categoría:** `test-coverage` | **Patrón:** `P06-enumeracion-incompleta`
- **Qué pasa:** El Objetivo de `docs/tasks/T-204.md` pide explícitamente:
  - `query-keys.ts` por feature (`src/features/{requests,offers,trips}/query-keys.ts`): los tests actuales usan arreglos literales hardcodeados (`['requests', 'detail', 'req-123', 'offers']`, `['offers']`) en vez de importar y verificar `requestKeys`, `offerKeys` y `tripKeys`.
  - `polling de 30 s solo en pantallas activas`: ninguno de los tests verifica que `useQuery` configure `refetchInterval: 30_000` y `refetchIntervalInBackground: false` (para que el polling corra cada 30 s cuando la pantalla está activa y se detenga en segundo plano).
  - `refetchOnReconnect`: los tests disparan `window.dispatchEvent(new Event('focus'))`, pero ninguno comprueba la reconexión de red (`online`).
- **Qué hay que hacer:** Importar `requestKeys`, `offerKeys` y `tripKeys` en los tests y agregar aserciones para `refetchInterval: 30_000` con `refetchIntervalInBackground: false` y para `refetchOnReconnect`.

---

### 8. `PR82-H08` · Rebase pendiente sobre `origin/develop` (`9ab71cb` agregó `docs/tasks/T-204.md`) y sección `Informe de revisión de agy` pendiente en el cuerpo del PR · **MEJORA**

- **Archivo:** `docs/tasks/T-204.md:1-36`, PR #82 (cuerpo en GitHub)
- **Severidad:** `bajo` | **Categoría:** `conventions` | **Patrón:** `P19-cuerpo-de-pr-fuera-de-template`
- **Qué pasa:**
  1. `origin/develop` (`9ab71cb`, PR #84) ya incorporó la ficha oficial `docs/tasks/T-204.md`. Al retomar la tarea con `retomar-tarea` y hacer rebase sobre `origin/develop` (Regla 50), resolver el conflicto en `docs/tasks/T-204.md` manteniendo las rutas de `Archivos permitidos` expandidas (sin llaves `{requests,offers,trips}`, para que `permite()` de `tools/verify-fichas.test.ts` las evalúe correctamente) y el título/notas de `origin/develop`.
  2. Al finalizar la implementación y antes de pedir nueva revisión, correr la skill `revisar-pr`, pegar el informe en `### Informe de revisión de agy` del cuerpo del PR y marcar con `[x]` los ítems verificados del DoD.

---

## Lo que está bien planteado

- **Alcance respetado:** Los 6 archivos tocados en `a2ab69a` (`docs/tasks/T-204.md`, `docs/tasks/log/T-204.md`, `src/lib/hooks/use-realtime-invalidation.test.tsx`, `src/features/requests/hooks/use-request-offers.test.tsx`, `src/features/offers/hooks/use-available-requests.test.tsx`, `src/features/trips/hooks/use-trip.test.tsx`) caen 100 % dentro de los `Archivos permitidos` de `origin/develop:docs/tasks/T-204.md` (`9ab71cb`).
- **Expansión preventiva de llaves en `docs/tasks/T-204.md`:** Haber desglosado `src/features/{requests,offers,trips}/hooks/**` y `query-keys.ts` en 6 líneas individuales evita que `permite()` en `tools/verify-fichas.test.ts` (que solo interpreta `**` al final y no expande `{a,b,c}`) falle si en el futuro se cruza contra rutas de la ficha.
- **Test de ráfaga con debounce en `use-realtime-invalidation.test.tsx:74-116` (`DoD 2`):** La simulación de 3 eventos espaciados por `50ms` verificando `0` llamadas a `invalidateQueries` antes de los `300ms`, `1` sola llamada tras vencer la ventana de `300ms` y `0` llamadas a `setQueryData` está bien diseñada y ejerce de verdad el debounce.
