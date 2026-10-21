# Revisión independiente — PR #459 / T-382 — Ronda 1

**Fecha:** 2026-10-20 · **SHA funcional examinado:** `1b24455f37b845b6b1e53ba672b459b62853ae06` · **base:** `develop@cf2fbe13ab7ee8348b4805dadccef5416abb9265`.

**Resultado: CON BLOQUEANTES (3).** Son **hallazgos por inspección**; las sondas propias son estáticas y no sustituyen la reproducción funcional. Decisiones de Lautaro073 ya cerradas: **1 → C** (baja pendiente persistente con reintento), **2 → B** (sanitizar `message` conservando `code` y `name`). H02: clasificar por origen de la excepción anterior a `subscribe()`. No hay decisiones pendientes.

## Precondiciones y alcance

Lectura previa: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md` y ficha `docs/tasks/T-382.md` **de develop**, no de la PR. La rama estaba 3 commits adelantada y 0 detrás de develop; GitHub mostraba `mergeable=true`. No se ejecutó `git merge-tree` (no hubo clon). Los 14 archivos modificados están permitidos. La ficha cambió únicamente sus «Notas para quien retome»: decisiones de implementación y política E2E, sin ampliación funcional advertida. Sin subcarpeta previa de `pr-459` en la rama y sin comentarios humanos previos (solo bot de Vercel).

La PR #460 (T-383) modifica el `POST /api/push/subscriptions` paralelamente; **la #459 no lo modifica**, ni toca `DELETE`, RLS, RPC, SW ni SQL. La ruta nueva `POST /api/push/subscriptions/status` exige sesión, filtra por endpoint + `user_id`, solo devuelve `{active}` y no filtra datos del otro usuario. El switch ficticio del perfil se retiró; `PUSH_STORAGE_KEY` no tiene autoridad para `active`.

## BLOQUEANTES

### PR459-H01 — Fallo parcial de baja conserva falsamente «activados» (ALTO)

**Ubicación:** `src/features/notifications/push/components/push-permission-prompt.tsx:76-88,146,247-291`; flujo complementario `src/features/notifications/push/subscription.ts:273-329`. **Detección: análisis de control de flujo**, no reproducción Vitest.

**Diagnóstico.** `unsubscribeFromPush()` ejecuta `subscription.unsubscribe()` (baja nativa) antes del `DELETE`. Si este devuelve 500, error de red o 401, conserva `PENDING_UNSUB_STORAGE_KEY` y devuelve `{ok:false}`. `handleDeactivate()` solo fija `errorMessage` y retorna; `accountState` permanece `active` y el botón sigue ofreciendo desactivar, aunque la suscripción del navegador ya no existe. Si se navega/reabre la página, `getPushSubscriptionStatus()` devuelve `inactive` por ausencia de suscripción, sin indicar la baja de servidor pendiente ni ofrecer explícitamente su reintento. El retry técnico en `unsubscribeFromPush()` existe por endpoint pendiente, pero no es accesible desde este nuevo flujo de UI.

**Arreglo elegido (decisión 1-C).** Introducir estado de **baja pendiente** (tipo local en `types.ts` y flujo en `subscription.ts`/`push-permission-prompt.tsx`), persistente ante remonte cuando `PENDING_UNSUB_STORAGE_KEY` es válido y no hay suscripción nativa. Nunca pintar «Avisos activados» en ese estado. Mostrar mensaje específico, CTA «Reintentar baja» que invoque `unsubscribeFromPush()` y use el endpoint pendiente conservado; al confirmarse `DELETE`, limpiar pendiente, pasar a `inactive` y confirmar desactivación. Ante nueva falla conservar pendiente y permitir nuevo intento. No autoalta, no enviar endpoint a URL/log, no tocar API `DELETE`. Usar estado de error genérico si falla sin endpoint pendiente (no afirmar pendiente inexistente). Evitar que una verificación asíncrona anterior repinte `active` después de desactivar.

**Pruebas:** en `src/features/notifications/push.test.ts` simular inicialmente estado backend activo; `unsubscribe()` resuelve `true`, primer `DELETE` 500/red, segundo `DELETE` 200: tras el primero no existe mensaje ni botón «activados», se muestra baja pendiente, el storage retiene el endpoint y el CTA de reintento; tras remonte mantiene la acción; en segundo intento debe enviarse el **mismo endpoint** en cuerpo de `DELETE` aunque `getSubscription()` sea `null`, se limpia pendiente y se ve inactivo. Mutaciones RED: eliminar visualización de pendiente; eliminar fallback `subscription?.endpoint || pendingEndpoint`. GREEN al restaurar. No falsear la respuesta del servidor que se afirma probar.

### PR459-H02 — Excepciones anteriores a `subscribe()` se confunden con error genérico de servidor (MEDIO, bloquea DoD)

**Ubicación:** `src/features/notifications/push/subscription.ts:129-131,201-205`, UI `src/features/notifications/push/components/push-permission-prompt.tsx:18-37,126-130`. **Detección: análisis**, sin ejecución independiente.

**Diagnóstico.** El `try` exterior abarca `navigator.serviceWorker.ready` y `registration.pushManager.getSubscription()`. Si una de esas dos operaciones rechaza, el `catch` exterior devuelve como código `err.message`, sin `logSubscribeFailure`. Es un error del entorno push del navegador **anterior a cualquier fetch**, pero el mapeo de la UI cae al mensaje genérico «No se pudo confirmar la suscripción con el servidor». La rama especial de `pushManager.subscribe()` sí clasifica `NotAllowedError` y otras excepciones; los pasos anteriores quedan sin clasificar.

**Arreglo:** acotar una captura para `serviceWorker.ready` y `getSubscription()`; reutilizar `classifySubscribeException` (`NotAllowedError` → `permission_blocked`, demás errores del navegador → `push_service_unavailable`) y `logSubscribeFailure` sanitizado. Sin petición POST ni almacenamiento positivo cuando fallan. No confundir excepciones posteriores al `fetch` o del `localStorage` con errores del servicio push; mantener semántica y contrato de rutas intactos. Asegurar clasificación por `name` de `DOMException` incluso entre realms cuando corresponda, sin incorporar `message` crudo como código.

**Pruebas:** `serviceWorker.ready` rechaza con `NotAllowedError` y `getSubscription()` rechaza con `AbortError`; esperar códigos diferenciados, cero `fetch` a `/api/push/subscriptions` y UI con mensaje del navegador/permiso en vez de «servidor». La mutación que devuelve `err.message` bruto debe fallar; restauración GREEN.

### PR459-H03 — El log copia texto de excepción sin sanitizar (ALTO, riesgo de exposición)

**Ubicación:** `src/features/notifications/push/subscription.ts:97-106,146-149,175-182`. **Detección: análisis; riesgo condicional, NO se observó una filtración real.**

**Diagnóstico.** `logSubscribeFailure` emite `{code,name,message:cause.message}`. Los tests actuales comprueban ausencia de endpoint/llaves en una falla de servidor/red con mensajes inocuos; no ejercen una excepción cuyo propio `message` contenga el endpoint, `p256dh` o `auth`. Si el runtime incorpora alguno en la excepción, se filtra al diagnóstico. La ficha pedía `name/message` originales *y* prohibía filtrar capacidades, tensión resuelta expresamente por Lautaro073.

**Arreglo elegido (decisión 2-B).** Preservar `code`, `name` y un campo `message` **sanitizado**, sustituyendo URLs push completas, pares etiquetados `endpoint=`/`p256dh=`/`auth=` y los valores reales conocidos del endpoint y las claves por `[REDACTED]`. No usar `JSON.stringify(error)` ni registrar `subscription` o payload bruto. Mantener una traza útil para diagnósticos, incluidas excepciones de `subscribe` y de red. Aplicar sanitización **antes** de llamar `console.error`; comprobar que ni endpoint ni claves aparezcan en ninguna llamada. Si no es posible identificar con seguridad un secreto, preferir mensaje seguro en vez de texto crudo.

**Pruebas:** una excepción del navegador con URL de capacidad y claves en `message`, y un rechazo de `fetch` con los mismos secretos, deben producir `code`/`name` esperados y `message` sin valores sensibles. Mutación que vuelve a `message: cause.message` → RED, restauración GREEN. No reemplazar aserciones exigentes por `toHaveBeenCalled()` genérico.

## Evidencia y qué NO se verificó

- Bitácora del autor: RED inicial `21 failed`, GREEN `164/164` unitario y siete mutaciones M1–M7 con líneas RED/GREEN. **No reproducidas por esta revisión.**
- E2E del autor: tres escenarios T-382 GREEN; gate local completo declarado con `CI=true` / `--workers=1` / Chromium `93 passed + 2 flaky ajenos (pasan en retry)` / global-settings `6 passed`, contra Preview de la rama y Supabase Develop. Se respetó cancelar `e2e-preview` durante rondas; **no se verificó independientemente** ni equivale todavía al job oficial final.
- Las sondas independientes S1–S3 sobre los blobs exactos del SHA examinado dieron `baseline defect detected=true` y `mutant (arreglo hipotético) defect detected=false`, **solo análisis estático en memoria**, no pruebas de comportamiento. Harness reproducible en [evidencia/comandos.md](../evidencia/comandos.md).
- No hubo clon disponible: **no se ejecutaron** `pnpm typecheck`, `pnpm lint`, `pnpm test`, Vitest, Playwright, `git merge-tree`, ni `node docs/revision-pr/analizar.mjs verificacion`. Con bloqueantes, no se tomó un verde de CI como criterio de cierre y no se dispararon workflows. `test:db` local n.a. al no tocar SQL ni archivos del servidor con base de datos.

## NO TOCAR / descartes

- No pedir un cambio en `POST /api/push/subscriptions`: pertenece a T-383/PR #460, y el arreglo de T-382 debe seguir compatible con su reasignación.
- No pedir service-role para `POST .../status`: usa sesión, filtro por usuario y RLS; no hay evidencia aquí de acceso entre cuentas.
- No usar `PUSH_STORAGE_KEY` como autoridad para «activados», ni confiar solo en el permiso concedido del navegador.
- No acusar `getSubscription()` por devolver `null` sin fallo: significa `inactive` salvo un endpoint pendiente legítimo.
- No exigir cobertura de servicios push externos reales en Chromium headless: la API nativa se simula, el backend/E2E de rutas reales se valida contra Develop.
- No cambiar `src/server/push/**`, `service worker`, RLS, el `DELETE` remoto, ni contratos no autorizados.

## Cierre de ronda

**Tres bloqueantes abiertos, ninguna decisión pendiente.** Agente implementador corrige en los archivos cerrados del prompt publicado en el **mismo comentario** de GitHub que el informe; no escribe `docs/revision-pr/**` ni marca `verificado`. Antes de pedir ronda 2: pruebas RED→GREEN reales y mutaciones nuevas, bitácora, commit [T-382], push y `git ls-remote`. La revisión independiente verificará el SHA nuevo. **No aprobar ni mergear todavía.** El gate oficial `e2e-preview` se ejecuta sobre el último push funcional cuando la ronda resulte sin bloqueantes; no volver a pedir CI GREEN por un commit documental de revisión.

Método: fuentes consultadas por GitHub conector a SHA fijo; sin despliegue ni acceso a secrets o servicios remotos.
