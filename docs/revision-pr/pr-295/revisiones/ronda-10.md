# Informe independiente — PR #295 / T-338 — Ronda 10

**Fecha:** 2026-10-09 (Argentina). **Autor PR:** KiraK72 (P3). **HEAD funcional exacto:** `3b7484e4b310f41d78eb6de06d21a6cedee10686` (anterior `74fd2150c629b396ff9843cd285e70b93cbd42cb`).  
**Estado: SIN NUEVOS BLOQUEANTES DE CÓDIGO; PR NO LISTA PARA MERGE por validación externa pendiente.** Los hallazgos H14/H15 están **corregidos por inspección y suites CI** pero siguen **`arreglado-sin-verificar`** para la incidencia en la Preview pública y en Android hasta hacer GET anónimo real y repetir QA física A–E. La ronda no aprueba ni mergea.

## 1. Diff y alcance autorizado

Un único commit posterior a R9: **4 archivos exactos**, todos expresamente autorizados por decisión P1 R9-A/PR295-A04:
- `src/middleware.ts`: modifica solo `config.matcher` para excluir **`manifest\\.webmanifest$`** y **`sw\\.js$`**, conserva cuerpo de `middleware`/uso `updateSession`.
- `src/middleware.test.ts`: dos casos positivos para assets públicos PWA y cuatro negativos con sufijos alternativos y extensiones, junto a todos los controles anteriores.
- `docs/tasks/T-338.md`: registra opción R9-A, añade exclusivamente dos archivos a lista autorizada y mantiene auth/guards fuera de alcance.
- `docs/tasks/log/T-338.md`: sesión final append-only (+66 líneas), declara HTTP inicial de Preview antiguo, RED→GREEN, seguridad y pruebas locales.

Sin cambios a auth, RLS, Supabase, guard, workflows, Playwright, manifest, SW, dependencias ni otros archivos. No se tocaron `docs/revision-pr/**` en la rama de Kira en este commit.

## 2. Revisión funcional de matcher y seguridad

**Código revisado:**
```ts
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest\\.webmanifest$|sw\\.js$|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```
Los dos términos específicos están anclados a final de pathname **`$`**, evitando abrir prefijos `/sw.js.backup` o `/manifest.webmanifest-extra`. No se generalizó `*.js`, `*.webmanifest`, archivos desconocidos, rutas de usuario ni paths API. Los tests `unstable_doesMiddlewareMatch` de Next exigen:
- **NO ejecutar middleware** para `/manifest.webmanifest`, `/sw.js` y exclusiones estáticas previas.
- **SÍ ejecutar middleware** para `/login`, `/courier/feed`, `/merchant/dashboard`, `/admin/applicants`, `/manifest.webmanifest.bak`, `/manifest.webmanifest-extra`, `/sw.js.map` y `/sw.js.backup`.

Los tests de matcher prueban **paso por guarda**, no por sí solos status HTTP ni datos protegidos. El middleware conserva intacta la llamada a `updateSession`, y el guard anónimo continúa cubriendo rutas privadas. Las excepciones se limitan a dos recursos públicos requeridos por PWA.

**Mutaciones propias de revisión:** en Node y solo en memoria (sin cambiar el repo), se replicó el regexp exacto del HEAD sobre **14 casos** (todos PASS); cuatro mutaciones independientes dieron RED: quitar cada exclusión hace que manifest/SW entren en middleware; quitar cada ancla `$` abre indebidamente sufijos `.bak`, `.map`, etc. **Limitación:** este control nativo JS no ejecuta el compilador `unstable_doesMiddlewareMatch` de Next. El resultado de las pruebas Next se observa en CI, no se suplanta con el harness.

## 3. CI remoto inspeccionado, SHA exacto

[CI run 38014720340](https://github.com/cadeApp/cadeApp/actions/runs/38014720340) success:
- `typecheck`, `lint`, `audit`, `build`, `db-tests`, `unit` y `bundle-budget`: success.
- `unit` job `114102343527`: 127/127 archivos Vitest passed; además suites Node 79/79 y 6/6.
- `db-tests` job `114102343461`: 10/10 + 1903/1903 tests, ambos Result PASS.
- `build` job `114102343466`: compilación success, y Next genera `/manifest.webmanifest`.
- First Load JS: `/ 138 kB`, `/legal 138 kB`, `/login 169 kB`, `/register 169 kB` (cada una <=180 kB).
- `approval-policy` success; Vercel READY y status success, mismo SHA.

[Trusted E2E Preview run 38014801228](https://github.com/cadeApp/cadeApp/actions/runs/38014801228) success:
- job `114102622287`: **46 Chromium tests passed** incluyendo PWA standalone (modo app real), navegador común y gesto push. **3 global-settings passed**; `e2e-preview` status success.
- Aún **NO prueba Chrome instalando WebAPK Android** ni el GET de `/manifest.webmanifest` sin sesión.

**Deployment confirmado por Vercel:** `dpl_AwU93x4jXG1CLgTSBdtGA5WSnD2x`, READY, SHA `3b7484e4b310f41d78eb6de06d21a6cedee10686`; URL inmutable `https://cadeapp-develop-11lk7ydks-lautaroj073.vercel.app`. Alias de rama `https://cadeapp-develop-git-feat-t-338-pwa-standalone-lautaroj073.vercel.app` puede actualizarse con commits posteriores; usar URL inmutable para ligar evidencia al SHA.

## 4. Evidencia original del autor y pendientes de verificación

En bitácora Kira declaró:
- **Preview anterior** `74fd2150`: GET anónimo `/manifest.webmanifest` y `/sw.js` devolvieron `307` a `/login?redirectTo=...`; el informe Android original había visto HTML final. Esta reproducción está escrita por la autora y es consistente con el código anterior.
- **RED unitario** antes del arreglo: `2 failed / 22 passed`.
- **GREEN unitario** después del arreglo: `24 passed`.
- **Servidor local producción** después del arreglo: GET `200` de manifest con MIME `application/manifest+json` y GET `200` de `/sw.js` con `application/javascript`, rutas privadas y sufijos alternativos `307` a login.
- No documentó aún **GETs anónimos del NUEVO Preview Vercel** en el SHA actual, ni una QA Android nueva. Por eso **no cerrar H14/H15 como verificados por runtime**. Las salidas previas no equivalen a validación remota postdeploy.

**Limitación de este revisor:** la lectura HTTP directa desde este entorno falló por resolución/acceso externo, por lo que no se afirman headers HTTP nuevos que no pudimos observar. La propiedad del regexp fue ejercitada en Node, y la capa Next se cotejó con jobs verdes; no se ejecutó build local ni ADB propio.

## 5. Próximo paso exacto: evidencia HTTP nueva + QA Android P1

**Primero, sin commits:** desde Windows/Codex contra la URL inmutable asociada al SHA:
```powershell
$base = 'https://cadeapp-develop-11lk7ydks-lautaroj073.vercel.app'
curl.exe -sS -D - -o NUL --max-redirs 0 "$base/manifest.webmanifest"
curl.exe -sS -D - -o NUL --max-redirs 0 "$base/sw.js"
curl.exe -sS -D - -o NUL --max-redirs 0 "$base/courier/feed"
curl.exe -sS -D - -o NUL --max-redirs 0 "$base/merchant/dashboard"
curl.exe -sS -D - -o NUL --max-redirs 0 "$base/admin/applicants"
```
Para manifest y SW exigir **GET anónimo `200` sin Location** + MIME correcto; validar JSON real `id:'/'`, `start_url:'/login'`, `display:'standalone'` y contenido JS real del SW, no login HTML. Guardar respuestas sanitizadas (sin cookies/tokens/serials). Las rutas privadas deben seguir redirigiendo/rechazando a visitantes.

**Después** repetir QA Android física A–E con Samsung SM-G780G / Android 13 mediante Codex+ADB. A: instalación auténtica PWA + arranque frío video hasta `/login`; B: navegación a `/` dentro de instalada sin destello; C: landing visible en Chrome normal; D: navegación en login/registro/legal según standalone; E: SW registrado y navegación offline a «Sin conexión», sin landing cacheada. Preservar otras apps y restaurar redes. F update sobre mismo origen solo si existe base anterior; G push real solo con mecanismo autorizado, de lo contrario `NOT TESTED`.

**Si falla HTTP o Android:** no modificar matcher de nuevo sin evidencia; registrar endpoint/status/headers/paso y plantear corrección acotada. **Si pasa todo:** presentar evidencia y nueva revisión de cierre/mergeabilidad, no mergear automáticamente.

## 6. Resultado técnico

**NO hay nuevos bloqueantes de código detectados en este SHA**. H14/H15 pasan de `abierto` a **`arreglado-sin-verificar`** para el escenario real; decisión R9-A aplicada según permiso P1. No hay nueva decisión de arquitectura pendiente ni se requiere tocar archivos ahora. QA original A/B/D/E estaba BLOCKED; hasta repetirla **la PR sigue sin autorización para merge**.

Este informe no es aprobación de PR ni sustituto del control humano del dispositivo.
