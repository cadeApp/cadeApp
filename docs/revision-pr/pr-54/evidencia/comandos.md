# PR #54 · Comandos y salidas

## Ronda 1 — `85d3f6a`

### Alcance

```bash
gh pr diff 54 --name-only   # 12 archivos, filtrados con el parser de la ficha
```

```
archivos: 12 · FUERA DE ALCANCE: 0 (ninguno)
```

`tools/db-types.mjs` y `package.json` entran porque la ficha los declaró acotados antes de arrancar. El diff respeta el límite: una línea en el script, un script en `package.json`, cero dependencias, `pnpm-lock.yaml` intacto.

### Checks locales, en un worktree separado del que usa el agy

```bash
git worktree add --detach ../cadeApp-rev54 85d3f6a
pnpm install --frozen-lockfile   # exit 0
pnpm typecheck                   # exit 0
pnpm lint                        # exit 0
pnpm test                        # 72/72 Vitest · 18/18 workflows
```

### `db-tests` en CI, que es la verificación que vale

```bash
gh api repos/cadeApp/cadeApp/actions/jobs/106610030958/logs --allow-escape-sequences
```

```
psql:.../supabase/tests/structure.sql:3: NOTICE: extension "pgtap" already exists, skipping
.../supabase/tests/structure.sql .. ok
All tests successful.
Files=1, Tests=37,  1 wallclock secs
```

El job también corre `git diff --exit-code -- src/types/database.types.ts` **después** de regenerar con `db:types --local`, y pasa. O sea que el archivo commiteado es exactamente la salida del generador sobre esta migración.

### H01 · Las 18 claves foráneas, una por una

```bash
grep -nE "references (public|auth)\." supabase/migrations/*.sql
```

| Cascadean | Sin `on delete` |
|---|---|
| `profiles.id` → `auth.users` | `couriers.decided_by` → `profiles` |
| `merchants.profile_id`, `couriers.profile_id` | `audit_log.actor_id` → `profiles` |
| `push_subscriptions.user_id`, `consents.profile_id` | `incidents.reporter_id` → `profiles` |
| `courier_documents.courier_id` | `delivery_requests.merchant_id` → `merchants` |
| `delivery_request_contacts.request_id` | `offers.courier_id` → `couriers` |

`delivery_requests.merchant_id` y `offers.courier_id` son `not null`, así que el cascade choca y aborta. `audit_log.actor_id` y `couriers.decided_by` son nullable, que es la forma de `on delete set null`.

### H02 · El caché de supabase y el límite de Docker Hub

Del mismo log del job:

```
Error response from daemon: toomanyrequests: Rate exceeded     (×20)
...
[warning]Path Validation Error: Path(s) specified in the action for caching
do(es) not exist, hence no cache is being saved.
```

```bash
grep -n "cache/supabase" -A 2 .github/workflows/ci.yml
#   path: ~/.cache/supabase
#   key: supabase-${{ runner.os }}-${{ hashFiles('supabase/config.toml') }}
```

El directorio no existe al cerrar el job, y las imágenes las guarda el demonio de Docker, no el CLI.

### H05 · `updated_at` sin trigger

```bash
grep -nE "updated_at" supabase/migrations/*.sql        # lineas 100, 139, 158
grep -nE "create trigger|create function" supabase/migrations/*.sql
#   218: create function public.handle_new_user()
#   252: create trigger on_auth_user_created
```

Tres columnas, cero triggers de actualización.

### El informe del cuerpo, contra el módulo real

```bash
gh pr view 54 --json body --jq .body > body-54.txt
node -e "import('.../approval-policy.mjs')"    # evaluateApprovalPolicy
```

```
cuerpo de hoy : { ok: false, reason: 'Falta el informe completo de revisar-pr sin bloqueantes.' }
con el bloque : { ok: true,  reason: 'Informe de revisar-pr completo y sin bloqueantes.' }
```

Es la primera PR que pasa por el control nuevo de la #55, y falla por el motivo correcto: el peer approval ya no se pide.

### T-005 sí es dueña de `rls_enabled.sql`

```bash
grep -n "rls_enabled" docs/tasks/T-005.md
#   1: # T-005 — RLS v1, storage courier-docs, matriz RLS, rls_enabled.sql
#   8: Objetivo: ... rls_enabled.sql
#  25: DoD: ... rls_enabled.sql falla con una tabla sin RLS (demostrado)
```

Más `supabase/tests/rls_*.sql` en sus «Archivos permitidos». La obligación diferida tiene dueño y criterio demostrable.
