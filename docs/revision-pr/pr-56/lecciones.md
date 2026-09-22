# Lecciones de la PR #56 para `AGENTS.md` y las reglas

**Fuente:** 9 hallazgos de la ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Provisorio: la PR sigue abierta con 2 bloqueantes. Se completa al cerrarla.

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

## Advertencias

- **Ronda 1 de una PR abierta.** Las tres lecciones salen de esta PR; `AG-32` y `AG-33` se refuerzan entre sí y probablemente convenga escribirlas como una sola cuando la PR cierre.
- **`AG-32` es la que más rinde y la más barata:** la infraestructura de pruebas ya existe y está bien hecha. Es agregar aserciones a `rls_matrix.sql`, no reescribir nada.
- **Nada de esto desmerece el trabajo.** La parte difícil —probar con los roles reales, evitar la recursión con `app_private`, hacer `rls_enabled.sql` genérico— está bien resuelta, y es la que suele salir mal.

## Lo que dice el dato entre PRs

Nueve hallazgos, **todos `origen: agente`**. Tercera PR consecutiva sin ningún `origen: ficha` puro: las fichas dejaron de ser la fuente de los problemas después de las PR #50 y #53.

Aparece un patrón nuevo con dos casos de entrada, `P17-with-check-no-congela-columnas-de-privilegio`, y otro con tres, `P18-policy-sin-condicion-de-relacion`. Los dos son de la misma familia —una policy que concede más de lo que su nombre sugiere— y los dos se hacen visibles recién ahora, porque T-005 es la primera tarea que escribe autorización. Conviene mirarlos en T-006, que va a escribir las RPC que se apoyan en estas policies.

El dato de proceso de esta ronda es otro: **la autorrevisión del agy declaró cero hallazgos** sobre una migración con dos escaladas de privilegios. Eso no dice que el agy revise mal; dice lo que ya sabíamos y ahora está medido: **revisarse a uno mismo no encuentra lo que uno no pensó al escribirlo.** Es el argumento para que la revisión independiente no sea opcional, y para no confundir el `approval-policy` —que verifica formato— con un control de contenido.
