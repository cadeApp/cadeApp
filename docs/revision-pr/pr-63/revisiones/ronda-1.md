# PR #63 · T-103 — Ronda 1

- **PR:** [#63](https://github.com/cadeApp/cadeApp/pull/63) · `feat/T-103-request-lifecycle` → `develop`
- **Tarea:** `T-103` · Issue #13 · ficha leída desde `origin/develop`, no desde la rama
- **SHA revisado:** `9f2e42e` · base `origin/develop` = `b6b5f39` (el merge-base es develop: la rama está al día)
- **Fecha:** 2026-09-24
- **Resultado: CON BLOQUEANTES (7).** Dos mejoras y tres decisiones, las tres ya resueltas por Lautaro073.
  Dos de las decisiones suman trabajo que también bloquea el merge.

> **De dónde sale esta ronda.** La empezó el 2026-09-23 otra sesión, de forma estática (sin Docker) y en
> Windows; su borrador no llegó a commitearse ni dejó evidencia en ninguna rama. Esta sesión lo terminó sobre el
> **mismo SHA** y, con Docker disponible, **corrió contra la base local todo lo que allá decía «leído en el
> SQL»**. Cada hallazgo trae ahora su sonda en rojo. En tres puntos el borrador estaba incompleto o equivocado, y
> lo corrijo abajo en su lugar: el conteo de `D01`, la tabla de `H06` (le faltaban tres efectos ciegos) y un
> hallazgo nuevo, `H09`, que sale del mismo barrido.
>
> **Método:** CI no se consultó (la ronda tiene bloqueantes). Lo que sí corrí: la receta de `db-tests` completa
> (1.330/1.330, tipos sin diff), 13 sondas pgTAP, la tabla de doble falla de los dos lados, 13 mutaciones de
> `request_cycle` contra las 1.153 aserciones y 5 contra el control estático. Todo en
> [`evidencia/comandos.md`](../evidencia/comandos.md).

---

## Lo que más importa de esta ronda

**La RPC está bien construida y los problemas están en los bordes, no en el centro.** El orden de locks, los
grants, la matriz 8×7×6 y el wrapper son sólidos. Lo que falla es lo que queda **entre** piezas:

- **entre la RPC y el contrato**: una precedencia que CC-002 escribió con flechas y la RPC invirtió (`H01`), y
  cinco RPC más cuya precedencia no está escrita, donde RPC y fake eligen códigos distintos en 14 de 15 casos (`D01`);
- **entre la RPC y el plan**: la expiración perezosa se aplicó para rechazar y no para habilitar (`H02`);
- **entre la RPC y la RLS**: un texto libre escrito en una columna que lee cualquier repartidor (`H03`);
- **entre las pruebas y lo que dicen probar**: un bloque «concurrencia» que no puede fallar (`H04`), nueve
  efectos de transición que ninguna aserción lee (`H06`) y una promesa de privacidad sin control (`H09`).

La autorrevisión pegada en el cuerpo dice «SIN BLOQUEANTES · MEJORAS: ninguna». Es el mismo contraste que la #56
(`COMO-ENTREGAR.md`): revisarse a uno mismo encuentra lo que la ejecución tira por la cara —acá el agy encontró y
arregló bien los hitos de `cancel` (`AG-37`) leyendo su CI en rojo— pero no lo que uno no pensó al escribirlo.

---

## 1. `H01` · `report_incident` invierte la precedencia que CC-002 escribió · **BLOQUEANTE**

CC-002 §4, mergeado en develop, fija el orden con flechas:

> Para `report_incident`: autenticación/rol → entrada válida → solicitud existente → **participación** →
> **elegibilidad si es courier** → estado/ventana → creación.

La RPC hace lo contrario (`20260924010124_rpc_requests_v1.sql:70-77`): para cualquier courier revisa primero su
registro y su estado (`:71-74`) y recién después si es el de la oferta aceptada (`:75`). El fake sigue a CC-002.

| Caso (solicitud `matched`) | fake | RPC (corrida) |
|---|---|---|
| courier **ajeno** y **suspendido** reporta incidente | `UNAUTHORIZED_ACTOR` | `COURIER_SUSPENDED` |
| courier ajeno **sin registro** de repartidor | `UNAUTHORIZED_ACTOR` | `NOT_FOUND` |
| control: courier ajeno aprobado | `UNAUTHORIZED_ACTOR` | `UNAUTHORIZED_ACTOR` ✓ |

No es una fuga —el suspendido solo se entera de su propia suspensión—, pero es el contrato: `AG-59` dice que el
orden de los rechazos es parte del contrato, y este sí estaba escrito. La prueba de elegibilidad de `:338-346`
usa al courier **asignado**, por eso no lo ve.

- **Qué hacer:** en la rama de `report_incident`, verificar participación (`v_offer.courier_id = v_uid` y oferta
  `accepted`) antes de la elegibilidad. `mark_delivered` y `courier_cancel_match` ya cumplen su propio orden de
  CC-002 §4 (repartidor habilitado → pertenencia): el cambio es solo para `report_incident`. Sumar a pgTAP las
  dos filas de la tabla.
- **Rojo:** sondas `H01a` y `H01b` → `not ok` hoy.
- `P11-api-publica-inconsistente` · origen `agente`

## 2. `D01` · En cinco RPC más, RPC y fake eligen códigos distintos y nadie escribió cuál vale · **DECISIÓN → CC antes del merge**

Fuera de `report_incident`, la precedencia de `publish_request`, `cancel_request`, `republish_request`,
`report_no_show` y `mark_picked_up` **no está escrita sin ambigüedad** en ningún lado: `rpc-contracts.ts` la
documenta para `submit_offer`, `withdraw_offer`, `accept_offer` y `set_availability` (`:330`, `:360`, `:382`,
`:498`), y para ninguna de las ocho de esta tarea.

Corrí **las dos implementaciones** contra quince combinaciones de doble falla y cuatro controles:
**14 de 15 divergen**; coincide S15 (y ahí los dos están mal, por `H02`); coinciden los cuatro controles, así
que la sonda no está sesgada.

| | RPC | fake | combinación |
|---|---|---|---|
| S01–S03 | `INVALID_STATE_TRANSITION` | `UNAUTHORIZED_ACTOR` | admin cancela `published`/`matched`; comercio cancela `in_transit` |
| S04 | `UNAUTHORIZED_ACTOR` | `REQUEST_EXPIRED` | comercio **ajeno** cancela una publicada vencida (el fake le revela el vencimiento) |
| **S05** | **rechaza** | **acepta** | incidente sobre una publicada **vencida**: el fake no aplica la expiración perezosa |
| S06 · S14 | `COURIER_SUSPENDED` · `NOT_FOUND` | `UNAUTHORIZED_ACTOR` | los dos casos de `H01` |
| S07–S08 | estado / motivo | `SUBSCRIPTION_INACTIVE` | republicar con suscripción vencida + estado o motivo inválidos |
| S09–S10 | estado / titularidad | `SUBSCRIPTION_INACTIVE` | no_show con suscripción vencida + estado o titularidad inválidos |
| S11–S12 | `UNAUTHORIZED_ACTOR` | `INVALID_STATE_TRANSITION` | courier ajeno marca retirado una `published` / una `draft` |
| **S13** | `INVALID_STATE_TRANSITION` | **`REASON_REQUIRED`** | publicar una `matched`: **el fake devuelve un código que no está en el contrato de `publish_request`** |
| S15 | `INVALID_STATE_TRANSITION` | `INVALID_STATE_TRANSITION` | republicar una publicada vencida sin barrer (`H02`) |

> **Corrección al borrador:** decía «13 de 15» con la RPC solo leída y un S14 que no quedó escrito. Este conteo
> sale de correr las dos implementaciones con la misma tabla, que está completa en la evidencia.

Es `PR62-H10` otra vez (alto en la #62), y la matriz de pgTAP no lo puede ver: en cada celda de rechazo afirma que
el código **pertenece** al contrato, no **cuál** es. Es el techo del barrido por conjuntos de `AG-59`.

**Decidido por Lautaro073:** CC antes del merge, con la plantilla de `PR62-D05`. La RPC es canónica (verifica
titularidad antes de revelar estado y nunca devuelve códigos fuera de contrato), salvo `report_incident`, que se
alinea a CC-002 (`H01`). La precedencia se escribe una vez en `rpc-contracts.ts`, se reordena el fake —con
expiración perezosa en `republish` y `report_incident`— y se agrega esta tabla de doble falla en `domain.test.ts`
y su gemela en pgTAP.

- `P11-api-publica-inconsistente` · origen `ambos`

## 3. `H02` · Republicar una solicitud vencida depende del cron · **BLOQUEANTE**

La regla 30 dice *«toda consulta y RPC trata `expires_at < now()` como expirada»*, y ADR-0002 §3 lo lleva al
extremo: *«que la corrección del negocio jamás dependa de la frecuencia ni de la puntualidad del cron»*. La RPC lo
aplica a medias:

- **para rechazar, sí:** `cancel` sobre una vencida da `REQUEST_EXPIRED` y `report_incident` la rechaza (`:82-86`);
- **para habilitar, no:** `republish_request` acepta `expired` (`:93`), pero una `published` vencida que el
  barrido todavía no persistió cae en `:82-86` y devuelve `INVALID_STATE_TRANSITION`.

| Caso | RPC (corrida) |
|---|---|
| `published` con `expires_at = now() - 1s` → `republish_request` | `INVALID_STATE_TRANSITION` |
| control: la misma, ya persistida `expired` | `published` ✓ |

O sea que el comercio ve su solicitud «vencida» (cualquier lectura con `getEffectiveRequestStatus`), aprieta
«Republicar», y falla **hasta que corra el barrido**. En Vercel Hobby el cron corre **una vez por día**
(ADR-0002 §1.3): hasta 24 horas sin poder republicar. El fake hace lo mismo (S15), por eso nada lo delata.

- **Qué hacer:** calcular el estado efectivo una sola vez (`published` con `expires_at <= now()` ⇒ `expired`) y
  validar la transición contra él. `republish` sobre una vencida pasa y expira las `pending` (ya lo hace `:182`);
  `cancel` y `report_incident` siguen rechazando. El fake cambia en el CC de `D01`.
- **Rojo:** sonda `H02` → `not ok` hoy; el control `H02-control` → `ok`.
- `P06-enumeracion-incompleta` · origen `ambos`: el contrato permite republicar desde `expired`, y la tabla de
  §5.1 del plan ni siquiera lista esa transición.

## 4. `H03` · El motivo libre del repartidor queda a la vista de todos los repartidores · **BLOQUEANTE**

`:191` escribe `cancel_reason = nullif(btrim(p_reason), '')` en las cuatro transiciones del bloque compartido. Dos
de ellas **devuelven la solicitud a `published`**: `courier_cancel_match` y `republish_request`. Y
`delivery_requests_select_courier` (`rls_v1.sql:270-278`) deja leer **la fila entera** de toda `published`
vigente a cualquier repartidor aprobado; no hay privilegios por columna en ninguna migración.

Corrido con el rol real `authenticated` y el JWT del repartidor 4 (aprobado, sin relación con la solicitud):

| Después de | `cancel_reason` que lee el repartidor 4 |
|---|---|
| `courier_cancel_match(<id>, 'no atendia, porton verde')` | `no atendia, porton verde` |
| `republish_request(<id>, 'la señora no estaba')` | `la señora no estaba` |

Un motivo de cancelación tiende a hablar del destinatario, y AGENTS.md §2 dice que sus datos van **solo** en
`delivery_request_contacts`. La migración sabe que ese texto es sensible: su propio comentario de `:194` dice
*«los motivos libres y datos privados nunca van al audit log»*. Lo protegió del log de admin y lo mandó a la
columna más visible del esquema.

**Barrí la clase (`AG-37`):** estas RPC escriben texto libre en tres columnas. `incidents.kind` e
`incidents.description` solo las leen quien reporta y el admin (`incidents_select_reporter`,
`incidents_select_admin`): bien. `cancel_reason` en `cancelled` solo la ven el comercio y el admin, porque
`accepted_offer_id` queda en `null`: bien. **La fuga son exactamente los dos caminos que terminan en `published`.**

**Decidido por Lautaro073 (`D02`):** tabla nueva solo para admin, en la migración de T-103. En la solicitud
publicada, `cancel_reason` queda en `null` o con un token fijo (`no_show`, `courier_cancel`). Encaja con el plan
§5.1: *«se registra el motivo y se cuenta para el admin»*.

- **Rojo:** sondas `H03a` y `H03b` → `not ok` hoy.
- `P22-texto-libre-en-columna-de-visibilidad-amplia` (propuesto; ver `lecciones.md`) · origen `agente`

## 5. `H04` · El bloque «concurrencia» de pgTAP no puede fallar · **BLOQUEANTE**

`rpc_requests.sql:365-394` es secuencial —una sesión, una transacción— y su aserción central (`:371-386`)
verifica que el backend tenga `RowExclusiveLock` sobre `delivery_requests` y `offers`. **Lo tiene desde mucho
antes de llamar a `cancel_request`:** `pg_temp.fixture()` (`:23-63`) hace `update`, `delete` e `insert` sobre esas
dos tablas en la misma transacción, y un lock de tabla dura hasta el fin de la transacción.

- **Corrido:** después de `fixture('matched')`, **sin llamar a ninguna RPC**, la condición de `:371-386` ya se
  cumple (sonda `H04`).
- **Corrido:** una transacción que solo hace `select … for update` sobre `delivery_requests` toma
  **`RowShareLock`**, no `RowExclusiveLock`. El comentario de `:365` («`RowExclusiveLock (FOR UPDATE)`») está mal.
- Y el comentario de `:366-367` dice que la transición competidora *«falla con `INVALID_STATE_TRANSITION`»*,
  mientras `:387-388` afirma `UNAUTHORIZED_ACTOR` para `mark_picked_up`. El test tiene razón y el comentario no.

O sea que el test no mide `FOR UPDATE` ni concurrencia. Lo que protege de verdad el mecanismo es el control
estructural de `requests.test.ts` (orden de locks anclado por sentencia, con mutaciones embebidas), que es
exactamente la salida (b) de `AG-62`. Las demás aserciones del bloque (`:387-394`) son válidas como secuenciales:
solo hay que llamarlas así.

- **Qué hacer:** borrar la aserción de `pg_locks`, renombrar el bloque a «transiciones competidoras en
  secuencia» y corregir los dos comentarios.
- `P04-test-tautologico` · origen `agente`

## 6. `H05` · El cuerpo de la PR y la bitácora no corresponden al head · **BLOQUEANTE**

- El resumen afirma *«contención concurrente real entre dos conexiones `dblink` con `lock_timeout»*, y la
  autorrevisión, *«autenticación con contraseña en `dblink_connect`»*. `dblink` se sacó en `5bd2a49`; la bitácora
  lo dice. **El cuerpo afirma una prueba que ya no existe.**
- Dice **1.147** aserciones pgTAP; la suite tiene **1.153** (lo corrí: `1..1153`, 0 fallas).
- **No hay evidencia de `test:db` para el head** en el cuerpo: ni salida ni número de corrida. AGENTS.md §4 pide
  `pnpm test:db` si se toca `supabase/`, y si no se pudo correr, decirlo. *Yo* lo corrí y está verde
  (`Files=7, Tests=1330, Result: PASS`), pero eso es verificación de la revisión, no evidencia de la PR.
- La última entrada de la bitácora (22:45) no cubre `9f2e42e` (23:06) ni trae «Falta», «Próximo paso» ni
  «Último commit».
- **Lo que sí quedó bien, y el borrador lo dejaba pendiente:** la bitácora dice que las 8 firmas de
  `database.types.ts` se escribieron *«con el formato exacto»* del generador, y CC-002 §5 dice que no se edita a
  mano. Corrí `pnpm db:types --local`: **sin diff**. El contenido es idéntico al del generador; la forma de
  llegar no, y conviene no repetirla, pero no hay nada que corregir en el archivo.
- `P03-comentario-contradice-codigo` · origen `agente`

## 7. `H06` · Los efectos de cada transición no los lee ninguna aserción · **BLOQUEANTE**

La matriz afirma el **estado** persistido de cada transición aceptada, y está bien. Pero la tabla de §5.1 —que es
el DoD— pone condiciones y efectos en cada fila. Enumerando la clase entera (`AG-37`) y **mutando cada efecto
contra las 1.153 aserciones**:

| Efecto que escribe la RPC | Mutación | Resultado |
|---|---|---|
| `mark_delivered` → `delivered_at` (`:174`) | M02 quitarlo | **1153/1153 verde** |
| `mark_picked_up` → `picked_up_at` (`:171`) | M03 quitarlo | **verde** |
| `courier_cancel_match` → oferta aceptada a `cancelled` | M04 | **verde** |
| `republish_request` desde `matched` → oferta aceptada a `cancelled` | M05 | **verde** |
| `report_no_show` / `courier_cancel` / `republish` → nuevo `expires_at` | M06 solo en `publish` | **verde** |
| `cancelled_at` | M07 `null` | **verde** |
| `cancel_reason` | M08 `null` | **verde** |
| `accepted_offer_id = null` | M09 no limpiarlo | **verde** |
| `audit_log` de la transición | M11 no escribirlo | **verde** |
| `cancel` publicada → `pending` a `expired` | M10 | rojo ✓ (`:220`) |
| `cancel` desde `matched` / `report_no_show(false)` → oferta `cancelled` | — | leído (`:393`, `:214`) |
| control positivo: `mark_picked_up` no cambia el estado | M01 | rojo ✓ |

> **Corrección al borrador:** su tabla tenía seis filas ciegas por lectura. Corrida, son **nueve**: le faltaban
> `accepted_offer_id` (M09) y `audit_log` (M11), y M12 abre `H09`.

Las filas de ofertas son las que duelen: si la cascada se pierde en `courier_cancel_match`, la oferta vieja queda
`accepted`, y el próximo `accept_offer` choca contra el índice único de una sola `accepted` por solicitud. La de
`delivered_at` es el olor de `AG-57`: **la prueba siembra a mano el estado que el código debería producir**
(`:233-239` fijan `delivered_at` con un `update`). Sin `:174`, todo incidente posterior a la entrega daría
`INCIDENT_WINDOW_EXPIRED` y la suite seguiría verde.

- **Qué hacer:** una aserción por fila de la tabla, leyendo el efecto después de llamar a la RPC; y la ventana de
  24 h, a partir del `delivered_at` que escribe `mark_delivered`, no de uno sembrado. Cada una, demostrada con su
  mutación de arriba.
- `P08-control-no-cubre-lo-que-dice` · origen `agente`

## 8. `H09` · La promesa de `:194` no tiene control · **BLOQUEANTE** · nuevo

`:194` dice *«Solo IDs/estados: los motivos libres y datos privados nunca van al audit log»*. Es el único punto
donde la migración cuida el invariante de AGENTS.md §2 (datos del destinatario jamás en logs), y ninguna aserción
lo mira: **M12**, que agrega `'reason', p_reason` al `after` del `audit_log`, deja las 1.153 en verde.

No es un defecto del código de hoy, que cumple. Es que el día que alguien «mejore» la auditoría —y `D02` va a
tocar exactamente esa zona, moviendo el motivo a una tabla de admin— nada avisa. No lo vio el borrador: salió
de extender su batería de `H06` a la escritura del log.

- **Qué hacer:** después de las transiciones que reciben `p_reason`, afirmar que `before` y `after` del
  `audit_log` de esa solicitud no contienen el texto del motivo (o, más fuerte, que sus claves son un subconjunto
  de `status` y `offerId`). Demostrarlo con M12.
- `P08-control-no-cubre-lo-que-dice` · origen `agente`

## 9. `D03` · Un admin sin MFA puede cancelar un viaje en tránsito · **DECISIÓN → exigir aal2**

La rama admin de `cancel_request` (`:88-90`) decide por `profiles.role`, sin mirar `aal`. Una sesión de admin
que pasó la contraseña pero no el TOTP puede llamar la RPC directo por PostgREST y cancelar cualquier `in_transit`.
La regla 30 solo exige `aal2` a las RPC `admin_*`, así que la PR cumple la letra; la pregunta era si el MFA
obligatorio del plan (§3, §9.3) protege también las transiciones de ciclo que solo un admin puede hacer.

**Decidido por Lautaro073:** exigir `aal2` en la rama admin de `cancel_request`, con el mismo chequeo que
`rpc_admin_v1.sql` de T-105. El contrato suma `AAL2_REQUIRED` a `cancel_request` en el CC de `D01`.
`report_incident` de admin queda sin `aal2`: solo crea un incidente.

---

## Mejoras

- **`H07` · La distancia de la RPC y la del dominio difieren para puntos cercanos.** `:149-152` redondea a
  múltiplos de 500 sin piso; `calculateHaversineRouteDistanceM` devuelve **mínimo 500** si los puntos difieren.
  **Corrido:** con coordenadas privadas a ~111 m, la RPC guarda `route_distance_m = 0`. La bolsa diría «≈ 0 km»
  para dos direcciones distintas. Alinear la RPC al dominio (`greatest(500, …)` si los puntos difieren). Y avisar
  en T-106: `calculate_route_distance` va a ser la tercera implementación de la misma fórmula. `P11` · `bajo`.
- **`H08` · Dos puntos ciegos del control estático** (reproducidos). V03: un `perform … from public.couriers …
  for update` **antes** del lock de la solicitud (orden invertido con otro modo) pasa 35/35, porque el regex de
  couriers solo busca `for share`. V04: cambiar la aserción de la matriz por `ok(true or result->>'error' = any(…))`
  pasa 35/35, porque el control solo busca el texto. Los dos positivos (lock de solicitud quitado, `offers` antes
  que la solicitud) sí se ponen rojos. `P06` · `bajo`.

---

## Lo que está bien, con precisión

- **La advertencia para T-103 de `pr-64/lecciones.md` se tomó:** la expiración perezosa rechaza sin `update`
  previo (`:82-86`), y el control estático lo protege.
- **El control estático aplica `AG-58`, `AG-61` y `AG-63` bien:** `security definer` y `search_path` por función,
  locks anclados con `[^;]*?` y en orden por índice, y mutaciones embebidas. Sus dos positivos se ponen rojos.
- **La matriz 8×7×6 afirma el efecto, no la ausencia de error:** estado persistido al aceptar, estado intacto al
  rechazar y respuesta sin datos privados, celda por celda. Por eso M01 la pone roja.
- **El agy encontró y cerró su propio `AG-37`:** los hitos `matched_at` y `picked_up_at` sobreviven a `cancel`
  desde `matched` y desde `in_transit`, con prueba de las dos rutas.
- **El wrapper es más estricto que su precedente:** acepta solo `P0001` con un código declarado; `offers.ts`
  todavía acepta coincidencias por substring.
- **El límite sigue a CC-004 al pie:** después de todas las validaciones, cuenta solo éxitos, `publish` y
  `republish` comparten contador, y las tres pruebas lo fijan.
- **Los tipos terminaron idénticos al generador**, aunque el camino no fue el que pide CC-002 (`H05`).

## Checks

| | Alcance | Resultado |
|---|---|---|
| `pnpm supabase test db` | local, Docker, `9f2e42e` | `Files=7, Tests=1330, Result: PASS` · `rpc_requests.sql` 1.153/1.153 |
| `pnpm db:types --local` + `git diff --exit-code` | local | sin diff (verificado que el generador escribió) |
| `pnpm typecheck` · `pnpm lint` | local | exit 0 · `✔ No ESLint warnings or errors` |
| `pnpm test` | local | 294/295: la falla es el barrido de secretos de T-002 sobre `supabase/.temp/` que creó **mi** `supabase start`; en worktree limpio `clients.test.ts` 10/10. Workflows y ADR no corrieron |
| Sondas pgTAP | 13 | 7 en rojo como se esperaba · 6 controles en verde |
| Tabla de doble falla | 15 + 4 controles, RPC y fake | 14 divergen · 1 coincide · 4 controles coinciden |
| Mutación de `request_cycle` | 13 contra 1.153 aserciones | 2 rojas (M01 positivo, M10) · 10 ciegas · M00 control verde |
| Mutación del control estático | 5 | 2 positivos rojos · 2 ciegas · control verde |
| CI | — | **no consultado**, por método |

## Qué hay que hacer, en orden

1. **CC nuevo** (contract-change, rama propia como CC-002/CC-004), antes del merge (`D01`, `D03`):
   precedencia de las ocho RPC en `rpc-contracts.ts`; fake reordenado, con expiración perezosa en `republish`
   y `report_incident` y sin el `REASON_REQUIRED` fuera de contrato; `AAL2_REQUIRED` en `cancel_request`; tabla de
   doble falla en `domain.test.ts`.
2. **En esta rama**, después de traer el CC:
   - `H01` participación antes de elegibilidad en `report_incident`
   - `H02` estado efectivo para `republish`
   - `H03`/`D02` tabla de motivos solo para admin, sin texto libre en una solicitud publicada
   - `D03` `aal2` en la rama admin de `cancel_request`
   - `H04` sacar la aserción de `pg_locks` y corregir los dos comentarios
   - `H06` una aserción por efecto (nueve), cada una demostrada con su mutación
   - `H09` aserción de que el `audit_log` no lleva texto libre, demostrada con M12
   - la gemela pgTAP de la tabla de doble falla
   - tipos regenerados con `--local` (la tabla nueva los cambia)
3. **`H05`**: cuerpo de la PR y bitácora al día, con la corrida de `db-tests` del head.
4. Mejoras `H07` y `H08` si entran; ninguna bloquea.

Cada arreglo, demostrado en rojo antes y en verde después. Ahora hay Docker en la sesión de revisión: la ronda 2
va a volver a correr cada sonda y cada mutación de `evidencia/comandos.md` sobre el SHA nuevo.
