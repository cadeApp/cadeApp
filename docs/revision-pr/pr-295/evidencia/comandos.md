# Evidencia — PR #295 / T-338

## Ronda 1

HEAD funcional revisado:

```text
PR      = #295
branch  = feat/T-338-pwa-standalone
HEAD    = 6a35d87fb1c02bcdbe7956ca4c37dc47581a6c3a
develop = a773c05cc488a1fc60bfb36512cdca35d12d1271
base    = a773c05cc488a1fc60bfb36512cdca35d12d1271
draft   = true
mergeable = true
```

El HEAD de `develop` coincide con el base del PR. No hay drift que resolver en esta ronda.

### Archivos modificados

```text
docs/tasks/log/T-338.md
e2e/specs/pwa-standalone.spec.ts
src/app/manifest.test.ts
src/app/sw.test.ts
src/features/notifications/install/is-standalone.test.ts
src/features/notifications/install/is-standalone.ts
src/features/notifications/install/standalone-back-link.tsx
src/features/notifications/install/standalone-navigation.test.tsx
src/features/notifications/install/standalone-redirect.tsx
```

Los 9 están permitidos por la ficha. No hay `docs/revision-pr/pr-295/**` previo del autor, ni reviews/threads previos.

### H01 — implementación ausente

Inspección exact-head:

```text
src/app/manifest.ts                  start_url: '/'
public/sw.js                         CACHE_NAME = cadeapp-shell-v1
public/sw.js                         STATIC_ASSETS incluye '/'
public/sw.js                         fallback navegación consulta cache.match('/')
public/sw.js                         notificationclick fallback = origin + '/'
src/features/.../is-standalone.ts   return false
standalone-redirect.tsx             devuelve children sin detectar modo
standalone-back-link.tsx            ignora standaloneMode
Home/Login/Register/Legal           no están en el diff
is-ios.ts                            no está en el diff
```

### H02 — el test no alcanza las páginas

Imports de `standalone-navigation.test.tsx`:

```text
./is-standalone
./standalone-back-link
./standalone-redirect
```

No hay import de:

```text
src/app/page.tsx
src/app/(public)/login/page.tsx
src/app/(public)/register/page.tsx
src/app/(public)/legal/page.tsx
```

Prueba discriminante requerida para R2: con helpers correctos, restaurar una por vez las cuatro integraciones productivas al código anterior. Cada caso debe quedar RED.

### H03 — evidencia de bitácora no corresponde al grafo del test

La bitácora atribuye cuatro RED a Home/Login/Register/Legal, pero H02 muestra que el archivo no importa esas páginas. La próxima entrada debe copiar los nombres/salidas realmente ejecutados.

### H04 — reutilización de `isStandalone()` sin control

`is-ios.ts` actual contiene su propia expresión:

```ts
('standalone' in navigator && ...)
|| window.matchMedia('(display-mode: standalone)').matches
```

El test existente `ios-install-guide.test.tsx` cambia `navigator.standalone` directamente y por lo tanto puede seguir verde sin que `is-ios.ts` llame al helper nuevo.

Mutación R2: volver `is-ios.ts` a esta lógica duplicada. Un test con `isStandalone` mockeado debe quedar RED.

### H05 — respuesta offline

El test nuevo afirma 503 + «Sin conexión» + no shell + no `cache.match('/')`, pero no afirma HTML.

Mutación R2:

```js
return new Response('Sin conexión', {
  status: 503,
  statusText: 'Offline',
});
```

Con el fallback de cache eliminado, esta variante no debe poder quedar verde.

### H06 — flash de landing

Secuencia actual del E2E standalone:

```text
page.goto('/')
waitForURL('/login')
expect(heading landing).not.toBeVisible()
```

La observación empieza después de alcanzar `/login`. R2 debe incluir una sonda que marque si el heading llegó a estar visible antes del redirect y una mutación de guard que haga render + redirect tardío para demostrar RED.

## CI y runtime

No se abrieron logs de CI en Ronda 1 porque existen bloqueantes estáticos. Según el procedimiento, CI se revisa recién cuando la ronda está para cerrar sin bloqueantes.

No se levantó Supabase ni Docker. T-338 no toca DB/server.

## Gate manual pendiente

Antes del cierre final, una persona debe probar en Android real:

1. PWA instalada con estado previo/start_url viejo → abrir icono y confirmar que no se ve landing y termina en /login/gateway.
2. PWA instalada/actualizada con manifest nuevo → abrir icono y confirmar /login/gateway.
3. Navegación común en Chrome → / sigue mostrando la landing.
4. Registrar resultado en una nueva entrada de `docs/tasks/log/T-338.md`.
