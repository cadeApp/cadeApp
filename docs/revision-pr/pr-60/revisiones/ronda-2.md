# Revisión PR #60 — T-009 (`feat/T-009-auth-base`) · Ronda 2

- **Resultado:** **SIN BLOQUEANTES**
- **Rama / SHA revisado:** `feat/T-009-auth-base` @ `576d6fe55ccaa1cf6f87e0ed0f47cd0b6186cee7` (`576d6fe`, fix principal en `409b509`)
- **Ronda anterior:** [`ronda-1.md`](ronda-1.md) (`b29eca168784ce105f8304b3d325305b130f5c31`, 6 bloqueantes `H01`–`H06` + 1 mejora `H07`)
- **Alcance verificado contra `docs/tasks/T-009.md`:** 19 archivos de tarea + 5 archivos de `docs/revision-pr/pr-60/**` (**0 fuera de «Archivos permitidos»**, **0 modificaciones del autor sobre `docs/revision-pr/pr-60/**`**, respetando `AG-36`)
- **Checks ejecutados en worktree aislado (`../cadeApp-rev60`) + CI real (`run 35818656558`):**
  - `pnpm typecheck`: `0 errores` (exit 0)
  - `pnpm lint`: `✔ No ESLint warnings or errors` (exit 0)
  - `pnpm test`: `15 passed (15)` · `126 passed (126)` + `verify-workflows` (19/19) + `verify-adr` (6/6) (exit 0)
  - `db-tests` (log de CI job `107045581673`): `pnpm supabase start` ejecutado; `Files=3, Tests=98, Result: PASS`
  - `bundle-budget` (log de CI job `107045809313`): `/login` `110 kB`, `/register` `110 kB` (presupuesto `180 kB`)
  - Cobertura `src/features/auth` (log de CI job `107045581759`): **89.42 % líneas** / **83.62 % ramas** (`server.ts`: **97.05 % líneas**, subió desde `0 %` en Ronda 1)
  - `npx prettier --check`: `All matched files use Prettier code style!`

---

## Verificación de hallazgos de Ronda 1 (`H01`–`H07`)

| ID        | Sev.       | Estado en Ronda 2         | Verificación en `576d6fe55ccaa1cf6f87e0ed0f47cd0b6186cee7`                                                                                                                                                                                                                                                 |
| --------- | ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`H01`** | 🔴 crítico | ✅ `arreglado-verificado` | `queries.ts:28-35`, `server.ts:56-67` y `actions.ts:35-43` validan `profile.role` con `profileRoleSchema.safeParse(profile.role)`. Si `profiles` devuelve `null`, `error` o un rol inválido, `getServerSession` y `updateSession` devuelven `null` y `loginAction` retorna `UNAUTHORIZED_ACTOR`.           |
| **`H02`** | 🟠 alto    | ✅ `arreglado-verificado` | `guards.ts:27-85` usa `matchesSegment(pathname, prefix)`, incluye las rutas reales de `(admin)` (`/couriers`, `/merchants`, `/settings`, `/incidents`, `/applicants`, `/audit`, `/login/mfa`, `/admin/mfa`), aplica default-deny (`!session && !isPublicRoute`), y permite `admin` `aal1` en `/login/mfa`. |
| **`H03`** | 🟠 alto    | ✅ `arreglado-verificado` | `server.ts:79-83` copia `supabaseResponse.cookies.getAll()` en `redirectResponse` antes de retornar; `server.ts:51-54` y `queries.ts:23-26` paralelizan `profiles` + `mfa` con `Promise.all`; `src/features/auth/server.test.ts` cubre las 3 ramas y lleva `server.ts` a **97.05 %** de cobertura.         |
| **`H04`** | 🟠 alto    | ✅ `arreglado-verificado` | `resolvePostLoginRedirect(rawRedirectTo, role)` (`guards.ts:92-121`) bloquea URLs externas (`https://`, `//`), `/login` y rutas de otros roles; `LoginPage` (`src/app/(public)/login/page.tsx:4-15`) valida `searchParams` con `loginSearchParamsSchema.safeParse`.                                        |
| **`H05`** | 🟡 medio   | ✅ `arreglado-verificado` | Los 3 `setTimeout(..., 5)` en `actions.test.ts` y `queries.test.ts` fueron reemplazados por `await Promise.resolve()`; `docs/tasks/log/T-009.md:38-45` registra la evidencia de fase roja por mutación de comportamiento en `guards.ts` y `actions.ts`.                                                    |
| **`H06`** | 🟡 medio   | ✅ `arreglado-verificado` | 0 usos de `text-xs` en `login-form.tsx` y `register-form.tsx` (todos en `text-sm` ≥ 14px); botón de mostrar/ocultar contraseña en `h-12 w-12` (`48×48 px`) con copy en `authCopy.login`; tarjetas de rol con `aria-pressed`; `registerSchema` (`schemas.ts:19-24`) exige `acceptTerms === true`.           |
| `H07`     | 🔵 bajo    | ✅ `arreglado-verificado` | `npx prettier --check` pasa en todos los archivos del PR y `docs/tasks/T-009.md:35` tiene el quinto ítem del DoD marcado en `[x]`.                                                                                                                                                                         |

> **Nota sobre `PR58-H16` (arrastrado desde PR #58):** las pruebas asíncronas de `createClient()` en `src/features/auth/queries.test.ts:36-41` y `src/features/auth/actions.test.ts:163-168` verifican la espera real de la promesa de `await createClient()` sin `setTimeout`, dejando cerrado también ese seguimiento.

---

## BLOQUEANTES

Ninguno.

---

## MEJORAS (no bloqueantes)

1. **[`PR60-H08` · `src/features/auth/guards.ts:99`]** En `resolvePostLoginRedirect`, rechazar también barras invertidas (`rawRedirectTo.includes('\\')`).
   - **Acción:** hoy el filtro valida `!rawRedirectTo.startsWith('/') || rawRedirectTo.startsWith('//') || rawRedirectTo.includes('://') || /[\r\n]/.test(rawRedirectTo)`, pero una cadena como `'/\\evil.com'` empieza con `/` (y no con `//`), cae en el paso 6 de `evaluateRouteGuard` (`allow` para rutas autenticadas no restringidas) y los navegadores con parser WHATWG URL normalizan `\` a `/` al navegar (`//evil.com`). Agregar `|| rawRedirectTo.includes('\\')` cierra ese vector residual en una línea.
