# Informe de revisión — PR #236 / T-333 — Ronda 4

**Head SHA revisado:** `4a339d4393f577ef46f3b817bec964c98bbb91d3`  
**Base:** `develop` @ `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (1)** — PR236-R01

## Delta desde Ronda 3

Desde `9e1d77af02fde30134aadbb872c6ca14b8059ce8` hay un único commit de autor y tres archivos:

- `src/features/requests/hooks/use-request-offers.ts`
- `src/features/requests/hooks/use-request-offers.test.tsx`
- `docs/tasks/log/T-333.md`

No se tocaron `docs/revision-pr/**`, Providers, Realtime ni el E2E externo.

## PR236-H01 — ARREGLADO-VERIFICADO

El fix agrega un latch de reconnect in-flight:

- al caer offline, recuerda si la query estaba fetching;
- al volver online, si sigue en vuelo la misma operación, marca refetch pendiente;
- tras el settle, si la query está idle y online, consume el pendiente una vez;
- cleanup desuscribe y limpia el latch.

Los tests nuevos son sustantivos:

- A: reconnect idle → exactamente `baseline + 1`;
- B: reconnect con fetch #1 pendiente → 1 antes del settle, 2 después;
- C: sin reconnect → sigue en 1;
- D: unmount antes del settle → sigue en 1.

La mutación M5 neutraliza solo el latch y deja RED B mientras idle y Realtime siguen verdes.

CI exact-head `4a339d4393f577ef46f3b817bec964c98bbb91d3` ejecutó:

```text
use-request-offers.test.tsx          17/17
use-realtime-invalidation.test.tsx   12/12
providers.test.tsx                    1/1
Test Files                         115/115
Tests                            1747/1747
```

Por lo tanto H01 queda **arreglado-verificado** en `4a339d4393f577ef46f3b817bec964c98bbb91d3`.

## PR236-R01 — BLOQUEANTE NUEVO

**Título:** Un refetch competidor puede hacer que el latch dispare una tercera GET  
**Severidad:** alta  
**Categoría:** correctness  
**Patrón:** `P01-contrato-de-framework-no-verificado`

### Problema

El código intenta identificar una operación con:

```ts
state.dataUpdateCount + state.errorUpdateCount
```

Ese valor cambia cuando una operación **termina** con éxito/error. No cambia cuando empieza un fetch nuevo.

La lógica posterior hace:

```text
pending = contador capturado
si contador actual != pending:
  limpiar pending
  si fetchStatus === idle:
    refetch()
```

Eso funciona cuando solo existe el fetch viejo.

Pero T-333 también agrega catch-up de Realtime, que usa `invalidateQueries()`. TanStack documenta que `invalidateQueries/refetch` usa `cancelRefetch: true` por defecto: si hay una request en curso, puede cancelarla y arrancar otra nueva.

### Secuencia problemática

```text
fetch #1 en vuelo
offline
online -> latch pendiente para operación N

Realtime vuelve a SUBSCRIBED
-> invalidateQueries()
-> TanStack cancela/reemplaza #1
-> arranca fetch #2
-> #2 termina con datos frescos
-> dataUpdateCount pasa N -> N+1
-> effect del latch ve "contador cambió + idle"
-> interpreta que terminó #1
-> dispara fetch #3
```

El comentario del código dice «si ya arrancó otro fetch después del reconnect, ese trae los datos nuevos», pero el mecanismo actual solo evita el duplicado si logra observar ese otro fetch mientras todavía está `fetching`. Si ya terminó antes del effect, la generación se perdió.

### Por qué los tests no lo detectan

B solo deja terminar el fetch original. No existe un segundo refetch competidor entre reconnect y settle.

M5 también neutraliza el latch entero; demuestra que el latch es necesario para H01, pero no que su identificación de generación sea correcta.

### RED requerido

Agregar un caso E:

1. llamada #1 deferred y pendiente;
2. offline → online;
3. confirmar llamadas = 1;
4. llamar `queryClient.invalidateQueries({ queryKey: requestKeys.offers(requestId) })` mientras #1 sigue activa;
5. eso debe arrancar #2;
6. #2 devuelve datos nuevos;
7. esperar settle;
8. total final obligatorio: **exactamente 2**;
9. nunca debe aparecer #3.

Contra el HEAD actual se espera RED si el latch confunde el settle de #2 con el de #1.

### Arreglo esperado

No se prescribe una API concreta, pero el mecanismo debe identificar **generaciones de fetch**, no solo settles.

Una opción simple es un contador/ref incrementado al entrar realmente al `queryFn`:

- capturar generación activa al offline/reconnect;
- si aparece una generación nueva después del reconnect, limpiar el pending porque ya existe un fetch fresco;
- solo disparar refetch diferido si la generación pendiente termina sin que haya comenzado otra.

El test E debe quedar GREEN y B debe seguir GREEN.

Mutación obligatoria del nuevo control: neutralizar la detección de «fetch nuevo ya arrancado» debe dejar RED E, sin romper B ni idle.

## PR236-H02 — REABIERTO como mejora

El body estaba correcto en R3, pero quedó viejo otra vez después de `4a339d4393f577ef46f3b817bec964c98bbb91d3`:

- sigue diciendo «Estado del reconnect en navegador real: abierto»;
- dice que la causa sigue sin identificar;
- no describe el latch ni sus nuevos tests.

Actualizar el body recién cuando R01 quede cerrado para no repetir trabajo.

## CI / Preview

```text
CI 37147483662
unit: 1747/1747
typecheck: success
lint: success
build: success
db-tests: success
bundle-budget: success
audit: failure por braces (externo)
```

```text
Preview 37147561319
checkout: 4a339d4393f577ef46f3b817bec964c98bbb91d3
chromium: 20 passed
global-settings: 3 passed
```

## Checklist

- [x] H01 tiene RED/GREEN específico.
- [x] Idle reconnect exactamente +1.
- [x] In-flight reconnect exactamente +1.
- [x] Sin reconnect no refetchea extra.
- [x] Unmount no deja refetch tardío.
- [x] CI exact-head verde salvo audit externo.
- [ ] Refetch competidor no provoca una tercera GET.
- [ ] Mutación de generación deja RED solo ese caso.
- [ ] Body actualizado al estado final.
- [ ] PR #180 trusted Preview post-merge.
