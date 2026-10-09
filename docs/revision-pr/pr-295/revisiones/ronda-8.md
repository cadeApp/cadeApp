# Revisión independiente — PR #295 / T-338 — Ronda 8

**Fecha:** 2026-10-09 (Argentina). **Autor:** KiraK72 (P3).  
**HEAD funcional exacto revisado:** `74fd2150c629b396ff9843cd285e70b93cbd42cb`. **R7 anterior:** `a157fe48599600ccd65a5e52aa8a06ca1d692f8e`.  
**Resultado: SIN BLOQUEANTES TÉCNICOS para el HEAD revisado.** La PR queda **LISTA PARA LA VALIDACIÓN HUMANA EN ANDROID de P1**, NO lista para un merge automático. Sin aprobación ni merge.

## 1. Cambios R7→R8

Un commit y solo **dos archivos**: `e2e/specs/pwa-standalone.spec.ts` (+122/-86) y `docs/tasks/log/T-338.md` (+49, append-only). La ficha T-338 autoriza ambos archivos. No cambió implementación productiva, CSS real, manifest/SW, dependencias, middleware, servidor, Playwright config, CI workflows ni las pruebas de push ya verdes. No cambió `docs/revision-pr/**` en la feature branch. El PR es mergeable según GitHub consultado, aunque develop evolucionó; revalidar antes de merge.

## 2. Resolución de PR295-R03 — modo standalone real observado en CI

El test ya no depende de `Emulation.setEmulatedMedia` —que en rondas anteriores no activaba `display-mode:standalone` en chrome-headless-shell—. En `e2e/specs/pwa-standalone.spec.ts` se lanza un `chromium.launchPersistentContext(tempProfile,{channel:'chromium',headless:true,args:[`--app=${targetURL}`]})`. La spec elige la página de aplicación del nuevo contexto, registra `addInitScript` y navega a `/`. Comprueba **nativamente, sin mocks:** `matchMedia('(display-mode: standalone)').matches===true`, `display-mode:browser===false`, redirección a `/login`, `landing_was_visible==='false'`, `wrapper_display_before_redirect==='none'`. Conserva test de navegador común con landing visible. No inyecta CSS correctivo ni altera `navigator.standalone`.

El trusted E2E del SHA `74fd2150c629b396ff9843cd285e70b93cbd42cb` ejecutó y aprobó **ambos casos**: navegador común y standalone (no es solo una declaración de la bitácora).

La bitácora documenta mutación local del código real: eliminar temporalmente `[@media(display-mode:standalone)]:!hidden` provoca RED `landing_was_visible=true`, restaurar producto produce GREEN. **No repetí independientemente esa mutación local**: la anotación se distingue del pase remoto, y no se inventa evidencia.

### Matiz de cobertura — no bloqueante antes de gate humano

`--app=${targetURL}` inicia una primera navegación automática a `/` cuando se crea el contexto. **El test instala `addInitScript` después de obtener `appPage`, y observa una segunda navegación explícita con `appPage.goto(targetURL)`**. Por lo tanto, su prueba anti-flash es válida para esa navegación real a `/` en modo standalone, pero **no demuestra que el primer arranque frío ya ocurrido antes de la instrumentación no haya pintado la landing**. Esto tampoco comprueba instalación de manifest y actualización desde una versión preexistente como proceso completo.

No considero esto bloqueante técnico en el estado actual porque el requisito de CSS ante navegación a `/` se probó en el navegador real con gate verde, la ficha y tests cubren `manifest.start_url='/login'` y `id='/'`, y P1 acordó verificar físicamente el **arranque inicial** y actualización de PWA. **No declarar «primer arranque Android probado»** hasta completar ese gate humano.

Mejoras de diagnóstico futuras (sin nueva ronda obligatoria): evitar ocultar el error original en el `catch {}` del launcher y garantizar eliminación del perfil aun si `appContext.close()` falla; hoy el camino éxito y limpieza ordinaria pasó en CI, no hay falso verde por ese catch porque se exige la media query nativa.

## 3. Verificaciones en HEAD exacto

**CI:** [GitHub Actions 38002801584](https://github.com/cadeApp/cadeApp/actions/runs/38002801584), todos `lint`, `typecheck`, `unit`, `db-tests`, `audit`, `build`, `bundle-budget` success; unit = 127 archivos Vitest. Vercel status success. **approval-policy** success (certifica política/formato, no autoría).

**First Load JS** del build job `114064627176`:
- `/`: 138 kB
- `/legal`: 138 kB
- `/login`: 169 kB
- `/register`: 169 kB

Todas <=180 kB. **Trusted E2E** [38002879664](https://github.com/cadeApp/cadeApp/actions/runs/38002879664), job `114064940200` success: **46/46 Chromium + 3/3 global-settings**. Standalone spec pasó en 1.0s; push-user-activation pasó en 10.9s. El status `e2e-preview` del commit `74fd2150c629b396ff9843cd285e70b93cbd42cb` es **success**.

H11/H12 push siguen verificados: click productivo y lectura de `navigator.userActivation` **nativo** durante `Notification.requestPermission`, pero el permiso se intercepta y devuelve `denied`. No confundir con aprobación por Chrome OS/Android. H13 (test `data:` con sleep) fue eliminado previamente por inspección; no atribuir mutación RED independiente de push.

## 4. Criterio de cierre técnico y prueba humana P1

**SIN BLOQUEANTES TÉCNICOS** para el SHA actual: R03, H07, H06, H10 y R02 resueltos con E2E runtime real e inspección. Otros hallazgos históricos H01–H05/H09/H13 siguen con la etiqueta conservadora «arreglado-sin-verificar» por no haberse reejecutado una batería de mutaciones independiente en esta sesión; no se detectó nuevo defecto funcional ni check rojo. No se convierte automáticamente su estado estructurado en «arreglado-verificado».

**Ahora sí corresponde que P1 realice la prueba manual Android** que había reservado para este punto, sin repetirle la tarea en cada ronda. Checklist humano relevante:
1. **PWA instalada desde Chrome Android / mismo origen:** abrirla en frío/cerrada, comprobar que arranca en `/login` y nunca muestra landing de `/`.
2. Intentar abrir `/` como deep link **dentro de la app instalada**: redirige a `/login` sin destello (distinguir de un enlace externo que abra Chrome).
3. En `/login`, el enlace Volver al inicio se oculta; en `/register` y `/legal`, devuelve a `/login`.
4. Probar offline (SW v2): no debe servirse el HTML de la landing; presenta respuesta «Sin conexión» y no una landing cacheada.
5. Si existe PWA instalada antes del cambio: probar **actualización en el mismo origen** (no dos URL de Preview de distintos hostnames), cierre/relanzamiento y repetición del arranque. Un nuevo hostname Preview equivale a otra PWA, no demuestra actualización.

La interacción push real de Android requeriría permiso de navegador y dispositivo; su E2E stubbed cubre gesto y rechazo pero no concesión OS. Validar push de forma humana solo si el entorno piloto lo permite sin generar suscripciones indeseadas.

No tocar rama autora por esta revisión. Si la validación manual resulta correcta, P1 debe decidir merge. **Antes del merge**, refrescar develop y HEAD, mergeabilidad, checks del SHA vigente y coherencia del plan; si cambia el código o se sincroniza con develop, puede requerir revalidación. No mergeé.

## Límites de independencia

Inspeccioné código remoto, diff exacto y logs CI/E2E para este SHA. No ejecuté worktree local ni mutación RED propia, no instalé PWA Android, no controlé un Chrome físico. La prueba RED de la bitácora es **autorreportada**. No se presentaron inferencias como pruebas propias.
