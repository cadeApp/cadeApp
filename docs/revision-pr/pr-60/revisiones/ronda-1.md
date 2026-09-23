# PR #60 · Ronda 1 — `b29eca1`

|                  |                                            |
| ---------------- | ------------------------------------------ |
| **SHA revisado** | `b29eca168784ce105f8304b3d325305b130f5c31` |
| **Tarea**        | T-009 · Auth base                          |
| **Autor**        | @asako669 (P2)                             |
| **Tamaño**       | 18 archivos · +1271 / −8                   |
| **Fecha**        | 2026-09-23                                 |

## Veredicto

**CON BLOQUEANTES (6).** El corte modular de `src/features/auth/` está bien planteado: respeta las fronteras de ESLint (`cadeapp/feature-server-boundary` y `cadeapp/client-no-server`), delega `middleware.ts` en `updateSession(request)` de `src/features/auth/server.ts` como pide la Regla 20, reutiliza `signupRoleSchema` y `DomainErrorCode` del dominio, y mantiene el First Load JS en 109 kB (muy por debajo del presupuesto de 180 kB).

Sin embargo, la autorrevisión del agy en el cuerpo del PR declaró «Resultado: SIN BLOQUEANTES · MEJORAS: ninguna», y al barrer la clase completa de sesiones, guardas, middleware y formularios aparecieron **6 hallazgos bloqueantes** (1 crítico, 3 altos, 2 medios) y **1 mejora**, todos demostrados en ejecución con un probe de 4 tests sobre el worktree:

1. **`H01` (crítico):** Cuando `public.profiles` devuelve `null` o error, las tres lecturas de sesión (`server.ts:61`, `queries.ts:36`, `actions.ts:35`) hacen `profile?.role ?? 'merchant'`, convirtiendo silenciosamente a cualquier usuario (incluido un `courier`) en `'merchant'` y redirigiéndolo a `/merchant/dashboard`.
2. **`H02` (alto):** `guards.ts` asume que los Route Groups `(merchant)`, `(courier)` y `(admin)` de Next.js App Router forman parte de `pathname`, deja `isPublicRoute` sin llamar con `return { action: 'allow' }` por defecto, usa `startsWith('/courier')` y `startsWith('/merchant')` —lo que clasifica las rutas administrativas `/couriers` (T-122) y `/merchants` (T-123) como rutas de repartidor y comercio respectivamente, permitiendo a un `courier` entrar a `/couriers` y a un `merchant` entrar a `/merchants`—, permite a un `admin` con `aal1` entrar a rutas de comercio/repartidor, y genera un bucle infinito de redirección en `/login/mfa` (A00).
3. **`H03` (alto):** En `updateSession` (`server.ts:68-74`), cuando `guardResult.action === 'redirect'`, se devuelve un `NextResponse.redirect(redirectUrl)` nuevo **descartando las cookies de sesión recién rotadas** en `supabaseResponse.cookies` por `supabase.auth.getUser()`. Además, `server.ts` ejecuta lecturas en cascada secuencial y tiene **0 % de cobertura (`0/77` líneas)**.
4. **`H04` (alto):** `LoginPage` y `LoginForm` toman `searchParams.redirectTo` sin parsear con Zod ni validar ruta interna/rol y ejecutan `router.push(targetUrl)`, abriendo un **Open Redirect** (`?redirectTo=https://evil.com` o `//evil.com`) y permitiendo que `?redirectTo=/merchant/dashboard` empuje a un `courier` recién autenticado a la zona de comercio.
5. **`H05` (medio):** `actions.test.ts:164, 194` y `queries.test.ts:38` usan sleeps fijos (`setTimeout(..., 5)`), prohibidos como bloqueantes por la Regla 40 y `revisar-pr`, y la bitácora documentó la fase roja únicamente con el error de resolución de módulo (`Failed to resolve import "./guards"`, mismo patrón `PR58-H13`).
6. **`H06` (medio):** `login-form.tsx` y `register-form.tsx` tienen **5 instancias de `text-xs` (12px)** que violan la Cláusula Anti-12px (D16 y `P00/README.md:64`, piso 14px `text-sm`), un botón de mostrar/ocultar contraseña de `20×20 px` en vez de `48×48 px` (`P00/README.md:41`), tarjetas de selección de rol sin `aria-pressed` (WCAG 4.1.2) y validación de `acceptTerms` únicamente en el cliente (`registerAction({ ..., acceptTerms: false })` hoy devuelve `ok: true`).

## Checks verificados en `b29eca1`

| Control                                 | Resultado                                                       | **Qué alcanza**                                                |
| --------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`        | ✅ exit 0 · 32 s                                                | Lockfile intacto                                               |
| `pnpm typecheck`                        | ✅ exit 0                                                       | `tsc --noEmit` + `.github/workflows/tsconfig.json`             |
| `pnpm lint`                             | ✅ exit 0                                                       | `src`, `middleware.ts` y `.github/workflows`                   |
| `pnpm test`                             | ✅ 116 Vitest (14 archivos) · 19 workflows · 6 ADR              | `server.ts` tiene **0 % de cobertura (`0/77` líneas)**         |
| `db-tests` en CI (`35814929519`)        | ✅ `Files=3, Tests=98, Result: PASS`                            | Verificado en el log del job (`107034313474`), no por el color |
| `bundle-budget` en CI (`35814929519`)   | ✅ `/login` 109 kB · `/register` 109 kB                         | Límite 180 kB                                                  |
| `approval-policy` en CI (`35815117494`) | ❌ `El PR requiere aprobación vigente de Lautaro073`            | Esperado mientras el PR está en revisión                       |
| `npx prettier --check`                  | ⚠️ 2 archivos con warn (`guards.ts`, `docs/tasks/log/T-009.md`) | `H07`                                                          |
| Alcance (`gh pr diff 60 --name-only`)   | ✅ 18 archivos, **0 fuera** de `docs/tasks/T-009.md`            |                                                                |

---

## Hallazgos detallados y demostración en rojo

### 🔴 `PR60-H01` · Escalada silenciosa a `role: 'merchant'` cuando `profiles` devuelve `null` o error

**`src/features/auth/server.ts:61` · `src/features/auth/queries.ts:36` · `src/features/auth/actions.ts:35` · crítico · BLOQUEANTE**

En las tres funciones que construyen la sesión a partir de `supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()`:

```ts
// server.ts:61, queries.ts:36 y actions.ts:35
role: profile?.role ?? 'merchant',
```

Si la consulta a `public.profiles` devuelve `data: null` o `error` (por ejemplo, demora o fallo del trigger, error transitorio o bloqueo de RLS), **las tres funciones fabrican `role: 'merchant'`**:

- Un `courier` cuyo perfil falle al leerse es tratado como `merchant` por `updateSession`, `getServerSession` y `loginAction`, y es redirigido o autorizado en `/merchant/dashboard`, rompiendo el DoD (`courier no entra a (merchant) ni merchant a (courier)`) y `AGENTS.md` §2.
- Además, `.maybeSingle<{ role: ProfileRole }>()` es solo una aserción de TypeScript y no parsea el valor con `profileRoleSchema` (`src/domain/schemas`) en la frontera (Regla 25 §5).

**Qué hay que hacer:**

1. Parsear `profile?.role` con `profileRoleSchema.safeParse(profile?.role)` y verificar `!profileError`.
2. Si `profileError` existe o el rol no es válido:
   - En `getServerSession` (`queries.ts`) y `updateSession` (`server.ts`): la sesión debe ser `null` (nunca `'merchant'`).
   - En `loginAction` (`actions.ts`): devolver `err('UNAUTHORIZED_ACTOR')` (o `err('UNAUTHENTICATED')`), nunca `ok({ role: 'merchant', ... })`.
3. Agregar pruebas unitarias en `queries.test.ts`, `actions.test.ts` y `server.test.ts` que verifiquen que con `profile: null` o `error` no se concede `role: 'merchant'`.

---

### 🟠 `PR60-H02` · `guards.ts`: route groups en URL, default-allow (`isPublicRoute` muerto), colisión `/couriers` y `/merchants` de admin con `startsWith`, y bucle infinito en `/login/mfa`

**`src/features/auth/guards.ts:27-141` · alto · BLOQUEANTE**

Al recorrer la matriz completa de rutas del plan (`docs/implementation-plan.md` §8 y especificaciones `A00`/`C00`/`R00`) contra `guards.ts` aparecen cuatro defectos estructurales de la misma clase:

1. **Colisión de `startsWith('/courier')` y `startsWith('/merchant')` con las rutas de Admin (`guards.ts:29, 37`):**
   - En T-122 la ruta de administración de repartidores es `src/app/(admin)/couriers/**` (URL `/couriers` o `/admin/couriers`). Como `'/couriers'.startsWith('/courier')` es `true`, `isCourierRoute('/couriers')` da **`true`**, `isAdminRoute('/couriers')` da **`false`**, y `evaluateRouteGuard('/couriers', courierSession)` devuelve **`{ action: 'allow' }`** (¡un repartidor entra a la bandeja de admin `/couriers`!).
   - En T-123 la ruta de administración de comercios es `src/app/(admin)/merchants/**` (URL `/merchants` o `/admin/merchants`). Como `'/merchants'.startsWith('/merchant')` es `true`, `isMerchantRoute('/merchants')` da **`true`**, `isAdminRoute('/merchants')` da **`false`**, y `evaluateRouteGuard('/merchants', merchantSession)` devuelve **`{ action: 'allow' }`** (¡un comercio entra a la bandeja de admin `/merchants`!).
   - Para matchear un segmento de URL nunca debe usarse `pathname.startsWith('/merchant')` desnudo, sino coincidencia de segmento (`pathname === '/merchant' || pathname.startsWith('/merchant/')`).

2. **Route groups `(merchant)`, `(courier)`, `(admin)` de Next.js App Router y `isPublicRoute` muerto con default-allow (`guards.ts:56-64, 139-140`):**
   - En Next.js App Router, `(merchant)`, `(courier)` y `(admin)` se eliminan de `request.nextUrl.pathname`. Las rutas definidas en `implementation-plan.md` §8 y `C00`/`R00`/`A00` incluyen:
     - Comercio: `/merchant` (`/merchant/**`), `/requests` (`/requests/**`), `/dashboard`, `/history`, `/plan`, `/merchant/onboarding`
     - Repartidor: `/courier` (`/courier/**`), `/offers` (`/offers/**`), `/feed`, `/profile`, `/courier/onboarding`, `/onboarding/identity`, `/onboarding/vehicle`, `/onboarding/status`
     - Admin: `/admin` (`/admin/**`), `/couriers` (`/couriers/**`), `/merchants` (`/merchants/**`), `/settings` (`/settings/**`), `/incidents` (`/incidents/**`), `/applicants` (`/applicants/**`), `/audit` (`/audit/**`), `/login/mfa`, `/admin/mfa`
     - Autenticadas de comercio/repartidor: `/trips` (`/trips/**`, T-115) y `/onboarding` (`/onboarding/**`, T-111/T-121).
   - Además, `isPublicRoute(pathname)` (`guards.ts:56`) **nunca se llama en `evaluateRouteGuard`**, que termina en `return { action: 'allow' }` (`guards.ts:140`). Un usuario `anon` (`session === null`) recibe `{ action: 'allow' }` en `/trips/123`, `/onboarding`, `/settings`, `/incidents` y `/feed`.
   - `evaluateRouteGuard` debe ser **default-deny para usuarios no autenticados**: si `!session` y `!isPublicRoute(pathname)`, redirigir a `/login?redirectTo=${encodeURIComponent(pathname)}`. E `isPublicRoute` debe incluir también `/forgot-password` (enlazado en `LoginForm:75`) y `/legal` (`/legal/**`, T-311).

3. **Lista negra en vez de lista blanca en comercio y repartidor (`guards.ts:89, 106`):**
   - `isMerchantRoute` (`guards.ts:89`) solo bloquea `if (session.role === 'courier')` en vez de `if (session.role !== 'merchant')`.
   - `isCourierRoute` (`guards.ts:106`) solo bloquea `if (session.role === 'merchant')` en vez de `if (session.role !== 'courier')`.
   - Como resultado, un `admin` (incluso con `aal1`, sin MFA) recibe `{ action: 'allow' }` en `/merchant/dashboard` y `/courier/feed`. Ambas guardas deben exigir `session.role !== 'merchant'` y `session.role !== 'courier'` respectivamente, redirigiendo a `getRoleDefaultPath(session.role)`.

4. **Bucle infinito de redirección en `/login/mfa` (`guards.ts:47-54, 71-78, 130`):**
   - `A00/README.md` (línea 8) ubica la pantalla de MFA en `src/app/(admin)/login/mfa/` (`/login/mfa`).
   - Como `isAuthRoute` incluye `pathname.startsWith('/login/')`, `isAuthRoute('/login/mfa')` devuelve `true`. Cuando un `admin` con `aal1` entra a `/login/mfa`, el paso 1 (`guards.ts:72-76`) lo redirige a `/admin`, y `/admin` lo vuelve a redirigir a MFA (bucle infinito). `isAuthRoute` debe excluir `/login/mfa`, y la guarda de admin debe permitir `/admin/mfa` y `/login/mfa` cuando `session.role === 'admin'` y `session.aal === 'aal1'`.

---

### 🟠 `PR60-H03` · `updateSession` pierde las cookies rotadas por `@supabase/ssr` al redirigir, ejecuta lecturas en cascada y `server.ts` tiene 0 % de cobertura

**`src/features/auth/server.ts:50-74` · alto · BLOQUEANTE**

1. **Pérdida de cookies rotadas en redirecciones (`server.ts:68-74`):**
   Cuando `await supabase.auth.getUser()` (`server.ts:46`) refresca un access token expirado, `@supabase/ssr` rota el refresh token (de un solo uso en Supabase Auth) y escribe las nuevas cookies en `supabaseResponse.cookies` mediante `setAll`.
   Acto seguido, si `guardResult.action === 'redirect'` (`server.ts:68-74`), el código hace:
   ```ts
   return NextResponse.redirect(redirectUrl);
   ```
   creando una respuesta nueva **sin copiar `supabaseResponse.cookies.getAll()`**. El navegador sigue el 307 conservando el refresh token viejo ya invalidado y el usuario pierde la sesión en la página de destino.
   **Solución:**
   ```ts
   const redirectResponse = NextResponse.redirect(redirectUrl);
   supabaseResponse.cookies.getAll().forEach((cookie) => {
     redirectResponse.cookies.set(cookie);
   });
   return redirectResponse;
   ```
2. **Lecturas independientes en cascada (`server.ts:50-56` y `queries.ts:23-30`):**
   `supabase.from('profiles').select('role')...` y `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` son dos llamadas independientes ejecutadas con `await` secuencial en vez de `await Promise.all([...])` (Regla 25 §6: _«Sin cascadas: lecturas independientes en paralelo (`Promise.all`)»_).
3. **0 % de cobertura en `src/features/auth/server.ts` (`0/77` líneas):**
   Ningún test del PR importa ni ejecuta `updateSession(request)`. La regla `cadeapp/feature-server-boundary` (`tools/eslint-plugin-cadeapp/index.js:91`) ya habilita expresamente `src/features/auth/server.test.ts` (`// @vitest-environment node`). Hay que crear `server.test.ts` cubriendo:
   - preservación de cookies rotadas tanto en `allow` (`supabaseResponse`) como en `redirect` (`redirectResponse`);
   - redirección de usuario no autenticado y de rol cruzado;
   - degradación segura a sesión `null` si `profiles` devuelve `null` (`H01`).

---

### 🟠 `PR60-H04` · Open Redirect y salto de guarda por rol vía `searchParams.redirectTo` sin validar

**`src/app/(public)/login/page.tsx:8-9` · `src/features/auth/components/login-form.tsx:35-36` · alto · BLOQUEANTE**

En `LoginPage` (`src/app/(public)/login/page.tsx:8-9`) se lee `searchParams.redirectTo` sin validar con Zod (Regla 10 línea 9 y Regla 25 §5 línea 67) y en `LoginForm` (`login-form.tsx:35-36`) se navega directamente:

```ts
const targetUrl = initialRedirectTo || result.data.redirectTo;
router.push(targetUrl);
```

Esto produce dos defectos:

1. **Open Redirect:** `/login?redirectTo=https://sitio-malicioso.com` o `/login?redirectTo=//sitio-malicioso.com` redirige fuera de la aplicación tras iniciar sesión.
2. **Salto de guarda por rol:** si un `courier` inicia sesión desde `/login?redirectTo=/merchant/dashboard`, `initialRedirectTo` pisa `result.data.redirectTo` (`/courier/feed`) y lo envía a `/merchant/dashboard`.

**Qué hay que hacer:**

- Crear una función pura `resolvePostLoginRedirect(rawRedirectTo: unknown, role: ProfileRole): string` (p. ej. en `guards.ts` o `schemas.ts`) que:
  1. Verifique que `rawRedirectTo` sea un string que empiece con `'/'`, no empiece con `'//'`, y no contenga esquema/host ni saltos de línea;
  2. Evalúe `evaluateRouteGuard(pathname, { userId: 'check', email: '', role, aal: 'aal1' })` y verifique que no sea una ruta de auth (`!isAuthRoute(pathname)`) y que la guarda devuelva `{ action: 'allow' }`;
  3. En caso contrario, devuelva `getRoleDefaultPath(role)`.
- Usarla en `loginAction` / `LoginForm` y agregar tests unitarios en `guards.test.ts` (o `actions.test.ts`) para `https://evil.com`, `//evil.com`, `/login` y rutas del rol opuesto.

---

### 🟡 `PR60-H05` · Tres sleeps fijos (`setTimeout`) en `actions.test.ts` y `queries.test.ts` y fase roja documentada solo por módulo inexistente

**`src/features/auth/actions.test.ts:164, 194` · `src/features/auth/queries.test.ts:38` · `docs/tasks/log/T-009.md:10` · medio · BLOQUEANTE**

1. En tres tests (`actions.test.ts:164`, `actions.test.ts:194`, `queries.test.ts:38`) se usa:
   ```ts
   await new Promise((resolve) => setTimeout(resolve, 5));
   ```
   La Regla 40 (`.agents/rules/40-testing.md:16`: _«Prohibido: `.only`, `.skip` sin issue, sleeps fijos»_) y la skill `revisar-pr` (línea 24: _«`.only`, `.skip` o sleeps → BLOQUEANTE»_) prohíben los sleeps fijos con `setTimeout`. Para ejercitar la resolución asíncrona en microtarea basta con `await Promise.resolve()` o una promesa diferida controlada sin timer.
2. En `docs/tasks/log/T-009.md:10` y `27`, la evidencia de fase roja registrada es únicamente `src/features/auth/auth.test.ts con Failed to resolve import "./guards"`. Como ya se registró en `PR58-H13` (`AG-48`), un error de importación antes de que exista el archivo no demuestra que las aserciones fallen al romper la regla que prueban. Al aplicar los arreglos de esta ronda, registrar en la bitácora la falla conductual antes del fix.

---

### 🟡 `PR60-H06` · Cláusula Anti-12px (`text-xs`), touch target `< 48px`, tarjetas de rol sin `aria-pressed` y `acceptTerms` validado solo en UI

**`src/features/auth/components/login-form.tsx:76, 91-98` · `src/features/auth/components/register-form.tsx:22-25, 65-118, 81, 108, 152, 164` · medio · BLOQUEANTE**

Enumerando la clase completa de UI/accesibilidad/validación en ambos formularios (`login-form.tsx` y `register-form.tsx`):

1. **Cláusula Anti-12px (`docs/implementation-plan.md` §8 D16 y `P00/README.md:64`: piso mínimo `14px` / `text-sm`, prohibido `text-xs`):**
   Hay **5 ocurrencias de `text-xs` (12px)**:
   - `login-form.tsx:76`: enlace `¿Olvidaste tu contraseña?`
   - `register-form.tsx:81`: descripción del rol comercio (`merchantRoleDesc`) — contradice expresamente `P00/README.md:64` (_«Piso de 14px: Los textos descriptivos de cada rol deben tener mínimo 14px (`text-sm`)»_)
   - `register-form.tsx:108`: descripción del rol repartidor (`courierRoleDesc`) — ídem
   - `register-form.tsx:152`: texto de ayuda de contraseña (`passwordHelper`)
   - `register-form.tsx:164`: etiqueta de aceptación de términos (`terms`)
     Reemplazar las 5 por `text-sm`.
2. **Touch target del botón mostrar/ocultar contraseña (`P00/README.md:41` y Regla 60):**
   En `login-form.tsx:91-98`, el `<button type="button">` del ícono `<Eye />`/`<EyeOff />` no tiene dimensiones mínimas y mide `20×20 px` (`h-5 w-5`), cuando `P00/README.md:41` exige _«un área táctil mínima de 48×48px»_ (`right-0 top-0 flex h-12 w-12 items-center justify-center`).
3. **Estado accesible en las tarjetas de selección de rol (`register-form.tsx:65-118`, WCAG 4.1.2):**
   Los dos `<button type="button">` que seleccionan `merchant` o `courier` solo cambian clases visuales y muestran un `<Check />` sin ningún atributo ARIA. Agregar `aria-pressed={role === 'merchant'}` y `aria-pressed={role === 'courier'}`.
4. **`acceptTerms` validado solo en UI y textos hardcodeados fuera de `copy.ts` (`register-form.tsx:22-25`, `login-form.tsx:95`):**
   - `registerAction({ email, password, role, acceptTerms: false })` hoy devuelve `ok: true` porque `registerSchema` y `registerAction` ignoran `acceptTerms` (`AGENTS.md` §2: prohibida la validación solo en UI). Agregar `acceptTerms` a `registerSchema` (p. ej. `acceptTerms: z.literal(true)` o `z.boolean().optional().refine((v) => v !== false)` si se mantiene compatibilidad en llamadas internas, y enviarlo como `acceptTerms` desde `RegisterForm`).
   - Mover los textos hardcodeados (`'Tenés que aceptar los Términos y la Política de privacidad.'` en `register-form.tsx:23` y `'Ocultar contraseña'` / `'Ver contraseña'` en `login-form.tsx:95`) a `src/features/auth/copy.ts` (Regla 25 §3.4).

---

### 🔵 `PR60-H07` · Formato Prettier en 2 archivos e ítem del DoD sin marcar en `docs/tasks/T-009.md`

**`src/features/auth/guards.ts` · `docs/tasks/log/T-009.md` · `docs/tasks/T-009.md:35` · bajo · MEJORA**

- `npx prettier --check src/features/auth/guards.ts docs/tasks/log/T-009.md` da `[warn] Code style issues found in 2 files`. Correr `npx prettier --write` sobre los archivos tocados.
- En `docs/tasks/T-009.md:35`, marcar `- [x] Bitácora docs/tasks/log/T-009.md al día y PR con evidencia`.

---

## Informe formato `revisar-pr`

```text
Informe revisar-pr — T-009 — 2026-09-23 — generado por revisión independiente
Resultado: CON BLOQUEANTES (6)
Checks locales: typecheck ✅ · lint ✅ · test ✅ (116/116) · test:db ✅ (CI: Files=3, Tests=98, Result: PASS)
BLOQUEANTES:
- [src/features/auth/queries.ts:36] (y server.ts:61, actions.ts:35) Escalada silenciosa a role='merchant' cuando profiles devuelve null o error → validar con profileRoleSchema; si falta perfil o falla la consulta, devolver null en getServerSession/updateSession y err('UNAUTHORIZED_ACTOR') en loginAction (`PR60-H01`)
- [src/features/auth/guards.ts:27] Route groups en pathname, default-allow (isPublicRoute sin llamar), colisión de startsWith('/courier') y startsWith('/merchant') con /couriers y /merchants de admin, lista negra en vez de lista blanca (admin aal1 entra a merchant/courier) y bucle infinito en /login/mfa → usar coincidencia por segmento exacto, exigir session.role === 'merchant' / 'courier', excluir /login/mfa de isAuthRoute y hacer default-deny (!isPublicRoute) cuando session es null (`PR60-H02`)
- [src/features/auth/server.ts:68] updateSession descarta las cookies rotadas por @supabase/ssr al devolver NextResponse.redirect, hace lecturas en cascada y tiene 0 % de cobertura (0/77 líneas) → copiar supabaseResponse.cookies.getAll() al redirectResponse, paralelizar con Promise.all y agregar src/features/auth/server.test.ts (`PR60-H03`)
- [src/features/auth/components/login-form.tsx:35] (y src/app/(public)/login/page.tsx:8) Open Redirect y salto de guarda por rol vía searchParams.redirectTo sin validar → sanitizar redirectTo (ruta interna relativa y permitida por evaluateRouteGuard para el rol autenticado; si no, getRoleDefaultPath(role)) (`PR60-H04`)
- [src/features/auth/actions.test.ts:164] (y actions.test.ts:194, queries.test.ts:38) Sleeps fijos con setTimeout(..., 5) prohibidos por Regla 40 y fase roja documentada solo por Failed to resolve import → eliminar setTimeout de los tests y registrar la fase roja conductual en la bitácora (`PR60-H05`)
- [src/features/auth/components/register-form.tsx:22] (y login-form.tsx:76,91) 5 usos de text-xs (viola Cláusula Anti-12px D16), botón de ojo de 20×20 px (< 48×48 px), botones de rol sin aria-pressed y acceptTerms validado solo en UI con textos hardcodeados → pasar a text-sm, h-12 w-12 en botón de ojo, aria-pressed en tarjetas de rol, validar acceptTerms en registerSchema/registerAction y mover textos a copy.ts (`PR60-H06`)
MEJORAS:
- [src/features/auth/guards.ts:1] Correr prettier --write sobre src/features/auth/guards.ts y docs/tasks/log/T-009.md, y marcar el quinto ítem del DoD en docs/tasks/T-009.md:35 (`PR60-H07`)
No revisado / dudas para Lautaro073:
- ninguno
```
