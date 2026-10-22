# PR #62 · T-101 — Ronda 3

- **PR:** [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop`
- **Tarea:** `T-101` · Issue #11
- **SHA revisado:** `35ce99d` (fase roja de `H10` en `2d1e9fa`)
- **Fecha:** 2026-09-23
- **Resultado: SIN BLOQUEANTES.** Tres hallazgos bajos abiertos, ninguno de comportamiento.

> **Alcance:** las tres rondas fueron estáticas, por indicación de Lautaro073: **no corrí suites ni consulté el
> estado de CI en ningún momento**. El veredicto es sobre el código; el estado de los ocho jobs lo confirmás vos.

---

## 1. El bloqueante de la ronda 2, cerrado

### `H10` · La precedencia ahora coincide en las tres piezas

Extraje mecánicamente el orden de rechazo de `submit_offer` de las dos implementaciones y lo comparé contra la
precedencia documentada:

**Documentada** (`rpc-contracts.ts`, comentario nuevo arriba de `submit_offer`):

```
1. Actor y rol          UNAUTHENTICATED → UNAUTHORIZED_ACTOR
2. Repartidor           NOT_FOUND → COURIER_SUSPENDED → COURIER_NOT_APPROVED → COURIER_UNAVAILABLE
3. Parámetros           VALIDATION_ERROR
4. Piso                 OFFER_BELOW_MINIMUM
5. Tope por ventana     RATE_LIMITED
6. Solicitud            NOT_FOUND → REQUEST_EXPIRED → INVALID_STATE_TRANSITION
7. Duplicada            DUPLICATE_ACTIVE_OFFER
```

**SQL**, `raise` en orden de aparición:

```
UNAUTHENTICATED → UNAUTHORIZED_ACTOR → NOT_FOUND → COURIER_SUSPENDED → COURIER_NOT_APPROVED →
COURIER_UNAVAILABLE → VALIDATION_ERROR ×4 → OFFER_BELOW_MINIMUM → RATE_LIMITED →
NOT_FOUND → REQUEST_EXPIRED → INVALID_STATE_TRANSITION → DUPLICATE_ACTIVE_OFFER
```

**Fake**: el chequeo de repartidor se movió a un pre-paso de `executeRpc` —**antes** del
`inputSchema.safeParse`, que es lo que hacía falta para respetar el paso 2 sobre el 3— y el handler quedó
`piso → rate → solicitud → duplicada`.

Secuencia clave `piso → rate → solicitud`: **OK en las dos, y coinciden**.

Las seis combinaciones de doble falla que reporté en la ronda 2 están ahora en una tabla de casos
(`offers.test.ts:504`), y se demostraron en rojo primero, en su propio commit `2d1e9fa`:

```
AssertionError: Monto bajo el piso + solicitud inexistente -> OFFER_BELOW_MINIMUM:
  expected { ok: false, code: 'NOT_FOUND' } to deeply equal { ok: false, code: 'OFFER_BELOW_MINIMUM' }
```

**Tercera ronda seguida con demostración en rojo en un commit propio antes del arreglo.** `f66b773` para la
fase roja original, `b0e969b` para `H03`, `2d1e9fa` para `H10`.

---

## 2. Las mejoras de la ronda 2, cerradas

### `H11` · El fake ya tiene rate limit por ventana

`FakePlatformSettings` suma `readonly maxOffersPerMin: number`, `assertValidFakeOptions` lo exige como a los
otros cinco, y `createFakeRpcClient` implementa un `Map` de cubetas por minuto con
`getWindowBucketKey` / `getWindowRateCount` / `incrementWindowRateCount`, usado en `submit_offer` y en
`withdraw_offer`. `RATE_LIMITED` es alcanzable sin `setForcedError`.

**Y es semánticamente equivalente al SQL, que era lo difícil.** El SQL incrementa primero y revierte si algo
falla después (`D01`); el fake consulta sin incrementar y **solo incrementa en el camino de éxito**. Recorrí los
casos y dan lo mismo:

| Situación | SQL | Fake |
|---|---|---|
| N éxitos en la ventana, con N < max | incrementa a N+1, pasa | consulta N+1 ≤ max, pasa, incrementa |
| En el tope, llamada válida | incrementa, `>max` → `RATE_LIMITED`, revierte | `>max` → `RATE_LIMITED`, no incrementa |
| Llamada que falla después del contador | incrementa y revierte | nunca incrementa |

El resultado observable es idéntico: **exactamente `max` ofertas exitosas por ventana, y los intentos fallidos no
consumen cuota.** El fake lo hace explícito donde el SQL lo obtiene de la semántica transaccional, que para un
fake es lo correcto: no puede depender de un rollback que no existe.

El test añade algo que no pedí: después de agotar la ventana y comprobar `RATE_LIMITED` sobre una solicitud
vencida, **avanza el reloj un minuto** y la misma llamada devuelve `REQUEST_EXPIRED`. Eso prueba dos cosas de
una: que la cubeta es por minuto y no un contador perpetuo, y la precedencia desde el otro lado.

`domain.test.ts` sumó `maxOffersPerMin` a `BASE_SETTINGS` **y** un caso negativo (`maxOffersPerMin: 0` lanza),
o sea que la validación nueva de `assertValidFakeOptions` tiene su propio control.

### `H12` · Numeración corregida

`-- 31-33.` → `-- 31.`. El barrido ahora da `1..43 (43 números)`, sin duplicados, contra `plan(43)` y 43
aserciones reales.

### `H13` · Aprobaciones de `CC-001`

Las tres casillas se reemplazaron por una línea: *«Decidido y aprobado por `@Lautaro073` (P1) el 2026-09-23
(`D02`, `D03`, `D05`, `D06` en PR #62)»*. Es exactamente lo que el campo tiene que decir.

`CC-001` además se amplió con `D05` y `D06`: título, contrato afectado, «Actual», «Propuesto», «Motivo» e
«Impacto», y la línea de impacto pasó de *«Fake de dominio a actualizar: no»* a *«sí»*, que era lo que había
quedado mal en la ronda 2.

---

## 3. Lo que queda: tres hallazgos bajos

### `H14` · El handler del fake repite el chequeo de repartidor que `executeRpc` ya hace

Para respetar el paso 2 antes del 3, el chequeo de repartidor y elegibilidad se movió a un pre-paso dentro de
`executeRpc` (`rpc-fake.ts:377-390`). Pero el handler de `submit_offer` (`:541-552`) **lo repite**:

```ts
const courier = couriers.get(actor.userId);
if (!courier) return err('NOT_FOUND');
const eligibility = canCourierSubmitOffer({ status: courier.status, available: courier.available });
if (!eligibility.ok) return err(eligibility.code as RpcErrorCode<'submit_offer'>);
```

Si el pre-paso falla, `executeRpc` devuelve antes de llamar al handler. O sea que **las dos guardas del handler
son inalcanzables**.

Importa un poco más de lo que parece por dónde vive: `src/domain/**` tiene umbral de cobertura de 90 % de ramas
por archivo desde T-006, y dos ramas permanentemente no tomadas se comen presupuesto. No sé si hoy pasa el
umbral —no corrí cobertura— pero conviene sacarlas igual: el `courier` que el handler necesita se puede leer sin
volver a validarlo.

- `P08-control-no-cubre-lo-que-dice`

### `H15` · La precedencia canónica está documentada solo para `submit_offer`

El comentario de `rpc-contracts.ts` cubre `submit_offer`, que era el caso que produjo `H10`. Pero
`withdraw_offer` y `set_availability` también tienen un orden compartido entre las dos implementaciones, y lo
verifiqué en esta ronda:

| | SQL | Fake |
|---|---|---|
| `withdraw_offer` | params → oferta `NOT_FOUND` → titularidad → `OFFER_NOT_PENDING` → **rate** | igual |
| `set_availability` | params `VALIDATION_ERROR` → repartidor `NOT_FOUND` → estado | igual |

Coinciden hoy. Lo que no existe es el registro: en `withdraw_offer` el rate limit va **después** del estado de la
oferta, al revés que en `submit_offer`, y eso no está escrito en ningún lado. Es la misma forma de `H10` esperando
a repetirse en la próxima tarea que toque una de las dos.

- **Qué hacer:** dos comentarios más, del mismo estilo, arriba de `withdraw_offer` y `set_availability`.
- `P20-justificacion-de-seguridad-no-escrita`

### `H16` · La bitácora dice `note` donde el campo es `message`

En el paso 3 de la precedencia, la entrada de la bitácora enumera *«`VALIDATION_ERROR` (`requestId`,
`amountArs`, `etaMinutes`, `note`)»*. El campo de `submitOfferInputSchema` es `message`
(`rpc-contracts.ts:72`), y así lo llama la RPC (`p_message`) y el wrapper.

Cosmético, y es el mismo tipo de desliz que `createRpcFake` en la ronda 1: un nombre que no existe en un
documento que se lee para entender el contrato.

- `P03-comentario-contradice-codigo`

---

## 4. Checks

**No ejecutados ni consultados**, las tres rondas. Lo verificado es estático:

| | Resultado |
|---|---|
| Alcance | ✅ 19 archivos, **0 fuera**; cada línea nueva de la ficha cita la decisión que la autoriza |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `security definer` + `search_path` por función | ✅ las tres, exigido por el test 4 dentro de cada bloque |
| Privilegios | ✅ `revoke all` + `grant execute to authenticated`, con `is_definer` ×3 y `anon → 42501` ×3 |
| Códigos por RPC vs contrato | ✅ los tres, en los dos sentidos |
| **Precedencia SQL vs fake vs documentada** | ✅ **las tres coinciden** |
| `RATE_LIMITED` alcanzable en el fake | ✅ con contador por ventana equivalente al SQL |
| `plan(43)` vs aserciones vs numeración | ✅ 43 · 43 · `1..43` sin duplicados |
| `platform_settings` usadas vs sembradas | ✅ las dos claves, en la migración y en `seed.sql` |
| Literales en la migración | ✅ solo `eta_minutes > 240` y `char_length > 280`, los dos del contrato |

**No revisado:** `pnpm typecheck`, `lint`, `test`, `test:coverage`, `test:db` y los ocho jobs de CI. El cuerpo del
PR declara sus números; **no los verifiqué de forma independiente en ninguna ronda.**

## 5. Veredicto

**SIN BLOQUEANTES. Lista para aceptar**, con `H14`, `H15` y `H16` anotados.

Los dos bloqueantes de la ronda 1 y el de la ronda 2 están cerrados, y las seis decisiones aplicadas y trazadas.
Lo que más vale de esta PR, mirando las tres rondas juntas:

- **La implementación SQL casi no se tocó en tres rondas.** `security definer` con `search_path` fijo, privilegios
  revocados y regrantados, upsert atómico sobre la PK, piso desde `platform_settings`. Lo que cambió fue el
  contorno: una clave de configuración que faltaba, un contrato que no distinguía un error del usuario de una
  caída de la base, y un fake que no era el mismo contrato que la RPC.
- **Tres rondas, tres demostraciones en rojo en commits propios** antes de cada arreglo de fondo. Es el único
  método que distingue «hay una prueba» de «hay un control», y acá se usó sin que hiciera falta pedirlo dos veces.
- **Dos arreglos quedaron mejores que lo que pedí:** el test 4, que codifica una regla que mi propio barrido no
  tiene (excluir `INTERNAL_ERROR` porque lo produce el wrapper), y el test 5, que agrega el avance de reloj para
  probar que la ventana se renueva.

Y una parte de esto la causé yo: el reorden de `H09` ensanchó la divergencia de precedencia, y la parte vieja se
me había pasado en la ronda 1 por comparar conjuntos de códigos en vez de orden. Quedó como `AG-59` y el barrido
está corregido.

**No apruebo ni mergeo.** Y con una salvedad que vale para el merge: **esta revisión nunca miró CI**. Si los ocho
jobs están en verde, la decisión es tuya.
