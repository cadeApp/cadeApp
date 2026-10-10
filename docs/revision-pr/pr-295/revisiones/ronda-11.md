# PR #295 / T-338 — Ronda 11 (QA Android + hallazgo legal H16)

**Fecha:** 2026-10-10, zona horaria local de la QA. **HEAD funcional:** `3b7484e4b310f41d78eb6de06d21a6cedee10686` (sin commits nuevos desde R10). **Autor:** KiraK72 (P3).  
**RESULTADO: CON BLOQUEANTE FUNCIONAL NUEVO (PR295-H16), NO MERGEAR.** H14/H15 ahora verificados por informe QA físico aportado por P1/Codex, pero B y D de la PWA siguen parciales, y D mostró un defecto genuino de acceso a documentos legales. No aprobar ni mergear.

## 1. Evidencia física recibida

Segundo informe QA de P1/Codex, Samsung SM-G780G Android 13, Chrome 154: Preview inmutable `https://cadeapp-develop-11lk7ydks-lautaroj073.vercel.app` coincide con `3b7484e4b310f41d78eb6de06d21a6cedee10686`.

**HTTP reportado:** `/manifest.webmanifest` GET 200 application/manifest+json, `/sw.js` GET 200 application/javascript, sin redirects; rutas privadas y extensiones falsas 307 a login. **WebAPK instalado** `org.chromium.webapk.ab06ec2e1e63b5a67_v2`, tres arranques terminan en `/login` sin barra de Chrome. Chrome común muestra landing. Offline desde WebAPK muestra «Sin conexión» y la conectividad fue restaurada.

**Estados:** A PASS para instalación + pantalla final (no certifica no-flash; no hay video), B BLOCKED (sin navegación a `/` dentro de WebAPK), C PASS, D PARTIAL/BLOCKED, E PASS, F/G NOT TESTED justificadas. H14/H15 pasan a `arreglado-verificado` *con atribución de ejecución a P1/Codex*, no re-ejecución del revisor.

**Nueva reproducción manual P1:** «registro funciona, pero términos desde login se queda en login y desde register redirige a login». Esto es evidencia suficiente de fallo de aceptación legal aunque no haya video. No confundirlo con una ruta del SPA que «no responde»: source permite identificar guard.

## 2. H16 — Bloqueante nuevo, causa establecida por código

Los enlaces **son correctos**:
- `src/features/auth/components/login-form.tsx`: `href="/legal/terms"`, `href="/legal/privacy"`.
- `src/features/auth/components/register-form.tsx`: mismos href dentro de términos de aceptación.

Las páginas existen en `src/app/(public)/legal/page.tsx` y `legal/{terms,privacy,courier,pilot}/page.tsx`.

**El problema está en `src/features/auth/guards.ts`:**
```ts
export function isPublicRoute(pathname: string): boolean {
  if (pathname === '/' || isAuthRoute(pathname)) return true;
  const publicPrefixes = ['/forgot-password', '/design-system', '/auth/confirm', '/reset-password'];
  return publicPrefixes.some((prefix) => matchesSegment(pathname, prefix));
}
// evaluateRouteGuard:
// if (!session && !isPublicRoute(pathname)) redirect /login?redirectTo=...
```

**Ninguna /legal/** es pública. `src/middleware.ts` ejecuta guard en paths legales; una sesión anónima que toca «Términos» es redirigida por middleware al login. Por tanto, H16 es coherente con QA P1 y código del SHA actual.

**Importante:** el nombre de la carpeta `(public)` de Next.js es un route group de presentación y NO omite por sí mismo `middleware`/auth. `legal` debe ser accesible **antes del registro** por los propios enlaces y flujo de consentimiento. El test `src/features/auth/guards.test.ts` tampoco exige hoy acceso anónimo a legal, por eso el CI puede quedar verde.

## 3. Alcance y decisión P1 requerida

**No existe autorización para Kira de editar `src/features/auth/guards.ts` o `src/features/auth/guards.test.ts`**: la ficha T-338 los declara explícitamente fuera de alcance. La autorización P1 R9-A se limitó al matcher para `/manifest.webmanifest` y `/sw.js`; NO autoriza modificar la lógica de auth. Tampoco autoriza al revisor a hacerlo sin decisión.

**Recomendación A (corrección puntual en la PR #295):** nueva excepción expresa P1 para `src/features/auth/guards.ts`, `src/features/auth/guards.test.ts`, ficha y bitácora. Añadir una *allowlist explícita de rutas legales existentes* (`/legal`, `/legal/terms`, `/legal/privacy`, `/legal/courier`, `/legal/pilot`), comprobando cuáles deben ser anónimas; preservar cierre de rutas privadas y rutas desconocidas. Tests RED→GREEN: `isPublicRoute` y `evaluateRouteGuard(path,null)` en cada legal; variantes `/legal/admin`, `/legal/terms/private`, `/courier/feed` siguen protegidas; `/login/mfa` conserva MFA. El E2E/pase físico debe **clicar** desde `/login` y `/register` hacia Términos/Privacidad y verificar que se renderizan las páginas, y que el control de volver en standalone regresa a login. Si no hay enlace a `/legal` índice, no inventarlo: acceso navegando al pathname dentro del target verdadero WebAPK. Revalidar CI, trusted E2E Preview y presupuesto del nuevo HEAD, sin tocar auth server ni middleware matcher ni RLS.

**Opción B:** tarea separada transversal de Auth/Legales con PR específica y bloqueo de merge de #295 hasta la integración y QA sobre mismo deploy/HEAD. Mayor costo y duplicación de QA.

**Hasta elegir A/B:** Kira puede diagnosticar y capturar HTTP sin cambiar código, pero **no puede tocar `guards.ts` ni modificar sus tests**. El revisor tampoco modificó ramas funcionales.

## 4. Demostración requerida después de autorización

1. GET desde misma Preview, anónimo, sin redirects a `/legal`, `/legal/terms`, `/legal/privacy` para documentar 307 previo y 200 posterior. No presentar inferencia de source como respuesta HTTP ejecutada.
2. RED de los nuevos tests `guards.test.ts` sobre estado anterior (allowlist no incluye legal), fallos de acceso anónimo exactos; GREEN tras cambio, con controles negativos y tests previos intactos.
3. CI completo (typecheck/lint/unit/db-tests/build/bundle/audit) + trusted E2E Preview `success` en SHA nuevo.
4. Android WebAPK auténtico: **login→Términos**, **login→Privacidad**, **login→Registrarme→Términos/Privacidad**, volver conforme a UX standalone; prueba `/legal` índice si se alcanza. No hacer registro ni ingresar datos reales.
5. B: intentar `/` dentro de target WebAPK real mediante navegación interna o CDP controlado y observar redirect sin destello. Video desde pre-lanzamiento para no afirmar anti-flash a partir de captura estática.
6. Actualización F y push real G siguen NOT TESTED si faltan condiciones, sin falsificación.

## 5. Verificaciones existentes y límites

El HEAD `3b7484e4b310f41d78eb6de06d21a6cedee10686` permanece abierto y mergeable, pero **no cumple DoD por H16**. Los CI/E2E previos verdes [CI 38014720340](https://github.com/cadeApp/cadeApp/actions/runs/38014720340) y [E2E 38014801228](https://github.com/cadeApp/cadeApp/actions/runs/38014801228) acreditan su propio alcance, no esta ruta legal anónima ni la QA B.

**Límites:** la revisión no ejecutó ADB, HTTP externo ni tests locales de guards; las observaciones manuales/HTTP provienen de P1/Codex, con fuente independiente GitHub para causalidad. No se recibieron videos/capturas originales para inspección. Ningún cambio funcional, aprobación o merge fue realizado.
