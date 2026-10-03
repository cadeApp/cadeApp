# PR #236 — T-333 · Cerrar carreras de Realtime y reconexión real en ofertas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/236 |
| **Tarea** | T-333 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-333-realtime-reconnect` → `develop` |
| **Base revisada** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **HEAD revisado** | `6a080cf2ccdd675e6be9ae69a517200f172af506` |
| **Estado** | **BLOQUEADA — PR236-H01** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7` | 1 bloqueante | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `7a0247af065864f3906887f54160542e977d04aa` | 1 bloqueante residual + 1 mejora | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `6a080cf2ccdd675e6be9ae69a517200f172af506` | 1 bloqueante | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR236-H01 | El reconnect se pierde si vuelve online mientras el fetch inicial sigue en vuelo | alto | parcial |
| PR236-H02 | El cuerpo del PR contradice el HEAD actual | bajo | arreglado-verificado |

## Ronda 3 — conclusión

Agy demostró correctamente que el bridge global de R1 **no era la causa**: la secuencia online → offline → online ya quedaba GREEN antes del bridge, así que lo revirtió. El body del PR también quedó actualizado.

La causa residual del trusted E2E sí quedó identificada en esta ronda:

1. `useRequestOffers` arranca un refetch inmediato por `initialDataUpdatedAt: 0`.
2. El E2E fija baseline al recibir el HTTP 200, no al terminar el `queryFn`.
3. En el trace del run `37138561471`, `setOffline(true)` ocurre antes de que termine la GET inicial.
4. Apenas termina esa GET, comienza el chunk dinámico requerido por `await import('@/lib/live-contracts')`.
5. `setOffline(false)` ocurre mientras ese chunk todavía está descargándose; el `queryFn` sigue en vuelo.
6. TanStack Query v5 ejecuta reconnect con `observer.refetch({ cancelRefetch: false })`; si ya hay fetch en curso, reutiliza su promesa y **no inicia otra GET**.

Por eso el unit actual queda verde: deliberadamente espera `isRefetching === false` antes de offline → online y evita la carrera que sucede en navegador real.

## Evidencia exact-head

CI `37146402120` sobre `6a080cf2ccdd675e6be9ae69a517200f172af506`:

- unit: **115/115 archivos, 1744/1744 tests**;
- `use-request-offers.test.tsx`: 14/14;
- `use-realtime-invalidation.test.tsx`: 12/12;
- `providers.test.tsx`: 1/1;
- typecheck, lint, build, db-tests y bundle-budget: verdes;
- audit: rojo únicamente por `braces`, externo a T-333/T-332.

Preview trusted `37146488624`:

- checkout exacto `6a080cf2ccdd675e6be9ae69a517200f172af506`;
- chromium: 20/20;
- global-settings: 3/3;
- `notifications.spec.ts` sigue viviendo en PR #180, no en este SHA.

## Qué falta

Agregar un RED específico en `use-request-offers.test.tsx` donde offline → online ocurra **mientras el fetch inicial sigue pendiente**. El control debe quedar rojo con el código actual y verde solo cuando `useRequestOffers` garantice exactamente un refetch posterior al fetch en vuelo.

El camino normal, con query idle al reconectar, debe seguir delegado a `refetchOnReconnect: 'always'` sin duplicar requests.

No se toca `e2e/specs/notifications.spec.ts`. Tras resolver esta carrera, PR #180 sigue siendo la validación externa post-merge exigida por la ficha.
