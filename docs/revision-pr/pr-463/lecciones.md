# Lecciones — PR #463 / T-381 · Ronda 1

No se agrega un nuevo AG hasta comprobar la mutación de forma independiente en la siguiente ronda.

## Patrón reincidente: P08 (AG-75 y AG-76, entre otros)

Un test con debounce que junta visibilidad, foco y Realtime **no demuestra** que cada uno sea capaz de refrescar la pantalla. Un solo disparador sano salva la aserción aunque otro esté roto. PR463-H01 detecta por lectura que se debe aislar la señal positiva; la mutación I01 está preparada y NO ejecutada en esta sesión.

**Mejora metodológica:** probar por separado las fuentes de invalidez, y después la combinación que prueba la coalescencia. Mantener una prueba positiva aislada por disparador; luego hacer la mutación que lo elimina.

## Alcance frente a ficha base

La ficha alterada en la rama no da autorización retroactiva. La diferencia con develop exigió la decisión D01, que Lautaro073 resolvió explícitamente con A. La aceptación de alcance no se marca como prueba runtime ni como bug corregido.

## Ronda 2 — cierre de PR463-H01

El test reparado aisla el disparador positivo `visibilitychange` y después prueba la coalescencia de foco + visibilidad + Realtime. Se confirma sobre SHA publicado el orden: primero mecanismo individual, después combinación, manteniendo las aserciones del debounce.

El control estructural propio sin dependencias obtuvo PASS en fuente original y FAIL al eliminar el registro del listener en memoria, pero **no sustituye Vitest**. El RED runtime documentado sigue siendo el del autor; el revisor constató ejecución GREEN independiente en GitHub Actions (`unit` sobre `00b3f6d5`). No se crea AG nueva por tratarse del mismo patrón P08 ya documentado.
