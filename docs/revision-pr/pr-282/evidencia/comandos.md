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

---

## Ronda 4

SHA revisado: `b6a716e2bfce5a4ea4996a1983ab14983554bee2`.

### H05 verificado

`board-sync.mjs` agrega `parseMultiPrRollout`, `multiPrTasks`, separa `mergedTasks` de `completedTasks` y mantiene `en-curso` mientras el issue multi-PR siga abierto.

CI `unit`, job 112182653880:

```text
.github/workflows/verify-workflows.test.mjs
tests 57
pass 57
fail 0
```

### H06 verificado

T-345 y CC-023 establecen:

```text
PR 1 migration -> e2e BLOCKED esperado
PR 2 readers   -> e2e GREEN
PR 3 migration -> e2e BLOCKED esperado
review-only    -> e2e GREEN
#281 -> cierre manual después del gate
```

La regla 50 distingue rollout multi-PR con y sin gate post-merge.

### H07 — target actual

```text
develop actual: 3a1de345eaf71ab1aeff060ead097d9d6442ac81
PR head:        b6a716e2bfce5a4ea4996a1983ab14983554bee2
compare:        ahead 8 / behind 33
```

Entre la base original y develop actual, los archivos compartidos con #282 conservan el mismo blob; develop agregó:

```text
e2e/specs/incidents.spec.ts
docs/tasks/log/T-308.md
docs/revision-pr/pr-224/**
```

Por eso la sincronización debería ser mecánica, pero sigue siendo necesaria: el E2E exact-head de la PR no puede ejecutar un spec que todavía no existe en su árbol.

### CI de b6a716e

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
approval-policy failure (informe independiente aún bloqueante)
```

---

## Ronda 5 — cierre

HEAD funcional: `3fed8cf77f4c5906d63ea60ebec8e9bd36163d95`.

### Integración

```text
develop = 3a1de345eaf71ab1aeff060ead097d9d6442ac81
HEAD    = 3fed8cf77f4c5906d63ea60ebec8e9bd36163d95
behind  = 0
ahead   = 10
```

Commit final de integración:

```text
Merge remote-tracking branch 'origin/develop' into cc/CC-023-courier-private-fields
parent 1 = 0ef321364334816e6a0511750b40f86940f8c39c
parent 2 = 3a1de345eaf71ab1aeff060ead097d9d6442ac81
```

### E2E exact-head

Run: `37492059152`.

```text
Running 37 tests using 1 worker
incidents.spec.ts:
  DoD 1 PASS
  DoD 2 PASS
  DoD 3 PASS
  DoD 4 PASS
37 passed

Running 3 tests using 1 worker
3 passed
```

Total: **40/40 PASS**.

### CI

```text
typecheck      success
lint           success
unit           success
build          success
bundle-budget  success
db-tests       success
Vercel         success
e2e-preview    success
audit          failure — CVE-2026-96889 en next > sharp
approval-policy failure — informe anterior todavía bloqueante
```

### Audit fuera del diff

```text
package.json:
  HEAD    01e8a38966a4cb2435e162b35cec452e599f5d4e
  develop 01e8a38966a4cb2435e162b35cec452e599f5d4e

pnpm-lock.yaml:
  HEAD    47abcb1947febc031b6cf30d5d9b4f62f9d1f0e6
  develop 47abcb1947febc031b6cf30d5d9b4f62f9d1f0e6
```

No hay cambio de dependencias atribuible a #282.
