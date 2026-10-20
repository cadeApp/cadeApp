# Informe de revisión — PR #438 / T-377 — ronda 1

**Fecha:** 2026-10-20 · **PR:** https://github.com/cadeApp/cadeApp/pull/438  
**Head revisado:** `e6e6769109dfef5926dea90dc44bd1100c9163ab` · **Base:** `develop` @ `54bbdcd7b079fa208e970725efa66832a8fac724`  
**Resultado:** **CON BLOQUEANTES (2)** · **MEJORAS (1)**. PR **solo documental**.

## Método y alcance

Se consultaron los 2 archivos del diff, el issue #437, el contenido de la ficha, `docs/master-plan.md` (D3/D7/D15), el componente `trip-route-map.tsx`, `route-points.ts`, las pruebas unitarias `route-map.test.tsx` y la estructura de `map-privacy.spec.ts` de `develop`. Se revisó la documentación oficial de Google sobre `Route.computeRoutes`, `fields`, `path`, límites y facturación. Los comentarios y el estado Draft fueron consultados. La ficha T-377 **no existía en develop**: esta PR la crea; por lo tanto, no se puede presentar como una ficha previamente aprobada desde develop.

Se verificó que `develop...head` solo modifica `docs/tasks/T-377.md` y `docs/implementation-plan.md`. No se ejecutó la suite local ni se levantaron servicios externos: el entorno de revisión no tiene clon git conectado. Hay un guard documental de cinco condiciones ejecutado por lectura del contenido remoto del SHA: 5 FAIL, detallado en `evidencia/comandos.md`. **Esto NO verifica el comportamiento runtime ni equivale a pruebas de aplicación.** No exigir E2E, db-tests ni revalidación de CI por este commit de informe.

## Resumen

| ID | Tipo | Archivo | Diagnóstico |
|---|---|---|---|
| PR438-H01 | **BLOQUEANTE · alto** | `docs/tasks/T-377.md:29-30, 65-66` | Pide dibujar línea recta también sin coordenadas, contradiciendo T-363 |
| PR438-H02 | **BLOQUEANTE · medio** | `docs/tasks/T-377.md:26-29, 62-71` | No fija campos requeridos, preservación del orden ni condiciones de resultado y recálculo |
| PR438-H03 | **MEJORA · bajo** | `docs/tasks/T-377.md:92` | El cupo gratuito se presenta como garantía sin volumen ni SKU comprobado |

### PR438-H01 — Mantener la regla T-363 cuando falten coordenadas

**[ANÁLISIS de código y documentos; guard documental RED]**: el DoD de la ficha dice que, si falta alguna coordenada, se dibuja la línea recta actual. Pero `buildTripRoutePlan` configura `canDrawMap=false` cuando cualquier punto carece de coordenadas; `TripRouteMap` no monta el Google Map en ese estado y `route-map.test.tsx` exige que no haya `mock-route-polyline`. Una línea parcial contradice las pruebas y puede hacer creer que hay recorrido completo.

**Decisión A de Lautaro073 (2026-10-20):** conservar T-363. Redactar por separado tres escenarios:
1. **Falta una o más coordenadas:** no dibujar mapa, `Polyline` ni tramo parcial; mostrar el fallback T-363, identificar puntos faltantes y mantener direcciones textuales y enlaces disponibles.
2. **Todas las coordenadas existen, Maps JS carga, pero Routes falla/no devuelve geometría:** conservar el mapa con pines y una línea recta **rotulada visiblemente como orientativa**.
3. **Maps JS falla por completo, está offline o no hay key:** conservar el fallback existente sin afirmar que hay línea recta en un mapa que no se pudo montar.

Modificar objetivo, decisiones, DoD, casos de test y descripción de la PR sin romper la privacidad antes del match. No implementar código en esta PR.

### PR438-H02 — Especificar el contrato mínimo y el comportamiento de la ruta

**[ANÁLISIS de API oficial; guard documental RED]**: `Route.computeRoutes` requiere `fields`; para dibujar la geometría se necesita `fields: ['path']` y leer `routes?.[0]?.path`. La ficha solo dice «computeRoutes, DRIVING», lo cual deja margen para pedir campos erróneos, optimizar paradas sin permiso, llamar repetidamente, renderizar una respuesta obsoleta o mostrar una traza sin geometría.

**Corrección requerida en la ficha**:
- Cargar `useMapsLibrary('routes')` **dentro** de `APIProvider` y calcular exclusivamente con puntos válidos revelados tras match. Llamar `google.maps.routes.Route.computeRoutes` / `Route.computeRoutes` desde la biblioteca; especificar `origin` = retiro, `destination` = última entrega, `intermediates` = entregas anteriores ordenadas por `position`, `travelMode: 'DRIVING'`, `fields: ['path']` y `optimizeWaypointOrder: false`. No activar tráfico ni TWO_WHEELER por defecto.
- Usar `routes?.[0]?.path` si contiene una geometría válida; convertir a pares lat/lng compatibles con `Polyline` cuando haga falta. Si no, fallback honesto. No reemplazar la insignia de distancia calculada en servidor con `distanceMeters`.
- Evitar nuevos cálculos por render con una clave estable de los puntos ordenados; al cambiar los puntos, no pintar respuestas tardías de la clave anterior ni actualizar estado desmontado. Encajar la geometría y pines en el encuadre y revisar la frase existente «Ruta directa sin desvíos» en C06, que resulta engañosa si se implementa recorrido por calles.
- Probar unidad con mocks ejercitando el mismo flujo de `Route.computeRoutes`: ruta OK con curvas, entrega intermedia y orden, rechazo, sin ruta, sin biblioteca, no recalcular al rerender, coordenadas faltantes y carrera entre requests. Los E2E quedan para la PR de implementación, **no para esta PR de ficha**.
- Para volúmenes con más de 10 puntos intermedios, explicitar una política de límite de SKU/cantidad antes de implementación (rechazar a fallback o dividir en tramos completos con control de gastos), sin reordenar las entregas ni fingir que la ruta se calculó.

Fuentes oficiales:
- https://developers.google.com/maps/documentation/javascript/reference/route
- https://developers.google.com/maps/documentation/javascript/usage-and-billing

### PR438-H03 — Sustituir garantía de costo por condición verificable

**[ANÁLISIS de facturación; guard documental RED]**: la frase «con el cupo gratuito de Google alcanza para el piloto» no se deduce de la ficha. Se factura cada `Compute Routes`; Essentials se limita a funciones básicas y hasta 10 intermediates; `TRAFFIC_AWARE`/`TRAFFIC_AWARE_OPTIMAL` puede pasar a Pro; el modo de dos ruedas usa Enterprise. El cap gratuito publicado para Routes Compute Routes Essentials es de 10.000 solicitudes al mes, pero el consumo real, las cargas de mapa y la política de uso no se han cuantificado.

**Corrección sugerida**: documentar el SKU objetivo `Compute Routes Essentials`, evitar funciones que escalen de SKU, estimar llamadas/mes (viajes con match × aperturas del mapa × recálculos por cambio de puntos), prever seguimiento de cuota/presupuesto y retirar la afirmación de gratuidad garantizada. La restricción de la key en Google Cloud es un **paso operativo humano futuro**, no un bloqueo de este merge documental.

Fuentes oficiales:
- https://developers.google.com/maps/documentation/javascript/usage-and-billing
- https://developers.google.com/maps/billing-and-pricing/pricing

## No tocar: hechos y falsos positivos descartados

- Esta PR no tiene cambios en `src/**`, `supabase/**` ni dependencias; no corresponde exigir db-tests, E2E ni tests de aplicación para esta ronda.
- La insignia de distancia debe continuar consumiendo el cálculo del servidor (D15), aunque la ruta visual use Google.
- Las coordenadas no deben viajar antes del match (D3). El componente de viaje ya opera tras el match; el requisito sigue siendo vinculante para implementación.
- El fallback actual de T-363 sin coordenadas es intencional, no un bug del componente.

## Checklist

- [x] Diff solo documental y alcance revisado
- [x] Reglas de revisión y master plan consultados
- [x] H01 decisión A recibida del usuario
- [x] Contrato y facturación comprobados contra fuente oficial
- [x] Guard documental sobre ficha actual: 5 FAIL (no se afirma suite CI)
- [ ] H01-H03 corregidos por el autor y comprobados sobre nuevo SHA
- [ ] Revisión de siguiente ronda sin bloqueantes
- [ ] No se aprobó ni mergeó

