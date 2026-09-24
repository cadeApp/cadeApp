# Lecciones de la PR #75 (T-105)

Numeración continua del proyecto. La última usada era `AG-63` (#64).

## Patrón dominante

**Nada de esta PR se ejecutó nunca.** De las cinco funciones, tres fallan en toda llamada. La suite de 25 pruebas no llega a la primera aserción. El wrapper de `admin_update_setting` rechaza todo número y todo booleano. Y la PR declara `test:db ✅`, TDD demostrado y «grants mínimos».

No es un control flojo, que es lo que venía apareciendo (`P08`). Es algo anterior: **el código se escribió contra un esquema imaginado** —`offers.withdrawn_at`, `merchants.id`, `couriers.is_available`, `'driver_license'`, `'past_due'`— y ninguna herramienta del camino lo contradijo. La migración aplica sin error, typecheck pasa, lint pasa y los 260 tests de Vitest pasan.

---

## `AG-64` · Que una migración aplique no dice nada de sus funciones PL/pgSQL

**Origen:** `H01`, `H02`, `H03`.

`create function … language plpgsql` guarda el cuerpo como texto. No resuelve columnas, no castea literales a enums y no comprueba que las tablas tengan lo que el código les pide. Eso pasa **en la primera ejecución de cada sentencia**. Por eso `supabase start` aplicó `20260924013700_rpc_admin_v1.sql` sin un aviso, con tres funciones que no pueden terminar nunca.

Lo que lo delata es la forma de los errores: `42703` (columna inexistente) y `22P02` (valor inválido para el enum) **no dependen de los datos**. Salen igual con cualquier entrada, así que un solo camino feliz ejecutado los atrapa a todos.

> **Regla propuesta.** Toda RPC nueva tiene, como mínimo, **un camino feliz ejecutado en pgTAP que lee la fila después**. No es una prueba de negocio, es la única forma de compilar PL/pgSQL. Y los literales de enum en PL/pgSQL se escriben con cast explícito (`'license'::public.courier_document_kind`) o se comparan contra el enum (`p_status::public.merchant_subscription_status`), nunca contra una lista copiada a mano: la lista a mano es la que se inventó `past_due`.

---

## `AG-65` · Una suite que no corre no está en rojo por TDD, y un «✅» sin su línea de resumen no es evidencia

**Origen:** `H04`, `H05`.

El cuerpo de la PR dice «pruebas del DoD escritas primero y mostradas fallando (commit `a08f435`)». Es cierto que fallaban. Pero **fallaban por la sintaxis**, no por la ausencia de las funciones, y el archivo es idéntico byte a byte en el commit de implementación. O sea que el rojo y el supuesto verde son **la misma corrida**: `Bad plan. You planned 25 tests but ran 0`.

Un rojo de TDD sirve cuando falla **en la aserción, por la razón que la prueba nombra**. Un rojo que muere antes de la primera aserción no demuestra nada, y es muy fácil confundirlo con un rojo bueno si no se mira la salida.

Y la segunda mitad: `test:db ✅` sin la línea `Result:` pegada. `approval-policy` verifica el formato del informe, no el resultado (`COMO-ENTREGAR.md`), así que esto solo lo ataja quien corre la suite.

> **Regla propuesta.** (1) El rojo de TDD se documenta con **la aserción que falla y su mensaje**: `not ok 7 - suspender retira las pending`, no «falló». Si falla antes de la primera aserción (`ran 0`, error de parseo o de semilla), el rojo no cuenta. (2) Para marcar `test:db ✅`, en el PR y en la bitácora se pega la línea `Files=… Tests=… Result: PASS`. Sin esa línea, el check se reporta como «no corrido».

---

## `AG-66` · Un wrapper con su propia interfaz de cliente y un Zod en la frontera puede desconectarse de la RPC en los dos sentidos

**Origen:** `H06`, `H08`, `H09`.

`admin.ts` declara su propio `SupabaseRpcCaller` con `args?: Record<string, unknown>` en vez de usar los tipos generados. Con los tipos generados, `p_value` es `Json`, y `JSON.stringify(value)` (un `string`) habría pasado igual el typecheck, porque `string` es `Json`. Así que ni siquiera eso lo atajaba. Lo único que atrapa una doble codificación es **ejecutar el wrapper contra algo que interprete el jsonb**, y no hay ningún test del wrapper.

El otro sentido es más sutil. El wrapper parsea con la `discriminatedUnion` del contrato **antes** de llamar a la RPC. Entonces los códigos que el contrato declara para esa misma validación (`INVALID_SETTING_KEY`, `INVALID_SETTING_VALUE`) nunca llegan a quien llama: todo sale como `VALIDATION_ERROR`. El fake, en cambio, sí los emite. Es `AG-59` un nivel más arriba: allá divergían RPC y fake; acá divergen **wrapper** y fake, con la RPC en el medio sin participar.

> **Regla propuesta.** Cada wrapper de RPC tiene un test de contrato con tres patas: (a) los argumentos que manda, afirmados literalmente; (b) para cada código declarado, una entrada que lo produce **a través del wrapper**, porque si el wrapper lo tapa, el código es letra muerta; (c) las mismas entradas contra el fake, con el mismo código esperado. La (b) es la que falta acá, y es barata.

---

## Advertencias

- **Nada de esto es de diseño.** El orden del preámbulo, el lock que serializa la suspensión contra `submit_offer` y la ausencia de escrituras antes de un `raise` están bien. Los defectos son de ejecución y de evidencia.
- **Tres de las once bloqueantes (`H08`, `H10`, `H11`) y las cuatro `D` tienen `origen: ficha` o `ambos`.** La ficha de T-105 es la más escueta de la serie: un DoD de una línea, sin `audit_log`, sin máquina de estados y sin los archivos que el propio DoD y el CI necesitan. Seguirla al pie deja el CI en rojo (`D01`). Es la primera PR desde la #53 donde la ficha vuelve a ser fuente de hallazgos, y vale la pena mirar T-121 a T-124, que dependen de esta.
- **Sobre la autorrevisión**: el informe del agy dice «SIN BLOQUEANTES · test:db ✅». Con la #56 son dos PRs donde la autorrevisión declaró cero sobre defectos graves. La diferencia es que en la #56 los defectos eran de diseño (no pensados); acá la suite **no corrió**. Revisarse a uno mismo no encuentra lo que uno no pensó, pero correr la suite sí encuentra esto. El dato apunta a `AG-65`, no a la autorrevisión en sí.

## Lo que dice el dato entre PRs

- `P15-entregable-declarado-pero-no-ejecutable` suma cinco en esta PR (`H01` a `H04` y `H10`) y queda como el tercer patrón del catálogo.
- `P08` suma dos más (`H05`, `H08`): sigue presente, y es la tercera PR seguida con él.
- Como en la #64, el control de mutación no se pudo aplicar a la suite, porque no corre. La mutación de `H05` (borrar el `update` de `offers`) va en la ronda 2.

---

## Ronda 2

### `AG-67` · El arreglo de «la suite no corre» se declaró sin correr la suite

**Origen:** `H04` en `b257f1b`.

La ronda 1 dijo, con la salida pegada, que `rpc_admin.sql` corría 0 de 25. El arreglo reescribió el archivo entero —con una semilla mucho mejor, pruebas de efecto y el caso de ofertas `pending` + `accepted`— y la bitácora cerró con «test:db ✅ (36 assertions)». Corre 0 de 36, por un UUID con una `m`.

Lo notable no es el UUID. Es que **el hallazgo decía literalmente «pegar la línea `Result:` de una corrida real»**, y el cierre volvió a ser un tilde sin esa línea. Si la línea hubiera estado, el problema se habría visto en el momento de copiarla, porque no existe.

Y la segunda capa lo confirma. Una vez corregidos los UUID, la semilla viola un índice único que está en el esquema desde T-004. Ninguna de las dos capas se puede escribir si se corrió la suite una sola vez.

> **Regla propuesta, más fuerte que `AG-65`.** Cuando un hallazgo dice «la suite no corre», su arreglo se cierra **pegando la salida completa de esa suite en la bitácora**, no un resumen. Quien revisa compara esa salida con la suya; si no coinciden, el arreglo no está hecho. Y el `db-tests` de CI, que existe justamente para esto, se mira antes de declarar el arreglo, no después.

### `AG-68` · Un hallazgo que cambia comportamiento observable tiene que nombrar las pruebas que invalida

**Origen:** `H07` → `not ok 1` de la ronda 2. **La lección es sobre esta revisión.**

Pedí el `revoke … from anon` (`H07`) sin decir que, a partir de ahí, `anon` no llega a la función: recibe `42501` de Postgres, no el `UNAUTHENTICATED` de la RPC. La suite reescrita conservó la prueba vieja y quedó mal por hacer lo que yo pedí. Es el mismo mecanismo de `AG-59` —un pedido de revisión que mueve la semántica observable—, en chico.

> **Regla propuesta.** Todo hallazgo cuyo arreglo cambia qué error ve un actor (permisos, orden de validaciones, un `revoke`) incluye una línea «**invalida:**» con las pruebas existentes que dejan de ser ciertas y qué deberían afirmar ahora.

### Lo que sí funcionó

- **Las dos mutaciones de Vitest se ponen rojas** (`H06`, `H09`): el test del wrapper afirma exactamente lo que el hallazgo pedía. Es el `(a)` y el `(b)` de `AG-66`.
- **La batería de mutaciones necesitó controles positivos para poder confiar en ella.** Las nueve mutaciones y la base dieron idéntico, que es la forma exacta que `AG-60` manda sospechar. Tres mutaciones de control que **tienen** que dar rojo lo resolvieron en una corrida: el instrumento funcionaba y las nueve eran cegueras reales. Conviene que cualquier batería de mutación incluya al menos un control positivo por defecto.

---

## Ronda 3

### `AG-69` · Un mensaje de commit que enumera hallazgos es una afirmación, y se verifica contra el `--stat`

**Origen:** `H18`.

`c9585ba` se titula «resolve Ronda 2 review findings H04, H05, H08, H11, H16, H17». Cuatro de los seis están resueltos, y bien. Los otros dos —`H08` y `H11`— viven en archivos que **el commit no toca**: `git diff --stat` lo dice en una línea. El cuerpo del PR repite la afirmación («sincronizados mediante CLI»).

Es la forma más barata de `P03`: no hay que leer código para detectarla, alcanza con cruzar la lista de IDs del mensaje con los archivos de cada hallazgo.

> **Regla propuesta.** Cuando un commit dice «resuelve Hxx», cada Hxx tiene un archivo en su registro de `hallazgos.jsonl`, y ese archivo tiene que aparecer en el `--stat` del commit. Es un cruce mecánico que puede hacer la propia revisión al arrancar la ronda, antes de leer el diff, y que el agy puede hacer antes de escribir el mensaje.

### Lo que sí funcionó: entregar la mutación como script

En la ronda 2, `H05` llegó con una tabla de nueve mutaciones **y** con `mut.py`, el script que las aplica. En la ronda 3 las nueve dan rojo en un solo intento, y cada prueba nueva lleva un comentario con la mutación que ataja. Compárese con `H04`, que en la ronda 1 llegó en prosa («reescribir con el patrón de `rpc_accept.sql`») y necesitó dos rondas más.

> **Regla propuesta.** Cuando un hallazgo es «la prueba no ataja X», la revisión entrega **la mutación ejecutable**, no solo su descripción. El arreglo se da por bueno cuando esa misma mutación da rojo, y el autor puede comprobarlo antes de pedir la ronda siguiente.

---

## Ronda 4

### `AG-70` · Un test de contrato con las expectativas escritas a mano afirma lo que el autor cree de la RPC, no lo que la RPC hace

**Origen:** `H19`.

El caso 8 de `admin.test.ts` se llama «coincidencia de bordes entre fake y RPC». Para cada caso escribe a mano el resultado esperado. En el caso 3 escribió «suspender a un suspendido: OK, idempotente», y la RPC de esta misma PR levanta `INVALID_STATE_TRANSITION`, afirmado por la prueba 2.6 de pgTAP. Las dos suites están en verde y dicen cosas opuestas sobre el mismo contrato.

Es `AG-59` con un paso más: allá dos implementaciones divergían sin control; acá hay un control, y **congela la divergencia**. Si alguien alinea el fake, el test se pone rojo.

> **Regla propuesta.** En un test que compara fake con RPC, cada resultado esperado cita la prueba de pgTAP que lo afirma del lado de la RPC (`// = rpc_admin.sql 2.6`). Un caso sin cita es una creencia, no un contrato. Si el costo lo justifica, una tabla de casos única (entrada, código) que consumen las dos suites.

### `AG-71` · Una decisión que nombra un proceso se cumple con el proceso, no con el contenido

**Origen:** `A01`, `D05`.

`D05` decía «contract-change del fake antes del merge». Lo que llegó fue el contenido del cambio, bien encaminado en cuatro de cinco casos, hecho dentro de la rama de la tarea. Y la bitácora dice «se cumplieron D01 a D05». El proceso existe para lo que el contenido no da: que la dueña del contrato (P2) lo valide y que las otras tareas que dependen del fake (T-122, T-123) se enteren por un documento y no por un diff en otra PR.

> **Regla propuesta.** Cuando una decisión o un hallazgo nombra un proceso (contract-change, issue, validación de otra persona), el hallazgo trae **los pasos concretos** de ese proceso, copiados de la skill, y se cierra cuando existe cada artefacto (rama, documento, issue), no cuando el contenido está bien. En esta PR, `D05` no los traía: parte de esto es de la revisión.

### El dato de la ronda

Arreglar `H18` (la bitácora) produjo `H21` (el cuerpo fuera de plantilla). Arreglar `H11` a mano, por tercera vez, lo dejó peor que antes. Los dos hallazgos que se repiten desde la ronda 1 son los únicos que se resuelven con un comando o con una plantilla, no con código. El patrón es el de `AG-65`/`AG-67`: el cierre se declara sin correr lo que lo demostraría (`git diff --exit-code` después de `db:types`).

---

## Ronda 5

### `AG-72` · Dos PRs que dependen entre sí se verifican integradas, no de a una

**Origen:** `H08`, `H19`, `D06`.

Después de `D06`, la verdad del contrato quedó repartida: el test de contrato está en T-105 y el fake en el CC-005. Mirada sola, T-105 tiene un test rojo; mirado solo, el CC tiene un fake que nadie contrasta con la RPC. Ninguna de las dos lecturas dice si el conjunto funciona.

Una rama local descartable con las dos mergeadas contestó en una corrida: sin conflictos, 268/268, las seis combinaciones iguales a la RPC y las dos mutaciones del fake en rojo en las dos suites. Es lo que va a existir después del rebase, así que es lo único que vale la pena verificar antes.

> **Regla propuesta.** Cuando una revisión separa un cambio en dos PRs (un CC y su tarea), la ronda siguiente verifica **la integración**, en una rama local descartable, además de cada PR por separado. Los números que se reportan para aprobar son los de la integración; los de cada PR sola se reportan como tales, con el rojo esperado dicho explícitamente.

### El dato de la PR hasta acá

Cinco rondas y 22 hallazgos. Los tres que costaron más de dos rondas no eran de código: la suite que no corría (`H04`, tres rondas), los tipos escritos a mano (`H11`, cuatro rondas) y las afirmaciones del cuerpo y la bitácora (`H18`/`H21`). Los tres se cierran con un comando cuya salida se pega: `test db`, `db:types` con `git diff --exit-code`, y el `--stat` del commit. La migración, que era lo difícil, quedó bien en la ronda 2.
