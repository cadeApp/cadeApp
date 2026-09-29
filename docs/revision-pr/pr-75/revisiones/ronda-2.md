# PR #75 · T-105 · Ronda 2

**SHA revisado:** `b257f1b` («fix(admin): resolve Ronda 1 review findings H01-H11 and D01-D04»), sobre `bd2fdda` (carpeta de la ronda 1). La base sigue siendo `b6b5f39`.
**Fecha:** 2026-09-24 · **Revisión independiente.**
**Alcance de la ronda:** estática + corridas locales. Base local levantada desde cero (`supabase stop --no-backup` y `start`), así que la migración nueva se aplicó entera; `pnpm supabase test db`; re-corrida de las sondas 1 y 2; sondas nuevas 3 y 4; batería de mutaciones con controles positivos; Vitest con mutaciones sobre el wrapper; `pnpm db:types --local`; `typecheck`, `lint` y `test`. **CI de GitHub no mirado**, porque sigue habiendo bloqueantes.

## Chequeos de arranque

1. **Rama:** `origin/feat/T-105-admin-rpc` = `b257f1b`, un solo commit nuevo. La bitácora cierra con «Último commit: por generar» y «Falta: push», y ese push es `b257f1b`. No hay trabajo mencionado que no esté en la rama.
2. **Comentarios:** solo el mío de la ronda 1.
3. **Bitácora:** declara «test:db ✅ (36 assertions pgTAP)». Ver `H04`.

## Alcance

Siete archivos, todos dentro de «Archivos permitidos» **una vez ampliada la ficha**. La PR modifica `docs/tasks/T-105.md`. Lo comparé mecánicamente contra `origin/develop`: son **+2 líneas, exactamente los dos archivos de `D01`**, y no cambia nada más. No amplía el alcance más allá de lo decidido. La decisión decía que la ficha se editaba en develop y se hizo en la rama: queda anotado, pero no cambia nada de fondo.

## Resultado: CON BLOQUEANTES (4)

**La migración quedó bien.** Las cinco RPC funcionan en la base local, con todo lo que se pidió: los tres arreglos de ejecución, auditoría en las cinco, D03, D04 y permisos. Lo que sigue roto es **la evidencia**: la suite de base otra vez no corre, y los tipos se escribieron a mano.

### Qué se cerró (verificado en `b257f1b`)

| ID | Cómo lo comprobé |
|---|---|
| `H01` | sonda-1: `verify` de `license` → OK, `docLevel 1` (antes `22P02`) |
| `H02` | sonda-3: con una `pending` y una `accepted` en otra solicitud → `withdrawnOffersCount 1`; la `pending` pasa a `withdrawn` y la `accepted` queda intacta |
| `H03` | sonda-1: `pilot`, `active`, `expired` y `cancelled` → OK |
| `H06` | Vitest caso 6. **Mutación** (volver a `JSON.stringify`) → rojo |
| `H07` | `has_function_privilege`: `anon` = f en las cinco |
| `H09` | Vitest casos 6a/6b. **Mutación** (KEY→VALUE) → rojo |
| `H10` / `D02` | sonda-4: una fila de `audit_log` por RPC; el motivo aparece en `after` de `decide`, `suspend` y `verify`; `update_setting` guarda `before {"value":1000}` → `after {"value":1500}` |
| `H13` | sonda-2: `"   "` → `INVALID_SETTING_VALUE` |
| `D01` | diff mecánico de la ficha (ver Alcance) |
| `D03` | sonda-2: rejected→approved y approved→rejected → `INVALID_STATE_TRANSITION` |
| `D04` | sonda-3: `verified`, `rejected` y `submitted` purgado → `INVALID_STATE_TRANSITION` los tres |

Vale la pena decir que el `audit_log` de `update_setting` con `before`/`after` del valor viejo y el nuevo es mejor que lo que pedí: yo solo había pedido el motivo.

### BLOQUEANTES

- **`H04` (sigue abierto, con otra forma) · [`supabase/tests/rpc_admin.sql:13`]** La suite reescrita corre **0 de 36**: `invalid input syntax for type uuid: "00000000-0000-4000-8000-0000000000m1"` → `Bad plan. You planned 36 tests but ran 0`, `Files=7, Tests=177, Result: FAIL`. Tiene cuatro UUID con caracteres que no son hex (`m1`, `r1`, `o1`, `o2`, en las líneas 13, 37, 40 y 43). Corregí eso en una copia descartable y apareció la **segunda capa**: la semilla inserta una oferta `pending` y otra `accepted` del mismo repartidor **en la misma solicitud** (línea 104), y eso viola `offers_one_active_per_courier_request_idx`. Con las dos capas corregidas corre, y fallan tres cosas más:
  - `not ok 1`: la prueba espera `UNAUTHENTICATED` de `anon`, pero el `revoke` de `H07` hace que `anon` reciba `42501`. **La prueba quedó mal por el arreglo de otro hallazgo.** Hay que afirmar `42501` para `anon` y probar `UNAUTHENTICATED` con `authenticated` sin `sub`.
  - `not ok 36`: `value->>0` sobre un número jsonb no da nulo. Hay que borrarla; la 37 ya afirma el valor.
  - `plan(36)` contra 37 pruebas.

  **Y la bitácora vuelve a declarar `test:db ✅ (36 assertions)`.** Es la segunda vez en esta PR que se declara verde una suite que no corrió. → Arreglar las cinco cosas y pegar en el PR la línea `Files=… Tests=… Result: PASS` **copiada de la terminal**.
- **`H05` (parcial) · [`rpc_admin.sql`]** Mejoró de verdad: la prueba de suspender ahora siembra `pending` y `accepted` y afirma las dos, y los caminos felices leen la fila. Pero la batería de mutaciones sobre la copia corregida deja **nueve mutaciones en verde**. Para descartar una falla del instrumento (`AG-60`), incluí **tres controles positivos que sí se ponen rojos**: sin aal2 en `decide` falla la 3; `decide` sin audit falla la 9; `suspend` sin retirar fallan la 15 y la 17. Las nueve ciegas:

  | Mutación | Qué debería atajarla |
  |---|---|
  | D03 vuelve a «solo `suspended`» | un `decide` sobre un repartidor `approved` o `rejected` (la única prueba usa un suspendido) |
  | D04 sin el chequeo de `purged_at` | un documento `submitted` y purgado |
  | sin audit en `suspend`, `verify`, `set_subscription`, `update_setting` (4) | afirmar la fila de audit en cada una, no solo en `decide` |
  | sin aal2 en `suspend` y en `set_subscription` (2) | aal1 en las cinco, no solo en `decide` |
  | el motivo no se guarda en `decide` | afirmar `after->>'reason'` |

  → Agregarlas. Después, correr `evidencia/ronda-2/mut.py` contra la suite nueva: las nueve tienen que salir rojas.
- **`H08` (parcial) / `D05`** `admin.test.ts` existe y está bien para el wrapper, pero compara **wrapper contra fake**, nunca RPC contra fake. El fake sigue divergiendo en cinco casos, todos probados: `decide` approved→rejected OK, `decide` suspended→approved OK, suspender a un suspendido OK, `verify` de un documento `verified` OK, y `decide(inexistente, rejected, sin motivo)` → `NOT_FOUND`, donde la RPC da `REASON_REQUIRED`. **D05 (decidido): el contract-change del fake entra antes del merge**, con un test que corra las cinco combinaciones contra el fake y deje escrito lo que da la RPC.
- **`H11` (sigue abierto) · [`src/types/database.types.ts`]** Se editó **a mano**. `pnpm db:types --local` produce +4/−12 sobre el archivo commiteado: otro orden de campos, y `| null` que el generador no pone. El `git diff --exit-code` de db-tests sigue fallando. → Regenerarlo con `pnpm db:types --local` y commitear lo que salga, sin retocarlo.

### MEJORAS

- `H12` y `H14` sin cambios (ronda 1).
- **`H15` · [`admin.test.ts:269`]** El caso 7 no puede fallar: comprueba que existan en `RPC_CONTRACTS` cinco claves que el typecheck ya exige. Sacarlo o reemplazarlo por uno que compare `errorCodes` en los dos sentidos.
- **`H16` · [`admin.ts:228`]** `VALID_SETTING_KEYS` copia a mano `PLATFORM_SETTING_KEYS` (`src/domain/schemas/index.ts:78`). Importarla. Relacionado: sin clave, o con una clave que no es string, el wrapper da `VALIDATION_ERROR` y el fake `INVALID_SETTING_KEY` (residual menor de `H09`).
- **`H17` · [`…_rpc_admin_v1.sql:413`]** El `before` del audit de `update_setting` se lee sin lock. Con dos admins a la vez puede quedar viejo. Alcanza con `for update`, o con usar `returning` y la fila vieja.

## Checks locales en `b257f1b`

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ `No ESLint warnings or errors` |
| `pnpm test` | ✅ `Test Files 32 passed (32)` · `Tests 267 passed (267)` · node:test 19/0 y 6/0. Coincide con lo que declara la bitácora |
| `pnpm supabase test db` | ❌ `Files=7, Tests=177, Result: FAIL` · `rpc_admin.sql` 0 de 36 |
| `pnpm db:types --local` + `git diff --exit-code` | ❌ +4/−12 |

## Sobre esta revisión

- En la ronda 1 escribí que el motivo iba «en `after`», y así se hizo. No pedí el `before` y el agy lo agregó igual. Bien resuelto.
- La prueba de `anon` que ahora falla es un efecto directo de mi pedido de `H07`. No avisé que el `revoke` cambiaba lo que ve `anon`. Es `AG-59` otra vez, en chico: **un hallazgo que cambia el comportamiento observable tiene que decir qué pruebas existentes invalida.**
