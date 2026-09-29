# PR #64 · T-102 — Ronda 1

- **PR:** [#64](https://github.com/cadeApp/cadeApp/pull/64) · `feat/T-102-rpc-accept-offer` → `develop`
- **Tarea:** `T-102` · Issue #12 · ficha leída desde `origin/develop`, no desde la rama
- **SHA revisado:** `071ba95` · base `origin/develop` = `4ec86e2` (ya contiene T-101)
- **Fecha:** 2026-09-23
- **Resultado: CON BLOQUEANTES (3).** Tres mejoras y dos decisiones, las dos ya resueltas por Lautaro073 antes de escribir esto.

> **Método:** revisión estática. Por indicación de Lautaro073, **CI se mira recién cuando la ronda ya está para
> aprobar**; esta tiene bloqueantes, así que no consulté los ocho jobs ni corrí suites. El cuerpo declara 8/8 en
> verde y `192 passed`: **no lo verifiqué de forma independiente.**

---

## Lo que más importa de esta ronda, en una frase

**Hoy nada en la PR detectaría que se pierda el `FOR UPDATE` sobre `delivery_requests`** — el lock que serializa
los accept concurrentes, o sea exactamente el invariante que el DoD pone primero. Hay tres piezas que dicen
cubrirlo y ninguna lo hace: la carrera de pgTAP, la de Vitest y la verificación estática del SQL. Las enumeré a
las tres antes de reportar, que es la lección `AG-37` de la #56.

---

## 1. `H01` · Las aserciones de locks pasan aunque se quite el lock · **BLOQUEANTE**

`offers.test.ts:992-994` verifica los tres locks así:

```ts
expect(body).toMatch(/from\s+public\.delivery_requests[\s\S]*?for\s+update/i);
expect(body).toMatch(/from\s+public\.offers[\s\S]*?for\s+update/i);
expect(body).toMatch(/from\s+public\.couriers[\s\S]*?for\s+share/i);
```

El comodín `[\s\S]*?` no se detiene en el fin de la sentencia: recorre **todo el cuerpo de la función**. Así que
«`from public.offers` … en algún lugar más adelante … `for update`» se satisface con el `for update` de
*`delivery_requests`*, y al revés. Mutando el texto de la migración:

| Mutación | `delivery_requests` | `offers` | `couriers` |
|---|---|---|---|
| original | PASA | PASA | PASA |
| **M1** · sin el `for update` de `offers` | PASA | **PASA** | PASA |
| **M2** · sin el `for update` de `delivery_requests` | **PASA** | PASA | PASA |
| M3 · sin ninguno de los dos | FALLA | FALLA | PASA |

Las dos aserciones de `FOR UPDATE` **solo detectan que se caigan las dos a la vez**. La de `couriers FOR SHARE`
es la única sana, y por casualidad: hay un solo `for share` en el cuerpo.

Enumeré la clase completa: son las **únicas tres** aserciones del archivo que usan ese comodín. Las de T-101
(`:456-483`) están acotadas por bloque de función y no tienen el problema.

- **Qué hacer:** anclar cada aserción a su propia sentencia (por ejemplo `from\s+public\.offers\s+o[^;]*?for\s+update`,
  que no cruza el `;`) y, ya que el comentario de la migración justifica el **orden** jerárquico como la defensa
  contra deadlocks, afirmarlo: índice de `delivery_requests … for update` < índice de `offers … for update` <
  índice de `couriers … for share`.
- `P08-control-no-cubre-lo-que-dice`

## 2. `H02` · El ítem de concurrencia del DoD está marcado `[x]` con evidencia secuencial · **BLOQUEANTE**

El DoD dice «10 llamadas concurrentes → una sola ganadora» y la ficha lo trae tildado. Las dos pruebas que lo
cubren no ejercen concurrencia en ningún punto:

- **pgTAP** (`rpc_accept.sql:313`): un bloque `DO` con `for i in 1..10 loop`, en **una sola sesión y una sola
  transacción**. No hay dos backends, así que ningún lock se disputa nunca.
- **Vitest** (`offers.test.ts` test 6): `Promise.all` sobre `createFakeRpcClient`, que es **síncrono**. Cada
  handler corre entero sin ceder el event loop, de modo que «1 ganadora + 9 `ALREADY_MATCHED`» lo garantiza el
  runtime de JS, no un mecanismo de exclusión. La prueba no puede fallar por una razón de concurrencia.

Las dos demuestran **competencia secuencial e idempotencia**, que es real y vale. Lo que no demuestran es
serialización. Junto con `H01`, el resultado es que el invariante central de la tarea no tiene ningún control
vivo.

- **🔵 `D01` · decidido por Lautaro073:** reformular el ítem del DoD como la `D04` de T-101 —que diga lo que las
  pruebas demuestran— y endurecer la aserción estática según `H01`.
- `P08-control-no-cubre-lo-que-dice`

## 3. `H03` · El vencimiento perezoso se revierte solo · **BLOQUEANTE**

Paso 6 de la migración:

```sql
update public.delivery_requests set status = 'expired' where id = v_request.id;
raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
```

Ese `raise` no está dentro de ningún `BEGIN … EXCEPTION`, así que **aborta la transacción y revierte el
`update`**. La transición a `'expired'` no persiste nunca.

Lo dice, textual, el comentario que escribiste vos en T-101 y que ya está mergeado en develop
(`20260923050000_rpc_offers_v1.sql:108`):

> `-- Any subsequent RAISE EXCEPTION aborts the transaction and rolls back this increment`

Y `submit_offer`, en esa misma migración, lo resuelve bien: verifica `expires_at <= now()` y lanza, **sin
escribir**. El `update` se agregó en `accept_offer`.

Hoy tres documentos afirman que la transición ocurre: el paso 6 de `CC-003`, el comentario de la migración y el
cuerpo de la PR. El fake tampoco la persiste, así que el comportamiento observable entre las dos
implementaciones es consistente — **lo que está mal es el contrato**.

Es bloqueante por una razón concreta: **al mergear, la migración queda inmutable** (`AGENTS.md` §6). Sacar el
`update` muerto después cuesta una migración nueva.

- **Por qué pasó los checks:** el test 13 usa `throws_ok` y solo afirma el código de error. Ninguna aserción
  mira el `status` de la solicitud después del rechazo. La prueba en rojo que falta es una línea:
  `is((select status from delivery_requests where id = ...), 'expired')` — que hoy daría `published`.
- **🔵 `D02` · decidido por Lautaro073:** sacar el `update` y alinear con `submit_offer`, y corregir `CC-003`, el
  comentario y el cuerpo de la PR.
- `P03-comentario-contradice-codigo`

---

## Mejoras

### `H04` · `CC-003.md` se titula `CC-002` — medio

La línea 1 dice `# CC-002 — INTERNAL_ERROR, precedencia canónica de accept_offer…` y la de `Aprobaciones` dice
`(CC-002 en T-102)`. Pero **`CC-002` ya existe en develop** y es otra cosa: *«Contratos y alcance para el ciclo
de solicitudes»*. Dos documentos distintos se identifican con el mismo número.

El rename (`e189d04`) cambió el nombre del archivo y no el contenido. Y la cita se propagó al código:
`offers.ts:48` dice `(D03 / H02 / CC-001 / CC-002)` donde corresponde `CC-003`.

> Al momento de esta revisión hay un arreglo **sin commitear** en el árbol compartido que corrige el título y
> `Aprobaciones` — pero no toca la cita de `offers.ts`. Lo registro como abierto igual: sin commit no hay SHA que
> verificar, y `COMO-ENTREGAR.md` documenta que en la #49 un revert se llevó puesto trabajo sin commitear.

- `P03-comentario-contradice-codigo`

### `H05` · La rama `23505 → ALREADY_MATCHED` del wrapper es inalcanzable — bajo

Las tres escrituras del paso 9 están dentro de un `BEGIN … EXCEPTION WHEN unique_violation THEN raise
'ALREADY_MATCHED'`, así que `accept_offer` **nunca deja escapar un `23505`** a PostgREST. La rama de
`mapOfferRpcError` solo se puede ejercer con un error fabricado en un test.

Es la misma forma que `PR62-H14`: una rama inalcanzable con cobertura al 100 % porque la prueba la alimenta a
mano. No es dañina —es defensa en profundidad— pero conviene que diga que lo es.

- `P08-control-no-cubre-lo-que-dice`

### `H06` · La ficha perdió las justificaciones al expandirse — bajo

«idem que T-101 + `rpc_accept.sql`» se expandió a 12 rutas. **Verifiqué que la expansión es fiel y no amplía el
alcance**: coincide exactamente con la lista de T-101 con los documentos de la tarea cambiados. Lo que se perdió
son los paréntesis: T-101 decía *«`src/domain/rpc-contracts.ts` (D03, D05 — contract-change CC-001 autorizado por
Lautaro073)»* y ahora dice solo la ruta. Los tres archivos de contrato de esta tarea se apoyan en `CC-003` y eso
no figura en ninguna línea.

- `P20-justificacion-de-seguridad-no-escrita`

---

## Lo que verifiqué y está bien

| | |
|---|---|
| Alcance | ✅ **10 archivos, 0 fuera**. La policy ya mergeada se toca por `drop`+`create` en migración nueva, que es la forma correcta (`AGENTS.md` §6) |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `security definer` + `search_path` | ✅ `public, pg_temp`, y privilegios `revoke all` + `grant execute to authenticated` |
| Códigos SQL vs contrato | ✅ los dos sentidos: 10 levantados ⊂ 11 declarados, y solo sobra `INTERNAL_ERROR` (lo produce el wrapper) |
| Códigos huérfanos | ✅ los 11 existen en `DomainErrorCode` |
| **Precedencia de 8 pasos** | ✅ **coincide en las tres piezas**: documentada, orden de `raise` del SQL, y orden del fake |
| pgTAP | ✅ `plan(34)` · 34 aserciones · numeración `1..34` sin duplicados ni faltantes |
| **`throws_ok`** | ✅ los **20** en la forma de 4 argumentos con `'P0001'::char(5)`: la trampa `AG-35` de la #56 está evitada |
| Policies sobre `offers` | ✅ enumeré las 7. Ninguna otra deja escribir al comercio: `offers_update_courier` exige ser el repartidor y `offers_update_admin` ser admin |
| `force row level security` | ✅ no existe, así que el `security definer` puede escribir pese a `with check (false)` |
| Serialización (el diseño) | ✅ correcto: lock de la fila de `delivery_requests` **antes** de leerla, y bajo READ COMMITTED el `FOR UPDATE` re-lee la fila actualizada, así que el segundo llamador ve `matched` y da `ALREADY_MATCHED` |
| Fake vs SQL en el vencimiento | ✅ consistentes: ninguno persiste (ver `H03`) |

### Y el cierre de `PR56-H21` quedó mejor que lo que pedía la ficha

La ficha decía **borrar** `offers_update_merchant`. En vez de eso se la recreó con el mismo `using` y
`with check (false)`. Lo comparé: es **estrictamente más restrictivo** que el original —que congelaba seis
columnas y dejaba libre `created_at`— y además da **`42501` explícito** donde borrarla daría un no-op silencioso
de 0 filas. Es un desvío de la ficha, está justificado en el comentario de la migración, y es la mejor de las dos
opciones.

### Tres cosas más que conviene decir

- **Cuarta fase roja consecutiva en su propio commit** (`4bc43f8`), con los dos fallos pegados en la bitácora.
- **`CC-003` aplica preventivamente las decisiones de T-101** (`D03`, `D05`, `H10`, `H15`) sin que nadie lo
  pidiera: `INTERNAL_ERROR`, precedencia documentada una sola vez y paridad del fake. Los hallazgos de la PR
  anterior se traspasaron solos.
- **El test 8 ya aplica `AG-58`**, que salió de la #62: separa por bloque de función en vez de hacer `toMatch`
  sobre el archivo entero, compara los códigos en los dos sentidos y excluye `INTERNAL_ERROR`. Es el mismo
  control que pedí allá, escrito antes de que lo pidiera acá. El único punto flojo es el de los locks (`H01`).

---

## Checks

**No ejecutados ni consultados**, por el método nuevo: esta ronda tiene bloqueantes.

| | |
|---|---|
| `pnpm typecheck` · `lint` · `test` · `test:db` | no ejecutados |
| Los 8 jobs de CI | no consultados |
| `192 passed`, `34/34` pgTAP, cobertura | **declarados por el cuerpo, no verificados** |

## Veredicto

**CON BLOQUEANTES (3).** Los tres son baratos de arreglar y ninguno toca el diseño, que está bien: la
serialización por lock de fila, la idempotencia con `matchedAt` preservado y el rechazo en cascada de las
ofertas hermanas están bien resueltos. Lo que falta es que los controles midan lo que dicen medir, y que el
contrato no afirme una escritura que se revierte.

**No apruebo ni mergeo.**
