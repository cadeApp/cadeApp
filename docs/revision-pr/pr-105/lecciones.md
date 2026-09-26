# Lecciones — PR #105 / T-106

No se agrega numeración AG nueva en esta ronda.

## H01 · Repite P08 y pr-56/AG-37

La ficha ya nombraba la vía peligrosa: `merchants_select_courier`. Crear una vista segura no cierra una clase de acceso si la tabla original conserva una policy que entrega la fila completa.

La regla existente alcanza: ante un cambio de RLS hay que enumerar **todas las vías de lectura** del actor. En esta PR, «la vista no tiene columnas sensibles» es un proxy más barato que «el courier no puede leer columnas sensibles».

## H02 · Repite pr-63/AG-70

El rojo se escribió desde la intención: “faltan RPC y vista”. El log real dijo otra cosa: `INVALID_SIGNUP_ROLE`, 0 aserciones de las dos suites nuevas.

No hace falta otra regla. La vigente es más concreta: el rojo de una prueba se copia de la salida real y se reproduce; un fallo del harness no demuestra el invariante.

## Qué reforzar

1. En tareas de RLS, cada superficie “segura” nueva debe tener un contracaso sobre la superficie vieja que pretende reemplazar.
2. En fase roja, registrar al menos la aserción que falla y el conteo ejecutado. `exit 1` por sí solo no es evidencia de TDD.
3. Las mutaciones se hacen sobre implementación temporal; nunca se adulteran expectativas, fixtures, planes o tests para fabricar verde/rojo.
