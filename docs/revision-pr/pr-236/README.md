# PR #236 — T-333 · Cerrar carreras de Realtime y reconexión real en ofertas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/236 |
| **Tarea** | T-333 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-333-realtime-reconnect` → `develop` |
| **Base revisada** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **HEAD técnico revisado** | `90ce6d1ea5d781211a95e96bd46d830ca916f0b4` |
| **Estado** | **SIN BLOQUEANTES** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7` | 1 bloqueante | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `7a0247af065864f3906887f54160542e977d04aa` | 1 bloqueante residual + 1 mejora | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `6a080cf2ccdd675e6be9ae69a517200f172af506` | 1 bloqueante | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `4a339d4393f577ef46f3b817bec964c98bbb91d3` | H01 cerrado + 1 regresión bloqueante | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `90ce6d1ea5d781211a95e96bd46d830ca916f0b4` | **sin bloqueantes** | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR236-H01 | El reconnect se pierde si vuelve online mientras el fetch inicial sigue en vuelo | alto | arreglado-verificado |
| PR236-R01 | Un refetch competidor puede hacer que el latch dispare una tercera GET | alto | arreglado-verificado |
| PR236-H02 | El cuerpo del PR contradice el HEAD actual | bajo | arreglado-verificado |

## Ronda 5 — conclusión

El arreglo final usa una **generación de fetch** incrementada al entrar realmente al `queryFn`.

Eso permite distinguir:

- la operación que ya estaba en vuelo cuando ocurrió offline → online;
- un fetch nuevo iniciado después del reconnect por otra causa;
- el caso normal donde no arrancó una generación posterior y corresponde un único refetch diferido.

El test E reproduce la interacción con `invalidateQueries()` mientras #1 sigue pendiente y exige exactamente dos llamadas; contra el estado de R4 daba 3 y con el HEAD actual queda en 2.

## Evidencia exact-head

CI `37148322479` sobre `90ce6d1ea5d781211a95e96bd46d830ca916f0b4`:

- `use-request-offers.test.tsx`: **18/18**;
- `use-realtime-invalidation.test.tsx`: **12/12**;
- `providers.test.tsx`: **1/1**;
- suite: **115/115 archivos, 1748/1748 tests**;
- typecheck: verde;
- lint: verde;
- build: verde;
- db-tests: verde;
- bundle-budget: verde;
- audit: rojo únicamente por `braces`, externo a T-333/T-332.

Preview `37148389680`:

- checkout exacto `90ce6d1ea5d781211a95e96bd46d830ca916f0b4`;
- gate: **success**;
- bloque Chromium: 19 passed + 1 flaky de T-303 que pasó en retry;
- global-settings: **3/3**;
- el flaky fue `main-flow.spec.ts` / flujo de transferencia, timeout de `waitForURL` en login, ajeno a T-333.

La rama está mergeable y `0` commits detrás de `develop`.

## Pendiente obligatorio post-merge

La ficha T-333 exige explícitamente que, **después del merge**, PR #180 se sincronice con `develop` y ejecute sus 3 tests de `e2e/specs/notifications.spec.ts` en trusted Preview.

Ese gate no puede completarse antes del merge y no deja bloqueantes técnicos abiertos en #236.
