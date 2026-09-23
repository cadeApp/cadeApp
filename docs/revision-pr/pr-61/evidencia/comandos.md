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

### 3. Checks locales

```powershell
pnpm typecheck; pnpm lint; pnpm test
```

Salida:

```text
tsc --noEmit && tsc --project .github/workflows/tsconfig.json -> exit 0
✔ No ESLint warnings or errors -> exit 0
Test Files  1 failed | 17 passed (18)
     Tests  1 failed | 138 passed (139)
```

El fallo es `verify-scaffold.test.ts > DoD (a): ESLint debe fallar ante un import profundo a components de otra feature` (timeout 5000ms en ESLint). Es un fallo preexistente por timeout de ESLint, no introducido por esta PR.

### 4. CI real

```powershell
gh pr checks 61 --json name,state
```

Salida:

```json
[
  { "name": "bundle-budget", "state": "SUCCESS" },
  { "name": "approval-policy", "state": "FAILURE" },
  { "name": "typecheck", "state": "SUCCESS" },
  { "name": "lint", "state": "SUCCESS" },
  { "name": "unit", "state": "SUCCESS" },
  { "name": "db-tests", "state": "SUCCESS" },
  { "name": "build", "state": "SUCCESS" },
  { "name": "audit", "state": "SUCCESS" }
]
```

`approval-policy` falla porque la revisión independiente aún no se pegó.

### 5. Formato Prettier

```powershell
npx prettier --check middleware.ts "src/features/merchants/**" "src/app/(merchant)/onboarding/page.tsx" docs/tasks/T-111.md docs/tasks/log/T-111.md
```

Salida:

```text
Checking formatting...
[warn] docs/tasks/log/T-111.md
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```

### 6. Verificaciones específicas de hallazgos

```powershell
# H01: server-only faltante en server.ts
grep -c "server-only" src/features/merchants/server.ts
# -> 0

# H02: doble cast en actions.ts
grep "as unknown as" src/features/merchants/actions.ts
# -> const supabase = (await createClient()) as unknown as AppSupabaseClient;

# H03: react-hook-form no usado
grep -c "react-hook-form" src/features/merchants/components/onboarding-form.tsx
# -> 0

# H04: fallback '1.0'
grep "'1.0'" src/features/merchants/actions.ts
# -> : '1.0';

# H05: strings hardcodeados
grep "Obteniendo ubicación" src/features/merchants/components/onboarding-form.tsx
# -> {locating ? 'Obteniendo ubicación...' : merchantCopy.onboarding.useMyLocation}
grep "Ubicación marcada" src/features/merchants/components/onboarding-form.tsx
# -> Ubicación marcada: ({defaultPickupLat.toFixed(4)}, {defaultPickupLng.toFixed(4)})

# H06: checkbox size
grep "h-4 w-4" src/features/merchants/components/onboarding-form.tsx
# -> className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"

# H07: arbitrary value
grep "min-h-\[" src/features/merchants/components/onboarding-form.tsx
# -> min-h-[80px]

# text-xs check (ninguno encontrado)
grep -c "text-xs" src/features/merchants/components/onboarding-form.tsx
# -> 0
```
