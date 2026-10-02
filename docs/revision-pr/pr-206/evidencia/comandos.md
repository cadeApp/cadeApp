# Evidencia y comandos — PR #206

## Ronda 1

**SHA funcional revisado:** `def425a082e8b769b9a518feb9f705dae67ade72`

### Sincronización
- develop: `163d4ade24c192e79e713b46ca9de4ec0aa02b7d`
- branch head: `def425a082e8b769b9a518feb9f705dae67ade72`
- ahead: 1
- behind: 0
- merge-base: develop actual

### CI exact-head
Run: **36974328286 / CI #865**

```
Vitest:
Test Files 110 passed (110)
Tests      1627 passed (1627)

Workflow tests:
45 passed / 0 failed

ADR:
6 passed / 0 failed

DB:
Files=13, Tests=1621
Result: PASS
```

Jobs GREEN:
- unit
- build
- typecheck
- audit
- db-tests
- lint
- bundle-budget

### Vercel
Proyecto observado: `cadeapp-develop`.

Deployment del SHA exacto:
- state/readyState: READY
- source: git
- branch: `ci/e2e-vercel-preview`
- commit SHA: `def425a082e8b769b9a518feb9f705dae67ade72`

Health actual:
```
GET <preview>/api/health
302 Found
Protected by Vercel Authentication
```

P1 decidió 1-A: desactivar Vercel Authentication solo para Preview.

### GitHub Environment develop
Evidencia visual aportada por P1:
- Environment secrets incluye `VERCEL_PROJECT_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` y demás.
- Deployment branches and tags: **No restriction**.

P1 confirmó:
- `VERCEL_PROJECT_ID` existe como Environment secret.
- 2-A: agregar `SUPABASE_DEVELOP_PROJECT_REF`.
- 6-A: actualizar las tres reglas operativas del repo.
- 5-A: aceptar limitación de concurrency nativa.

### Documentación oficial Vercel contrastada
Vercel recomienda `repository_dispatch` para E2E posterior a deployments y documenta:
- `vercel.deployment.ready`
- `vercel.deployment.success`
- payload con `git.sha`, `project.id`, `id` y `url`.

El diseño de resolver desde código confiable en la rama default y validar el SHA exacto es consistente con ese contrato.

### No verificado en Ronda 1
- corrida real de `e2e-preview` (workflow aún no vive en develop);
- corrida real de `migrate-develop`;
- mutación independiente RED del reviewer.
