# Informe de revisión — PR #302 / T-348 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/302  
**Head SHA revisado:** `b433ccc957b986abf8400b15c4b7d57f18472173`  
**Base:** `develop` @ `d3fa4ccfeff13299ed82b6529be20d521bb79f77`  
**Fecha:** 2026-10-07

## Resultado

**SIN BLOQUEANTES.**

Los dos hallazgos de ronda 1 quedaron corregidos y revalidados. No aparecieron hallazgos nuevos.

## PR302-H01 — cerrado

El caso 24b ahora:
- elimina la fila `merchants` de `merchant_idle` como postgres;
- actúa como ese mismo merchant activo;
- intenta insertar su propio `profile_id`;
- exige SQLSTATE `42501`;
- restaura `merchant_1` antes del caso 25.

La PR aislada #303 quedó **REVIEW ONLY / NEVER MERGE**, cerrada y sin merge.

Entre `0b2ca2d` y `4437a76` hay un solo archivo adicional:
`supabase/migrations/20261007230000_review_only_t348_insert_self_mutation.sql`.

La mutación agrega únicamente:

```sql
create policy merchants_insert_self on public.merchants
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and app_private.is_active_operational_actor()
  );
```

No toca el test ni sus expectations.

Run mutado `37689517684`:

```text
Failed test 28: "merchant cannot insert its own merchant row directly"
caught: no exception
wanted: 42501
Looks like you failed 1 test of 65
```

Run GREEN restaurado `37689498779`: `db-tests` PASS.

H01 queda **arreglado-verificado**.

## PR302-H02 — cerrado

El body actual separa correctamente:
- RED de `notes`: `21bcef1` / run `37686516191`;
- RED de INSERT self: PR #303 / `4437a76` / run `37689517684`;
- GREEN real: `0b2ca2d` / run `37689498779`.

El checkbox «Cada prueba nueva se demostró fallando al romper la regla» queda respaldado por evidencia real.

H02 queda **arreglado-verificado**.

## Revisión productiva final

La migration real:
- elimina únicamente la congelación de `notes` en `merchants_update_self`;
- conserva `profile_id = auth.uid()`;
- conserva `app_private.is_active_operational_actor()`;
- conserva congelados `subscription_status` y `paid_until`;
- no agrega INSERT policy;
- no agrega GRANT;
- no agrega SECURITY DEFINER;
- no cambia columnas, tipos ni RPC.

## Checks del HEAD actual

CI `37690179081`:
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅

Unit:
```text
123 test files passed
1941 tests passed
```

DB:
```text
All tests successful.
Result: PASS
```

Vercel: ✅

Trusted `e2e-preview` `37690355625`:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Es el comportamiento esperado por T-348 y no es bloqueante de esta PR.

Rama:

```text
ahead  5
behind 0
```

## Post-merge obligatorio

1. `migrate-develop` debe quedar GREEN.
2. Solo después se retoma T-313 / PR #251.
3. #251 mergea `origin/develop` y confirma que la migration desaparece de su diff.
4. Recién entonces corre su baseline trusted E2E.

## Veredicto

**SIN BLOQUEANTES.**

No apruebo ni mergeo; esa decisión queda en Lautaro073.
