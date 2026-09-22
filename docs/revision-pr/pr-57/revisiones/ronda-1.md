# PR #57 · Ronda 1 — `65f174f`

| | |
|---|---|
| **SHA revisado** | `65f174f` |
| **Tarea** | T-007 (Fase 0 — Fundaciones y contratos) · Issue #8 |
| **Base** | `0c4f031` |
| **Tamaño** | 6 archivos, +485 / −4 |
| **Fecha** | 2026-09-22 |

## Veredicto

**Los dos ADR están bien argumentados y describen un esquema que no es el que está mergeado.**

La parte difícil de un ADR —decidir, comparar contra alternativas reales y dejar el porqué escrito— está bien hecha. La comparación Supabase / Firebase / backend propio no es decorativa: los criterios (transacciones, RLS, custodia de archivos, pgTAP, codegen de tipos) son los que de verdad deciden, y la conclusión se sostiene. La expiración perezosa de ADR-0002 está explicada mejor que en el propio Master Plan: el §3.2 muestra por qué la corrección no depende del cron, que es exactamente el riesgo que `S2` deja abierto.

Pero cuando el ADR baja a nombrar el esquema, **nombra otro esquema**. Trece identificadores citados como si existieran no existen en `supabase/migrations/**`, y cuatro veces se usa `status = 'open'` para un enum cuyo valor real es `'published'`.

Dos de esos errores no son cosméticos:

> **ADR-0001 §3.2 afirma que `notes` vive en `delivery_request_contacts` y no viaja al navegador antes de `matched`.** En el esquema mergeado `notes` es una columna de `delivery_requests`, y `delivery_requests_select_courier` le da a **todo repartidor aprobado** la fila completa de cualquier solicitud `published`. El ADR es el documento de referencia de D3: dice que un dato está protegido cuando no lo está.

> **ADR-0001 §4.3 etiqueta como `[DATO]` que los backups de Supabase no copian los objetos del bucket.** El Master Plan §9.4 lo deja escrito como pendiente: *«Verificar que el backup de base de Supabase no copie los objetos de Storage»*. El ADR convierte el ítem a verificar en un hecho verificado, y de eso cuelga la garantía de D8: que la purga a los 30 días sea real.

Y el único control automático que entrega la tarea, `docs/adr/verify-adr.test.mjs`, **no lo corre nadie**: ni `pnpm test` ni ningún job de `ci.yml`. Se ejecuta solo si una persona escribe el comando a mano.

| | |
|---|---|
| Abiertos | 16 (4 altos, 4 medios, 7 bajos, 1 decisión) |
| **Bloqueantes** | **7** (H01, H03, H04, H05, H06, H07, H08) |
| Alcance | 6 archivos, **0 fuera de la ficha** |
| CI | **7 de 8** · `approval-policy` en rojo |

## Checks en `65f174f`

Corridos sobre el árbol de trabajo, que ya estaba en `feat/T-007-adr-0001-0002` y en el SHA exacto del PR (`git rev-parse HEAD` = `git rev-parse origin/feat/T-007-adr-0001-0002` = `65f174f8…`). No se cambió de rama ni se tocó ningún archivo del repo: las demostraciones en rojo corrieron sobre copias en el scratchpad.

| Comando / job | Resultado | **Qué alcanza** |
|---|---|---|
| `pnpm typecheck` | exit 0 | `src/**` y `.github/workflows/**`. **No** `docs/adr/verify-adr.test.mjs` |
| `pnpm lint` | exit 0 · «No ESLint warnings or errors» | `src`, `middleware.ts`, `.mjs` de `.github/workflows`. **No** `docs/adr/**` |
| `pnpm test` | 72/72 Vitest · 19/19 workflows | **No incluye `docs/adr/verify-adr.test.mjs`** (ver H06) |
| `node --test docs/adr/verify-adr.test.mjs` | 5/5 pass | Pasa también con las tablas de revisión borradas (ver H07) |
| `pnpm test:db` | n.a. | No se tocó `supabase/` ni `src/server/` |
| `db-tests` en CI | **pass** · `Files=3, Tests=98` · `Result: PASS` | Verificado en el log, no por el color del job |
| `approval-policy` en CI | ❌ **fail** · «Falta el informe completo de revisar-pr sin bloqueantes» | Ver H08 |
| Alcance | 6 archivos, **0 fuera** | Décima ronda consecutiva sin desvío |

El límite de pulls anónimos de Docker Hub (`PR54-H02`) volvió a aparecer en `db-tests` —17 líneas de `toomanyrequests: Rate exceeded`—, pero esta vez la corrida se recuperó y pgTAP corrió de verdad: `Files=3, Tests=98, Result: PASS`. Sigue siendo intermitencia, no un falso verde.

---

## Lo que está bien

- **La comparación de alternativas decide con los criterios correctos.** ADR-0001 §2 no compara «popularidad»: compara transacciones e índices únicos parciales, auditabilidad de la autorización, custodia de archivos, pgTAP y generación de tipos. Los tres candidatos se evalúan contra los mismos cinco criterios, y el que gana lo gana por razones que el proyecto ya está usando.
- **La expiración perezosa está mejor explicada acá que en el plan.** El Master Plan §5.1 dice que la expiración es perezosa; ADR-0002 §3.2 muestra *por qué* eso desacopla la corrección del plan de hosting, y saca la consecuencia que importa: en Hobby, con un cron diario, **ningún pedido vencido puede ser ofertado ni aceptado**. Ese razonamiento es el entregable real de la tarea y está bien hecho.
- **El riesgo del plan Hobby está nombrado y acotado, no escondido.** ADR-0002 §1.2 y §5 dicen con todas las letras que el plan gratuito prohíbe el uso comercial y que hay que pasar a Pro **antes** del primer cobro. Es incómodo y está escrito igual.
- **La afirmación sobre `migrate.yml` es correcta.** ADR-0001 §4.1 dice que al mergear a `staging` el workflow ejecuta `supabase db push` y valida tipos contra la base remota: `.github/workflows/migrate.yml:5,44` lo confirma, incluida la comparación de tipos que se movió ahí en `0c4f031`. Es la única afirmación sobre un archivo existente que está bien, y conviene decirlo.
- **La custodia de `courier-docs` está descrita tal como está implementada:** bucket privado, sin policy de lectura para el repartidor, URL firmada de 60 s desde el servidor y fila en `audit_log`. Coincide con `20260922051650_rls_v1.sql:492` y con Master Plan §9.4.
- **El TDD se demostró de verdad.** La bitácora registra la fase roja 5/5 antes de escribir los ADR, con el mensaje de error concreto. Es el principio 8 aplicado a una tarea de documentación, donde es fácil saltearlo.
- **El alcance está limpio.** Los 6 archivos caen dentro de «Archivos permitidos», incluido el test, que se puso en `docs/adr/**` justamente para no salirse. La bitácora explica esa decisión. Está bien razonado — y es, a la vez, la causa de H06.

---

## 🔴 H01 · El ADR promete que `notes` está protegido; el esquema lo publica en la bolsa

**`docs/adr/ADR-0001-supabase-baas.md:16,56` · alto · bloqueante**

ADR-0001 lista `notes` dos veces como dato sensible del destinatario alojado en `delivery_request_contacts`:

```
16: Los datos sensibles del destinatario (`recipient_name`, `recipient_phone`, `dropoff_address`,
    `pickup_address`, `pickup_lat/lng`, `dropoff_lat/lng`, `notes`) jamás deben viajar al
    navegador antes del emparejamiento (`matched`)
56: La tabla `delivery_request_contacts` almacena `pickup_address`, … `recipient_phone` y `notes`.
```

En el esquema mergeado, `notes` **no está en `delivery_request_contacts`**. Está en `delivery_requests` (`20260922031435_schema_v1.sql:90`), que es la tabla del feed. Y la policy de lectura del repartidor no acota columnas:

```sql
-- 20260922051650_rls_v1.sql:270
create policy delivery_requests_select_courier on public.delivery_requests
  for select to authenticated
  using (
    app_private.is_approved_courier()
    and ( (status = 'published' and (expires_at is null or expires_at > now())) or … )
  );
```

RLS es por fila. No hay ningún `grant select (…)` por columna en la migración —`grep -n "grant" 20260922051650_rls_v1.sql` solo devuelve grants de funciones—, así que un repartidor aprobado que lee la bolsa se lleva la fila entera, `notes` incluido, antes de ofertar.

Es el mismo residual que quedó abierto en la #56 como `H13` («se acotaron las filas, no las columnas»), ahora del lado de `delivery_requests`.

**Por qué es bloqueante y no una errata:** este ADR es el documento al que va a ir alguien a preguntar «¿el repartidor ve X antes de aceptar?». Hoy responde que no para un campo donde la respuesta es que sí.

**Qué hay que hacer:** sacar `notes` de las dos listas de ADR-0001 y describirlo donde está —columna de `delivery_requests`, visible en el feed—, o, si se decide que debe estar protegido, moverlo (eso es H02, y lo decide Lautaro073). El ADR no puede quedar describiendo un estado que no es ninguno de los dos.

**Prueba en rojo** (la forma genérica está en H03; la específica):

```bash
grep -n "notes" docs/adr/ADR-0001-supabase-baas.md
# hoy: líneas 16 y 56 lo ubican en delivery_request_contacts
grep -n "notes" supabase/migrations/20260922031435_schema_v1.sql
# 90:  notes text,            <- dentro de create table public.delivery_requests
```

---

## 🔵 H02 · DECISIÓN · ¿`notes` debería estar en `delivery_request_contacts`?

**`supabase/migrations/20260922031435_schema_v1.sql:90` · decisión · para Lautaro073**

H01 es un error del documento y se arregla en el documento. Pero el ADR pensó algo que el esquema no hace, y puede tener razón: `notes` es texto libre que escribe el comercio sobre la entrega («dejar en portería», «tocar timbre del 3.º B», «llamar antes al 381…»). Es el campo donde más fácil se cuela una dirección o un teléfono, y hoy lo lee cualquier repartidor aprobado de Aguilares, haya ofertado o no.

Master Plan §6.5 enumera qué va en `delivery_request_contacts` y **no incluye `notes`**; §6.5 también enumera qué muestra el feed —barrio, barrio, distancia, tipo de paquete, medio de pago— y tampoco lo menciona. O sea que el plan no lo resolvió: el esquema lo dejó del lado público por omisión, no por decisión.

Las opciones, sin resolverlas acá:

1. **Mover `notes` a `delivery_request_contacts`.** Es coherente con D3 y con lo que el ADR ya escribió. Requiere migración nueva en T-006 o después, y cambia `database.types.ts`.
2. **Dejarlo donde está y acotar por columna** en el feed (una vista o un `grant select (…)`), que es el residual `PR56-H13` que ya está anotado para T-106.
3. **Dejarlo como está** y escribir en el ADR que `notes` es información operativa visible antes de ofertar, más una validación que impida cargar teléfonos o direcciones ahí.

No lo resuelvo. Lo que sí hay que hacer en esta PR es que el ADR diga la opción elegida, no la tercera cosa que hoy dice.

---

## 🔴 H03 · Trece identificadores de esquema que no existen

**`docs/adr/ADR-0001-supabase-baas.md:47,48,55,56,57,58,60,70,71` · `docs/adr/ADR-0002-hosting-and-cron.md:19,46,58` · alto · bloqueante**

Barrí la clase entera, que es lo que faltó en la #56: extraje **los 33 identificadores `snake_case` entre backticks** de los dos ADR y los crucé contra `supabase/migrations/**` + `seed.sql`. El comando está en `evidencia/comandos.md`. Resultado: 20 existen, 13 no. Descontando `pg_dump` (una herramienta) y `accept_offer` / `submit_offer` / `publish_request` (RPCs de T-101 a T-103, que el ADR presenta correctamente como futuras), quedan **nueve inventados**, más cuatro que el cruce por substring no atrapó:

| Citado en el ADR | Qué existe en realidad | Dónde |
|---|---|---|
| `request_events` (tabla, 3 usos) | **no existe ninguna tabla de eventos** | ADR-0001:48 · ADR-0002:52 |
| `matched_courier_id` (columna, 2 usos) | `delivery_requests.accepted_offer_id` | ADR-0001:48,60 |
| `final_amount_ars` | no existe; el monto vive en `offers.amount_ars` | ADR-0001:48 |
| `pickup_label`, `dropoff_label` | `pickup_zone_id`, `dropoff_zone_id` | ADR-0001:55 |
| `offered_amount_ars` | no existe: el monto lo pone el repartidor, no el comercio | ADR-0001:55 |
| `distance_meters` | `approx_distance_m` / `route_distance_m` | ADR-0001:55 |
| `zone_id` | `pickup_zone_id` / `dropoff_zone_id` | ADR-0001:55 |
| `merchant_user_id` | `delivery_requests.merchant_id` | ADR-0001:58 |
| `contacts_select_authorized` (policy) | **tres** policies: `contacts_select_merchant`, `contacts_select_accepted_courier`, `contacts_select_admin` | ADR-0001:57 |
| `idx_offers_one_accepted_per_request` | `offers_one_accepted_per_request_idx` | ADR-0001:47 |
| `auth_key` | `push_subscriptions.auth` | ADR-0001:70 |
| `is_admin()` | `app_private.is_admin()` | ADR-0001:59 |
| `VAPID_PUBLIC_KEY` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (`.env.example:67`) | ADR-0001:71 |

Un detalle que vale la pena marcar al revés: la policy única `contacts_select_authorized` con tres ramas que describe el ADR es **peor** que lo que hay implementado. El esquema real las parte en tres policies separadas por actor, que es exactamente lo que recomendó `AG-34` después de la #56. El ADR describe el diseño que se descartó.

**Por qué pasó los checks:** ningún control cruza prosa contra esquema. `verify-adr.test.mjs` verifica que ciertas cadenas **aparezcan**, nunca que lo que aparece sea cierto.

**Prueba en rojo** — `node --test` de esta aserción falla hoy con la lista completa (salida en `evidencia/comandos.md`):

```js
test('B. todo identificador de esquema citado por los ADR existe en supabase/migrations', () => {
  const inventados = citados.filter((id) => !MIGRATIONS.includes(id));
  assert.deepEqual(inventados, []);
});
// hoy: not ok — request_events, matched_courier_id, final_amount_ars, pickup_label,
//      dropoff_label, offered_amount_ars, distance_meters, auth_key, merchant_user_id,
//      contacts_select_authorized, idx_offers_one_accepted_per_request, default_expiry_minutes
```

---

## 🔴 H04 · `status = 'open'` cuatro veces: el enum no tiene ese valor

**`docs/adr/ADR-0001-supabase-baas.md:45,60` · `docs/adr/ADR-0002-hosting-and-cron.md:51,67,77` · medio · bloqueante**

```sql
-- 20260922031435_schema_v1.sql:9
create type public.delivery_request_status as enum
  ('draft', 'published', 'matched', 'in_transit', 'delivered', 'cancelled', 'expired');
```

No hay `'open'`. Los dos ADR lo usan cuatro veces, incluido el diagrama Mermaid de ADR-0002:67 y la consulta que ADR-0002:77 presenta como la de la bolsa. En la misma familia:

- **`canceled`** (ADR-0001:60) — el valor es `cancelled`, con dos `l`.
- **`merchants.status = 'active'`** (ADR-0001:46) — `merchants` no tiene columna `status`; tiene `subscription_status`, y sí admite `'active'`.
- **«que el repartidor de la oferta siga `active`»** (ADR-0001:46) — `courier_status` es `('pending','approved','rejected','suspended')`. El valor correcto es `approved`, y así lo dice Master Plan §6.1.

Esto no es una errata de tipeo repetida: es el punto donde el ADR se separa del plan. Master Plan §5.1 dibuja la máquina de estados con `published` y la §6.1 describe `accept_offer` verificando `status = 'published'` y repartidor `approved`. El ADR fue escrito sin cruzarlo.

**Consecuencia concreta:** T-103 y T-104 van a implementar la expiración y el barrido leyendo ADR-0002 §3.1, que dice buscar `status = 'open'`. Esa consulta devuelve cero filas y no falla: el barrido queda mudo.

**Prueba en rojo:**

```js
test('C. los ADR usan los valores reales de delivery_request_status', () => { … });
// hoy: not ok — estados que no estan en el enum
//   (draft, published, matched, in_transit, delivered, cancelled, expired):
//   ADR-0001: status = 'open' · ADR-0002: status = 'open' (x3)
```

---

## 🔴 H05 · La exclusión del bucket del backup está etiquetada `[DATO]`, y el plan la tiene como pendiente de verificar

**`docs/adr/ADR-0001-supabase-baas.md:109` · alto · bloqueante**

```
109: …los backups de PostgreSQL (tanto `pg_dump` como los backups diarios del Plan Pro y el WAL
     de PITR) respaldan **únicamente las tablas de la base de datos** …, pero **no copian ni
     retienen los archivos binarios del bucket S3 (`courier-docs`)** (**`[DATO]`**).
```

El README de esta misma PR define `[DATO]` como «valor tarifario público, cuota oficial o **límite técnico verificable en la documentación vigente del proveedor**». Y el Master Plan §9.4 deja el punto abierto, con todas las letras:

> «el bucket **no entra en ningún backup propio** (D8). **Verificar** que el backup de base de Supabase no copie los objetos de Storage (S3).»

El ADR toma el ítem a verificar y lo publica como verificado, sin una sola fuente. De esa afirmación cuelga la garantía de D8 —que la purga a los 30 días sea real e irreversible— y la frase «no queda ninguna copia fantasma del DNI ni de la selfie en backups históricos» (línea 110).

La decisión de **prohibir** `rclone` y snapshots secundarios (línea 110) está bien y es lo que el proyecto controla. Lo que no controla es qué hace Supabase por dentro, y eso es justo lo que el plan pedía verificar.

**Qué hay que hacer:** una de dos.
1. Verificarlo contra la documentación de Supabase y citar la URL y la fecha de consulta, ahí mismo. Entonces `[DATO]` está bien puesto.
2. Bajarlo a `[SUPUESTO]` mientras tanto y dejar escrito que D8 depende de una verificación pendiente, con la tarea donde se cierra (`T-310` es la candidata natural: ya es el simulacro de restauración).

**Prueba en rojo:** una aserción de que toda etiqueta `[DATO]` en una afirmación de comportamiento del proveedor lleve fuente en la misma línea falla hoy en 64 de 64 (ver H14).

---

## 🔴 H06 · El único control que entrega la tarea no lo corre nadie

**`docs/adr/verify-adr.test.mjs` · alto · bloqueante · origen: ficha**

```json
"test": "vitest run && node --test .github/workflows/verify-workflows.test.mjs"
```

`docs/adr/verify-adr.test.mjs` no aparece ahí. Tampoco en `ci.yml`: el job `unit` corre `pnpm test:coverage` y `node --test .github/workflows/verify-workflows.test.mjs`, y ningún otro job mira `docs/`. El archivo tampoco entra en `pnpm lint` (`--dir src --file middleware.ts` más los `.mjs` de `.github/workflows`) ni en `pnpm typecheck`.

O sea: **borrar los dos ADR completos deja `pnpm test` y los 8 jobs de CI en verde.** El test existe, está bien escrito y verifica el DoD, pero no es un control: es un comando que hay que acordarse de tipear.

**Esto es origen `ficha`, no del agy, y hay que decirlo.** «Archivos permitidos» de T-007 son `docs/adr/**`, `docs/tasks/T-007.md`, `docs/tasks/log/T-007.md` y `docs/revision-pr/**`. `package.json` y `.github/workflows/ci.yml` están fuera. El agy no podía cablearlo sin desviarse del alcance, y la bitácora deja registrada la decisión de ponerlo en `docs/adr/**` justamente por eso. Hizo lo correcto con la ficha que tenía.

**Qué hay que hacer — para Lautaro073, porque toca la ficha:**
1. Agregar `package.json` a «Archivos permitidos» de T-007 y encadenar `node --test docs/adr/verify-adr.test.mjs` al script `test`. Es una línea y lo deja cubierto por el job `unit` sin tocar `ci.yml`.
2. O aceptar explícitamente que es un control manual, y entonces sacarlo del DoD como evidencia: hoy el PR lo presenta como si `pnpm test` lo cubriera (ver H08).

**Prueba en rojo:**

```js
test('D. pnpm test ejecuta la suite de verificacion de los ADR', () => {
  assert.match(JSON.parse(readFileSync('package.json','utf8')).scripts.test, /docs\/adr\/verify-adr\.test\.mjs/);
});
// hoy: not ok — el script test no corre la suite de ADR:
//   vitest run && node --test .github/workflows/verify-workflows.test.mjs
```

---

## 🔴 H07 · Los tests 3 y 5 pasan con las tablas de revisión borradas

**`docs/adr/verify-adr.test.mjs:66-69,102-105` · medio · bloqueante**

El ítem del DoD que más importa —«Revisados por las 3 personas»— lo verifican estas seis líneas:

```js
// Revisión de las 3 personas (P1, P2, P3)
assert.match(content, /Lautaro073/);
assert.match(content, /persona2/);
assert.match(content, /persona3/);
```

Los tres nombres aparecen en la **línea 6** de los dos ADR, en el encabezado «Autores / Revisores». La tabla de revisión de §7 / §6 no hace falta para que el test pase.

**Demostrado**, sobre una copia en el scratchpad (el repo no se tocó):

```bash
sed -i '/^## 7\. Revisión y conformidad del equipo/,$d' ADR-0001-supabase-baas.md
sed -i '/^## 6\. Revisión y conformidad del equipo/,$d' ADR-0002-hosting-and-cron.md
grep -c "Estado de revisión" ADR-000*.md   # 0 y 0
node --test verify-adr.test.mjs            # ok 1..5 · # pass 5 · # fail 0
```

Los cinco siguen en verde con las dos tablas eliminadas. Es `P04-test-tautologico` en el punto exacto donde el DoD pedía una garantía.

**Qué hay que hacer:** afirmar la estructura, no la cadena. Que exista una fila por persona **dentro de la sección de revisión**, con un estado tomado de un vocabulario cerrado (`Aprobado` / `Revisado con observaciones` / `Pendiente`), y que el test falle si alguna queda en `Pendiente`. Así el test distingue «revisado» de «el nombre aparece en el encabezado», que es lo que hoy no distingue.

---

## 🔴 H08 · `approval-policy` está en rojo: el cuerpo del PR no sigue el formato

**`.github/workflows/approval-policy.mjs:25-34` · medio · bloqueante**

```
approval-policy   fail   9s
Falta el informe completo de revisar-pr sin bloqueantes.
```

El check parte el cuerpo por `^### Informe de revisión de agy`, corta en el siguiente `### `, y exige **seis** marcas literales en esa sección: `Informe revisar-pr — T-\d{3}`, `Resultado: SIN BLOQUEANTES`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:` y `No revisado / dudas para Lautaro073:`. El cuerpo del PR trae un informe completo y prolijo, pero con otro encabezado (`## Informe de revisar-pr — PR #57 (T-007)`) y otras subsecciones, así que el `split` no encuentra sección y falla en las seis.

Es el mismo `PR51-H08`: un resumen en prosa, por bueno que sea, no satisface un check que compara cadenas. Y conviene tener presente que `Resultado: SIN BLOQUEANTES` es una de las seis: **este job no puede ponerse verde hasta que la ronda cierre sin bloqueantes**, así que el arreglo del formato va al final, no ahora.

Es `P19-cuerpo-de-pr-fuera-de-template`, segundo caso registrado. El formato exacto está en `.agents/skills/revisar-pr/SKILL.md` paso 5.

Y hay algo que corregir en ese informe además del formato. Dice:

> `pnpm test`: ✅ (72/72 tests Vitest + 19/19 tests workflows + **5/5 tests `verify-adr.test.mjs`**)

`pnpm test` no corre `verify-adr.test.mjs` (H06). Los tres números son correctos por separado; presentarlos como salida de un solo comando le atribuye al check un alcance que no tiene. Es el mismo error de la #47: el check queda verde y se lee como si cubriera lo que no cubre.

---

## 🟡 H09 · El DoD está marcado y la conformidad de P2 y P3 está firmada sin evidencia

**`docs/tasks/T-007.md:24` · `docs/adr/ADR-0001-supabase-baas.md:165,166` · `docs/adr/ADR-0002-hosting-and-cron.md:138,139` · medio · decisión de Lautaro073**

La ficha pasó de `- [ ]` a `- [x] Revisados por las 3 personas`, y las dos tablas registran:

| `persona2` | P2 (Flujo Comercio y Ofertas) | **Revisado / En conformidad con contrato P2** | … |
| `persona3` | P3 (Flujo Repartidor, Bolsa y PWA) | **Revisado / En conformidad con contrato P3** | … |

Con detalle de qué revisó cada una. La bitácora de T-007 cubre dos sesiones (11:47 y 11:55) y no menciona haberles consultado nada; la PR se abrió a las 14:57 y no tiene comentarios ni reviews. P2 y P3 no programan: su revisión, si existe, llega por otro canal y tiene que quedar registrada en alguno.

No afirmo que no haya pasado — **no lo puedo saber, y por eso no lo marco como falso sino como no evidenciado.** Lo que sí es verificable es que el ADR lo da por hecho y el repositorio no tiene dónde comprobarlo.

Es del mismo tipo que `AG-36`: un campo que existe para distinguir dos estados deja de distinguirlos si lo llena quien tiene interés en que esté lleno. Acá el que se firma la conformidad de otras dos personas es el autor.

**Para Lautaro073:** decidir qué significa «revisado por las 3 personas» en un equipo donde dos no programan. Si es un `LGTM` en el PR, la tabla debería decir «Pendiente» hasta que llegue y el DoD no debería estar marcado. Si es otra cosa —una conversación, un checkpoint—, conviene que quede escrito dónde consta, aunque sea una línea con fecha.

---

## 🔵 H10 · Dos rutas citadas que no existen

**`docs/adr/ADR-0001-supabase-baas.md:52` · `docs/adr/ADR-0002-hosting-and-cron.md:46` · bajo**

| Citada | Real |
|---|---|
| `supabase/tests/rls_and_invariants.test.sql` | `supabase/tests/rls_matrix.sql`, `rls_enabled.sql`, `structure.sql` |
| `src/lib/env.ts` | `src/server/env.ts` (el esquema Zod con `CRON_SECRET` está en `:12`) |

La segunda importa un poco más que la primera: `src/lib/` es la zona pública (`env.public.ts`) y `src/server/` la privada. Un ADR que ubica el `CRON_SECRET` en `src/lib/` está señalando el lado equivocado de la frontera que las reglas de `boundaries` defienden.

`vercel.json` y `src/app/api/cron/sweep/route.ts` también se citan y tampoco existen, pero ahí está bien: el ADR los presenta explícitamente como lo que T-104 va a construir.

---

## 🔵 H11 · `default_expiry_minutes = 15`: ni la clave ni el valor

**`docs/adr/ADR-0002-hosting-and-cron.md:19` · bajo**

> «las solicitudes de envío en Aguilares expiran en ventanas cortas (`default_expiry_minutes = 15` minutos en `platform_settings`)»

`seed.sql:13` tiene `('request_ttl_minutes', '30'::jsonb)`. Y Master Plan S9 es explícito sobre de dónde sale ese número: *«TTL de solicitud: 30 minutos por defecto (PM). UX sugería 15. Es un parámetro.»* El ADR tomó el valor que se descartó.

El argumento de la §1.3 no se cae —con 30 minutos un cron diario sigue siendo insuficiente y la expiración perezosa sigue siendo la respuesta—, pero el dato que lo sostiene está mal y la clave no existe.

---

## 🔵 H12 · El SQL de `subscription_grace_days` no corre

**`docs/adr/ADR-0002-hosting-and-cron.md:58` · bajo**

```sql
paid_until + (platform_settings.subscription_grace_days || ' days')::interval < now()
```

`platform_settings` es una tabla clave/valor: `key text primary key, value jsonb`. No tiene columna `subscription_grace_days`; tiene una fila con esa clave. El snippet, copiado tal cual a T-104, no compila.

Lo mismo vale para `platform_settings.min_offer_ars` (ADR-0001:42), con un atenuante: esa forma de escribirlo viene del propio Master Plan §6.2, así que ahí el ADR es consistente con el plan. La diferencia es que ADR-0002:58 lo presenta como SQL ejecutable, y el plan no.

Vale la pena aprovechar y dejar escrito que el valor sembrado hoy es `0` (S6: «Gracia de suscripción de 0 días, parametrizable»), porque la §3.1.3 se lee como si hubiera un colchón real.

---

## 🔵 H13 · Las citas al Master Plan apuntan a secciones equivocadas

**`docs/adr/ADR-0001-supabase-baas.md:83,126,129` · `docs/adr/ADR-0002-hosting-and-cron.md:7,99` · bajo**

| El ADR dice | En el Master Plan |
|---|---|
| «supuestos `S1` y `S2` — §16» (ADR-0002:7) | S1 a S10 están en **§17**. §16 es la matriz requisito → tarea → prueba |
| `S3` como respaldo del **sobrecosto impositivo argentino** (ADR-0001:129, ADR-0002:99) y del **umbral de escala comercial** (ADR-0001:126) | **S3 es el límite de 2 proyectos gratuitos de Supabase**, confirmado por Lautaro073 el 2026-09-17. No dice nada de impuestos ni de umbrales, y no hay ningún supuesto impositivo en la lista |
| «límite del plan gratuito (`D1`)» para los 2 proyectos (ADR-0001:83) | Eso es **S3**; §12 lo dice así. **D1** es la decisión de usar Supabase y de documentar plan, backups y costo — es decir, la decisión que **ordena escribir este ADR** |

La del medio es la que más confunde, porque aparece tres veces y le da respaldo del plan a una cifra (+21% a +60%) que el plan no contiene. Si la carga impositiva merece ser un supuesto del proyecto, hay que darla de alta como `S11` en §17 y citarla desde acá; si no, queda como estimación propia del ADR y se dice así.

---

## 🔵 H14 · 64 etiquetas `[DATO]` y ninguna fuente

**`docs/adr/ADR-0001-supabase-baas.md` (30) · `docs/adr/ADR-0002-hosting-and-cron.md` (34) · bajo**

El README define `[DATO]` como verificable «en la documentación vigente del proveedor **a la fecha de redacción**». Entre los dos ADR hay 64 etiquetas `[DATO]` y **cero URLs**: precio de Supabase Pro, add-on PITR, cuotas del Free Tier (500 MB / 1 GB / 5 GB egress / 50.000 MAU), 10.000 cargas de Maps y $7/1.000, $20 por asiento de Vercel, 40 cron jobs por proyecto, 1 TB de Fast Data Transfer, 100 GB-h de funciones. Ninguna dice dónde se leyó ni cuándo.

El DoD pide clasificar cada costo, y eso está hecho con cuidado. Lo que falta es lo que vuelve útil la clasificación seis meses después: **un `[DATO]` sin fuente ni fecha no se puede revalidar, y los precios de estos tres proveedores se mueven.** El propio ADR-0001 lo ilustra al citar un cambio de Google Maps de marzo de 2025.

Con agregar una sección «Fuentes consultadas» con URL y fecha, y que el test exija que exista, alcanza. No hay que citar 64 veces: hay que poder volver.

---

## 🔵 H15 · Aserciones que se satisfacen con cualquier texto

**`docs/adr/verify-adr.test.mjs:54-57,78-79` · bajo**

```js
assert.match(content, /local/);       // "local" aparece en cualquier ADR
assert.match(content, /develop/);     // idem
assert.match(content, /Pro/i);        // matchea "producción", "proyecto", "protegido", "progresiva"
```

El test 4 dice verificar que ADR-0002 documenta «Hobby vs Pro»; `/Pro/i` se cumple aunque el plan Pro no se mencione nunca, porque la palabra «producción» aparece doce veces. Es `P07-coincidencia-demasiado-amplia`.

Para los ambientes, `cadeapp-staging` y `cadeapp-prod` (líneas 56-57) sí son específicos y están bien elegidos. El arreglo es usar el mismo criterio en las otras cuatro: `/Vercel Hobby/`, `/Vercel Pro/`, y para los ambientes locales algo que no aparezca por casualidad.

Y una advertencia sobre el arreglo de H03, porque es fácil caer en lo mismo: el chequeo genérico de «toda ruta citada existe» que propongo en `evidencia/comandos.md` hoy también señala `vercel.json` y `src/app/api/cron/sweep/route.ts`, que son futuros a propósito. Sin distinguir «ya existe» de «va a existir», el control nuevo nace con el defecto de H15.

---

## 🔵 H16 · La suite verifica la existencia de cadenas, no la verdad de lo que afirman

**`docs/adr/verify-adr.test.mjs` · bajo · lección, no defecto puntual**

H03, H04, H10, H11 y H12 son veintitantos errores de hecho en dos documentos que un test de 106 líneas declara conformes. No es culpa del test: está bien escrito para lo que se propuso, que es verificar **estructura** (que las secciones existan, que las etiquetas estén, que los ambientes se nombren).

Lo que muestra esta PR es que en un ADR la estructura es la parte barata. Lo caro —y lo que los lectores van a usar— son los identificadores, los estados y las cifras. Un ADR de arquitectura que nombra el esquema es, de hecho, código: se puede cruzar contra las migraciones con veinte líneas de Node, y ese cruce encuentra trece cosas que la lectura humana dejó pasar dos veces (la del agy y la primera pasada de esta revisión).

Va a `lecciones.md` como `AG-39`.

---

## No revisado / dudas para Lautaro073

- **Las cifras de los tres proveedores no las verifiqué contra sus sitios.** Esta revisión corre sin acceso a la documentación de Supabase, Vercel ni Google Maps, así que no puedo confirmar ni desmentir los $25, los $100, los $20 por asiento, las cuotas del Free Tier ni las 10.000 cargas. Lo que sí verifiqué es que ninguna trae fuente (H14) y que una afirmación técnica etiquetada `[DATO]` contradice un pendiente del plan (H05).
- **H02 (`notes`) y H06 (el test fuera de CI) son decisiones tuyas**, no las resuelvo.
- **H09 depende de un hecho que no puedo ver**: si P2 y P3 revisaron, dónde consta.
- **`pnpm build` y el presupuesto de bundle** no los corrí: el informe del PR los declara ✅ y el job `build` + `bundle-budget` están verdes en CI, lo que alcanza para un PR que no toca `src/`.
