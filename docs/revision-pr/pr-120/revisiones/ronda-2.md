# Ronda 2 — PR #120 / T-202

**HEAD revisado:** `0638d2a7bf4074a719052332b4b95d50ba86f813`  
**Resultado:** BLOQUEADA  
**Método:** análisis estático del SHA exacto + harness independiente ejecutando el contenido real de `public/sw.js`. CI no se mira todavía porque quedan bloqueantes.

## Decisión D03

**D03 = 3-A (Lautaro073).** `public/sw.js` queda exceptuado, únicamente por ser el SW clásico estático de T-201, de la obligación de usar Zod en esa frontera. La excepción no permite relajar el contrato: el validador manual del SW debe ser equivalente a `src/server/push/sender.ts::pushPayloadSchema`. Los tests deben ejecutar `public/sw.js`, no un helper TypeScript paralelo.

## Estado de los hallazgos de Ronda 1

### PR120-H01 — ARREGLADO Y VERIFICADO
`src/app/sw.test.ts` ya no inyecta `registerPushHandlers`; ejecuta `public/sw.js` directamente. El harness independiente de esta revisión confirmó exactamente 1 listener `push` y 1 `notificationclick`.

### PR120-H02 — ARREGLADO SIN VERIFICACIÓN RUNTIME
T02 ya es alcanzable en `/courier/profile/notifications` y se exporta desde el entry point raíz. La composición visual real todavía está afectada por H15.

### PR120-H03 — PARCIAL
La implementación ahora reconcilia suscripción existente, exige claves y chequea `response.ok`. Faltan los casos RED/green exactos pedidos para **500 directo y rechazo de red** en `subscribeToPush()`; no alcanza con que el camino 500 aparezca indirectamente en el test del componente.

### PR120-H04 — SIGUE ABIERTO
En `PushPermissionPrompt`, el `useEffect` hace `setStatus('granted')` apenas `Notification.permission === 'granted'`. Eso vuelve a mostrar éxito y deshabilitar el botón sin haber confirmado una suscripción ni el POST del backend. El arreglo del click quedó bien, pero el estado inicial conserva el falso positivo original.

### PR120-H05 — PARCIAL
El endpoint pendiente se conserva y el caso 500 + segunda invocación está cubierto. Falta el caso equivalente cuando `fetch` **rechaza** por red, pedido explícitamente en Ronda 1. H16 además detecta que el endpoint recuperado de localStorage entra sin parseo.

### PR120-H06 — SIGUE ABIERTO, AHORA CON D03 RESUELTA
El schema Zod de `src/features/notifications/push/schemas.ts` no corre en el Service Worker productivo. El SW real de `public/sw.js` usa otro validador manual y no es equivalente a T-203:
- acepta `offer_submitted` / `offer_accepted` sin `offerId`;
- no valida que `offerId` sea UUID;
- acepta campos extra que el schema server `.strict()` rechaza.

El harness del reviewer ejecutó el SW real y comprobó que un `offer_accepted` sin `offerId` genera “¡Oferta aceptada!” en vez de fallback.

**Corrección bajo D03:** hacer del validador manual del SW la única fuente runtime cliente, con conjunto exacto de claves por evento. Eliminar el handler/schema TypeScript duplicado que solo alimenta tests y puede divergir.

### PR120-H07 — ARREGLADO SIN VERIFICACIÓN DE SUITE
Los `any` explícitos de la implementación TypeScript fueron retirados y `src/app/sw.ts` fue eliminado.

### PR120-H08 — SIGUE ABIERTO
Se quitaron `max-w-[390px]` y el color hexadecimal, pero siguen `max-w-[320px]` y `max-w-[340px]` en `PushPermissionPrompt`. Regla 60 prohíbe tamaños arbitrarios.

### PR120-H09 — ARREGLADO SIN VERIFICACIÓN DE SUITE
Se eliminó `animate-pulse`.

### PR120-H10 — SIGUE ABIERTO
Los tests continúan asignando `window.innerWidth = 390/360` en jsdom. No hay PNGs de T02 en el diff ni comentarios con capturas; la bitácora solo declara que la verificación ocurrió. El DoD exige navegador real, granted/denied y capturas.

### PR120-H11 — SIGUE ABIERTO
La nueva prueba adversarial con PII llama al helper TypeScript `getNotificationDataForEvent`, no a `public/sw.js`. El harness del reviewer confirmó que el SW real acepta un payload con campos PII extra como evento válido (aunque actualmente no los copia a la notificación). Bajo D03, el contrato debe ser estricto como T-203 y el control debe atacar el runtime real.

### PR120-H12 — PARCIAL / MEJORA
El copy de T02 se movió a `copy.ts`, pero el nuevo link de perfil vuelve a introducir textos inline: “Notificaciones y avisos”, “Configurá…” y “Configurar →”.

### PR120-H13 — PARCIAL / MEJORA
El body ya usa los nombres de eventos correctos, pero las rutas resumen siguen siendo inexactas: dice `/merchant/requests` y `/courier/trips`; el contrato/código usa `/merchant/requests/:requestId` y `/trips/:requestId`.

## Hallazgos nuevos de Ronda 2

### PR120-H14 — PROCESO · autor escribió la carpeta de revisión
El commit de corrección agregó `docs/revision-pr/pr-120/**` y `docs/revision-pr/pr-120-body.md`. La carpeta pertenece a la revisión independiente. Según pr-56/AG-36, la autorrevisión se preserva pero no cuenta como verificación independiente.

**Nota de la revisión:** el prompt de Ronda 1 no prohibió explícitamente `docs/revision-pr/**`, aunque el protocolo global sí lo exige. Ese agujero fue mío; Ronda 2 lo corrige y el próximo prompt lo prohíbe de manera expresa.

### PR120-H15 — BLOQUEANTE · T02 queda dentro de dos shells visuales
`src/app/(courier)/layout.tsx` ya monta un `TopBar`. `PushPermissionPrompt` monta otro `<header>`, y la ruta `/courier/profile/notifications` renderiza el prompt dentro de ese layout. Resultado por composición: doble TopBar y `min-h-screen` anidado dentro del shell del repartidor. Además la página completa fue convertida en Client Component solo para usar `useRouter`.

**Corrección:** agregar modo `embedded` al prompt: sin header propio y con `min-h-full`; mantener header solo para uso standalone. La page debe volver a Server Component y renderizar `<PushPermissionPrompt embedded />`; el prompt debe usar su fallback de history para volver tanto al descartar como, si no hay callback, tras éxito.

### PR120-H16 — BLOQUEANTE · localStorage entra sin Zod
`subscription.ts` lee `cadeapp_pending_unsub_endpoint` directamente con `localStorage.getItem` y lo envía al backend. Regla 25 exige parsear localStorage en la frontera.

**Corrección:** dejar `schemas.ts` únicamente para el schema del estado local pendiente, por ejemplo un string URL HTTPS. Si el valor es inválido: no hacer DELETE, limpiar el valor corrupto y devolver un error estable `invalid_pending_endpoint`.

## Sincronización

- `develop`: `a758790f9c73ac5794e5c89ce8e7103149a13a88`
- PR revisada: `0638d2a7bf4074a719052332b4b95d50ba86f813`
- Estado: diverged; PR ahead 5 / behind 1.
- El único commit nuevo de develop es T-117 y no pisa archivos de producto de T-202; aun así debe mergearse antes de la siguiente revisión.
- GitHub muestra una aprobación vacía previa de Lautaro073 del 2026-09-28 21:05 ART. Esta ronda posterior tiene bloqueantes y esa aprobación no debe tomarse como cierre técnico.
