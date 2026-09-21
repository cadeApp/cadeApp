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
