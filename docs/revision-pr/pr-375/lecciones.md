# Lecciones de PR #375 — T-358

**Origen:** 8 hallazgos de la ronda 1 sobre `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91`. Todos en estado **abierto**, ninguno certificado mediante ejecución independiente.

## Lección 1 · Null en el modelo NO implica ausencia de elemento visual
PR375-H01 y H06: `MapPicker` consume `value=null` pero mantiene un `activeCoords` de fallback y renderiza un pin. Refuerza **pr-82/AG-76**: un test que afirma solo una API de superficie no verifica el comportamiento final. La prueba correcta monta el componente REAL y verifica ausencia del marcador.

## Lección 2 · Un PATCH no puede volver a escribir un snapshot
PR375-H02/H03: al enviar todos los valores precargados se produce update ciego y riesgo de perdida concurrente. Refuerza **pr-68/AG-74**: escrituras condicionadas deben afirmar las condiciones/filas realmente actualizadas. Aplíquese actualización por claves presentes, transacción y pruebas con interleaving.

## Lección 3 · Opcional no equivale a nullable y ausencia no equivale a error
PR375-H04/H05: `undefined` significa «no tocar»; `null` significa «borrar explícitamente». Los errores de Auth no son una sesión ausente. Refuerza **pr-56/AG-37** (enumerar la clase completa de variantes), **pr-63/AG-68** (el rojo declarado no demuestra un control) y **pr-64/AG-61** (mutar controles).

## Lección 4 · La evidencia de un SHA no se hereda a otro
PR375-H07/H08: E2E de `42ace275` en verde, run del HEAD posterior `b3ace3eb` cancelado. La bitácora debe citar ambos; un checkbox no reemplaza una corrida. Refuerza **pr-68/AG-73** y **pr-56/AG-36** (autor no firma verificación).

## Recomendaciones para próximas PR
- En tests de mapa, comprobar DOM/marker real y no solo el prop de un mock.
- En updates multitabla, probar fallo parcial, falta de fila, carreras y bypass de RLS; si la tarea no autoriza RPC, abrir CC antes.
- Los comentarios y DoD de la ficha deben corresponder al contenido real de la PR.
- Las mutaciones propuestas por la revisión se vuelven a ejecutar tras cada arreglo; no se confía en la batería del autor.

**Numeración:** deliberadamente no se asigna nuevo AG-xx: no se pudo ejecutar `git grep` sobre **todas** las ramas remotas para calcular máximo global; estos aprendizajes refuerzan lecciones numeradas preexistentes.
