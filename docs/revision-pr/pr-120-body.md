Closes #29

### Resumen — Corrección Ronda 1 (H01-H13)

- **Pantalla T02 (Soft prompt de permiso de avisos):** Implementada en `src/features/notifications/push/components/push-permission-prompt.tsx` siguiendo diseño Stitch T02, con tokens semánticos oficiales (`bg-foreground text-background`), `max-w-md` (sin valores arbitrarios), touch targets `>= 48px` (`min-h-12`), tipografía accesible (`>= 14px`, 0 `text-xs`), copies centralizados en `src/features/notifications/push/copy.ts` ("¿Te avisamos al instante?", "Cero demoras", "Sin spam molesto"), acciones "Activar avisos" y "Ahora no", y degradación clara si el permiso está denegado sin bloquear el uso de la app.
- **Ciclo de vida, reconciliación e idempotencia:** `src/features/notifications/push/subscription.ts` gestiona permisos exclusivamente desde un gesto explícito de usuario (`gesture_required` guard), alta con conversión de clave pública VAPID (`urlBase64ToUint8Array`), validación estricta de claves criptográficas `p256dh` y `auth`, reconciliación de suscripciones existentes con `POST /api/push/subscriptions`, confirmación de respuesta HTTP (`response.ok`) antes de persistir estado, y baja limpia con persistencia de endpoint en `localStorage` (`cadeapp_pending_unsub_endpoint`) ante fallos de servidor/red para reconciliación y reintento en invocaciones subsiguientes.
- **Integración nativa en Service Worker sin PII:** `public/sw.js` (autorizado por D01 = 1-A) contiene los handlers nativos de `push` y `notificationclick`. Se eliminó `src/app/sw.ts` redundante. `sw.test.ts` ejecuta directamente `public/sw.js` sin inyección artificial. Los payloads se validan en frontera con esquema Zod `PushNotificationPayloadSchema` (`z.discriminatedUnion('event', ...)`) en `src/features/notifications/push/schemas.ts`, descartando campos desconocidos y PII con fallback seguro ante payloads inválidos.
- **Eventos canónicos soportados:**
  - `request_published` -> `/courier/feed`
  - `offer_submitted` -> `/merchant/requests`
  - `offer_accepted` -> `/courier/trips`
  - `request_cancelled` -> `/courier/feed`
  - `request_expired` -> `/courier/feed`
- **Montaje alcanzable y fronteras:** Con D02 = 2-A, `src/features/notifications/index.ts` expone `PushPermissionPrompt`, `loadPushPermissionPrompt` y utilidades de suscripción. Se creó `src/app/(courier)/courier/profile/notifications/page.tsx` y se enlazó desde `src/app/(courier)/courier/profile/page.tsx` respetando el piso tipográfico de 14px (0 `text-xs`).
- **Cero `any`:** Todos los tipos y contratos del Service Worker están tipados con interfaces estrictas (`PushEventLike`, `NotificationClickEventLike`, etc.).

### DoD de la Ficha T-202
- [x] Pruebas en rojo antes de implementar y commit separado: T02 no existe, el permiso se solicita fuera de un gesto, una suscripción no se elimina y `notificationclick` abre un destino incorrecto (commit `d1e68d1`).
- [x] Se aplica `implementar-diseno` sobre T02. El soft prompt explica el valor, ofrece "Activar avisos" y "Ahora no", y nunca bloquea el uso de la app.
- [x] Con el permiso denegado el flujo no se rompe; el click abre la pantalla correcta; alta y baja son idempotentes; una falla de push nunca es la única señal de un evento.
- [x] `push` y `notificationclick` se prueban sin leer datos personales del payload; los handlers se registran desde el service worker de T-201 sin duplicarse.
- [x] Verificación en navegador a 390 px y 360 px, permiso concedido/denegado y capturas de T02; accesibilidad AA y targets de 48 px.
- [x] `pnpm typecheck && pnpm lint && pnpm test`
- [x] Sin cambios fuera de "Archivos permitidos"
- [x] Bitácora `docs/tasks/log/T-202.md` al día y PR con evidencia

### Checks locales
- `pnpm typecheck`: ✅ (0 errores)
- `pnpm lint`: ✅ (0 warnings, 0 errores)
- `pnpm test`: ✅ (100 suites pasadas, 1334 tests pasados; 31/31 en `push.test.ts` y `sw.test.ts`)
- `pnpm test:db`: n.a.

### Estado de Revisión Independiente (Ronda 1 -> Ronda 2)
- **PR120-H01 (Bloqueante):** Arreglado. Handlers integrados directamente en `public/sw.js`; `sw.test.ts` corre exclusivamente contra el service worker real sin inyección artificial; `src/app/sw.ts` eliminado.
- **PR120-H02 (Bloqueante):** Arreglado. T02 expuesto en `src/features/notifications/index.ts` y montado en `/courier/profile/notifications`.
- **PR120-H03 (Bloqueante):** Arreglado. `subscribeToPush()` exige claves, reconcilia suscripción existente, valida `response.ok` y maneja errores sin falsos positivos de habilitación.
- **PR120-H04 (Bloqueante):** Arreglado. `PushPermissionPrompt` separa estado de permiso y suscripción; solo muestra éxito tras confirmación de backend.
- **PR120-H05 (Bloqueante):** Arreglado. `unsubscribeFromPush()` retiene endpoint para reintento de sincronización en fallback y reconcilia en llamadas posteriores.
- **PR120-H06 (Bloqueante):** Arreglado. Esquema Zod cliente `PushNotificationPayloadSchema` con unión discriminada y `safeParse`.
- **PR120-H07 (Bloqueante):** Arreglado. 0 usos de `any` en todo el alcance de T-202.
- **PR120-H08 (Bloqueante):** Arreglado. Eliminado `max-w-[390px]` y `bg-[#12182C]`, reemplazados por tokens semánticos y `max-w-md`.
- **PR120-H09 (Bloqueante):** Arreglado. Eliminado `animate-pulse`.
- **PR120-H10 (Bloqueante):** Arreglado. Verificación responsive a 390px y 360px documentada con targets >= 48px y WCAG AA.
- **PR120-H11 (Bloqueante):** Arreglado. Test adversarial con inyección deliberada de PII demostrando filtrado estricto.
- **PR120-H12 (Mejora):** Arreglado. Strings de UI extraídos a `src/features/notifications/push/copy.ts`.
- **PR120-H13 (Mejora):** Arreglado. Descripción de PR actualizada con eventos y rutas canónicas.
