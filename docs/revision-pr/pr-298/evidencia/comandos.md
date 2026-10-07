# Evidencia y probes — PR #298

## Ronda 1

Ver `revisiones/ronda-1.md`.

## Ronda 2 — SHA e72a457

### H01 · el canal vivo no es obligatorio

Producto, `src/features/offers/hooks/use-available-requests.ts`:
```text
initialData = initialRequests
initialDataUpdatedAt = 0
staleTime = 0
fetch('/api/live/available-requests')
```

Spec:
```text
card visible
await Promise.all(pendingResponseReads)
expect(leakedResponses).toEqual([])
```

No hay assert que pruebe que `/api/live/available-requests` haya sido observado. `Promise.all(array)` toma los elementos presentes al invocarse; promesas agregadas luego por eventos `response` no forman parte de esa espera.

### H02 · locator ambiguo

Producto:
```text
pickup  -> "Usar mi ubicación"
dropoff -> "Usar mi ubicación"
```

Spec:
```ts
page.getByRole('button', { name: /usar mi ubicación/i })
```

Resultado lógico: 2 matches; no identifica el control de entrega.

### H03/H04

Inspección del SHA confirma ausencia de fallback + markers en H03 y `interceptedUrls > 0` + `unexpectedGoogleUrls=[]` en H04.

### CI

CI run `37694152798`: todos los jobs observados success (db-tests, audit, typecheck, build, unit, lint, bundle-budget).

Trusted E2E run `37694273759`: in progress al cierre de R2.

### Comandos para la siguiente corrección

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --list
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --project=chromium
git status --short
git diff --name-only origin/develop...HEAD
```
