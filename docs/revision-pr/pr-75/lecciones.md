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
