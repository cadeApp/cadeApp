# Evidencia reproducible — PR #236 / T-333 — Ronda 1

## SHA y alcance

```text
PR: #236
base: develop @ bc6329d941a510cc37d23827f5e3798e3839c065
head revisado: 371848d3ae7d25a2aaec1608f8ad16a64ef5afb7
rama: feat/T-333-realtime-reconnect
compare: ahead 3 / behind 0
changed files: 5
```

## CI exacto del SHA revisado

Run CI `37141933687`:

```text
unit: 114 passed (114)
tests: 1743 passed (1743)
typecheck: SUCCESS
lint: SUCCESS
build: SUCCESS
db-tests: SUCCESS
bundle-budget: SUCCESS
audit: FAILURE por braces (externo a T-333 / canalizado por T-332)
```

Run preview E2E `37142003896`:

```text
checkout: 371848d3ae7d25a2aaec1608f8ad16a64ef5afb7
chromium: 20 tests descubiertos; 19 passed con 1 retry
global-settings: 3 passed
notifications.spec.ts: NO descubierto en esta rama
```

Por eso ese job verde no prueba T-333.

## RED externo de reconnect

Control externo: PR #180 / T-307, trusted run `37138561471`.

Se descargó y revisó su artifact `playwright-report`. Se omiten deliberadamente cookies, credenciales de fixtures y cualquier dato sensible.

```text
GET inicial exacta /api/live/requests/<requestId>/offers: HTTP 200
payload inicial: data vacía + nextCursor null
baseline de requests: 1
setOffline(true): la UI muestra el aviso offline
setOffline(false): la UI vuelve a online
expect.poll durante 15 s: received = 1
esperado: > 1
resultado: RED
```

## Diff de reconnect en #236

```text
src/features/requests/hooks/use-request-offers.ts    SIN CAMBIOS
src/app/providers.tsx                               SIN CAMBIOS
src/features/requests/hooks/use-request-offers.test.tsx
  + onlineManager.setOnline(false)
  + onlineManager.setOnline(true)
  + baseline posterior al fetch inicial
```

Conclusión: el test unitario nuevo demuestra `onlineManager → Query`; no toca `browser → onlineManager`.

## Enumeración de clase

```text
useAvailableRequests -> refetchOnReconnect: 'always'
useRequestOffers     -> refetchOnReconnect: 'always'
useTrip              -> refetchOnReconnect: 'always'
Providers            -> QueryClientProvider global
```

La corrección debe ser global; no se aceptan listeners + `refetch()` por hook.

## Mutaciones obligatorias para la próxima entrega

### M1 — reconnect del hook

Mutación temporal:

```diff
- refetchOnReconnect: 'always',
+ refetchOnReconnect: false,
```

Comando:

```bash
pnpm vitest run src/features/requests/hooks/use-request-offers.test.tsx
```

Esperado: RED específicamente en el caso de reconnect posterior al baseline. Restaurado: GREEN.

### M2 — readiness de Realtime

Mutación temporal: eliminar/neutralizar únicamente el catch-up dentro del callback `SUBSCRIBED`.

```bash
pnpm vitest run src/lib/hooks/use-realtime-invalidation.test.tsx
```

Esperado: RED en los controles `SUBSCRIBED`; restaurado: GREEN.

### M3 — bridge global

Una vez agregado `src/app/providers.test.tsx`, mutar temporalmente la integración de `onlineManager.setEventListener` para que no sincronice el estado inicial / no propague `offline`.

```bash
pnpm vitest run src/app/providers.test.tsx
```

Esperado: RED en el control browser → `onlineManager`; restaurado: GREEN.

Las mutaciones deben hacerse con un harness auxiliar en `/tmp` que guarde el contenido original en memoria y lo restaure en `finally`. No usar `git checkout`, no commitear mutaciones y no adulterar expectativas para obtener verde.
