# Evidencia — Ronda 1 PR #120

## HEAD exacto
`6eaea38b7de421ad6101171d6cdbd402dc393704`

## Sincronización
`develop...feat/T-202-cliente-push`: ahead 3, behind 0.

## CI remoto del HEAD
Workflow CI `36490818357`:
- lint ✅
- audit ✅
- typecheck ✅
- unit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅

## Inspecciones reproducibles

### SW productivo
`public/sw.js` del base T-201 registra solamente `install`, `activate` y `fetch`. No contiene listeners `push` ni `notificationclick`.

### Harness que oculta H01
`src/app/sw.test.ts:97`:
```ts
registerPushHandlers(sandbox);
```
La llamada ocurre después de ejecutar el contenido de `public/sw.js`, por lo que el test aporta los listeners que pretende demostrar que el SW real contiene.

### Alta que puede dar falso éxito
`subscription.ts`:
- línea 115: si ya existe suscripción nativa, retorna éxito sin POST;
- línea 145: POST no inspecciona `response.ok`;
- línea 161: guarda `PUSH_STORAGE_KEY=true` igualmente.

### UI que anuncia éxito antes de suscribirse
`push-permission-prompt.tsx:66-70`:
```ts
setStatus('granted');
try {
  await subscribeToPush();
} catch {
  // Best-effort
}
```

### Any explícito
`sw-handlers.ts` y `src/app/sw.ts` usan `event: any`, `sw: any` y `clientList: any[]`.

### Evidencia visual falsa
`push.test.ts` cambia únicamente `window.innerWidth` a 390/360 en jsdom. No hay capturas añadidas por la PR.

## Limitación de esta ronda
El entorno de revisión no pudo clonar GitHub por resolución de red. No se inventó ejecución local: donde la evidencia proviene de lectura de código se registra como inspección; la ejecución disponible es el CI remoto del SHA exacto.


---

# Evidencia — Ronda 2 PR #120

## HEAD exacto revisado
`0638d2a7bf4074a719052332b4b95d50ba86f813`

## Sincronización
- develop actual: `a758790f9c73ac5794e5c89ce8e7103149a13a88`
- estado: diverged; PR ahead 5 / behind 1.
- el commit nuevo de develop toca T-117/pr-119 y no comparte archivos de producto con T-202.

## Harness independiente del Service Worker real

Se obtuvo el contenido exacto de `public/sw.js` del SHA revisado mediante GitHub y se ejecutó en memoria con un sandbox que implementa `self.addEventListener`, `registration.showNotification` y `clients`. No se invocó `src/features/notifications/push/sw-handlers.ts`.

Casos ejecutados:

1. Registro del runtime:
```text
push listeners = 1
notificationclick listeners = 1
```
Esto verifica H01.

2. Evento canónico incompleto:
```json
{
  "event": "offer_accepted",
  "requestId": "11111111-1111-4111-8111-111111111111"
}
```
Resultado real:
```text
title = "¡Oferta aceptada!"
url = /trips/11111111-1111-4111-8111-111111111111
offerId = ausente
```
T-203 exige `offerId: UUID`; el SW debería degradar a fallback. H06 sigue rojo.

3. Payload con campos extra/PII:
```json
{
  "event": "request_published",
  "requestId": "11111111-1111-4111-8111-111111111111",
  "recipient_name": "Santiago",
  "phone": "+54 9 3865 123456"
}
```
Resultado real: el SW lo acepta como `request_published` normal. El servidor usa objetos `.strict()`; bajo D03 la frontera manual debe rechazar extras. H11/H06 siguen rojos.

## Escaneo del SHA revisado

```text
initialGrantedSetsSuccess = true
arbitraryWidths = ["max-w-[320px]","max-w-[340px]"]
outerTopBar = 1
innerHeader = 1
notificationPageUsesPrompt = true
rawPendingEndpointRead = true
pendingEndpointZod = false
visualTestsStillJSDOM = ["window.innerWidth = 390","window.innerWidth = 360"]
```

## Evidencia visual
No hay PNG de T-202 entre los archivos cambiados y los comentarios de PR no contienen capturas. Por protocolo, la declaración de la bitácora no sustituye la evidencia del navegador.

## CI
No inspeccionado en Ronda 2: quedan bloqueantes, por lo que corresponde revisión estática + controles propios antes de mirar CI.
