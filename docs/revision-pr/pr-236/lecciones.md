# Lecciones de la PR #236 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos, 3 rondas. Datos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Hallazgo principal

R3 identifica la causa que faltaba: el problema no era browser → `onlineManager`, sino la **concurrencia temporal** entre reconnect y un fetch ya activo.

El test unitario había sido fortalecido, pero al esperar `isRefetching=false` eliminó justamente la carrera del navegador.

## Lecciones

No se agrega AG nuevo; refuerza **`pr-82/AG-77`**.

- No alcanza con reproducir los mismos eventos: también hay que reproducir el mismo **estado concurrente** del framework cuando ocurren.
- Un baseline de red («llegó HTTP 200») no equivale a query settled: después pueden quedar body parsing, imports dinámicos, validación o transformación.
- Para bugs de lifecycle/reconnect, los RED deben controlar explícitamente promises pendientes; esperar idle antes de la transición puede borrar el defecto.
- Las mutaciones deben discriminar el mecanismo nuevo. Para la próxima ronda, desactivar el latch de reconnect diferido debe hacer RED solo el caso in-flight y dejar GREEN el camino idle.

## Correcciones de la propia revisión

- R1 prescribió un bridge global demasiado pronto.
- R2 lo puso a prueba y lo descartó.
- R3 encuentra la carrera verdadera usando el trace temporal y el contrato de TanStack.

Conservar estas correcciones en el histórico es importante: el proceso de revisión también debe corregir sus hipótesis cuando la evidencia las contradice.

## H02

El body del PR ya quedó sincronizado. No requiere regla nueva.
