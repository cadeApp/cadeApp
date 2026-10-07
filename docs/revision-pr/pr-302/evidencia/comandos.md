# Comandos y evidencia reproducible — PR #302

## Estado revisado

```text
HEAD    ff0e289dacb6a424c4d7da87b1661258224d0cc4
develop d3fa4ccfeff13299ed82b6529be20d521bb79f77
ahead   2
behind  0
```

## RED propio ya existente

Run CI `37686516191`, SHA `21bcef1b5ac8e1311295cca9c25efb99a0867c47`.

```text
Failed test 27: "merchant can update business_name and notes"
died: 42501: new row violates row-level security policy for table "merchants"
Looks like you failed 1 test of 65
```

El caso nuevo 24b no falló en ese run.

## GREEN actual

Run CI `37687474742`, SHA `ff0e289dacb6a424c4d7da87b1661258224d0cc4`.

```text
typecheck      PASS
lint           PASS
unit           PASS
build          PASS
audit          PASS
bundle-budget  PASS
db-tests       PASS
```

Unit:

```text
Test Files 123 passed (123)
Tests 1941 passed (1941)
```

DB:

```text
Applying migration 20261007081131_t313_merchant_onboarding_update_policy.sql
All tests successful.
Result: PASS
```

## H01 — contraejemplo del control actual

Actor del caso 24b:

```sql
auth.uid() = pg_temp.merchant_1_id()
```

Fila que intenta insertar:

```sql
profile_id = pg_temp.courier_approved_1_id()
```

Con una policy self:

```sql
with check (profile_id = auth.uid())
```

la expresión sigue siendo falsa. Por eso el test actual seguiría recibiendo 42501 y no detectaría la regresión.

## Verificación pedida para el arreglo

Reemplazar 24b por un INSERT propio de un merchant activo sin fila `merchants`.

La prueba debe observar:

```text
schema correcto                    -> GREEN
policy INSERT self temporal        -> RED (no se lanza 42501)
policy temporal restaurada         -> GREEN
```

No dejar la policy temporal en la rama real.
