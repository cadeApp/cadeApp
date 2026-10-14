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


---

# Evidencia reproducible — PR #228 / Ronda 2

**SHA funcional revisado:** `c911032b2af21aced5a30121e2100aae834b4eca`.

## Sincronización

Al comenzar R2:
```text
develop: abf89d8ec9019667c227fbe6ce2534aea1762dbe
head:    3e96b94695f6800a7c90d3f89694f436433b9dc4
ahead: 3
behind: 15
```

El reverse compare mostró que esos 15 commits de `develop` no tocaban ninguno de los archivos funcionales de #228. La revisión hizo merge normal de `develop` y dejó:

```text
head: c911032b2af21aced5a30121e2100aae834b4eca
ahead: 4
behind: 0
```

## H01 — verificación independiente

Se inspeccionó el helper exacto de `verify-workflows.test.mjs`:

```text
assertOptionalSpecBeforeChromiumRun(script, spec, message)
  -> exige bloque if/specs+=/fi exacto
  -> localiza la invocación chromium
  -> exige block.index < run.index
```

Mutación independiente usando ese mismo helper y los bloques reales:

```text
base: GREEN
notifications moved after run: RED detected
request-states moved after run: RED detected
```

Además, en CI del SHA `c911032b`, el step
`node --test .github/workflows/verify-workflows.test.mjs` quedó GREEN dentro del job `unit` del run `37099538822`.

## H02 — alcance

La excepción quedó documentada en `docs/tasks/T-327.md` y se conserva como **aceptada**, no como “verificada”:
- selección condicional de `notifications.spec.ts` también en `e2e-staging.yml`;
- sin cambios de environment, secrets, permisos ni concurrency;
- precedente #207;
- decisión P1 registrada en Ronda 1.

## H03/H04 — approval-policy y evidencia

Antes del fix de metadata, los runs `37099327204` / `37099342442` fallaron con:

```text
Falta el informe completo de revisar-pr sin bloqueantes.
```

La causa residual era que el cuerpo tenía:

```text
## Informe de revisión de agy
```

mientras `approval-policy.mjs` busca exactamente:

```text
### Informe de revisión de agy
```

La revisión corrigió el heading del cuerpo. Sobre `c911032b`:
- approval-policy run `37099538025` / #1217: GREEN;
- tras aclarar el alcance del body, approval-policy run `37099669903` / #1219: GREEN.

La bitácora T-327 y el bloque de checks ya estaban presentes desde `3e96b94`.

## CI del SHA funcional R2

Run `37099538822`:
- typecheck ✅
- lint ✅
- build ✅
- unit / coverage ✅
- `verify-workflows.test.mjs` ✅
- ADR ✅
- bundle-budget ✅
- db-tests: ejecutándose al momento de cerrar el archivo de evidencia; la rama no cambia DB respecto del `develop@abf89d8`, cuyo db-tests ya estaba GREEN.
- audit ❌ por `braces`: **mismo advisory preexistente en `develop` run 37098671655** (2 moderate + 1 high). No es introducido por #228.

## Runtime del gate

El status `e2e-preview` de #228 no puede validar la inclusión nueva: el workflow trusted se toma de `develop`, donde #228 todavía no fue mergeada. Esa limitación es intencional del modelo de seguridad.

La validación runtime real de `notifications.spec.ts` se hace post-merge sobre PR #180 sincronizada.
