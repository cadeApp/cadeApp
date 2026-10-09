# Informe independiente — PR #295 / T-338 — Ronda 6

Fecha: 2026-10-09 · PR de KiraK72 (P3) · HEAD funcional `8c27939578d4e57eb8678382ba9828d389393cde` · Base develop consultada `b8503fa13c21fd172ee3bd79045d66efb35af3ba`.

**Resultado: CON BLOQUEANTES (4)**: R03 (CDP no emula standalone), H12 (copy E2E incorrecto), H13 (mutación artificial + sleep) y H07 (gate E2E real rojo). R02 fue corregida solo por inspección; H06/H10/H11 parciales. Android físico será probado por P1 al concluir la revisión técnica, no ahora.

## Alcance y diff

Un commit posterior a R5: `64c0dfb...8c279395`. Cambios en exactamente cuatro archivos: `docs/tasks/T-338.md`, `docs/tasks/log/T-338.md`, `e2e/specs/pwa-standalone.spec.ts`, `e2e/specs/push-user-activation.spec.ts`. Autorización P1 R5 A03=A asentada en ficha, sin cambios de código productivo, CI, auth ni dependencies. CSS artificial y mocks de display-mode retirados; ahora el test falla cerrado por una limitación real de emulación.

## CI y presupuesto independientes

CI [37890749606](https://github.com/cadeApp/cadeApp/actions/runs/37890749606) terminó SUCCESS: `unit` (127 archivos Vitest passed), `typecheck`, `lint`, `db-tests`, `audit`, `build`, `bundle-budget` todos success. Vercel Preview success. En los logs build job `113690895002`: First Load JS `/ 138 kB`, `/legal 138 kB`, `/login 169 kB`, `/register 169 kB`, los cuatro <=180 kB. R01 y H08 verificados para SHA exacto.

**E2E Preview real [37890833174](https://github.com/cadeApp/cadeApp/actions/runs/37890833174) — FAILURE:** 45 passed, 2 failed, cada fallo reintentado dos veces; logs job `113691212849`.

## PR295-R03 — BLOQUEANTE alto: CDP standalone no se aplica

`e2e/specs/pwa-standalone.spec.ts:23-27,93-100` llama a `Emulation.setEmulatedMedia` con `display-mode:standalone`; inmediatamente `window.matchMedia('(display-mode: standalone)').matches` devuelve **false** (esperado true) en tres intentos remotos. El test aborta **antes de visitar `/`**, por lo que no prueba ni destello ni ausencia de destello.

Playwright documenta limitaciones de emulación de display-mode en [issue #26853](https://github.com/microsoft/playwright/issues/26853); el propio autor lo había registrado en bitácora. No interpretar este fallo como defecto probado de la PWA instalada.

**Alternativa A — recomendada para investigar primero, sin autorización adicional:** experimentar dentro del spec permitido con contexto Chromium verdaderamente ejecutado en ventana app, por ejemplo `chromium.launchPersistentContext` con `--app=<preview-url>`; verificar *antes* `matchMedia(...).matches===true` nativo en ese contexto. Si no lo consigue en headless o precisa Xvfb/CI flags fuera de scope, documentar resultado exacto y pedir decisión, nunca afirmar que `--app` sirve sin prueba. Ejecutar entonces anti-flash contra CSS productivo, sonda del wrapper y mutación temporal de regla CSS para RED→GREEN.

**Alternativa B — solo previa decisión explícita P1:** dividir controles automatizados de CSS compilado y JS de navegación más una validación real de PWA instalada en Android por P1, como excepción documentada al DoD actual. Reduce cobertura automatizada y no es equivalente a A. Por calidad técnica recomiendo probar A antes, **sin adoptar B ni saltarse el gate** unilateralmente.

## PR295-H12 — BLOQUEANTE alto: test push vs texto real

`e2e/specs/push-user-activation.spec.ts:56` busca `/Notificaciones bloqueadas/i`. En `src/features/notifications/push/copy.ts`, el texto productivo real de `statusDenied` es `Avisos bloqueados en el navegador. Podés activarlos en cualquier momento desde los ajustes del sitio.` Playwright no encontró el texto inventado, 3 intentos.

**Hecho importante:** como la falla es posterior a `expect.poll(__capturedActivation).toBe(true)`, ese assert de *gesto nativo desde clic en el consumidor real* SÍ pasó en Chromium remoto. El test intercepta `Notification.requestPermission` y devuelve `'denied'`, por tanto NO valida un permiso realmente concedido por OS. Ajustar SOLO el texto esperado en spec (coincidente con copy real), añadir comprobación de exactamente una llamada y UX de rechazo, no alterar el producto.

## PR295-H13 — BLOQUEANTE alto: mutación independiente del producto con sleep

`push-user-activation.spec.ts:59-104` define un test llamado «control discriminante / mutación RED» que visita `data:text/html`, añade botón propio, usa `setTimeout(6000)` y `page.waitForTimeout(6500)`. Mide expiración del navegador, pero NO puede descubrir una regresión de la función real de permisos de cadeApp: pasaría incluso con producto roto. La skill del proyecto prohíbe sleeps fijos.

Retirar el control ficticio del spec. Para demostrar RED genuino, ejecutar **temporalmente y sin commit** una mutación en el código del flujo real que difiera la solicitud de permiso hasta perder el gesto, observar el E2E positivo rojo, revertir y observar verde; registrar ambos comandos/resultados honestamente. Si no se puede, reconocer explícitamente la limitación en la bitácora y no atribuir RED.

## Estados heredados

R02 (CSS inyectado) eliminado por diff → `arreglado-sin-verificar` en runtime; H06/H10 todavía parciales sin test native standalone. H11 parcial (gesto verdadero visto, UX denied fail); H07 gate rojo; H09 botón de recarga en código pero sin ensayo real de recuperación → corregido-sin-verificar. A03=A aceptado y documentado. No hay nueva decisión obligatoria para arreglar H12/H13 o experimentar A dentro del spec. Si A falla y hace falta ampliar CI/DoD, presentar opciones al P1 **antes** de implementarlas.

**Revisión independiente:** lectura del diff/archivos y CI+E2E remoto exacto. No ejecución de suite local, mutación propia, Android real ni merge. Android queda a cargo de P1 cuando revisión técnica quede sin bloqueantes.
