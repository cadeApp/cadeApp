# Comandos reproducibles — PR #117 / R5

## CI del SHA `aea137697424c0da86d256c0675b0ca6a7267eda`

Workflow: CI #538.

Suites relevantes observadas en logs:

```text
courier-panel.test.tsx       16 tests PASS
offline-state.test.tsx        5 tests PASS
visual-verification.test.tsx  7 tests PASS
ios-install-guide.test.tsx    2 tests PASS
sw.test.ts                    9 tests PASS
manifest.test.ts              4 tests PASS
Total                         98 files / 1260 tests PASS
DB                            12 files / 1601 tests PASS
```

## Comparación de bundle

develop `57badabc...`:

```text
/courier/feed   176 kB  OK
/courier/offers 176 kB  OK
```

PR `aea137697424c0da86d256c0675b0ca6a7267eda`:

```text
/courier/feed   244 kB  Supera el límite
/courier/offers 244 kB  Supera el límite
```

## Después del arreglo H11

```bash
pnpm build 2>&1 | tee build-output.txt
node .github/workflows/check-bundle-budget.mjs build-output.txt
pnpm typecheck
pnpm lint
pnpm test
```

Criterio:
- `/courier/feed <= 180 kB`
- `/courier/offers <= 180 kB`

No usar el conclusion=success del job advisory como sustituto del número real.
