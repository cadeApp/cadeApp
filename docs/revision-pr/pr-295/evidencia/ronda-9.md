# Evidencia de investigación posterior a QA física — PR #295 Ronda 9

**Dispositivo y resultado:** recibido informe textual de P1/Codex del 2026-10-09, Samsung SM-G780G Android 13, Chrome 154; Preview `https://cadeapp-develop-iy7hwzom4-lautaroj073.vercel.app`. No se recibieron archivos de capturas originales. A BLOCKED, B BLOCKED, C PASS, D/E BLOCKED, F/G NOT TESTED.

**Deployment:** Vercel `get_deployment` confirmó READY, `dpl_3RHtAEyKXgSeJ9To9wFW81qCvZpy`, git SHA `74fd2150c629b396ff9843cd285e70b93cbd42cb` y URL exacta.

**Construcción:** CI `38002801584` build job `114064627176` incluye `○ /manifest.webmanifest 216 B 103 kB`. Fuente `src/app/manifest.ts` retorna `id:'/'`, `start_url:'/login'`, `display:'standalone'`; `src/app/manifest.test.ts` prueba función, no endpoint de red.

**Matcher/guard inspeccionado:** `src/middleware.ts` excluye svg/png/jpg/jpeg/gif/webp, favicon y _next, NO webmanifest ni JS raíz. `/manifest.webmanifest` y `/sw.js` hacen match y se pasan a `updateSession`. `evaluateRouteGuard` anónimo de `src/features/auth/guards.ts` redirige ruta no pública a `/login?redirectTo=...`; `public/sw.js` existe. `src/middleware.test.ts` no cubre ninguna de estas dos rutas.

**Límite importante:** la respuesta HTTP exacta no se pudo consultar desde este ambiente (falla de acceso externo/resolución del host). La QA informa contenido final `text/html` del manifiesto. **No afirmar 307 ni headers observados** hasta capturar con redirects deshabilitados. La ruta `/sw.js` no se solicitó desde QA: es riesgo derivado de fuente y necesita comprobación.

**Archivos a autorizar explícitamente en T-338:** `src/middleware.ts` y `src/middleware.test.ts`. Autorizar solo exclusiones exactas de `/manifest.webmanifest` y `/sw.js`, sin relajar guard de otras rutas.

**CI anterior GREEN no equivale a instalar PWA**. QA física debe repetirse tras el fix.

## Autorización posterior P1 (sin ejecución de código)

2026-10-09: P1 resolvió **R9 opción A** y ordenó publicar prompt con diagnóstico HTTP, RED→GREEN, control de seguridad y Android QA. En `docs/revisiones` se añadió `PR295-A04` estado `aceptado`. **No se ejecutó un nuevo GET HTTP, no hubo corrección de middleware, ni CI/QA Android nuevo** en el momento de esta anotación. La excepción debe implementarse y registrarse en `docs/tasks/T-338.md` en la rama de Kira, con tests antes y después. La evidencia Android existente sigue identificada como QA INCOMPLETA.
