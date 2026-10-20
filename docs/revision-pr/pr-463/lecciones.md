# Lecciones — PR #463 / T-381 · Ronda 1

No se agrega un nuevo AG hasta comprobar la mutación de forma independiente en la siguiente ronda.

## Patrón reincidente: P08 (AG-75 y AG-76, entre otros)

Un test con debounce que junta visibilidad, foco y Realtime **no demuestra** que cada uno sea capaz de refrescar la pantalla. Un solo disparador sano salva la aserción aunque otro esté roto. PR463-H01 detecta por lectura que se debe aislar la señal positiva; la mutación I01 está preparada y NO ejecutada en esta sesión.

**Mejora metodológica:** probar por separado las fuentes de invalidez, y después la combinación que prueba la coalescencia. Mantener una prueba positiva aislada por disparador; luego hacer la mutación que lo elimina.

## Alcance frente a ficha base

La ficha alterada en la rama no da autorización retroactiva. La diferencia con develop exigió la decisión D01, que Lautaro073 resolvió explícitamente con A. La aceptación de alcance no se marca como prueba runtime ni como bug corregido.
