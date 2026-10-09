# Informe independiente R5 — PR #295 / T-338

**Fecha:** 2026-10-09 (Argentina)  
**HEAD funcional revisado:** `64c0dfb012eeabd7b98686b37bd571433cd04817`  
**HEAD anterior R4:** `3152af793d9bd42498e6b6a8600842979fd3aaaa`  
**Rama autora:** `feat/T-338-pwa-standalone` (P3). **Revisión escrita solo en `docs/revisiones`**, sin modificar su rama.  
**CI run:** https://github.com/cadeApp/cadeApp/actions/runs/37884330207  
**E2E Preview (ejecución pendiente al corte):** https://github.com/cadeApp/cadeApp/actions/runs/37884413239  
**Resultado:** **CON BLOQUEANTES (3)**: PR295-R02 (test anti-flash auto-oculta), PR295-H11 (falta navegador nativo), PR295-H07 (gate E2E sin resultado final válido en el corte). Los H06/H10 permanecen parcialmente abiertos hasta resolver R02. Android físico, reservado para P1 al concluir calidad técnica.

## 0. Decisión P1 R5 = A — aceptada

Se autoriza **exclusivamente** la creación de `e2e/specs/push-user-activation.spec.ts` y el ajuste documental correspondiente de `docs/tasks/T-338.md` para verificar el contrato de activación real en Chromium, sin fingir `navigator.userActivation`. La decisión no permite alterar `src/features/notifications/push/**`, autenticación, servidor, frontend fuera de ficha, `.github/**`, fixtures compartidos o relajar checks; si el test necesita alguno, Kira deberá presentar la alternativa exacta y pedir aprobación. No hace falta volver a consultar A/B.

**Fundamentación A vs B:** A separa E2E de permisos de notificación del E2E de arranque de PWA; evita acoplar fixtures y fallos distintos. B —anexarlo a `pwa-standalone.spec.ts`— también puede validar el mismo comportamiento, pero mezcla dominios de regresión. Ambos exigen entorno real y tienen idénticas limitaciones de permisos; la decisión es sobre mantenibilidad, no sobre asumir que A mejora mágicamente cobertura. No corresponde una C porque la autorización es solo de fichero de prueba y ya existe Playwright en CI; un endpoint demo nuevo ampliaría injustificadamente el producto.

## 1. Inspección de cambios R4→R5

`3152af7...64c0dfb`: 1 commit, **cinco archivos**: `docs/tasks/log/T-338.md`, `e2e/specs/pwa-standalone.spec.ts`, `src/features/notifications/index.ts`, `src/features/notifications/install/standalone-navigation.test.tsx`, `src/features/notifications/push.test.ts`. Están dentro del alcance vigente de la ficha en rama; no hay cambio de workflows, migraciones, auth o fuentes fuera del alcance. `develop` consultado: `92cd258545f25e162ada062c0c22c02ff17840b8` (no alterar/mergear ramas). Aunque la lista de `develop` es más estrecha, excepciones R2/R3 y nueva R5 están autorizadas por P1 y documentadas con trazabilidad.

## 2. Revalidación independiente de CI y presupuesto JS

En SHA **`64c0dfb`** (no extrapolados de una ejecución anterior):

| Check remoto | Resultado |
|---|---|
| lint | **success** (job 113670818424) |
| typecheck | **success** (113670818230) |
| unit | **success** (113670818404: 127 archivos Vitest, suite runner completa success) |
| db-tests | **success** (113670818373) |
| build | **success** (113670818402) |
| audit | **success** (113670818513) |
| bundle-budget | **success** (113671135937) |
| Vercel | **success** (status commit) |
| e2e-preview | **pending** al corte, run 37884413239 |

**Tamaños First Load JS medidos por el propio `next build` del SHA exacto:**
`/ = 138 kB`; `/legal = 138 kB`; `/login = 169 kB`; `/register = 169 kB`. Cada ruta está dentro de `<=180 kB`; regresión **PR295-R01 ahora verificada corregida**. Compilación y lint no dan concesiones para validar un test con falsos positivos.

## 3. Hallazgos R4 corregidos o parcialmente corregidos

**PR295-H08 — arreglado-verificado (CI):** los imports de `@/app/**` en `standalone-navigation.test.tsx` volvieron a ser dinámicos dentro de cada caso. El linter y build de GitHub success en SHA actual verifican que no reaparece `boundaries/element-types`. Las aserciones de consumidores productivos siguen en el test, por inspección.

**PR295-H09 — arreglado-sin-verificar:** en `src/features/notifications/index.ts:58-64,83-91`, la interfaz dice «Recargar la página» y por defecto invoca `window.location.reload()`; ya no promete que resetear un `React.lazy` rechazado descargue de nuevo. `push.test.ts:778+` induce una excepción con componente ficticio y prueba que un callback `onReload` se llamó; no comprueba una recarga de navegador real. Correcto en diseño, limitar la evidencia; mejora futura de prueba opcional, no rehacer un retry de red sin beneficio.

**PR295-H10 — parcial:** se quitó el `try/catch` CDP y la verificación del wrapper dejó de ser condicional; **pero se introdujo CSS desde el propio test (R02)**.

**PR295-H11 — parcial:** `push.test.ts:728+` monta el prompt, dispara `fireEvent.click`, pero **simula `navigator.userActivation` cambiando su propiedad**. Vale como test de orden/contrato en JSDOM; no certifica activación nativa ni browser cross-context. Nueva A03 autoriza E2E separado.

**PR295-H07 y H06:** con Preview Vercel success, E2E run 37884413239 estaba `in_progress` al corte. No hubo ejecución independiente Playwright local desde esta revisión. Incluso un futuro GREEN de ese run no demostraría anti-flash real si el spec inyecta CSS; R02 debe corregirse y volver a ejecutar todo.

## 4. PR295-R02 — BLOQUEANTE alto NUEVO: el test fabrica el CSS que promete verificar

**Archivo:** `e2e/specs/pwa-standalone.spec.ts:69–85, 87–104`.

Durante `page.addInitScript`, el test ejecuta `injectStandaloneCss`: inyecta un `<style data-test-emulation="display-mode-standalone">` con selector del wrapper y `display: none !important`. Lo llama desde `MutationObserver` y desde el loop `requestAnimationFrame`. Esto puede tapar una regresión en la **hoja CSS de producción** aunque el wrapper mantenga su clase en el HTML. `expect(wrapperDisplay).toBe('none')` pasa por estilos del test, no demuestra los del build servido por Vercel.

**No atribuir intención de adulteración:** es una falla del diseño de la prueba por inspección, no prueba de mala fe ni de bug real en CSS.

**Arreglo requerido:** eliminar completamente `injectStandaloneCss`, `data-test-emulation`, inserciones `<style>` y otros overrides que corrijan el CSS. Para el caso Chromium anti-flash, usar `Emulation.setEmulatedMedia` y verificar el CSS **nativo** del navegador, sin falsificar `window.matchMedia('(display-mode: standalone)')` ni `navigator.standalone` en el mismo caso de prueba. Separar caso de detección JS mockeada del caso de CSS real si hace falta. Probar que `getComputedStyle(wrapper).display==='none'` proviene del CSS servido y que `landing_was_visible==='false'` sin estilos de test. Ejecutar una mutación *temporal y reversible* que deje de ocultar la landing en CSS productivo: test **RED**, restaurar → **GREEN**. No editar Playwright config/CI ni reemplazar asserts por comprobaciones más débiles.

Si Chromium/CDP no admite la media query como se espera, registrar esa limitación y proponer método alternativo de navegador instalado o emulación fiel: **no** inyectar la solución de producto dentro del test.

## 5. PR295-H11 — bloqueante pendiente, nueva prueba E2E autorizada

Nuevo `e2e/specs/push-user-activation.spec.ts` debe probar desde **clic Playwright real** y `navigator.userActivation.isActive` **nativo**, no con `Object.defineProperty(navigator,'userActivation', ...)` ni banderas simuladas. Debe visitar un **consumidor productivo real** que ofrezca «Activar avisos», usando fixtures existentes si requiere sesión autorizada. Instrumentar lo mínimo imprescindible para observar el valor de `isActive` *justo antes de invocar* `Notification.requestPermission`; si por limitaciones headless se stubbea el diálogo de permisos, aclarar que el test prueba **presencia del gesto** y **orden**, no concesión nativa de permisos. Validar llamada una sola vez sin falsear resultados ni efectuar suscripciones reales. Incluir caso negativo (sin gesto no pedir permiso) si accesible y mutación que inserte espera antes de invocar API -> test RED. No acceder a datos productivos ni forzar valores del navegador.

**Descubrimiento CI:** `.github/workflows/e2e-preview.yml` ejecuta `pnpm exec playwright test --project=chromium --workers=1` y descubre todos los specs por `playwright.config.ts`; el spec nuevo debe incorporarse **sin cambiar CI**. Si no se puede mostrar consumidor real porque requiere credenciales no suministradas, registrar bloqueo de fixture y pedir permiso específico antes de abrir nuevas rutas/product code.

## 6. Verificación necesaria y manual humano

Antes de solicitar R6: registrar A03 en ficha de tarea de rama, añadir el spec dedicado, corregir R02, demostrar mutación RED/GREEN sobre el build real, pasar `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, cuatro tamaños <=180 kB y **`e2e-preview` green en nuevo SHA**. Conservar SW offline, manifest id/start_url, login/register/legal y caminos navegador normal. Sin `.skip`, `.only`, sleeps, test tautológico, CSS de test que sustituya reglas de producto, mocks que falsifiquen permiso o desactivación de controles. Bitácora honesta y push convencional.

**Android físico:** P1 realizará el test manual de PWA anterior/actualizada y navegador normal solo cuando la revisión técnica quede sin bloqueantes. No repetir solicitud ni considerar su ausencia bloqueo de revisión técnica. No aprobar ni mergear.

## Limitaciones de independencia

No hay clon local ni Docker/Supabase disponible desde esta revisión. Los resultados independientes consignados provienen de **logs remotos para SHA exacto** (CI real) y **inspección de código**. No se realizaron mutaciones RED propias, no se observó ejecución física ni resultado completo de E2E Preview al corte. La bitácora del autor es evidencia declarativa, no sustituto de verificación independiente.
