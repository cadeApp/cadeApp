# PR #295 / T-338 — Ronda 9: QA Android físico revela bloqueo de instalación

**Fecha:** 2026-10-09 (Argentina). **Autor funcional:** KiraK72 (P3). **HEAD funcional:** `74fd2150c629b396ff9843cd285e70b93cbd42cb` (sin nuevos commits desde R8).

**Estado actualizado: CON BLOQUEANTES PARA CIERRE/QA. NO MERGEAR.** Esta ronda se abrió tras recibir el informe de QA Android ejecutado por Codex con supervisión de P1. Los gates CI/E2E de R8 eran GREEN y esa evidencia no se revoca, pero **no alcanza** para demostrar instalación de una PWA real. La Ronda 8 era un cierre *técnico basado en CI*; R9 registra nueva evidencia de dispositivo que contradice la aptitud para merge, sin atribuir mala fe ni adulteración.

## 1. Fuente y alcance de la evidencia física

P1 proporcionó el informe textual **«QA Android físico — PR #295 / T-338»**: fecha 2026-10-09, Windows 10 Pro, Samsung SM-G780G / Android 13 / Chrome 154, dispositivo único vía ADB, URL de Preview `https://cadeapp-develop-iy7hwzom4-lautaroj073.vercel.app`, SHA `74fd2150c629b396ff9843cd285e70b93cbd42cb`.

- **A Instalación/primer arranque: BLOCKED.** Chrome no ofreció Instalar aplicación; `Invoke-WebRequest` a `/manifest.webmanifest` siguió hasta contenido HTML `Content-Type:text/html`, no manifiesto JSON.
- **B Standalone: BLOCKED**, no hay WebAPK de cadeApp (solo WebAPK de otra app, no tocada).
- **C Chrome normal: PASS**; `/` muestra landing.
- **D Navegación: BLOCKED**, sin PWA.
- **E SW/offline: BLOCKED**, no se cambió conectividad.
- **F Actualización same-origin: NOT TESTED**, sin instalación previa.
- **G Push real: NOT TESTED**, sin mecanismo autorizado.
- QA final P1/Codex: **INCOMPLETA**. Se evita publicar serial del ADB o confundir un WebAPK de terceros.

**Limitación de observación:** el revisor recibió resumen y nombres de capturas, no los archivos binarios `ui-chrome-menu.png`, `manifest-response.txt`. No ejecutó ADB ni consiguió respuesta HTTP propia de la Preview (fetch externo falló desde este entorno). **No afirmar que se observó literalmente un header 307/Location**. La QA sí reporta la respuesta final HTML.

**Verificación independiente del deployment:** Vercel get_deployment del hostname confirmó **READY**, project cadeapp-develop, deployment `dpl_3RHtAEyKXgSeJ9To9wFW81qCvZpy`, SHA git `74fd2150c629b396ff9843cd285e70b93cbd42cb`. CI build job 114064627176 generó la ruta `/manifest.webmanifest` (Next route ○ 216 B). Los tests actuales solo comprueban `manifest()`, no la respuesta HTTP anónima.

## 2. Hallazgo PR295-H14 — BLOCKER: /manifest.webmanifest interceptado por auth middleware

- **Fuente:** `src/middleware.ts` matcher actual: `'/((?!api|_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'`.
- `/manifest.webmanifest` no cumple exclusión y **pasa por middleware**.
- `updateSession()` ejecuta `evaluateRouteGuard(pathname,session)`; para usuario sin sesión y ruta no pública, guard redirige a `/login?redirectTo=%2Fmanifest.webmanifest`.
- `isPublicRoute` no incluye `/manifest.webmanifest`. Un cliente que sigue redirects terminaría en HTML, igual que lo reportado por la QA.

**Diagnóstico:** mecanismo altamente fundamentado en source; confirmar HTTP 3xx+Location en la Preview con `curl.exe -sS -D - -o NUL --max-redirs 0 <URL>/manifest.webmanifest` y después GET final. Considerar Vercel Deployment Protection u otros redirects si el header difiere. No asumir que la definición de `manifest.ts` es errónea: valores `id:'/'`, `start_url:'/login'`, `display:'standalone'` correctos.

**Solución recomendada, pendiente de autorización P1:** excepción limitada en matcher para recurso exacto `/manifest.webmanifest`. No desactivar auth para todo `.*` ni añadir una excepción amplia `*.webmanifest`. Añadir caso matcher `src/middleware.test.ts`: el manifiesto público no corre middleware; recursos protegidos y casos preexistentes siguen protegidos. Test HTTP anónimo en Preview nuevo: **200**, JSON valido, MIME manifiesto `application/manifest+json` (admitir parámetros charset) y sin redirects; controlar <code>id</code>, <code>start_url</code>, <code>display</code>.

## 3. Hallazgo PR295-H15 — BLOCKER independiente: /sw.js interceptado por el mismo matcher

`public/sw.js` está presente e incluye precache `/manifest.webmanifest`, iconos y recursos; registra listeners install/activate/fetch/offline. Pero `/sw.js` tampoco está en las exclusiones del middleware y no es ruta pública para `evaluateRouteGuard` anónimo. Esto implica riesgo concreto de **redirect/HTML en lugar de JS**, impidiendo registro del service worker, aunque H14 sea reparado. **La QA no ejecutó `/sw.js`**, así que el estado HTTP se anota como no verificado externamente, pero la cadena de código es la misma.

**Solución recomendada:** añadir exclusión exacta de `/sw.js` junto con manifiesto y una prueba `unstable_doesMiddlewareMatch` que ambos sean `false` sin cambiar otras reglas. Verificar respuesta HTTP `200` y MIME JavaScript válido, registro real del SW y cache de assets. Cuidado con re-direcciones, HTML cacheado y cache.addAll del manifest.

## 4. Alcance y autorización P1

**No autorizado aún:** `src/middleware.ts` y `src/middleware.test.ts` están expresamente fuera de los «Archivos permitidos» en la ficha de `develop` para T-338. El middleware está declarado `Fuera de alcance`. Por ello el revisor no tocó código ni puede instruir a Kira que lo modifique sin una excepción P1.

**Decisión recomendada A:** autorizar **solo** `src/middleware.ts`, `src/middleware.test.ts`, `docs/tasks/T-338.md` (registro de excepción) y `docs/tasks/log/T-338.md` para excluir **exactamente `/manifest.webmanifest` y `/sw.js`** y demostrar RED→GREEN. Sin cambios de lógica de auth, guards ni rutas privadas; no tocar workflows, seguridad ni otros assets.

**Alternativa B:** no autorizar la excepción; crear tarea transversal de middleware con su propio alcance, bloqueando merge de #295 hasta que se integre y valide en esta Preview. Más trazabilidad intertarea, mayor costo y retraso. No es apropiado declarar PASS Android hasta comprobar los dos endpoints.

## 5. Estrategia RED→GREEN y repetición de QA

1. **HTTP preliminar, sin redirects:** `curl.exe -sS -D - -o NUL --max-redirs 0 <preview>/manifest.webmanifest` y mismo para `/sw.js`. Si el código indica 307 hacia login, cerrar causa H14/H15; si fuera Vercel Authentication o un error Next, corregir diagnóstico **antes** de editar.
2. **RED unitario del matcher:** agregar pruebas que exijan `unstable_doesMiddlewareMatch(...url:'/manifest.webmanifest')===false` y `...url:'/sw.js'===false`. Antes del fix deben fallar, mientras `/login`, `/courier/feed` y `/otra.js` mantienen comportamiento protegido.
3. **Cambio mínimo:** exclusión de esas **dos rutas exactas** en matcher. No mover la ruta PWA, no editar `manifest.ts` ni permitir cualquier `.js` o `.webmanifest`.
4. **GREEN local y CI:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, db-tests cuando corresponda, budgets y E2E; sobre nuevo SHA.
5. **HTTP runtime Preview nuevo:** ambos recursos `200` sin Location y con MIME correcto y body válido, sin cachés contaminados; validar manifest id/start_url/display, instalar Chrome Android, registrar/activar SW y navegar offline.
6. **Repetir QA A-E** sobre el nuevo SHA y el origen correcto; F solo con entorno same-origin anterior y G solo con mecanismo push autorizado. No desinstalar apps de terceros ni borrar datos personales. QA de arranque frío requiere video de pantalla.
7. Nueva ronda independiente del HEAD y de la QA; no aprobar ni mergear antes.

**CI de R8 sigue siendo evidencia válida para el viejo SHA:** [CI 38002801584](https://github.com/cadeApp/cadeApp/actions/runs/38002801584) success y [E2E Preview 38002879664](https://github.com/cadeApp/cadeApp/actions/runs/38002879664) success (46 Chromium+3 global-settings), pero esos tests no ejercían instalación anónima Android. No compensan H14/H15.

No se cambiaron feature branch, develop, seguridad ni dependencias. Sin merge.
