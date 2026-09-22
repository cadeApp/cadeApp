# Lecciones de la PR #56 para `AGENTS.md` y las reglas

**Fuente:** 22 hallazgos en tres rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Provisorio: la PR sigue abierta, ya **sin bloqueantes**. Se completa al cerrarla.

## Patrón dominante

**Toda la atención fue a la lectura y casi ninguna a la escritura.** La matriz de `select` está pensada con cuidado, probada con los roles reales y con casos negativos. Las políticas de `update` e `insert` de las mismas tablas están escritas al pasar: `using (soy yo)` y, como mucho, un `with check` que repite lo mismo.

Los dos bloqueantes, `H06` y `H08` salen de ahí. Y no es casual que hayan pasado: **el DoD pide «matriz por rol» y la matriz que se construyó es de lectura**, 14 `select` sobre 15 aserciones. Lo que no se nombró no se probó, y lo que no se probó es donde están los agujeros.

Es la misma forma que `P08-control-no-cubre-lo-que-dice` con otro disfraz: el control existe, es bueno, y cubre la mitad del problema.

## Lecciones propuestas

### AG-32 · Una matriz de RLS se prueba en las cuatro operaciones, no solo en `select`
**Origen:** H01, H02, H05, H06

Quince aserciones, catorce de lectura. Las políticas de `update` de `profiles`, `couriers` y `merchants` —donde viven los `with check` que deciden qué columnas puede tocar cada actor— no se ejercen ni una vez. Por ese hueco pasaron dos escaladas de privilegios: un repartidor que se verifica sus propios documentos y un comercio que se autoconcede la suscripción.

> **Regla propuesta.** Una matriz de RLS tiene una fila por actor y **una columna por operación**: `select`, `insert`, `update`, `delete`. Cada celda se prueba en las dos direcciones: lo que el actor **puede** hacer pasa, lo que **no** debe poder falla. Si una celda es «nadie, esto lo hace una RPC», se escribe así y se prueba que el cliente no puede. Una matriz que solo prueba lecturas está a mitad de camino y no se nota, porque las lecturas son las que se piensan primero.

### AG-33 · Un `with check` que solo repite el `using` no protege ninguna columna
**Origen:** H01, H02, H06

`using` decide **qué filas** puede tocar el actor; `with check` decide **cómo pueden quedar**. Cuando el `with check` repite el `using` —o se omite, que es lo mismo, porque PostgreSQL usa el `using`— el actor puede reescribir cualquier columna de sus propias filas. En una tabla con `status`, `subscription_status`, `license_status`, `paid_until` o `amount_ars`, eso es una escalada de privilegios.

La forma correcta ya está en esta misma migración, y por eso sabemos que el autor la conoce:

```sql
with check (
  profile_id = auth.uid()
  and status = (select c.status from public.couriers c where c.profile_id = auth.uid())
)
```

Lo que falló fue la enumeración: se congelaron dos columnas de seis.

> **Regla propuesta.** Antes de escribir una policy de `update`, se listan **todas** las columnas de la tabla y se clasifica cada una: la escribe el dueño, la escribe un admin, la escribe el sistema. Las dos últimas se congelan explícitamente en el `with check`. La lista va en un comentario arriba de la policy, porque es lo que hay que revisar cuando la tabla gane una columna. Un `with check` que repite el `using` es una señal de que la clasificación no se hizo.

### AG-34 · Una policy que nombra a `anon` no puede llamar a una función que `anon` no ejecuta
**Origen:** H04

`zones_select_active` es `to anon, authenticated using (active or app_private.is_admin())`, y el `grant execute` de `is_admin()` es solo para `authenticated`. PostgreSQL verifica el privilegio al **inicializar** la expresión, no al evaluarla, así que el `or` no lo salva por cortocircuito.

Lo que lo dejó pasar no es el error en sí, es que **las dos únicas pruebas de `anon` son negativas**: ve 0 solicitudes, ve 0 contactos. Si `anon` quedara bloqueado de absolutamente todo, los 58 tests siguen en verde.

> **Regla propuesta.** Todo rol que aparece en la matriz necesita **al menos una aserción positiva**: algo que sí puede ver o hacer. Una batería de pruebas compuesta solo por negativas no distingue «la policy funciona» de «el rol está roto». Y cuando una policy mezcla actores con privilegios distintos sobre una misma función, conviene partirla en dos policies en vez de resolverlo con un `or`.

### AG-35 · `throws_ok` con tres argumentos compara el mensaje de error, no la descripción
**Origen:** H10

Las siete aserciones de rechazo se escribieron como `throws_ok(sql, '42501', 'el repartidor no puede autoverificarse')`, leyendo el tercer argumento como la descripción del test. pgTAP lo toma como **el mensaje de error esperado** y lo compara con `=`, no por substring. `db-tests` quedó rojo dos corridas con `wanted: 42501: el repartidor no puede...`, y el arreglo intermedio —poner el mensaje real— tampoco funcionó, porque a `new row violates row-level security policy` le sobra el sufijo `for table couriers`.

La forma correcta es la de cuatro argumentos, con el mensaje en nulo y casts explícitos para resolver la sobrecarga:

```sql
select throws_ok(sql, '42501'::char(5), null::text, 'descripción del test');
```

> **Regla propuesta.** Una prueba de rechazo afirma el **SQLSTATE**, nunca el texto del error: `42501` es estable entre versiones de PostgreSQL y no depende del idioma del servidor ni del nombre de la tabla. Si de verdad hace falta afirmar el mensaje, la herramienta es `throws_like` con un patrón, no `throws_ok` con una igualdad. Y antes de pasarle tres argumentos a una función de pgTAP, mirar su firma: varias tienen sobrecargas donde el argumento del medio no es lo que parece.

### AG-36 · Quien arregla no puede firmar la verificación, aunque tenga razón
**Origen:** A02

El `hallazgos.jsonl` de esta carpeta llegó a la ronda 2 modificado desde el lado del autor, con los nueve hallazgos en `arreglado-verificado` y `verificado_en_sha: 45ca9bb`. El contenido técnico era correcto. El SHA no: sobre `45ca9bb` el `db-tests` estaba **rojo**, y los arreglos recién quedaron verdes en `cdb7489`.

Ese es el mecanismo, y no tiene nada que ver con la buena fe: **cuando uno viene de arreglar, el estado que tiene en la cabeza es el de su última edición, no el del árbol.** Por eso el campo lo firma quien no editó.

> **Regla propuesta.** `estado`, `verificado_en_sha`, `verificado_fecha` y `verificado_metodo` los escribe únicamente quien revisa. El autor tiene su canal y es suyo: la bitácora `docs/tasks/log/T-xxx.md`, donde dice qué hizo, por qué, con qué evidencia y con el número de run. Un hallazgo que el autor encuentra —como `H10`— llega igual de completo por ahí, y llega **con la autoría correcta**, que es un dato que después sirve.

### AG-38 · Una policy de `insert` decide **cómo nace** la fila, no solo de quién es
**Origen:** H15, H16, H17, H18, H19

Las tres rondas de esta PR endurecieron `update` columna por columna y ninguna miró `insert`. Al barrerlo aparecieron cinco policies donde el `with check` solo verifica el dueño, y el cliente elige el estado inicial:

| Policy | Nace pudiendo ser |
|---|---|
| `offers_insert_courier` | `status = 'accepted'` — toma el cupo del índice único que `H11` acababa de cerrar por `update` |
| `delivery_requests_insert_merchant` | `status = 'delivered'` con los cinco *timestamps* fabricados |
| `courier_documents_insert_self` | `status = 'verified'` — el hermano de `H01` |
| `incidents_insert_authenticated` | `status = 'resolved'` con su `resolution` escrita |
| `consents_insert_self` | `accepted_at` retroactivo en un registro con valor probatorio |

El `default` de la columna no protege nada: un valor explícito lo pisa, y ninguna de estas tablas tiene `before insert`. Y congelar la columna en `update` **no cierra nada** si se puede nacer en el estado privilegiado: `H15` es literalmente `H11` por la otra sentencia.

> **Regla propuesta.** Endurecer `update` sin endurecer `insert` es media protección, y la mitad que falta suele ser la barata de explotar: en vez de mover una fila al estado que uno quiere, se crea ahí. Toda policy de `insert` fija explícitamente el estado inicial —`status = '<inicial>'`, las columnas de decisión en `null`, las fechas al `default`— y no solo el dueño de la fila. El `default` de la columna es una comodidad para el que escribe bien, nunca un control.

### AG-37 · Cuando aparece una instancia de un patrón, hay que barrer la clase entera antes de cerrar la ronda
**Origen:** H11, H12 (lección sobre la revisión, no sobre el código)

En la ronda 1 encontré `P17` en `couriers`, en `merchants` y en `offers` del lado del comercio, y cerré la ronda. En la ronda 2 aparecieron **dos más que ya estaban ahí**: el otro lado de `offers` (`H11`) y `delivery_requests` (`H12`), que es la tabla central del dominio. Nadie las tocó entre una ronda y otra; simplemente no las miré.

El costo no es teórico: el agy arregló nueve hallazgos, corrió CI hasta ponerlo verde y avisó que estaba listo, y la ronda siguiente le devolvió dos más de la misma familia. Eso es un ciclo entero de ida y vuelta que se podía haber ahorrado.

> **Regla propuesta.** Al encontrar el primer caso de un patrón estructural —una policy, un handler, un guard, un índice—, no se reporta ese caso: se **enumera la clase completa** y se revisan todas sus instancias en la misma ronda. Para RLS, la enumeración es mecánica: `grep -n "create policy" migración` y recorrer la lista entera, marcando cada una con qué operación cubre y qué columnas congela. La lista sale en un comando; leerla completa cuesta menos que una ronda extra.

## Advertencias

- **Ronda 1 de una PR abierta.** Las tres primeras lecciones salen de la ronda 1; `AG-32` y `AG-33` se refuerzan entre sí y probablemente convenga escribirlas como una sola cuando la PR cierre.
- **`AG-33` ganó dos casos en la ronda 2** (`H11` y `H12`) sin que nadie tocara esas policies: estaban desde el principio y la ronda 1 no las miró. Eso es `AG-37`, y es la lección más cara de esta PR.
- **`AG-35` y `AG-36` no son del mismo tipo que las demás.** Una es una trampa de herramienta y la otra es de proceso; ninguna dice nada sobre la calidad del diseño de RLS, que es bueno.
- **`AG-37` y `AG-38` son la misma lección vista dos veces.** `AG-37` dice que hay que barrer la clase entera; `AG-38` es lo que apareció cuando por fin la barrí. Si en la ronda 1 hubiera enumerado las cincuenta y tres policies por operación, `H11`, `H12` y `H15` a `H19` habrían salido juntos y esta PR habría cerrado en dos rondas en vez de cuatro.
- **`AG-32` es la que más rinde y la más barata:** la infraestructura de pruebas ya existe y está bien hecha. Es agregar aserciones a `rls_matrix.sql`, no reescribir nada.
- **Nada de esto desmerece el trabajo.** La parte difícil —probar con los roles reales, evitar la recursión con `app_private`, hacer `rls_enabled.sql` genérico— está bien resuelta, y es la que suele salir mal.

## Lo que dice el dato entre PRs

Quince hallazgos, **todos `origen: agente`**. Tercera PR consecutiva sin ningún `origen: ficha` puro: las fichas dejaron de ser la fuente de los problemas después de las PR #50 y #53.

`P17-with-check-no-congela-columnas-de-privilegio` cerró la PR con **cinco casos** —`H01`, `H02`, `H06`, `H11`, `H12`— y entró directo al quinto puesto del catálogo sobre 80 hallazgos de 6 PRs. `P18-policy-sin-condicion-de-relacion` quedó con tres. Los dos son de la misma familia —una policy que concede más de lo que su nombre sugiere— y se hacen visibles recién ahora, porque T-005 es la primera tarea que escribe autorización. Hay que mirarlos en T-006, que va a escribir las RPC que se apoyan en estas policies, y donde `H06`, `H12` y `H13` van a aterrizar.

El dato de proceso tiene ahora dos mitades, y la segunda matiza a la primera:

- **La autorrevisión del agy declaró cero hallazgos** sobre una migración con dos escaladas de privilegios. Eso no dice que el agy revise mal; dice lo que ya sabíamos y ahora está medido: **revisarse a uno mismo no encuentra lo que uno no pensó al escribirlo.**
- Pero en la ronda 2 **el agy encontró solo un defecto real que la revisión no había visto** (`H10`), leyendo su propio CI en rojo. Revisarse a uno mismo sí encuentra lo que la ejecución te tira por la cara. Las dos cosas conviven: la autorrevisión sirve y no reemplaza; por eso la regla 50 la pide y `COMO-ENTREGAR.md` le da un canal propio en vez de prohibirla.

Y una tercera, sobre esta revisión, que en la ronda 3 se agravó: **dos de los cinco hallazgos de la ronda 2 ya estaban en la ronda 1** (`H11`, `H12`), y **los cinco de la ronda 3 estaban desde el primer commit** (`H15` a `H19`). Ninguno de los siete salió de trabajo nuevo: salieron de que la revisión miró `select`, después `update`, y recién en la ronda 3 miró `insert`. Ver `AG-37` y `AG-38`. El `approval-policy` no habría atrapado ninguno de los dos, porque verifica formato; el único freno real sigue siendo que la revisión independiente mire, y que mire la clase entera.
