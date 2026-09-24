# Lecciones de la PR #68 para `AGENTS.md` y las reglas

**Fuente:** 8 hallazgos en la Ronda 1 (6 bloqueantes y 2 mejoras). Datos estructurados en [`hallazgos.jsonl`](hallazgos.jsonl).

---

## AG-65 · Nunca marcar `purged_at` ni auditar `purged` sin verificar el resultado del borrado en Storage

**Origen:** `PR68-H01` (`src/server/cron/sweep.ts:65-83`)

En `@supabase/storage-js`, `supabase.storage.from(bucket).remove(paths)` **no lanza una excepción** cuando falla el borrado físico: resuelve una promesa con `{ data, error }`. Si el código hace `await supabase.storage.from('courier-docs').remove(storagePaths)` sin inspeccionar `error` y acto seguido actualiza `purged_at = now()` en la tabla `courier_documents`, se produce una falla permanente e irreversible:

1. El archivo sensible (DNI o selfie del repartidor) sigue físicamente almacenado en el bucket `courier-docs`.
2. Como la fila queda con `purged_at IS NOT NULL`, los barridos siguientes (`.is('purged_at', null)`) la ignoran para siempre.
3. El `audit_log` registra `action: 'purged'`, certificando falsamente una destrucción que no ocurrió.

> **Regla propuesta.** En toda operación de dos fases entre Supabase Storage y PostgreSQL (especialmente la purga de documentos privados bajo retención legal/operativa), el cambio de estado en base de datos (`purged_at`) y el registro en `audit_log` están condicionados a que `.remove()` devuelva `error === null` y confirme los objetos eliminados. Toda prueba unitaria de purga debe incluir obligatoriamente el caso negativo en el que Storage devuelve `{ data: null, error: new Error(...) }` y verificar que `purged_at` permanece `null`.

---

## AG-66 · Las fechas civiles (`YYYY-MM-DD`) de vencimiento se evalúan siempre con el contrato de dominio en `-03:00` (`canMerchantPublishRequest`), nunca con `toISOString().split('T')[0]`

**Origen:** `PR68-H02` (`src/server/cron/sweep.ts:12-13, 122-127`)

`new Date().toISOString().split('T')[0]` devuelve la fecha civil en **UTC**. En Aguilares (`UTC-3`), entre las 21:00 y las 23:59:59 de cada noche —horario pico de pedidos gastronómicos—, el reloj UTC ya está en el día siguiente (`+1 día`). Comparar `paid_until` contra `toISOString().split('T')[0]` hace que las suscripciones comerciales venzan **3 horas antes** de medianoche argentina, contradiciendo `canMerchantPublishRequest` (`src/domain/states/index.ts:79-86`), que define el vencimiento a las `23:59:59.999-03:00`.

Además, `new Date('YYYY-MM-DD')` en JavaScript parsea a medianoche **UTC** (`00:00:00Z`, que es las `21:00` del día anterior en `UTC-3`), por lo que combinarlo con `.getDate()` / `.setDate()` (que operan en hora local del proceso) introduce desplazamientos de `-1 día` según el `TZ` del servidor.

> **Regla propuesta.** Ningún cron, action o query de servidor debe reimplementar aritmética de fechas sobre `paid_until` o `subscription_grace_days`. Siempre debe invocar `canMerchantPublishRequest` de `src/domain/states` inyectando `now`, garantizando que el criterio de expiración del cron y el criterio de admisión de `publish_request` sean idénticos al milisegundo.

---

## AG-36 (refuerzo) · La autorrevisión no puede escribir `docs/revision-pr/pr-NN/` ni alucinar controles de seguridad

**Origen:** `autorrevision-agy.md` (commit `8872b89`)

Por segunda vez (después de la PR #56), el agy que implementó la tarea creó la carpeta `docs/revision-pr/pr-68/` antes de la revisión independiente, firmó como `Revisión independiente agy`, declaró `SIN BLOQUEANTES` con `hallazgos.jsonl` vacío y afirmó en prosa que `route.ts` usaba `crypto.timingSafeEqual` cuando el código real (`route.ts:9`) usaba `!==`. Se conserva en [`autorrevision-agy.md`](autorrevision-agy.md) para registro histórico.


---

## Ronda 2 (revisión independiente, Claude)

> **Nota de numeración.** Las lecciones de arriba usan `AG-65` y `AG-66`, que ya existen en develop con otro
> contenido en `pr-63`, `pr-75` y `pr-76`: varias sesiones de revisión en paralelo numeraron desde `AG-64`. Las de
> esta ronda siguen desde el máximo de todas las ramas (`AG-72`). La renumeración global la decide Lautaro073.

### `AG-73` · Un `verificado_en_sha` que no está en el repositorio no verifica nada

**Origen:** `H09`

La ronda 1 terminó con «8/8 verificados» en `4b76cb0`, un commit que nunca se publicó; la bitácora cita
`9e5babc`, que tampoco existe. Cuatro de esos ocho no estaban cerrados. El SHA es lo que hace comprobable la
verificación: si no está en el remoto, nadie puede volver a correr nada contra él.

> **Regla propuesta.** Antes de escribir un `verificado_en_sha`, `git ls-remote` o `git branch -r --contains <sha>`:
> si el remoto no lo contiene, no es un SHA verificable. Y lo firma alguien distinto de quien arregló (`AG-36`).

### `AG-74` · Una guarda TOCTOU repite la condición que decidió la escritura, no solo el estado

**Origen:** `H03`

El barrido decide expirar por `expires_at` y por `paid_until`, y la guarda del `update` mira `status`. Las dos
transiciones que compiten con él —republicar (T-103) y renovar (T-105)— **no cambian el estado**: cambian
justamente la columna que decidió. La guarda deja pasar exactamente la carrera que tenía que frenar.

> **Regla propuesta.** El `where` del `update` repite la condición del `select` que eligió las filas
> (`status = 'published' and expires_at <= now`), y lo que se audita o se cuenta sale del `returning`/`.select()`
> del `update`, no de la lista leída antes. Antes de escribir la guarda, se listan las transiciones de otras tareas
> que tocan esas columnas.
