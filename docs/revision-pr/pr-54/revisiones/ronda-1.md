# PR #54 · Ronda 1 — `85d3f6a`

| | |
|---|---|
| **SHA revisado** | `85d3f6a` |
| **Tarea** | T-004 (Fase 0 — Fundaciones y contratos) |
| **Base** | `82d6521` (merge de la #55 en develop) |
| **Tamaño** | 12 archivos, +1585 / −18 |
| **Fecha** | 2026-09-22 |

## Veredicto

**El trabajo está bien hecho, y es la mejor primera ronda de las cinco PRs revisadas.** El esquema tiene constraints reales en vez de columnas sueltas, el trigger de alta está bien cerrado, y las pruebas de pgTAP son **de conducta**: dan de alta un usuario de verdad contra `auth.users` y miran qué perfil sale. El ítem más delicado del DoD —*«registrarse con rol `admin` no crea un admin»*— está demostrado dos veces, y el `--schema public` de `PR51-H12` quedó en el lugar correcto.

**Ningún hallazgo es bloqueante de código.** El único check rojo es `approval-policy`, y es mío: falta el bloque literal del informe en el cuerpo. Está más abajo, listo para pegar.

| | |
|---|---|
| Abiertos | 6 (3 medios, 3 azules) |
| Bloqueantes | **0** |
| Alcance | 12 archivos, **0 fuera de la ficha** |
| CI | **8 de 9** · el rojo es `approval-policy`, por el informe que falta |

## Checks en `85d3f6a`

| Comando / job | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | **72/72 Vitest · 18/18 workflows** |
| `db-tests` en CI | **pass** · `structure.sql .. ok`, **37/37 pgTAP**, `All tests successful` |
| `db-tests` → tipos | `git diff --exit-code -- src/types/database.types.ts` **pass** |
| `db-types` en CI | pass (saltea: la PR toca `supabase/migrations`, así que cae en `mode=local`, como estaba previsto) |
| `typecheck` `lint` `unit` `build` `bundle-budget` `audit` | pass |
| `approval-policy` | **fail** — «Falta el informe completo de revisar-pr sin bloqueantes» |
| Alcance | 12 archivos vs. «Archivos permitidos» | **0 fuera** |

El `db-tests` verde es la verificación más fuerte que se puede tener acá: levanta el stack, corre el pgTAP y **regenera los tipos comparándolos con los commiteados**. Que pase significa que `src/types/database.types.ts` es exactamente la salida de `db:types --local` sobre esta migración, no una edición a mano.

---

## Lo que está bien, y es la mayor parte

- **El trigger de alta está bien cerrado.** `security definer` con `set search_path = public, pg_temp`, y la validación de rol antes de cualquier `insert`. Verifiqué la lógica de tres valores, que es donde suelen colarse los errores: con `role` ausente, `requested_role not in (...)` da `NULL`, y `NULL or (requested_role is null)` da `true`, así que **también rechaza el rol faltante**. No es un accidente: hay una prueba para ese caso.

- **Las pruebas de pgTAP son de conducta.** `pg_temp.signup_role()` inserta en `auth.users` con `raw_user_meta_data` y devuelve el rol del perfil resultante, o el error. Cinco casos: `merchant`, `courier`, `admin`, `visitor`, `null`. Y encima una sexta prueba aparte —`profile_count` = 0— que confirma que el alta de `admin` **no dejó un perfil colgado**. Eso es exactamente lo que el DoD pedía y no una prueba de forma sobre el DDL.

- **Los índices únicos parciales se afirman por su predicado, no por su nombre.** `indisunique`, `indpred is not null`, el `indexdef` y el contenido del predicado. Es `AG-25` aplicada sin que nadie la recordara.

- **Hay una prueba de privacidad estructural**, y es la que más me gustó: `delivery_requests` **no puede** tener `recipient_name`, `recipient_phone` ni coordenadas exactas — eso vive en `delivery_request_contacts`, separado. La prueba falla si alguien mañana agrega una de esas columnas a la tabla que los repartidores van a poder listar. Es un invariante de diseño convertido en control.

- **RLS habilitada y deny explícito en las 14 tablas**, con `using (false) with check (false)` para `anon` y `authenticated`. Nada de `using (true)`. El comentario dice por qué está así y quién lo reemplaza.

- **La obligación diferida tiene dueño y criterio demostrable.** `rls_enabled.sql` no existe todavía, y no es un hueco: la ficha de T-005 lo nombra en el objetivo, lo tiene en «Archivos permitidos» (`supabase/tests/rls_*.sql`) y su DoD dice *«`rls_enabled.sql` falla con una tabla sin RLS (demostrado)»*. Es `AG-21` cumplida — lo contrario de lo que pasó con el drift en la #49.

- **El seed es idempotente** (`on conflict do update`) y el comentario **cita la fuente** del centroide (nodo de OpenStreetMap) en vez de inventar una coordenada. El punto cae dentro de los bounds que la propia migración exige.

- **`dni_hmac` en vez del DNI**, con `check (~ '^[0-9a-f]{64}$')` y `unique`. La decisión de privacidad correcta, tomada en el esquema y no en la aplicación.

- **El `--schema public` quedó en `cliArgs`**, antes de la bifurcación de argumentos, así que lo reciben los dos caminos —`--local` y `--project-id`— que es exactamente lo que `PR51-H12` pedía y lo que la ficha explicaba.

- **La fase roja se hizo por CI**, porque Docker no estaba levantado. La bitácora registra la corrida donde el diff de tipos falló por el bloque `storage` y el paso siguiente que lo corrigió. Es el patrón que funcionó en T-003, aplicado sin que se lo pidieran otra vez.

---

## 🟡 H01 · El borrado de una cuenta no cascadea: falla

**`supabase/migrations/20260922031435_schema_v1.sql:16` · medio · análisis sobre el DDL**

`profiles.id` declara `references auth.users (id) on delete cascade`, que promete que borrar el usuario de auth borra su perfil. Esa promesa no se puede cumplir. Recorrí las 18 claves foráneas:

| Cascadean | No tienen `on delete` |
|---|---|
| `profiles.id` → `auth.users` | `couriers.decided_by` → `profiles` |
| `merchants.profile_id`, `couriers.profile_id` | `audit_log.actor_id` → `profiles` |
| `push_subscriptions.user_id`, `consents.profile_id` | `incidents.reporter_id` → `profiles` |
| `courier_documents.courier_id` | `delivery_requests.merchant_id` → `merchants` |
| `delivery_request_contacts.request_id` | `offers.courier_id` → `couriers` |

**El escenario concreto:** un comercio se da de alta, publica una solicitud y pide que le borren la cuenta. `delete from auth.users where id = ...` cascadea a `profiles` y a `merchants`, y ahí choca con `delivery_requests.merchant_id`, que es `not null` y sin acción → **violación de FK, el borrado falla entero**. Lo mismo con un repartidor que hizo una oferta, con quien reportó un incidente, y con cualquiera que tenga una fila en `audit_log`.

No es que falte un `cascade` en todos lados: **retener el historial de entregas es lo correcto.** El problema es que hoy la combinación no da ni «se borra» ni «se retiene», da «no se puede borrar». Y hay una pista de que la intención era otra: `audit_log.actor_id` y `couriers.decided_by` son **nullable**, que es la forma de `on delete set null`.

**Cómo resolverlo.** Dos partes, y una es de acá:

1. **Dentro de T-004:** `on delete set null` en `audit_log.actor_id` y `couriers.decided_by`. Las dos columnas ya aceptan null, así que es literalmente agregar la cláusula: la fila de auditoría sobrevive y pierde el vínculo con el actor, que es lo que se quiere de una auditoría.
2. **Decisión tuya, para otra ficha:** qué pasa con `delivery_requests`, `offers` e `incidents`. Si el historial se retiene —y debería—, entonces el `on delete cascade` de `profiles.id` es engañoso y hace falta un camino de **anonimización** (vaciar `display_name`, `phone`, y los contactos de `delivery_request_contacts`) en vez de un borrado. Una app que guarda nombre y teléfono de destinatarios va a necesitar ese camino; conviene que la ficha que lo construya exista antes de que alguien lo pida.

Una prueba de pgTAP que intente el borrado y afirme el resultado esperado cierra el tema en cualquiera de las dos direcciones.

## 🟡 H02 · El caché de `supabase` no guarda nada y `db-tests` depende de pulls anónimos a Docker Hub

**`.github/workflows/ci.yml:87` · medio · verificado en el log de CI · fuera de la ficha de T-004**

El job tardó **3 m 51 s** y el log trae veinte líneas de esto:

```
Error response from daemon: toomanyrequests: Rate exceeded
```

`supabase start` baja las imágenes desde Docker Hub sin autenticación, y el límite anónimo ya está pegando. Esta vez reintentó y salió bien; con `timeout-minutes: 10` hay margen, pero es una fuente de rojos intermitentes en el job que ahora es la única prueba real del esquema.

Y el paso que debería evitarlo no evita nada:

```
[warning]Path Validation Error: Path(s) specified in the action for caching
do(es) not exist, hence no cache is being saved.
```

`actions/cache` apunta a `~/.cache/supabase`, ese directorio no existe al final del job, así que **nunca se guarda nada y nunca se restaura nada**. Aparte, aunque existiera no serviría para esto: las imágenes las guarda el demonio de Docker, no el CLI. El paso está apuntado al lugar equivocado desde que se escribió.

**No es de T-004:** `.github/workflows/**` no está en su ficha. Va en la tarea que ajuste CI. Las salidas razonables son autenticar contra Docker Hub con un secreto, o cachear las imágenes con `docker save`/`docker load`, o pre-bajarlas de un registro propio. Lo que no conviene es dejar un paso de caché que anuncia algo que no hace.

## 🟡 H03 · Ningún `auth.users` puede nacer fuera del alta de la app, y ningún `admin` puede existir

**`supabase/migrations/20260922031435_schema_v1.sql:227` · medio · análisis**

El trigger corta el alta cuando el rol no es `merchant` ni `courier`, y cortar es lo correcto para `admin`. Pero corta **cualquier** inserción en `auth.users` que no traiga un rol válido en `raw_user_meta_data`, y hay caminos legítimos que no lo traen:

- crear un usuario desde el panel de Supabase, que es como se arman los usuarios de prueba;
- `inviteUserByEmail`, que crea el usuario antes de que la persona elija nada;
- un proveedor OAuth, si alguna vez se suma.

Los tres fallan hoy, y con un 500 opaco, porque una excepción en un trigger `after insert` sobre `auth.users` aborta el alta entera desde el lado de GoTrue.

La otra cara es más concreta: **`profile_role` tiene `admin` y no hay ningún camino que cree uno.** El esquema lo da por existente —`couriers.decided_by` apunta al perfil que aprueba o rechaza, `incidents` y `audit_log` suponen un actor administrativo— y T-005 va a escribir una matriz de RLS con un rol `admin` en ella. Hoy el único modo de tener uno es dar de alta un `merchant` y después hacer `update public.profiles set role = 'admin'` con el service role.

**No lo trato como defecto porque el DoD pide exactamente lo que hace.** Lo que falta es la decisión y que quede escrita:

- **(a)** dejar el trigger estricto y **documentar el procedimiento de arranque del admin** —alta normal más un `update` con service role— en la ficha de T-005, que es la que va a necesitarlo; o
- **(b)** que el trigger tolere el rol ausente sin crear perfil (`return new` en vez de `raise`) y siga rechazando el rol inválido. Deja usuarios sin perfil, que las policies de T-005 tienen que contemplar.

Yo iría por **(a)**: es menos superficie y la restricción fuerte es un activo. Pero el procedimiento tiene que estar escrito antes de T-005, o la matriz de RLS se va a escribir para un rol que nadie puede tener.

## 🔵 H04 · `grant execute` de una función `security definer` a `authenticated`

**`supabase/migrations/20260922031435_schema_v1.sql:250` · bajo**

```sql
revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to authenticated;
```

El `revoke` está bien. El `grant` es la forma clásica que la regla de seguridad pide mirar: `execute` sobre una función `security definer` entregado a un rol de usuario final. **Hoy no es explotable**, porque PostgreSQL no deja llamar una función de trigger directamente —falla con *«trigger functions can only be called as triggers»*— y es la única razón por la que no importa.

Pero el grant tampoco hace falta: el privilegio de `execute` sobre la función de un trigger se verifica al crear el trigger, no cada vez que dispara. Y si hiciera falta en tiempo de disparo, **el rol estaría equivocado**: en `auth.users` inserta `supabase_auth_admin`, no `authenticated`.

Lo que más importa de esto: **la suite de pgTAP no puede notar la diferencia**, porque `supabase test db` corre como superusuario y nunca ejerce el grant. O sea que si el grant fuera necesario y estuviera mal puesto, las 37 pruebas seguirían en verde y el alta real fallaría.

**Cómo resolverlo.** Borrar la línea del `grant`. Si por algo se quiere conservar, que nombre a `supabase_auth_admin` y no a `authenticated`. La prueba de punta a punta es un alta real por GoTrue, que es territorio de T-007 o una prueba manual en staging después del merge.

## 🔵 H05 · `updated_at` en tres tablas, sin nada que lo actualice

**`supabase/migrations/20260922031435_schema_v1.sql:100` · bajo**

`delivery_requests`, `offers` e `incidents` tienen `updated_at timestamptz not null default now()`, y la migración define **un solo trigger**, el de alta de usuario. Ningún `before update` lo mantiene.

El resultado es una columna que dice «última modificación» y siempre muestra la fecha de creación. Es el tipo de dato que se usa sin desconfiar —para ordenar, para «cambió algo desde que miré»— y va a estar mal. Se arregla con una función `set_updated_at()` y tres triggers, o se documenta que la mantiene la capa de RPC de T-006. Lo que no conviene es dejarla ambigua.

## 🔵 H06 · `accepted_offer_id` no está atado a una oferta de la misma solicitud

**`supabase/migrations/20260922031435_schema_v1.sql:147` · bajo**

```sql
alter table public.delivery_requests
  add constraint delivery_requests_accepted_offer_fk
  foreign key (accepted_offer_id) references public.offers (id);
```

La FK circular está bien resuelta —se agrega después de crear `offers`—, pero solo exige que la oferta **exista**: nada impide que `delivery_requests.accepted_offer_id` apunte a una oferta de **otra** solicitud. El índice `offers_one_accepted_per_request_idx` garantiza «una aceptada por solicitud», que es otra cosa.

Se cierra con una FK compuesta, que además es más barata que un trigger:

```sql
alter table public.offers add constraint offers_id_request_uk unique (id, request_id);
alter table public.delivery_requests
  add constraint delivery_requests_accepted_offer_fk
  foreign key (accepted_offer_id, id) references public.offers (id, request_id);
```

Si se prefiere dejarlo para la RPC de aceptación en T-006, vale — pero entonces conviene que su DoD lo nombre, porque es el invariante que sostiene «a quién le tengo que pagar».

---

## Alcance

12 archivos, **0 fuera de la ficha**. Séptima ronda consecutiva en cero. `tools/db-types.mjs` y `package.json` cuentan como dentro porque la ficha los declaró acotados antes de arrancar, y el diff respeta el límite: una línea en el script, un script en `package.json`, cero dependencias, `pnpm-lock.yaml` intacto.

Los cuatro archivos de `docs/revision-pr/pr-51/` que viajan en esta PR son el rescate de la ronda 5, que quedó afuera del merge de la #51. Está dentro de `docs/revision-pr/**`.

## 🔴 Lo único que impide mergear, y es mío

`approval-policy` está rojo por *«Falta el informe completo de revisar-pr sin bloqueantes»*. Es la primera PR que pasa por el control nuevo de la #55, y está funcionando como debe: la sección del cuerpo tiene un comentario en vez del bloque literal.

Comprobado ejecutando el módulo contra el cuerpo real: con este bloque pegado en «Informe de revisión de agy», `evaluateApprovalPolicy` devuelve `{ ok: true }`.

```
Informe revisar-pr — T-004 — 2026-09-22 — generado por la revisión independiente
Resultado: SIN BLOQUEANTES
Checks locales: typecheck ✅ · lint ✅ · test ✅ (72/72 Vitest, 18/18 workflows) · test:db ✅ 37/37 pgTAP en CI
BLOQUEANTES:
- ninguno
MEJORAS:
- H01 on delete set null en audit_log.actor_id y couriers.decided_by
- H05 trigger que mantenga updated_at en delivery_requests, offers e incidents
- H06 FK compuesta para que accepted_offer_id sea de la misma solicitud
- H04 borrar el grant execute de handle_new_user a authenticated
No revisado / dudas para Lautaro073:
- H01 segunda parte: qué pasa con delivery_requests, offers e incidents al borrar una cuenta. Si el historial se retiene, hace falta un camino de anonimización en otra ficha
- H03 cómo se crea el primer admin: el enum lo tiene y ningún camino lo produce. Conviene escribirlo en la ficha de T-005 antes de que escriba la matriz de RLS
- H02 el caché de supabase en ci.yml no guarda nada y db-tests depende de pulls anónimos a Docker Hub, que ya están siendo limitados. Es de .github/workflows, fuera de esta ficha
- El alta real por GoTrue no se probó: la máquina de desarrollo no tiene credenciales y Docker no estaba levantado. Las 37 pruebas de pgTAP corren como superusuario
```

Nota menor del cuerpo: el comentario de esa sección todavía dice *«el informe lo genera quien aprueba (P2 o P3 con la skill revisar-pr)»*, que es la regla que la #55 cambió. El template ya está corregido; el cuerpo de esta PR quedó escrito antes.

## Para cerrar

| # | Qué | Quién |
|---|---|---|
| 1 | Pegar el bloque del informe en el cuerpo → `approval-policy` verde y CI 9/9 | **quien apruebe** |
| 2 | **H01** parte 1 — `on delete set null` en `audit_log.actor_id` y `couriers.decided_by` | agy |
| 3 | **H05** — trigger de `updated_at`, o decir que lo mantiene T-006 | agy |
| 4 | **H06** — FK compuesta, o pasarlo al DoD de T-006 | agy |
| 5 | **H04** — borrar el `grant execute` | agy |
| 6 | **H01** parte 2 y **H03** — política de borrado de cuentas y arranque del admin | **@Lautaro073**, decisión |
| 7 | **H02** — caché de Docker en `ci.yml` | **@Lautaro073**, otra tarea |

Ninguno de los cinco primeros toca nada fuera de la ficha.
