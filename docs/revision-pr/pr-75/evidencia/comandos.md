# Evidencia · PR #75 · ronda 1 · SHA `834b915`

Entorno: sesión de Claude en la nube, Linux, checkout LF. Docker levantado a mano (`dockerd`). Base local con `pnpm supabase start`: aplica las seis migraciones, incluida la del PR, sin error.

## 1. Checks del proyecto

```bash
pnpm install --frozen-lockfile          # exit 0
pnpm typecheck                          # exit 0
pnpm lint                               # ✔ No ESLint warnings or errors
pnpm test                               # (con la base apagada)
#  Test Files  31 passed (31)
#       Tests  260 passed (260)
#  # pass 19 / # fail 0 · # pass 6 / # fail 0
```

## 2. Suite de base (H04)

```bash
pnpm supabase start
pnpm supabase test db > testdb.log 2>&1; echo rc=$?     # rc=1
grep -n "Result\|Tests=\|rpc_admin\|ERROR\|Parse errors" testdb.log
# psql:supabase/tests/rpc_admin.sql:60: ERROR:  INVALID_SIGNUP_ROLE
# CONTEXT:  PL/pgSQL function handle_new_user() line 6 at RAISE
# Failed 25/25 subtests
# Parse errors: Bad plan.  You planned 25 tests but ran 0.
# Files=7, Tests=177
# Result: FAIL
```

Las otras capas, sentencia por sentencia en su propia transacción con `rollback` (cada una falla por sí sola):

```bash
docker exec -i supabase_db_cadeapp-staging psql -U postgres -d postgres -c "begin; <sentencia> rollback;"
# profiles (id, role, full_name, phone)                  -> column "full_name" of relation "profiles" does not exist
# merchants (id, merchant_name, …)                        -> column "id" of relation "merchants" does not exist
# couriers (id, vehicle_type, …, is_available)            -> column "id" of relation "couriers" does not exist
# courier_documents (id, courier_id, kind, file_path, …)  -> column "file_path" of relation "courier_documents" does not exist
# perform 1;                                              -> syntax error at or near "perform"
```

El archivo nunca cambió entre el commit «rojo» y el de implementación:

```bash
git diff a08f435 834b915 -- supabase/tests/rpc_admin.sql    # vacío
```

## 3. Sondas SQL de las cinco RPC (H01, H02, H03, H06, H10, H12, H13, D03)

`sonda-1.sql` y `sonda-2.sql`, con su salida en `sonda-1.out` y `sonda-2.out`. Todo corre dentro de una transacción que termina en `rollback`. `pg_temp.try()` hace de admin (`role authenticated`, `sub`, `aal` en `request.jwt.claims`) y devuelve `OK <json>` o `ERR <sqlstate> <mensaje>`. El admin se crea como en `rpc_accept.sql`: se da de alta como `merchant` y se promueve con `update profiles`.

```bash
docker exec -i supabase_db_cadeapp-staging psql -U postgres -d postgres -v ON_ERROR_STOP=1 < sonda-1.sql
```

Salidas clave:

| Llamada | Resultado |
|---|---|
| `admin_decide_courier(c, 'approved')` | `OK {"status":"approved",…}` |
| `admin_verify_document(doc license, 'verified')` | `ERR 22P02 invalid input value for enum courier_document_kind: "driver_license"` |
| `admin_verify_document(doc selfie, 'verified')` | el mismo `22P02` |
| `admin_suspend_courier(c, 'motivo')` | `ERR 42703 column "withdrawn_at" of relation "offers" does not exist` |
| `admin_set_subscription(m, pilot / active)` | `OK` |
| `admin_set_subscription(m, expired / cancelled)` | `ERR P0001 VALIDATION_ERROR` |
| `admin_set_subscription(m, past_due / canceled)` | `ERR 22P02 invalid input value for enum merchant_subscription_status` |
| `admin_update_setting('min_offer_ars', '"1500"'::jsonb)` | `ERR P0001 INVALID_SETTING_VALUE` |
| `admin_update_setting('pilot_active', '"true"'::jsonb)` | `ERR P0001 INVALID_SETTING_VALUE` |
| `admin_update_setting('pilot_terms_version', '"   "'::jsonb)` | `OK` (H13) |
| `count(audit_log)` antes y después de `decide(rejected, 'documento ilegible')` | `0` y `0` (H10) |
| `decide`: rejected → approved → rejected | `OK`, `OK` (D03) |
| `decide(inexistente, 'rejected', null)` | `REASON_REQUIRED` (el fake: `NOT_FOUND`, H08) |
| `set_subscription(active, null, null)` con `paid_until='2026-12-31'` y `notes='n1'` | `paid_until` null, `notes` `n1` (H12) |

## 4. Wrapper (H06, H09)

Test de Vitest descartable en `src/server/rpc/`. Lo borré después de correrlo y no quedó en el árbol (`git status` limpio). El cliente falso registra los argumentos:

```
SENT [{"fn":"admin_update_setting","args":{"p_key":"min_offer_ars","p_value":"1500"}},
      {"fn":"admin_update_setting","args":{"p_key":"pilot_active","p_value":"true"}}]
WRAPPER unknown key {"ok":false,"code":"VALIDATION_ERROR"} bad value {"ok":false,"code":"VALIDATION_ERROR"}
FAKE    unknown key {"ok":false,"code":"INVALID_SETTING_KEY"} bad value {"ok":false,"code":"INVALID_SETTING_VALUE"}
```

`p_value` viaja como string JSON. Que PostgREST lo convierta en un jsonb **string** es análisis, no ejecución: no firmé un JWT `aal2` contra el PostgREST local para no manipular claves. La sonda SQL de la fila anterior muestra qué hace la función con ese jsonb string.

## 5. Privilegios de las funciones (H07)

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and (p.proname like 'admin_%' or p.proname in ('submit_offer','accept_offer','withdraw_offer','set_availability'));
-- admin_* (5): t      ·  submit_offer, withdraw_offer, set_availability, accept_offer: f
```

## 6. Tipos generados (H11)

```bash
pnpm db:types --local; git diff --stat -- src/types/database.types.ts
#  src/types/database.types.ts | 25 +++++++++++++++++++++++++
git show HEAD:src/types/database.types.ts > src/types/database.types.ts   # revertido; git status limpio
```

## 7. Barrido de códigos por función (D04)

Sobre los bytes de git, no del checkout (`AG-60`):

```bash
git cat-file -p HEAD:supabase/migrations/20260924013700_rpc_admin_v1.sql | awk '…message = …' 
# admin_verify_document: AAL2_REQUIRED NOT_FOUND REASON_REQUIRED UNAUTHENTICATED UNAUTHORIZED_ACTOR VALIDATION_ERROR
#   (declara además INVALID_STATE_TRANSITION: nunca lo lanza)
# las otras cuatro: coinciden con RPC_CONTRACTS en los dos sentidos (VALIDATION_ERROR de suspend/update lo pone el wrapper)
```

Cruzado con la lectura de las cinco funciones: coincide.

## 8. `audit_log` preexistente (🟣)

```sql
select has_table_privilege('authenticated','public.audit_log','UPDATE'),
       has_table_privilege('authenticated','public.audit_log','DELETE');   -- t | t
```

Más la policy `audit_log_admin … for all` de `20260922051650_rls_v1.sql:453`.

---

# Ronda 2 · SHA `b257f1b`

Base local desde cero para que la migración modificada se aplique entera (si no, `start` reutiliza el volumen con la versión anterior):

```bash
pnpm supabase stop --no-backup
pnpm supabase start -x realtime,storage-api,imgproxy,studio,vector,logflare,edge-runtime,supavisor,mailpit,postgres-meta
```

## Suite (H04)

```bash
pnpm supabase test db     # ver ronda-2/testdb-resumen.txt
# rpc_admin.sql:14: ERROR:  invalid input syntax for type uuid: "00000000-0000-4000-8000-0000000000m1"
# Parse errors: Bad plan.  You planned 36 tests but ran 0.
# Files=7, Tests=177 · Result: FAIL
```

Copia descartable `ronda-2/rpc_admin_copia-descartable.sql`: solo cambia la semilla (UUID en hex y la oferta `accepted` en una segunda solicitud). **No es el arreglo propuesto**: es el instrumento para poder medir la suite. Corrida directa con `psql -f`: `not ok 1` (espera `UNAUTHENTICATED` y recibe `42501`), `not ok 36` y «planned 36 but ran 37».

## Sondas (H01–H03, H10, H13, D02–D04)

`sonda-1.sql` y `sonda-2.sql` de la ronda 1, re-corridas sin cambios → `ronda-2/sonda-1.out`, `ronda-2/sonda-2.out`. Nuevas: `ronda-2/sonda-3.sql` (D04, contenido del audit, suspender con `pending` + `accepted`) y `ronda-2/sonda-4.sql` (una fila de audit por RPC).

```bash
docker exec -i supabase_db_cadeapp-staging psql -U postgres -d postgres -v ON_ERROR_STOP=1 < sonda-N.sql
```

## Batería de mutaciones (H05)

`ronda-2/mut.py`: por cada mutación, arma `begin; <función mutada>; <cuerpo de la suite>` y cuenta los `ok` / `not ok`. Todo en una transacción con `rollback`: la migración del repo no se toca. Resultado en `ronda-2/mutaciones.out`:

```
M0-base:                          fallan [1, 36]
C1-CONTROL-sin-aal2-en-decide:    fallan [1, 3, 7, 36]      <- el instrumento detecta
C2-CONTROL-decide-sin-audit:      fallan [1, 9, 36]         <- el instrumento detecta
C3-CONTROL-suspend-no-retira:     fallan [1, 15, 17, 36]    <- el instrumento detecta
M1..M9:                           fallan [1, 36]            <- ciegas
```

Las nueve iguales, más la base, es la forma que `AG-60` pide sospechar. Por eso van los tres controles: prueban que la mutación sí se aplica y que la suite la ve cuando tiene la aserción.

```bash
python3 mut.py rpc_admin_copia-descartable.sql     # desde la raíz del repo
```

## Wrapper (H06, H09) y fake (H08)

Mutaciones con `sed` sobre `src/server/rpc/admin.ts`, restauradas con el `sed` inverso (`git diff` vacío después):

```
M0 base                                      Tests 7 passed (7)
M1 p_value: JSON.stringify(value)            Failed Tests 1
M2 INVALID_SETTING_KEY -> INVALID_SETTING_VALUE   Failed Tests 1
```

Probe descartable contra el fake (borrado después):

```
FAKE decide approved->rejected      {"ok":true,…}     RPC: INVALID_STATE_TRANSITION
FAKE decide suspended->approved     {"ok":true,…}     RPC: INVALID_STATE_TRANSITION
FAKE suspend suspended              {"ok":true,…}     RPC: INVALID_STATE_TRANSITION
FAKE verify verified doc            {"ok":true,…}     RPC: INVALID_STATE_TRANSITION
FAKE decide inexistente+rejected    NOT_FOUND         RPC: REASON_REQUIRED
WRAPPER sin key VALIDATION_ERROR    FAKE sin key INVALID_SETTING_KEY
```

## Tipos (H11)

```bash
pnpm db:types --local; git diff --stat -- src/types/database.types.ts
#  src/types/database.types.ts | 16 ++++------------
git show HEAD:src/types/database.types.ts > src/types/database.types.ts
```

## Ficha (D01)

```bash
git diff origin/develop b257f1b -- docs/tasks/T-105.md
# +- `src/server/rpc/admin.test.ts`
# +- `src/types/database.types.ts`
```

## Checks

```
pnpm typecheck   exit 0
pnpm lint        ✔ No ESLint warnings or errors
pnpm test        Test Files 32 passed (32) · Tests 267 passed (267) · # pass 19/# fail 0 · # pass 6/# fail 0
```

---

# Ronda 3 · SHA `c9585ba`

```bash
pnpm supabase stop --no-backup
pnpm supabase start -x realtime,storage-api,imgproxy,studio,vector,logflare,edge-runtime,supavisor,mailpit,postgres-meta
pnpm supabase test db            # ronda-3/testdb-resumen.txt → rpc_admin.sql ok · Files=7, Tests=234 · Result: PASS
python3 docs/revision-pr/pr-75/evidencia/ronda-2/mut.py supabase/tests/rpc_admin.sql   # ronda-3/mutaciones.out
```

Mutación extra M10: `grant execute … to anon` para las cinco funciones antes del cuerpo de la suite → `not ok 1, 15, 27, 38, 48`.

Origen del `42501` de `anon`, a mano: `set local role anon; select public.admin_decide_courier(…)` → `ERROR: permission denied for function admin_decide_courier`.

```bash
pnpm db:types --local; git diff --stat -- src/types/database.types.ts   # 4 insertions(+), 12 deletions(-)  (igual que en la ronda 2)
git show HEAD:src/types/database.types.ts > src/types/database.types.ts
git diff b6b5f39 c9585ba -- src/domain/testing/rpc-fake.ts | wc -l      # 0
git diff --stat a33c5f7 c9585ba                                          # admin.ts, migración, rpc_admin.sql
pnpm typecheck; pnpm lint; pnpm test    # exit 0 · ✔ · Test Files 32 passed (32), Tests 267 passed (267)
```

---

# Ronda 4 · SHA `904e3df`

```bash
pnpm supabase stop --no-backup; pnpm supabase start -x realtime,storage-api,imgproxy,studio,vector,logflare,edge-runtime,supavisor,mailpit,postgres-meta
pnpm supabase test db                  # ronda-4/testdb-resumen.txt → Files=7, Tests=234, Result: PASS
pnpm db:types --local; git diff --stat -- src/types/database.types.ts    # 9 insertions(+), 38 deletions(-) → ronda-4/db-types.diff
git show HEAD:src/types/database.types.ts > src/types/database.types.ts
git diff --stat ef09eb1 904e3df        # incluye src/domain/testing/rpc-fake.ts y src/domain/domain.test.ts
git show origin/develop:docs/tasks/T-105.md | sed -n '/Archivos permitidos/,/Fuera de alcance/p'   # sin src/domain
```

Probe descartable (Vitest, borrado después) contra el fake de `904e3df`:

```
FAKE suspend suspended -> {"ok":true,…,"withdrawnOffersCount":0}     # RPC: INVALID_STATE_TRANSITION (pgTAP 2.6)
```

Código muerto (H20). Script Python que guarda `rpc-fake.ts` en memoria, quita los 7 bloques (validStatuses, PLATFORM_SETTING_KEYS y 5 chequeos de valor), corre el probe y `admin.test.ts` + `domain.test.ts`, y reescribe el original en un `finally`:

```
MUT set_subscription bogus -> VALIDATION_ERROR
MUT update_setting min 0   -> INVALID_SETTING_VALUE
MUT update_setting nope    -> INVALID_SETTING_KEY
MUT update_setting "   "   -> INVALID_SETTING_VALUE
Test Files 3 passed (3) · Tests 55 passed (55)
git status --short   # limpio
```

```
pnpm typecheck; pnpm lint; pnpm test   # exit 0 · ✔ · Test Files 32 passed (32), Tests 268 passed (268)
grep -n "Informe de revisión" .github/workflows/approval-policy.mjs   # :25 split por "### Informe de revisión de agy"
```

---

# Ronda 5 · SHA `02dca77` (+ `cc/CC-005` = `e6f43f7`)

T-105 sola:

```bash
pnpm typecheck; pnpm lint; pnpm test     # ronda-5/test-solo-resumen.txt → 1 failed (admin.test.ts caso 8, esperado) | 267 passed
pnpm vitest run src/server/supabase/clients.test.ts   # x2 → 10/10 (el timeout de la corrida completa fue de carga)
git diff origin/develop 02dca77 -- src/domain         # vacío
```

Integración descartable (rama local borrada después):

```bash
git checkout -b zz-integracion-r5 && git merge --no-edit origin/cc/CC-005-admin-fake-alignment   # sin conflictos
pnpm typecheck; pnpm lint; pnpm test     # ronda-5/test-integrado-resumen.txt → 32/32 · 268/268 · 19/0 · 6/0
```

Probe del fake integrado (Vitest descartable):

```
DIV 1 decide approved->rejected           -> INVALID_STATE_TRANSITION
DIV 2 decide suspended->approved          -> INVALID_STATE_TRANSITION
DIV 3 suspend suspended                   -> INVALID_STATE_TRANSITION
DIV 4 verify verified doc                 -> INVALID_STATE_TRANSITION
DIV 5 decide inexistente+rejected s/motivo -> REASON_REQUIRED
DIV 6 verify inexistente+rejected s/motivo -> REASON_REQUIRED
```

Mutaciones del fake (en memoria, restaurado en `finally`; `git status` limpio):

```
MF1 sin chequeo de suspendido en suspend  -> admin.test.ts + domain.test.ts: 2 failed | 52 passed
MF2 sin chequeo de pending en decide      -> 2 failed | 52 passed
```

Base y tipos:

```bash
pnpm supabase stop --no-backup; pnpm supabase start -x …
pnpm supabase test db        # ronda-5/testdb-resumen.txt → Files=7, Tests=234, Result: PASS
pnpm db:types --local; git diff --exit-code -- src/types/database.types.ts   # vacío
python3 docs/revision-pr/pr-75/evidencia/ronda-2/mut.py supabase/tests/rpc_admin.sql   # ronda-5/mutaciones.out (igual que la ronda 3)
```

---

# Ronda 6 · SHA `d18c562` · verificación en CI (run 35961614712)

Por indicación de Lautaro073, Supabase se verificó con el `db-tests` del CI, sin base local.

```bash
git merge-base --is-ancestor origin/develop d18c562 && echo contiene-develop   # sí (merge faa5dc6)
git diff --stat 59698a9 faa5dc6 -- . ':!src/domain' ':!docs/contracts'      # vacío: el merge solo trae el CC
git diff e6f43f7 53bd0ef -- src/                                           # vacío: el fake mergeado = el verificado en la ronda 5
git diff develop...d18c562 -- src/domain                                   # vacío
grep -n "git diff --exit-code" .github/workflows/ci.yml                    # :119, mismo paso que db:types --local
```

Logs (GitHub Actions, `get_job_logs`):

```
db-tests  107511219050  rpc_admin.sql .............. ok · Files=7, Tests=234 · Result: PASS · [db:types] Tipos generados… (git diff --exit-code sin salida, job success)
unit      107511219130  admin.test.ts (8 tests) · Test Files 32 passed (32) · Tests 268 passed (268) · # pass 19/# fail 0 · # pass 6/# fail 0
approval-policy 107511985104  "Informe de revisar-pr completo y sin bloqueantes."
```

Reviews de la #79: `[]` (D07).
