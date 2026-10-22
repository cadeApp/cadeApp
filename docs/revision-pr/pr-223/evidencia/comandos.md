# Evidencia reproducible — PR #223 / Ronda 1

**SHA funcional revisado:** `347b004f03ca9ea107162881bc1773bb976b70b4`

## Sincronización

```text
base: develop@2e43d71eadd13acf5e92fee5a0142d678fd79059
head: 347b004f03ca9ea107162881bc1773bb976b70b4
ahead: 3
behind: 0
mergeable: true
```

## Archivos funcionales/documentales del autor

```text
docs/tasks/T-330.md
docs/tasks/log/T-330.md
supabase/migrations/20261003000000_t330_publish_null_distance.sql
supabase/tests/rpc_requests.sql
```

## Comparación de función

Fuente vigente: `20261002010000_cc015_admin_cancel_requires_incident.sql`.

Se sustituyó en memoria el bloque nuevo de `v_distance` por el bloque de CC-015 y se comparó el cuerpo desde `create or replace function`:

```text
exact_after_normalization: true
```

## RED

Run `37082270401`, db-tests job `111085170215`:

```text
Failed tests: 1232-1233, 1235
Files=15, Tests=1671
Result: FAIL
```

## GREEN de implementación

Run `37083102766`, db-tests job `111087688928`:

```text
Files=15, Tests=1671
Result: PASS
[db:types] Tipos generados exitosamente
```

## CI del head funcional

Run `37083462695` / run number **959**:

```text
audit         success
build         success
unit          success
db-tests      success
lint          success
typecheck     success
bundle-budget success

Unit:
Test Files 114 passed (114)
Tests 1687 passed (1687)

DB:
Files=15, Tests=1671
Result: PASS
```

## Preview

Vercel status: success / READY.

Repository dispatch run `37083543261`:

```text
resolve-preview: success
e2e-preview: skipped
report-preview-status: skipped
BLOCKED / REQUIRES DEVELOP MIGRATION
```

La causa del bloqueo es explícita en `e2e-preview-target.mjs`: toda PR con `supabase/migrations/**` queda bloqueada hasta que la migración exista en Develop.
