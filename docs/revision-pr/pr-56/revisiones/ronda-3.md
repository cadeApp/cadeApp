# PR #56 · Ronda 3 — `aad5031`

| | |
|---|---|
| **SHA revisado** | `aad5031` |
| **Ronda anterior** | `86fd6fe` ([`ronda-2.md`](ronda-2.md)) |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Base** | `f698539` |
| **Tamaño** | 14 archivos, +1959 / −0 |
| **Fecha** | 2026-09-22 |

## Veredicto

**Los tres arreglos están bien, y la disciplina de esta ronda fue la mejor de toda la PR.** Las pruebas 29 y 30 se commitearon **solas, antes del arreglo**, y CI las tiró en rojo:

```
73ab5f1  # Failed test 29: "courier cannot change the amount of an already accepted offer"
         # Failed test 30: "merchant cannot mark its own request as delivered"
         (Wstat: 0 Tests: 30 Failed: 2)  ·  Result: FAIL
e75093f  Result: PASS
```

Eso es la fase roja demostrada en el histórico, no afirmada en un informe. Es exactamente lo que el principio 8 pide y es la primera vez en esta PR que queda como commit separado.

**Y ahora lo que me toca a mí.** Barrí `update` en las tres rondas y **nunca barrí `insert`**. Al hacerlo ahora aparecen cinco casos más del mismo patrón, ninguno tocado por nadie: estaban desde el primer commit.

> **`offers_insert_courier` deja nacer una oferta en `accepted`.** Es el mismo cupo del índice único parcial que `H11` acaba de cerrar por `update`, alcanzable por `insert` en la misma sentencia.

> **`delivery_requests_insert_merchant` deja nacer una solicitud en `delivered`** con `delivered_at` y `created_at` fabricados. `H12` congeló esas columnas en `update` y las dejó libres en `insert`.

> **`courier_documents_insert_self` deja nacer un documento en `verified`.** Es el hermano de `H01` por `insert`.

Es la tercera ronda seguida en que **los hallazgos nuevos los genera la incompletitud de esta revisión**, no trabajo nuevo. Por eso esta vez no entrego una lista: entrego [la enumeración completa de las policies](#la-enumeración-completa-para-que-no-haya-ronda-4), tabla por tabla y operación por operación, para que no haya ronda 4 de esta familia.

| | |
|---|---|
| Cerrados en esta ronda | 4 (H11, H12, H14, A02) |
| Abiertos | 8 (1 alto · 5 medios · 2 bajos) — uno de ellos es decisión de Lautaro073 |
| **Bloqueantes** | **0** |
| Alcance | 14 archivos, **0 fuera de la ficha** |
| CI | **9 de 9** · `db-tests` con **73/73** pgTAP en 3 archivos |

## Checks en `aad5031`

| Comando / job | Resultado |
|---|---|
| `pnpm typecheck` · `pnpm lint` | exit 0 |
| `pnpm test` | 72/72 Vitest · 18/18 workflows |
| `db-tests` en CI (run `35696899101`) | **pass** · `Files=3, Tests=73` · `Result: PASS` |
| `db-types` en CI | **pass**, sin diff |
| CI completo | **9 de 9** |
| Alcance | 14 archivos, **0 fuera** — undécima ronda consecutiva |

**Alcance de estos checks:** ninguno toca SQL salvo `db-tests`, y `db-tests` solo prueba lo que la matriz afirma. Los ocho hallazgos abiertos están en ese punto ciego: los 73 tests siguen en verde con los ocho presentes.

---

## Hallazgos cerrados

| ID | Cómo lo verifiqué en `aad5031` |
|---|---|
| **H11** | `offers_update_courier` congela `request_id` y `status`, y exige que el estado actual sea `pending`, así que una oferta deja de ser editable en cuanto sale de ese estado. Prueba 29, **roja en `73ab5f1` y verde en `e75093f`**. Residual: el camino de `insert` sigue abierto → `H15`. |
| **H12** | `delivery_requests_update_merchant` congela `status`, `accepted_offer_id`, `created_at` y los cinco *timestamps* de ciclo de vida. Prueba 30, roja y después verde. La prueba 18 sigue pasando, así que el `update` de contenido (`notes`) no se rompió. Residual: `insert` → `H16`; consecuencia sobre el flujo → `H06`. |
| **H14** | `zones_select_admin` eliminada y el comentario de la sección actualizado. El admin sigue leyendo todas las zonas por `zones_write_admin`, que es `for all`. |
| **A02** | **No volvió a pasar.** `git status --short` limpio, ningún comentario nuevo firmado como revisión en la PR, y `docs/revision-pr/**` sin tocar en los tres commits. El único canal usado fue la bitácora. La regla de `COMO-ENTREGAR.md` funcionó a la primera. |

---

## Hallazgos abiertos

### El barrido de `insert`

Las tres rondas de esta PR miraron `select` (rondas 1 y 2) y `update` (rondas 2 y 3). **Ninguna miró `insert`.** Hay siete policies de `insert` para actores no admin; tres dejan que el cliente elija el estado inicial de la fila y dos dejan que elija una fecha que debería poner el servidor.

La forma del defecto es siempre la misma y es la que `AG-33` describe para `update`, un paso antes: **un `with check` que solo verifica de quién es la fila no dice nada sobre cómo puede nacer.**

---

### 🟠 H15 · ALTO — Una oferta puede nacer en `accepted`, que es justo lo que `H11` cerró por `update`

`supabase/migrations/20260922051650_rls_v1.sql:344`

```sql
create policy offers_insert_courier on public.offers
  for insert to authenticated
  with check (
    courier_id = auth.uid()
    and app_private.is_approved_courier()
  );
```

`status` tiene `default 'pending'`, pero un valor explícito pisa el *default*, y no hay ningún `before insert` en `offers` que lo fuerce (los tres triggers del esquema son `before update`). Así que:

```sql
insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, status)
values (<cualquier solicitud publicada>, auth.uid(), 1, 1, 'accepted');
```

Eso toma el cupo de `offers_one_accepted_per_request_idx` —`unique (request_id) where status = 'accepted'`— y ninguna otra oferta de esa solicitud puede pasar a `accepted`, **ni la RPC de T-006**. Es el mismo efecto que `H11`, por la sentencia que `H11` no cubre. Y `decided_at` también queda libre.

**Cómo cerrarlo.** El estado inicial lo fija la policy:

```sql
with check (
  courier_id = auth.uid()
  and app_private.is_approved_courier()
  and status = 'pending'
  and decided_at is null
)
```

**Prueba que hoy pasaría y tiene que fallar:**

```sql
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select throws_ok(
  'insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, status)
   values (pg_temp.req_m2_pub_id(), pg_temp.courier_approved_2_id(), 1, 1, ''accepted'')',
  '42501'::char(5), null::text,
  'courier cannot create an offer that is born accepted'
);
```

---

### 🟡 H16 · MEDIO — Una solicitud puede nacer en `delivered`, con los *timestamps* fabricados

`supabase/migrations/20260922051650_rls_v1.sql:279`

`delivery_requests_insert_merchant` es `with check (merchant_id = auth.uid())` y nada más. El comercio inserta directamente con `status = 'delivered'`, `delivered_at`, `matched_at`, `picked_up_at`, `published_at` y `created_at` a lo que quiera. `H12` acaba de congelar exactamente ese conjunto **para `update`**.

`accepted_offer_id` es la excepción y no por la policy: la FK compuesta `(accepted_offer_id, id) references offers (id, request_id)` no puede satisfacerse en el `insert` de una solicitud nueva, porque la oferta referencia a la solicitud que todavía no existe. Ahí el esquema aguanta solo.

En T-007 una solicitud `delivered` fabricada es la base de una liquidación.

**Cómo cerrarlo.** `status = 'draft'` y los cinco *timestamps* en `null` al nacer, con `created_at` dejado al *default*.

---

### 🟡 H17 · MEDIO — Un documento de repartidor puede nacer en `verified`

`supabase/migrations/20260922051650_rls_v1.sql:251`

```sql
create policy courier_documents_insert_self on public.courier_documents
  for insert to authenticated
  with check (courier_id = auth.uid());
```

`courier_documents.status` es `document_review_status` con `default 'submitted'`, y el repartidor puede insertar con `'verified'`. Es el hermano de `H01`: ahí el repartidor no puede ponerse `license_status = 'verified'` en `couriers`, pero acá puede subir el documento ya marcado como verificado.

Hoy **no** sube `doc_level`, porque esa columna se calcula sobre `couriers`, que `H01` congeló. Lo que rompe es la revisión: el panel de admin de T-006 va a listar documentos `verified` que nadie verificó. Es la misma forma que `decided_by` en `H01` — fabricar el registro de una decisión ajena.

Y `purge_after` / `purged_at` también quedan libres, que es la contabilidad de retención de datos personales.

Lo que **no** pasa, y conviene anotarlo: un comercio no puede insertar acá aunque la policy no le pida rol, porque `courier_id references public.couriers (profile_id)` y `handle_new_user` solo crea fila en `couriers` para el rol `courier`. La FK tapa el agujero que `H09` tuvo que tapar a mano en `storage.objects`, donde no hay FK.

**Cómo cerrarlo.** `status = 'submitted'` y `purge_after is null and purged_at is null` en el `with check`.

---

### 🔵 H18 · BAJO — Un incidente puede nacer `resolved`, con su `resolution` escrita

`supabase/migrations/20260922051650_rls_v1.sql:390`

`incidents_insert_authenticated` pide ahora la relación con la solicitud —bien, es `H08`— pero deja libres `status` y `resolution`. Quien reporta puede crear el incidente ya cerrado, con el texto de resolución puesto. Es ruido para el admin más que un riesgo, igual que era `H08`.

**Cómo cerrarlo.** `status = 'open' and resolution is null`.

---

### 🔵 H19 · BAJO — El cliente elige `accepted_at` y `version` de su propio consentimiento

`supabase/migrations/20260922051650_rls_v1.sql:422`

`consents_insert_self` es `with check (profile_id = auth.uid())`. El consentimiento es, por definición, una declaración del propio usuario, así que el `profile_id` está bien. Lo que no debería elegir el cliente es **cuándo** lo declaró: `accepted_at` tiene `default now()` y se puede mandar una fecha pasada.

Un registro de consentimiento existe para tener valor probatorio. Si la fecha la pone el cliente, no lo tiene.

**Cómo cerrarlo.** `accepted_at = now()` en el `with check` —`now()` es estable dentro de la transacción, así que la comparación es exacta— y validar `version` contra `platform_settings.pilot_terms_version` cuando el documento sea `pilot_terms`. Lo segundo puede esperar a T-006.

---

### 🟡 H20 · MEDIO — La matriz no tiene aserción positiva para lo que `H11` acotó, ni ninguna sobre `delete`

`supabase/tests/rls_matrix.sql`

Dos huecos, los dos de `AG-32`:

1. **Falta el lado positivo de `H11`.** La prueba 29 verifica que el repartidor no puede tocar una oferta `accepted`. No hay ninguna que verifique que **sí** puede editar una `pending`. Si la subconsulta del `with check` estuviera mal escrita y ninguna oferta fuera editable nunca, los 73 tests siguen en verde. `offer_c2` está en `pending` y es de `courier_approved_2`: la prueba cuesta cuatro líneas.
2. **Cero aserciones de `delete`, en una matriz que dice ser «por rol».** Es coherente con el diseño —fuera de `push_subscriptions_all_self` y las policies de admin, ningún actor tiene policy de `delete`—, pero eso es justo lo que `AG-32` pide escribir y probar: *si una celda es «nadie», se escribe así y se prueba que el cliente no puede*. Hoy, si alguien agregara una policy de `delete` por error, nada lo detecta.

**Cómo cerrarlo.** Una `lives_ok` para el caso 1, y para el caso 2 un `throws_ok` por cada tabla con dueño: el comercio no puede borrar su propia solicitud, el repartidor no puede borrar su propia oferta.

---

### 🔵 H06 · DECISIÓN — Ya no se puede postergar: aceptar una oferta quedó a medias

`supabase/migrations/20260922051650_rls_v1.sql:363`

`H12` congeló `accepted_offer_id` en `delivery_requests`. `offers_update_merchant` sigue **sin** congelar `status`. O sea que hoy, desde el cliente:

| Paso de «aceptar una oferta» | Quién lo permite |
|---|---|
| `offers.status = 'accepted'` | ✅ el comercio, `offers_update_merchant` |
| `delivery_requests.accepted_offer_id = <oferta>` | ❌ nadie salvo admin, desde `H12` |

El resultado es un estado intermedio que no se puede completar: la oferta queda en `accepted` **ocupando el cupo del índice único**, la solicitud sigue en `published` sin `accepted_offer_id`, y el repartidor no queda asignado, porque `is_courier_assigned_to_request` exige las dos cosas. El comercio puede revertirlo a mano —`status` es libre para él—, pero no puede terminar de aceptar.

En el mismo movimiento, `H11` dejó al repartidor **sin poder retirar su oferta**: `status` congelado y editable solo mientras es `pending`, sin transición explícita a `withdrawn`. El valor existe en el enum `offer_status` y hoy solo lo puede poner un admin.

Ninguna de las dos cosas rompe nada hoy, porque no hay cliente. Las dos rompen a T-006 el día que escriba el flujo.

**Es una sola decisión y hay que tomarla ahora, porque `H15`, `H16` y `H20` dependen de la respuesta:**

- **(a) El estado lo mueve la RPC.** Congelar `offers.status` también para el comercio, y que aceptar, rechazar, retirar, publicar y cancelar sean RPC `security definer` de T-006. Queda consistente con lo que `H11` y `H12` ya hicieron, y pone la transacción, el audit y la notificación en un solo lugar. **Es la que recomiendo.**
- **(b) El estado lo mueve el cliente.** Habilitar en cada policy las transiciones concretas comparadas contra el valor actual: comercio `pending → accepted|rejected` sobre `offers` y `draft → published` / `* → cancelled` sobre `delivery_requests`; repartidor `pending → withdrawn`.

Si es **(a)**, hace falta una línea en el DoD de T-006 que diga qué ya no puede hacer el cliente. Sin esa línea, T-006 se choca con la pared y no va a saber por qué.

---

### 🟡 H13 · MEDIO — Sigue abierto: el residual de columnas de `H03`

Sin cambios desde la ronda 2. Un repartidor aprobado que ve una solicitud publicada lee la fila entera del comercio, con `notes`, `paid_until` y la dirección de retiro. RLS no filtra columnas: hace falta una vista. **No en esta PR** → DoD de T-006, junto con lo que salga de `H06`.

---

## La enumeración completa, para que no haya ronda 4

Las cincuenta y tres policies de la migración, agrupadas por tabla, mirando solo el eje que importa: **qué puede escribir un actor que no es admin.** Las filas en las que las cuatro celdas están cerradas no vuelven a aparecer en ninguna ronda.

| Tabla | `insert` no admin | `update` no admin | `delete` no admin | Estado |
|---|---|---|---|---|
| `profiles` | — (lo crea el trigger) | self, congela `role` | — | ✅ |
| `zones` | — | — | — | ✅ |
| `merchants` | — | self, congela 3 | — | ✅ `H02` |
| `couriers` | — | self, congela 7 | — | ✅ `H01` |
| `courier_documents` | self, **no congela nada** | — | — | 🔴 `H17` |
| `delivery_requests` | merchant, **no congela nada** | merchant, congela 8 | — | 🔴 `H16` · ✅ `H12` |
| `delivery_request_contacts` | merchant | merchant | — | ✅ todo es contenido del comercio |
| `offers` | courier, **no congela nada** | courier ✅ `H11` · merchant, **`status` libre** | — | 🔴 `H15` · 🔵 `H06` |
| `incidents` | relación ✅ `H08`, **`status` y `resolution` libres** | — | — | 🔴 `H18` |
| `push_subscriptions` | self | self | self | ✅ todo es del usuario |
| `consents` | self, **`accepted_at` libre** | — | — | 🔴 `H19` |
| `audit_log` | — | — | — | ✅ solo admin |
| `platform_settings` | — | — | — | ✅ solo admin |
| `rate_limits` | — | — | — | ✅ solo admin |
| `storage.objects` | ✅ `H09` | — | — | ✅ |

Reconstruir esta tabla cuesta un comando:

```bash
grep -n "create policy" supabase/migrations/20260922051650_rls_v1.sql
```

Cincuenta y tres líneas, catorce tablas. Leerlas todas cuesta menos que una ronda.

---

## Para cerrar

Ninguno bloquea el merge. En orden:

1. **H06** — 🔵 **decisión de Lautaro073, primero que todo lo demás.** `H15`, `H16` y `H20` cambian según la respuesta. No la resuelva el agy.
2. **H15** — el `with check` de `offers_insert_courier` fija `status = 'pending'`. Independiente de la decisión: nazca como nazca el flujo, una oferta no nace aceptada.
3. **H16** y **H17** — el mismo cambio sobre `delivery_requests` y `courier_documents`.
4. **H18** y **H19** — dos líneas cada uno.
5. **H20** — la aserción positiva de `H11` y las de `delete`.
6. **H13** — **no en esta PR** → DoD de T-006.

Con `H15` a `H20` cerrados, la tabla de arriba queda entera en verde y **esta familia se termina**. Lo que quede después va a T-006 con su línea en el DoD.
