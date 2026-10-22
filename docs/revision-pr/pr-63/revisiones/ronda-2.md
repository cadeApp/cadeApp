# PR #63 · T-103 — Ronda 2

- **PR:** [#63](https://github.com/cadeApp/cadeApp/pull/63) · `feat/T-103-request-lifecycle` → `develop`
- **SHA revisado:** `37014bd` · base `origin/develop` = `b6b5f39` (sigue al día)
- **Fecha:** 2026-09-24
- **Resultado: CON BLOQUEANTES (5).** De los 12 registros de la ronda 1, **9 cerrados y verificados**, 3
  parciales. Los cinco bloqueantes son de control y de documentación, **ninguno de código**: la RPC hace lo
  correcto en todo lo que probé.

> **Método:** con Docker, igual que la ronda 1. Corrí la receta de `db-tests` (1.373/1.373), las sondas de la
> ronda 1 sobre el código nuevo, 22 mutaciones de `request_cycle` contra las 1.196 aserciones, 15 sondas nuevas, la
> tabla de doble falla ampliada a 27 combinaciones de los dos lados y la batería del control estático.
> `typecheck`, `lint` y `test`, en un worktree limpio. CI **no consultado**: la ronda tiene bloqueantes. Todo en
> [`evidencia/comandos.md`](../evidencia/comandos.md#ronda-2-sobre-37014bd).

---

## Lo que más importa de esta ronda

**El código quedó bien. Lo que falla es que tres propiedades nuevas no tienen ninguna prueba que las fije, y una
de las pruebas nuevas no puede fallar.** De 22 mutaciones, 18 se ponen rojas. Las cuatro ciegas son justo las
zonas que tocaron los arreglos:

| Ciega | Qué protege | Hallazgo |
|---|---|---|
| M06 | `expires_at` renovado al volver a `published` | `H10`: la aserción existe, se llama «M06a/M06b» y **no puede fallar** |
| M21 | que solo el admin lea los motivos libres | `H11`: la tabla nueva de D02 no tiene ningún test de RLS |
| M20 | que republicar una vencida expire las `pending` | `H12`: efecto de la transición nueva que creó H02 |
| M13 | que el `before` del `audit_log` no lleve texto libre | `H09`, parcial |

Y el quinto bloqueante (`R01`) es el mismo de la ronda 1 (`H05`) en otra forma: el cuerpo de la PR y, sobre todo,
la bitácora describen código que no existe.

---

## Lo que se cerró, verificado

| ID | Cómo lo verifiqué en `37014bd` |
|---|---|
| `H01` | sondas `H01a` y `H01b` en verde; la mutación que revierte el arreglo (M14) pone rojas `S06` y `S14` |
| `D01` | **27 de 27** combinaciones de doble falla coinciden entre RPC y fake (las 19 de la ronda 1 + 8 nuevas que salen del reordenamiento); la gemela pgTAP detecta la reversión de `H01` y de `H02` |
| `H02` | sonda `H02` en verde; M15 (volver a validar `republish` con el estado persistido) pone roja `S15` |
| `H03` | el repartidor 4 ya no lee el motivo (sondas `H03a`/`H03b`); M16 pone rojas `H03a`/`H03b` |
| `D02` | la tabla existe; su RLS es correcta **hoy** (sonda P1: courier ajeno 0, courier que canceló 0, comercio 0, admin 1; nadie inserta); M17 pone rojas `D02a`/`D02b` |
| `D03` | M18 pone roja la prueba de `D03`; sondas: admin sin claim `aal` → `AAL2_REQUIRED`, admin `aal1` sobre publicada vencida → `REQUEST_EXPIRED`, como dice la precedencia |
| `H04` | la aserción de `pg_locks` ya no existe (`grep -c` → 0); bloque renombrado y comentarios corregidos |
| `H07` | sonda `H07` da 500; M19 pone roja la prueba nueva; puntos idénticos → 0 en SQL y en el dominio |
| `H08` | V03 y V04 ahora rojas, y por la aserción que dice cuidarlas (comprobado con el reporter por defecto) |

**Dos cosas que el agente hizo mejor de lo que pedí:**

- **La tabla de doble falla quedó como prueba permanente en los dos lados**, con los mismos IDs que la evidencia.
  Pedí la tabla en `domain.test.ts` y su gemela en pgTAP; además la gemela usa los mismos actores que la sonda, así
  que se puede leer una contra la otra.
- **El arreglo de `H08` trae su propia mutación embebida para V04**, igual que M1–M3 (`AG-63`): si alguien afloja
  el regex nuevo, el propio test se pone rojo.

---

## Bloqueantes

### 1. `H10` · Las aserciones «M06a» y «M06b» no pueden fallar · **BLOQUEANTE**

`rpc_requests.sql:401-402` y `:415-416` afirman `expires_at > now() + interval '25 minutes'` después de
`courier_cancel_match` y de `republish_request`. Pero la fixture (`:45`) siembra `expires_at = now() + 30 min`
y el TTL de la fixture es 30 (`:39`). Dentro de una transacción `now()` es constante, así que **el valor
renovado es idéntico al sembrado**: la aserción se cumple aunque la RPC no toque `expires_at`.

- **Corrido:** M06 (renovar `expires_at` solo en `publish`) deja las 1.196 en verde. La sonda P3 muestra la
  igualdad: fixture `= now() + 30 min` y TTL `= 30`.
- Llevan el nombre de mi mutación y se escribieron para matarla, pero nadie la corrió. Es la diferencia entre
  nombrar una mutación y ejecutarla (ver `AG-68`).
- **Qué hacer:** antes de la llamada, sembrar un `expires_at` distinto del que produce la RPC (por ejemplo,
  `now() + 5 min`) o cambiar el TTL (por ejemplo, a 17, como ya hace la prueba de `publish` en `:252-255`), y
  afirmar la igualdad exacta `expires_at = now() + interval '17 minutes'`. Demostrarlo con M06.
- `P04-test-tautologico` · origen `agente`

### 2. `H11` · La tabla de motivos de D02 no tiene ningún test de RLS · **BLOQUEANTE**

`request_cancellation_reasons` existe para una sola cosa: que el texto libre lo lea solo el admin. Hoy la policy
lo cumple (sonda P1). Pero **M21, que abre la policy a `using (true) with check (true)`, deja las 1.196 en
verde**: las pruebas nuevas leen la tabla como `postgres`, que ignora la RLS. Si alguien afloja la policy, el
motivo del repartidor vuelve a quedar a la vista de todos, que es exactamente `H03`, y nada avisa.

Es `AG-32` y `AG-34` en una tabla nueva: matriz por operación y por lo menos un positivo por rol.

- **Qué hacer:** con el rol real `authenticated`, después de `courier_cancel_match` con motivo: el courier ajeno,
  el courier que canceló y el comercio dueño leen 0 filas; el admin con `aal2` lee 1; nadie inserta (`42501`).
  Las seis consultas están armadas en la sonda P1 de la evidencia. Demostrarlo con M21.
- `P08-control-no-cubre-lo-que-dice` · origen `agente`

### 3. `H12` · Los efectos de la transición nueva de `H02` no los lee ninguna aserción · **BLOQUEANTE**

El arreglo de `H02` abrió una transición que antes no existía: `published` vencida → `published`. Tiene los
mismos efectos que cualquier republicación, y uno propio: **las ofertas `pending` que quedaron de la publicación
vencida pasan a `expired`**. Si no pasaran, el comercio podría aceptar después una oferta anterior a la
republicación.

- **Corrido:** el código lo hace (sonda P2: la `pending` de la fixture queda `expired` y `expires_at` se renueva),
  pero **M20, que deja de expirar las `pending` al republicar, deja las 1.196 en verde**. `S15` solo mira el estado.
- Es la clase de `H06` aplicada a una fila nueva de la tabla. Y en parte es un agujero mío: en la ronda 1, el
  «qué hacer» de `H02` describía este efecto («expira las `pending`») pero no pedía la aserción, y la tabla de
  `H06` no tenía esta fila porque la transición todavía no existía.
- **Qué hacer:** después de `S15`, afirmar la oferta 31 en `expired` y `expires_at` con el TTL cambiado (ver `H10`).
  Demostrarlo con M20.
- `P08-control-no-cubre-lo-que-dice` · origen `ambos`

### 4. `H09` · parcial: el `before` del `audit_log` sigue sin control · **BLOQUEANTE**

`:436` afirma que las claves del `after` son `['status']`, y M12 se pone roja: bien. Pero la ronda 1 pedía `before`
**y** `after`, y **M13 (`p_reason` en el `before`) deja las 1.196 en verde**.

- **Qué hacer:** la misma aserción sobre `before`, con `['offerId', 'status']`. Una línea. Demostrarlo con M13.

### 5. `R01` · El arreglo de `H05` reescribió cuerpo y bitácora con afirmaciones que no son el código · **BLOQUEANTE**

El cuerpo mejoró: sacó `dblink`, corrigió el conteo (1.196, coincide con lo que corrí), declara que `test:db` corre
en CI por no tener Docker, y describe bien `H01`, `H02` y `D03`. Pero quedan afirmaciones falsas, y en la bitácora
—que es lo que lee quien retoma— son más:

| Afirmación | Dónde | Lo que dice el código |
|---|---|---|
| Precedencia «1. `VALIDATION_ERROR` → 2. `UNAUTHENTICATED` → 3. `AAL2_REQUIRED` → 4. `NOT_FOUND`/`REQUEST_NOT_FOUND` → …» | cuerpo y bitácora | `rpc-contracts.ts` y la RPC: `UNAUTHENTICATED` primero, validación después del rol, `AAL2_REQUIRED` **después** de la transición. `REQUEST_NOT_FOUND` no existe en el repo |
| `calculateRouteDistanceM` en `src/domain/requests.ts:81` | cuerpo y bitácora | ese archivo no existe; la función es `calculateHaversineRouteDistanceM` en `schemas/index.ts:137` |
| `v_eff_status` vence `draft`, `published` y `matched` con `v_expires` | bitácora | solo `published` con `v_request.expires_at` (`:107-108`). La versión escrita vencería viajes `matched` |
| participación `if v_user not in (v_merchant, v_courier)` «en el paso 5» | bitácora | `:92-94`, `v_offer.courier_id is distinct from v_uid …` |
| `coalesce(auth.jwt()->>'aal', '')` | bitácora | `current_setting('request.jwt.claims', true)` |
| `H06` «todos los efectos» y todo «verificado con pruebas en rojo/verde» | cuerpo y bitácora | M06 es ciega (`H10`); ni el cuerpo ni la bitácora muestran un solo rojo de esta ronda |

El precedente de `H05` era «el cuerpo afirma una prueba que ya no existe»; esto es lo mismo con código. Y la
precedencia equivocada es la que más importa: `rpc-contracts.ts` la tiene bien y es la fuente de verdad, pero el
próximo agente que retome va a leer la bitácora.

- **Qué hacer:** reemplazar la lista de precedencia por un enlace a `rpc-contracts.ts` (sin copiarla), corregir
  las cuatro citas y registrar en la bitácora, por arreglo, el rojo que se vio antes del verde.
- `P03-comentario-contradice-codigo` · origen `agente`

---

## Alcance · `A01` · CC-005 dentro de la PR · **ACEPTADO por Lautaro073**

La ficha de la rama suma `src/domain/rpc-contracts.ts`, `rpc-fake.ts`, `domain.test.ts` y `CC-005.md` a
«Archivos permitidos». La de develop dice que `src/domain/**` no se autoriza dentro de T-103, la skill
`contract-change` pide rama `cc/` propia mergeada antes, y la ronda 1 decía «rama propia como CC-002/CC-004».
Preguntado antes de escribir este informe: **se acepta adentro**, con la autorización confirmada por Lautaro073.
El contenido está verificado (27/27). No hay otra rama que use el número `CC-005`.

## Mejoras

- **`H13` · La policy de la tabla de motivos es `for all` y solo se concede `select`.** Hoy no importa, porque
  sin `grant insert` el admin tampoco escribe (sonda P1f). Pero el día que alguien conceda `insert` para otra cosa,
  el admin podría fabricar motivos a mano, fuera de la RPC. `for select` dice lo que se quiere.
  `P18-policy-sin-condicion-de-relacion` · `bajo`.

## Parciales que se cierran con los bloqueantes

- `H06` queda **parcial**: 8 de las 9 filas de la ronda 1 están cubiertas y demostradas (M02, M03, M04, M05, M07,
  M08, M09 y M11, todas rojas ahora); la novena, `expires_at`, es `H10`.
- `H05` queda **parcial**: lo pedido en la ronda 1 se hizo; lo que queda es `R01`.

## Observación, no hallazgo

El fake dejó de usar `transitionRequest` y reimplementa las transiciones a mano, alineadas con la RPC. La función
del dominio sigue existiendo, con su propia precedencia, y hoy solo la usan `canTransitionRequest` y los tests de
dominio. Si una feature la usa para elegir un mensaje de error, va a volver a divergir. No la reporto porque hoy
nadie fuera de `src/domain` la llama.

## Checks

| | Alcance | Resultado |
|---|---|---|
| `pnpm supabase test db` | local, `37014bd` | `Files=7, Tests=1373, Result: PASS` · `rpc_requests.sql` 1.196/1.196 |
| `pnpm db:types --local` + diff | local | sin diff (verificado que el generador escribió) |
| `pnpm typecheck` · `lint` · `test` | worktree limpio de `37014bd` | exit 0 · sin avisos · 296/296, workflows 19/19, ADR 6/6 |
| Sondas de la ronda 1 | 13 | 12 en verde; `H04` en rojo porque mide la fixture (la aserción se borró) |
| Sondas nuevas | 15 | 15 en verde: el código hace lo correcto |
| Doble falla RPC vs fake | 27 | 0 divergencias |
| Mutación de `request_cycle` | 22 contra 1.196 | 18 rojas · 4 ciegas (M06, M13, M20, M21) · M00 verde |
| Control estático | 5 | 4 rojas (V01–V04) · V00 verde |
| CI | — | **no consultado**, por método |

## Qué hay que hacer

Todo en `supabase/tests/rpc_requests.sql`, más la bitácora y el cuerpo:

1. `H10`: sembrar un `expires_at` o un TTL distinto y afirmar la igualdad exacta (M06).
2. `H11`: las seis consultas de RLS de la sonda P1, con el rol real (M21).
3. `H12`: oferta `pending` → `expired` y `expires_at` renovado después de `S15` (M20).
4. `H09`: claves del `before` (M13).
5. `R01`: cuerpo y bitácora contra el código, con el rojo de cada arreglo.
6. `H13` si entra.

Cada una, demostrada con la mutación que está al lado. Las cuatro mutaciones y las sondas están escritas en la
evidencia: la ronda 3 va a volver a correrlas tal cual.
