# Comandos y evidencia — PR #117 / R7

## SHA revisado

`52b47f80f501a070fc20b8847bd3acc12d12d158`

## Sincronización

```text
develop: c5d2612d211469468ec1ee465939c4b46fa9a6ba
PR:      52b47f80f501a070fc20b8847bd3acc12d12d158
ahead:   18
behind:  0
mergeable: true
```

## H12

Código actual:

```ts
import { useOfflineStatus } from '@/features/notifications';
```

CI #556:

```text
pnpm lint
✔ No ESLint warnings or errors
```

La bitácora documenta RED del autor al mantener el import profundo sin el disable:
```text
boundaries/entry-point
No rule allows the entry point 'offline/use-offline-status.ts'
```

Intento de mutación independiente local:

```text
git clone https://github.com/cadeApp/cadeApp.git
fatal: Could not resolve host: github.com
```

No se declara una mutación independiente que no pudo ejecutarse.

## R01 · bundle

develop CI #553:

```text
/courier/feed    176 kB  OK
/courier/offers  176 kB  OK
```

PR CI #556:

```text
/courier/feed    198 kB  Supera el límite
/courier/offers  198 kB  Supera el límite
```

## CI #556 completo

```text
typecheck ✅
lint ✅
build ✅
unit ✅  99 files / 1312 tests
db-tests ✅ 12 files / 1601 tests
audit ✅ advisory (2 vulnerabilities)
bundle-budget ✅ advisory, PERO courier 198 kB
```

## Comandos exigidos después del fix R01

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build 2>&1 | tee build-output.txt
node .github/workflows/check-bundle-budget.mjs build-output.txt
git status --short
```

Criterio:
- `/courier/feed <= 180 kB`
- `/courier/offers <= 180 kB`
- `CourierFeed` sigue importando desde `@/features/notifications`
- 0 `eslint-disable boundaries/entry-point`
