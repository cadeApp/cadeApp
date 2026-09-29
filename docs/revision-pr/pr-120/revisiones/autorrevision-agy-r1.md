> **Autorrevisión preservada por proceso.** Este archivo conserva el contenido que KiraK72 escribió/copió dentro de `docs/revision-pr/pr-120/**` en el commit de corrección de Ronda 1. La carpeta pertenece a la revisión independiente; por protocolo, cualquier verificación del autor dentro de ella no cuenta como verificación independiente. Véase PR120-H14 y pr-56/AG-36.

# Ronda 1 — PR #120 / T-202

**HEAD:** `6eaea38b7de421ad6101171d6cdbd402dc393704`  
**Resultado:** BLOQUEADA  
**CI:** verde en GitHub Actions para el SHA revisado.

## Decisiones

### D01 — Integración del service worker
**Resuelta por Lautaro073: 1-A.** Se permite agregar `public/sw.js` al alcance de T-202. La implementación debe usar el service worker real de T-201 como única fuente runtime; no alcanza con un módulo TypeScript paralelo que nunca se sirve.

### D02 — Entry point de notifications
**Resuelta por Lautaro073: 2-A.** Se permite agregar `src/features/notifications/index.ts` al alcance de T-202 para exponer la integración de T02 sin violar `boundaries/entry-point`.

## BLOQUEANTES

### PR120-H01 · El test registra los handlers por fuera del service worker real
**Archivos:** `src/app/sw.test.ts:97`, `public/sw.js`  
El harness ejecuta `public/sw.js` y luego llama `registerPushHandlers(sandbox)` manualmente. Por eso las pruebas de `push` y `notificationclick` pasan aunque el `public/sw.js` servido en producción no tenga esos listeners. El DoD exige que los handlers se registren desde el SW de T-201.

**Corrección:** con D01, integrar los listeners en `public/sw.js` y hacer que el test ejecute exclusivamente ese archivo. Eliminar la inyección `registerPushHandlers(sandbox)` y cualquier segunda implementación runtime que pueda divergir.

### PR120-H02 · T02 existe pero no es alcanzable desde la app
**Archivos:** `src/features/notifications/push/components/push-permission-prompt.tsx`, `src/features/notifications/index.ts`, `src/app/(courier)/courier/profile/**`  
La PR crea `PushPermissionPrompt`, pero ningún consumidor productivo del diff lo monta. Además, `src/app` solo puede importar una feature por su `index.ts` raíz. El componente queda como código testeado pero no usable.

**Corrección:** con D02, exponer desde `src/features/notifications/index.ts` una API/loader de T02 y montarlo en la ruta de perfil autorizada. Agregar una prueba que falle si el flujo real deja de renderizar/abrir T02.

### PR120-H03 · El alta puede devolver éxito sin haber sincronizado el backend
**Archivo:** `src/features/notifications/push/subscription.ts:115-166`  
Tres caminos marcan éxito sin garantizar una fila usable en `push_subscriptions`: una suscripción nativa existente se devuelve sin reconciliar backend; si faltan `p256dh/auth` se omite el POST; y el POST no comprueba `response.ok`, por lo que 401/500 cuentan como éxito. Después se guarda `cadeapp_push_enabled=true`.

**Corrección:** definir éxito como “suscripción nativa válida + claves + backend confirmado”. Una suscripción nativa existente también debe reconciliarse con el backend. Probar 401, 500, red caída, claves ausentes y suscripción existente sin registro server.

### PR120-H04 · La UI anuncia “Avisos activados” antes de saber si el alta terminó
**Archivo:** `src/features/notifications/push/components/push-permission-prompt.tsx:66-75`  
Se ejecuta `setStatus('granted')` inmediatamente después del permiso, luego se ignora el resultado de `subscribeToPush()`. El usuario puede ver “¡Avisos activados con éxito!” aunque no exista una suscripción utilizable.

**Corrección:** separar permiso de estado de suscripción. Mostrar éxito y disparar `onSuccess` solo cuando `subscribeToPush()` confirme `ok: true`; si falla, dejar una señal persistente y accionable sin bloquear la app.

### PR120-H05 · La baja puede dejar una fila huérfana y luego no vuelve a intentarla
**Archivo:** `src/features/notifications/push/subscription.ts:201-217`  
Primero se elimina la suscripción nativa y después se hace DELETE al backend dentro de un `try/catch` ignorado. Si la red o el servidor fallan, la siguiente ejecución ve `getSubscription() === null` y ya no conoce el endpoint para reintentar la limpieza.

**Corrección:** diseñar la baja para poder reconciliar/reintentar el DELETE hasta confirmar backend, sin deshacer la baja nativa. Agregar prueba en rojo para fallo 500/red y segunda ejecución.

### PR120-H06 · El payload de push no se valida con Zod
**Archivos:** `src/features/notifications/push/sw-handlers.ts:22-34`, `src/app/sw.ts:22-34`, `src/features/notifications/push/types.ts`  
La regla 25 exige Zod en payloads de push y que el tipo nazca del schema. La PR hace cast manual a `Record<string, unknown>` y además duplica a mano el contrato de eventos que ya existe en el emisor.

**Corrección:** crear un schema cliente dentro del alcance permitido, derivar el tipo con `z.infer` y usar `safeParse` en la frontera. Cubrir payload desconocido, campos extra/PII, UUID inválido y cada discriminante.

### PR120-H07 · Hay `any` explícitos en código nuevo
**Archivos:** `src/features/notifications/push/sw-handlers.ts:119,148,163,187,198,202`; `src/app/sw.ts:119,148,163,185,195,199`  
`AGENTS.md §4` prohíbe `any`. CI no lo detecta porque ESLint no tiene `no-explicit-any`, pero la revisión sí debe bloquearlo.

**Corrección:** tipar el contexto mínimo del Service Worker, eventos y clientes con interfaces/DOM types apropiados. Si `src/app/sw.ts` deja de ser necesario al integrar `public/sw.js`, eliminarlo en vez de mantener una copia tipada separada.

### PR120-H08 · Hay valores arbitrarios de Tailwind prohibidos
**Archivo:** `src/features/notifications/push/components/push-permission-prompt.tsx:85,90`  
Se usan `max-w-[390px]` y `bg-[#12182C]`. Regla 60 prohíbe colores/tamaños arbitrarios. `#12182C` ya está representado por tokens semánticos.

**Corrección:** usar tokens/clases existentes; no abrir un contract-change si el token ya existe.

### PR120-H09 · La animación decorativa no usa los presets de Motion
**Archivo:** `src/features/notifications/push/components/push-permission-prompt.tsx:111`  
`animate-pulse` implementa una animación de feature fuera de los presets de `src/ui/motion`. La regla 60 exige Motion/presets y respeto de reduced motion.

**Corrección:** usar un preset permitido o eliminar el pulso si no aporta información.

### PR120-H10 · La verificación 390/360 declarada no es una verificación de navegador
**Archivo:** `src/features/notifications/push.test.ts:271,303`; PR body/DoD  
Los tests solo asignan `window.innerWidth = 390/360` bajo jsdom y luego inspeccionan clases. No verifican layout real, contraste, clipping, safe areas, foco, permiso real ni generan las capturas obligatorias. La PR no agrega evidencia visual.

**Corrección:** ejecutar la app en navegador real a 390 y 360, permiso concedido y denegado, guardar/adjuntar capturas y registrar evidencia en PR/bitácora. Los unit tests pueden complementar pero no sustituir esta evidencia.

### PR120-H11 · La prueba “sin PII” no puede detectar que el handler empiece a leer PII
**Archivo:** `src/features/notifications/push.test.ts:216-260`  
Las entradas de la prueba ya vienen sin DNI, teléfono, dirección o nombre. Si mañana el handler agrega `body: payload.recipientName`, el test actual seguiría verde porque ese campo no existe en el fixture.

**Corrección:** inyectar deliberadamente campos PII/extra en un payload no confiable y demostrar que el schema los rechaza/descarta y que ninguna salida visible/data conserva esos valores. Registrar la mutación RED.

## MEJORAS

### PR120-H12 · Los textos de UI están embebidos en el componente
**Archivo:** `src/features/notifications/push/components/push-permission-prompt.tsx`  
La regla 25 pide textos de UI en `copy.ts`. Mover el copy de T02 a la feature para evitar dispersión.

### PR120-H13 · El body de la PR describe eventos/rutas que no coinciden con el código
El body menciona `new_request`, `offer_rejected`, `trip_cancelled` y `/courier/trips/:tripId`, mientras el código implementa el contrato de T-203 con `request_published`, `offer_submitted`, `offer_accepted`, `request_cancelled`, `request_expired` y `/trips/:requestId`.

**Corrección:** actualizar el body con los nombres y rutas reales; no cambiar el código correcto para hacerlo coincidir con una descripción desactualizada.

## Verificación de ronda

- Alcance actual del diff: 10 archivos; todos estaban en la ficha original.
- D01/D02 autorizan dos archivos nuevos, pero el autor debe escribir esa ampliación en la ficha antes de tocarlos.
- `develop` y la rama estaban sincronizados al momento de la revisión: PR ahead 3, behind 0.
- CI del HEAD `6eaea38b7de421ad6101171d6cdbd402dc393704`: lint ✅ · audit ✅ · typecheck ✅ · unit ✅ · build ✅ · db-tests ✅ · bundle-budget ✅.
- No se pudo ejecutar un clon local por resolución de red en el entorno de revisión; los hallazgos funcionales de esta ronda se sostienen por inspección reproducible del HEAD y por CI remoto. No se afirma una mutación runtime independiente donde no se ejecutó.
