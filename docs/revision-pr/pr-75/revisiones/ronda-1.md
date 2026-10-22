# PR #75 · T-105 · Ronda 1

**SHA revisado:** `834b915` (head de `feat/T-105-admin-rpc`, base `b6b5f39` = `origin/develop`, sin divergencia).
**Fecha:** 2026-09-24 · **Revisión independiente** (sesión de Claude en la nube, clon propio).
**Alcance de la ronda:** revisión estática del diff, **más** corridas locales: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm supabase test db`, `pnpm db:types --local` y dos sondas SQL contra la base local con la migración del PR aplicada. **CI de GitHub no mirado** (la ronda tiene bloqueantes).

## Chequeos de arranque

1. **Rama al día.** `git fetch origin` → `origin/feat/T-105-admin-rpc` = `834b915`, igual que el head del PR. La bitácora no menciona trabajo sin pushear; su última entrada dice «Último commit: por generar», que es `834b915`.
2. **Comentarios de la PR:** ninguno.
3. **Bitácora `docs/tasks/log/T-105.md`:** dos entradas. La segunda declara `test:db ✅`. Ver `H04`.

## Alcance

Ficha leída desde `origin/develop`. Los cuatro archivos del diff (`supabase/migrations/20260924013700_rpc_admin_v1.sql`, `supabase/tests/rpc_admin.sql`, `src/server/rpc/admin.ts`, `docs/tasks/log/T-105.md`) están en «Archivos permitidos». La PR no toca la ficha. Sin dependencias nuevas. Ningún archivo de contrato modificado.

Lo que **falta** en el diff y la ficha no deja agregar es `D01`.

## Resultado: CON BLOQUEANTES (11)

Las cinco RPC se ejecutaron una por una contra la base local. **Tres de las cinco no funcionan en ningún caso**, y la suite que debía detectarlo no llega a ejecutar ninguna aserción.

| RPC | Camino feliz en la base local |
|---|---|
| `admin_decide_courier` | ✅ funciona |
| `admin_suspend_courier` | ❌ `42703` siempre (`H02`) |
| `admin_verify_document` | ❌ `22P02` siempre (`H01`) |
| `admin_set_subscription` | ⚠️ 2 de 4 estados; los otros 2 → `VALIDATION_ERROR` (`H03`) |
| `admin_update_setting` | ✅ en SQL; ❌ por el wrapper para todo número o booleano (`H06`) |

### BLOQUEANTES

- **`H01` · [`20260924013700_rpc_admin_v1.sql:228`]** `admin_verify_document` compara `kind` con `'driver_license'` y `'vehicle_insurance'`, que no existen en `courier_document_kind` (`license`, `insurance`). El cast del literal falla en **toda** llamada, sea cual sea el documento: `22P02`. → Usar `'license'` / `'insurance'`.
- **`H02` · [`…:148`]** `admin_suspend_courier` escribe `offers.withdrawn_at`, que no existe. `42703` en toda llamada, aunque el repartidor no tenga ofertas: la suspensión cautelar no se puede hacer. → Sacar la columna (el trigger ya pone `updated_at`).
- **`H03` · [`…:292`]** `admin_set_subscription` valida contra `('pilot','active','past_due','canceled')`. El enum es `('pilot','active','expired','cancelled')`: `expired` y `cancelled` → `VALIDATION_ERROR`; `past_due` y `canceled` → `22P02` → `INTERNAL_ERROR`. → Validar con el cast al enum, o con la lista real.
- **`H04` · [`supabase/tests/rpc_admin.sql:56`]** La suite **no ejecuta ninguna de sus 25 pruebas**: `Bad plan. You planned 25 tests but ran 0`, `Result: FAIL`. Tiene cinco capas de error independientes: `auth.users` sin `raw_user_meta_data` (el trigger devuelve `INVALID_SIGNUP_ROLE`); columnas que no existen en `profiles`, `merchants`, `couriers` y `courier_documents`; `'motorcycle'` no es `vehicle_type`; y 17 `perform` sueltos fuera de PL/pgSQL, que son un error de sintaxis. El archivo es **idéntico** en `a08f435` y `834b915`: el «rojo TDD» del cuerpo de la PR era este error, no la falta de las funciones. Nunca estuvo en verde. Aun así, la PR y la bitácora declaran `test:db ✅` y no pegan su salida. → Sembrar como `rpc_accept.sql` (usuarios con `raw_user_meta_data`, admin promovido con `update profiles`), `act_as` con `select`, y pegar las líneas `Tests=` / `Result:` de una corrida real.
- **`H05` · [`rpc_admin.sql:137`]** Aun corriendo, la suite no cubre el DoD. Matriz enumerada por RPC: `UNAUTHENTICATED` 1 de 5, `AAL2_REQUIRED` 1 de 5, `INVALID_STATE_TRANSITION` 0 de 3, efecto afirmado 0 de 5. «Suspender retira las ofertas pending» no siembra ninguna oferta y solo afirma `lives_ok`: si se borra el `update` de `offers`, sigue en verde. → Por cada RPC: anon, rol incorrecto, aal1, estado incorrecto (`D03`/`D04`) y un camino feliz **que lea la fila después**. Para suspender: sembrar ofertas `pending` **y** `accepted`, y afirmar que solo pasan a `withdrawn` las `pending` y que `withdrawnOffersCount` coincide.
- **`H06` · [`src/server/rpc/admin.ts:249`]** `p_value: JSON.stringify(value)` codifica dos veces. `1500` llega como el string JSON `"1500"`, que da `jsonb_typeof = string` y termina en `INVALID_SETTING_VALUE`. Para `pilot_terms_version`, `"v2"` se guarda **con las comillas adentro** y el `outputSchema` lo acepta: falla en silencio sobre el valor que regula los términos del piloto. → Pasar `value` tal cual.
- **`H07` · [`…_rpc_admin_v1.sql` final]** Falta `revoke all … from public, anon, authenticated; grant execute … to authenticated` en las cinco funciones. Comprobado: `anon` puede ejecutar las cinco, mientras que las cuatro RPC de T-101/T-102 no. Hoy no es explotable, porque `auth.uid()` nulo corta antes, pero el checklist de la PR tilda «grants mínimos».
- **`H08` · [`src/server/rpc/admin.ts`]** No hay test de contrato RPC ↔ `rpc-contracts.ts` ↔ fake, que el DoD pide. Fake y RPC ya divergen: un rechazo sin motivo sobre un id inexistente da `REASON_REQUIRED` en la RPC y `NOT_FOUND` en el fake (en `decide` y en `verify`); decidir o suspender a un suspendido da `INVALID_STATE_TRANSITION` en la RPC y OK en el fake. → Test de contrato una vez resuelto `D01`, y alinear el fake con `D03`/`D04`. Ojo: el fake vive en `src/domain/testing/`, que es contrato, así que ese cambio pasa por `contract-change`. El orden de los rechazos es parte del contrato (`AG-59`).
- **`H09` · [`admin.ts:240`]** `INVALID_SETTING_KEY` e `INVALID_SETTING_VALUE` no se alcanzan por el wrapper: el `safeParse` de la `discriminatedUnion` los devuelve como `VALIDATION_ERROR` antes de llamar a la RPC. El fake, con la misma entrada, devuelve los específicos, y T-123 se construye contra el fake. → Si falla el `safeParse`, devolver `INVALID_SETTING_KEY` cuando la clave no está en la lista y `INVALID_SETTING_VALUE` en los demás casos, igual que el fake.
- **`H10` · [`…:47`, `…:120`, `…:209`]** `p_reason` se exige y después **se tira**: ninguna RPC escribe `audit_log`. Comprobado: 0 filas antes y 0 después de un rechazo con motivo. → Según `D02`: un `insert` en `audit_log` dentro de cada RPC, en la misma transacción, con `before`/`after` y el motivo en `after`. Vale para las cinco RPC, no solo para las que piden motivo.
- **`H11` · [`src/types/database.types.ts`]** Sin regenerar: `pnpm db:types --local` agrega 25 líneas y el `git diff --exit-code` de db-tests falla. → Regenerar con `pnpm db:types` cuando la ficha lo habilite (`D01`).

### Decisiones 🔵 — ya tomadas por Lautaro073 (2026-09-24)

- **`D01`** Ampliar la ficha con `src/types/database.types.ts` (regenerado, nunca a mano) y `src/server/rpc/admin.test.ts`. **Lo hace Lautaro073 en develop**; el agy no toca la ficha.
- **`D02`** Auditoría **dentro de cada RPC**, atómica, con `before`/`after` y el motivo. Cierra `H10`.
- **`D03`** `admin_decide_courier` **solo desde `pending`** (`pending → approved | rejected`); cualquier otro origen da `INVALID_STATE_TRANSITION`. Quitar una suspensión o volver a revisar a alguien queda para una RPC futura.
- **`D04`** `admin_verify_document` **solo si `status = 'submitted'` y `purged_at is null`**; si no, `INVALID_STATE_TRANSITION`, que es el código que el contrato ya declara y la función nunca lanzaba.

### MEJORAS

- **`H12` · [`…:310`]** `paid_until` se borra cuando no viene y `notes` se conserva. Conviene elegir una sola semántica y escribirla.
- **`H13` · [`…:371`]** `pilot_terms_version` acepta `"   "`, porque recorta comillas del texto del jsonb. → `btrim(p_value #>> '{}') <> ''`.
- **`H14` · [`…:22` y 4 copias]** El preámbulo auth/rol/aal2 está copiado cinco veces, y el segundo `coalesce` sobre `request.jwt.claims` es redundante con `auth.jwt()`. → Un helper `app_private.assert_admin_aal2()` con un solo test.

### 🟣 Preexistente, fuera de esta PR

- `audit_log_admin` (`20260922051650_rls_v1.sql:453`) es `for all`: el admin puede hacer `update` y `delete` sobre `audit_log` (comprobado con `has_table_privilege`: `t`/`t`), y el plan §171 la define como tabla de solo inserción. Con `D02`, las RPC van a empezar a escribirla, así que conviene cerrarlo pronto. Es de T-005: no bloquea esta PR.

## Lo que está bien, con precisión

- **El orden del preámbulo es correcto en las cinco**: `auth.uid()` → rol → `aal2` → validación de entrada → lectura con lock. Ninguna lee datos antes de autorizar.
- **Ningún `update` va antes de un `raise`.** El barrido que dejó la #64 para T-103 (buscar una escritura que la excepción revierte) no encuentra nada acá: todas las validaciones van primero.
- **`FOR UPDATE` en `couriers` dentro de `admin_suspend_courier` serializa bien contra el `FOR SHARE` de `submit_offer` y `accept_offer`.** Una oferta que espera el lock relee la fila en READ COMMITTED y ve `suspended`. Es exactamente el «efecto inmediato» que pide el plan §6.3.
- **Los códigos por función coinciden con el contrato en los dos sentidos** en cuatro de las cinco, comprobado con un barrido por función sobre `git cat-file` y cruzado con la lectura (`AG-58` aplicada). La excepción es `D04`.
- **`admin_decide_courier` funciona de punta a punta** y su salida pasa el `outputSchema` (el `decidedAt` en ISO con milisegundos y `Z`).
- El wrapper es `server-only`, parsea la entrada y la salida con Zod y no filtra mensajes de Postgres al cliente.

## Checks locales en `834b915`

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ `No ESLint warnings or errors` |
| `pnpm test` | ✅ `Test Files 31 passed (31)` · `Tests 260 passed (260)` · node:test `# pass 19 / # fail 0` y `# pass 6 / # fail 0`. El cuerpo de la PR dice 30 / 259: esos números no son de este SHA |
| `pnpm supabase test db` | ❌ `Files=7, Tests=177, Result: FAIL`. `rpc_admin.sql`: 0 de 25. Los otros seis archivos, `ok` |
| `pnpm db:types --local` + `git diff --exit-code` | ❌ +25 líneas |

Nota de instrumento: la primera corrida de `pnpm test` dio un rojo en `clients.test.ts` («Posible JWT detectado en `supabase/.temp/start-secrets/…`»). **Lo provoqué yo**: son los archivos que deja `supabase start` en el árbol. Con la base apagada, 260/260. No es de la PR.

## Para la próxima ronda

Volver a correr, en el orden en que están, los comandos de `evidencia/comandos.md`, **y además** la suite nueva con cada mutación de `H05`. Si la suite nueva se escribe con el mismo patrón que `rpc_accept.sql`, anda.
