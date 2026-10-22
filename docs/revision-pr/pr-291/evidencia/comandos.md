# Evidencia — PR #291

HEAD funcional revisado: `52afdbc4673ac2274e4a56996785ac7bb4d77e3c`.

## Sincronización

```text
develop = 7e1629806376a8adf6a54cb53d2a5736c9d6bd74
HEAD    = 52afdbc4673ac2274e4a56996785ac7bb4d77e3c
ahead   = 3
behind  = 0
```

## Archivos

```text
docs/tasks/T-345.md
docs/tasks/log/T-345.md
e2e/specs/courier-private-columns.spec.ts
supabase/migrations/20261006180000_t345_cc023_private_columns.sql
supabase/tests/cc023_private_columns.sql
supabase/tests/rls_matrix.sql
```

## Decisión A

La ficha de `develop` no permitía `supabase/tests/rls_matrix.sql`.

Lautaro073 decidió A el 2026-10-07:

```text
Aceptar la ampliación de alcance.
rls_matrix.sql puede cambiar únicamente la aserción
"anon no ve delivery_requests" para esperar 42501.
```

## RED #290

PR:

```text
#290
review/T-345-enforcement-red
REVIEW ONLY / NEVER MERGE
closed
merged = false
```

Blobs idénticos entre #290 y #291:

```text
cc023_private_columns.sql
2bb7e399987daf4d311886508236d782c41fa1fc

courier-private-columns.spec.ts
d0ac3425e125f0e282965c958f25e97e8b2e0bd0
```

### db-tests RED — run 37555951681

```text
Failed test 16: authenticated has no table-level SELECT
Failed test 17: authenticated cannot SELECT notes
Failed test 18: authenticated cannot SELECT cash_change_amount
...
Failed 17/42 subtests
Files=19, Tests=1853
Result: FAIL
```

### e2e-preview RED — run 37556067686

```text
Running 43 tests using 1 worker
courier-private-columns.spec.ts failed
Expected: "42501"
Received: undefined
42 passed
1 failed
TARGET_SHA: 6aa8edbb1f720118ab95601fb08e1d8204d0ca6b
RESULT: failure
```

## GREEN #291 — CI 37569273030

### db-tests

```text
Applying migration 20261006180000_t345_cc023_private_columns.sql...
cc023_private_columns.sql ......... ok
rls_matrix.sql .................... ok
Files=19, Tests=1853
Result: PASS
[db:types] Tipos generados exitosamente
git diff --exit-code -- src/types/database.types.ts
```

### unit

```text
Test Files 123 passed (123)
Tests      1941 passed (1941)
workflows  tests 57 / pass 57
ADR        tests 6 / pass 6
```

### build

```text
Compiled successfully in 25.4s
```

### audit

```text
2 vulnerabilities found
Severity: 1 moderate | 1 high (1 ignored)
```

### e2e-preview

Run `37569361231`:

```text
PR interna #291 contra develop.
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Estado esperado para PR3.

## Migración

No hay migraciones posteriores a `20261006180000_t345_cc023_private_columns.sql` en la rama.

El grant enumera las 20 columnas públicas actuales. `database.types.ts` muestra 22 columnas totales en `delivery_requests`; las dos excluidas son `notes` y `cash_change_amount`.

## approval-policy antes de la revisión

```text
Falta el informe completo de revisar-pr sin bloqueantes.
Process completed with exit code 1.
```
