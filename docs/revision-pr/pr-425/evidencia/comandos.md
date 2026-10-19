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

---

# Ronda 3 — implementación `9ab27a099e36d4abf0c4dae5716d32d0ead88edb`

## Sincronización y alcance

```bash
git fetch origin
git diff --shortstat origin/develop...9ab27a099e36d4abf0c4dae5716d32d0ead88edb
git diff --name-status origin/develop...9ab27a099e36d4abf0c4dae5716d32d0ead88edb
git diff --check 126e7497cc578734c8005038419928a2c8a14e64..9ab27a099e36d4abf0c4dae5716d32d0ead88edb
```

Resultado: 28 archivos, +1593/-16 contra `origin/develop`; las cuatro rutas modificadas después de ronda 2 están
autorizadas por T-373 y el delta de implementación no tiene errores de whitespace.

## Mutaciones independientes de H02 y H03

Archivo: `src/features/trips/queries.ts`. SHA-256 original y restaurado:

```text
3CA79E78925AECFF3B008A8CBED84C4988391600764E1B11DD60DD3ED190D939
```

H02, mutación temporal:

```diff
- if (result.code === 'INTERNAL_ERROR') throw new TripDetailsUnavailableError();
+ if (result.code === 'INTERNAL_ERROR') return null;
```

`pnpm exec vitest run src/features/trips/queries.test.ts`: RED 2 failed / 31 passed. Fallaron el código interno y la
composición paralela con historial propio.

H03, mutación temporal: quitar `if (!STATUSES_WITH_CANCELLATION_HISTORY.includes(status)) return null;`.

El mismo comando: RED 4 failed / 29 passed para `draft`, `matched`, `in_transit` y `delivered`. Tras cada restauración:
GREEN 33/33 y hash exacto recuperado.

## PR425-H04 · reproducción en el consumidor real

Prueba reviewer-owned temporal en `trip-report-wiring.test.tsx`: perfil courier, detalle `null`, historial
`INTERNAL_ERROR` y oráculo de que `notFound` no debía ejecutarse.

```text
Test Files  1 failed (1)
Tests       1 failed | 9 skipped (10)
AssertionError: expected vi.fn() to not be called at all, but actually been called 1 times
```

El archivo se restauró al SHA-256 original:

```text
5DB3125D57E7024E3865357E2DBC0D3F0D1DEBA1375B7CCD3F5CF5C630BC88E3
```

## Batería local

```text
pnpm typecheck: exit 0
pnpm lint: exit 0, sin warnings ni errores
pnpm test: exit 0; 148 archivos / 2882 pruebas; workflows 79/79; ADR 6/6
dirigidas: 12 archivos / 248 pruebas; exit 0
pnpm test:db: exit 1; ECONNREFUSED 127.0.0.1:54322
```

## Evidencia remota

- CI: https://github.com/cadeApp/cadeApp/actions/runs/39245877273 — SHA exacto `9ab27a09`, unit, typecheck, lint,
  build, audit, bundle-budget y db-tests verdes.
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/39245994799 — status `e2e-preview` verde publicado sobre
  `9ab27a09`; 91 Chromium + 6 global-settings; T-373 pasó en 47.4 s.
- Head documental al iniciar: `e9c599f41274c7b1e54b4c2467c5bae241fae9bb`; PR abierta y Draft.

## Evidencia remota

- CC-032 mergeado: PR #424, merge `9f1d1a6f335915b723d6fe98763990d3097706f4`.
- Checkpoint Develop: workflow `migrate` 39208629564, `migrate-develop` verde.
- CI de implementación: 39219529022, unit/typecheck/lint/build/audit/bundle-budget/db-tests verdes.
- E2E funcional: 39219634821, `e2e-preview` verde sobre el despliegue de la implementación; el informe del autor registra 91 Chromium y 6 global-settings.
- Head documental `8f2c51f`: CI general verde; `approval-policy` rojo a la espera del informe y un E2E repetido estaba en curso al redactar la ronda.

---

# Ronda 4 — implementación `cbf5709299522fc306b0d6dae510f03ee763f6ec`

## Sincronización y alcance

```bash
git fetch origin feat/T-373-historial-cancelaciones develop
git diff --shortstat origin/develop...cbf5709299522fc306b0d6dae510f03ee763f6ec
git diff --name-status a230d5f9fa034beb81c21224833f7f33925f8635..cbf5709299522fc306b0d6dae510f03ee763f6ec
```

Resultado completo: 31 archivos, +1905/-16 contra `origin/develop`. Delta desde la revisión anterior: cuatro rutas
permitidas, +87/-7; no agrega dependencias ni toca contrato, SQL, RLS o datos sensibles.

## PR425-H04 · mutación independiente

Mutación temporal en `src/features/trips/cancellation-history-guard.ts`:

```diff
- if (result.code === 'INTERNAL_ERROR') throw new CancellationHistoryUnavailableError();
+ if (result.code === 'INTERNAL_ERROR') return onAbsent();
```

```text
pnpm exec vitest run src/features/trips/cancellation-history.test.tsx
baseline: 1 archivo / 19 pruebas, exit 0
mutante: 1 archivo, 1 failed / 18 passed, exit 1
restaurado: 1 archivo / 19 pruebas, exit 0
```

Falló el oráculo que exige `CancellationHistoryUnavailableError` y que `onAbsent` no sea invocado. El archivo se
restauró desde `HEAD`; `git status --short` quedó vacío antes de documentar.

## Batería local

```text
pnpm typecheck: exit 0
pnpm lint: exit 0, sin warnings ni errores
dirigidas: 12 archivos / 256 pruebas; exit 0
pnpm test: 148 archivos; 2890/2890 pruebas ejecutadas, pero exit 1 por timeout de 10 s en afterAll de cc007.test.ts
pnpm exec vitest run src/server/rpc/cc007.test.ts: 1 archivo / 13 pruebas; exit 0
pnpm test:db: exit 1; ECONNREFUSED 127.0.0.1:54322
```

El timeout ocurrió al retirar un enlace temporal en el teardown de una suite ajena. La suite aislada pasó de inmediato;
la evidencia oficial `unit` y `db-tests` del SHA exacto está verde.

## Evidencia remota

- CI exacto: https://github.com/cadeApp/cadeApp/actions/runs/39258271108 — SHA `cbf57092`; unit, typecheck, lint,
  build, audit, bundle-budget y db-tests verdes.
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/39258408318 — status `e2e-preview` publicado sobre `cbf57092`;
  90 Chromium + 1 flaky ajeno que pasó en retry, y 6 global-settings. El caso T-373 pasó.
- Flaky ajeno: `courier-onboarding.spec.ts:852`, `page.goto` excedió 30 s en la primera ejecución y pasó en retry.
- Head documental al iniciar: `0810a2890b41e5ac2283bd664c82475bec2deb68`; PR abierta y Draft.
