# Lecciones de la PR #236 para `AGENTS.md` y las reglas

**Fuente:** 3 hallazgos, 4 rondas. Datos en [`hallazgos.jsonl`](hallazgos.jsonl).

## H01 — carrera original

R4 confirma que el RED con Promise diferida era el control correcto para la carrera real. No alcanza reproducir eventos; hay que reproducir el mismo estado concurrente del framework.

Refuerza **`pr-82/AG-77`**.

## R01 — generación vs settle

El arreglo introduce una lección distinta:

> un contador de resultados terminados no identifica una generación de trabajo en curso.

`dataUpdateCount + errorUpdateCount` sirve para saber que **algo terminó**, pero no cuál fetch empezó después del reconnect.

Esto importa porque T-333 combina dos fuentes de refetch:

1. reconnect de TanStack;
2. invalidación catch-up de Realtime.

Un arreglo correcto de una carrera debe considerar interacciones entre mecanismos que operan sobre la misma query.

## Contrato relevante

TanStack documenta:

- `RefetchOptions.cancelRefetch` default `true` para refetch explícitos;
- `InvalidateOptions` hereda ese comportamiento;
- con `true`, una request en curso puede cancelarse antes de empezar la nueva.

Por eso una invalidación posterior al reconnect es una forma realista de crear una generación #2 que vuelve innecesario el refetch diferido del latch.

## Qué controlar en R5

Agregar un test donde otro refetch arranca después del reconnect y exigir exactamente dos llamadas totales.

La mutación debe desactivar solo la detección de nueva generación y dejar:

- H01/B GREEN;
- idle reconnect GREEN;
- caso competidor RED.

No se agrega AG nuevo todavía; R01 es evidencia de una sola PR.

## Correcciones de la revisión

- R1 sobreprescribió un bridge.
- R2 lo descartó.
- R3 encontró la carrera real.
- R4 valida su arreglo y descubre una interacción nueva con Realtime.

El histórico conserva estas correcciones deliberadamente.
