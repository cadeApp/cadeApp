# PR #68 · T-104 — Ronda 2

- **PR:** [#68](https://github.com/cadeApp/cadeApp/pull/68) · `feat/T-104-cron-sweep` → `develop`
- **Tarea:** `T-104` · Issue #14 · ficha leída desde `origin/develop`
- **SHA revisado:** `430ada3` · merge-base `3faf0aa`; develop ya está en `720e2d4` (sin conflicto: `mergeable_state: clean`)
- **Fecha:** 2026-09-24
- **Revisión:** independiente (Claude, sesión en la nube). No es la sesión que implementó ni la que escribió la ronda 1.
- **Resultado: CON BLOQUEANTES (4) + 2 decisiones ya resueltas por Lautaro073.** De los 8 hallazgos de la ronda 1, **4 cerrados y verificados**, 4 parciales.

> **Método:** sin base local (a pedido de Lautaro073, para gastar menos): este código es TypeScript contra
> supabase-js y sus pruebas son unitarias con mocks, así que alcanza Vitest. Corrí 15 mutaciones sobre `sweep.ts` y
> `route.ts` contra las 11 pruebas de `src/server/cron` y `src/app/api`, restaurando los archivos desde memoria.
> Leí la ficha, el ADR-0002, la migración de T-105 y el código de T-103 para las interacciones. CI no se leyó por
> dentro: la ronda tiene bloqueantes. Evidencia en [`evidencia/comandos.md`](../evidencia/comandos.md#ronda-2-sobre-430ada3).

---

## Lo primero: la ronda 1 dice «8/8 verificados» sobre un commit que no existe

`hallazgos.jsonl` y el `README.md` de esta carpeta, en `50ce7dd`, marcan los 8 hallazgos como
`arreglado-verificado` con `verificado_en_sha: 4b76cb0`. **Ese commit no existe** en ninguna rama ni en el repo
(`git cat-file -t 4b76cb0` → no existe). Tampoco existe `9e5babc`, que la bitácora cita como «Último commit». El
arreglo publicado es `dfb954e`. Y los `verificado_metodo` son lecturas («Verificado en sweep.ts:74
desestructurando…»), no ejecuciones.

`50ce7dd` lo commiteó la misma cuenta que arregló (`dfb954e`), 18 minutos después. Es `AG-36` tal cual:
**quien arregla no firma la verificación**. Por eso esta ronda re-verifica los ocho desde cero. Cuatro no estaban
cerrados.

---

## Lo que se cerró, verificado en `430ada3`

| ID | Cómo lo verifiqué |
|---|---|
| `H02` | la mutación que corre el reloj 3 h (X13) y la que ignora la gracia (X14) ponen roja una prueba cada una; `runSweep` delega en `canMerchantPublishRequest` |
| `H04` | `runtime = 'nodejs'`, `timingSafeEqual` con chequeo de largo; sacar el chequeo de largo (X10) o volver a exponer el detalle en el 500 (X11) pone rojo un test |
| `H06` | `prettier --check` limpio en los 6 archivos; DoD tildado; `approval-policy` en `success` en las dos corridas posteriores al último cambio del cuerpo |
| `H07` | `target_type` en singular y `before` poblado, afirmados con `objectContaining` en la prueba principal |

---

## Bloqueantes

### 1. `H01` · parcial: si Storage falla, el barrido responde 200 y nadie se entera · **BLOQUEANTE**

El arreglo hizo bien la mitad: si `remove()` devuelve error, no marca `purged_at` ni audita, así que el próximo
barrido reintenta. Pero **no avisa**: `sweep.ts:91` es un `if (!storageError) { … }` sin `else`, `runSweep()`
devuelve `purgedDocsCount: 0` y la ruta responde **200 `ok: true`**. La prueba nueva (`sweep.test.ts:205`)
fija exactamente ese silencio: afirma que `runSweep()` resuelve.

Con Storage caído o sin permisos, los DNI y selfies quedan en el bucket día tras día más allá del plazo de `D8`, y
el cron dice «ok» todas las noches. La ronda 1 pedía *«propagar el error»*.

- **Qué hacer:** conservar el reintento (no marcar ni auditar) y además **terminar en error**: por ejemplo,
  seguir con los pasos 3 y 1 y al final lanzar si hubo falla de Storage, para que la ruta devuelva 500 y el cron
  de Vercel lo registre como fallido. La prueba de `:205` pasa a esperar el rechazo. Demostrarlo con X07.
- `P08-control-no-cubre-lo-que-dice` · origen `agente`

### 2. `H03` · parcial: las guardas TOCTOU miran la columna equivocada · **BLOQUEANTE**

Se agregaron guardas por estado, pero las dos carreras que importan **no cambian el estado**:

| Carrera | Qué pasa hoy |
|---|---|
| El barrido lee una solicitud `published` vencida → **el comercio la republica** (T-103, `H02`: `published` vencida → `published` con `expires_at` nuevo) → el `update` del barrido filtra `status = 'published'` | **expira la solicitud recién republicada** y, con `.in('request_id', …)`, también las ofertas `pending` que llegaron después de republicar |
| El barrido lee un comercio `active` vencido → **el admin lo renueva** (`admin_set_subscription`, `rpc_admin_v1.sql:302-306`: deja `active` con `paid_until` nuevo) → el `update` filtra `subscription_status = 'active'` | **expira al comercio recién renovado** |

Y en los tres pasos, **la auditoría y los contadores salen del `select`, no de las filas que el `update` cambió
de verdad**: si la guarda descarta una fila, igual se audita como expirada. La ronda 1 pedía agregar `.select()` a
los `update`.

- **Qué hacer:** que la guarda repita **la condición de vencimiento**, no solo el estado:
  `.eq('status', 'published').lte('expires_at', nowIso)` en solicitudes; en comercios, la misma fecha de corte
  que decide `canMerchantPublishRequest` (`paid_until` < corte, o un `update` por fila con `.eq('paid_until', …)`).
  Encadenar `.select('id')` / `.select('profile_id')` y **usar lo que devuelve** para las ofertas, la auditoría y
  el contador.
- **Cómo demostrarlo:** con el mock, que el `update` devuelva menos filas que el `select` y afirmar que ni las
  ofertas, ni el `audit_log`, ni el contador incluyen la fila descartada.
- `P08-control-no-cubre-lo-que-dice` · origen `ambos`: las dos carreras nacen de transiciones de T-103 y T-105 que
  esta PR no podía ver cuando se escribió.

### 3. `H05` · parcial: 7 de 12 mutaciones siguen ciegas · **BLOQUEANTE**

La ronda 1 decía *«los mocks no verifican los argumentos de `.update()`»*. Sigue siendo cierto:

| Mutación | Resultado (11 pruebas) |
|---|---|
| X02 solicitudes a `cancelled` en vez de `expired` | **verde** |
| X03 ofertas a `withdrawn` en vez de `expired` | **verde** |
| X04 ofertas de ninguna solicitud (`.in('request_id', [])`) | **verde** |
| X05 `purged_at = null` (el documento se «purgaría» todos los días) | **verde** |
| X06 comercios a `cancelled` en vez de `expired` | **verde** |
| X08 gracia por defecto 30 días si falta el setting | **verde** |
| X09 comercios de nadie (`.in('profile_id', [])`) | **verde** |
| X01, X07, X10, X11, X12, X13, X14 | rojas ✓ |

Las pruebas afirman **qué guardas** se usaron y **qué se auditó**, pero no **qué se escribió ni sobre qué filas**,
que es el efecto del barrido.

- **Qué hacer:** afirmar el payload de cada `.update()` y los ids de cada `.in()`, y una prueba para el setting de
  gracia ausente. Cada una, demostrada con su mutación de la tabla.
- `P04-test-tautologico` · origen `agente`

### 4. `H09` · La verificación registrada, la bitácora y el cuerpo afirman cosas que no son · **BLOQUEANTE** · nuevo

- `verificado_en_sha: 4b76cb0` y «Último commit: `9e5babc`»: **no existen** (ver arriba).
- El cuerpo dice *«Consolidación y expiración **atómica**»*: son siete escrituras sueltas sin transacción (`D02`).
- La bitácora dice que ante cualquier error *«se falla de forma visible (500)»*: Storage falla con 200 (`H01`).
- *«Cobertura completa»* (`H05`): 7 de 12 mutaciones ciegas.
- *«Sustitución del doble cast `as unknown as`»* (`H08`): quedan 7.
- **Qué hacer:** corregir la bitácora y el cuerpo contra el código. La carpeta de revisión la corrige esta ronda
  (ya no dice «APTO»).
- `P03-comentario-contradice-codigo` · origen `agente`

---

## Decisiones — resueltas por Lautaro073 en esta ronda

### `D01` · `vercel.json`: el barrido nunca se programa · **DECIDIDO → sumarlo a T-104**

ADR-0002 lo dice dos veces: `vercel.json` *«a crear en `T-104`»* (`:29`) y *«en Vercel Pro se configura en
`vercel.json` (`T-104`)»* (`:90`). La ficha no lo tiene en «Archivos permitidos» y la PR no lo crea: **tal como
está, `/api/cron/sweep` existe pero nadie lo llama**.

**Decidido:** agregar `vercel.json` a «Archivos permitidos» de `docs/tasks/T-104.md` (citando esta decisión) y
crear el cron en esta PR, una vez por día (Hobby). Bloquea el merge.

### `D02` · Escrituras sin transacción: un fallo deja huecos en la auditoría · **DECIDIDO → reordenar en TS**

Si falla el `insert` en `audit_log` después de marcar `purged_at` o `expired`, la próxima corrida ya no ve esas
filas: queda **una purga de DNI o una expiración sin auditar para siempre**. La atomicidad real exige una función
SQL, que hoy queda fuera de la ficha.

**Decidido:** reordenar dentro de TypeScript para que un fallo deje **un duplicado y no un hueco**. En la purga:
`remove` → `audit_log` → `purged_at`; si falla la marca, el reintento vuelve a borrar (idempotente) y vuelve a
auditar. Lo mismo en los otros dos pasos, en la medida en que se pueda. Y sacar «atómica» del cuerpo. Bloquea el
merge.

---

## Mejoras

- **`H08` · parcial:** quedan 7 `as unknown as` (6 en `sweep.test.ts`, 1 en `route.test.ts`), todos en los mocks de
  `storage`. Extender el helper tipado a `storage`. `bajo`.
- **`H10` · Setting de gracia ausente: el barrido asume 0 y la RPC falla cerrada.** `sweep.ts:134` cae a
  `graceDays = 0` si falta la fila o no se puede parsear; `app_private.request_setting_int` de T-103 levanta
  `INTERNAL_ERROR` en el mismo caso. ADR-0002 §3.1 sanciona el `coalesce(…, 0)`, así que no es un error, pero las
  consecuencias son distintas: la RPC rechaza una publicación; el barrido **escribe `expired`** en comercios que
  estaban en su período de gracia, y eso hay que revertirlo a mano. Conviene que falle igual que la RPC, o por lo
  menos que tenga una prueba (hoy X08 es ciega). `P11` · `bajo`.

## Aviso para T-203 (push)

ADR-0002 §3.1 pide que el barrido *«dispare el aviso push best-effort al comercio dueño»* al expirar una
solicitud. No es de esta PR: el emisor de push es T-203 y todavía no existe. Queda anotado para que T-203 lo
conecte a este barrido.

## Lo que está bien, con precisión

- **El reintento de la purga está bien pensado:** no marcar ni auditar si Storage falla es lo que hace idempotente
  el barrido. Falta que además avise (`H01`).
- **`H02` quedó mejor que lo pedido:** en vez de arreglar la fecha a mano, delega en `canMerchantPublishRequest`,
  así el barrido y el dominio no pueden divergir. Las dos pruebas de frontera (22:30 −03:00 y gracia) matan sus
  mutaciones.
- **La ruta es correcta:** tiempo constante, 401 sin cabecera y con cabecera de otro largo, 500 sin detalle, runtime
  `nodejs`.
- **El cliente admin está tipado con `Database`:** typecheck valida los nombres de tablas y columnas de cada
  `update` e `insert`, que es lo único que protege el contrato con la base, porque ninguna prueba corre este
  código contra Postgres.

## Checks

| | Alcance | Resultado |
|---|---|---|
| Vitest `src/server/cron` + `src/app/api` | local, `430ada3` | 11/11 |
| Mutación de `sweep.ts` y `route.ts` | 15 contra 11 pruebas | 8 rojas · 7 ciegas · control verde |
| `prettier --check` | 6 archivos de la PR | limpio |
| Alcance | 14 archivos | 0 fuera de «Archivos permitidos»; la ficha solo cambia líneas en blanco y tildes del DoD |
| CI | `430ada3` | 11 check runs en `success` (una corrida vieja de `approval-policy` falló antes del último cambio del cuerpo); **no leído por dentro**, por método |

## Qué hay que hacer

1. `D01`: `vercel.json` en la ficha y creado (cron diario).
2. `D02`: reordenar las escrituras (duplicado, no hueco) y sacar «atómica» del cuerpo.
3. `H01`: la falla de Storage termina en error (500), conservando el reintento.
4. `H03`: guardas con la condición de vencimiento y `.select()` usado para ofertas, auditoría y contadores.
5. `H05`: afirmar payloads e ids de cada `update`, y el setting ausente. Cada prueba, con su mutación en rojo.
6. `H09`: bitácora y cuerpo contra el código.
7. `H08`, `H10` si entran.

Las 15 mutaciones están en la evidencia, listas para volver a correr en la ronda 3.
