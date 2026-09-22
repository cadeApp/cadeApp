# PR #56 · Comandos y salidas

## Ronda 1 — `3a6876b`

### Alcance

```bash
gh pr diff 56 --name-only   # 9 archivos, filtrados con el parser de la ficha
```

```
archivos: 9 · FUERA DE ALCANCE: 0 (ninguno)
```

### Checks locales, en un worktree separado del que usa el agy

```bash
git worktree add --detach ../cadeApp-rev56 3a6876b
pnpm install --frozen-lockfile   # exit 0
pnpm typecheck                   # exit 0
pnpm lint                        # exit 0
pnpm test                        # 72/72 Vitest · 18/18 workflows
```

### `db-tests` en CI

```bash
gh api repos/cadeApp/cadeApp/actions/jobs/106628214315/logs --allow-escape-sequences
```

```
supabase/tests/rls_enabled.sql .. ok
supabase/tests/rls_matrix.sql ... ok
supabase/tests/structure.sql .... ok
All tests successful.
Files=3, Tests=58
Result: PASS
```

Y el límite de Docker Hub de `PR54-H02` volvió a aparecer, tercera corrida consecutiva.

### Lo que hace que la matriz valga: corre con los roles reales

```sql
create function pg_temp.act_as(role_name text, actor_id uuid default null) ...
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text, true);
```

`auth.uid()` lee `request.jwt.claims->>'sub'`, así que las 15 aserciones se evalúan con el actor puesto. Sin esto, correrían como superusuario y pasarían todas sin verificar nada.

### H01 · Las columnas que `couriers_update_self` no congela

```bash
grep -n "create policy couriers_update_self" -A 9 supabase/migrations/20260922051650_rls_v1.sql
```

Congela `status` y `dni_hmac`. Quedan libres `license_status`, `insurance_status`, `decided_by`, `decided_at` y `deactivated_at`. Contra el DDL de T-004:

```sql
doc_level integer generated always as (
  (case when license_status = 'verified' then 1 else 0 end) +
  (case when insurance_status = 'verified' then 1 else 0 end)
) stored
```

O sea que el repartidor controla las dos entradas de `doc_level`.

### H02 · Lo que `merchants_update_self` deja escribir

```bash
grep -n "create policy merchants_update_self" -A 4 supabase/migrations/20260922051650_rls_v1.sql
#   with check (profile_id = auth.uid());
```

Columnas de `merchants` según T-004: `business_name`, `default_pickup_zone_id`, `default_pickup_address`, `default_pickup_lat/lng`, `subscription_status`, `paid_until`, `notes`. Ninguna congelada.

### ¿Llega el `update` a RLS? Sí: no hay grants restrictivos

```bash
grep -nE "^\s*grant|^\s*revoke" supabase/migrations/*.sql | grep -vi function
#   rls_v1.sql:29: grant usage on schema app_private to authenticated, anon;
```

Ninguna migración restringe los privilegios de tabla, así que valen los de Supabase por defecto —`anon` y `authenticated` con `all` sobre `public`— y lo único que decide es RLS.

### H04 · La policy de `anon` y el grant que le falta

```bash
grep -n "to anon" supabase/migrations/20260922051650_rls_v1.sql
#   136:  for select to anon, authenticated      (zones_select_active)

grep -n "grant execute on function app_private.is_admin" supabase/migrations/20260922051650_rls_v1.sql
#   grant execute on function app_private.is_admin() to authenticated;
```

Es la única policy que nombra a `anon`, y llama a una función que `anon` no puede ejecutar. No lo pude comprobar ejecutando: no hay base local levantada.

### H05 · Qué prueba la matriz, operación por operación

```bash
grep -cE "^select (is|ok|lives_ok)" supabase/tests/rls_matrix.sql   # 15
grep -nE "update public\.|insert into public\." supabase/tests/rls_matrix.sql | sed -n '/-- 15/,$p'
```

14 aserciones de `select` y una de `update`, sobre `delivery_requests`. Cero sobre `profiles`, `couriers` y `merchants`.

### La autorrevisión del agy

```bash
git show 3a6876b --stat | head
cat docs/revision-pr/pr-56/autorrevision-agy.md
```

Firmada «Revisión independiente (agy)», «Resultado: SIN BLOQUEANTES», «MEJORAS: ninguna pendiente», y `hallazgos.jsonl` con un solo registro. El cuerpo de la PR dice `generado por agy` y `approval-policy` pasa igual: el control verifica el formato del informe, no quién lo escribió.
