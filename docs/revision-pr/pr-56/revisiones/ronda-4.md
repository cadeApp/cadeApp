# PR #56 · Ronda 4 — `f48c95b` · **Lista para mergear**

| | |
|---|---|
| **SHA revisado** | `f48c95b` |
| **Ronda anterior** | `aad5031` ([`ronda-3.md`](ronda-3.md)) |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Base** | `f698539` |
| **Tamaño** | 15 archivos, +2590 / −1 |
| **Fecha** | 2026-09-22 |

## Veredicto

**Cerrada. Los siete hallazgos abiertos de la ronda 3 están resueltos, y la tabla de las 53 policies queda entera en verde.**

La ronda hizo tres cosas bien, y las tres en el orden correcto:

1. **Las pruebas se commitearon solas otra vez** (`7da1949`), y CI las tiró en rojo con precisión: `Tests: 49 Failed: 16`, las aserciones 31–45 y 47, **todas** con `caught: no exception, wanted: 42501`. Las positivas y las de `delete` pasaron en la misma corrida. Eso no es solo la fase roja: es la fase roja que prueba que lo que falla es exactamente lo que se va a arreglar y nada más.
2. **El arreglo llegó después** (`e076368`), y con él las cinco policies de `insert` fijan el estado inicial.
3. **Y después se agregaron seis aserciones positivas** (`bf46dba`), una por cada policy endurecida, verificando que el camino legítimo sigue abierto. Eso es `AG-32` y `AG-34` aplicadas sin que nadie las pidiera esta vez.

Hay un detalle que conviene señalar porque está **por encima** de lo que pedí. La prueba 50:

```sql
-- 50. H20: lives_ok alone would also accept an UPDATE that changed zero rows.
select is(
  (select message from public.offers where id = pg_temp.offer_c2_id()),
  'still available',
  'courier pending offer edit persisted'
);
```

Yo había pedido una `lives_ok`. Una `lives_ok` sobre un `UPDATE` que no matchea ninguna fila **también pasa**: RLS no lanza error en un `update` que afecta cero filas, simplemente no hace nada. La prueba 46 sola habría sido un `P04-test-tautologico`. La 50 lo cierra verificando que el cambio quedó escrito. No se lo pedí y es lo correcto.

Lo mismo con las de `delete` (48 y 49): un `delete` sin policy tampoco lanza error, borra cero filas. Por eso no se afirman con `throws_ok` sino contando que la fila sobrevivió. Está bien resuelto.

| | |
|---|---|
| Cerrados en esta ronda | 7 (H06, H15, H16, H17, H18, H19, H20) |
| Abiertos | 3 — **ninguno de esta PR**: 1 medio diferido y 2 azules cosméticos |
| **Bloqueantes** | **0** |
| Alcance | 15 archivos, **0 fuera de la ficha** — duodécima ronda |
| CI | **9 de 9** · `db-tests` con **98/98** pgTAP en 3 archivos |

## Checks en `f48c95b`

| Comando / job | Resultado |
|---|---|
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | exit 0 · 72/72 Vitest · 18/18 workflows |
| `db-tests` en CI (run `35700546988`) | **pass** · `rls_matrix.sql` 55/55 · `Files=3, Tests=98` · `Result: PASS` |
| `db-types` en CI | **pass**, sin diff |
| CI completo | **9 de 9** |
| Alcance | 15 archivos, **0 fuera** |

## DoD de T-005

| Criterio | Estado |
|---|---|
| Matriz por rol (merchant, courier approved/pending/suspended, admin, anon) | ✅ 55 aserciones con los roles reales vía `act_as()`, en las cuatro operaciones y en las dos direcciones |
| Un repartidor no aceptado no lee contactos | ✅ prueba 9, afirmada con el conjunto exacto (`array_agg`), más el negativo de la 10 |
| El bucket no se puede leer | ✅ pruebas 14, 15 y 16 |
| `rls_enabled.sql` falla con una tabla sin RLS (demostrado) | ✅ demostrado en la bitácora con `_table_without_rls` plantada |
| `pnpm typecheck && pnpm lint && pnpm test` | ✅ exit 0 |
| Sin cambios fuera de «Archivos permitidos» | ✅ 15 de 15 dentro |
| Bitácora al día y PR con evidencia | ✅ |

---

## Hallazgos cerrados

| ID | Cómo lo verifiqué en `f48c95b` |
|---|---|
| **H15** | `offers_insert_courier` exige `status = 'pending'` y `decided_at is null`. Pruebas 31 y 32 negativas, **rojas en `7da1949`**; prueba 51 positiva: un repartidor aprobado sigue pudiendo ofertar. |
| **H16** | `delivery_requests_insert_merchant` exige `status = 'draft'`, `created_at = now()` y los cinco *timestamps* en `null`. Siete aserciones negativas (33–39), una por columna, todas rojas antes; prueba 52 positiva. `created_at = now()` funciona porque `now()` es `transaction_timestamp()` y el `default` de la columna evalúa lo mismo en la misma transacción: por eso el `insert` normal pasa y el retroactivo no. |
| **H17** | `courier_documents_insert_self` exige `status = 'submitted'`, `purge_after is null` y `purged_at is null`. Pruebas 40–42 negativas, 53 positiva. |
| **H18** | `incidents_insert_authenticated` exige `status = 'open'` y `resolution is null`. Pruebas 43, 44 y 54. |
| **H19** | `consents_insert_self` exige `accepted_at = now()`. Pruebas 45 y 55. |
| **H20** | Los dos huecos cerrados: la positiva de `H11` (46) **con verificación de persistencia** (50), y las de `delete` sobre `delivery_requests` y `offers` (48, 49), afirmadas contando la fila en vez de con `throws_ok`, que es lo correcto porque un `delete` sin policy no lanza error. |
| **H06** | **Decisión tomada: (a), el estado lo mueve la RPC.** `offers_update_merchant` congela ahora `status` y `decided_at`, con el comentario `T-006 RPC owns the transition`. Prueba 47: el comercio no puede aceptar una oferta sin la RPC, roja antes. La bitácora registra que la decisión la confirmó la persona, no el agy. |

---

## Corrección de la ronda 3: la RPC no es de T-006

En la ronda 3 escribí que las transiciones «serían RPC de T-006». **Está mal y hay que dejarlo corregido**, porque de ahí sale a dónde va el pendiente.

`T-006` es de **P2** y sus archivos permitidos son `src/domain/**`: define `rpc-contracts.ts`, los `DomainErrorCode`, los schemas Zod y el fake. Es la capa de **contrato**, no la implementación SQL. Las RPC de verdad están repartidas así, según `docs/implementation-plan.md`:

| Lo que el cliente ya **no** puede hacer directamente | RPC que lo va a hacer | Tarea |
|---|---|---|
| Ofertar con estado decidido · retirar una oferta | `submit_offer`, `withdraw_offer` | **T-101** (P1) |
| Aceptar una oferta | `accept_offer` *«atómica e idempotente»* | **T-102** (P1) |
| Publicar, cancelar, marcar entregada, reportar incidente | ciclo de solicitud | **T-103** (P1) |
| Verificar un documento, decidir un repartidor, fijar suscripción | `admin_verify_document`, `admin_decide_courier`, `admin_set_subscription` | **T-105** (P1) |

**No queda ningún huérfano.** Todo lo que esta PR le sacó al cliente tiene una RPC ya planificada que lo hace. Y el caso de `T-102` lo confirma desde el otro lado: su DoD pide *«10 llamadas concurrentes → una sola ganadora; idempotencia; `ALREADY_MATCHED`»*, y ese invariante **no se puede sostener** si el cliente puede escribir `offers.status = 'accepted'` por su cuenta. La decisión (a) no es una preferencia: es lo que el plan ya pedía.

El agy llegó a esta misma conclusión por su cuenta y la dejó escrita en la bitácora, incluida la parte de que esas fichas están fuera de los «Archivos permitidos» de T-005. Correcto: por eso el pendiente sale de esta PR y no entra en ella.

---

## Lo que queda abierto, y ninguno es de esta PR

### 🟡 H13 · Va a **T-106**, no a T-006

El residual de columnas de `H03`: un repartidor aprobado que ve una solicitud publicada lee la fila entera del comercio.

Revisando el plan con la corrección de arriba, **T-106 ya lo cubre a medias y nadie lo había notado**: es *«Migración, RLS de coordenadas (`merchants.default_pickup_lat/lng`, …)»*, y su DoD pide *«pgTAP de RLS: repartidor no aceptado recibe NULL al leer coordenadas»*. O sea que `default_pickup_lat`, `default_pickup_lng` y las coordenadas de contactos **ya están planificadas**.

Lo que falta agregarle a T-106 son tres columnas que no son coordenadas: **`notes`, `paid_until` y `subscription_status`**. `notes` es el que más importa: es campo administrativo y hoy lo lee cualquier repartidor aprobado.

### 🔵 H21 · `offers_update_merchant` quedó vestigial

`supabase/migrations/20260922051650_rls_v1.sql:380`

Con `status` y `decided_at` congelados, el `with check` ahora congela `courier_id`, `request_id`, `amount_ars`, `eta_minutes`, `message`, `status` y `decided_at`. De las diez columnas de `offers`, `id` no se puede mover —la subconsulta `where o.id = offers.id` devuelve `null` si cambia y la comparación falla— y `updated_at` lo pisa el trigger.

**Lo único que el comercio todavía puede escribir en una oferta es `created_at`**, que reordena el listado de ofertas por antigüedad. La policy pasó a conceder exactamente una cosa, y esa cosa no debería concederse.

Lo limpio es **borrar `offers_update_merchant`**: con la decisión (a), `accept_offer` de T-102 corre como `security definer` y no necesita policy. Se puede hacer acá o en T-102; anotado para que no se pierda.

### 🔵 H22 · `created_at` sigue escribible en `profiles`

`supabase/migrations/20260922051650_rls_v1.sql:160`

`profiles_update_self` congela `role` y nada más. `display_name` y `phone` son del usuario, pero `created_at` no: el usuario puede reescribir su propia fecha de alta. Es el mismo residual que `H21` en otra tabla, y de la misma familia que el `created_at = now()` que `H16` acaba de exigir en `delivery_requests`.

Dos líneas cuando se toque la migración. No justifica una ronda.

---

## Lo que esta PR deja bien hecho

- **La matriz es real.** 55 aserciones con `set local role` y `request.jwt.claims`, cuatro operaciones, positivas y negativas, sobre nueve actores. Empezó siendo 15 aserciones de las cuales 14 eran `select`.
- **`rls_enabled.sql` es genérico**: barre `pg_class` en vez de una lista, así que atrapa cualquier tabla futura sin RLS.
- **El esquema `app_private` con `security definer`** resuelve a la vez la recursión de RLS y la contaminación de `database.types.ts`.
- **El invariante de contactos del DoD se afirma con el conjunto exacto**, no con un conteo, y tiene su negativo.
- **La fase roja quedó en el histórico dos rondas seguidas**, como commit separado, con el log de CI que la muestra.

## Lo que esta PR deja como dato de proceso

Veintidós hallazgos en cuatro rondas. **Siete de ellos —`H11`, `H12`, `H15` a `H19`— ya estaban en el primer commit y salieron en rondas 2, 3 y 4 porque esta revisión barrió `select`, después `update` y recién al final `insert`.** No salieron de trabajo nuevo ni de regresiones: salieron de revisar por capas en vez de enumerar la clase completa de entrada.

Eso está escrito como `AG-37` y `AG-38` en [`lecciones.md`](../lecciones.md), y la tabla de las 53 policies por operación quedó en [`ronda-3.md`](ronda-3.md#la-enumeración-completa-para-que-no-haya-ronda-4) para que la próxima tarea que escriba RLS —`T-106`— arranque desde ahí.

Del otro lado: el agy cerró 22 hallazgos en cuatro rondas, encontró uno que la revisión no vio (`H10`), resolvió `H09` mejor de lo que yo había propuesto, corrigió mi error sobre T-006 y agregó una prueba que yo no había pedido y que hacía falta (la 50). Y desde que la regla entró a `COMO-ENTREGAR.md`, no volvió a tocar esta carpeta.

---

## Recomendación

**Mergear.** Squash, según §3.

Después, fuera de esta PR y en una sola pasada de documentación:

1. **T-106** — sumar al DoD que un repartidor no lee `notes`, `paid_until` ni `subscription_status` de `merchants` (`H13`). Las coordenadas ya están.
2. **T-101, T-102, T-103, T-105** — dejar escrito en las notas que desde T-005 el cliente **no** mueve estados, así que esas RPC son el único camino y no una comodidad. `T-102` en particular, porque su invariante de concurrencia depende de eso.
3. **`H21` y `H22`** — anotarlos donde se toque la próxima migración.
4. Lo que sigue arrastrando de antes: `PR54-H02` (el paso de caché de `~/.cache/supabase` que no guarda nada, visible otra vez en este run), la ficha de anonimización al borrar cuentas con actividad, la línea de onboarding sobre que el panel de Supabase no crea usuarios, y `PR51-H11` (`.gitattributes` / `endOfLine`).
