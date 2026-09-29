# Evidencia y comandos — PR #61

## Ronda 1 (`49642ed4e18a23909587545f04642149ad736f57`)

### 1. Worktree aislado e instalación congelada

```powershell
git worktree add --detach ../cadeApp-rev61 49642ed4e18a23909587545f04642149ad736f57
pnpm -C ../cadeApp-rev61 install --frozen-lockfile
```

Salida:

```text
HEAD is now at 49642ed docs(T-111): session log
Lockfile is up to date, resolution step is skipped
Packages: +518
Done in 49.8s using pnpm v10.28.0 (exit code 0)
```

### 2. Alcance contra `docs/tasks/T-111.md`

```powershell
gh pr diff 61 --name-only
```

Salida (13 archivos, 0 fuera de «Archivos permitidos»):

```text
docs/tasks/T-111.md
docs/tasks/log/T-111.md
src/app/(merchant)/onboarding/page.tsx
src/features/merchants/actions.test.ts
src/features/merchants/actions.ts
src/features/merchants/components/onboarding-form.tsx
src/features/merchants/copy.ts
src/features/merchants/index.ts
src/features/merchants/queries.test.ts
src/features/merchants/queries.ts
src/features/merchants/schemas.test.ts
src/features/merchants/schemas.ts
src/features/merchants/server.ts
```

### 3. Checks locales y formato Prettier

```powershell
pnpm typecheck; pnpm lint; pnpm test
npx prettier --check middleware.ts "src/features/merchants/**" "src/app/(merchant)/onboarding/page.tsx" docs/tasks/T-111.md docs/tasks/log/T-111.md
```

Salida:

```text
tsc --noEmit && tsc --project .github/workflows/tsconfig.json -> exit 0
✔ No ESLint warnings or errors -> exit 0
Checking formatting...
[warn] docs/tasks/log/T-111.md
```

---

## Ronda 2 (`efd8d9f8db8337ea48fc97ed79cd2e12b73b4a96`)

### 1. Worktree aislado e instalación congelada

```powershell
git worktree add --detach ../cadeApp-rev61 efd8d9f8db8337ea48fc97ed79cd2e12b73b4a96
pnpm -C ../cadeApp-rev61 install --frozen-lockfile
```

Salida:

```text
HEAD is now at efd8d9f docs(T-111): session log round 1 fixes
Lockfile is up to date, resolution step is skipped
Packages: +518
Done in 44.1s using pnpm v10.28.0 (exit code 0)
```

### 2. Alcance y verificación de propiedad (`AG-36`)

```powershell
git diff d57820d..efd8d9f --stat
```

Salida (7 archivos tocados por el autor en Ronda 2; `docs/revision-pr/pr-61/**` intacto):

```text
 docs/tasks/log/T-111.md                            |  21 +++
 src/features/merchants/actions.test.ts             |  57 +++++++
 src/features/merchants/actions.ts                  |  42 +++--
 src/features/merchants/components/form-hooks.ts    | 148 +++++++++++++++++
 .../merchants/components/onboarding-form.tsx       | 179 ++++++++++++---------
 src/features/merchants/copy.ts                     |   6 +
 src/features/merchants/server.ts                   |   2 +
 7 files changed, 365 insertions(+), 90 deletions(-)
```

### 3. Checks locales y logs reales de CI (`run 35832549815`)

```powershell
pnpm typecheck; pnpm lint; pnpm test
npx prettier --check "src/features/merchants/**" "src/app/(merchant)/onboarding/page.tsx" docs/tasks/T-111.md docs/tasks/log/T-111.md
```

Salida:

```text
tsc --noEmit && tsc --project .github/workflows/tsconfig.json -> exit 0
✔ No ESLint warnings or errors -> exit 0
Test Files  18 passed (18)
     Tests  140 passed (140)
# verify-workflows.test.mjs: pass 19, fail 0
# verify-adr.test.mjs: pass 6, fail 0
All matched files use Prettier code style!
```

Cobertura de `src/features/merchants` y `bundle-budget` en CI (`run 35832549815`):

```text
actions.ts    |   89.36 |    69.23 |     100 |   89.36 |
queries.ts    |     100 |      100 |     100 |     100 |
schemas.ts    |     100 |      100 |     100 |     100 |

| Ruta        | Tamaño | Estado |
| /onboarding | 124 kB | OK     |
```

### 4. Probe ejecutable de verificación de Ronda 2 (`probe-ronda-2.test.ts`)

Ejecutado sobre `efd8d9f` y retirado antes de commitear:

- `H01`: `src/features/merchants/server.ts` comienza con `import 'server-only';` ✅
- `H03`: `zodResolver(merchantOnboardingSchema)` devuelve errores por campo e integra con `useForm` ✅
- `H04` y `H08`: `merchantOnboardingAction` rechaza `pilot_terms_version` vacío (`"   "`) o `null` con `INTERNAL_ERROR` y omite `accepted_at` al insertar en `consents` ✅
