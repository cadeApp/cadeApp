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
