# Lecciones de la revisión de PR #58

## AG-47 · Una prueba de autorización opcional debe fallar cerrada

Si pertenencia/asignación puede omitirse y `undefined` equivale a autorizado, el tipo convirtió una condición de seguridad en sugerencia. Exigir evidencia positiva (`=== true`) o inputs discriminados por transición. Aplica a H01 y H06.

## AG-48 · Enumerar la matriz negativa completa antes de declarar un contrato

Un catálogo de RPC no está cubierto por tener un caso feliz y un `forcedError`. Hay que cruzar RPC × actor × preestado × existencia × forma inválida. El barrido completo encontró que 13 RPC aceptaban anónimo y 10 fabricaban recursos (H03-H08, H13).

## AG-49 · El umbral de cobertura pertenece al runner

Un test no puede fiarse de un artefacto que el propio runner escribe después de ejecutar ese test. El umbral va en `vitest.config.ts` y se valida agregando temporalmente ramas sin cubrir. H12 pasó con 38,77 %.

## AG-50 · Un fake contractual debe ser un sustituto conductual

Si fabrica filas, usa IDs únicos globales o responde éxito sin mutar estado, solo prueba su propio optimismo. El fake debe conservar las invariantes observables de existencia, actor, transición, unicidad y efectos laterales (H06-H09).

## AG-51 · Una tabla clave/valor pide una unión discriminada

`key: enum` junto a `value: union` pierde la relación entre ambos. Cada clave debe seleccionar su schema y sus límites; probar la matriz completa evita que `pilot_active: 1` se vuelva válido (H04).

## AG-52 · Activar un gate diferido requiere presupuesto en la ficha

El job `audit` estaba diseñado para bloquear al aparecer `rpc-contracts.ts`. La tarea que activa el hito tiene que autorizar de antemano la remediación de dependencias; si no, el DoD y «Archivos permitidos» se contradicen. Lautaro073 amplió T-006 para resolver H14.

## AG-53 · Un contrato público debe cerrar códigos, fechas y forma de error

Tipos amplios (`DomainErrorCode`, `string`, `message?`) permiten estados que cada RPC no promete y que la UI no sabe interpretar. Derivar los errores por RPC, validar ISO y mantener `{ ok:false, code }` exacto (H02, H05, H10, H11).
