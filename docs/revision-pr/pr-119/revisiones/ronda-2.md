# Ronda 2 — PR #119 / T-117

**Fecha:** 2026-09-28  
**SHA revisado:** `d1272cc67b92a2582ca4112cabbda4e97ca9b993`  
**Resultado:** **CON BLOQUEANTES (1)**

## Sincronización y CI

- HEAD remoto revisado: `d1272cc67b92a2582ca4112cabbda4e97ca9b993`.
- La rama está al día con `develop` (`c8be7ab2...`): ahead 6, behind 0.
- GitHub reporta mergeable.
- CI run `36490612282`: success.
- Unit: **100 archivos / 1326 tests verdes**.
- typecheck, lint, build, db-tests y bundle-budget: verdes.

## Cierre de hallazgos de ronda 1

### PR119-H01 — arreglado-verificado
El control del feed ahora enumera recursivamente producción bajo `src/features/offers/**` y `src/app/(courier)/courier/feed/**`, exige roots existentes/no vacíos y agrega render real de `CourierFeed` + R05. La mutación documentada de `pickupLat` en `offer-sheet.tsx` fue detectada.

### PR119-H02 — arreglado-verificado
La suite cuenta exactamente dos `mock-advanced-marker`, valida sus posiciones y comprueba una `Polyline` con path pickup→dropoff. Las mutaciones de tercer marker y traza ausente fueron detectadas.

### PR119-H03 — arreglado-verificado
Hay fixture explícito `in_transit` para R07 y C06. La mutación que ocultaba el mapa fuera de `matched` fue detectada.

### PR119-H04 — arreglado-verificado
La suite invoca `mockOnError` bajo `act` y comprueba fallback, direcciones y enlace. La mutación que neutralizaba `onError` fue detectada.

## Nuevo bloqueante

### PR119-H05 — El fallback de navegación altera las direcciones con una localidad hardcodeada

**Severidad:** media · **Patrón:** P03-hardcode-entorno  
**Ubicación:** `src/features/trips/components/trip-route-map.tsx:114-125,268-272`

Cuando faltan coordenadas, el componente construye el enlace con:

- `${pickupAddress}, Aguilares, Tucumán`
- `${dropoffAddress}, Aguilares, Tucumán`

y C06 muestra además un pie fijo `Aguilares, Tucumán`.

Eso es innecesario y puede generar una ruta incorrecta si `pickupAddress` o `dropoffAddress` ya contienen localidad/provincia, o si la plataforma opera fuera de ese literal. El contrato post-match ya entrega las direcciones que deben usarse. El propio test de serialización textual demuestra que `buildGoogleMapsDirectionsUrl` acepta texto tal cual, pero falta un test de integración del fallback sin coordenadas.

**Corrección requerida:**

1. En `TripRouteMap`, cuando no haya coordenadas, usar `pickupAddress` y `dropoffAddress` **tal cual** como origin/destination.
2. Eliminar el texto fijo `Aguilares, Tucumán` del pie C06; reemplazarlo por copy neutro derivado del viaje o quitar ese fragmento si no aporta información.
3. Agregar un caso de integración con coordenadas `null` y direcciones ya completas, y afirmar que el href contiene exactamente esas direcciones codificadas una sola vez, sin sufijo agregado.
4. Mutación RED: reintroducir temporalmente el sufijo `, Aguilares, Tucumán` y comprobar que el nuevo test falla.

## Observaciones no bloqueantes

- `TripDetails` dejó los cinco campos nuevos como opcionales. Es compatible con fixtures anteriores y el componente maneja ausencia; no se abre hallazgo.
- `strokeColor="#0B7A7D"` coincide exactamente con el token documentado `--primary-dark`; no se considera color inventado.
- La evidencia visual está presente en las dos resoluciones requeridas y estado degradado.

No hay decisiones 🔵 pendientes.
