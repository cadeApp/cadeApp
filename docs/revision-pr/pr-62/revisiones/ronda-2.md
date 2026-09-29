# PR #62 · T-101 — Ronda 2

- **PR:** [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop`
- **Tarea:** `T-101` · Issue #11
- **SHA revisado:** `15e9b72` (arreglos en `15e9b72`, fase roja de `H03` en `b0e969b`)
- **Fecha:** 2026-09-23
- **Resultado: CON BLOQUEANTES (1)** · 2 mejoras · 2 decisiones resueltas antes de escribir

> **Alcance:** igual que la ronda 1, **no corrí suites ni consulté el estado de CI**. Lectura, barrido mecánico
> y razonamiento. Sí leí el cuerpo del PR, que es donde vivía `H06`.

---

## 1. Los nueve hallazgos de la ronda 1, cerrados

| id | Qué se hizo |
|---|---|
| `H01` | `max_offers_per_min` sembrado en `seed.sql` **y** insertado en la migración con `on conflict do nothing`, para que exista aun antes de que corra el seed. Las dos RPC lo leen con el mismo patrón que `min_offer_ars`, con su guarda de nulo/inválido. El literal `10` desapareció de los dos `if v_rate_count > …` |
| `H02` | `CC-001`: `INTERNAL_ERROR` agregado a las tres, `INVALID_STATE_TRANSITION` sacado de `withdraw_offer`. El `as RpcErrorCode<K>` de la línea 77 ya no existe |
| `H03` | Comentario explícito arriba de cada `insert into public.rate_limits` explicando por qué el contador solo sobrevive a las llamadas exitosas, y el DoD y el mensaje del test 31 reformulados |
| `H04` | El test 32 pasa de `ok(count >= 1)` a `is(…, 3)` con `order by window_start desc limit 1`. Se cerraron las dos puntas: el valor exacto y la subconsulta sin `limit` |
| `H05` | El test 4 se reescribió por función. Ver §3: quedó mejor que lo que pedí |
| `H06` | Las cuatro contradicciones corregidas en el cuerpo y en la bitácora: `1..240`, `FOR SHARE` sobre `couriers`, `INVALID_STATE_TRANSITION` en vez del inventado `REQUEST_NOT_PUBLISHED`, y `createFakeRpcClient` |
| `H07` | La entrada de `public/brand/logo.svg` salió de la bitácora |
| `H08` | Tres `is_definer` y tres casos `anon` esperando `42501`, uno por RPC. El plan pasó de 32 a 43 |
| `H09` | Las lecturas de `platform_settings`, la validación del monto y el upsert de `rate_limits` se movieron **antes** del `for update` sobre `delivery_requests` |

Barrido mecánico sobre `15e9b72`, mismo script de la ronda 1:

```
platform_settings
   usadas por la migracion: max_offers_per_min, min_offer_ars
   sembradas en seed.sql:   min_offer_ars, max_offers_per_min, request_ttl_minutes,
                            pilot_active, pilot_terms_version, subscription_grace_days
Literales numericos: solo quedan p_eta_minutes > 240 y char_length > 280
plan declarado: 43 · aserciones contadas: 43 · OK
```

### Tres cosas que se hicieron mejor que lo pedido

**El test 4 (`H05`).** Yo pedí partir el SQL por función y comparar los códigos en los dos sentidos. Lo que se
escribió hace eso **y además**: afirma que hay exactamente 3 bloques, mapea bloque → nombre de función y compara
el conjunto de nombres, agrega requisitos por RPC (`for share` solo en `submit_offer`, el upsert y el
`on conflict` donde corresponde, las lecturas de las dos claves), y comprueba que el seed tenga las dos claves.

Y resuelve un detalle que **mi propio barrido no resuelve**: excluye `INTERNAL_ERROR` de la comparación, porque
lo produce el wrapper y no el SQL. Mi script sigue reportando «declara y NO levanta: `INTERNAL_ERROR`» en las
tres RPC — es un falso positivo de mi herramienta, no un hallazgo. El test del PR codifica la regla correcta.

**La demostración en rojo de `H03`.** Yo especifiqué el contracaso —resetear el contador, tres `throws_ok` con
`OFFER_BELOW_MINIMUM`, afirmar 3— y está en su propio commit (`b0e969b`), con la salida pegada en el cuerpo:

```
# Failed test 36: "…si las llamadas con OFFER_BELOW_MINIMUM persistieran su incremento, el contador valdría 3 (vale 0)"
#         have: 0
#         want: 3
```

Después se invirtió a `is(…, 0)` y quedó como guardia de regresión de la conducta aceptada. Es la forma correcta
de cerrar un `aceptado`: no se documenta con prosa, se documenta con un test que falla si cambia.

**El test 33, que yo no pedí.** Baja `max_offers_per_min` a 3, comprueba que la 4.ª oferta recibe `RATE_LIMITED`
y lo restaura a 10. Es el control que prueba que el tope **de verdad** sale de `platform_settings`, con el mismo
patrón que el piso 1000→1500. Sin él, `H01` quedaba cerrado por inspección.

---

## 2. Bloqueante

### `H10` · La RPC y el fake devuelven códigos distintos para las mismas entradas, y el arreglo de `H09` ensanchó la brecha

Los dos implementan `submit_offer` y validan en orden distinto:

| | RPC (`15e9b72`) | Fake (`rpc-fake.ts:506`) |
|---|---|---|
| 1 | actor, rol | **solicitud o repartidor faltante → `NOT_FOUND`** |
| 2 | **repartidor: `NOT_FOUND`, `COURIER_SUSPENDED`, `COURIER_NOT_APPROVED`, `COURIER_UNAVAILABLE`** | `REQUEST_EXPIRED` |
| 3 | parámetros → `VALIDATION_ERROR` | `INVALID_STATE_TRANSITION` |
| 4 | **`OFFER_BELOW_MINIMUM`** | elegibilidad del repartidor (`COURIER_*`) |
| 5 | **`RATE_LIMITED`** | `OFFER_BELOW_MINIMUM` |
| 6 | solicitud: `NOT_FOUND`, `REQUEST_EXPIRED`, `INVALID_STATE_TRANSITION` | `DUPLICATE_ACTIVE_OFFER` |
| 7 | `DUPLICATE_ACTIVE_OFFER` | — |

Entradas donde los dos discrepan:

| Entrada | RPC | Fake |
|---|---|---|
| Monto bajo el piso + solicitud inexistente | `OFFER_BELOW_MINIMUM` | `NOT_FOUND` |
| Monto bajo el piso + solicitud vencida | `OFFER_BELOW_MINIMUM` | `REQUEST_EXPIRED` |
| Monto bajo el piso + solicitud en `draft` | `OFFER_BELOW_MINIMUM` | `INVALID_STATE_TRANSITION` |
| Repartidor suspendido + solicitud vencida | `COURIER_SUSPENDED` | `REQUEST_EXPIRED` |
| Repartidor suspendido + solicitud inexistente | `COURIER_SUSPENDED` | `NOT_FOUND` |
| En el tope + solicitud vencida | `RATE_LIMITED` | `REQUEST_EXPIRED` |

**Las tres primeras filas son nuevas y son culpa de `H09`**, que es un hallazgo mío: pedí mover el piso y el
rate limit antes del `for update` para acortar la sección crítica, y eso los adelantó también respecto de la
validación de la solicitud. El arreglo es correcto para lo que pedía y produjo esto de costado.

**Las tres últimas ya estaban en la ronda 1 y no las vi.** Mi barrido comparó los *conjuntos* de códigos por
función y salió «coinciden exactamente», que es cierto y es insuficiente: dos implementaciones pueden levantar
los mismos doce códigos y elegir uno distinto ante las mismas entradas. El barrido no miraba el orden.

Por qué importa y no es un detalle: **las features T-1xx se desarrollan y se prueban contra el fake.** Un
formulario que muestre un mensaje distinto según el código va a comportarse de una forma en las pruebas y de
otra en producción. La skill `contract-change` lo anticipa en su línea 15: *«Dominio y RPC no coinciden: NO gana
nadie por defecto. Lo valida P2 junto con P1»*.

- **Decidido por Lautaro073 (`D05`):** fijar la precedencia canónica —la de la RPC: actor → repartidor →
  parámetros → piso → rate limit → solicitud → duplicada— escrita una sola vez en un comentario de
  `rpc-contracts.ts`, y reordenar `rpc-fake.ts` para que coincida. Entra en `CC-001`, que hay que ampliar.
- `P11-api-publica-inconsistente` · `P05-semantica-invertida-vs-dod`

---

## 3. Mejoras

### `H11` · El fake no implementa rate limiting: `RATE_LIMITED` es inalcanzable ahí

`grep` sobre `src/domain/testing/rpc-fake.ts`: cero ocurrencias de `RATE_LIMITED`, `maxOffersPerMin` y
`rateLimit`. Y `FakePlatformSettings` (`rpc-fake.ts:35-41`) tiene `minOfferArs`, `requestTtlMinutes`,
`pilotActive`, `pilotTermsVersion` y `subscriptionGraceDays` — no `maxOffersPerMin`.

O sea que `RATE_LIMITED` está declarado en el contrato, lo produce la RPC, y una feature desarrollada contra el
fake **no lo puede encontrar nunca** salvo forzándolo con `setForcedError`. Y ahora hay una clave de
`platform_settings` que el fake no conoce, cuando `assertValidFakeOptions` exige explícitamente las otras cinco.

`CC-001` dice *«Fake de dominio a actualizar: **no**»*. Para `INTERNAL_ERROR` y para el
`INVALID_STATE_TRANSITION` que se quitó eso es correcto —el fake ya usaba `OFFER_NOT_PENDING` y nunca produjo
`INTERNAL_ERROR`—. Para el rate limit no: es una capacidad que la RPC tiene y el fake no.

Es la misma familia que ocupó tres rondas en la #58: el fake como sustituto fiel de las RPC.

- **Decidido por Lautaro073 (`D06`):** sumar `maxOffersPerMin` a `FakePlatformSettings` y el contador por
  ventana al fake, dentro de `CC-001`.
- `P11-api-publica-inconsistente`

### `H12` · Numeración duplicada en los comentarios de la suite pgTAP

El encabezado `-- 31-33.` (línea 321) abarca 31, 32 y 33, y más abajo hay un `-- 32.` (línea 335) y un `-- 33.`
(línea 350) propios. Mi barrido de numeración detectó 45 números para un rango `1..43`.

Las 43 aserciones y el `plan(43)` coinciden: es solo el comentario. Pero la numeración de los comentarios es lo
que se usa para leer la salida de pgTAP cuando algo falla, así que conviene que sea única. El primero debería
decir `-- 31.`.

### `H13` · `CC-001` lleva tildada una aprobación de P2

La sección «Aprobaciones» de `docs/contracts/CC-001.md` tiene `[x] P2 (dueña de domain/ui)`, `[x] P1` y
`[x] Lautaro073`. La skill `contract-change` no define ese checklist —es propio del documento—, y P2 no revisa
PRs: el criterio vigente es el que fijaste en la #57 (`PR57-H09`), *«P1 o sea yo acepto todo, los demás no
revisan PR»*.

No cambia nada de lo técnico. Lo anoto porque un casillero firmado por alguien que no participó es exactamente
lo que el campo «Aprobaciones» existe para no tener. Alcanza con dejar una sola línea: quién decidió y cuándo.

---

## 4. Checks

**No ejecutados**, por indicación de Lautaro073. Lo verificado es estático:

| | Resultado |
|---|---|
| Alcance | ✅ 16 archivos, **0 fuera** de la ficha, que se amplió citando `D02`, `D03`, `D01`/`D04` línea por línea |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `security definer` + `search_path` por función | ✅ las tres, y ahora lo exige el test 4 **dentro de cada bloque** |
| Privilegios | ✅ y ahora con control: tres `is_definer` y tres casos `anon` esperando `42501` |
| Códigos por RPC vs contrato | ✅ los tres coinciden (descontando `INTERNAL_ERROR`, que lo produce el wrapper) |
| `plan(43)` vs aserciones | ✅ 43 y 43 |
| `platform_settings` usadas vs sembradas | ✅ las dos claves existen en los dos lados |
| Precedencia de errores RPC vs fake | ❌ ver `H10` |
| `RATE_LIMITED` alcanzable en el fake | ❌ ver `H11` |

**No revisado:** `pnpm typecheck`, `lint`, `test`, `test:coverage`, `test:db` y los ocho jobs de CI. El cuerpo
declara `18 passed (18)` y `160 passed (160)`; el número de casos de `offers.test.ts` sigue siendo 4, así que es
plausible, pero **no lo verifiqué de forma independiente**.

## 5. Veredicto

**CON BLOQUEANTES (1).** No apruebo ni mergeo.

Los nueve hallazgos de la ronda 1 están cerrados, y tres de ellos con más de lo que pedí: el test 4 quedó mejor
que el barrido con el que lo encontré, la conducta aceptada de `H03` quedó documentada con un test que falla si
cambia en vez de con un comentario, y el test 33 —que nadie pidió— es el que realmente prueba que el tope sale de
`platform_settings`.

Lo que queda es de una sola naturaleza: **el fake y la RPC no son el mismo contrato todavía.** Difieren en qué
error gana cuando hay varios problemas a la vez (`H10`) y en que uno de los códigos declarados es inalcanzable en
el fake (`H11`). Las dos tienen decisión tomada y las dos entran por `CC-001`, que ya está abierto.

Y una parte de `H10` la produje yo al pedir `H09`, y otra se me había pasado en la ronda 1 por comparar
conjuntos de códigos en vez de orden. El barrido que uso quedó corregido para las próximas.
