# Evidencia reproducible — PR #236 / T-333

## Ronda 5 — SHA y delta

```text
base develop: bc6329d941a510cc37d23827f5e3798e3839c065
commit revisión R4: 894acbbb6b8e727d5d0f8b1541ff2a5b977b9032
head técnico R5: 90ce6d1ea5d781211a95e96bd46d830ca916f0b4
delta autor:
  docs/tasks/log/T-333.md
  src/features/requests/hooks/use-request-offers.test.tsx
  src/features/requests/hooks/use-request-offers.ts
```

## Control E — refetch competidor

Propiedad commiteada:

```text
fetch #1 deferred y activo
offline
online
calls = 1
invalidateQueries(queryKey)
fetch #2 empieza y reemplaza #1
fetch #2 trae newOffer
query idle
flush
calls final = 2
nunca #3
```

Implementación:

```text
fetchGenerationRef++
al entrar realmente al queryFn

pending = generación activa al reconnect

si fetchGenerationRef.current > pending:
  ya arrancó un fetch posterior
  limpiar pending
  NO refetch

si query idle
y no hubo generación posterior
y sigue online:
  refetch una vez
```

## RED/GREEN declarado por bitácora

```text
pre-fix test E:
  expected spy to be called 2 times, but got 3
  1 failed | 17 passed

post-fix:
  18 passed
```

M6 declarada por autor:

```text
neutralizar detección generation > pending
-> E RED
-> resto focal GREEN
restaurado -> GREEN
```

La mutación no fue ejecutada por la revisión; se conserva como evidencia del autor. La verificación independiente usa el test commiteado + CI exact-head.

## CI exact-head

Run `37148322479`:

```text
use-request-offers.test.tsx          18 passed
use-realtime-invalidation.test.tsx   12 passed
providers.test.tsx                    1 passed
Test Files                          115 passed
Tests                             1748 passed
typecheck                           success
lint                                success
build                               success
db-tests                            success
bundle-budget                       success
audit                               failure por braces (externo a T-333/T-332)
```

## Preview exact-head

Run `37148389680`:

```text
checkout: 90ce6d1ea5d781211a95e96bd46d830ca916f0b4
gate: success

Chromium:
  19 passed
  1 flaky
  flaky: T-303 / main-flow / medio de pago transferencia
  causa observada: waitForURL login timeout
  retry #1: passed

global-settings:
  3 passed
```

El flaky está fuera del delta/objetivo de T-333 y el workflow terminó success.

## Alcance

Anti-adulteración R5:

```text
.skip/.only: no
sleeps/setTimeout nuevos: no
force:true: no
router.refresh: no
/api/health manual: no
setQueryData runtime: no
notifications.spec.ts: sin cambios
```

## Estado final

```text
PR236-H01: arreglado-verificado
PR236-R01: arreglado-verificado
PR236-H02: arreglado-verificado
bloqueantes: 0
```

Pendiente por contrato después del merge:

```text
PR #180
sync con develop
trusted Preview
e2e/specs/notifications.spec.ts
3 tests GREEN
```
