# Informe de revisión — PR #298 / T-314 — Ronda 3

**SHA revisado:** `67de7f9a045541c6897882974329252d4f2ed1a6`  
**Base al revisar:** `develop@cd023e3453ead76983d54982df1548cb97aa57eb`  
**Fecha:** 2026-10-07  
**Resultado:** **CON BLOQUEANTES (5: H01, H02, H05, H06, H07)**.

## Alcance y antecedentes

La corrección desde `6d6bc064` es un solo commit y modifica únicamente `e2e/specs/map-privacy.spec.ts` y `docs/tasks/log/T-314.md`; nadie ajeno a la revisión alteró `docs/revision-pr/pr-298/**`. La rama quedó 3 commits atrás de `develop`, sin superposición observada entre archivos de la PR y los cambios de develop. GitHub indica que la PR es mergeable; no fue posible ejecutar `git merge-tree` local por DNS (`Could not resolve host: github.com`).

El trusted `e2e-preview` **37694273759** del HEAD **e72a457** terminó con **5 fallos de T-314 y 44 casos verdes**, detectados desde el log del job **113041979728**. El run del HEAD **67de7f9**, **37697208407**, terminó **FAILURE: 6 failed / 43 passed**, job **113052033584**, todos los casos T-314 fallaron, incluso la privacidad. Los seis errores fueron reproducidos por Playwright con reintentos y quedan separados abajo. El check `e2e-preview` confirma así que el DoD de la PR todavía no está cumplido.

## Resumen

| ID | Prioridad | Estado | Evidencia |
|---|---|---|---|
| H01 | alto | **ABIERTO** | `response.text()` del fetch observado lanza error CDP `Network.getResponseBody` en Preview actual |
| H02 | alto | **ABIERTO** | nuevo `.filter({has: heading}).first()` selecciona un `div` exterior |
| H03 | alto | arreglado-sin-verificar | aserciones correctas; e2e anterior no pudo encontrar `map-pin-pickup` |
| H04 | alto | arreglado-sin-verificar | test no tautológico; e2e anterior recibió `interceptedUrls.length=0` |
| H05 | medio | **ABIERTO** | documentación local corregida parcialmente; sin GREEN integral ni mutation proof verificable de casos con staging |
| H06 | alto | **ABIERTO** | navegación de rutas privadas con sesión inexistente o de rol incorrecto |
| H07 | alto | **ABIERTO** | mock actual de Maps no permitió render de pins en trusted Preview |

## H01 — se observa el fetch pero el cuerpo no puede leerse — BLOQUEANTE

**`e2e/specs/map-privacy.spec.ts:199-235` — [VERIFICADO-CI]**

La Ronda 2 pedía obligar a observar el fetch vivo; la espera `page.waitForResponse` se implementó correctamente, **pero no es ejecutable en el Preview actual**. Trusted CI `37697208407` informa en el caso de privacidad (3 intentos):

```text
Error: response.text: Protocol error (Network.getResponseBody): No resource with given identifier found
e2e/specs/map-privacy.spec.ts:225:49
```

Sucede cuando se ejecuta `const liveFeedBody = await liveFeedResponse.text()`. Puede tratarse de retención/cancelación de cuerpos CDP; sin traza no debe afirmarse la causa exacta.

**Arreglo preciso:** interceptar de manera segura **solo** `/api/live/available-requests` con `page.route` **antes** de navegar, `await route.fetch()`, `await apiResponse.text()` (lectura desde Playwright APIRequestContext, sin depender del body retenido en DevTools), conservar ese cuerpo en un array para las aserciones y `await route.fulfill({ response: apiResponse })` sin cambiar el payload de producción. Exigir una respuesta 200 real, `expect(liveBodies.length).toBeGreaterThan(0)`, y ausencia de cuatro centinelas. No ignorar errores de lectura. El colector de document/RSC sigue aparte y no puede ignorar silenciosamente una falla de lectura relevante.

**RED:** un `route.fulfill` temporal de ese endpoint con payload semánticamente válido pero centinela inesperado debe poner el test rojo **por la aserción de privacidad**, no por `Network.getResponseBody` ni por el fail-closed.

## H02 — el selector de entrega sigue siendo ambiguo — BLOQUEANTE

**`e2e/specs/map-privacy.spec.ts:365-372` — [ANÁLISIS]**

El autor hizo el paso correcto de `toHaveCount(2)`, pero luego elige:

```ts
page.locator('div')
  .filter({ has: page.getByRole('heading', { name: /destino y entrega/i }) })
  .first();
```

`.filter({has: heading})` devuelve **todos los `div` ancestros** del encabezado; `.first()` toma el exterior, no la Card de destino. El formulario incluye arriba otro botón homónimo en la Card de retiro. Por eso `dropoffSection.getByRole('button', ...)` sigue pudiendo resolver a dos botones en strict mode.

**Corrección precisa:** usar el `div` **más cercano que tenga tanto** el encabezado de Destino como el botón correspondiente. Por ejemplo `page.locator('div').filter({has: heading}).filter({has: locationButton}).last()`, y luego `expect(dropoffCard.getByRole('button', ...)).toHaveCount(1)`. Mejor aún, anclar al elemento `Card` que realmente se ve en el DOM; no usar ancestros genéricos `.first()`.

**RED propia requerida:** invertir el orden de las dos Cards en HTML temporal / insertar otro botón homónimo fuera de destino. La selección debe seguir siendo el GPS del bloque de destino, no el primero de la página.

## H05 — falta evidencia RED/GREEN integral y cierre coherente — BLOQUEANTE

**`docs/tasks/log/T-314.md:66-97` y PR body — [ANÁLISIS]**

Se corrigió el body: `pnpm test` local ahora dice ❌ por 2 fallos de un worktree T-339 no versionado y cita el CI `unit` verde por separado. Eso se acepta como **mejora documental correcta**, sin atribuir a T-314 esos dos fallos.

Sin embargo la bitácora vieja afirmaba mutation RED/GREEN de H01–H03, mientras la nueva reconoce que esos casos ni siquiera entraban a su aserción local por el fail-closed. No hay una mutation proof reproducible propia que los valide. Más importante: el E2E Preview anterior terminó rojo, no GREEN integral. El run actual **37697208407** ya se inspeccionó y confirma **6 fallos de T-314**, así que no puede declararse GREEN integral ni mantenerse el DoD E2E marcado como cumplido.

**Corrección:** conservar entradas históricas, agregar sesión posterior que identifique declaraciones anteriores no comprobadas como tales y registre run+SHA+resumen de T-314 real. Marcar DoD E2E sin cumplir hasta verde. No afirmar `pnpm test` local verde.

## H06 — las pruebas llegan a rutas de rol sin autenticación correcta — BLOQUEANTE

**`e2e/specs/map-privacy.spec.ts:262-269; 459-486; 492-503` — [ANÁLISIS + CI de e72a457]**

Tres variantes de la misma clase:
1. Alta de comercio visita `/merchant/onboarding` sin `loginAsMerchant` (usa `stagingContext`, pero el seed **no autentica la página**). Trusted E2E previo reportó `map-picker` no encontrado en esta ruta.
2. El caso de “0 llamadas Google” visita la misma ruta sin login **ni fixture de staging**. Trusted E2E previo confirmó `interceptedUrls=0`.
3. Degradación: inicia sesión como **courier** para viaje, luego navega directo a `/merchant/onboarding` con ese mismo navegador. El guard de rol lo redirige: el banner de MapPicker no existe. Trusted E2E previo reportó ausencia de `map-load-error-banner/map-fallback`.

La ruta se protege en `src/features/auth/guards.ts`: `isMerchantRoute`/guard de sesión. El backend de seed `withMerchant:true` crea credenciales, no una cookie de navegador.

**Corrección:** para alta y prueba de mock iniciar sesión con fixture `loginAsMerchant` y validar `toHaveURL(/\/merchant\/onboarding/)` luego de la navegación; para la degradación de courier→merchant, usar otra `page`/context autenticado como merchant (o autenticar como merchant en la misma página **después** de verificar courier, evitando cargar la ruta con rol equivocado). No modificar guards de producción.

## H07 — el mock de SDK Maps no entrega pins reales en Preview — BLOQUEANTE

**`e2e/specs/map-privacy.spec.ts:32-133; 411-421` — [CI real + ANÁLISIS]**

En el run previo el caso post-`matched` llegó a la aserción de marcador, pero `[data-testid=map-pin-pickup]` **no existía**. El stub JS configura `Map`, `Marker`, `Polyline`, `LatLng` e `importLibrary` genérico, pero no modela explícitamente la librería `marker`/ `AdvancedMarkerElement` que necesita `@vis.gl/react-google-maps` para montar `AdvancedMarker`, ni garantiza completar el callback de carga del SDK. El problema puede estar en esa incompatibilidad; hay que comprobarlo en el trace del Preview, no fingir certeza absoluta del origen.

**Corrección:** robustecer el JS stub **dentro del spec autorizado** usando la interfaz del loader que realmente solicita el SDK: callback de carga, `google.maps.marker.AdvancedMarkerElement`, `importLibrary('marker')` y métodos necesarios. Exigir que se hayan interceptado solicitudes SDK y que pickup/dropoff rendericen de verdad; no inyectar `data-testid` artificialmente ni deshabilitar las assertions. Si el trace muestra que falta la API key pública en Preview, eso exige configurar el entorno Develop/Vercel fuera de este spec; **no poner keys en el código** ni modificar el entorno desde la revisión.

## CI y limitaciones

- CI para `67de7f9`: run **37697082466** success (unit, db-tests, lint, typecheck, build, audit, bundle-budget).
- E2E anterior para `e72a457`: run **37694273759** = FAILURE, **44 passed / 5 failed** en los 5 casos T-314 de pin alta, pin solicitud, postmatch, graceful y mock.
- E2E nuevo `37697208407`: **failure (6 failed, 43 passed)**; privacidad: error al leer body, alta: map-picker ausente, solicitud: strict mode (dos botones), postmatch: pin pickup ausente, graceful: mapa de comercio ausente, mock: 0 URLs interceptadas.
- No se clonó el repo en este entorno: `git ls-remote` falló por DNS. Por eso los hallazgos nuevos son **análisis** apoyado en código de producción y en la evidencia runtime del SHA anterior, no mutaciones locales independientes.

## NO TOCAR

- No tocar `src/features/auth/guards.ts`, `src/ui/map.tsx`, los contratos ni la ficha T-314 por problemas del E2E: la tarea autoriza solamente el spec y bitácora.
- No rebajar/omitir aserciones de map real, privacidad DOM+RSC+fetch, ni contador del mock.
- No modificar secretos, Vercel ni Supabase desde esta revisión.

## Para Ronda 4

- [ ] H01 cuerpo del fetch real legible sin error CDP y control red+RSC GREEN.
- [ ] H02 GPS unívoco, sin `.first()` sobre ancestros.
- [ ] H06 todos los navegadores usan sesión y rol correcto, incluida degradación.
- [ ] H07 mock SDK modela markers correctamente, con evidencia de trace y GET SDK interceptado.
- [ ] H05 bitácora y body reflejan tests reales, sin GREEN inventado.
- [ ] GREEN `e2e-preview` del SHA exacto y mutaciones RED auténticas de propiedades.
- [ ] CI unit/typecheck/lint/build verdes.
- [ ] Contraste con `develop` actualizado; si es necesario merge de `origin/develop` sin rebase ni forzar.
