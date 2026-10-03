# Evidencia reproducible — PR #240 / Ronda 1

**SHA inspeccionado:** `5c31ed86db8cacd923367deaa190c5880e0b60e5`

## H01 · Excepción demasiado amplia

Inspección de rutas del árbol del SHA revisado:

```text
src/app/(courier)/courier/profile/page.tsx
src/app/(courier)/courier/profile/notifications/page.tsx
```

Código causante:

```ts
matchesSegment(pathname, '/courier/profile')
```

Sonda que debe agregarse:

```ts
expect(followGuard('/courier/profile/notifications', baseSession('courier', false)))
  .toBe('/courier/onboarding/identity');
```

Mutación de validación: reemplazar temporalmente la igualdad exacta corregida por `matchesSegment(pathname, '/courier/profile')`; la sonda debe fallar.

## H02 · Marcador antes del final

Orden observado en `src/features/courier-onboarding/actions.ts`:

- ~105: arma `courierUpdatePayload`;
- ~111: update de `couriers`;
- ~139: upsert de `consents`;
- ~196: upsert de `courier_documents`.

Casos requeridos:

```text
consents error  -> INTERNAL_ERROR + courier update 0 llamadas
documents error -> INTERNAL_ERROR + courier update 0 llamadas
```

Mutación de validación: adelantar nuevamente el update de courier antes de `consents`; los casos negativos deben ponerse rojos.

## D02 · Fail-open

Mutación de validación:

```ts
// solo para demostrar RED, restaurar después
if (onboarding?.error) onboardingComplete = false;
```

Los tests de error de lectura en `server.test.ts` y `actions.test.ts` deben fallar.

## CI independiente del SHA revisado

GitHub Actions CI run `37157587796` (run #1069): SUCCESS.

Jobs observados:
- build ✅
- lint ✅
- audit ✅
- typecheck ✅
- unit / test:coverage ✅
- db-tests ✅
- bundle-budget ✅

Commit statuses:
- Vercel ✅
- e2e-preview ✅

## Ronda 2 — comandos finales pedidos a agy

```bash
pnpm vitest run src/features/auth/guards.test.ts src/features/auth/server.test.ts src/features/auth/actions.test.ts src/features/courier-onboarding/actions.test.ts src/features/courier-onboarding/components.test.tsx
pnpm typecheck
pnpm lint
pnpm test
node tools/verify-fichas.test.mjs
```

Si el nombre/ruta real de `verify-fichas` difiere, usar el comando ya existente del repo; no crear un sustituto que siempre pase.
