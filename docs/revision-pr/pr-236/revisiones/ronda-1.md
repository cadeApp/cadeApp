# Informe de revisión — PR #236 / T-333 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/236  
**Head SHA revisado:** `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7`  
**Base:** `develop` @ `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (1)** — PR236-H01

## Sincronización, alcance y proceso

- `feat/T-333-realtime-reconnect` está 3 commits adelante y 0 atrás de `develop`; merge-base = HEAD actual de `develop`.
- La PR modifica 5 archivos y todos están dentro de «Archivos permitidos» de T-333.
- `docs/tasks/T-333.md` no fue modificado por la rama.
- Antes de esta ronda no existía `docs/revision-pr/pr-236/**`, por lo que no hay autorrevisión mezclada con la carpeta del revisor.
- Se leyeron la ficha desde `develop`, la bitácora, los comentarios, la skill, las reglas de entrega y las lecciones requeridas; T-204 aporta directamente `AG-77`.
- No hay 🔵 DECISIÓN de P1 pendiente en esta ronda.

## Realtime readiness — inspección favorable

El cambio de `useRealtimeInvalidation` observa el callback de `channel.subscribe()` y, solo para `SUBSCRIBED`, encola una invalidación catch-up para cada suscripción del canal.

La implementación conserva los invariantes relevantes:

- no hay `setQueryData`;
- el debounce acumula keys distintas en `pendingKeysRef`, por lo que no vuelve a introducir el defecto de `pr-82/AG-89`;
- estados `CHANNEL_ERROR`, `TIMED_OUT` y `CLOSED` no disparan el catch-up;
- `disposed` impide invalidaciones tardías tras unmount;
- el cleanup limpia timer, pending keys y canal.

Los tests nuevos reflejan esos casos. No hubo workflow sobre el SHA intermedio `4bfbad0` que contenía los tests antes del fix, por lo que esta revisión **no firma** una reproducción independiente de los RED locales declarados por el autor. La mutación debe conservarse como control en la siguiente ronda.

## PR236-H01 — BLOQUEANTE

**Título:** El test de reconnect salta la frontera navegador → `onlineManager` que sigue roja en el E2E real  
**Patrón:** `P08-control-no-cubre-lo-que-dice` / refuerzo de `pr-82/AG-77`  
**Severidad:** alta

### Propiedad exigida

El DoD de T-333 no dice solo que TanStack refetchee cuando alguien cambia su singleton. Dice: **offline → online produce una GET nueva de ofertas con query activa**. El defecto original fue descubierto por un navegador real en PR #180.

### RED reproducido desde el control externo

Se inspeccionó el artifact `playwright-report` del trusted run `37138561471` de PR #180.

En el test de reconnect:

1. la GET inicial exacta `/api/live/requests/<id>/offers` respondió **200** con payload válido;
2. el baseline quedó en **1**;
3. `context.setOffline(true)` hizo visible el aviso offline de cadeApp, demostrando que el navegador/app recibió el cambio de conectividad;
4. `context.setOffline(false)` volvió la app a online;
5. durante 15 s, `offersRequestCount` siguió exactamente en **1**.

Esto descarta la hipótesis de que la causa sea una respuesta HTTP inválida del fetch inicial.

### Por qué la PR actual no cierra esa propiedad

La rama no modifica ningún runtime de reconnect:

- `src/features/requests/hooks/use-request-offers.ts` sigue igual;
- `src/app/providers.tsx` sigue igual.

Lo único que cambia para reconnect es el test: ahora llama directamente a `onlineManager.setOnline(false)` y `onlineManager.setOnline(true)`.

Ese test es útil y debe conservarse: demuestra que **si el singleton cambia**, `refetchOnReconnect: 'always'` causa una llamada posterior al baseline. Pero entra una capa más abajo que el fallo real y no demuestra navegador → `onlineManager`.

### Enumeración de la clase

Se enumeraron los hooks live: `useAvailableRequests`, `useRequestOffers` y `useTrip`. Los tres dependen del mismo `onlineManager` global y declaran `refetchOnReconnect: 'always'`.

Por eso la corrección no debe ser un listener + `refetch()` en cada hook: corresponde una sola integración global en `Providers`.

Los tests heredados de feed y viaje todavía disparan `window.dispatchEvent(new Event('online'))` sin un baseline de fetch inicial; son controles más débiles y no justifican replicar arreglos por hook.

### Riesgo de falso verde post-fix de Realtime

El nuevo catch-up de `SUBSCRIBED` puede producir una GET adicional después del primer GET. El E2E de reconnect de PR #180 fija su baseline justo después de la respuesta inicial.

Por lo tanto, un futuro `count > baseline` puede quedar verde por el catch-up de readiness y no necesariamente por reconnect. No se debe tocar ni debilitar el E2E externo; la forma de evitar aceptar ese falso positivo es cubrir por separado, dentro de T-333, la integración global navegador → `onlineManager`.

### Arreglo requerido

En `src/app/providers.tsx`:

- importar `onlineManager` desde `@tanstack/react-query`;
- instalar una única fuente global mediante `onlineManager.setEventListener`;
- mapear `window.offline` → `setOnline(false)`;
- mapear `window.online` → `setOnline(true)`;
- sincronizar el estado inicial con `navigator.onLine !== false`;
- devolver cleanup de ambos listeners;
- **no** llamar `refetch`, `refetchQueries`, `invalidateQueries`, `router.refresh` ni agregar listeners por hook.

En `src/app/providers.test.tsx`, cubrir esa integración. El control debe quedar RED si se elimina el bridge global y GREEN restaurado.

El test actual de `useRequestOffers` debe permanecer y seguir quedando RED con la mutación temporal `refetchOnReconnect: false`.

## CI del SHA revisado

Se revisaron logs del SHA `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7`:

- unit: **114/114 test files**, **1743/1743 tests**;
- typecheck, lint, build, db-tests y bundle-budget: success;
- Vercel Preview: ready;
- preview E2E: success, pero **no descubre `notifications.spec.ts`**, porque ese archivo vive en PR #180. Corrió 20 tests chromium + 3 global-settings, todos ajenos al control de T-333;
- audit: rojo por `braces`, incidencia externa ya canalizada en T-332.

Por lo tanto, el verde de preview E2E de #236 no valida el defecto que esta tarea debe cerrar.

## Checklist

- [x] HEAD remoto y base verificados.
- [x] Rama al día y mergeable.
- [x] Scope permitido.
- [x] Ficha leída desde `develop`.
- [x] Bitácora y comentarios revisados.
- [x] Clase completa de hooks live enumerada.
- [x] RED externo real de reconnect inspeccionado.
- [x] Realtime readiness revisado por inspección.
- [ ] Navegador → `onlineManager` cubierto/corregido.
- [ ] Mutaciones RED de T-333 reproducidas en la siguiente entrega.
- [ ] CI final auditado después del arreglo.
- [ ] PR #180 trusted Preview verde después del merge, sin modificar su spec.
