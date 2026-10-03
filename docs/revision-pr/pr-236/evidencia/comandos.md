# Evidencia reproducible — PR #236 / T-333

## Ronda 4 — SHA y delta

```text
base develop: bc6329d941a510cc37d23827f5e3798e3839c065
commit revisión R3: 9e1d77af02fde30134aadbb872c6ca14b8059ce8
head técnico R4: 4a339d4393f577ef46f3b817bec964c98bbb91d3
delta:
  docs/tasks/log/T-333.md
  src/features/requests/hooks/use-request-offers.test.tsx
  src/features/requests/hooks/use-request-offers.ts
```

## CI exact-head

Run `37147483662`:

```text
use-request-offers.test.tsx          17 passed
use-realtime-invalidation.test.tsx   12 passed
providers.test.tsx                    1 passed
Test Files                          115 passed
Tests                             1747 passed
typecheck                           success
lint                                success
build                               success
db-tests                            success
bundle-budget                       success
audit                               failure por braces (externo)
```

Preview `37147561319`:

```text
checkout 4a339d4393f577ef46f3b817bec964c98bbb91d3
20 chromium passed
3 global-settings passed
```

## H01 verificado

Control B:

```text
fetch #1 pending
offline
online
calls = 1
resolve #1
wait calls = 2
new data visible
flush
calls = 2
```

Controles adicionales:

```text
A idle reconnect: baseline + 1 exacto
C sin reconnect: 1 llamada
D unmount antes del settle: 1 llamada
```

Bitácora declara:

```text
M5 latch neutralizado:
  B RED
  idle GREEN
  Realtime GREEN
restaurado:
  todos GREEN
```

## PR236-R01 — contrato que falta cubrir

Documentación oficial actual de TanStack:

```text
RefetchOptions.cancelRefetch
default: true

true:
  una request actualmente corriendo se cancela antes de realizar una nueva

false:
  no se hace un nuevo refetch si ya hay una request en curso
```

`InvalidateOptions` hereda `RefetchOptions`.

Referencias:
- https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/RefetchOptions
- https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/InvalidateOptions
- https://github.com/TanStack/query/blob/main/packages/query-core/src/query.ts

## RED esperado para R01

Test E:

```text
fetch #1 deferred y activo
offline
online
latch armado
calls = 1

queryClient.invalidateQueries(queryKey)
-> TanStack puede cancelar #1
-> fetch #2 empieza
-> #2 devuelve datos frescos

esperar idle
flush effects

REQUERIDO:
calls = 2

HEAD actual:
riesgo de calls = 3 porque updateCount cambió al settle de #2 y el latch no sabe que #2 ya era una generación nueva
```

## Arreglo conceptual

Rastrear generación de fetch iniciada, no solo contadores de settle.

Ejemplo de propiedad:

```text
pendingGeneration = generación activa al reconnect

si generation actual > pendingGeneration:
  ya arrancó un fetch posterior al reconnect
  limpiar pending
  NO refetch diferido

si generation actual == pendingGeneration
y esa generación termina
y seguimos online:
  refetch una vez
```

La implementación concreta puede variar; el test debe demostrar el contrato.
