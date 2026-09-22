# PR #51 · Comandos y salidas

## Ronda 1 — `631dc1e`

### Alcance

```
base: cdf6d13 · archivos: 7 · FUERA DE ALCANCE: 0 (ninguno)
```

Contrastado contra la ficha post-#50: `.github/workflows/**`, `docs/tasks/T-003.md`, `docs/tasks/log/T-003.md`.

### Checks de CI en la PR

```
db-types        fail   39s
audit           pass   24s
build           pass   57s
bundle-budget   pass    7s
db-tests        pass   23s
lint            pass   24s
typecheck       pass   27s
unit            pass   43s
```

Local: `pnpm typecheck` exit 0 · `pnpm lint` limpio · `pnpm test` 71/71 · `pnpm build` exit 0 (87.2 kB).

### H01 · El ref de producción es el de staging

```bash
gh api repos/cadeApp/cadeApp/actions/variables --jq '.variables[] | {name,value}'
```

```json
{"name":"SUPABASE_PROJECT_REF","value":"axwvmyqwhwfghyjdufny"}
```

```bash
gh api repos/cadeApp/cadeApp/environments/staging/variables     # (vacío)
gh api repos/cadeApp/cadeApp/environments/production/variables  # (vacío)
```

Una sola variable, a nivel repositorio, apuntando al proyecto de staging. Ningún environment define una que la pise, así que `migrate-production` resuelve el ref de staging. El guard del job solo comprueba que no esté vacía.

### H02 · El environment de producción no atája nada todavía

```bash
gh api repos/cadeApp/cadeApp/environments/production --jq '{name, protection_rules}'
gh api repos/cadeApp/cadeApp/environments/staging    --jq '{name, protection_rules}'
```

```json
{"name":"production","protection_rules":[]}
{"name":"staging","protection_rules":[]}
```

Sin revisores obligatorios, detrás del `if: github.actor == 'Lautaro073'` —que saltea, no bloquea— no hay nada.

### H05 · Los `.mjs` fuera del alcance de los checks

```bash
grep -n "include" vitest.config.ts
#   include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.{ts,tsx}']

pnpm test | grep "Test Files"
#   Test Files  9 passed (9)      ← verify-workflows.test.mjs no aparece
```

`tsconfig.include` es `**/*.ts` y `**/*.tsx`; `pnpm lint` corre sobre `--dir src --file middleware.ts`. Los dos scripts solo se ejercitan con `node --test`, dentro del job `unit` de CI.

## Ronda 2 — `a5df3a9`

Las cuatro demostraciones en rojo están en [`../revisiones/ronda-2.md`](../revisiones/ronda-2.md). Cada rotura en el worktree dejó la suite en `11 pass 1 fail`; restaurada, `12 pass 0 fail`.

## Ronda 3 — `1381d86`

### Alcance

```bash
gh pr diff 51 --name-only
```

13 archivos: 7 bajo `.github/workflows/`, 3 bajo `docs/revision-pr/pr-51/`, `docs/tasks/T-003.md`, `docs/tasks/log/T-003.md` y `package.json`. **0 fuera de alcance.**

### H05 · Las cinco demostraciones en rojo

Cada caso rompe un control, corre `node --test .github/workflows/verify-workflows.test.mjs` y restaura:

```
[base] sin tocar nada                      pass 16 / fail 0
saco node --test de pnpm test              pass 15 / fail 1  -> pnpm test includes workflow behavior tests
saco eslint de pnpm lint                   pass 15 / fail 1  -> pnpm lint checks workflow modules...
saco tsc --project de pnpm typecheck       pass 15 / fail 1  -> pnpm typecheck checks workflow modules...
pongo checkJs en false                     pass 15 / fail 1  -> pnpm typecheck checks workflow modules...
vacio el include del tsconfig              pass 15 / fail 1  -> pnpm typecheck checks workflow modules...
[restaurado]                               pass 16 / fail 0
```

### H05 · El typecheck atrapa un error de tipos real

```
.github/workflows/check-bundle-budget.mjs(52,50): error TS2551:
  Property 'toFixed' does not exist on type 'string'.
TC_EXIT=2
```

Y en el runner, que es la evidencia que vale:

```bash
gh api repos/cadeApp/cadeApp/actions/runs/35676222759 --jq '"head_sha=\(.head_sha) conclusion=\(.conclusion)"'
```

```
head_sha=98d6d3b  conclusion=failure
typecheck  failure
lint       success
```

### H06 · En rojo

Revertido el arreglo al `console.warn` único:

```
not ok 9 - bundle budget fails when no route can be read from the build output
# tests 16 · pass 15 · fail 1
```

Y el job real midió rutas de verdad, así que el `exit 1` nuevo no dispara por sorpresa:

```bash
gh api repos/cadeApp/cadeApp/actions/jobs/106584217862/logs --allow-escape-sequences
```

```
## First Load JS por ruta (límite 180 kB)
| / | 87.2 kB | OK |
| /_not-found | 88 kB | OK |
```

### H07 · El lint corre, lee los archivos y no puede fallar

```bash
npx eslint --no-ignore --ext .mjs .github/workflows -f json   # 3 archivos, 0 mensajes
npx eslint --no-ignore --print-config .github/workflows/check-bundle-budget.mjs
```

55 reglas activas: todas `@next/next/*`, `react/*`, `react-hooks/*`, `jsx-a11y/*`, `boundaries/*` (con `include` limitado a `src/**`) o `cadeapp/*`. **No hay `eslint:recommended`.**

Con cinco defectos clásicos plantados en `check-bundle-budget.mjs`:

```
$ pnpm lint
✔ No ESLint warnings or errors
LINT_EXIT=0
```

Con un `.eslintrc.json` dentro de `.github/workflows/` (`eslint:recommended` + `env: node`), los mismos defectos:

```
no-unused-vars · no-unreachable · no-constant-condition · no-empty · no-debugger
✖ 7 problems   ESLINT_EXIT=1
```

El séptimo es `no-regex-spaces` en `verify-workflows.test.mjs:23`, real y ya en el árbol.

### H08 · La política corrida contra el cuerpo real

```bash
gh pr view 51 --json body --jq .body            > body-51.txt
gh api repos/cadeApp/cadeApp/pulls/51/reviews   > reviews-51.json   # []
node -e "import('...approval-policy.mjs')"      # evaluateApprovalPolicy
```

```
--- tal como está el PR #51 hoy ---
{ ok: false, reason: 'El PR de Lautaro073 requiere aprobación de otra persona.' }
--- suponiendo que P2 ya aprobó ---
{ ok: false, reason: 'Falta el informe completo de revisar-pr sin bloqueantes.' }
--- con el informe en el formato que exige la skill ---
{ ok: true, reason: 'Aprobación externa e informe completos.' }
```

Por qué no frena a esta PR:

```bash
git ls-tree origin/develop .github/workflows/    # (vacío)
```

`pull_request_target` usa la definición de la rama base, y ahí todavía no hay workflows.

### H11 · Prettier

```bash
npx prettier --check .github/workflows/ci.yml middleware.ts docs/onboarding.md docs/tasks/T-002.md
```

Falla en los cuatro, y esta PR no tocó ninguno. El diff contra la salida de Prettier es `1,50c1,50` con contenido idéntico: solo difieren los fines de línea. `core.autocrlf=true`, sin `.gitattributes`, `.prettierrc` sin `endOfLine`.
