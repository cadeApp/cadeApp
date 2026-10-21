# Informe independiente — PR #459 / T-382 — Ronda 3

**Fecha:** 2026-10-20. **Código revisado:** `0c534f8cccaca9c281a3b29b71c2cde349ee0d0d`. **HEAD bitácora:** `fb3379bc9c3d1fa280a065fea5c84712bc269f26`. **Base histórica del PR:** `cf2fbe13ab7ee8348b4805dadccef5416abb9265`; `develop` actual al consultar: `04f11839c659e67dbf32e8a80fa5da37819ce8d0`.

**Resultado: CON BLOQUEANTES (2)**: H03 **parcial** y H05 **nuevo**. H01/H02/H04 **arreglados por inspección y NO verificados funcionalmente por esta revisión**. **Ninguna decisión nueva**: los dos hallazgos admiten corrección en el cliente, sin ampliar API/SQL/CC. No aprobar ni mergear.

## Alcance, reglas y precedencias

Leídas `docs/revision-pr/COMO-ENTREGAR.md`, `README.md`, `.agents/skills/revisar-pr/SKILL.md` y ficha `docs/tasks/T-382.md` desde develop; se priorizó la regla de entrega vigente de Lautaro073 (revisión en rama del PR). Se revisó el comentario final de agy y `docs/tasks/log/T-382.md`. Desde el commit documental `c996a4f` el autor cambió **tres archivos permitidos**: `subscription.ts`, `push.test.ts` y bitácora. No modificó los informes independientes; ningún cambio al POST/DELETE de suscripciones ni a SQL, RPC, SW o T-383.

GitHub: rama atrasada **15 commits respecto del develop actual** y adelantada 9; el diff base sigue en SHA histórico. GitHub respondió `mergeable=true, mergeable_state=unstable` en lectura REST posterior (primera lectura normalizada decía false mientras GitHub calculaba estado). No atribuir conflicto a ese false inicial. **Antes de merge** corresponde integrar `develop` con **merge, nunca rebase**, confirmar merge-tree sin conflictos y validar contra base actual; T-383/PR #460 ya figura mergeada. No se ejecutó merge-tree por ausencia de clon en el entorno.

## Hallazgos heredados

| ID | Estado | Evidencia en código |
|---|---|---|
| H01 | arreglado-sin-verificar | `pending_unsubscribe`, CTA, remonte y reintento; no revalidado con Vitest independiente |
| H02 | arreglado-sin-verificar | `serviceWorker.ready`/`getSubscription` clasificados por `name` con código estable; no corrido |
| H03 | **parcial, BLOQUEANTE** | `message` sanitizado y ahora `name` especial, pero el filtro `STANDARD_ERROR_NAME` conserva cualquier valor alfanumérico plausible como token |
| H04 | arreglado-sin-verificar | `confirmUnsubscribeOnServer` confirma DELETE con pending válido aun sin PushManager y cuando SW rechaza; tests H04 presentes, no corridos por revisor |

## BLOQUEANTES

### PR459-H03 — El supuesto filtro de nombres estándar admite secretos alfanuméricos (ALTO, residual)

**Archivo:** `src/features/notifications/push/subscription.ts:126-140`. **Evidencia [ANÁLISIS + sonda JS del predicado, no producción].**

`STANDARD_ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,63}$/` no es una lista de nombres estándar: acepta cualquier token alfanumérico de 1–64 caracteres. Si `Error.name` contiene exclusivamente una clave `auth` de 22 caracteres base64url alfanuméricos, pasa sin sanitizar (`rawName`) y se emite en `console.error`. El nuevo test del autor (`push.test.ts:1334-1354`) solo contamina `name` con espacios y etiquetas (`endpoint=`, `auth=`), que sí fuerzan el camino sanitizador. No se observó un incidente real; es **riesgo condicional demostrado con predicado ejecutado**.

**Arreglo técnico sin decisión pendiente:** whitelist de **nombres estándar literales** (`AbortError`, `NotAllowedError`, `TypeError`, `Error`, `InvalidStateError`, etc., los que use realmente el flujo), y para cualquier otro nombre usar marcador seguro o conservar solo un prefijo estándar explícito sin repetir resto. **Nunca** imprimir un string alfanumérico no reconocido por su forma. La clasificación `NotAllowedError` sigue usando nombre original exacto. Probar (a) nombre íntegramente igual a un secreto alfanumérico, (b) nombre etiquetado, (c) nombre estándar; el log no debe contener secretos, el código del error permanece estable. RED antes, GREEN después. Mutación propia del autor que reintroduzca regex amplia debe dejar test en RED y restauración GREEN.

### PR459-H05 — Baja pendiente de A puede borrarse localmente desde sesión B (MEDIO, nuevo)

**Archivo:** `src/features/notifications/push/subscription.ts:263-268,279-298,324-353,356-375`. **Ruta servidor:** `src/app/api/push/subscriptions/route.ts` en develop, bloque `DELETE`. **Evidencia [ANÁLISIS + simulación de contrato; no E2E real].**

**Secuencia concreta:**
1. Cuenta A y navegador N tienen endpoint E. `subscription.unsubscribe()` funciona, pero primer `DELETE` falla; queda `PENDING_UNSUB_STORAGE_KEY=E` en `localStorage`; el servidor conserva la fila de A.
2. En el **mismo origen** se cambia a sesión B sin limpiar localStorage. Como no hay suscripción nativa, `getPushSubscriptionStatus()` lee pending E y muestra **«Reintentar baja» de A a B**, sin asociarlo a sesión.
3. B pulsa: `confirmUnsubscribeOnServer(E)` envía DELETE autenticado como B. La ruta impone `.eq('endpoint',E).eq('user_id',B)`, no borra la fila de A (aislamiento correcto), pero responde `{ok:true}` si no hubo error de consulta, incluso con cero filas borradas.
4. El cliente interpreta 2xx como confirmación y **borra el pending de A** (`localStorage.removeItem`). Al regresar A ya no puede recuperar esa baja, aunque su fila permanezca. Ninguna cuenta obtuvo acceso no autorizado a la fila de otra; es un **bug de consistencia/recuperación**, no escalada de privilegios.

**Enumeración de clase:** mismo usuario + pendiente válido funciona; otro usuario + mismo origen falla semánticamente; 401 conserva pending; A/B con suscripciones nativas propias pueden además consumir/limpiar la baja previa si no se liga al propietario. No acusar ausencia de RLS: el aislamiento de servidor es correcto.

**Arreglo técnico requerido:** asociar el pendiente a la **identidad autenticada que originó la baja**; validar identidad antes de mostrar pending/ejecutar retry/limpiar el marcador. No exponer endpoint ni user ID a logs/URLs, no cambiar API POST/DELETE ni SQL/RLS/CC-035. Persistir valor versionado (endpoint + userId) en storage con Zod propio en los archivos permitidos y obtener identidad por mecanismo de sesión ya existente; si identidad no se puede comprobar, no atribuir ni borrar el pendiente. Migración conservadora del formato legacy endpoint-solo: nunca borrarlo por acción de otra cuenta; documentar su degradación segura. Evitar reintento automático al cambiar cuenta. Sin cambiar la semántica de H01/H04 para la cuenta original.

**RED/GREEN:** ampliar prueba unitaria del cliente y E2E de dos cuentas **en el mismo origen**, con escenario A logra alta, falla DELETE (red/500), cambia a B sin borrar localStorage y vuelve a A. B **no** debe consumir/limpiar pendiente de A ni presentar activación falsa; A todavía puede reintentar y completar DELETE. Para probar que no desaparece la fila de A, usar Supabase Develop real con cuentas temporales y limpieza en fixture, no mocks de backend que oculten la falla; ejecutar E2E con `CI=true --workers=1`. Unit test donde DELETE de B devuelve 200 con cero filas debe fallar contra la implementación actual y pasar cuando la guarda de identidad lo impida. Mutación que saltea el chequeo `userId` debe dejar RED. Si la solución requiere modificar fuera de archivos permitidos o un contrato, elevar decisión a Lautaro073 antes de ese cambio.

## Evidencia y límites

- El autor documentó **RED 7 failed / 59 passed**, **GREEN 181/181** focalizados y **3036/3036** globales, typecheck/lint, M13–M17 cada uno RED restaurado a GREEN, y E2E local contra Preview del SHA funcional: `notifications.spec.ts 7 passed`, `push-user-activation.spec.ts 1 passed`. Esto **no fue ejecutado por el revisor**.
- Sondas independientes ejecutadas: S5 probó en Node que el regex de nombres acepta token alfanumérico (PASS: detecta brecha); S6 simuló el contrato DELETE con A/B y demostró que 200 de B permite limpiar local pending dejando fila A (PASS en simulación). No equivalen a ejecutar App, PostgREST, Vitest o Playwright. Harness completo disponible en `evidencia/comandos.md`.
- Se intentó `git ls-remote` para obtener clon; falló DNS `Could not resolve host: github.com`. No se ejecutó `pnpm`, `git merge-tree`, `node docs/revision-pr/analizar.mjs verificacion` ni `test:db` desde aquí. El autor modificó cero archivos de backend/SQL, de modo que `test:db` local del revisor sería n.a.
- CI del HEAD `fb3379bc`: `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` en verde según check runs; `approval-policy` fail antes del informe independiente, `db-tests` y workflow CI cancelados; `e2e-preview` estado error/cancelación bajo decisión de cola compartida, no GREEN final. No usar checks como prueba de H03/H05.
- Sin bloqueantes resueltos no se pide todavía `e2e-preview` oficial. Cuando queden 0, correr el CI completo final sobre SHA funcional ya integrado con develop, incluido `e2e-preview`. No exigir CI nuevamente solo por este commit documental.

## NO TOCAR y cierre

T-383/PR #460 ya está mergeada: **no modificar** su RPC/POST, el DELETE de sesión, RLS, migraciones ni `service worker`. No cambiar `PUSH_STORAGE_KEY` en autoridad para active; no meter service role para limpiar pendientes ajenos; no crear pruebas `.skip`/`.only` ni tests condicionados. No tratar estos hallazgos por inspección como incidentes reales observados.

**Cierre ronda 3:** CON BLOQUEANTES 2 (H03 residual, H05 nuevo), decisiones pendientes 0, no aprobado y no mergeado. El prompt para agy se publicará en **un único comentario** con este resumen. Revalidar después de corregir en la ronda 4.
