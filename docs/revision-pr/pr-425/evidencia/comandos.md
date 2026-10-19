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

---

# Ronda 2 — implementación `2c38dad51bb473cf62e72b0bf6af7f5049f71b1f`

## Sincronización, alcance y estado

```bash
git fetch origin
git diff --stat origin/develop...2c38dad51bb473cf62e72b0bf6af7f5049f71b1f
git diff --name-status origin/develop...2c38dad51bb473cf62e72b0bf6af7f5049f71b1f
git diff --exit-code origin/develop...2c38dad5 -- \
  'src/app/(admin)/admin/incidents/_tests/trip-report-wiring.test.tsx' \
  'src/app/(merchant)/merchant/requests/[id]/page.test.tsx'
```

Resultados:

- Base exacta: `9f1d1a6f335915b723d6fe98763990d3097706f4`.
- Head de código: `2c38dad51bb473cf62e72b0bf6af7f5049f71b1f`.
- Head documental al iniciar: `e1fa4748a662cc623c58866f0c350d084c287562`.
- 25 archivos, +1148/-15 contra `origin/develop` (incluye los artefactos de ronda 1).
- Los dos tests de PR425-A01 no tienen diferencias contra `origin/develop`.
- Todas las rutas del diff están incluidas en «Archivos permitidos» de T-373.

## Batería local

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run \
  src/features/trips/cancellation-history.test.tsx \
  src/features/trips/actions.test.ts \
  src/features/trips/components.test.tsx \
  src/server/rpc/request-cancellation-history.test.ts
pnpm test:db
```

Resultados reales:

```text
typecheck: exit 0
lint: exit 0, sin warnings ni errores
test secuencial repetido: 148 archivos, 2867 pruebas; exit 0
dirigidas: 4 archivos, 101 pruebas; exit 0
test:db: no disponible localmente; ECONNREFUSED 127.0.0.1:54322
```

La primera ejecución de `pnpm test`, iniciada simultáneamente con la suite dirigida, tuvo un fallo aislado en
`use-request-offers.test.tsx` (2866/2867). El archivo aislado pasó 27/27 y la repetición completa secuencial pasó
2867/2867. No se atribuye a T-373 ni se oculta el primer resultado.

## PR425-H01 · mutación independiente de orden

Hash SHA-256 original de `cancellation-history-list.tsx`:

```text
F8FD84EAE9EB16DD857FEE62A21F76C7CFEFCAA953B721A342103C0593C21729
```

Mutación temporal:

```diff
- {events.map((event) => (
+ {[...events].reverse().map((event) => (
```

```bash
pnpm exec vitest run src/features/trips/cancellation-history.test.tsx
```

Resultado mutante: 1 failed / 10 passed; falló el oráculo «respeta el orden de la RPC». Restaurado: 11/11. El hash
volvió exactamente a `F8FD84EAE9EB16DD857FEE62A21F76C7CFEFCAA953B721A342103C0593C21729` y `git status --short`
quedó vacío.

## PR425-H02 · reproducción por flujo de códigos

```bash
rg -n "if \(!rpcResult.ok\)|if \(!trip\)|renderCourierCancelledAssignment" \
  src/features/trips/queries.ts src/app/trips/[id]/page.tsx src/server/rpc/trips.ts
```

Resultado comprobado:

1. `getTripDetailsServer` conserva `INTERNAL_ERROR` y los demás códigos del contrato.
2. `getTripDetails` convierte todo `!result.ok` en `null`.
3. `TripDetailPage` interpreta cualquier `null` de un courier con historial exitoso como asignación cancelada.

No existe una prueba que combine `INTERNAL_ERROR` del detalle con historial propio exitoso; el E2E solo cubre respuestas
válidas de ambas RPC.

## Evidencia remota de ronda 2

- CI de código: https://github.com/cadeApp/cadeApp/actions/runs/39236169058 — SHA `2c38dad5`, unit, typecheck,
  lint, build, audit, bundle-budget y db-tests verdes.
- E2E de código: https://github.com/cadeApp/cadeApp/actions/runs/39236284518 — status `e2e-preview` publicado sobre
  `2c38dad5`, 91 Chromium y 6 global-settings verdes; T-373 pasó en 52.3 s.
- Checkpoint CC-032: https://github.com/cadeApp/cadeApp/actions/runs/39208629564 — migrate-develop verde sobre
  `9f1d1a6f`.
- Head documental `e1fa4748`: CI general, Vercel y E2E 39240221298 verdes; `approval-policy` rojo al cerrar la ronda,
  a la espera de actualizar el informe del autor.

## Evidencia remota

- CC-032 mergeado: PR #424, merge `9f1d1a6f335915b723d6fe98763990d3097706f4`.
- Checkpoint Develop: workflow `migrate` 39208629564, `migrate-develop` verde.
- CI de implementación: 39219529022, unit/typecheck/lint/build/audit/bundle-budget/db-tests verdes.
- E2E funcional: 39219634821, `e2e-preview` verde sobre el despliegue de la implementación; el informe del autor registra 91 Chromium y 6 global-settings.
- Head documental `8f2c51f`: CI general verde; `approval-policy` rojo a la espera del informe y un E2E repetido estaba en curso al redactar la ronda.
