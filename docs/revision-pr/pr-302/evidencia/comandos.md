# Comandos y evidencia reproducible — PR #302

## Ronda 1

RED de `notes`: CI `37686516191`, SHA `21bcef1`.

```text
Failed test 27: "merchant can update business_name and notes"
died: 42501: new row violates row-level security policy for table "merchants"
Looks like you failed 1 test of 65
```

GREEN de ronda 1: CI `37687474742`, SHA `ff0e289`.

## Ronda 2 — H01 discriminante

### Test real corregido

En `0b2ca2d`, el caso 24b:
- elimina la fila de `merchant_idle` como postgres;
- actúa como `merchant_idle`;
- intenta insertar `profile_id = merchant_idle`;
- exige 42501;
- restaura `merchant_1`.

### Mutación aislada

PR #303:
```text
REVIEW ONLY / NEVER MERGE
state  closed
merged false
```

Comparación:

```text
0b2ca2d3a6cdf93f73299c383149be6b7e481c56
  ..
4437a7622f7dfff95e6ef454836f7c019b216f07

1 commit
1 archivo:
supabase/migrations/20261007230000_review_only_t348_insert_self_mutation.sql
```

La mutación agrega únicamente `merchants_insert_self`; no toca el test ni sus expectations.

### RED del INSERT self

Run `37689517684`:

```text
Failed test 28: "merchant cannot insert its own merchant row directly"
caught: no exception
wanted: 42501
Looks like you failed 1 test of 65
```

### GREEN restaurado

Run `37689498779` sobre `0b2ca2d`:

```text
db-tests PASS
Result: PASS
```

## HEAD actual

```text
HEAD    b433ccc957b986abf8400b15c4b7d57f18472173
develop d3fa4ccfeff13299ed82b6529be20d521bb79f77
ahead   5
behind  0
```

CI `37690179081`:

```text
audit          PASS
lint           PASS
build          PASS
typecheck      PASS
db-tests       PASS
unit           PASS
bundle-budget  PASS
```

Unit:

```text
Test Files 123 passed (123)
Tests 1941 passed (1941)
```

DB:

```text
All tests successful.
Result: PASS
```

Vercel: PASS.

Trusted Preview `37690355625`:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Esperado por T-348.

## Resultado

H01 y H02 quedan arreglados-verificados en `b433ccc957b986abf8400b15c4b7d57f18472173`.
