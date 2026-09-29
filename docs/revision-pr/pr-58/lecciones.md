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

---

# Lecciones de la ronda 3

## AG-47 · Un probe de revisión es código, y va tipado antes de creerle
**Origen:** las tres correcciones de mi propio probe en la ronda 3

La primera corrida del probe dio dos fallos y **los dos eran míos**: afirmé `r.error` cuando `ActionFailure` expone `code`, y llamé `admin_verify_document` con `status` cuando el campo es `decision` —así que el input fallaba la validación y nunca llegaba al handler, que sí tenía su guarda—. Corregidas esas dos, `tsc --noEmit` encontró una tercera: `report_no_show` no toma `reason`, o sea que ese test venía pasando por el motivo equivocado.

Si me hubiera quedado en la primera corrida, habría reportado **dos bloqueantes inexistentes sobre un fake correcto**, en la ronda que decide si la PR se mergea. Y el costo no habría sido solo mío: el agy habría salido a "arreglar" algo que funcionaba.

> **Regla propuesta.** El probe de una revisión se corre bajo las mismas reglas que el código que revisa: `tsc --noEmit` antes de leer sus resultados. Un probe rojo es una afirmación sobre el código ajeno, y hay exactamente dos explicaciones —el defecto existe, o el probe está mal—; el compilador descarta la segunda en segundos y es la más probable cuando el probe se escribió contra una API que uno acaba de leer.
>
> Señal concreta: **un fallo cuyo valor recibido es `undefined` casi nunca es el defecto**, es un campo que no se llama así. Antes de escribirlo como hallazgo, leer el tipo.

Es la misma familia que `AG-46` de la PR #57: allá validé una hipótesis sobre el entorno con una prueba que codificaba esa misma hipótesis; acá afirmé sobre una API sin cruzar su tipo. Las dos veces el error fue **no aplicarme el método que le exijo al autor**.

## AG-48 · Cuando el arreglo elimina la construcción que escondía el defecto, la clase queda cerrada
**Origen:** H07

Los cuatro contracasos de `H07` se podían cerrar uno por uno con guardas puntuales. El arreglo hizo eso **y además eliminó los ocho `!` non-null** que los escondían. Esa segunda parte no era necesaria para que el probe se pusiera en verde, y es la que hace que el defecto no vuelva: con `tsc` en strict y cero non-null, la clase entera de «acceso a una entidad ausente» pasa a estar cerrada por el compilador en vez de por inspección.

La diferencia práctica se va a ver en T-101, cuando estas RPC se implementen de verdad contra Postgres: quien agregue un handler nuevo no puede callar un `undefined` sin que `tsc` lo pare.

> **Regla propuesta.** Al cerrar un hallazgo, preguntar qué construcción del código permitía que el defecto existiera sin ser visible —un `!`, un `as`, un `catch` vacío, un `?? {}`— y si se puede eliminar esa construcción en vez de solo el síntoma. Cuando se puede, el arreglo deja de depender de que la próxima persona se acuerde.

## Lo que dice el dato de esta PR

**16 hallazgos en tres rondas: 15 verificados, 1 abierto no bloqueante.** Catorce de los dieciséis salieron de la ronda 1, lo que dice que el barrido inicial estuvo bien hecho: las rondas 2 y 3 no descubrieron familias nuevas, solo midieron si los arreglos cerraban.

- **La severidad se concentró en el fake, no en los contratos.** `rpc-contracts.ts`, `errors.ts`, `states/` y `schemas/` cerraron en la ronda 2 y no volvieron a moverse. Lo caro fue `rpc-fake.ts`, que es el que simula el comportamiento — y tiene sentido, porque es donde un error no rompe nada hoy y rompe todo en T-101.
- **`H14` cambió el tablero.** Esta PR no solo remedió las vulnerabilidades: al crear `src/domain/rpc-contracts.ts` hace que el `if` del job `audit` entre por primera vez en su rama estricta. Desde el merge, `audit` es un check bloqueante real y no un `pass` decorativo. Vale anotarlo porque en la PR #57 el mismo job fue hallazgo (`PR57-H19`) justamente por lo contrario.
- **Cero desvíos de alcance en tres rondas**, con una ficha que se amplió dos veces por decisión humana explícita y quedó registrada en el README de la carpeta. Es el uso correcto de la ampliación: se pide, se aprueba, se escribe.
