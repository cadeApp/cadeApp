# Evidencia y comandos — PR #60

## Ronda 1 (`b29eca168784ce105f8304b3d325305b130f5c31`)

### 1. Worktree aislado e instalación congelada

```powershell
git worktree add --detach ../cadeApp-rev60 b29eca168784ce105f8304b3d325305b130f5c31
pnpm -C ../cadeApp-rev60 install --frozen-lockfile
```

Salida:

```text
HEAD is now at b29eca1 docs(T-009): session log
Lockfile is up to date, resolution step is skipped
Packages: +518
Done in 32s using pnpm v10.28.0 (exit code 0)
```

### 2. Alcance contra `docs/tasks/T-009.md`

```powershell
gh pr diff 60 --name-only
```

Salida (18 archivos, 0 fuera de «Archivos permitidos»):

```text
docs/tasks/T-009.md
docs/tasks/log/T-009.md
middleware.ts
src/app/(public)/login/page.tsx
src/app/(public)/register/page.tsx
src/features/auth/actions.test.ts
src/features/auth/actions.ts
src/features/auth/components/login-form.tsx
src/features/auth/components/register-form.tsx
src/features/auth/copy.ts
src/features/auth/guards.test.ts
src/features/auth/guards.ts
src/features/auth/index.ts
src/features/auth/queries.test.ts
src/features/auth/queries.ts
src/features/auth/query-keys.ts
src/features/auth/schemas.ts
src/features/auth/server.ts
```

### 3. Checks locales y logs reales de CI

```powershell
pnpm typecheck && pnpm lint && pnpm test
```

Salida:

```text
tsc --noEmit && tsc --project .github/workflows/tsconfig.json -> exit 0
✔ No ESLint warnings or errors -> exit 0
Test Files  14 passed (14)
     Tests  116 passed (116)
# verify-workflows.test.mjs: pass 19, fail 0
# verify-adr.test.mjs: pass 6, fail 0
```

Verificación de `db-tests` y `bundle-budget` en el log de CI (`run 35814929519`):

```powershell
gh run view 35814929519 --job 107034313474 --log | Select-String -Pattern "Tests=|Result:|supabase start"
gh run view 35814929519 --job 107034521790 --log | Select-String -Pattern "Ruta|login|register"
```

Salida:

```text
pnpm supabase start
Files=3, Tests=98,  0 wallclock secs ( 0.03 usr  0.01 sys +  0.03 cusr  0.01 csys =  0.08 CPU)
Result: PASS

| Ruta | Tamaño | Estado |
| / | 102 kB | OK |
| /_not-found | 103 kB | OK |
| /login | 109 kB | OK |
| /register | 109 kB | OK |
```

Cobertura de `src/features/auth` en el log del job `unit` (`107034313445`):

```text
features/auth     |   61.32 |    74.32 |      80 |   61.32 |
  actions.ts      |   83.95 |       60 |     100 |   83.95 | ...64,80-84,87-88
  guards.ts       |   89.81 |    88.09 |     100 |   89.81 | ...24-128,140-141
  queries.ts      |     100 |     62.5 |     100 |     100 | 31-36
  schemas.ts      |     100 |      100 |     100 |     100 |
  server.ts       |       0 |        0 |       0 |       0 | 1-77
```

### 4. Probe ejecutable de Ronda 1 (`probe-ronda-1.test.ts`)

Ejecutado sobre `b29eca1` con `pnpm typecheck && pnpm vitest run src/features/auth/probe-ronda-1.test.ts` y retirado antes de commitear:

```text
 RUN  v3.2.7 C:/Users/El Yisus Pai/Desktop/Proyectos/cadeApp-rev60

 ✓ src/features/auth/probe-ronda-1.test.ts (4 tests) 11ms
   ✓ H01: getServerSession y loginAction escalan silenciosamente a role="merchant" cuando profiles devuelve null
   ✓ H02: evaluateRouteGuard permite a anon entrar a rutas reales de (admin)/(merchant)/(courier), permite a courier/merchant entrar a /couriers y /merchants de admin, y cicla en /login/mfa
   ✓ H03: updateSession pierde las cookies rotadas por Supabase Auth cuando devuelve una redirección
   ✓ H04 & H06: LoginForm permite Open Redirect sin validar redirectTo, RegisterAction no valida acceptTerms y hay 5 usos de text-xs

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### 5. Formato Prettier (`H07`)

```powershell
npx prettier --check middleware.ts "src/features/auth/**" "src/app/(public)/login/page.tsx" "src/app/(public)/register/page.tsx" docs/tasks/T-009.md docs/tasks/log/T-009.md
```

Salida:

```text
Checking formatting...
[warn] src/features/auth/guards.ts
[warn] docs/tasks/log/T-009.md
[warn] Code style issues found in 2 files. Run Prettier with --write to fix.
```

---

## Ronda 2 (`576d6fe55ccaa1cf6f87e0ed0f47cd0b6186cee7`)

### 1. Worktree aislado e instalación congelada

```powershell
git worktree add --detach ../cadeApp-rev60 576d6fe55ccaa1cf6f87e0ed0f47cd0b6186cee7
pnpm -C ../cadeApp-rev60 install --frozen-lockfile
```

Salida:

```text
HEAD is now at 576d6fe docs(T-009): session log
Lockfile is up to date, resolution step is skipped
Packages: +518
Done in 31.3s using pnpm v10.28.0 (exit code 0)
```

### 2. Alcance y verificación de propiedad (`AG-36`)

```powershell
gh pr diff 60 --name-only
git log 52a685c..576d6fe --name-only
```

Salida: 19 archivos de tarea + 5 archivos de `docs/revision-pr/pr-60/**` (creados en `52a685c` y **no tocados** por `409b509` ni `576d6fe`).

### 3. Checks locales y logs reales de CI (`run 35818656558`)

```powershell
pnpm typecheck && pnpm lint && pnpm test
npx prettier --check middleware.ts "src/features/auth/**" "src/app/(public)/login/page.tsx" "src/app/(public)/register/page.tsx" docs/tasks/T-009.md docs/tasks/log/T-009.md
```

Salida:

```text
tsc --noEmit && tsc --project .github/workflows/tsconfig.json -> exit 0
✔ No ESLint warnings or errors -> exit 0
Test Files  15 passed (15)
     Tests  126 passed (126)
# verify-workflows.test.mjs: pass 19, fail 0
# verify-adr.test.mjs: pass 6, fail 0
All matched files use Prettier code style!
```

Cobertura de `src/features/auth` y `db-tests` / `bundle-budget` en CI (`run 35818656558`):

```text
features/auth     |   89.42 |    83.62 |     100 |   89.42 |
  actions.ts      |   77.89 |    62.06 |     100 |   77.89 |
  guards.ts       |   89.79 |     91.8 |     100 |   89.79 |
  queries.ts      |     100 |    88.88 |     100 |     100 |
  schemas.ts      |     100 |      100 |     100 |     100 |
  server.ts       |   97.05 |    85.71 |     100 |   97.05 | 40-41

pnpm supabase start
Files=3, Tests=98, Result: PASS

| Ruta | Tamaño | Estado |
| /login | 110 kB | OK |
| /register | 110 kB | OK |
```

### 4. Probe ejecutable de verificación de Ronda 2 (`probe-ronda-2.test.ts`)

Ejecutado sobre `576d6fe` con `pnpm typecheck && pnpm vitest run src/features/auth/probe-ronda-2.test.ts` y retirado antes de commitear:

```text
 RUN  v3.2.7 C:/Users/El Yisus Pai/Desktop/Proyectos/cadeApp-rev60

 ✓ src/features/auth/probe-ronda-2.test.ts (4 tests) 20ms
   ✓ H01 FIXED: getServerSession, updateSession y loginAction rechazan sesión cuando profiles devuelve null o rol inválido
   ✓ H02 FIXED: evaluateRouteGuard protege rutas reales de (admin)/(merchant)/(courier) sin prefijo, bloquea colisión /couriers y /merchants, y permite /login/mfa para admin aal1
   ✓ H03 FIXED: updateSession preserva las cookies rotadas por Supabase Auth cuando devuelve una redirección 307
   ✓ H04 & H06 FIXED: resolvePostLoginRedirect bloquea Open Redirect y rutas de otro rol; registerAction exige acceptTerms; 0 usos de text-xs y ojo de 48x48px

 Test Files  1 passed (1)
      Tests  4 passed (4)
```
