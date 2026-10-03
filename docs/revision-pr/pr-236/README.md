# PR #236 — T-333 · Cerrar carreras de Realtime y reconexión real en ofertas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/236 |
| **Tarea** | T-333 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-333-realtime-reconnect` → `develop` |
| **Base revisada** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **HEAD revisado** | `4a339d4393f577ef46f3b817bec964c98bbb91d3` |
| **Estado** | **BLOQUEADA — PR236-R01** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7` | 1 bloqueante | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `7a0247af065864f3906887f54160542e977d04aa` | 1 bloqueante residual + 1 mejora | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `6a080cf2ccdd675e6be9ae69a517200f172af506` | 1 bloqueante | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `4a339d4393f577ef46f3b817bec964c98bbb91d3` | H01 cerrado + 1 regresión bloqueante | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR236-H01 | El reconnect se pierde si vuelve online mientras el fetch inicial sigue en vuelo | alto | arreglado-verificado |
| PR236-R01 | Un refetch competidor puede hacer que el latch dispare una tercera GET | alto | abierto |
| PR236-H02 | El cuerpo del PR contradice el HEAD actual | bajo | abierto |

## Ronda 4 — conclusión

La carrera original H01 quedó corregida:

- el nuevo test deja la primera Promise en vuelo;
- reconnect ocurre con esa operación activa;
- no aparece una segunda llamada antes del settle;
- al terminar el fetch viejo aparece exactamente una llamada adicional;
- sin reconnect no aparece llamada extra;
- unmount evita trabajo tardío;
- la mutación del latch deja RED solo el caso in-flight;
- CI exact-head ejecuta los 17 tests de ofertas y quedan verdes.

Sin embargo, el mecanismo nuevo usa `dataUpdateCount + errorUpdateCount` como si identificara **qué fetch** está en curso. Esos contadores identifican settles, no inicios de fetch.

Eso deja una regresión no cubierta: si después del reconnect otro mecanismo arranca un refetch —por ejemplo el catch-up de Realtime con `invalidateQueries()`— ese fetch puede traer datos frescos; al terminar cambia el contador, y el latch lo interpreta como «terminó el fetch viejo», lanzando una tercera GET innecesaria.

## Evidencia exact-head

CI `37147483662`:

- `use-request-offers.test.tsx`: **17/17**;
- `use-realtime-invalidation.test.tsx`: **12/12**;
- `providers.test.tsx`: **1/1**;
- suite: **115/115 archivos, 1747/1747 tests**;
- typecheck/lint/build/db-tests/bundle-budget: verdes;
- audit: rojo únicamente por `braces`, externo a T-333/T-332.

Preview `37147561319`:

- checkout exacto `4a339d4393f577ef46f3b817bec964c98bbb91d3`;
- chromium: **20/20**;
- global-settings: **3/3**.

La rama sigue 0 commits detrás de `develop` y mergeable.

## Qué falta

Agregar un RED donde:

1. fetch #1 queda pendiente;
2. offline → online arma el latch;
3. antes de que #1 se resuelva, otro refetch explícito válido arranca fetch #2;
4. fetch #2 termina con datos frescos;
5. el total debe quedar exactamente en **2**, nunca 3.

La forma más directa de reproducir la interacción real es `queryClient.invalidateQueries({ queryKey })`, ya que Realtime usa invalidación y TanStack tiene `cancelRefetch: true` por defecto para invalidaciones/refetch explícitos.

El arreglo debe distinguir una **generación de fetch iniciada después del reconnect** del settle de la operación vieja. No alcanza contar data/error updates.

Después de cerrar R01, actualizar nuevamente el body del PR: quedó viejo tras este commit técnico.
