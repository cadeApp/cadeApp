# Evidencia — PR #287

SHA funcional revisado: `59209794df0cbfccd0e83c23336daf6e31f3f25f`.

## Sincronización y alcance

```text
develop = 95e3611b907917174947cdc452bc5b70fd7f7139
HEAD    = 59209794df0cbfccd0e83c23336daf6e31f3f25f
ahead   = 2
behind  = 0
```

Diff funcional:

```text
docs/tasks/log/T-345.md
src/types/database.types.ts
supabase/migrations/20261006120000_t345_cc023_merchant_private_fields_rpc.sql
supabase/tests/cc023_private_columns.sql
```

Historial previo de `docs/revision-pr/pr-287/**`: vacío.

## RED — PR #286

PR aislada:

```text
review/T-345-rpc-red
REVIEW ONLY / NEVER MERGE
merged = false
changed_files = 1
```

Único archivo: `supabase/tests/cc023_private_columns.sql`.

Blob del test:

```text
PR #286: c44524cd5da08f53b5a3f4095d1163fc60471d69
PR #287: c44524cd5da08f53b5a3f4095d1163fc60471d69
```

Run `37540600088`, db-tests:

```text
Files=1, Tests=10
Result: PASS

cc023_private_columns.sql:87:
ERROR: function "public.get_merchant_request_private_fields(uuid)" does not exist

Failed 16/16 subtests
Files=19, Tests=1811
Result: FAIL
```

## GREEN exact-head — CI 37542103206

### db-tests

```text
Applying migration 20261006120000_t345_cc023_merchant_private_fields_rpc.sql...

Files=1, Tests=10
Result: PASS

cc023_private_columns.sql ......... ok
Files=19, Tests=1827
Result: PASS

[db:types] Tipos generados exitosamente en .../src/types/database.types.ts
git diff --exit-code -- src/types/database.types.ts
```

El job termina success, por lo que el drift check no produjo diferencias.

### unit

```text
Test Files 121 passed (121)
Tests      1921 passed (1921)
workflows  tests 57 / pass 57
ADR        tests 6 / pass 6
```

### build

```text
Compiled successfully in 18.0s
```

### audit

```text
2 vulnerabilities found
Severity: 1 moderate | 1 high (1 ignored)
```

Job success.

## Gate E2E

Run `37542246491`, resolver:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

`e2e-preview` y `report-preview-status` quedan skipped. Esto coincide con la matriz contractual de T-345 para PR1.

## Bundle budget

HEAD de #287:

```text
/courier/feed                 159 kB  OK
/merchant/requests/[id]       163 kB  OK
/design-system                178 kB  OK
/admin/applicants             235 kB  Supera el límite
/admin/audit                  235 kB  Supera el límite
/admin/merchants              235 kB  Supera el límite
/admin/settings               235 kB  Supera el límite
/login/mfa                    235 kB  Supera el límite
```

Base `develop`, CI run `37539812713`, muestra los mismos valores para esas rutas. La advertencia es preexistente y no atribuible a #287.

## approval-policy antes de la revisión

Run `37542128479`:

```text
Falta el informe completo de revisar-pr sin bloqueantes.
Process completed with exit code 1.
```

Es el único requisito de política pendiente antes de publicar esta ronda.

No hubo hallazgos que requirieran una batería de mutaciones propia.
