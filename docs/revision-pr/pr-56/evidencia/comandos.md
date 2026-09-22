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

---

## Ronda 2 — `86fd6fe`

### Qué cambió desde la ronda 1

```bash
git diff --stat 6d89021..86fd6fe
```

```
 docs/tasks/log/T-005.md                       |  32 +++
 supabase/migrations/20260922051650_rls_v1.sql |  92 ++++++++--
 supabase/tests/rls_matrix.sql                 | 129 +++++++++++++---
 3 files changed, 232 insertions(+), 21 deletions(-)
```

El rango arranca en `6d89021` —el último commit de la revisión— y no en `3a6876b`, para que el diff sea solo el trabajo del agy y no incluya la carpeta de la ronda 1.

### Alcance

```bash
gh pr diff 56 --name-only   # 11 archivos
```

```
archivos: 11 · FUERA DE ALCANCE: 0 (ninguno)
```

Los dos nuevos respecto de la ronda 1 son `supabase/tests/rls_enabled.sql` y la propia carpeta de revisión. Décima ronda consecutiva sin desvío.

### Checks locales

```bash
pnpm typecheck   # exit 0
pnpm lint        # exit 0 · "No ESLint warnings or errors"
pnpm test        # exit 0 · 72/72 Vitest (9 archivos) · 18/18 workflows
```

**Alcance de estos checks:** ninguno toca SQL. El único control que ejerce las policies es `db-tests`, y solo prueba lo que la matriz afirma.

### CI

```bash
gh run list --branch feat/T-005-rls-v1 --limit 8
gh run view 35694333595 --json jobs
```

```
45ca9bb  CI  completed/failure     <- H10, throws_ok comparando el mensaje
2afbe42  CI  completed/failure     <- H10, segundo intento
cdb7489  CI  completed/success     <- H10 cerrado
86fd6fe  CI  completed/success     <- 8/8 + approval-policy = 9/9
```

```bash
gh run view 35694333595 --log --job=106637792881 | grep -E "ok$|Tests=|Result:"
```

```
supabase/tests/rls_enabled.sql .. ok
supabase/tests/rls_matrix.sql ... ok
supabase/tests/structure.sql .... ok
All tests successful.
Files=3, Tests=71,  1 wallclock secs
Result: PASS
```

En el mismo log, arrastrando de la #54 (`PR54-H02`):

```
[warning]Path Validation Error: Path(s) specified in the action for caching
do(es) not exist, hence no cache is being saved.
```

### H01 · Qué queda escribible después de congelar

```bash
sed -n '/create policy couriers_update_self/,/);/p' supabase/migrations/20260922051650_rls_v1.sql
grep -n "create table public.couriers" -A 18 supabase/migrations/20260922031435_schema_v1.sql
```

Congeladas: `status`, `dni_hmac`, `license_status`, `insurance_status`, `decided_by`, `decided_at`, `deactivated_at`. La tabla tiene doce columnas y `doc_level` es `generated always`, así que lo escribible es exactamente `vehicle_type`, `vehicle_plate` y `available`.

### H03 · Por qué la prueba 11 no es vacua

```bash
grep -n "merchant_idle_id" supabase/tests/rls_matrix.sql
```

`merchant_idle_id()` se inserta en `auth.users` con `raw_user_meta_data '{"role": "merchant"}'`, así que el trigger `handle_new_user` de T-004 le crea la fila en `public.merchants`. La fila **existe** y no tiene solicitudes: por eso `not exists (select 1 from public.merchants where profile_id = merchant_idle_id())` afirma la policy y no la ausencia del dato.

### H11 · Por qué el repartidor no se gana los datos de contacto

```bash
sed -n '/create or replace function app_private.is_courier_assigned_to_request/,/\$\$;/p' \
  supabase/migrations/20260922051650_rls_v1.sql
grep -n "offers_one_accepted_per_request_idx" -A 1 supabase/migrations/20260922031435_schema_v1.sql
```

`is_courier_assigned_to_request` exige `dr.accepted_offer_id = o.id` **además** de `o.status = 'accepted'`, y `accepted_offer_id` vive en `delivery_requests`, donde el repartidor no escribe. El diseño de dos llaves aguanta. Lo que sí queda expuesto es `offers_one_accepted_per_request_idx`, que es `unique (request_id) where status = 'accepted'`.

### H14 · Por qué `zones_select_admin` no agrega nada

```bash
sed -n '/create policy zones_select_public/,/^-- public.merchants/p' \
  supabase/migrations/20260922051650_rls_v1.sql
```

`zones_write_admin` es `for all to authenticated using (app_private.is_admin())`, y `for all` incluye `select`.

### A02 · La carpeta llegó escrita desde el lado del autor

```bash
git status --short
git diff docs/revision-pr/pr-56/hallazgos.jsonl
grep -n "ronda-2.md" docs/tasks/log/T-005.md
ls docs/revision-pr/pr-56/revisiones/
```

```
 M docs/revision-pr/pr-56/hallazgos.jsonl        <- sin commitear, 9 en arreglado-verificado
                                                    con verificado_en_sha: 45ca9bb
log/T-005.md:  «Se atiende el hallazgo bloqueante H10 de la Ronda 2
                (docs/revision-pr/pr-56/revisiones/ronda-2.md)»
revisiones/:   ronda-1.md                        <- el archivo citado no está
```

Sobre `45ca9bb`, `db-tests` estaba en rojo. Esa versión quedó guardada fuera del repositorio y se restauró la commiteada con `git checkout --`.

### A03 · El catálogo de patrones

```bash
grep -ho '"patron":"[^"]*"' docs/revision-pr/pr-*/hallazgos.jsonl | sort -u
sed -n '/### Catálogo de patrones/,/^## /p' docs/revision-pr/README.md
```

Antes: el catálogo llegaba a `P15`, circulaban `P16`, `P17` y `P18` sin registrar, y el número 12 estaba usado por dos patrones distintos (`P12-plantilla-propaga-antipatron` y `P12-cuerpo-de-pr-fuera-de-template`, de `PR51-H10`).

```bash
sed -i 's/P12-cuerpo-de-pr-fuera-de-template/P19-cuerpo-de-pr-fuera-de-template/g' \
  docs/revision-pr/pr-51/hallazgos.jsonl
node docs/revision-pr/analizar.mjs | head -25
```

Después: **80 hallazgos en 6 PRs**, veintiún patrones, uno por número, ninguno sin registrar. `P17` queda quinto con 5 casos.
