# Informe independiente — PR #295 / T-338 — ronda 4

**Fecha:** 2026-10-09 (hora Argentina).  
**HEAD funcional exacto:** `3152af793d9bd42498e6b6a8600842979fd3aaaa`.  
**HEAD previo R3:** `0ffb37056f296295bd9ca0ef8adff636bf21d21d`.  
**Rama a develop:** base registrada en PR `a773c05cc488a1fc60bfb36512cdca35d12d1271`; develop consultado `24aad21f800f0d13fdeb082f9807b8eaf1f10fba`. GitHub reporta mergeable=true, pero no hay gates suficientes.  
**Resultado:** **CON BLOQUEANTES (5)**: H08, H09, H10, H11 (cobertura requerida para decisión B), H07 (E2E aún sin GREEN). Además R01 necesita nueva medición por build fallido.

## Inspección de la rama y alcance

Comparación `0ffb370...3152af7`: 7 archivos modificados: ficha T-338, bitácora, E2E standalone, barrel `notifications/index.ts`, test de navegación, guard standalone y push.test.ts. Todos entran en los permisos expresos de la ficha actualizada en la rama, incluida B (autorizada por P1). No se editó `docs/revision-pr/**` por el agente en este cambio. No se tocaron auth, middleware, contratos, migrations o dependencias.

**Implementaciones valiosas / corregidas:**
- `src/features/notifications/index.ts` ya no usa `React.ComponentType<any>`; tipa LazyPrompt con `PushPermissionPromptProps`.
- `requestNotificationPermission` y demás API push vuelven a reexportarse directamente desde `push/subscription`. Esta estructura ya no introduce un dynamic import previo a la llamada, eliminando el riesgo específico de activación que vimos en R3.
- UI de push recibe Suspense fallback con texto accesible y Error Boundary. **El tratamiento de error está incompleto** (H09).
- El E2E agrega CDP nativo para emular CSS `display-mode: standalone`, que es mejor que mockear solo JS; **sus condiciones de ejecución son demasiado permisivas** (H10).
- La bitácora documenta comparativa B inicial vs consolidada con métricas de builds locales, pero no reemplaza medición remota posterior.

## H08 — BLOQUEANTE alto: CI lint y build nuevos fallaron por imports feature→app

`src/features/notifications/install/standalone-navigation.test.tsx:7-10` convirtió en estáticos cuatro imports reales de Home/Login/Register/Legal. `boundaries/element-types` prohíbe que `feature/notifications` importe `app`. Conecta tests reales, pero viola la dirección arquitectónica; el objetivo correcto no justifica esta nueva dependencia.

**Evidencia ejecutada, SHA exacto:** CI run [37873949380](https://github.com/cadeApp/cadeApp/actions/runs/37873949380), lint job `113638078094` failure en líneas 7-10, build job `113638078182` failure por los mismos cuatro errors. `unit`, `db-tests`, `audit`, `typecheck` son success. `bundle-budget` skipped (depende de build). La bitácora declara lint GREEN local, pero CI contradice esa conclusión, así que no se acepta su resultado como verificación del HEAD.

**Arreglo recomendado:** restaurar imports dinámicos de los consumidores reales, como tenía `0ffb370`, manteniendo exactamente las mismas aserciones discriminantes; comprobar `pnpm lint` y `pnpm build` en HEAD nuevo. Otra alternativa viable es reubicar el test de integración en `src/app/**`, pero **requiere autorización de nuevos archivos**; no elegirla por defecto porque no aporta ventaja demostrada. Nunca apagar ni exceptuar `boundaries`.

## H09 — BLOQUEANTE alto: botón Reintentar de push no recarga un React.lazy rechazado

`src/features/notifications/index.ts` define `LazyPrompt = React.lazy(...)` una sola vez a nivel de módulo. Su Error Boundary captura un rechazo de import y el botón solo `setState({hasError:false})`. React.lazy cachea el Promise (también rechazado); la nueva renderización arroja el mismo rechazo y se regresa al fallback. **La UI promete recuperación que el código no implementa.** Fuente primaria del contrato: https://react.dev/reference/react/lazy.

El test `push.test.ts:715-726` simplemente renderiza `PushPermissionPrompt` y espera el botón de activación con chunk exitoso; jamás simula red caida, rechazo de lazy, clic en Reintentar o segundo intento.

**Alternativas:**
- **A recomendada (simple y fiable):** exponer CTA explícito **«Recargar la página»** con recarga real desde click, en vez de un falso retry de estado. Comprobar pantalla de error recuperable tras restaurar red. No afecta contrato de permisos.
- **B más sofisticada:** un mecanismo de retry que recree el loader/lazy type y gestione fallos de import cacheados. Solo usar si un test real demuestra segunda descarga y éxito; mayor complejidad.
Por calidad y evidencia, recomendar A para un fallo de descarga persistente. No cambiar la semántica del prompt ni inventar un reset que no vuelve a pedir el chunk.

## H10 — BLOQUEANTE alto: E2E permite omitir silenciosamente la condición CSS probada

En `e2e/specs/pwa-standalone.spec.ts:23-31`, `try/catch {}` permite continuar si `Emulation.setEmulatedMedia` falla; en `:135-139`, `if (wrapperDisplay !== null)` hace opcional el assert `display === 'none'`. Incluso el test de navegador común admite que no exista wrapper. La emulación nativa de CSS es **esencial** al DoD y a la causa raíz que Kira declara haber encontrado; no puede quedar best-effort.

**Arreglo:** para chromium, exigir sesión CDP exitosa y verificar que efectivamente `window.matchMedia('(display-mode: standalone)')` en navegador real corresponda al CSS; exigir wrapper observado antes del redirect, valor no nulo `display:'none'`. Conservar sonda `landing_was_visible=false` y demostrar control de mutación que renderice un frame visible (RED) antes de revertirlo (GREEN). No debilitar expectations, no confundir ausencia de observación con ausencia de flash.

## H11 — BLOQUEANTE de evidencia/coverage para decisión B

`src/features/notifications/push.test.ts:681-713` simula activación con `queueMicrotask` y bandera `activationConsumed`. Eso comprueba parcialmente que el export nuevo no contiene un await local antes de invocar la función, pero **no demuestra la activación transitoria en un clic real de navegador** ni el comportamiento del consumidor productivo. `:715-726` tampoco prueba Error Boundary/fallo de chunk, que H09 exige. Preservar unit como control útil, **añadir** al menos un test navegador real orientado al evento y documentar limitaciones de permisos/automatización. No mentir sobre lo que `fireEvent` de jsdom permite certificar.

## H07 — Gate Preview sigue abierto

En el SHA funcional anterior `0ffb370`, dos runs `37819991679` y `37858651080` dieron **44 passed, 1 failed** (sonda `landing_was_visible=true`). En HEAD `3152af7` nuevo, Vercel informó `failure` para [este despliegue](https://vercel.com/lautaroj073/cadeapp-develop/3kKfM71KCjSNuDHVh5wTktmuaQQi); no hay `e2e-preview` real del nuevo SHA. No atribuir nueva falla a aserciones Playwright hasta que se ejecuten, ni declarar GREEN por los 2 E2E locales de la bitácora.

**Arreglo:** primero resolver H08, disparar deployment normal y obtener ejecución E2E del SHA exacto + su reporter `success`. Si el deploy no sale, investigar causa y registrarla.

## R01 — Presupuesto todavía NO verificable en este HEAD

El HEAD anterior `0ffb370` tuvo First Load JS `/ 138`, `/legal 138`, `/login 169`, `/register 169 kB` según CI. Kira reporta esos números también para su nuevo HEAD local, pero el **build remoto termina antes de reportar rutas** por H08. No afirmar que se midió `3152af7`; cuando build pase, registrar las cuatro medidas y asegurar <=180 kB, sin debilitar `bundle-budget` aunque hoy sea warning.

## Efectividad y límites de revisión

- Ejecutados en CI remoto, SHA `3152af7`: unit ✅, typecheck ✅, db-tests ✅, audit ✅, lint ❌, build ❌, bundle-budget skipped.
- `approval-policy` success verifica formato/política, no corrección ni revisión humana.
- Status Vercel=failure; status `e2e-preview` ausente en el HEAD nuevo. No se ejecutaron Playwright local ni mutaciones independientes desde este entorno.
- Comparativa de alternativas push: el restablecimiento de reexport directo es técnicamente mejor para el gesto que el import asíncrono inicial, pero su impacto nuevo en bundle se debe medir, no asumir.
- Android físico preinstalado, actualizado y Chrome navegador común: **pendiente de persona**, aunque el autor haya registrado pruebas locales.

**Conclusión:** No aprobar ni mergear. Arreglos sin decisiones nuevas de P1: corregir imports del test, reparar retry real o nombrar recarga, endurecer E2E y pruebas push, medir bundle, E2E Preview verde y Android real documentado.
