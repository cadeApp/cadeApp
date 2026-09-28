# Informe de revisión — PR #117 / T-201

**PR:** https://github.com/cadeApp/cadeApp/pull/117  
**Head SHA revisado:** `f661f372e0cc708759caf91816b3483d31883f69`  
**Base original:** `develop` @ `15d21e8105ab08e7c05105105a3c0e325e87fd04`  
**develop al revisar:** `57badabc28fd3bd8e913674bd80b30feb8828414`  
**Fecha:** 2026-09-28

## Resultado

**CON BLOQUEANTES (4).** Hay además una mejora operativa y un desvío de alcance ya aceptado por Lautaro073.

Esta ronda es **inspección estática**: por protocolo no se consultó CI porque todavía hay bloqueantes. Los comandos y mutaciones que deben reproducirse en la siguiente ronda están en `evidencia/comandos.md`.

## Decisiones humanas ya resueltas

- **D01 / 1-A:** aceptar `src/features/notifications/index.ts`.
- **D02 / 2-A:** autorizar exactamente `courier-feed.tsx`, `request-card.tsx`, `offer-sheet.tsx` y `courier-panel.test.tsx` para implementar T03 en el producto real.
- **D03 / 3-A:** caché persistente restringida a shell/assets públicos same-origin explícitamente permitidos; nada de API, HTML/RSC autenticado ni lecturas de usuario.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | 🔴 alto | `offline-state.test.tsx:14` + `courier-feed.tsx:185` | El test inventa la acción offline; el producto real no la aplica | BLOQUEANTE |
| H02 | 🔴 alto | `public/sw.js:20,60` + `sw.test.ts:20` | El worker real cachea GETs arbitrarios y los tests prueban un duplicado | BLOQUEANTE |
| H03 | 🔴 alto | `offline-banner.tsx:23,52,59` y otros | Piso 14 px / target 48 px incumplidos | BLOQUEANTE |
| H04 | 🟠 medio | `visual-verification.test.tsx:9` | jsdom no sustituye navegador/capturas exigidas por el DoD | BLOQUEANTE |
| H05 | 🟡 bajo | cuerpo de la PR · Rollback | Borrar/revertir `sw.js` no desregistra el worker existente | MEJORA |
| A01 | 🔵 decisión | `docs/tasks/T-201.md:21` | Ampliación previa de ficha para el entry point | ACEPTADO |

## H01 · T03 se prueba con un botón ficticio y no protege el feed real

**Archivos:**  
- `src/features/notifications/offline/offline-state.test.tsx:14-15`  
- `src/features/offers/components/courier-feed.tsx:185,199`  
- `src/features/offers/components/request-card.tsx:108`  
- `src/features/offers/components/offer-sheet.tsx:94`

**Estado:** [ANÁLISIS] · BLOQUEANTE

### Diagnóstico

El DoD y T03 exigen degradación no destructiva: feed atenuado, botones de ofertar deshabilitados y sin mutaciones inseguras offline. La suite actual no prueba eso en el producto. `offline-state.test.tsx` crea dentro del propio test un `TestConsumer` con un botón artificial y le pone directamente `disabled={isOffline}`.

En producción:

- `CourierFeed` no consume `useOfflineStatus`;
- `RequestCard` abre el Sheet sin condición offline;
- `OfferSheet` puede ejecutar `submitOfferAction` aunque la conexión haya caído después de abrirlo;
- el feed real no recibe `grayscale-[20%] opacity-80`.

El control está verde porque implementa dentro del fixture la propiedad que afirma verificar.

### Arreglo

Usar la decisión D02:

1. En `CourierFeed`, consumir `useOfflineStatus` desde el entry point público `@/features/notifications`.
2. Aplicar `grayscale-[20%] opacity-80` al bloque del feed cuando `isOffline`.
3. Pasar `disabled={isOffline}` a `RequestCard`; el botón Ofertar debe quedar deshabilitado y `handleOpenOfferSheet` debe tener una guarda defensiva.
4. Pasar `isOffline` a `OfferSheet`; deshabilitar **Enviar oferta** con `isSubmitting || isOffline` y no ejecutar `onSubmitOffer/submitOfferAction` offline.
5. Quitar del test de notifications el botón ficticio. Ese test queda para hook/banner/card. Las garantías de oferta van a `src/features/offers/courier-panel.test.tsx`.

### Cómo verificar

Los tests reales deben cubrir:
- offline desde el inicio → feed atenuado + botón Ofertar disabled;
- Sheet abierto online y luego evento `offline` → botón Enviar oferta disabled;
- click/submit offline → spy de `onSubmitOffer` en 0 llamadas;
- evento `online` → se rehabilitan las acciones.

La mutación RED posterior debe quitar la guarda o forzar `isOffline=false` en el componente real; la prueba tiene que fallar.

## H02 · El worker real persiste GETs arbitrarios y sus tests ejercen otro archivo

**Archivos:**  
- `public/sw.js:14-30,52-60`  
- `src/app/sw.ts:14-32,55-64`  
- `src/app/sw.test.ts:20-31,34-52`

**Estado:** [ANÁLISIS] · BLOQUEANTE

### Diagnóstico

El script realmente registrado por `providers.tsx` es **`/sw.js`**, o sea `public/sw.js`. Sin embargo `sw.test.ts` importa y prueba `src/app/sw.ts`, que no es el worker servido.

Además, la política del runtime considera cacheable cualquier GET HTTP(S) salvo tres regex y hace `cache.put` de toda respuesta 200. Eso incluye potencialmente rutas HTML/RSC autenticadas, lecturas de usuario, `/api/health`, endpoints futuros no enumerados y recursos cross-origin.

D03 ya resolvió la política: persistencia solo para shell/assets públicos same-origin explícitamente permitidos.

### Arreglo

- Eliminar la duplicación no ejecutada de `src/app/sw.ts` o dejar de usarla como evidencia. La prueba debe ejecutar **`public/sw.js` real**.
- En el runtime separar:
  - requests que el SW puede interceptar para fallback de navegación;
  - responses que se pueden **persistir**.
- Persistencia permitida:
  - assets exactos del shell declarados;
  - `/_next/static/**` same-origin, por ser assets públicos inmutables;
  - ningún `/api/**`, `?_rsc=`, HTML dinámico autenticado, Storage sensible ni recurso cross-origin.
- Una navegación same-origin puede usar network-first y fallback a `/`, pero su HTML dinámico no se guarda.
- Requests no permitidos deben quedar fuera de `respondWith` para que sigan la red normal.

### Tests exactos

`src/app/sw.test.ts` debe cargar `public/sw.js` con `node:fs` + `node:vm`, mockear `self.addEventListener`, `caches` y `fetch`, capturar los listeners y probar el runtime real:

1. `/brand/logo.svg` same-origin 200 → puede persistirse.
2. `/_next/static/chunks/app.js` → puede persistirse.
3. `/api/health`, `/api/requests`, `/api/auth/**`, `/api/push/**` → no se interceptan/persisten.
4. navegación `/courier/feed` con red OK → respuesta de red y **cero** `cache.put` de ese HTML.
5. navegación `/courier/feed` con red caída → fallback al shell `/`.
6. cross-origin → no se intercepta ni persiste.
7. POST/PUT/DELETE → no se interceptan.

La mutación RED debe ampliar en memoria la condición de persistencia a “todo GET” y demostrar que al menos el test de `/api/health` o HTML autenticado falla.

## H03 · T01/T03/T04 incumplen piso 14 px y Retry de T03 mide 36 px

**Archivos y clase completa enumerada:**
- `src/features/notifications/install/ios-install-guide-sheet.tsx:38,52,66,79` → `text-xs`
- `src/features/notifications/offline/offline-banner.tsx:23,52` → `text-xs`
- `src/features/notifications/offline/offline-banner.tsx:59` → `h-9 ... text-xs`
- `src/features/notifications/offline/error-view.tsx:57` → `text-xs`

**Estado:** [ANÁLISIS] · BLOQUEANTE

### Diagnóstico

D16 fija piso tipográfico móvil `text-sm` (14 px) y regla 60 fija targets táctiles de 48×48 px. El botón **Reintentar** de T03 usa `h-9` (36 px), y las vistas T01/T03/T04 aún contienen `text-xs`.

La suite de “verificación visual” comprueba 48 px en T01 y T04, pero para T03 solo comprueba que el botón existe.

### Arreglo

- Reemplazar los `text-xs` listados por `text-sm`.
- En T03 cambiar Retry a `min-h-12` o `h-12`, padding compatible y `text-sm`.
- Agregar aserciones que cubran específicamente Retry y ausencia de `text-xs` en T01/T03/T04.

### Cómo verificar

Mutación RED: volver temporalmente Retry a `h-9` o una de las ocurrencias a `text-xs`; el test de accesibilidad correspondiente debe fallar.

## H04 · La “verificación visual” es jsdom y no hay capturas reales enlazadas

**Archivos:**  
- `src/features/notifications/offline/visual-verification.test.tsx:9,59`  
- `docs/tasks/T-201.md:38`  
- `docs/tasks/log/T-201.md:15`

**Estado:** [ANÁLISIS] · BLOQUEANTE

### Diagnóstico

La ficha exige navegador real a 390 px y 360 px, emulación Safari iOS y capturas de T01/T03/T04. El archivo llamado `visual-verification.test.tsx` cambia `window.innerWidth` en jsdom y revisa clases/DOM. jsdom no realiza layout responsive ni demuestra clipping, safe areas, posición real ni fidelidad visual.

La bitácora y el DoD están marcados como cumplidos, pero el PR no contiene enlaces persistentes a las capturas declaradas.

### Arreglo

- Mantener los tests DOM como regresión, pero no llamarlos evidencia suficiente de navegador.
- Arrancar el build productivo y verificar T01/T03/T04 en navegador real a 390×844 y 360×800.
- Probar al menos: T01 Sheet, T03 offline con feed real, T04 error y 404, foco visible, safe area y reduced motion.
- Adjuntar capturas persistentes y enlazarlas desde el PR y la bitácora.
- Si el entorno del agente no puede adjuntar archivos a GitHub, **no fabricar evidencia**: dejar el DoD sin marcar y decir exactamente qué captura falta.

### Cómo verificar

En R2 se deben abrir los enlaces de captura y comprobar que corresponden al SHA corregido. Un test jsdom verde no cierra H04.

## H05 · El rollback del cuerpo de la PR afirma una desregistración automática inexistente

**Archivo:** cuerpo de la PR · sección Rollback

**Estado:** [ANÁLISIS + verificación externa] · MEJORA

### Diagnóstico

El cuerpo dice que “el service worker se desregistra automáticamente ... ante error o 404 del script”. Eso no es un rollback fiable. La registración del SW persiste y la eliminación/renombre del script no reemplaza `ServiceWorkerRegistration.unregister()`.

Referencias:
- MDN: `ServiceWorkerRegistration.unregister()`
- web.dev, “Update”: para quitar por completo un SW se deben obtener las registraciones y llamar `unregister()`.

### Arreglo

Corregir el cuerpo de la PR. El rollback debe distinguir:
1. revertir el código/registro para futuras cargas;
2. limpiar una registración ya instalada mediante una estrategia explícita de unregister/kill worker si alguna vez hay que retirar la PWA.

No hace falta agregar un kill-switch permanente en esta ronda; sí quitar la afirmación falsa.

## A01 · Entry point de notifications fuera de la ficha original

**Archivo:** `docs/tasks/T-201.md:21`

**Estado:** ACEPTADO por Lautaro073 · D01 / 1-A

La ficha de `develop` no autorizaba `src/features/notifications/index.ts`; la rama se lo agregó antes de consultar. La necesidad técnica es válida porque la regla de arquitectura exige consumir features desde su entry point.

La decisión humana acepta **solo** ese archivo. No convierte en válida cualquier futura ampliación de alcance.

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `src/features/notifications/index.ts` fuera de alcance | D01/1-A lo acepta de forma exacta. |
| Los assets precargados no existen | Los logos e íconos listados en `STATIC_ASSETS` existen en el SHA revisado. El problema es la política dinámica posterior, no esos paths. |
| T04 filtra el stack/message completo | `ErrorView` no renderiza el message/stack; H03 solo cuestiona tipografía, no filtrado. |
| La rama tiene conflicto con develop | GitHub reportó `mergeable: true`; está 1 commit detrás, pero no se observó conflicto. Igual debe mergear `origin/develop` antes de corregir. |

## Por qué los checks verdes no alcanzan

| Check/evidencia declarada | Qué dice | Qué no ejerce |
|---|---|---|
| `offline-state.test.tsx` | “deshabilita acciones no seguras” | Deshabilita un botón creado dentro del test, no `RequestCard/OfferSheet`. |
| `sw.test.ts` | política de caché/fallback | Importa `src/app/sw.ts`; el navegador ejecuta `public/sw.js`. |
| `visual-verification.test.tsx` | responsive 390/360 | jsdom no hace layout ni genera evidencia visual real. |
| 19 tests específicos verdes | regresión de fixtures | No cubren los tres invariantes anteriores. |

## Checklist para R2

- [ ] Rama mergeada con `origin/develop`, sin rebase.
- [ ] Ficha refleja exactamente D01 + D02, sin otra ampliación.
- [ ] H01: feed real atenúa y ofertas reales quedan bloqueadas offline.
- [ ] H02: tests ejecutan `public/sw.js` y no persisten API/HTML/RSC/cross-origin.
- [ ] H03: cero `text-xs` en T01/T03/T04 revisadas y Retry T03 ≥48 px.
- [ ] H04: capturas reales persistentes 390/360 enlazadas.
- [ ] H05: rollback corregido en el cuerpo del PR.
- [ ] Evidencia RED/GREEN con mutaciones sobre producción real; no fixtures inventados.
- [ ] Recién entonces revisar CI del SHA resultante.

## Metodología

Se revisó el SHA `f661f372e0cc708759caf91816b3483d31883f69` mediante GitHub MCP, contrastando ficha oficial de `develop`, diff, bitácora, referencias T00, reglas de arquitectura/testing/UI y componentes productivos de ofertas. No se ejecutaron checks locales ni CI en R1 porque el protocolo indica que, con bloqueantes abiertos, la ronda es estática más la evidencia reproducible preparada para la siguiente.
