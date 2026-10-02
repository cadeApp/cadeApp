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


## Ronda 2

**SHA funcional revisado:** `4b47a618d837ccccb35bf13f8df3185b85ec55c1`

### Sync
```
develop = 163d4ade24c192e79e713b46ca9de4ec0aa02b7d
ahead   = 3
behind  = 0
```

### CI exact-head
Run: `36977355820` / CI #868 — success.

Unit:
```
Test Files 110 passed (110)
Tests      1627 passed (1627)

workflow tests: 47 pass / 0 fail
ADR tests:      6 pass / 0 fail
```

DB:
```
All tests successful.
Files=13, Tests=1621
Result: PASS
```

Jobs GREEN:
- typecheck
- lint
- unit
- build
- audit
- db-tests
- bundle-budget

### Preview exacto
Vercel confirmó deployment READY para `4b47a618d837ccccb35bf13f8df3185b85ec55c1`.

Health observado:
```
GET <preview>/api/health
200 OK
{"status":"ok"}
```

### Configuración externa no verificable desde el conector
- Deployment branch policy del Environment `develop`.
- Existencia/valor de `SUPABASE_DEVELOP_PROJECT_REF`.
- Alcance de `SUPABASE_ACCESS_TOKEN`.

Se conserva H04/H05 abiertos hasta confirmación P1.


## Ronda 3

**SHA funcional revisado:** `9c2e379abdec83180c770ae5307f02e0d471cec4`

### Último cambio
Desde la revisión R2 solo cambian:
- docs/runbooks/e2e-preview.md
- docs/tasks/T-327.md
- docs/tasks/log/T-327.md

### CI exact-head
Run: `36979219018` / CI #870 — success.

```
Vitest:
Test Files 110 passed (110)
Tests      1627 passed (1627)

Workflow tests:
47 passed / 0 failed

ADR:
6 passed / 0 failed

DB:
Files=13, Tests=1621
Result: PASS
```

### Evidencia P1
- GitHub Environment `develop`: Selected branches and tags, única regla `develop`.
- `SUPABASE_DEVELOP_PROJECT_REF`: visible como Environment variable de `develop`.
- Secrets de Supabase del Environment `develop`: P1 confirmó que corresponden al proyecto Develop.
- `SUPABASE_ACCESS_TOKEN`: no inspeccionado. Se reutiliza el token existente y su acceso se valida fail-closed en `migrate-develop`.

### Residual
No existe evidencia pre-merge del permiso efectivo del access token. Por decisión P1, esa comprobación pertenece al primer `migrate-develop` post-merge y no cierra #205 por sí sola.
