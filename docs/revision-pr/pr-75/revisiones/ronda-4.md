# PR #75 · T-105 · Ronda 4

**SHA revisado:** `904e3df` («fix(admin): resolve Ronda 3 review findings H08, H11, H18»), sobre `ef09eb1` (carpeta de la ronda 3). La base sigue siendo `b6b5f39`.
**Fecha:** 2026-09-24 · **Revisión independiente.**
**Alcance:** estática + corridas locales. Base recreada desde cero, `pnpm supabase test db`, `pnpm db:types --local`, probes y mutaciones sobre el fake (en memoria, restaurado), `typecheck`, `lint` y `test`. **CI de GitHub no mirado**: sigue habiendo bloqueantes.

## Chequeos de arranque

1. **Rama:** `origin/feat/T-105-admin-rpc` = `904e3df`, un commit. Toca `rpc-fake.ts`, `domain.test.ts`, `admin.test.ts`, `database.types.ts` y la bitácora.
2. **Comentarios:** solo los míos.
3. **Bitácora:** **ahora sí tiene la sesión** (03:10). Ver `H18` para lo que afirma.
4. **Cuerpo del PR:** reescrito entero. Ver `H21`.

## Alcance

**Dos archivos fuera de los permitidos:** `src/domain/testing/rpc-fake.ts` y `src/domain/domain.test.ts`. La ficha no lista `src/domain/**`, y los dos son contrato. No hay rama `cc/` nueva, ni `docs/contracts/CC-005.md`, ni rastro de la validación de P2 que pide la skill `contract-change`. → `A01`.

**🔵 `D06` (decidido por Lautaro073):** se saca de T-105 y se abre `cc/CC-005` desde develop, con su documento. Lo valida @KiraK72, entra primero y T-105 se rebasa. Es lo que ya decía `D05` («contract-change antes del merge»): se hizo el contenido, no el proceso.

## Resultado: CON BLOQUEANTES (5)

### Lo que sigue sano

- `pnpm supabase test db` → `Files=7, Tests=234, Result: PASS`, igual que en la ronda 3. La migración y `rpc_admin.sql` no cambiaron.
- `pnpm test` → **268**, que coincide con lo que declara la bitácora. Esta vez los números de la bitácora y del cuerpo son ciertos.
- El contenido del fake es **casi** correcto: de las cinco divergencias corrige cuatro. Decidir desde `approved` o `suspended` y verificar un documento `verified` dan `INVALID_STATE_TRANSITION`, y el orden quedó `REASON_REQUIRED` antes que `NOT_FOUND`, igual que la RPC. Eso va entero al CC-005.

### BLOQUEANTES

- **`A01` · [`src/domain/testing/rpc-fake.ts`, `src/domain/domain.test.ts`]** Cambio de contrato fuera de alcance y sin proceso. → `D06`: mover a `cc/CC-005`. En T-105 quedan `admin.test.ts` y la dependencia del CC.
- **`H19` · [`src/server/rpc/admin.test.ts:321`]** El test de contrato nuevo **afirma la divergencia que tenía que eliminar**. El caso 3 dice «suspender a un suspendido da OK con 0 ofertas retiradas (idempotente)». La RPC levanta `INVALID_STATE_TRANSITION` (`rpc_admin_v1.sql:145-147`), y la prueba 2.6 de `rpc_admin.sql` (la 20 de 57) lo afirma **en la misma PR**. Probe: el fake devuelve `{"ok":true,…,"withdrawnOffersCount":0}`. Si alguien alinea el fake, este test se pone rojo. → En el CC-005: el fake rechaza la suspensión de un suspendido, y el caso 3 afirma `INVALID_STATE_TRANSITION`.
- **`H11` (sigue, y peor) · [`src/types/database.types.ts`]** Otra vez editado a mano. `pnpm db:types --local` da ahora **+9/−38** (antes +4/−12). Esta vez además se reformatearon entradas que ya estaban en develop (`accept_offer`, `set_availability`, `withdraw_offer`), que el generador escribe en una sola línea. La bitácora dice «para coincidir 1:1 con la salida de Supabase CLI». → **No editar el archivo.** Correr `pnpm supabase start` y `pnpm db:types --local`, y commitear lo que salga, sin tocarlo. `git diff --exit-code` sobre el resultado tiene que dar vacío.
- **`H18` (parcial) · [bitácora y cuerpo]** La sesión ya está en la bitácora. Siguen cuatro afirmaciones falsas:
  - bitácora: «Se cumplieron todas las exigencias de D01 a D05» (D05 no) y «1:1 con la salida de Supabase CLI» (`H11`);
  - cuerpo: `[x] Sin cambios fuera de "Archivos permitidos"` (`A01`) y «Registro **inmutable** en `public.audit_log`». La policy `audit_log_admin` es `for all`: el admin puede hacer `update` y `delete` (lo comprobé en la ronda 1, con `has_table_privilege`, y lo dejé como 🟣 preexistente). No es de esta PR, pero no se puede afirmar lo contrario.
- **`H21` · [cuerpo del PR]** El cuerpo nuevo **salió de la plantilla**. Faltan seis de sus nueve secciones, entre ellas `### Informe de revisión de agy`, que es la que corta `approval-policy.mjs:25`: **ese check va a fallar**. También faltan el checklist de seguridad (obligatorio, porque se toca `supabase/` y `src/server/`), las dependencias y el rollback. → Volver a la plantilla y completarla con lo que es cierto.

### MEJORAS

- **`H20` · [`rpc-fake.ts:1112` y `update_setting`]** Siete bloques de validación nuevos son **inalcanzables**. Los quité en memoria y las cuatro entradas inválidas devuelven el mismo código; `admin.test.ts` y `domain.test.ts` siguen 55/55. Los rechaza antes `executeRpc` o el Zod del input. Los dos `decision !==` de `decide` y `verify` son de la misma clase (por inspección). Va al CC-005: sacarlos.
- `H12`, `H14` y `H15` sin cambios.

## Checks locales en `904e3df`

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ `No ESLint warnings or errors` |
| `pnpm test` | ✅ `Test Files 32 passed (32)` · `Tests 268 passed (268)` · 19/0 y 6/0 |
| `pnpm supabase test db` | ✅ `Files=7, Tests=234, Result: PASS` |
| `pnpm db:types --local` + `git diff --exit-code` | ❌ +9/−38 |
| `approval-policy` (por lectura del script) | ❌ esperable: no existe el encabezado que busca |

## Qué falta para aprobar

1. `D06` / `A01` / `H19` / `H20`: `cc/CC-005` con el fake corregido (incluida la suspensión de un suspendido) y sin código muerto; validado por P2; mergeado antes.
2. `H11`: tipos desde el generador, sin tocarlos.
3. `H18` y `H21`: cuerpo del PR en la plantilla, sin afirmaciones falsas.
4. Ronda 5: T-105 rebasada sobre el CC; CI entrando a los logs.
