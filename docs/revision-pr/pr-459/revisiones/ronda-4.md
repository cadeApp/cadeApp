# Revisión independiente PR #459 / T-382 — Ronda 4

**Fecha:** 2026-10-20. **SHA funcional examinado:** `da930eff32283c09d81b33c7f13c88451dd569a3`. **HEAD de bitácora:** `393603430df540ce82d61f374986fbd517afaf73`. **Base de develop**: `04f11839c659e67dbf32e8a80fa5da37819ce8d0`.

**RESULTADO: CON BLOQUEANTES (2)**: H05 **parcial** (carrera entre identidades) y H06 **nuevo** (falta de identidad antes de baja irreversible). H01–H04 **arreglados por inspección pero sin verificación funcional ejecutada por el revisor**. No hay decisión de producto pendiente: la solución no requiere cambiar POST/DELETE del servidor, SQL ni RPC. No aprobar ni mergear.

## Alcance y estado de rama

Se leyeron en `develop` la ficha `docs/tasks/T-382.md`, `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md` y `.agents/skills/revisar-pr/SKILL.md`; se contrastaron código, pruebas, bitácora y último comentario del autor con GitHub. Se respetan las reglas de entrega posteriores de Lautaro073.

Desde el commit documental R3 `39f2fe48` el autor integró `develop` con merge, aportando commits ajenos a esta PR, y tocó solo `subscription.ts`, `push.test.ts`, `push/index.ts`, `notifications.spec.ts` y su propia bitácora. GitHub `compare(develop, rama)` informó `ahead=13, behind=0` y base `04f11839`, no conflictos inferidos; `mergeable=true`, `mergeable_state=unstable`. El diff efectivo respecto de develop solo incluye archivos permitidos de T-382. No se editó `src/app/api/push/subscriptions/route.ts` por esta PR.

## Revalidación de R1–R3

| ID | Estado en R4 | Sustento |
|---|---|---|
| H01 | arreglado-sin-verificar | Pending, reintento, remonte y reconciliación conservados |
| H02 | arreglado-sin-verificar | Errores previos a subscribe separados por origen |
| H03 | arreglado-sin-verificar | `STANDARD_ERROR_NAMES` literal (`subscription.ts:150-179`), nombres extraños ⇒ marcador; nuevo test `push.test.ts:1437-1469` |
| H04 | arreglado-sin-verificar | Baja pendiente sin PushManager o con falla de SW sigue enviando DELETE |
| H05 | **parcial / BLOQUEANTE** | A→B→A entre peticiones protegido (`pendingUnsubStorageKey(userId)`, E2E real del autor); carrera in-flight pendiente |

**La corrección de H03 mejora materialmente la anterior**: un `Set` de nombres exactos en lugar de regex por forma. La evidencia E2E de H05 es más fuerte que la simulación utilizada en R3: el autor declara RED bajo deploy anterior donde B veía la baja de A, y GREEN en Preview funcional con consultas de una fila de A y posterior eliminación en Supabase Develop. Se inspeccionó el spec `e2e/specs/notifications.spec.ts:495-543`; no se reejecutó.

## BLOQUEANTES

### PR459-H05 residual — cambio de identidad mientras DELETE está en vuelo (MEDIO)

**Ubicación:** `subscription.ts:366-402,405-465`, servidor `src/app/api/push/subscriptions/route.ts` en develop.

Al iniciar `unsubscribeFromPush()` se captura una vez `userId=await getCurrentUserId()`. Más tarde `confirmUnsubscribeOnServer(endpoint,userId)` hace `await fetch(DELETE)`, pero al recibir 200 limpia el pendiente mediante el `userId` capturado sin comprobar que la identidad actual aún sea la misma. Secuencia: A tiene pending E → A pulsa reintento → antes de que el DELETE llegue al servidor se cambia la sesión a B → el servidor filtra `user_id=B` y puede devolver 200 sin borrar fila de A → cliente limpia pending de A y pierde el reintento. Las claves separadas **sí** arreglan el cambio *entre operaciones*, pero no esta carrera. No se observó en producción; contrato y flujo comprobados por inspección y sonda S8 de modelo (no app real).

**Corrección acotada:** después del `await fetch` y ANTES de borrar un pending, volver a comprobar `getCurrentUserId() === userId`; si no coincide, conservar el pending, no afirmar baja exitosa, devolver error recuperable y no emitir información sensible. Considerar también una comprobación inmediatamente antes de enviar el DELETE, sabiendo que la comprobación definitiva postrespuesta sigue siendo necesaria. Evitar carreras de dos reintentos simultáneos usando comparación del endpoint todavía pendiente (ya existe). No modificar ni relajar el aislamiento RLS del servidor.

**RED/GREEN:** unidad con session.userId=A, pending A=E y `fetch` diferido; cambiar session.userId a B antes de resolver DELETE 200 (mock del contrato 0 filas), afirmar pending A retenido y resultado no exitoso; al volver A, retry real envía DELETE E y borra tras 200 de A. Mutación eliminar la comparación postrespuesta → RED; restaurar → GREEN.

### PR459-H06 nuevo — pérdida irrecuperable si getSession devuelve null (MEDIO)

**Ubicación:** `subscription.ts:405-465` y `confirmUnsubscribeOnServer` `384-402`.

Si `getCurrentUserId()` devuelve `null` (sesión vencida o consulta local no disponible), el flujo continúa. Si existe suscripción nativa ejecuta `subscription.unsubscribe()` (455-461). Después manda DELETE (465); si 401/500/red, `confirmUnsubscribeOnServer` solo almacena endpoint cuando `userId` no es nulo, por lo que **no queda pendiente**. El test del autor `push.test.ts:1531-1540` exige únicamente «no guardar una baja sin dueño», sin asegurar que no se destruya antes de que pueda registrarse su recuperación. S7 reprodujo las transiciones con un modelo de flujo, NO las funciones de producción.

**Corrección acotada:** antes de `subscription.unsubscribe()` o de cualquier petición de baja destructiva, si **hay suscripción nativa** y no se pudo determinar la identidad, devolver error recuperable `unauthorized`/`unsubscription_failed` sin desuscribir y sin hacer DELETE. No guardar pending sin dueño, como exige H05. Si no hay suscripción ni pending, preservar idempotencia existente. Si la sesión estaba en A y vence antes de envío/respuesta, mantener pendiente de A para reintento autenticado, nunca atribuirlo a B.

**RED/GREEN:** unidad con `getSession()=null`, `getSubscription()=subscription(E)`, `unsubscribe` spy, `fetch` que devolvería 500 o 401: exigir `unsubscribe` no llamado, `DELETE` no enviado y resultado de error recuperable. Mutación reinsertar flujo que continúa sin identidad → RED; restaurar GREEN. Test complementario con identidad A normal y DELETE 500 debe conservar pending A; una vez recuperada sesión A 200 debe confirmar. No alterar la decisión de no guardar legacy sin dueño.

## Evidencia, CI y límites

- Autor (no revisor): `docs/tasks/log/T-382.md` al `39360343` registra GREEN `188/188` focalizados, `3059/3059` globales, M18–M20 con RED y GREEN al restaurar. E2E dos cuentas: RED anterior `1 failed` porque B veía CTA de A, GREEN `notifications 8 passed` y `push-user-activation 2 passed` en el Preview de `da930eff`. Fuente y escenario contrastados con spec; ejecución no reproducida aquí.
- Revisor: lectura de archivos exactos del commit, análisis del contrato DELETE de `develop`, dos sondas S7/S8 en Node sobre **modelo semántico aislado**, con RED del estado defectuoso y GREEN hipotético con guarda añadida. **No son tests de la aplicación.** Harness completo y salida registrados en `evidencia/comandos.md`.
- Se intentó `git ls-remote`; falló `Could not resolve host: github.com`. No worktree, `pnpm`, Vitest, Playwright, `git merge-tree` ni script `analizar.mjs` ejecutados de manera independiente.
- CI HEAD del autor en lectura de 2026-10-20: typecheck y lint success, build y bundle-budget success; `audit` **failure**: log indica 7 vulnerabilidades (`5 moderate, 2 high, 1 ignored`) en dependencias del árbol, sin cambios de dependencias de T-382. `approval-policy` en fail al momento de la lectura; unit y db-tests en ejecución. `e2e-preview` sin gate oficial completo. **No acusar al arreglo de H05/H03 por audit**; corresponde resolver el gate con evidencia específica antes del merge, sea en mantenimiento independiente según política del repo.
- Conservada decisión de Lautaro073: E2E de rondas local `CI=true` `--workers=1` en Preview y Supabase Develop; `e2e-preview` del CI en último push funcional **tras ronda sin bloqueantes**; no exigir CI de nuevo por un commit solo documental de esta revisión.

## NO TOCAR / cierre

No cambiar `POST`/`DELETE` del servidor, `supabase/**`, RLS, RPC/CC-035 ni T-383, service worker, dependencias o CI como parte de estos arreglos de cliente. No usar `PUSH_STORAGE_KEY` para afirmar actividad ni guardar endpoint sin dueño. Los hallazgos nuevos provienen de **falta de cobertura de identidad durante operaciones asíncronas**, no de inseguridad de la RLS.

**Cierre R4: dos bloqueantes; cero decisiones pendientes; no aprobado ni mergeado.** Solicitada corrección funcional de H05/H06 y ronda 5 independiente. El prompt se publica en el mismo comentario que el resumen.
