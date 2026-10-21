# Informe de revisión independiente — PR #459 / T-382 — Ronda 2

**Fecha:** 2026-10-20. **SHA funcional:** `dc5f78cbf3ea7ec92f8b2a06464cac885d73389e`. **HEAD documental del autor:** `0e32446db59be45255da9847a875d0a0f498d507`. **Base:** `develop@cf2fbe13ab7ee8348b4805dadccef5416abb9265`.

**Resultado: CON BLOQUEANTES (2):** PR459-H03 parcial y PR459-H04 nuevo. H01/H02 arreglados por inspección, **no verificados con Vitest independiente**. **Decisiones pendientes: ninguna**. Conservadas decisiones 1-C y 2-B. No aprobar ni mergear.

## Precondiciones y alcance

Leídos nuevamente `docs/revision-pr/COMO-ENTREGAR.md`, `README.md`, skill `revisar-pr` y ficha `docs/tasks/T-382.md` desde develop, comentario de PR y bitácora del autor. El diff de esta ronda desde commit de revisión `da6870a4` comprende seis archivos: cinco en `src/features/notifications/push/**` o su test, y `docs/tasks/log/T-382.md`, todos permitidos. El autor no modificó `docs/revision-pr/**`, ni `POST/DELETE /api/push/subscriptions` de T-383. La rama figura mergeable y ahead de la base de revisión; sin clon, no ejecuté `git merge-tree` ni el script `analizar.mjs`.

## Seguimiento R1

| Hallazgo | Estado R2 | Observación |
|---|---|---|
| **H01** · baja pendiente tras DELETE fallido | **arreglado-sin-verificar** | `pending_unsubscribe` y «Reintentar baja» aparecen; remonte y dos DELETE con mismo cuerpo están en test (`push.test.ts:1137-1177`). Hay una variante nueva sin soporte nativo: H04. |
| **H02** · error de SW/getSubscription previo a alta | **arreglado-sin-verificar** | Se clasifican `serviceWorker.ready`, `getSubscription` y `subscribe` mediante `name`; tests `1212-1253` contemplan otro realm. |
| **H03** · sanitización de logs | **parcial** | `message` queda sanitizado y se agregaron pruebas, pero `name` entra al logger en crudo (`subscription.ts:126-133`). |

## BLOQUEANTES

### H03 residual — `Error.name` puede llevar datos sensibles (ALTO; riesgo condicional)

**Archivo:** `src/features/notifications/push/subscription.ts:126-133`.

`readErrorField(cause,'name')` devuelve cualquier string. El logger lo incorpora con `...(name ? { name } : {})`, mientras que solo `message` utiliza `sanitizePushErrorMessage`. Un error con `name = "AbortError endpoint=https://push.example.com/secret auth=SecretValue"` imprimiría esas capacidades. No hay evidencia de filtración ocurrida en producción; se demuestra el camino del código, no un incidente real. La decisión 2-B exige que **ningún campo del diagnóstico** imprima endpoint ni claves.

**Arreglo:** sanear también `name` antes de llamar `console.error`, o restringirlo a nombres conocidos seguros, conservando `code` y el nombre estándar. La clasificación de `NotAllowedError` sigue sobre el nombre original, antes de sanitizar.

**Prueba RED/GREEN:** nuevo test con `pushManager.subscribe` rechazando `Error` cuyo `name` contiene endpoint, p256dh y auth, con `message` inocuo; afirmar que todos los args del `console.error` carecen de secretos y que los nombres estándar siguen siendo legibles. Mutación inversa: restaurar `name` crudo → RED, volver a sanitizado → GREEN. No se ejecutó aquí.

### H04 nuevo — reintento de baja pendiente depende del soporte nativo (MEDIO; bloqueante)

**Archivo:** `src/features/notifications/push/subscription.ts:272-290,327-336,391-395`.

**Enumeración completa:**
1. Con `PENDING_UNSUB_STORAGE_KEY` válido pero sin `PushManager`, `getPushSubscriptionStatus()` devuelve `inactive` al entrar por `!isPushSupported()` (273-275); desaparece el CTA de pendiente. `unsubscribeFromPush()` retorna `{ok:true}` sin DELETE (327-331), **aunque la baja del servidor no se confirmó**.
2. Si existe PushManager pero `navigator.serviceWorker.ready` o `getSubscription()` rechaza, la consulta retorna `unknown` (282-290) y la baja cae al `catch` de `unsubscribeFromPush` sin intentar DELETE del endpoint pendiente.
3. Con permiso denegado y API presente, la función **sí devuelve pendiente** (276-277); conservar.
4. Con API presente y `getSubscription() === null`, la implementación de H01 sí usa el endpoint pendiente; conservar.

**Arreglo:** leer/validar el endpoint pendiente sin condicionar esa lectura a PushManager. Cuando haya pendiente válido y no se pueda recuperar una suscripción nativa, ofrecer `pending_unsubscribe` y permitir `DELETE /api/push/subscriptions` con body `{endpoint}`, cliente de sesión, sin URL ni logs de capacidad. Solo confirmar éxito y limpiar storage tras respuesta 2xx; con 401/500/red retener pendiente y CTA. Si no hay pendiente, degradar normalmente. Evitar alterar rutas, SQL/RLS o T-383. Puede centralizarse la reconciliación backend para evitar duplicar fetch.

**RED/GREEN:** tests unitarios con endpoint pendiente y `PushManager` ausente, más `serviceWorker.ready` rechazado y `getSubscription()` rechazado. Montar UI, exigir «Reintentar baja», pulsarlo y confirmar DELETE usando endpoint en body y sin POST, éxito 200 elimina pendiente, fallo 500/red la conserva. Mutaciones locales separadas que restauren `!isPushSupported()` y el `catch` defectuoso; cada una debe dejar test en RED y restauración en GREEN.

## Evidencia independiente vs del autor

- **Autor:** en `docs/tasks/log/T-382.md` del SHA documental hay RED `9 failed | 49 passed`, GREEN focalizado `173 passed` y general `3028 passed`, typecheck/lint, M8–M12 en rojo y restauradas en verde; E2E local `notifications.spec.ts 7 passed` + `push-user-activation.spec.ts 1 passed` (`CI=true`, `--workers=1`) contra Preview de la rama/Supabase Develop. Verifiqué la presencia de la evidencia y los tests, **no su ejecución**.
- **Revisor:** inspección de implementación sobre SHA funcional y **cuatro sondas estáticas propias** S1–S4 con mutaciones hipotéticas en memoria (baseline detecta la rama, mutante deja de detectarla). No representan tests funcionales ni una confirmación GREEN del arreglo. Harness completo reproducible en [evidencia/comandos.md](../evidencia/comandos.md).
- Intenté acceder al repositorio para clon local, pero DNS de `github.com` no resolvió; no ejecuté Vitest, Playwright, pnpm, `git merge-tree` ni `analizar.mjs`. No se leyeron `.env` ni secretos.
- Conforme a la decisión de proceso, **no se exige** `e2e-preview` oficial mientras haya bloqueantes. Se ejecuta en el último push funcional tras una revisión sin bloqueantes. No repetir CI por un commit documental de revisión.

## NO TOCAR

- No modificar el POST/DELETE de suscripciones ni RPC/RLS/CC-035; pertenecen a T-383.
- No usar `PUSH_STORAGE_KEY` para afirmar activación.
- No pedir pruebas de servicio push real en Chromium headless.
- No tratar como pendiente un navegador no compatible **sin** endpoint pendiente válido.

**Cierre:** dos bloqueantes, ninguna decisión adicional. Prompt de corrección exacto publicado en el mismo comentario de ronda. No se aprobó ni mergeó.
