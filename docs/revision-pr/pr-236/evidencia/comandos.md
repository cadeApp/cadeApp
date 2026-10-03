# Evidencia reproducible — PR #236 / T-333

## Ronda 1

Ver `revisiones/ronda-1.md`. SHA técnico: `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7`.

Trusted E2E de origen, PR #180 / run `37138561471`:

```text
GET inicial ofertas: HTTP 200
baseline: 1
offline: aviso visible
online: aviso desaparece
15 s después: count = 1
resultado reconnect: RED
```

## Ronda 2 — SHA y delta

```text
base develop: bc6329d941a510cc37d23827f5e3798e3839c065
commit revisión R1: 47bd862d184d9319ba51be6b8121a86a96495d4d
head R2: 7a0247af065864f3906887f54160542e977d04aa
delta desde R1: 1 commit
archivos del autor desde R1:
  docs/tasks/log/T-333.md
  src/app/providers.test.tsx
  src/app/providers.tsx
```

## CI exact-head R2

CI `37144660539`:

```text
unit: SUCCESS
  src/app/providers.test.tsx                   1/1
  src/features/requests/hooks/use-request-offers.test.tsx 14/14
  src/lib/hooks/use-realtime-invalidation.test.tsx        12/12
  Test Files: 115 passed (115)
  Tests: 1744 passed (1744)
typecheck: SUCCESS
lint: SUCCESS
build: SUCCESS
db-tests: SUCCESS
bundle-budget: SUCCESS
audit: FAILURE
  braces <= 3.0.3
  Severity: 2 moderate | 1 high
  externo a T-333 / canalizado por T-332
```

Preview trusted `37144748472`:

```text
checkout: 7a0247af065864f3906887f54160542e977d04aa
chromium: 20 passed
global-settings: 3 passed
notifications.spec.ts: no está en este SHA
```

## Comportamiento documentado de TanStack

Documentación oficial de TanStack Query v5:

- `onlineManager` asume conexión activa y escucha por defecto `online` / `offline` en `window`.
- `onlineManager.setEventListener` reemplaza la fuente de conectividad.
- `QueryClientProvider` llama `client.mount()/unmount()`, y el cliente se suscribe a eventos focus/online.

Referencias:
- https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/OnlineManager
- https://tanstack.com/query/latest/docs/framework/react/reference/functions/QueryClientProvider

Esto hace que el mapping de eventos del bridge nuevo no sea, por sí solo, una diferencia respecto del comportamiento default.

## Mutación que falta — M3b: solo sync inicial

Reemplazar temporalmente el effect actual por:

```ts
useEffect(() => {
  onlineManager.setOnline(navigator.onLine !== false);
}, []);
```

Sin `setEventListener` personalizado.

Ejecutar:

```bash
pnpm vitest run src/app/providers.test.tsx
```

Interpretación:

- GREEN: el test actual no demuestra que el bridge sea necesario; solo demuestra sync inicial.
- RED: inspeccionar exactamente qué aserción falla antes de atribuirlo al reconnect.

Restaurar en `finally`.

## Control discriminante obligatorio — secuencia real

En `src/app/providers.test.tsx`, usar el `Providers` real y un hijo con query activa.

Propiedad:

```text
inicio online
fetch inicial terminado
baseline = N
offline event -> onlineManager false
online event  -> onlineManager true
queryFn calls > baseline
```

No usar sleeps ni refetch manual.

Ejecutar en dos árboles:

```text
A) 47bd862 + solo el import React requerido por Vitest
B) HEAD actual
```

Esperado metodológico, no resultado prefijado:

- A RED / B GREEN => el bridge queda demostrado.
- A GREEN / B GREEN => el bridge no explica el trusted E2E; no fabricar RED.
- ambos RED => el problema sigue abierto.

## Mutaciones ya conservadas

M1:

```text
refetchOnReconnect:'always' -> false
esperado: reconnect posterior al baseline RED
restaurado: offers 14/14
```

M2:

```text
quitar catch-up SUBSCRIBED
esperado: readiness RED
restaurado: realtime 12/12
```

## Mejora H02

El body del PR todavía contiene:

```text
src/app/providers.tsx: sin cambios
Diagnóstico de reconexión (abierto)
... un bridge en Providers lo duplicaría ...
```

Eso ya no describe el HEAD `7a0247af065864f3906887f54160542e977d04aa`. Actualizarlo antes de cierre.
