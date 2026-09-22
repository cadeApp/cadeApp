# PR #56 · Ronda 2 — `86fd6fe`

| | |
|---|---|
| **SHA revisado** | `86fd6fe` |
| **Ronda anterior** | `3a6876b` ([`ronda-1.md`](ronda-1.md)) |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Base** | `f698539` |
| **Tamaño** | 11 archivos, +1449 / −0 |
| **Fecha** | 2026-09-22 |

## Veredicto

**Los dos bloqueantes están cerrados, y cerrados bien: con la prueba que los demuestra, no solo con el arreglo.**

`couriers_update_self` congela ahora las siete columnas que decide un admin, y lo único que le queda escribible al repartidor es `vehicle_type`, `vehicle_plate` y `available` — que es exactamente el conjunto operativo. `merchants_update_self` congela `subscription_status`, `paid_until` y `notes`. Las dos tienen aserción en las dos direcciones: el update legítimo pasa, el que escala falla con `42501`.

Y la matriz pasó de 15 a 28 aserciones. Eso resolvió por ejecución **las dos dudas que yo había dejado abiertas en la ronda 1 por no tener la base levantada**:

> **`anon` sí quedaba roto.** La prueba 3 es la primera aserción positiva de `anon` de toda la matriz, y ahora pasa contra `zones_select_public`. Antes del corte, la única policy que nombraba a `anon` llamaba a `is_admin()`, que `anon` no puede ejecutar.

> **Las subconsultas de los `with check` sobre su propia tabla no recursan.** Las pruebas 19 a 25 hacen `update` sobre `profiles`, `couriers` y `merchants` y ninguna levanta `infinite recursion detected in policy`.

Lo que queda abierto es **una sola familia, la misma de siempre, en los lugares que no se barrieron**: `with check` que repite el `using` y por lo tanto no congela ninguna columna. H06 la arregló en `offers` del lado del comercio y dejó intacto el lado del repartidor (`H11`); y `delivery_requests_update_merchant` tiene el mismo hueco sobre las columnas de ciclo de vida (`H12`), que **yo no vi en la ronda 1**.

| | |
|---|---|
| Cerrados en esta ronda | 9 (H01–H05, H07–H10) · **H06 a medias** |
| Abiertos | 5 (1 alto, 2 medios, 2 azules) |
| **Bloqueantes** | **0** |
| Alcance | 11 archivos, **0 fuera de la ficha** |
| CI | **9 de 9** · `db-tests` con **71/71** pgTAP en 3 archivos |

## Checks en `86fd6fe`

| Comando / job | Resultado |
|---|---|
| `pnpm typecheck` · `pnpm lint` | exit 0 |
| `pnpm test` | 72/72 Vitest · 18/18 workflows |
| `db-tests` en CI (run `35694333595`) | **pass** · `rls_enabled.sql ok`, `rls_matrix.sql ok`, `structure.sql ok` · `Files=3, Tests=71` · `Result: PASS` |
| `db-types` en CI | **pass**, sin diff |
| CI completo | **9 de 9** |
| Alcance | 11 archivos, **0 fuera** — décima ronda consecutiva |

**Alcance de estos checks:** `typecheck`, `lint` y `test` no tocan SQL. El único control que ejerce las policies es `db-tests`, y solo prueba lo que la matriz afirma. Los cinco hallazgos abiertos de abajo están todos en ese punto ciego: ninguna aserción los mira, así que los 71 tests siguen en verde con los cinco presentes.

---

## Lo que está muy bien

- **Cada arreglo vino con su prueba, y las pruebas son de verdad rojas antes.** Las verifiqué una por una contra la versión anterior de la policy: la 11 pasaba a ver `merchant_idle` (fixture nuevo, agregado solo para el caso negativo), la 16 insertaba en `courier-docs` sin ser repartidor, la 26 cambiaba el monto de la oferta, la 27 abría un incidente ajeno. Todas fallarían con el código de `3a6876b`. Eso es lo que separa una prueba de un adorno.
- **El fixture creció donde tenía que crecer.** `merchant_idle_id()` existe para una sola cosa: ser el comercio que el repartidor **no** tiene que ver. Sin esa fila, la prueba 11 pasaría igual con la policy vieja y no valdría nada.
- **`is_merchant_visible_to_courier` reusa `is_accepted_offer_courier` en vez de duplicar la lógica**, y copia exactamente la condición de `delivery_requests_select_courier`. Los dos criterios de visibilidad quedan escritos una sola vez.
- **H09 se resolvió con `is_courier()` y no con `is_approved_courier()`**, que es lo correcto y no es lo que yo había sugerido primero: los documentos se suben **durante** el onboarding, antes de que un admin apruebe. Exigir aprobación habría roto el flujo real. La bitácora lo justifica.
- **El agy encontró y arregló solo un defecto que yo no había visto (`H10`).** Las siete `throws_ok` estaban en la forma de tres argumentos, donde pgTAP toma el tercer argumento como **mensaje esperado**, no como descripción, y lo compara con `=`. `db-tests` quedó rojo dos corridas seguidas y lo cerró con la forma canónica de cuatro con `null::text` y casts explícitos. Está bien diagnosticado y bien arreglado, y el dato importante es el que dejó en la bitácora: las siete `caught: 42501` eran la prueba de que las policies **sí** estaban bloqueando.

---

## Hallazgos cerrados

| ID | Cómo lo verifiqué en `86fd6fe` |
|---|---|
| **H01** | Las siete columnas de decisión administrativa (`status`, `dni_hmac`, `license_status`, `insurance_status`, `decided_by`, `decided_at`, `deactivated_at`) congeladas contra su valor actual. Comparé contra la tabla de T-004: lo que queda escribible es `vehicle_type`, `vehicle_plate` y `available`, nada más. `doc_level` es generada, así que no hay camino indirecto. Pruebas 21 (positiva), 22 y 23 (negativas). |
| **H02** | `subscription_status`, `paid_until` y `notes` congeladas. Queda escribible `business_name` y los cuatro campos de retiro por defecto, que son datos del propio comercio. Pruebas 24 y 25. |
| **H03** | `merchants_select_courier` exige ahora relación: solicitud publicada no vencida, u oferta aceptada propia. Prueba 11, positiva y negativa en la misma aserción. **Queda el residual de columnas → `H13`.** |
| **H04** | Policy partida en `zones_select_public` (`using (active)`, `anon` y `authenticated`) y `zones_select_admin`. `anon` ya no toca `is_admin()`. Prueba 3, positiva. |
| **H05** | 15 → 28 aserciones, con `update` sobre `profiles`, `couriers` y `merchants` en las dos direcciones. |
| **H06** | **Parcial.** Las columnas económicas están congeladas; `status` y `decided_at` siguen libres, que es justo la mitad que era decisión. Ver abajo. |
| **H07** | Comentario de tres líneas sobre `platform_settings_select_authenticated`. Verificado leyendo. |
| **H08** | `incidents_insert_authenticated` exige comercio dueño, repartidor asignado o admin. Pruebas 27 (negativa) y 28 (positiva). |
| **H09** | `app_private.is_courier()` en la policy del bucket. Prueba 16. |
| **H10** | Encontrado y arreglado por el agy. `throws_ok(sql, '42501'::char(5), null::text, descripción)`: con `errmsg` nulo pgTAP no compara el mensaje, y los casts resuelven la sobrecarga. `Files=3, Tests=71, Result: PASS`. |

---

## Hallazgos abiertos

### 🟠 H11 · ALTO — `offers_update_courier` quedó sin `with check`: el repartidor reescribe el monto de una oferta ya aceptada

`supabase/migrations/20260922051650_rls_v1.sql:344`

```sql
create policy offers_update_courier on public.offers
  for update to authenticated
  using (courier_id = auth.uid())
  with check (courier_id = auth.uid());
```

Es **el otro lado exacto de la tabla que H06 acaba de arreglar**. El `with check` repite el `using`, así que el repartidor puede escribir cualquier columna de su propia oferta, y el `using` no filtra por estado: una oferta ya aceptada sigue siendo suya.

Dos consecuencias concretas:

1. **El precio cambia después del acuerdo.** El repartidor ofrece 1500, el comercio acepta, el repartidor pone `amount_ars = 9000`. Nada lo frena: `offers_update_merchant` congela `amount_ars` del lado del comercio y del lado del repartidor no hay nada.
2. **Se puede ocupar el cupo de aceptación.** `offers_one_accepted_per_request_idx` es `unique (request_id) where status = 'accepted'` (`20260922031435_schema_v1.sql:209`). Un repartidor cualquiera que haya ofertado pone su oferta en `accepted` y ese índice queda tomado: ninguna otra oferta de esa solicitud puede pasar a `accepted`, **ni la RPC de T-006**. El comercio no puede asignar a nadie hasta que un admin lo destrabe.

Lo que **no** pasa, y conviene dejarlo escrito porque es donde iba mi primera sospecha: el repartidor **no** se gana los datos de contacto con esto. `is_courier_assigned_to_request` exige además `dr.accepted_offer_id = o.id`, y `accepted_offer_id` vive en `delivery_requests`, donde el repartidor no escribe. El diseño de dos llaves aguanta.

**Cómo cerrarlo.** El mismo `with check` que H06, del otro lado:

```sql
with check (
  courier_id = auth.uid()
  and request_id = (select o.request_id from public.offers o where o.id = offers.id)
  and status = (select o.status from public.offers o where o.id = offers.id)
  and (select o.status from public.offers o where o.id = offers.id) = 'pending'
)
```

La última línea es la que importa: una oferta deja de ser editable en cuanto sale de `pending`. Si se quiere permitir que el repartidor la retire, se agrega la transición explícita a `withdrawn` y nada más.

**Prueba que hoy pasaría y después tiene que fallar** (`rls_matrix.sql`), con el fixture que ya existe — `offer_c1` es la de `courier_approved_1` y está en `accepted`:

```sql
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select throws_ok(
  'update public.offers set amount_ars = 9000 where id = pg_temp.offer_c1_id()',
  '42501'::char(5), null::text,
  'courier cannot change the amount of an already accepted offer'
);
```

---

### 🟡 H12 · MEDIO — `delivery_requests_update_merchant` no congela el ciclo de vida (y esto se me pasó en la ronda 1)

`supabase/migrations/20260922051650_rls_v1.sql:287`

```sql
create policy delivery_requests_update_merchant on public.delivery_requests
  for update to authenticated
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());
```

Mismo patrón que H01, H02 y H06, sobre la tabla central. El comercio puede escribir `status`, `accepted_offer_id`, `published_at`, `matched_at`, `delivered_at`, `cancelled_at` y `created_at` de sus propias solicitudes.

Lo anoto con el nombre que corresponde: **es un hallazgo de la ronda 1 que no hice.** Revisé las tres tablas de actor y `offers`, y no volví sobre `delivery_requests`, que es donde vive el estado que todo lo demás lee.

Qué habilita hoy:

- **Marcar `delivered` sin que el repartidor entregue nada**, y fechar `delivered_at` a mano. En T-007 eso es la base de una liquidación.
- **Reescribir `created_at` y `published_at`**, que son lo que mide el TTL (`request_ttl_minutes` en `platform_settings`) y lo que ordena el índice `delivery_requests_published_idx`.
- Junto con el `status` libre de `offers` (ver H06 abajo), el comercio completa la aceptación entera desde el cliente: `offers.status = 'accepted'` + `accepted_offer_id`. La RPC de T-006 queda como un camino más, no como *el* camino.

**Cómo cerrarlo.** Decidir qué transiciones le corresponden al comercio —razonablemente `draft → published` y `* → cancelled`— y congelar el resto, con `accepted_offer_id` y los cinco *timestamps* comparados contra su valor actual. Si se prefiere dejarlo para la RPC de T-006, entonces la policy tiene que restringirse a las columnas de contenido (`notes`, zonas, `package_type`, `recipient_payment_method`, `needs_change`, `cash_change_amount`) y anotarse en el DoD de T-006.

**Prueba que hoy pasaría:**

```sql
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  'update public.delivery_requests set status = ''delivered'', delivered_at = now() where id = pg_temp.req_m1_pub_id()',
  '42501'::char(5), null::text,
  'merchant cannot mark its own request as delivered'
);
```

---

### 🟡 H13 · MEDIO — Residual de H03: se acotaron las filas, no las columnas

`supabase/migrations/20260922051650_rls_v1.sql:193`

El arreglo de H03 es correcto y cierra lo peor: un repartidor ya no lee el padrón entero de comercios. Pero un repartidor aprobado que ve una solicitud publicada lee **la fila completa** de ese comercio, y ahí van `subscription_status`, `paid_until`, `notes`, `default_pickup_address`, `default_pickup_lat` y `default_pickup_lng`.

`notes` es el que más molesta: es campo administrativo, no tiene consumidor en el cliente, y queda visible para cualquiera que esté mirando el tablero. `paid_until` y `subscription_status` son información comercial de un tercero.

Esto ya estaba anotado en el residual de H03 de la ronda 1 —*«si además hace falta que solo vea el nombre comercial, RLS no alcanza»*— y sigue siendo cierto: **RLS filtra filas, no columnas.** `grant select (col, …)` tampoco sirve acá, porque el privilegio es por rol y rompería `merchants_select_self`.

**Cómo cerrarlo.** Una vista —`public.merchant_public` con `business_name` y lo mínimo del punto de retiro— y quitar `merchants_select_courier`. Es la forma correcta y es trabajo de T-006, que es quien va a definir qué necesita el tablero del repartidor. **No hace falta en esta PR**, pero sí que quede escrito en el DoD de T-006 antes de cerrar T-005, porque si no se pierde.

---

### 🔵 H06 (resto) · DECISIÓN — `offers.status` sigue libre para el comercio

`supabase/migrations/20260922051650_rls_v1.sql:350`

El `with check` nuevo congela `courier_id`, `request_id`, `amount_ars`, `eta_minutes` y `message`. No congela `status` ni `decided_at`, así que el comercio sigue pudiendo poner una oferta en `accepted` a mano y saltear la RPC de T-006.

Era el hallazgo marcado 🔵 DECISIÓN de la ronda 1, y se resolvió por la mitad conservadora: la parte técnica sin discusión (las columnas económicas) está hecha, y la que necesitaba una decisión de producto —*quién puede mover `status`*— quedó como estaba. **Está bien que haya quedado así**; lo que falta es la decisión, no el código.

Las dos opciones siguen siendo las de la ronda 1:

- **(a)** Congelar `status` también, y que la aceptación exista únicamente como RPC `security definer` en T-006. Más limpio, y hace que el índice único parcial sea una red y no la única defensa.
- **(b)** Dejar que el comercio escriba `status`, permitiendo solo `pending → accepted` y `pending → rejected` comparadas contra el valor actual.

Con H11 cerrado, **(a) es la que recomiendo**: si ninguno de los dos lados puede tocar `status`, la única forma de aceptar una oferta pasa a ser la RPC, y ahí se puede poner la transacción, el audit y la notificación en un solo lugar.

---

### 🔵 H14 · BAJO — `zones_select_admin` no agrega nada

`supabase/migrations/20260922051650_rls_v1.sql:175`

`zones_write_admin` es `for all to authenticated using (app_private.is_admin())`, y `for all` incluye `select`. El admin ya leía todas las zonas por esa policy. `zones_select_admin` es una tercera policy permisiva que se evalúa por fila y no cambia ningún resultado.

No rompe nada y documenta la intención, así que puede quedarse. Si se queda, que sea con un comentario que diga que es explícita a propósito; si no, se borra. Lo anoto para que no se copie el patrón a las otras trece tablas, donde `*_write_admin` hace lo mismo.

---

## Nota de proceso

### A02 · La carpeta de revisión se volvió a escribir desde el lado del autor

Esta rama llegó con `docs/revision-pr/pr-56/hallazgos.jsonl` **modificado y sin commitear**: los nueve hallazgos marcados `arreglado-verificado` con `verificado_en_sha: 45ca9bb`, más un registro nuevo `PR56-H10` con patrón `P19` y lección `AG-35`. Y la bitácora cita un archivo que no existe en el árbol:

> *«Se atiende el hallazgo bloqueante H10 de la Ronda 2 (`docs/revision-pr/pr-56/revisiones/ronda-2.md`)»* — `docs/tasks/log/T-005.md`, entrada de las 03:15.

Es la tercera vez (#54, #56 ronda 1, #56 ronda 2) y esta fue **un commit después** de que `COMO-ENTREGAR.md` incorporara la regla. Guardé esa versión aparte y restauré la commiteada.

Tres cosas, en orden de importancia:

1. **El contenido era bueno.** `H10` es un hallazgo real, bien diagnosticado y bien arreglado, y salió de leer el propio CI en rojo. Nada de esto es sobre la calidad del trabajo.
2. **El `verificado_en_sha` estaba viejo en el momento de escribirse.** Decía `45ca9bb`, y sobre `45ca9bb` el `db-tests` estaba **rojo**; los arreglos recién quedaron verdes en `cdb7489`. Es exactamente lo que el campo existe para evitar, y es la razón por la que no lo firma quien arregla: cuando uno viene de arreglar, el estado que tiene en la cabeza es el de su última edición, no el del árbol.
3. **El canal correcto ya está funcionando.** Las dos entradas de bitácora de esta ronda son buenas: dicen qué se hizo, por qué, con qué evidencia de CI y con el número de run. Eso es todo lo que hace falta. `H10` habría llegado igual de completo por ahí.

### Lo que arrastra de antes

- **`PR54-H02` sigue abierto y se ve en este mismo run.** El `db-tests` de `35694333595` termina con `Path Validation Error: Path(s) specified in the action for caching do(es) not exist, hence no cache is being saved`. El paso de caché de `~/.cache/supabase` no guarda nada, corrida tras corrida. Esta vez el pull de Docker Hub salió sin `toomanyrequests`, pero eso es suerte, no arreglo.
- **Pendientes de documentación de T-004/T-005** (mover la nota de bootstrap de admin de `T-004.md` a `T-005.md`; sumar «un `update` por rol» al DoD de T-005 — `PR54-H07`, que esta ronda cumplió de hecho pero sigue sin estar escrito). Siguen esperando el visto bueno para la PR de tres líneas.

### A03 · El catálogo de patrones estaba desfasado, y la culpa es de esta revisión

Revisando los datos de esta ronda encontré que `docs/revision-pr/README.md` —que dice literalmente *«mantener esta lista estable entre PRs: si cambian los nombres, el análisis pierde sentido»*— llegaba hasta `P15`, y en los `hallazgos.jsonl` ya circulaban tres nombres sin registrar:

- `P16-cascada-declarada-que-no-cascadea`, de la #54.
- `P17-with-check-no-congela-columnas-de-privilegio` y `P18-policy-sin-condicion-de-relacion`, que **inventé yo en la ronda 1 de esta PR** sin agregarlos al catálogo.

Y algo peor: **el número 12 estaba usado por dos patrones distintos.** `P12-plantilla-propaga-antipatron` es el del catálogo; `P12-cuerpo-de-pr-fuera-de-template` lo introdujo `PR51-H10`. `analizar.mjs` agrupa por la cadena literal, así que eran dos cubetas que decían ser la misma.

Lo arreglé en esta rama, porque `docs/revision-pr/**` está en los «Archivos permitidos» de T-005:

- Registrados `P16`, `P17`, `P18` con su descripción.
- `P12-cuerpo-de-pr-fuera-de-template` renumerado a **`P19`**, con `sed` sobre `pr-51/hallazgos.jsonl` — un solo registro, `PR51-H10`, con su `id` intacto. **Es el único cambio que toca datos de una PR ya mergeada**; si preferís que la historia no se toque, se revierte con un `sed` inverso y queda la colisión anotada.
- `PR56-H07` estaba etiquetado con ese mismo `P12` y era un error mío de la ronda 1: el hallazgo es un comentario de justificación que falta en el SQL, no tiene nada que ver con el cuerpo del PR. Reetiquetado a **`P20-justificacion-de-seguridad-no-escrita`**.
- `P21-asercion-que-compara-el-mensaje-de-error` registrado para `H10`.

Después del barrido, `node docs/revision-pr/analizar.mjs` da **80 hallazgos en 6 PRs**, veintiún patrones, uno por número, ninguno sin registrar. `P17` queda quinto con 5 casos —`H01`, `H02`, `H06`, `H11`, `H12`, los cinco de esta PR— y es el patrón dominante de T-005.

---

## Para cerrar

Ninguno bloquea el merge. En orden:

1. **H11** — el `with check` de `offers_update_courier`, con la prueba en rojo primero. Es el último de la familia y son cinco líneas simétricas a las de H06.
2. **H12** — congelar el ciclo de vida de `delivery_requests`, o acotar la policy a las columnas de contenido. Necesita la misma decisión que H06: qué queda para la RPC de T-006.
3. **H06 (resto)** — 🔵 **decisión de Lautaro073**, no la resuelva el agy. Con H11 y H12 encima, las tres son la misma pregunta: *¿quién mueve el estado, el cliente o la RPC?* Conviene contestarla una vez y aplicarla a las tres.
4. **H14** — comentario o borrado, treinta segundos.
5. **H13** — **no en esta PR.** Va al DoD de T-006 antes de cerrar T-005, junto con los dos pendientes de documentación.

Si se decide que H12 y H06 son de T-006, entonces lo único que queda acá es H11 y H14, y la PR cierra en una ronda más.
