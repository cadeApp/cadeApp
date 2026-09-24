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
