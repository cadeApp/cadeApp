# PR #64 · T-102 — Ronda 2

- **PR:** [#64](https://github.com/cadeApp/cadeApp/pull/64) · `feat/T-102-rpc-accept-offer` → `develop`
- **SHA revisado:** `570473d` · sobre `4efca15`
- **Fecha:** 2026-09-23
- **Resultado: SIN BLOQUEANTES.** Los seis hallazgos y las dos decisiones, cerrados. **8 de 8, ninguno abierto.**

> Primera ronda en la que miro CI, según el método: la ronda cerró sin bloqueantes, así que leí los ocho jobs
> por dentro sobre `570473d`.

---

## 1. `H01` · El control de locks, cerrado — y con una vuelta de más

Los tres regex quedaron anclados a su propia sentencia y se agregó el orden por índice:

```ts
const reqLockRegex     = /from\s+public\.delivery_requests\s+dr[^;]*?for\s+update\s*;/i;
const offerLockRegex   = /from\s+public\.offers\s+o[^;]*?for\s+update\s*;/i;
const courierLockRegex = /from\s+public\.couriers\s+c[^;]*?for\s+share\s*;/i;
...
expect(reqLockIndex).toBeLessThan(offerLockIndex);
expect(offerLockIndex).toBeLessThan(courierLockIndex);
```

`[^;]*?` no puede cruzar el separador de sentencias, así que la lectura **sin** lock de `offers` del paso 3 ya no
sirve para satisfacer la aserción del lock.

**Y hay algo que no pedí:** las mutaciones `M1` y `M2` quedaron **encodeadas dentro del propio test** como
aserción permanente. Eso convierte un acto de revisión en un control que vive.

Corrí la batería sobre el cuerpo real y cinco mutaciones:

| | ronda 1 | ronda 2 |
|---|---|---|
| A · cuerpo real | verde | **verde** |
| B · sin el `for update` de `offers` | verde | **rojo** |
| C · sin el `for update` de `delivery_requests` | verde | **rojo** |
| D · orden de locks invertido | verde | **rojo** |
| E · **regex aflojado al comodín viejo `[\s\S]*?`** | — | **rojo** |
| F · `update … 'expired'` de vuelta | verde | **rojo** |

El caso **E** es el que importa y es el que decide si las mutaciones embebidas son de verdad o son adorno: si
alguien afloja los regex al comodín de la ronda 1, **las propias aserciones `M1` y `M2` se ponen rojas**, porque
con el comodín la mutación deja de ser específica y el `not.toMatch` falla. **No son tautológicas: el control
detecta su propia degradación.** Es mejor que lo que pedí, y vale como lección propia (`AG-63`).

## 2. `H02` · El DoD, reformulado en los dos lados

El ítem quedó igual en `docs/tasks/T-102.md` y en `docs/implementation-plan.md`, y las descripciones de
`rpc_accept.sql` y del test 6 dejaron de decir «concurrentes». El texto nuevo:

> «Competencia de 10 ofertas → una sola ganadora y 9 `ALREADY_MATCHED` (serialización por locks `FOR UPDATE` en
> `delivery_requests` → `offers` y `FOR SHARE` en `couriers` **verificada en la migración**); idempotencia
> preservando `matchedAt`; repartidor suspendido entre la oferta y la aceptación»

Hace exactamente lo que pedía `AG-62`: dice lo que las pruebas demuestran, y **sustituye el invariante que no se
puede ejercer por el control estructural sobre el mecanismo que lo garantiza** — que es el de `H01`, y que quedó
mutado. Las dos mitades cierran juntas.

## 3. `H03` · La escritura muerta, y una respuesta mejor que borrarla

El `update` se fue. El comentario nuevo:

```sql
-- Sin UPDATE: RAISE EXCEPTION aborta la transacción y revertiría cualquier escritura (igual que submit_offer
-- en T-101; la transición persistente a 'expired' la realiza el cron de barrido de T-104).
```

Tres cosas en dos líneas: por qué no se escribe, cuál es el precedente, y **dónde vive de verdad el
comportamiento**. Eso último no lo pedí y es lo que evita que alguien lo vuelva a agregar dentro de seis meses.

**Verifiqué la afirmación en vez de aceptarla:** `docs/tasks/T-104.md` existe en `origin/develop` y su objetivo es
literalmente *«`/api/cron/sweep` (expiraciones, purga de documentos, suscripciones vencidas)»*. El comentario no
inventa una tarea.

El paso 6 quedó corregido en los tres lugares que lo afirmaban mal —`CC-003`, el comentario de `rpc-contracts.ts`
y el cuerpo de la PR— y se sumó un control negativo permanente:

```ts
expect(body).not.toMatch(/set\s+status\s*=\s*'expired'/i);
```

que mi mutación **F** pone en rojo. El barrido de «escritura antes de un `raise` en el mismo bloque» ya no
devuelve nada.

## 4. `H04`, `H05` y `H06`

- **`H04`** · Título y `Aprobaciones` de `CC-003.md`, más las cuatro citas en código y tests. Barrido de `CC-002`:
  las dos ocurrencias que quedan están en `domain.test.ts` y son al **`CC-002` real**, el del ciclo de solicitudes
  de la #66 — correctas.
- **`H05`** · Cuatro líneas de comentario que dicen exactamente lo que el hallazgo pedía: que el SQL captura
  `unique_violation` y levanta `P0001`, y que la rama existe por si el índice llegara a aflorar directo.
- **`H06`** · Las justificaciones volvieron, y **con más precisión que en T-101**: distingue lo heredado
  («heredado de T-101 `D02`») de lo que autoriza esta tarea («contract-change `CC-003`»). Verifiqué otra vez que
  la lista no amplíe el alcance: sigue coincidiendo con la de T-101 más `rpc_accept.sql`.

---

## 5. Algo que parecía discrepancia y no lo es

El cuerpo declara `Test Files 18 passed (18)` y `192 passed`, y CI sobre `570473d` da **21** y **206**. Como este
commit no agregó ningún archivo de prueba, lo perseguí: CI corre sobre el **merge de la PR con develop**, y
develop avanzó con `7f2b336 [T-111] Alta de comercio (#61)`, que suma exactamente tres archivos de test
(`merchants/actions`, `queries`, `schemas`). Lo confirmé leyendo el run de CI sobre `071ba95`, que decía 18.

Los números del cuerpo eran correctos para la rama en ese momento. **No es hallazgo.**

## 6. Checks — leídos por dentro

**8/8 en verde sobre `570473d`**, `mergeState=CLEAN`.

| | |
|---|---|
| `unit` | `Test Files 21 passed (21)` · `Tests 206 passed (206)` |
| cobertura | `offers.ts` **100/100/100/100** · `rpc-contracts.ts` **100** en todo · `rpc-fake.ts` ramas `93.15 %` sobre umbral `90 %` `perFile` |
| `db-tests` | `Files=5, Tests=175` · `All tests successful.` · `Result: PASS` · los cinco archivos en `ok` |
| **cruce independiente de pgTAP** | `plan(2)+plan(55)+plan(34)+plan(43)+plan(41) = 175` = lo que reporta CI, o sea que las **34 aserciones de `rpc_accept.sql` corrieron y el plan cerró** |
| Alcance | ✅ 9 archivos, 0 fuera |
| Construcciones prohibidas | ✅ ninguna |
| Barrido de contrato | ✅ sin regresión: 10 códigos levantados ⊂ 11 declarados, solo sobra `INTERNAL_ERROR` |
| Precedencia de 8 pasos | ✅ sigue coincidiendo en las tres piezas |
| `plan(34)` vs aserciones vs numeración | ✅ 34 · 34 · `1..34` |

## 7. Una observación y una opcional

- **No hubo fase roja en commit propio esta vez.** Se cortó una racha de cuatro. Era posible —el control negativo
  de `H03` habría fallado antes de sacar el `update`—, pero en descargo: encodear la mutación como aserción
  permanente vale más que una demostración en rojo de una sola vez. Lo anoto para que la racha no se pierda por
  inercia, no como reproche.
- **Opcional, no es hallazgo:** al test 13 de pgTAP se le podría sumar el gemelo en runtime del control estático
  nuevo — después del `REQUEST_EXPIRED`, afirmar que la solicitud sigue en `published`. Hoy el texto del SQL está
  protegido; el comportamiento, no.

## 8. Veredicto

**SIN BLOQUEANTES. Lista para aceptar.** 8 de 8 cerrados, todos con SHA de verificación.

Dos rondas. Lo que cambió no fue el diseño —que estaba bien desde el principio: serialización por lock de fila,
idempotencia con `matchedAt`, cascada en una transacción, y un cierre de `PR56-H21` más restrictivo que el que
pedía la ficha— sino que los controles pasaran a medir lo que dicen medir. El invariante que le da nombre a la
tarea tenía tres piezas que decían cubrirlo y ninguna lo hacía; ahora tiene un control estructural que además
detecta si lo debilitan.

**No apruebo ni mergeo.**
