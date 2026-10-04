# Informe de revisión — PR #236 / T-333 — Ronda 3

**Head SHA revisado:** `6a080cf2ccdd675e6be9ae69a517200f172af506`  
**Base:** `develop` @ `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (1)** — PR236-H01

## Delta desde Ronda 2

Desde `52d492c845c61489c54fcb46e2f360d86bc827d6` hay un único commit de autor y tres archivos:

- `src/app/providers.tsx`
- `src/app/providers.test.tsx`
- `docs/tasks/log/T-333.md`

El autor no tocó `docs/revision-pr/**` ni `e2e/specs/notifications.spec.ts`.

## Qué quedó verificado

- M3b («solo sync inicial») quedó GREEN: el test anterior no demostraba necesidad del bridge.
- La secuencia online → offline → online con `Providers` real quedó GREEN tanto antes como después del bridge.
- El bridge global se revirtió; decisión correcta.
- El nuevo test de Providers cubre el camino framework normal y pasa en CI.
- M1 y M2 permanecen documentadas y los focales actuales pasan.
- El cuerpo del PR fue actualizado y ya describe el HEAD real: **PR236-H02 queda arreglado-verificado**.

## PR236-H01 — BLOQUEANTE

### Causa residual identificada

El unit nuevo de reconnect en `use-request-offers.test.tsx` hace:

```text
esperar fetch inicial
esperar isRefetching = false
baseline
offline
online
esperar llamada > baseline
```

Eso prueba el reconnect **cuando la query ya está idle**.

El trusted E2E real no hace lo mismo. Su baseline se fija con `page.waitForResponse()`, que ocurre antes de que el `queryFn` haya terminado todo su trabajo.

El trace de PR #180 / run `37138561471` muestra, en monotonic time:

```text
GET /offers start          257772.302
setOffline(true)           258355.249
GET /offers fin aprox.     258357.266
chunk dinámico start       258357.606
setOffline(false)          258371.588
chunk dinámico fin         258388.389
```

Es decir:

- el corte empieza ~2 ms antes de terminar la GET inicial;
- después de la respuesta, el `queryFn` todavía espera el chunk de `import('@/lib/live-contracts')`;
- la reconexión ocurre ~16 ms después del corte, **mientras ese import dinámico sigue en vuelo**.

Por lo tanto, la query todavía está fetching cuando vuelve online.

### Comportamiento de TanStack que explica el RED

TanStack Query v5 implementa `Query.onOnline()` llamando:

```ts
observer?.refetch({ cancelRefetch: false })
```

Su contrato de refetch dice que con `cancelRefetch: false`, si ya existe un fetch en curso, no empieza otro: retorna la promesa actual.

Eso coincide exactamente con el trusted E2E:

```text
reconnect ocurre durante fetch inicial
→ onOnline intenta refetch con cancelRefetch:false
→ fetch existente se reutiliza
→ no hay segunda GET
→ query inicial termina
→ no queda otro evento que provoque refetch
→ count permanece 1 hasta polling
```

Referencias de framework consultadas:
- TanStack Query `query.ts`, `onOnline()`;
- TanStack `RefetchOptions.cancelRefetch`.

### Por qué el PR actual no corrige el defecto B

El runtime de `useRequestOffers` sigue igual. Solo se fortaleció el test del camino idle.

Así, la PR ya corrige el defecto A (readiness Realtime), pero el defecto B del origen de T-333 sigue reproducible conceptualmente y sin cambio de producción.

### RED obligatorio para la próxima ronda

En `use-request-offers.test.tsx`:

1. primera llamada del fetcher queda controladamente pendiente;
2. montar el hook con `initialDataUpdatedAt: 0`;
3. esperar a que esa primera llamada haya empezado y confirmar `isRefetching === true`;
4. `onlineManager.setOnline(false)`;
5. `onlineManager.setOnline(true)` **sin resolver todavía la primera llamada**;
6. resolver la primera llamada con datos viejos;
7. exigir que ocurra una segunda llamada automática;
8. segunda llamada devuelve datos nuevos;
9. exigir exactamente el resultado nuevo.

Con el HEAD actual, ese test debe quedar RED porque la reconexión fue consumida mientras la primera promesa seguía activa.

### Requisito de implementación

La corrección debe cubrir únicamente esta carrera:

- si offline → online sucede con la query idle, dejar que TanStack haga su reconnect normal;
- si el reconnect sucede mientras el fetch iniciado antes/durante el corte todavía sigue activo, garantizar **un solo refetch posterior al settle**;
- no producir una tercera llamada en el camino normal;
- limpiar cualquier suscripción/latch al desmontar;
- no reintroducir el bridge global;
- no tocar ni relajar PR #180;
- no usar sleeps, polling adicional, `router.refresh()`, health checks ni escritura manual de caché.

Una implementación equivalente puede usar un latch de «reconnect pendiente» dentro de `useRequestOffers`; la revisión no exige una forma concreta mientras los tests demuestren:
- idle reconnect: exactamente una llamada adicional;
- in-flight reconnect: exactamente una llamada adicional después del settle;
- sin reconnect: ninguna llamada adicional;
- unmount: ninguna llamada tardía.

## Checks exact-head

```text
CI 37146402120
unit: 115/115 files · 1744/1744 tests
typecheck: success
lint: success
build: success
db-tests: success
bundle-budget: success
audit: failure por braces (externo)
```

```text
Preview 37146488624
checkout: 6a080cf2ccdd675e6be9ae69a517200f172af506
chromium: 20 passed
global-settings: 3 passed
```

## Checklist

- [x] Bridge incorrecto descartado y revertido.
- [x] Cuerpo del PR actualizado.
- [x] Causa browser-only identificada con trace + contrato de TanStack.
- [x] Realtime readiness mantiene cobertura.
- [ ] RED de reconnect durante fetch en vuelo.
- [ ] Runtime corrige esa carrera sin duplicar idle reconnect.
- [ ] Mutación del nuevo mecanismo deja ese RED.
- [ ] CI final.
- [ ] PR #180 trusted Preview post-merge.
