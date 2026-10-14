# Informe de revisión — PR #236 / T-333 — Ronda 5

**Head técnico revisado:** `90ce6d1ea5d781211a95e96bd46d830ca916f0b4`  
**Base:** `develop` @ `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **SIN BLOQUEANTES**

## Delta desde Ronda 4

Desde `894acbbb6b8e727d5d0f8b1541ff2a5b977b9032` hay un único commit de autor y solo:

- `src/features/requests/hooks/use-request-offers.ts`
- `src/features/requests/hooks/use-request-offers.test.tsx`
- `docs/tasks/log/T-333.md`

No se tocaron `docs/revision-pr/**`, Providers, Realtime ni `e2e/specs/notifications.spec.ts`.

## PR236-R01 — ARREGLADO-VERIFICADO

### Implementación

El HEAD abandona `dataUpdateCount + errorUpdateCount` como identificador de operación y agrega:

```ts
const fetchGenerationRef = useRef(0)

queryFn: async (...) => {
  fetchGenerationRef.current += 1
  ...
}
```

El latch captura la generación que estaba activa durante offline → online.

Antes de disparar el refetch diferido:

```text
si generación actual > generación pendiente:
  ya empezó un fetch posterior al reconnect
  limpiar pendiente
  no refetch
```

Si ninguna generación posterior arrancó y la query vuelve a idle, consume el pendiente una sola vez con `refetch({ cancelRefetch:false })`.

### Test E

El nuevo test usa la interacción real:

```text
#1 deferred en vuelo
offline
online
calls = 1
invalidateQueries(queryKey)
#2 reemplaza #1
#2 trae datos frescos
query idle
calls final = 2
nunca #3
```

La bitácora registra el RED pre-fix:

```text
expected spy to be called 2 times, but got 3
1 failed | 17 passed
```

y el GREEN final 18/18.

La mutación M6 neutraliza solo la detección de generación posterior y deja RED E mientras los demás casos quedan verdes. Esa mutación es evidencia del autor; la verificación independiente de esta ronda se basa en la inspección del control y la ejecución CI exact-head del test ya commiteado.

### Verificación independiente

CI `37148322479`:

```text
use-request-offers.test.tsx          18/18
use-realtime-invalidation.test.tsx   12/12
providers.test.tsx                    1/1
Test Files                          115/115
Tests                             1748/1748
typecheck                           success
lint                                success
build                               success
db-tests                            success
bundle-budget                       success
audit                               failure: braces (externo)
```

R01 queda **arreglado-verificado** en `90ce6d1ea5d781211a95e96bd46d830ca916f0b4`.

## PR236-H02 — ARREGLADO-VERIFICADO

El body actual ya describe:

- causa Realtime;
- causa reconnect del trace;
- latch por generación;
- protección contra refetch competidor;
- casos A-E;
- mutaciones M1/M2/M4/M5/M6;
- control externo post-merge en #180.

Ya no contiene el diagnóstico viejo de «causa browser sin identificar».

## Preview exact-head

Workflow `37148389680`:

```text
checkout: 90ce6d1ea5d781211a95e96bd46d830ca916f0b4
status: success
Chromium:
  19 passed
  1 flaky (T-303 flujo transferencia; waitForURL login)
  flaky pasó en retry #1
global-settings:
  3 passed
```

El flaky es ajeno a los archivos/contratos de T-333 y el gate terminó success; no se abre hallazgo para esta PR.

## Anti-adulteración

En el delta de R5 no aparecen:

- `.skip` / `.only`;
- sleeps/setTimeout para fabricar carrera;
- `force:true`;
- health checks manuales;
- `router.refresh()`;
- cambios a `notifications.spec.ts`;
- escritura manual de caché;
- expectativas debilitadas para convertir RED en GREEN.

## DoD antes del merge

- [x] Catch-up seguro al `SUBSCRIBED`.
- [x] Realtime solo invalida; no escribe caché.
- [x] Reconnect idle produce exactamente una llamada nueva.
- [x] Reconnect durante fetch en vuelo produce exactamente una llamada post-settle.
- [x] Refetch competidor evita una tercera llamada.
- [x] Mutaciones M1/M2/M5/M6 discriminan las propiedades declaradas según bitácora.
- [x] CI exact-head verde salvo audit externo.
- [x] Body y bitácora al día.
- [x] Sin cambios fuera de alcance.

## DoD post-merge

- [ ] Sincronizar PR #180 con `develop`.
- [ ] Ejecutar los 3 tests de `e2e/specs/notifications.spec.ts` en trusted Preview.
- [ ] Los 3 deben quedar GREEN sin modificar/debilitar el spec.

**Conclusión:** #236 queda sin bloqueantes técnicos para merge. La validación #180 es deliberadamente posterior al merge por contrato de T-333.
