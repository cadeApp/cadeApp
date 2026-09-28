# Comandos reproducibles — PR #117 / R6

## SHA revisado

`5e48b7809c0ceb62743f23162b5061dfabdfad4e`

## H11 verificado en CI #548

```text
/courier/feed   177 kB  OK
/courier/offers 177 kB  OK
99 test files / 1271 tests PASS
```

develop actual `c91ec4e...`:

```text
/courier/feed   176 kB  OK
/courier/offers 176 kB  OK
```

## H12

Debe desaparecer:

```ts
// eslint-disable-next-line boundaries/entry-point
import { useOfflineStatus } from '@/features/notifications/offline/use-offline-status';
```

Y quedar:

```ts
import { useOfflineStatus } from '@/features/notifications';
```

Comprobación:

```bash
git grep -n "boundaries/entry-point" -- src/features/offers/components/courier-feed.tsx
```

Debe devolver 0 líneas.

## Sincronización y batería final

```bash
git fetch origin
git merge origin/develop

pnpm typecheck
pnpm lint
pnpm test
pnpm build 2>&1 | tee build-output.txt
node .github/workflows/check-bundle-budget.mjs build-output.txt

git status --short
```

Criterio:
- courier feed/offers <=180 kB;
- no reintroducir import profundo si el tamaño sube;
- pedir revisión del SHA remoto después del push.
