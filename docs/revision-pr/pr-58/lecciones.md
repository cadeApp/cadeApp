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

## AG-54 · Un gate verde por lista de excepciones no es una remediación

Si `audit` termina 0 solo porque todas las severidades bloqueantes están en `ignoreGhsas`, el color describe la configuración del filtro, no el riesgo del árbol. El informe debe contar también los avisos ignorados y comprobar soporte upstream. En H14, Next 14 quedó fuera de soporte y se silenciaron 8 altas y 2 críticas.

## AG-55 · La unicidad de un generador se prueba contra el estado inicial

Una secuencia creciente evita colisiones entre objetos creados después del arranque, pero puede pisar fixtures, filas restauradas o IDs reservados. El test mínimo combina al menos un ID sembrado con uno generado y afirma que ambos sobreviven (H08).

## AG-56 · Un fake contractual valida relaciones y su propia salida

Validar el input no alcanza. Un fake útil debe fallar si faltan filas relacionadas y debe comprobar que el resultado del handler pasa el `outputSchema`. Así un `undefined` escondido por `!` falla cerca de la implementación, no varias capas después (H07).

## AG-57 · Un cast puede reabrir el contrato que el genérico acaba de cerrar

Estrechar `RpcClientContract` a `RpcErrorCode<K>` no sirve si el adapter conserva una entrada amplia y la convierte con `as`. Los mecanismos de prueba —incluido `setForcedError`— deben preservar la misma relación RPC × error que la API pública (H05).
