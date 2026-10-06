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
