# PR #54 · Ronda 2 — `6a640e4`

| | |
|---|---|
| **SHA revisado** | `6a640e4` |
| **Commits nuevos** | `ab6adb5` (H01, H04, H05, H06), `29b36d4` (bitácora), `6a640e4` (revoke explícito) |
| **Base** | `82d6521` |
| **Tamaño** | 17 archivos |
| **Fecha** | 2026-09-22 |

## Veredicto

**Los cuatro hallazgos que T-004 podía cerrar están cerrados, y los tres que se podían demostrar traen prueba de conducta.** La PR está lista para aceptar.

Lo que más vale de esta ronda: no se arreglaron las cuatro cosas y listo — **se agregaron pruebas que fallan si alguien las deshace.** Tres de los cuatro arreglos vienen con una aserción que ejerce el comportamiento, incluido el caso negativo de la FK compuesta. La suite pasó de 37 a 41 pruebas.

| | |
|---|---|
| Cerrados y verificados | **5 de 7** (H01, H04, H05, H06 + A01) |
| Resuelto por decisión | 1 (H03) |
| Abiertos | 2 · **H02** fuera de la ficha · **H07** nuevo, para T-005 |
| Bloqueantes | **0** |
| CI | **9 de 9** — por primera vez, `approval-policy` incluido |

## Checks en `6a640e4`

| Comando / job | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | **72/72 Vitest · 18/18 workflows** |
| `db-tests` en CI | **pass** · `Tests=41`, `All tests successful` |
| `db-tests` → tipos | `git diff --exit-code` **pass** tras regenerar |
| `approval-policy` | **pass** — el bloque del informe está en el cuerpo |
| `typecheck` `lint` `unit` `build` `bundle-budget` `audit` `db-types` | pass |
| Árbol tras la suite | limpio |
| Alcance | 17 archivos, **0 fuera de la ficha** — octava ronda |

---

## 🟡→✅ H01 · `on delete set null`, con prueba de borrado

`couriers.decided_by` y `audit_log.actor_id` pasaron a `on delete set null`, que es la mitad que entraba en esta tarea. Y no quedó en el DDL: `pg_temp.test_actor_delete_sets_null()` **hace el borrado**.

```sql
perform pg_temp.signup_role(admin_id, 'merchant');
update public.profiles set role = 'admin' where id = admin_id;
update public.couriers set decided_by = admin_id ... ;
insert into public.audit_log (actor_id, ...) ... returning id into audit_id;
delete from auth.users where id = admin_id;
```

y después afirma que el repartidor y la fila de auditoría **siguen existiendo** con las referencias en null. Es exactamente lo que `AG-28` pedía: una cláusula `on delete` es una promesa de comportamiento y se prueba borrando.

Detalle que me gustó: la prueba **usa el procedimiento de arranque del admin** para construir el caso. La documentación de H03 quedó ejercitada por un test, que vale más que el comentario.

**Residual.** La prueba cubre la mitad que ahora funciona, no la que se decidió dejar como está: **nada afirma que borrar un comercio con una solicitud publicada falle.** La decisión de retener el historial está escrita en `T-004.md`, pero si mañana alguien pone `on delete cascade` en `delivery_requests.merchant_id` para «arreglar» un borrado que falla, se lleva el historial contable y las 41 pruebas siguen en verde. La infraestructura ya está: tres líneas dentro del mismo `pg_temp` que intenten el borrado de un merchant con actividad y afirmen `foreign_key_violation` dejarían la decisión trabada. Lo anoto para la ficha de anonimización, no para acá.

## 🔵→✅ H04 · El grant se fue, y hay una aserción de privilegio

```sql
revoke all on function public.handle_new_user() from public, anon, authenticated;
```

Y dos pruebas que lo verifican de la única forma que funciona sin cambiar de rol:

```sql
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), ...);
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), ...);
```

`has_function_privilege` consulta el privilegio de **otro** rol, así que el hecho de que la suite corra como superusuario no la enmascara. Es la respuesta correcta al problema que había planteado en la ronda 1, y es mejor que lo que yo había propuesto —borrar la línea— porque además deja el control puesto.

## 🔵→✅ H05 y H06 · Probados por conducta, con el caso negativo

`set_updated_at()` más tres triggers `before update`, y `offers_id_request_uk unique (id, request_id)` con la FK compuesta `(accepted_offer_id, id) → offers (id, request_id)`.

La prueba los ejerce a los dos, y está bien armada:

- inserta las filas con `updated_at` forzado a `2020-01-01` —en `insert` no hay trigger, así que el valor queda— y después hace tres `update` verificando que el timestamp **avanzó**. Sin ese truco la prueba pasaría por el `default now()` sin que el trigger existiera;
- intenta asignar a `req_b` una oferta de `req_a` y **exige que salte `foreign_key_violation`**, y solo después asigna la correcta. El caso negativo es el que prueba que la FK compuesta sirve para algo.

Un detalle de la FK compuesta que verifiqué porque podía haber sido una regresión: con `accepted_offer_id` en null la restricción no se evalúa (`MATCH SIMPLE`), así que una solicitud sin oferta aceptada sigue siendo válida. Está bien.

## 🟡→✅ H03 · Resuelto por decisión, con una pieza pendiente de mudanza

Se adoptó la opción (a): trigger estricto, y el arranque del admin documentado en el comentario de la migración y en `T-004.md`:

> se registra como `merchant` o `courier` y luego se promueve con `service_role`:
> `update public.profiles set role = 'admin' where id = '<auth_user_id>';`

**Residual, y es el de siempre:** la nota dice «para T-005» y vive en `T-004.md`. El agy de T-005 lee `T-005.md`, que es donde tiene que estar — y está fuera de los «Archivos permitidos» de esta tarea, así que no podía ponerlo ahí. Es `AG-21` otra vez: **una obligación diferida tiene que aterrizar en el DoD de la ficha de destino.** Mudarlo a `T-005.md` es una PR de docs de tres líneas y conviene hacerla antes de que T-005 arranque.

La otra cara de H03 sigue sin escribirse en ningún lado: **hoy no se puede crear un usuario desde el panel de Supabase**, ni con `inviteUserByEmail`, ni por OAuth, porque ninguno manda `role` en la metadata y el trigger aborta el alta. Para los usuarios de prueba eso se siente enseguida. No es un defecto —el DoD pide el corte— pero merece una línea en el onboarding o en la ficha de T-007.

---

## 🔵 H07 · El `revoke` de `set_updated_at` no se puede verificar hasta T-005

**`supabase/migrations/20260922031435_schema_v1.sql:229` · bajo · para T-005**

`set_updated_at()` también lleva `revoke all ... from public, anon, authenticated`, y ahí la apuesta es más grande que en `handle_new_user`: **sus triggers disparan en los `update` de usuarios finales**, no en un alta que hace GoTrue.

Mi lectura sigue siendo que no importa: el privilegio de `execute` sobre la función de un trigger se verifica al crear el trigger, no en cada disparo, que es la razón por la que `security definer` existe para triggers que tocan tablas protegidas. Si estuviera equivocado, **todo `update` de un comercio sobre su solicitud fallaría con «permission denied for function set_updated_at»**.

Lo que puedo afirmar con certeza es que **la suite no lo puede decidir**, por dos motivos a la vez: corre como superusuario, y aunque cambiara de rol con `set local role authenticated`, la RLS deny-all de esta migración bloquearía el `update` antes — o sea que fallaría por el motivo equivocado.

**Se resuelve solo en T-005**, y solo si su matriz lo contempla: cuando existan las policies, **el caso de cada rol tiene que incluir un `update`, no solo un `select`.** Un `select` que pasa no dice nada sobre una función de trigger. Es `AG-29` aplicada al archivo que T-005 va a escribir, y conviene que su DoD lo nombre — hoy dice «un repartidor no aceptado no lee contactos», que es un `select`.

## 🟡 H02 · Sigue abierto, y ahora reproducido dos veces

Fuera de la ficha: es `.github/workflows/ci.yml`. Lo vuelvo a anotar porque la segunda corrida lo confirmó, no lo desmintió:

| | ronda 1 | ronda 2 |
|---|---|---|
| `toomanyrequests: Rate exceeded` | 20 líneas | **20 líneas** |
| `Path Validation Error ... no cache is being saved` | sí | **sí** |
| Duración de `db-tests` | 3 m 51 s | 3 m 44 s |

No es un pico: pasa en cada corrida. El job aguanta porque reintenta y tiene 10 minutos de margen, pero es el único que prueba el esquema de verdad y depende de pulls anónimos a Docker Hub.

---

## Nota de proceso · el dato de la revisión lo certifica quien revisa

`docs/revision-pr/pr-54/hallazgos.jsonl` llegó modificado: cinco hallazgos pasaron a `arreglado-verificado` con `verificado_en_sha: "pendiente-de-merge"` y `ronda_arreglo: 1`.

El contenido es cierto —los arreglos están y las pruebas existen— así que no es un problema de honestidad. Pero **quien arregla no es quien verifica**, y si el autor marca sus propios arreglos como verificados, el campo deja de significar algo: es justo la distinción que la regla de `verificado_en_sha` existe para mantener. Dos cosas concretas quedaron mal por eso: `ronda_arreglo` decía 1 cuando los arreglos son de la ronda 2, y `pendiente-de-merge` se copió de un caso distinto (`PR51-H09`, donde el arreglo vivía en otra PR sin mergear).

Reescribí los cinco registros con mi propia verificación sobre `6a640e4`. **El camino correcto para el agy es la bitácora**, que es suya y donde ya dejó todo bien contado: «hecho», «pruebas», «falta». El `hallazgos.jsonl` es el cuaderno de quien revisa.

---

## Veredicto final: lista para aceptar

CI **9 de 9**, y es la primera PR del repo que cierra con todos los checks verdes, `approval-policy` incluido. Alcance limpio por octava ronda consecutiva.

Los dos ítems abiertos no son de esta tarea:

| # | Qué | Quién |
|---|---|---|
| 1 | **H02** — el caché de Docker en `ci.yml` | **@Lautaro073**, tarea de CI |
| 2 | **H07** — que la matriz de T-005 incluya un `update` por rol, no solo `select` | **T-005**, en su DoD |
| 3 | Mudar la nota de arranque del `admin` de `T-004.md` a `T-005.md` | **@Lautaro073**, PR de docs de tres líneas |
| 4 | Una línea sobre que el panel de Supabase no puede crear usuarios | onboarding o T-007 |
| 5 | La ficha de anonimización para la baja de cuentas con actividad | **@Lautaro073**, ficha nueva |

El 3 conviene hacerlo antes de que T-005 arranque: es exactamente el freno que nos costó T-003.
