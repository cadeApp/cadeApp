# Comandos reproducibles — PR #425

**Implementación revisada:** `8e9ada09b10cbd38ab684909b62fab2c337c167d`  
**Base:** `9f1d1a6f335915b723d6fe98763990d3097706f4`

La revisión usó un worktree aislado y no leyó `.env*` ni secretos.

## Sincronización y alcance

```bash
git fetch origin
git diff --stat origin/develop...8e9ada09b10cbd38ab684909b62fab2c337c167d
git diff --name-status origin/develop...8e9ada09b10cbd38ab684909b62fab2c337c167d
git show origin/develop:docs/tasks/T-373.md
```

Resultado resumido: 23 archivos, +813/-9. Aparecen dos rutas no listadas por la ficha canónica:

```text
M src/app/(admin)/admin/incidents/_tests/trip-report-wiring.test.tsx
M src/app/(merchant)/merchant/requests/[id]/page.test.tsx
```

## Batería local

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run src/features/trips/cancellation-history.test.tsx src/features/trips/actions.test.ts src/features/trips/components.test.tsx src/server/rpc/request-cancellation-history.test.ts
git diff --check origin/develop...8e9ada09b10cbd38ab684909b62fab2c337c167d
```

Resultados reales:

```text
typecheck: exit 0
lint: exit 0, sin warnings ni errores
test: 148 archivos, 2867 pruebas; exit 0
dirigidas: 4 archivos, 101 pruebas; exit 0
git diff --check: limpio
```

## `test:db` local

```bash
pnpm test:db
```

Resultado real: exit 1 porque el Supabase local no estaba iniciado; conexión rechazada en `127.0.0.1:54322`. No se presenta como fallo funcional. El job oficial `db-tests` del SHA `8e9ada09` terminó verde en https://github.com/cadeApp/cadeApp/actions/runs/39219529022.

## PR425-H01 · Mutación independiente del orden visible

Mutación temporal, aplicada solo en el worktree de revisión:

```diff
- {events.map((event) => (
+ {[...events].reverse().map((event) => (
```

Comando:

```bash
pnpm exec vitest run src/features/trips/cancellation-history.test.tsx
```

Resultado en el mutante:

```text
Test Files  1 passed (1)
Tests       11 passed (11)
```

Esto demuestra que la suite no detecta la inversión de la cronología. Después se restauró el archivo y se comprobó:

```bash
git diff --exit-code
```

Resultado: exit 0, árbol limpio.

## Evidencia remota

- CC-032 mergeado: PR #424, merge `9f1d1a6f335915b723d6fe98763990d3097706f4`.
- Checkpoint Develop: workflow `migrate` 39208629564, `migrate-develop` verde.
- CI de implementación: 39219529022, unit/typecheck/lint/build/audit/bundle-budget/db-tests verdes.
- E2E funcional: 39219634821, `e2e-preview` verde sobre el despliegue de la implementación; el informe del autor registra 91 Chromium y 6 global-settings.
- Head documental `8f2c51f`: CI general verde; `approval-policy` rojo a la espera del informe y un E2E repetido estaba en curso al redactar la ronda.
