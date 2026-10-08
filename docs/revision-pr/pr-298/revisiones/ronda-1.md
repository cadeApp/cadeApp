# Informe de revisión — PR #298 / T-314

**Head SHA revisado:** `d60a0473b027db3e93145b27cb4b83bd59caf60a`  
**Base:** `develop@a773c05cc488a1fc60bfb36512cdca35d12d1271`  
**Fecha:** 2026-10-07  
**Resultado:** **CON BLOQUEANTES (5)**

La ficha se leyó desde `develop`. La rama está 2 commits adelante y 0 atrás; solo cambia `e2e/specs/map-privacy.spec.ts` y `docs/tasks/log/T-314.md`, ambos permitidos.

## Decisión P1

### PR298-D01 · Privacidad D3/D15 — ACEPTADA

Lautaro073 eligió **A**: el feed pre-match debe probar ausencia de coordenadas en **DOM + red/RSC**. La ficha abrevia “sin tags”, pero D3/D15 en el plan exige que las coordenadas no viajen. No amplía código productivo persistente.

## Hallazgos

### H01 · D3/D15 no se verifica en red/RSC — BLOQUEANTE

**Archivo:** `e2e/specs/map-privacy.spec.ts:111-151` · **Patrón:** P08

El test solo revisa atributos, componentes y `body.innerText()`. No inspecciona `document`/RSC/JSON/XHR/fetch, por lo que puede quedar verde aunque el navegador reciba coordenadas y React no las pinte.

El seed usa centinelas conocidos: pickup `-27.432,-65.612` y dropoff `-27.435,-65.615`.

**Arreglo:** antes de `goto('/courier/feed')`, registrar inspección de respuestas textuales `document|fetch|xhr`, ignorar Google, esperar las promesas de lectura y exigir que ninguna contenga esos cuatro valores. Mantener las aserciones DOM.

**RED:** inyectar temporalmente una respuesta same-origin textual con un centinela; el test debe fallar mostrando URL + valor.

### H02 · El pin fuera de Aguilares puede quedar sin probar — BLOQUEANTE

**Archivo:** `e2e/specs/map-privacy.spec.ts:177-249` · **Patrón:** P08

En onboarding, 50 `ArrowDown` desde `-27.4333` terminan en `-27.4383`; `minLat` es `-27.4800`. No se cruza el límite. Además onboarding y solicitud guardan la aserción GPS dentro de `if (await button.isVisible())`, así que el requisito puede omitirse sin rojo.

**Arreglo:** ningún requisito del DoD detrás de `if(isVisible())`: primero `expect(button).toBeVisible()`. Para el caso de **pin**, mover `map-container` hasta cruzar el límite y exigir `role="alert"`. En solicitud conservar `Pin fijado` y después cruzar el límite.

**RED:** suprimir temporalmente la advertencia `isOutside` de `src/ui/map.tsx`; los tests de pin deben fallar.

### H03 · `trip-route-map` visible no demuestra mapa real — BLOQUEANTE

**Archivo:** `e2e/specs/map-privacy.spec.ts:286-300` · **Patrón:** P08

`TripRouteMap` mantiene el `<section data-testid="trip-route-map">` tanto con mapa real como con `route-map-fallback`; el propio test de degradación espera ambos a la vez.

**Arreglo:** en el caso feliz exigir `route-map-fallback` count 0 y elementos exclusivos del mapa real (`map-pin-pickup` y `map-pin-dropoff`), además del enlace Google Maps. Parsear la URL y exigir `api=1`, `origin` y `destination`.

**RED:** forzar temporalmente `isMapAvailable=false`; el caso post-match debe fallar aunque el wrapper siga visible.

### H04 · “0 llamadas a Google” es tautológico — BLOQUEANTE

**Archivo:** `e2e/specs/map-privacy.spec.ts:354-378` · **Patrón:** P04

`unmockedGoogleRequests` nace en 0 y nunca se incrementa. `getInterceptedCount() >= 0` también acepta 0. El test puede pasar sin cargar Maps ni ejercer el mock.

**Arreglo:** `setupGoogleMapsMock` debe exponer `interceptedUrls` y `unexpectedGoogleUrls`; interceptar fail-closed hosts de Maps (`maps.googleapis.com`, `maps.google.com`, `maps.gstatic.com` como mínimo). Exigir `interceptedUrls.length > 0` y `unexpectedGoogleUrls === []`.

**RED:** (1) omitir temporalmente el mock → rojo por 0 interceptadas; (2) disparar un host Google Maps no manejado → rojo por unexpected.

### H05 · La fase RED y la bitácora no son evidencia válida — BLOQUEANTE

**Archivo:** `docs/tasks/log/T-314.md:25-35` · **Patrón:** P03

La bitácora llama RED a un fallo `[E2E Fail-Closed] ... proyecto Supabase desconocido`; eso corta antes de ejercer las propiedades. También termina en `cf9f6703`, pero el HEAD revisado es `d60a0473`.

**Arreglo:** agregar una entrada nueva (no reescribir la anterior) con mutación concreta, línea RED por la propiedad, GREEN tras revertir, comandos y HEAD final. Corregir el body para no afirmar que el fail-closed fue TDD RED.

## Falsos positivos descartados

- Alcance: los 2 archivos actuales están permitidos.
- La autorrevisión de agy en el body es autocontrol válido, pero no reemplaza esta revisión.
- `test:db` es n.a.; no toca `supabase/` ni `src/server/`.

## Metodología

Se verificaron PR/ref/HEAD, comentarios, diff, ficha desde `develop`, bitácora y componentes productivos relacionados. Se intentó clonar el SHA para correr mutaciones propias, pero el entorno devolvió `Could not resolve host: github.com`; no se inventan resultados. Los probes estáticos están en `evidencia/comandos.md`. CI no se inspeccionó por dentro porque ya hay bloqueantes.

## Para Ronda 2

- [ ] H01 DOM + red/RSC.
- [ ] H02 pin/out-of-bounds obligatorios, sin `if(isVisible())`.
- [ ] H03 mapa real distinto de fallback.
- [ ] H04 mock ejercido `>0` y salida Google inesperada fail-closed.
- [ ] H05 RED reales + bitácora al HEAD.
- [ ] `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] E2E del spec en staging/preview autorizado.
