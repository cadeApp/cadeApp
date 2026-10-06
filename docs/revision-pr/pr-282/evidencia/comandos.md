# Evidencia — PR #282

## Ronda 1

SHA: `ced0add71da9daf7d56a8c951bb9253cd9a20537`.

### H01

`src/features/requests/queries.ts` en develop seleccionaba `cash_change_amount` en dos listados y `notes` + `cash_change_amount` en el detalle; `RequestOffersList` mostraba el monto.

### H02

T-335 publica `public.offers` y `public.delivery_requests`. El fallback original con `SET TABLE` reemplazaba miembros.

---

## Ronda 2

SHA: `39153caa7ad1cb5f617115fd2fc3f2734462c7ee`.

### H01 verificado

CC-023 ahora incluye el inventario completo, la RPC privada del comercio, el contrato Zod, fake, wrapper, tipos, tests y preservación visual de «Paga con $ …».

### H02 verificado

CC-023 §5 ya no usa `SET TABLE`. Solo permite `DROP TABLE public.delivery_requests` + `ADD TABLE public.delivery_requests (<columnas>)` si el E2E prueba que los grants no bastan, y exige conservar `public.offers`.

### H03 — contradicción de coordinación

`docs/tasks/T-345.md`:

```text
Rollout obligatorio: tres PR, en orden
Cada paso es una PR propia de esta tarea
```

`AGENTS.md §5`:

```text
Una tarea = un issue = una rama feat/T-xxx-slug = un PR
```

`.agents/rules/50-git-y-coordinacion.md` mantiene la misma unidad tarea/rama/PR.

### H04 — drift de tipos

`.github/workflows/ci.yml`, job `db-tests`, después de aplicar migraciones:

```bash
pnpm supabase test db
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
```

El paso 1 de T-345 crea una función pública nueva. El paso 2, según la ficha, recién lleva «tipos generados». Esa separación hace que el paso 1 genere un diff en `database.types.ts` y falle CI.

### Rollout verificado contra workflows

- `migrate.yml`: push a develop → `migrate-develop`.
- Vercel Develop: integración Git independiente del workflow de migración.
- `deploy.yml`: staging/main esperan a `migrate`.

La necesidad de separar compatibilidad → aplicación → enforcement es real; H03 cuestiona la unidad de planificación, no esa necesidad técnica.

### CI del SHA de ronda 2

```text
typecheck      success
lint           success
unit           success
build          success
audit          success
bundle-budget  success
db-tests       success
Vercel         success
e2e-preview    error: job e2e-preview cancelled; no fallo funcional reportado
approval-policy failure: todavía hay bloqueantes
```

---

## Ronda 3

SHA: `1f134ce4ef219bf504dd954ee9cacc5a730a74da`.

### H03 verificado

`AGENTS.md §5` conserva la regla general y delega el detalle de la excepción multi-PR a regla 50. Regla 50 exige decisión explícita, ramas/PR/checks/revisión por paso, secuencia y bitácora única. T-345 registra decisión B y tres ramas.

### H04 verificado

T-345 PR 1 incluye:

```text
supabase/migrations/*_t345_cc023_merchant_private_fields_rpc.sql
supabase/tests/cc023_private_columns.sql (parte RPC)
src/types/database.types.ts
```

El checkpoint exige `db-tests` y drift de tipos verde.

### H05 — comportamiento real de board-sync

`.github/workflows/board-sync.mjs`:

```text
merged PR feat/T-345-* -> mergedTaskIds += T-345
completedTasks = Set(mergedTaskIds)
isCompleted = (issue closed || completedTasks.has(T-345)) && !openPr
targetState = hecha
shouldCloseIssue = isCompleted && !isClosed
PATCH issue state=closed
```

No se inspecciona el body de la PR ni `Refs/Closes`.

Decisión R3 1-A: multi-PR abierto no se considera completado por un merge intermedio; queda En curso y tampoco satisface dependencias.

### H06 — gate real de migraciones

`.github/workflows/verify-workflows.test.mjs` ya verifica:

```text
preview gate blocks pull requests with migrations instead of reporting green
BLOCKED_BY_MIGRATION = 'BLOCKED / REQUIRES DEVELOP MIGRATION'
```

`.github/workflows/e2e-preview.yml` no ejecuta `supabase db push` ni `supabase link`.

`.github/workflows/migrate.yml` aplica migraciones a Supabase Develop solo por `push` a `develop`.

`docs/runbooks/e2e-preview.md`:

```text
Una PR que toca supabase/migrations/** se valida con db-tests.
Su e2e-preview queda BLOCKED / REQUIRES DEVELOP MIGRATION;
el E2E remoto se hace después del merge.
```

Decisión R3 2-A: PR 1/3 aceptan ese estado esperado; PR 2 exige GREEN; tras PR 3 + migrate-develop se usa PR review-only sin migraciones para ejecutar el E2E real y solo entonces se cierra #281.

### CI exact-head de #282

```text
typecheck      success
lint           success
unit           success
build          success
audit          success
bundle-budget  success
db-tests       success
Vercel         success
e2e-preview    success
approval-policy failure (informe anterior aún CON BLOQUEANTES)
```
