# Revisión independiente — PR #459 / T-382 — Ronda 5

**Fecha:** 2026-10-20 · **SHA funcional:** `f8f2fc2501aad66a2bfd5ea52913f1d5195b2e5e` · **SHA de bitácora + E2E:** `8445008adf8d1cb179172f7237e946cb4a8b3115` · **Base develop:** `04f11839c659e67dbf32e8a80fa5da37819ce8d0`.

## Resultado: SIN BLOQUEANTES FUNCIONALES DETECTADOS POR INSPECCIÓN

**No equivale a autorización de merge ni a pruebas Vitest/Playwright independientes ejecutadas.** El último gate CI se encuentra pendiente: `audit` falló, `approval-policy` falló previo a este informe, `unit`/`db-tests` todavía estaban en ejecución y `e2e-preview` no estaba confirmado GREEN. **Decisiones técnicas pendientes: ninguna.**

## Fuentes y alcance

Se consultaron obligatoriamente `docs/tasks/T-382.md` y reglas `COMO-ENTREGAR.md`, catálogo `docs/revision-pr/README.md` y skill `revisar-pr` desde `develop`. Se examinó el código de `subscription.ts`, los tests de `push.test.ts`, el E2E `notifications.spec.ts`, bitácora, comentarios de PR y diff de R4→R5. Conector GitHub `compare(d9780e43, HEAD)`: **2 commits, 4 archivos**: `subscription.ts`, `push.test.ts`, `notifications.spec.ts` y `docs/tasks/log/T-382.md`, todos permitidos. `compare(develop,HEAD)`: **ahead=16, behind=0**. No se modificaron rutas API, RPC, SQL, RLS, SW, dependencias ni workflows; no se comprobaron conflictos mediante `git merge-tree` por falta de clon local.

## Verificación de H01–H06

| Hallazgo | Estado R5 | Evidencia disponible |
|---|---|---|
| H01 | **arreglado-sin-verificar** | Pendiente persistente, remonte y CTA retry conservados por inspección |
| H02 | **arreglado-sin-verificar** | Errores de `serviceWorker.ready` y `getSubscription` clasificados por nombre |
| H03 | **arreglado-sin-verificar** | Nombres permitidos por whitelist literal, otros redaccionados; `message` sanitizado |
| H04 | **arreglado-sin-verificar** | Pending con `PushManager` ausente o SW fallido sigue enviando DELETE |
| H05 | **arreglado-sin-verificar** | Se verifica identidad justo antes de enviar DELETE y luego de la respuesta 2xx, antes de limpiar el pending (`subscription.ts:376-419`) |
| H06 | **arreglado-sin-verificar** | Sin `userId` y con endpoint por bajar retorna `unauthorized` antes de `unsubscribe` nativo y DELETE (`subscription.ts:461-487`) |

Se usa **arreglado-sin-verificar** (y `verificado_en_sha=null`) porque los resultados RED/GREEN, Vitest y Playwright de la implementación no han sido reproducidos por esta revisión. La conclusión «sin bloqueantes por inspección» significa que el código y las pruebas pertinentes ya **no muestran los defectos anteriores**, no que las ejecuciones independientes hayan dado verde.

### H05 — detalle

`confirmUnsubscribeOnServer(endpoint,userId)` compara la identidad al iniciar y tras `await fetch`. Ante cambio, retorna `identity_changed`, persiste el endpoint bajo la clave de la identidad de origen y no confirma éxito. El test del autor (`push.test.ts:1561-1589`) usa un `DELETE` diferido, cambia A→B mientras el pedido está en curso y vuelve A para completar el reintento. Mutación M21 quita chequeo posterior y da RED según bitácora. Sonda independiente S9 verifica en el blob que el chequeo está *después* del fetch y *antes* de borrar pending; una mutación hipotética lo hace faltar.

### H06 — detalle

`unsubscribeFromPush` captura `userId` y, al encontrar endpoint efectivo, rechaza si no existe identidad comprobable, antes de llamar a `subscription.unsubscribe()` y al DELETE. Tests del autor (`push.test.ts:1591-1630`) exigen cero llamadas destructivas en 401/500 simulados y recuperación normal para A tras DELETE 500; M22 elimina la guarda y da RED según bitácora. Sonda independiente S10 comprueba el orden de los guardas en el código y su ausencia al mutar texto hipotéticamente.

### Revisión E2E y pruebas

`notifications.spec.ts` ahora espera el **POST /api/push/subscriptions** con respuesta HTTP 200 antes del redirect, en vez de depender de un mensaje transitorio de 700 ms. Mantiene prueba A→B→A con Supabase Develop y consulta de `push_subscriptions` mediante fixture de E2E para comprobar propiedad de la fila. No se agregaron `.skip`/`.only`, ni condiciones de test en producción detectadas.

**Bitácora del autor** `8445008a`: RED inicial `3 failed | 74 passed`, GREEN focalizado `192 passed`, GREEN general `3063 passed`, `pnpm typecheck` y `pnpm lint`, M21/M22 RED restauradas GREEN, `push-user-activation` 2 passed y E2E T-382 repetido 4 passed + 4 passed sin retries tras arreglar espera. **Declarado por el autor, no ejecutado aquí.**

**Sondas estáticas independientes S9–S12**: las condiciones de código/expectativas están presentes y los cambios hipotéticos que retiran guardas o aserciones hacen que los detectores fallen. **No prueban comportamiento en runtime**, no sustituyen Vitest. S13: el código de E2E espera explícitamente la respuesta HTTP del POST y tiene bloque finally de cleanup. Evidencia y reproducción en [evidencia/comandos.md](../evidencia/comandos.md).

## Checks y condiciones externas de merge

Lectura GitHub del HEAD `8445008a`: `lint`, `typecheck`, `build`, `bundle-budget` y Vercel SUCCESS; `audit` FAILURE con log `7 vulnerabilities found: 5 moderate | 2 high (1 ignored)`; `approval-policy` FAILURE **previo al cierre de la ronda**; `unit` y `db-tests` aún en ejecución; `e2e-preview` estado pendiente sin éxito confirmado. El diff no toca dependencias: la vulnerabilidad de `audit` no puede atribuirse a estos cuatro archivos de la ronda. No se debe corregir el lockfile ni desactivar la auditoría en una revisión de T-382.

**Antes de poder mergear**: verificar `unit`, `db-tests`, `audit` y `approval-policy` según el conjunto de checks requeridos, completar el `e2e-preview` oficial del **último SHA funcional** usando Vercel Preview/Supabase Develop, documentar resultados exactos y confirmar coherencia de la política. Lautaro073 decide el merge; aquí **no se aprobó ni mergeó**. Un commit solo documental de revisión NO obliga a volver a ejecutar todos los checks sobre un SHA documental nuevo.

## Riesgos residuales no bloqueantes

El flujo nativo es asíncrono y la verificación de sesión previa al DELETE **no serializa** un cambio de cuenta que ocurra entre obtener la suscripción y ejecutar `subscription.unsubscribe()`. Es una variante teórica distinta de la baja pendiente de H05; no hubo reproducción ni evidencia de daño real y no se abre bloqueo sin test que lo confirme. Puede incorporarse como caso de regresión futuro si aparece en QA. No ampliar alcance durante el gate final.

## Cierre

**R5: SIN BLOQUEANTES FUNCIONALES POR INSPECCIÓN; 6 hallazgos «arreglado-sin-verificar»; cero decisiones pendientes.** CI final sigue condicionado a comprobación, no se autoriza merge. El comentario de PR incluye informe resumido y el prompt exacto para completar el gate final.
