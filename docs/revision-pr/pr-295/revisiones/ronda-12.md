# Revisión independiente — PR #295 / T-338 — Ronda 12 (QA Android H16)

**Fecha de informe QA:** 2026-10-10 (hora local dispositivo). **HEAD exacto revisado:** `4e26d24feba002b8247ba7feb2c20b052418f9fa`. **PR:** #295, rama `feat/T-338-pwa-standalone` a `develop`. **Estado GitHub:** abierta, `mergeable=true`, NO mergeada.

**RESULTADO:** **SIN BLOQUEANTES FUNCIONALES NUEVOS IDENTIFICADOS; H16 VERIFICADO POR CI + INFORME QA FÍSICA P1/CODEX. NO MERGEAR TODAVÍA**, porque el status `e2e-preview` del commit final estaba **PENDING** en GitHub durante esta revisión. Condición explícita de salida: `e2e-preview=success` en el mismo SHA y checks relevantes aún verdes, sin nuevo commit; **luego P1 puede decidir el merge**. No hace falta nuevo cambio de código por esta ronda.

## 1. Diferencias y alcance

Desde R11 (SHA `3b7484e4b310f41d78eb6de06d21a6cedee10686`) se agregaron dos commits:

1. [`87bf2cd2`](https://github.com/cadeApp/cadeApp/commit/87bf2cd2ea371ca515de85801c22d2a2595e6819): 4 archivos `src/features/auth/guards.ts`, `src/features/auth/guards.test.ts`, `docs/tasks/T-338.md`, `docs/tasks/log/T-338.md`.
2. [`4e26d24f`](https://github.com/cadeApp/cadeApp/commit/4e26d24feba002b8247ba7feb2c20b052418f9fa): ajusta una aserción histórica incompatible (`isPublicRoute('/legal')` esperaba false) en `guards.test.ts` y anota CI en bitácora. **No se eliminó ninguna prueba.**

La decisión R11-A de P1 autorizó solo esos archivos: allowlist exacta de 5 páginas legales ya existentes; no hubo cambio a `updateSession`, cuerpo `src/middleware.ts`, auth server, roles, MFA, RLS ni dependencias. La ficha actual registra la autorización.

**Nota de independencia:** el propio asistente revisor aplicó este *fix mínimo* en la rama a solicitud expresa de P1. Por tanto **no es válido presentarlo como code review enteramente independiente**. Esta ronda verifica el diff y los logs y se apoya en una **QA Android realizada por P1/Codex** para acreditar el resultado externo. P1 conserva la decisión de aprobar/mergear.

## 2. H16 / control de acceso legal: corrección

El diff introduce:
```ts
const PUBLIC_LEGAL_ROUTES = new Set([
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/legal/courier',
  '/legal/pilot',
]);
```
`isPublicRoute` ahora devuelve true para esos pathnames **exactos**, además de los públicos anteriores; `evaluateRouteGuard(pathname,null)` permite los documentos. No habilita un prefijo abierto `/legal/*`. Las rutas `/legal/admin`, `/legal/terms/private`, `/legal2`, paneles merchant/courier/admin y `/login/mfa` siguen bajo default-deny. Los tests de `guards.test.ts` incluyen cinco casos públicos y diez negativos. Los controles preexistentes de redirect post-login continúan rechazando aliases y rutas inseguras. La aserción histórica de `/legal` fue actualizada por el único fallo real del primer CI, no eliminada.

## 3. CI exacto revisado

**Run CI [38017790121](https://github.com/cadeApp/cadeApp/actions/runs/38017790121): `completed/success`** con siete jobs:
- `unit` job `114111893863`: **127/127 test files Vitest PASS**, `guards.test.ts` **103 tests PASS**, suites complementarias Node 79/79 y 6/6.
- `db-tests` job `114111893900`: **10/10 + 1.903/1.903** pgTAP PASS. No se levantó Supabase local.
- `typecheck`, `lint`, `audit`, `build`, `bundle-budget`: **success**.
- `approval-policy` success, Vercel status success, Supabase Preview skipped (previsto).
- First Load JS producción: `/ 138 kB`, `/legal 138 kB`, `/login 169 kB`, `/register 169 kB`, todas <=180 kB.

**Deployment inmutable ligado al HEAD:** `dpl_6G7YaCVCrtdL4ZKMeYbE3ArRGDLP`, https://cadeapp-develop-m6l66bxqw-lautaroj073.vercel.app, READY.

GitHub status `e2e-preview=pending` para SHA `4e26d24feba002b8247ba7feb2c20b052418f9fa` al revisar el 2026-10-10: target [run 38017862788](https://github.com/cadeApp/cadeApp/actions/runs/38017862788), job `114112096139` `in_progress`; no hay conclusión de éxito visible aún. La QA de Codex afirma que leyó `completed/success`; ante discrepancia prevalece la consulta actual del status del SHA.

## 4. QA Android final aportada por P1/Codex

Informe textual fechado 2026-10-10 sobre Samsung SM-G780G Android 13 Chrome 154 y el **WebAPK del nuevo origen** `org.chromium.webapk.a0ecf02450cd6dbaf_v2`. Validación explícita: ADB USB + `adb forward tcp:9222 localabstract:chrome_devtools_remote`, target CDP con `display-mode:standalone===true` **nativo** y actividad Android `com.android.chrome/...SameTaskWebApkActivity` en primer plano. **No se usó emulación de matchMedia para afirmar standalone.**

| Caso | Resultado aportado | Lectura de revisión |
|---|---|---|
| HTTP legal 5 rutas | PASS | GET anónimo 200 y contenido específico de documentos, sin login HTML |
| Rutas privadas y /legal falsos | PASS | 307 a /login, cinco pruebas con sus paths |
| Login→terms→legal→login | PASS | Captura de navegación CDP real en contexto WebAPK |
| Login→privacy→legal→login | PASS | CDP real y contenido «Política de Privacidad» |
| Register→terms/privacy→login | PASS | CDP real, no se ingresaron datos ni aceptaron términos |
| WebAPK arranca en /login | PASS (destino) | Primera pantalla final /login; 3 arranques informados |
| Navegación a / en WebAPK | PASS (destino) | CDP real en app Android terminó en /login sin Chrome externo ni landing observada |
| Chrome normal / | PASS | Landing de marketing visible |
| SW/offline | PASS **reutilizado** | SW instalado confirmado en nuevo origen; respuesta offline «Sin conexión» probada sobre origen anterior con mismo código SW, **no repetida offline en nueva URL** |
| Actualización same-origin F | NOT TESTED | No hubo instalación previa same-origin: no debe presentarse como actualización validada |
| Push OS real G | NOT TESTED | No mecanismo autorizado, no confundir E2E mock con concesión de OS |

**Calidad de evidencia:** P1 entregó un informe textual con nombres `cdp-results.txt`, `cdp-root-results.txt`, screenshots y headers; **no adjuntó los archivos crudos para inspección**. El revisor no accedió a ADB/Chrome, no ejecutó HTTP de la Preview ni revisó videos originales. Su conclusión H16 `arreglado-verificado` está soportada por CI/product source comprobados de manera independiente + prueba funcional P1/Codex **atribuida**, no por una simulación propia de Android.

**Flash/primer paint:** no hay `screenrecord` iniciado antes del lanzamiento; el estado final y la navegación CDP no prueban ausencia absoluta de flash breve. En R10 los E2E Chromium verificaron el CSS anti-flash bajo modo aplicación. El E2E de este SHA queda pendiente según status GitHub; confirmar verde para no confundir los alcances.

## 5. Mutación estática independiente y límites

El revisor extrajo el `PUBLIC_LEGAL_ROUTES` literal del source del commit y ejecutó evaluación exacta contra **16 casos**; **16/16 GREEN**. Tres mutaciones solo en memoria dieron RED: eliminar `/legal/terms`, convertir el control a `startsWith('/legal')`, agregar `/legal/admin`. Resultado registrado en [comandos-ronda-12.md](../evidencia/comandos-ronda-12.md). El harness fue además validado localmente sobre un **fragmento idéntico de la allowlist**, no sobre checkout completo; **no ejecuta Next ni `evaluateRouteGuard`**. La prueba completa real de ambos símbolos y guards corre en CI, con 103/103 tests, y QA Android por tercero.

## 6. Veredicto y gate final

**H16: `arreglado-verificado` (SHA exacto). H14/H15 se mantienen cerrados/verificados.** No se abrió ningún defecto funcional nuevo. Evidencia del usuario cubre D y B antes BLOCKED (ahora PASS); limitaciones de video y offline reutilizado expresas, no se maquillan.

**ÚNICO gate de integración todavía pendiente de verificación actual:** `e2e-preview` de `4e26d24feba002b8247ba7feb2c20b052418f9fa` debe publicar status final **SUCCESS**; al revisar quedó PENDING [run 38017862788](https://github.com/cadeApp/cadeApp/actions/runs/38017862788). Si ese run falla, investigar causa, no asumir que QA manual lo sustituye. Si termina SUCCESS, PR mergeable y CI sigue verde, **queda técnicamente apta para decisión final de P1**, sin nuevos commits de código.

**No aprobar, no mergear**, no modificar la rama autor funcional desde esta ronda. El reporte independiente se registra en `docs/revisiones`.
