# Revisión independiente — PR #403 / T-367 — Ronda 2

**Fecha:** 2026-10-17  
**HEAD del código examinado:** `97fc11a62e545eee71581beec0c1825304ef80be`  
**Base:** `develop`; PR `feat/T-367-avatar-perfil` (21 commits detrás de develop, GitHub mergeable=true).  
**Resultado:** **CON BLOQUEANTES (2: PR403-H07 y evidencia visual PR403-H05)**; E2E Preview todavía sin éxito para este SHA.

## Lo que corrigió bien el agente

- **H01 — corregido por inspección, no verificado ejecutando:** `queries.ts:157-174` exige ahora `courier/<id>/avatar_<decimal>.<png|jpg|jpeg|webp>` y rechaza rutas de documentos de identidad; ya no firma `selfie_*`, `dni_front_*` ni subdirectorios, según el predicado leído. Se agregaron siete negativos en `queries.test.ts:373-395` y un positivo PNG.
- **H03 — corregido por inspección:** reemplazó `docQuery: any` y `fromMock as any` por `DocQueryBuilder` y cast `unknown`; el caso exitoso comprueba las llamadas de filtrado `courier_id,kind,status,is_current,purged_at`. Los mocks aún no emulan de forma exacta el filtrado SQL, por lo que no certifican por sí solos todas las combinaciones de filas.
- **H06 — mejora tomada:** `queries.ts:132` ahora filtra `is_current=true` dentro de la consulta antes de `order`/`limit`.
- **H02 — mejora material, pendiente de E2E efectiva:** `courier-onboarding.spec.ts:1511-1617` usa objeto real, comprueba `naturalWidth>0`, intento de firma RLS del segundo usuario y fallback. Sin embargo, una regresión nueva impide la alternancia de usuarios dentro de la misma página (H07).
- **H05 — parcial:** se desmarcaron los DoD de E2E/acceso cruzado y comprobación humana post-promoción, y la bitácora ahora incluye ejemplos concretos de RED/GREEN de consultas. Aún no se adjuntó demostración RED/reenable del render visual del avatar en el navegador y E2E Preview no está verde.
- **H04 — proceso:** la carpeta `docs/revision-pr/pr-403/` NO fue editada por el agente después de la R1; el informe del autor sigue archivado como `autorrevision-agy-r1.md` y el independiente como `ronda-1.md`.

## Nuevo bloqueante PR403-H07 — El mismo contexto no puede cambiar de courier con `loginAsCourier`

**Archivo:** `e2e/specs/courier-onboarding.spec.ts:1568,1576`  
**Clasificación:** Alto, test-coverage / correctness, regresión de pruebas.  
**Estado:** [ANÁLISIS DE FLUJO CERRADO — NO ejecutado en browser].

La E2E hace login como courier 0 en `page` (línea 1537), y después invoca `loginAsCourier(1, page)` (1568) y otra vez `loginAsCourier(0, page)` (1576). El helper no cierra sesión ni borra cookies: `e2e/fixtures/roles.ts:105-118` siempre invoca `LoginPage.navigate()`, es decir `page.goto('/login')`, y luego intenta completar el formulario.

**Contrato real y causa:** `src/features/auth/guards.ts:296-305` redirige cualquier usuario autenticado que entra en `/login` a su home. `src/features/auth/server.ts:101-114` aplica ese guard desde middleware a la navegación; `src/middleware.ts:8-11` incluye `/login`. Por lo tanto, tras ingresar como courier 0 no hay formulario `/login` para autenticar a courier 1: `e2e/pages/login.page.ts:50-57` intentará localizar el submit y agotará el timeout. No hay evidencia de que las sesiones se hayan aislado antes. Este es un **fallo determinista por contrato**, no un error observado en ejecución.

**Corrección exacta (sin modificar helpers ni rutas):** modificar **solo** `e2e/specs/courier-onboarding.spec.ts`. Agregar `browser` a las fixtures del test y usar `const otherContext = await browser.newContext({ baseURL: new URL(page.url()).origin })`, `const otherPage = await otherContext.newPage()`. Ejecutar `loginAsCourier(1, otherPage)` y la navegación/expectativas del segundo usuario en `otherPage`; cerrar `otherContext` en `finally`. **Nunca** reutilizar `page` para otro login ni re-login de courier 0: su `page` sigue autenticada y permite continuar directamente la fase de rechazo. Reemplazar `if (courier1)` por `if (!courier1) throw new Error(...)`: requisito fail-closed de dos cuentas.

**Evidencia RED→GREEN requerida:** probar esta misma E2E en Preview antes y después, con la aserción específica que falle al no separar contextos, y verificar visualización + aislamiento reales. No modificar auth, middleware, rutas públicas ni `LoginPage` para hacer pasar el test. Una mutación que haga volver `loginAsCourier(1,page)` debe dejarla RED; no ejecutar mutaciones contra staging remoto sin aislamiento ni desplegar código roto en una PR. Si solo se dispone del gate para probar el parche final, dejar el RED registrado como pendiente, no inventarlo.

## Bloqueante residual H05 — Demostración visual incompleta

El DoD requiere explícitamente demostrar que retirar el render de la imagen provoca fallo en una prueba real de salida visual. La bitácora de R1 decía que hubo 2 fallos iniciales al faltar `<img>`, y la R2 reproduce rojos de *queries*, pero **no aporta todavía una traza de mutación contra el render visual**. Conservar esa distinción: test de `getCourierApprovedAvatarUrl` no demuestra que el navegador dibuje el avatar. Para cerrarlo, usar una prueba temporal local del componente `components.test.tsx` (debe caer el `getByRole('img', {name:/Foto de perfil/})` cuando se elimina el bloque `<Image>`) o el procedimiento `e2e-mutation` previsto si corresponde y si el código ya se mergeó; documentar el resultado real y revertir el cambio del componente antes de push. No subir mutación ni alterar fixtures para simular verde.

## Estado externo conocido en esta ronda

- Vercel: despliegue preview en estado success del SHA examinado.
- CI: typecheck, lint, build, audit y bundle-budget en verde; al consultar, `unit` y `db-tests` seguían corriendo.
- `approval-policy`: rojo por `El PR requiere aprobación vigente de Lautaro073` (log del job 117533988403); no se pide aprobar mientras haya bloqueantes.
- `e2e-preview`: run 39079762114 pendiente al momento de revisar. No afirmar GREEN, cancelación ni fallo de aserción hasta el resultado real.
- En este entorno no existe un clon ni acceso DNS a github.com para correr Vitest/Playwright o `git merge-tree`; los hallazgos se probaron mediante lectura cruzada de fuentes de GitHub. No se utilizaron Supabase remoto ni Docker.
- Comparación de cambios desde `c5ab5f25`: solo `queries.ts`, `queries.test.ts`, `courier-onboarding.spec.ts`, ficha y bitácora. Ningún archivo fuera del alcance ni `docs/revision-pr/**` modificado por el agy.

## Próxima ronda

El autor corrige H07 dentro del único E2E y adjunta la evidencia de H05 en la bitácora; no toca esta carpeta. Confirmar resultado real del E2E del SHA final, checks pertinentes y que se cubren las dos cuentas. La validación humana tras promoción sigue siendo posterior al merge. **No hay decisiones 🔵 abiertas**.

**No mergear / no aprobar todavía.**
