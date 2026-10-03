# Evidencia reproducible — PR #228 / Ronda 1

**SHA revisado:** `a3d13d72a440f2523698b83ce93d5330469cc3af`

## Sincronización

```text
git rev-list --left-right --count origin/develop...origin/fix/e2e-notifications-gate
0	1
```

## Workflow tests en el SHA (worktree sin node_modules)

```text
node --test .github/workflows/verify-workflows.test.mjs
# tests 47 · pass 46 · fail 1
not ok 4 - workflow lint rejects unused code and debugger statements   ← ESLint sin node_modules: entorno, no la PR
```

## Mutaciones (H01)

Comando: `node --test --test-name-pattern="E2E" .github/workflows/verify-workflows.test.mjs`

```text
base   ok 1 staging · ok 3 preview
M1     borrar bloque notifications en e2e-preview.yml                → not ok 3   (detecta)
M2     mover bloque debajo de `pnpm exec playwright test "${specs[@]}" --project=chromium` en e2e-preview.yml → ok 3   (NO detecta)
M3     ídem en e2e-staging.yml                                       → ok 1       (NO detecta)
```

Se restauró con `git checkout -- .` después de cada una.

## CI del SHA (run 37098079861 / approval-policy 37098080066)

```text
approval-policy  fail  «Falta el informe completo de revisar-pr sin bloqueantes.»  → H03
audit            fail  braces high (eslint-config-next) · advisory · igual que develop run 37097482053
build            fail  next/font: TypeError: Cannot read properties of null (reading '1') en src/app/layout.tsx
                       → no aparece en develop 37097482053 ni en 37097970172 / 37097326057: red del runner, re-ejecutar
typecheck, lint, unit, db-tests  pass
e2e-preview      pending (este SHA no trae notifications.spec.ts)
```

## Spec revisado para compatibilidad con el gate

`origin/feat/T-307-notificaciones-resiliencia:e2e/specs/notifications.spec.ts` (head `0666c26`): 3 tests, usa
`stagingContext`, `loginAsMerchant`, `createAdminClient` y `setOffline`; no necesita otro proyecto de Playwright ni
variables que el step no entregue.
