# PR #62 · T-101 — Ronda 1

- **PR:** [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop`
- **Tarea:** `T-101` — `submit_offer`, `withdraw_offer`, `set_availability` y `rate_limits` atómico · Issue #11
- **SHA revisado:** `ee247ac` · base `origin/develop` = `ddef51a`
- **Fecha:** 2026-09-23
- **Revisión:** independiente (no es el agy que implementó)
- **Resultado: CON BLOQUEANTES (2)** · 7 mejoras · 4 decisiones resueltas antes de escribir

> **Alcance de esta revisión:** a pedido de Lautaro073, **no corrí las suites ni miré CI**. Todo lo que sigue es
> lectura, barrido mecánico y razonamiento sobre el código. Los resultados de `pnpm test`, `test:db` y los ocho
> jobs quedan fuera: cuando necesite ese dato lo pregunto.

---

## 0. Lo que está bien, comprobado

- **El cruce mecánico entre la migración y `rpc-contracts.ts` da exacto en dos de las tres RPC.** Extraje los
  `message = 'CODE'` de cada función y los comparé contra `RPC_CONTRACTS[rpc].errorCodes`:
  `submit_offer` levanta 12 y declara los mismos 12; `set_availability`, 6 y 6. Es la primera vez en estas PRs
  que ese cruce sale limpio de entrada.
- **`rate_limits` tiene `primary key (subject, action, window_start)`**, así que el
  `on conflict (subject, action, window_start) do update ... returning count` **sí es atómico**. No es una
  afirmación del cuerpo del PR que haya que creer: es una PK que está en `20260922031435_schema_v1.sql:205`.
- **`offers.courier_id` referencia `couriers (profile_id)`**, así que comparar `courier_id = auth.uid()` es
  correcto. Lo fui a verificar porque a primera vista parecía confundir el id del repartidor con el del perfil.
- **El wrapper mapea `23505` a `DUPLICATE_ACTIVE_OFFER`** (`offers.ts:63-68`). La migración no captura la
  violación del índice parcial `offers_one_active_per_courier_request_idx`; el wrapper sí. Nadie lo pidió y
  cierra el caso en que la carrera se escape del `for update`.
- **El test 3 recorre el contrato, no una lista escrita a mano.** Su título dice «mapea todos los códigos de
  `RPC_CONTRACTS`» y efectivamente hace `for (const code of RPC_CONTRACTS.<rpc>.errorCodes)` para las tres.
  El título es honesto.
- **Los privilegios son más estrictos que lo que dice la bitácora**: la migración hace
  `revoke all ... from public, anon, authenticated` y después `grant execute ... to authenticated`. La bitácora
  solo menciona `from PUBLIC, anon`.
- **`plan(32)` y 32 aserciones**, numeradas `1..32` sin huecos. Lo conté con un barrido y coincide.
- **El piso dinámico está cubierto tal cual lo pide el DoD**: 999/1000/1001 con `min_offer_ars = 1000`, y
  después 999/1000/1001/1499/1500 con el piso cambiado a 1500. Ocho aserciones, todas leyendo el valor de
  `platform_settings`. Ese ítem está bien cerrado.
- Cero `any`, `@ts-ignore`, `!` non-null, `.only`, `.skip`. Ningún `"use client"` en `src/server/`. Ninguna
  policy `using (true)`. Las tres funciones son `security definer` **con** `set search_path = public, pg_temp`.

---

## 1. Alcance

7 archivos, todos dentro de «Archivos permitidos» tras la ampliación de la ficha:

| Archivo | Permitido por |
|---|---|
| `supabase/migrations/20260923050000_rpc_offers_v1.sql` | `supabase/migrations/**` |
| `supabase/tests/rpc_offers.sql` | línea explícita |
| `src/server/rpc/offers.ts` | línea explícita |
| `src/server/rpc/offers.test.ts` | **agregado en este PR** — «autorizado por Lautaro073» |
| `src/types/database.types.ts` | **agregado en este PR** — «autorizado por Lautaro073» |
| `docs/tasks/T-101.md`, `docs/tasks/log/T-101.md` | líneas explícitas |

**0 archivos fuera.** El cambio en `database.types.ts` es solo el bloque `Functions` con las tres RPC, que es lo
que `pnpm db:types` genera y lo que `AGENTS.md` §4 exige después de tocar `supabase/migrations`.

---

## 2. Las cuatro decisiones, resueltas antes de escribir

| id | Qué | Decisión |
|---|---|---|
| `D01` | El contador de `rate_limits` se incrementa en la misma transacción, así que **un intento fallido revierte su propio incremento**: el límite solo cuenta ofertas exitosas | **Aceptar y documentar.** Escribir en la migración por qué, y que el DoD y el mensaje del test digan «limita ofertas exitosas» |
| `D02` | El tope es un literal `10` escrito dos veces; el cuerpo y la bitácora dicen que sale de `platform_settings.max_offers_per_min`, que no existe | **Hacerlo configurable**: agregar `max_offers_per_min` a `platform_settings` y a `seed.sql`, y leerlo igual que `min_offer_ars` |
| `D03` | `withdraw_offer` declara `INVALID_STATE_TRANSITION` y nunca lo levanta; ninguna de las tres declara `INTERNAL_ERROR` | **`contract-change` para las dos**: sacar el código inalcanzable y agregar `INTERNAL_ERROR` a las tres |
| `D04` | El DoD pide «rate limit con llamadas concurrentes» y pgTAP corre en una sola sesión | **Reformular el ítem** como «tope de ventana verificado y upsert atómico sobre la PK», y que el test 32 afirme el valor exacto del contador |

---

## 3. Bloqueantes

### `H01` · `max_offers_per_min` no existe: el tope está hardcodeado en `10` y dos documentos afirman lo contrario

El tope aparece dos veces como literal, en `submit_offer` y en `withdraw_offer`:

```sql
if v_rate_count > 10 then
  raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
end if;
```

Y en dos lugares se afirma que sale de configuración:

- Cuerpo del PR: *«incremento atómico en `public.rate_limits` … contra `platform_settings.max_offers_per_min`»*
- Bitácora, §4: *«Lectura dinámica de `min_offer_ars` **y `max_offers_per_min`** desde `public.platform_settings`»*

Barrido: la única clave que la migración lee es `min_offer_ars`. Y `max_offers_per_min` **tampoco está sembrada**
— `seed.sql` tiene `min_offer_ars`, `request_ttl_minutes`, `pilot_active`, `pilot_terms_version` y
`subscription_grace_days`. O sea que no es que el código lea la clave equivocada: la clave no existe en ningún
lado del repositorio.

Por qué lo pongo bloqueante y no como corrección de prosa: la bitácora es lo que lee quien retome, y dice que el
tope es ajustable sin migración. No lo es. Con `D02` resuelto, además, hay trabajo de código.

- **Qué hacer (`D02`):** sumar `supabase/seed.sql` a «Archivos permitidos», sembrar `max_offers_per_min`, leerlo
  con el mismo patrón que `min_offer_ars` —`(value #>> '{}')::integer`, con su rechazo si es nulo o inválido— y
  corregir el cuerpo y la bitácora.
- `P15-entregable-declarado-pero-no-ejecutable` · `P03-comentario-contradice-codigo`

---

### `H02` · Cualquier fallo de infraestructura se le reporta al usuario como `VALIDATION_ERROR`

`mapOfferRpcError` termina en (`offers.ts:77`):

```ts
return 'VALIDATION_ERROR' as RpcErrorCode<K>;
```

Ese es el destino de **todo** lo que no matchee: un `57014` por `statement_timeout`, un `40P01` por deadlock, una
caída de conexión, un `53300` por `too_many_connections`. Al repartidor se le muestra el mensaje de
`VALIDATION_ERROR`, que en `error-messages.ts` es *«Revisá los datos ingresados e intentá nuevamente»* — y no hay
nada que revisar, porque el problema fue de la base.

La causa no es el wrapper sino el contrato: **ninguna de las tres RPC declara `INTERNAL_ERROR`** en
`rpc-contracts.ts`, así que el wrapper no puede devolverlo sin romper el tipo. El `as RpcErrorCode<K>` de la
línea 77 es la señal: es el único cast del archivo y está justo ahí.

El catálogo tiene `INTERNAL_ERROR` y `CONFLICT` para esto. Y `deadlock` no es hipotético acá: `submit_offer` toma
`for share` sobre `couriers` y después `for update` sobre `delivery_requests`, mientras `set_availability` toma
`for update` sobre `couriers`.

De paso, en el otro sentido: **`withdraw_offer` declara `INVALID_STATE_TRANSITION` y la RPC nunca lo levanta.**
El caso de estado ya lo cubre `OFFER_NOT_PENDING`. Es el mismo patrón que `PR58-H15` — un código que el catálogo
promete y nadie puede alcanzar.

- **Qué hacer (`D03`):** `contract-change` sobre `src/domain/rpc-contracts.ts` — sacar `INVALID_STATE_TRANSITION`
  de `withdraw_offer`, agregar `INTERNAL_ERROR` a las tres, y que el fallback del wrapper devuelva
  `INTERNAL_ERROR` en vez de `VALIDATION_ERROR`.
- `P11-api-publica-inconsistente` · `P05-semantica-invertida-vs-dod`

---

## 4. Mejoras

### `H03` · El rate limit no cuenta los intentos fallidos: solo frena el tráfico válido

En `submit_offer` el incremento ocurre en la línea 97, y después siguen corriendo la lectura del piso, la
comparación de monto y el chequeo de oferta duplicada. Cuando cualquiera de esos levanta la excepción, **la
transacción entera se revierte, incluido el incremento**. `plpgsql` no tiene bloque `exception` acá, así que el
`raise` propaga y aborta.

El efecto práctico:

| Tráfico | ¿Consume cuota? |
|---|---|
| 10 ofertas válidas en el mismo minuto | sí — la 11.ª recibe `RATE_LIMITED` |
| 10.000 ofertas con monto bajo el piso | **no** — cada una incrementa y revierte |
| 10.000 ofertas a una solicitud vencida | **no** |
| 10.000 ofertas de un repartidor no disponible | **no** |

O sea que el limitador frena exactamente el tráfico que no hace falta frenar, y es ciego al que sí. Es la razón
por la que el test 31 **tiene que sembrar el contador en 10 a mano** en vez de llamar a la RPC once veces: un
bucle de llamadas fallidas nunca llegaría al tope.

**Decidido (`D01`): se acepta.** Contar los fallidos exige transacción autónoma (`dblink`, `pg_background`) o
mover el freno al borde, y ninguna de las dos entra en T-101. Lo que hay que hacer es que deje de estar
implícito:

- Un comentario en la migración, arriba del `insert into public.rate_limits`, diciendo que el contador solo
  sobrevive a las llamadas exitosas y por qué.
- El mensaje del test 31 y el ítem del DoD, reformulados: «limita ofertas exitosas por ventana», no «rate limit».
- Y que quede anotado como residual para la tarea que ponga el freno de abuso donde corresponda.

### `H04` · El ítem «llamadas concurrentes» del DoD no está cubierto, y el test que dice medir atomicidad no puede medirla

El DoD pide *«rate limit con **llamadas concurrentes**»*. La suite pgTAP abre `begin;`, corre las 32 aserciones y
hace `rollback;` — una sola sesión, una sola transacción. No hay concurrencia posible ahí.

Lo que hay son dos aserciones:

- **Test 31** siembra `count = 10` y comprueba que la siguiente llamada da `RATE_LIMITED`. Verifica el umbral, que
  está bien, pero no la concurrencia.
- **Test 32** es `ok((select count >= 1 from public.rate_limits where subject = … and action = 'submit_offer'))`
  con el mensaje *«submit_offer incrementa atómicamente la fila correspondiente»*. `count >= 1` es el valor por
  defecto de una fila recién creada: la aserción no distingue un incremento de una inserción, y la atomicidad no
  la observa de ninguna forma.

  Detalle menor de la misma línea: la subconsulta escalar no tiene `limit` ni agregado. Hoy devuelve una sola
  fila porque `date_trunc('minute', now())` es constante dentro de la transacción; si alguna vez se ejecutara
  con dos ventanas, sería `21000 more than one row returned by a subquery` en vez de un fallo legible.

**Decidido (`D04`):** la atomicidad la garantiza el `on conflict` sobre la PK de `rate_limits`, que es correcto y
no necesita dos sesiones para demostrarse. Se reformula el ítem del DoD y **el test 32 pasa a afirmar el valor
exacto** del contador —`is((select count ...), 3, ...)` tras tres ofertas exitosas— en vez de `>= 1`.

### `H05` · El «Contrato SQL» del test 4 se cumple con una sola coincidencia en un archivo de 296 líneas

`offers.test.ts:427` se llama *«Contrato SQL: la migración de T-101 define SECURITY DEFINER, search_path fijo,
FOR UPDATE, rate_limits atómico y solo códigos de RPC_CONTRACTS»* y lo verifica así:

```ts
expect(sql).toMatch(/security definer/i);
expect(sql).toMatch(/set search_path = public, pg_temp/i);
expect(sql).toMatch(/for update/i);
```

Son tres funciones en el archivo. **Una sola ocurrencia satisface cada `toMatch`**, así que se puede quitar
`security definer` de dos de las tres y el test sigue verde. Contado: hoy hay 3 `security definer`, 3
`set search_path`, 3 `for update` y 1 `for share` — y el test no puede distinguir ninguno de esos números de 1.

La ficha es explícita sobre por qué esto importa: *«estas RPC no son una comodidad, son el único camino, y
**tienen que ser `security definer`**»*. El `/for update/i` tampoco distingue el `for share` que `submit_offer`
usa sobre `couriers`.

Y el chequeo de códigos tiene dos huecos de forma:

```ts
const allowedCodes = new Set<string>([
  ...RPC_CONTRACTS.submit_offer.errorCodes,
  ...RPC_CONTRACTS.withdraw_offer.errorCodes,
  ...RPC_CONTRACTS.set_availability.errorCodes,
]);
```

- **Se juntan las tres listas en un solo conjunto**, así que si `set_availability` levantara
  `OFFER_BELOW_MINIMUM` el test pasaría igual: el código está en el pool. La correspondencia es por RPC, no
  global.
- **Solo comprueba «levantado ⊆ declarado», nunca al revés.** Por eso `INVALID_STATE_TRANSITION` declarado y
  nunca levantado en `withdraw_offer` (ver `H02`) es estructuralmente invisible para este test. Lo encontré con
  un barrido que compara los dos sentidos por función.
- `expect(raisedCodes.length).toBeGreaterThanOrEqual(10)` es un piso, no un conteo.

- **Qué hacer:** contar ocurrencias por función en vez de buscar la cadena en todo el archivo —partir el SQL por
  `create or replace function` y exigir las tres propiedades en cada bloque— y hacer la comparación de códigos
  por RPC y en los dos sentidos. Es el mismo barrido que corrí para esta revisión, y queda en
  [`evidencia/comandos.md`](../evidencia/comandos.md).
- `P02-parseo-de-texto-en-vez-de-ast` · `P08-control-no-cubre-lo-que-dice`

### `H06` · El cuerpo del PR y la bitácora describen un sistema distinto del que está en el diff

Cuatro afirmaciones que el código contradice, además de `max_offers_per_min` (`H01`):

| Dice | El código hace |
|---|---|
| «validación de `eta_minutes` (`1..180`)» | `p_eta_minutes > 240` (`migración:63`). El schema Zod también dice `.max(240)`, así que el código es coherente consigo mismo; el que está mal es el texto |
| «bloqueo pesimista `FOR UPDATE`» sobre `public.couriers` | `for share` (`migración:41`). En `set_availability` sí es `for update` |
| «distinto de `published` → `REQUEST_NOT_PUBLISHED`» | levanta `INVALID_STATE_TRANSITION` (`migración:94`). **`REQUEST_NOT_PUBLISHED` no existe en `DOMAIN_ERROR_CODES`**: el texto inventa un código, el código usa el correcto |
| bitácora: «`createRpcFake`» | el export es `createFakeRpcClient` |

Ninguna es un defecto de implementación — en los cuatro casos el código está bien y el texto está mal. Lo anoto
junto porque el patrón importa: dos documentos que describen la misma cosa de una forma que no se puede verificar
leyendo el diff.

- `P03-comentario-contradice-codigo`

### `H07` · La bitácora registra una ampliación y un cambio que no están en este PR

La bitácora, §3, dice que Lautaro073 autorizó sumar a «Archivos permitidos» tres rutas, y la tercera es:

> `public/brand/logo.svg` (restauración de `role="img" aria-label="cadeApp"` tras el commit `fix(svg)` de
> `164d368` en `develop`, manteniendo el peso en `4.541 B < 5 KB`)

Pero `public/brand/logo.svg` **no está en el diff** (son 7 archivos, ninguno en `public/`) y **no está en
«Archivos permitidos»** de la ficha: el diff de `T-101.md` solo agrega `offers.test.ts` y `database.types.ts`.

No es un desvío de alcance —el archivo no se tocó— pero la bitácora registra como hecho algo que no pasó acá, con
una autorización que la ficha no refleja. Quien retome va a buscar ese cambio y no está.

- **Qué hacer:** sacar ese punto de la bitácora, o moverlo a la tarea donde efectivamente ocurra.
- `P03-comentario-contradice-codigo`

### `H08` · Nada comprueba los privilegios ni que las funciones sigan siendo `security definer`

La suite tiene tres `has_function`, que verifican existencia y firma. No hay:

- **`is_definer()`** para ninguna de las tres. Que sean `security definer` es la propiedad de la que depende todo
  el diseño según la ficha, y hoy solo está cubierta de rebote: si una dejara de serlo, la RLS bloquearía la
  escritura y algún `lives_ok` fallaría. Funciona, pero por accidente y con un mensaje que no dice por qué.
- **`function_privs_are()`** ni ningún caso que actúe como `anon`. El arnés `pg_temp.act_as` **soporta `anon`**
  (líneas 39-41) y no se usa para estas tres RPC, así que el `revoke all ... from anon` no lo ejercita nada.

El impacto del segundo es acotado —un `anon` tiene `auth.uid()` nulo y recibiría `UNAUTHENTICATED` igual— pero es
el control directo de una línea de la migración que existe justamente para eso.

- **Qué hacer:** tres `is_definer('public', <fn>, …)` y un caso `anon` por RPC. Seis aserciones baratas sobre un
  plan que ya tiene 32.

### `H09` · El incremento se hace después de tomar `for update` sobre la solicitud

Orden actual en `submit_offer`: `for share` sobre `couriers` → validación de parámetros → **`for update` sobre
`delivery_requests`** → upsert en `rate_limits` → lectura del piso → chequeo de duplicada → `insert`.

El `for update` sobre `delivery_requests` se toma en la línea 81 y se suelta recién al terminar la transacción,
así que todas las ofertas a una misma solicitud se serializan durante el resto del cuerpo —incluido el upsert de
`rate_limits`, la lectura de `platform_settings` y el insert—. En una solicitud con muchas ofertas simultáneas
eso es el punto de contención.

Es correcto (y es lo que cierra la carrera de oferta duplicada, ver §0), pero conviene tenerlo escrito: el lock
sobre la fila caliente dura más de lo necesario. Mover el upsert de `rate_limits` y la lectura del piso antes del
`for update` acorta la sección crítica sin cambiar la semántica.

---

## 5. Checks

**No corrí nada de esto**, por indicación de Lautaro073. Queda pendiente de su confirmación:

| Check | Estado |
|---|---|
| `pnpm typecheck` · `lint` · `test` · `test:coverage` | **no ejecutado en esta revisión** |
| `pnpm test:db` (pgTAP) | **no ejecutado** — este entorno no tiene Docker |
| CI (8 jobs) | **no consultado** |

Lo que sí verifiqué, todo estático:

| | Resultado |
|---|---|
| Alcance | ✅ 7 archivos, **0 fuera** de la ficha ampliada |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `"use client"` en `src/server/` | ✅ ninguno |
| `security definer` + `search_path` | ✅ las tres, `public, pg_temp` |
| Privilegios | ✅ `revoke all from public, anon, authenticated` + `grant execute to authenticated` |
| Policies `using (true)` | ✅ ninguna |
| Códigos SQL ⊆ catálogo `DomainErrorCode` | ✅ los 14 distintos están en el catálogo |
| Códigos por RPC vs contrato | ✅ `submit_offer` 12/12 · ✅ `set_availability` 6/6 · ❌ `withdraw_offer` declara 1 de más |
| `plan(32)` vs aserciones | ✅ 32 y 32, numeradas 1..32 sin huecos |
| Claves de `platform_settings` usadas vs sembradas | ✅ `min_offer_ars` · ❌ `max_offers_per_min` no existe |

## 6. Veredicto

**CON BLOQUEANTES (2).** No apruebo ni mergeo.

La implementación SQL es la mejor que vi en estas PRs: las tres funciones son `security definer` con
`search_path` fijo, los privilegios están revocados y regrantados explícitamente, el upsert de `rate_limits` es
genuinamente atómico sobre la PK, el piso sale de `platform_settings` como manda `AGENTS.md` §2, y el cruce
mecánico contra `rpc-contracts.ts` da exacto en dos de las tres RPC. La suite pgTAP cubre el ítem del piso
exactamente como lo pide el DoD.

Los dos bloqueantes no son de diseño: uno es una clave de configuración que dos documentos dan por existente y no
existe (`H01`), y el otro es un contrato que no deja al wrapper distinguir «te equivocaste vos» de «se cayó la
base» (`H02`). Los dos tienen decisión tomada.

Lo que más me importa de las mejoras es `H05`: el test que se llama «Contrato SQL» se satisface con una
coincidencia de texto en un archivo de tres funciones, y es el que debería haber encontrado el código
sobredeclarado de `withdraw_offer`.
