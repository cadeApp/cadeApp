# Informe de revisión — PR #438 / T-377 — ronda 2

**Fecha:** 2026-10-20  
**PR:** https://github.com/cadeApp/cadeApp/pull/438  
**HEAD revisado:** `1a24494cdc9c2fac0e85fe550f040849a57b2fa4`  
**HEAD de ronda 1:** `e6e6769109dfef5926dea90dc44bd1100c9163ab`  
**Base:** `develop` @ `54bbdcd7b079fa208e970725efa66832a8fac724`

## Resultado

**SIN BLOQUEANTES · H01, H02 y H03 ARREGLADOS-VERIFICADOS.** Sin hallazgos nuevos. Revisión exclusivamente documental; no certifica la implementación futura de Google Maps Routes.

## Alcance y trazabilidad

`ace07ff..1a24494`: un commit adicional del autor modifica solo `docs/tasks/T-377.md` (+36/-11) y la descripción de PR #438. `docs/implementation-plan.md` no fue modificado por el arreglo; conserva la fila original T-377. Las carpetas del revisor no fueron alteradas por el autor. La rama estaba 0 commits detrás de `develop` en la comparación disponible y GitHub indicó `mergeable=true`. La ficha no existe aún en `develop`, pues esta PR es su alta; ello es intencional.

Se cotejó con `docs/master-plan.md` D3/D7/D15, los controles actuales de T-363 en `route-points.ts` / `route-map.test.tsx`, y la documentación oficial de Google Maps JavaScript `Route.computeRoutes` / factura y cuota:
- https://developers.google.com/maps/documentation/javascript/reference/route
- https://developers.google.com/maps/documentation/javascript/usage-and-billing
- https://developers.google.com/maps/billing-and-pricing/pricing

## Resultado por hallazgo

### PR438-H01 — ✅ ARREGLADO-VERIFICADO

**SHA:** `1a24494cdc9c2fac0e85fe550f040849a57b2fa4` · **Fuente:** `docs/tasks/T-377.md`, Objetivo, Decisiones y DoD; cuerpo de PR.

Los tres fallbacks son excluyentes: (1) una coordenada faltante → T-363 y **sin mapa ni traza parcial**, con las direcciones y enlaces posibles; (2) todas las coordenadas con Maps JS cargado, pero fallo/sin geometría de Routes → `Polyline` directo etiquetado claramente; (3) SDK Maps JS ausente/fallido/offline → fallback existente sin mapa. Se conserva la regla de privacidad pre-match. La decisión A del usuario quedó aplicada correctamente.

### PR438-H02 — ✅ ARREGLADO-VERIFICADO

**SHA:** `1a24494cdc9c2fac0e85fe550f040849a57b2fa4` · **Fuente:** `docs/tasks/T-377.md`, Decisiones y DoD.

La ficha incluye:
- `useMapsLibrary('routes')` bajo `APIProvider` y `Route.computeRoutes`.
- `origin` pickup, `destination` última entrega, `intermediates` anteriores según `position`.
- `travelMode: 'DRIVING'`, `fields: ['path']` y `optimizeWaypointOrder: false`.
- Verificación de `routes?.[0]?.path`, validación de geometría y encuadre de curvas, preservando la distancia del servidor.
- Clave estable de coordenadas, sin recálculo en rerender y respuestas antiguas ignoradas al cambiar puntos/desmontar.
- Más de 10 puntos intermedios: fallback directo **honesto**, evitando encarecimiento sin control.
- Ajuste previsto al copy de C06, manteniendo el contraste de T-350.
- Tests unitarios futuros con mocks que interceptan `Route.computeRoutes` y cubren múltiples entregas, fallos, ausencias de coordenadas, carreras y límites.

La API oficial confirma que `fields` es obligatorio, `Route.path` es la geometría dibujable y `optimizeWaypointOrder=false` preserva el orden. La limitación de 10 intermedios es de facturación **Essentials**, no el máximo técnico absoluto (25), y la ficha lo expresa como decisión de costo sin prometer que Google no admite más.

### PR438-H03 — ✅ ARREGLADO-VERIFICADO

**SHA:** `1a24494cdc9c2fac0e85fe550f040849a57b2fa4` · **Fuente:** `docs/tasks/T-377.md`, Notas, y cuerpo de PR.

La nota presenta el costo como **no garantizado**, apunta al SKU `Compute Routes Essentials`, al cupo gratuito publicado de 10.000 solicitudes mensuales condicionado por tarifas y consumo, y pide registrar consumo, cuotas y alertas. La key y la habilitación de Routes API siguen siendo un paso **operativo humano posterior**, no un bloqueo de este PR documental. Los 10.000 son un cap de solicitudes facturables de ese SKU, no una promesa de costo total $0.

## Evidencia ejecutada y límites

- Condiciones reproducidas del guard documental archivado: **5 FAIL** con el contenido de `e6e6769`, **5 PASS** con `1a24494`. Se ejecutaron los mismos predicados sobre el texto remoto obtenido por GitHub, en un control JavaScript independiente, sin adulterar el guard ni las aserciones.
- Comprobación independiente adicional: **15 PASS de 15**, distribuidas entre fallback, contrato, costo, texto del cuerpo PR e integridad de los registros previos. Comandos/registros en `evidencia/comandos.md`.
- GitHub a la hora de la consulta: Vercel success; CI general in_progress; e2e-preview pending. **No se confunden checks pendientes con fallos ni se condiciona el cierre documental a E2E.**
- El autor reportó `pnpm vitest run tools/verify-fichas.test.ts`: 7/7 y `git diff --check` limpio; el revisor **no** los reprodujo localmente porque no dispone de clon Git conectado. No se hicieron pruebas de base, E2E, servicios remotos ni mutaciones de código.

## Sin bloqueantes nuevos / NO TOCAR

- No hay archivos de producción, contratos, migraciones, dependencias ni cambios de comportamiento en esta PR.
- No cambiar tests para fabricar una salida GREEN. El futuro agente deberá probar RED→GREEN reales sobre el camino de producción, con mock de rutas que ejerza la misma llamada.
- Mantener T-363 y los guard de privacidad en la futura implementación.

**Decisiones pendientes:** ninguna en esta revisión. **Paso humano futuro:** habilitar y restringir Routes API en las keys de cada entorno antes de validar en staging/producción.

## Dictamen

**SIN BLOQUEANTES. PR #438 lista para merge según la revisión independiente, en su alcance documental.** No se aprobó ni mergeó.

