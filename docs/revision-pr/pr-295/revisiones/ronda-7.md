# Revisión independiente — PR #295 / T-338 — Ronda 7

Fecha: 2026-10-09 · Autor KiraK72 (P3) · HEAD funcional exacto `a157fe48599600ccd65a5e52aa8a06ca1d692f8e` · Ronda anterior `8c27939578d4e57eb8678382ba9828d389393cde`.

**RESULTADO: CON BLOQUEANTE TÉCNICO (PR295-R03 + gate H07).** E2E standalone en modo instalado sigue sin funcionar en el runner, aunque el resto pasó. Android físico lo hará P1 *cuando quede cerrada la revisión técnica*. No aprobado, no mergeado.

## 1. Diff, alcance y decisiones vigentes

`8c279395...a157fe48` son un solo commit y **3 archivos**: `docs/tasks/log/T-338.md` (+62, append-only), `e2e/specs/push-user-activation.spec.ts` (+6/-46) y `src/features/notifications/install/standalone-navigation.test.tsx` (timeout bloque de casos, 30s→60s). No hay cambio al E2E `pwa-standalone.spec.ts`, al CSS funcional, a manifest/SW, a push productivo ni a workflows. El test push sigue dentro de la autorización P1 A03=A; el timeout es archivo autorizado por `src/features/notifications/install/**`. No aparecieron modificaciones a `docs/revision-pr/**` por el autor en este commit. `develop` actual: `8ebd5e2164cb895f320cec0562469f1382eedaa8`; GitHub reporta `mergeable=true`, sin sustituir gates.

La bitácora dice haber ejecutado pruebas diagnósticas en Windows en `/scratch` con Chromium **140.0.7339.186**: `PWA.install → changeAppUserSettings → PWA.launch` y `--app` usando **Chrome completo + --headless=new** darían `display-mode:standalone=true` y wrapper oculto. **Es evidencia declarada por el autor**, no ejecución verificada en Ubuntu CI. En el commit **NO** se implementó esa estrategia en el spec que ejecuta el gate.

## 2. Validación independiente en CI sobre SHA exacto

[CI run 37998095254](https://github.com/cadeApp/cadeApp/actions/runs/37998095254): `unit`, `typecheck`, `lint`, `db-tests`, `audit`, `build`, `bundle-budget` **success**. `unit`: 127 test files Vitest passed. Vercel Preview **success**.

First Load JS del build job `114049154767`: **`/ 138 kB`, `/legal 138 kB`, `/login 169 kB`, `/register 169 kB`**; las cuatro cumplen <=180 kB. R01 y H08 siguen verificados en este HEAD.

[E2E trusted run 37998198367](https://github.com/cadeApp/cadeApp/actions/runs/37998198367), job `114049571940`: **45 passed / 1 failed**. Tres intentos del standalone fallan `Expected:true / Received:false` al ejecutar `window.matchMedia('(display-mode: standalone)').matches` en `e2e/specs/pwa-standalone.spec.ts:100` **antes** de visitar `/`. Por tanto, no demuestra defecto de la PWA instalada, pero tampoco cumple su DoD.

**Corrección importante sí acreditada:** el E2E nuevo `push-user-activation.spec.ts` del consumidor real `/courier/profile/notifications` aparece en logs como **passed (10.2s)**. Pasó la observación nativa del gesto al llamar `Notification.requestPermission` (respuesta `denied` intencionalmente stubbeada), recuento único, copy denegado real y ausencia de mensaje de éxito. H11/H12 pasan a `arreglado-verificado` para este SHA. H13 (test artificial/sleep fijo) desapareció por inspección; **sin mutación genuina independiente del producto**, estado `arreglado-sin-verificar`, no atribuir RED que no se ejecutó.

## 3. PR295-R03 / H07 — ÚNICO BLOQUEANTE TÉCNICO ACTIVO

El test `pwa-standalone.spec.ts` continúa usando `page.context().newCDPSession(page)` y `Emulation.setEmulatedMedia(display-mode: standalone)`, el mecanismo que **ya se comprobó que no cambia display-mode nativo**. En CI el E2E aborta antes de inspeccionar CSS o verificar visibilidad. Una aserción permanentemente roja no ofrece la garantía anti-flash que busca T-338.

**Observación nueva de revisión (alternativa técnica más acotada que las propuestas A/B/C del autor):** Playwright documenta explícitamente **`channel:'chromium'` con `headless:true`** para optar por el **Chromium completo en nuevo modo headless** en lugar del `chrome-headless-shell` por defecto (https://playwright.dev/docs/browsers#chromium-new-headless-mode). El workflow actual `.github/workflows/e2e-preview.yml` ya ejecuta `pnpm exec playwright install --with-deps chromium`, que descarga binarios Chromium requeridos; *no se ha comprobado en esta revisión que el runner Linux active PWA mode así*. Por eso **no asumir que hay que modificar CI, requerir Xvfb o cambiar DoD todavía**. El texto de la bitácora solo prueba que `headless:false` requiere un display server, no que **`headless:true + channel:'chromium'`** sea inviable.

### Opciones técnicas (orden recomendado)

- **Opción A — recomendada, EN ALCANCE, sin decisión adicional P1:** editar SOLO `e2e/specs/pwa-standalone.spec.ts` para intentar controlar un **contexto nuevo aislado de Chromium completo** lanzado con `chromium.launch({ channel:'chromium', headless:true })` o `chromium.launchPersistentContext(profileTemporal,{channel:'chromium',headless:true,args:['--app=<PreviewURL>']})`; si PWA.* disponible, probar su `install/launch` desde `browser.newBrowserCDPSession()`. Verificar **primero** `matchMedia('(display-mode:standalone)').matches===true` *nativo* en la ventana app controlada, no en el page fixture original; luego registrar wrapper oculto por **CSS del bundle servido**, sonda de frames antes de navegar a `/`, final `/login`, prueba normal aparte y mutación RED→GREEN real. Cerrar/desinstalar/borrar perfil en finally. Si el contexto de app no se puede controlar o la media sigue false, **fallar cerrado y registrar error exacto**.
- **Opción B — necesita autorización P1:** variar `playwright.config.ts`, launcher del E2E en GitHub Actions, o exigir `xvfb-run` para headed. No se presupone necesario ni mejor; aumenta superficie del runner y costo de mantenimiento. Considerar solo tras descartar A con evidencia Linux CI.
- **Opción C — necesita autorización P1 y cambia cobertura/DoD:** controles automáticos de CSS compilado + redirección JS con gate manual Android físico. Menos fiel al requisito E2E instalado; no aplicarla sin decisión explícita.

**Por qué A:** preserva la aserción en navegador realmente standalone **sin ampliar archivos ni modificar los otros 45 tests**, y Playwright confirma soporte de nuevo headless completo. **Riesgo:** la integración PWA.* o `--app` podría comportarse diferente en Ubuntu aunque funcione en Windows: aún no es un arreglo probado. B es una alternativa de infraestructura si A no sirve; C acepta rebajar la garantía automatizada y sería la última opción.

**Guía mínima para Kira:**
```ts
import { chromium, test, expect } from '@playwright/test';
// Experimento dentro de e2e/specs/pwa-standalone.spec.ts, no código final:
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const browserCDP = await browser.newBrowserCDPSession();
  // Probar PWA.getOsAppState / PWA.install con manifestId de Preview, no emular display-mode.
  // Crear/identificar la ventana APP del mismo browser; no usar la page común.
  // Registrar native matchMedia y computedStyle, lanzar navegación, probar anti-flash.
  await browserCDP.detach();
} finally {
  await browser.close();
}
```
Usar `testInfo.project.use.baseURL` o `PLAYWRIGHT_TEST_BASE_URL` solo contra el Preview de esta PR (sin hostname inventado), mantener contexto aislado y limpieza en `finally`. Evitar `setTimeout`/sleep para forzar green; no modificar `navigator.standalone`, `matchMedia`, CSS o expectativas; si no existe app target, test debe fallar con diagnóstico real. **El único RED válido es una mutación temporal del código productivo de CSS/navegación que el mismo E2E detecte y que se revierta**, no introducir CSS desde la prueba.

La autorización para editar spec E2E está en la ficha T-338. **No hace falta preguntar a P1 para probar A**. Si A efectivamente requiere nuevos archivos/CI/DoD o falla en CI, documentar resultados y llevar alternativas B/C a P1 con evidencia y sin ejecutarlas.

## 4. Pruebas y entrega para siguiente ronda

Cambios permitidos ahora: `e2e/specs/pwa-standalone.spec.ts` y `docs/tasks/log/T-338.md` append-only; tocar `e2e/specs/push-user-activation.spec.ts` solo si aparece fallo verificado, porque ya pasa. **No modificar** `docs/revision-pr/**` (exclusivo de revisión en `docs/revisiones`), `.github/**`, config Playwright, fixtures, producto push, auth, dependencias; conservar presupuesto.

Comandos mínimos: `git fetch origin && git switch feat/T-338-pwa-standalone && git pull --ff-only origin feat/T-338-pwa-standalone`, `pnpm lint && pnpm typecheck && pnpm test`, `pnpm build` + parser numérico cerrado de 4 rutas, `pnpm exec playwright test e2e/specs/pwa-standalone.spec.ts --project=chromium` y revisión del nuevo workflow Preview para SHA exacto. Documentar salida real de `chromium.version()`, binario/canal, `PWA.*`, target, `matchMedia`, CSS y cleanup; no inventar pruebas.

CI y E2E Preview en GREEN tras push a nuevo SHA son necesarios, y el ensayo RED→GREEN debe ejercer producto real. Solo entonces solicitar nueva revisión independiente. **P1 hará Android físico al finalizar la revisión técnica, no ahora.** No aprobar ni mergear.

## Límites

Este informe se basa en **inspección de diff y logs remotos verificables**; NO corrí tests locales ni Chromium en Ubuntu desde este entorno, y los diagnósticos `/scratch` declarados por Kira **no se reprodujeron independientemente**. Las conclusiones de Playwright sobre el nuevo headless se contrastaron con documentación oficial, no constituyen resultado E2E demostrado.
