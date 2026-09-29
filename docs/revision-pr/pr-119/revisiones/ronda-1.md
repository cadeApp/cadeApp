# Ronda 1 — PR #119 / T-117

**Fecha:** 2026-09-28  
**SHA revisado:** `28707af32610eb215ccc305086773aee8029de32`  
**Resultado:** **CON BLOQUEANTES (4)**

## Sincronización y alcance

- PR Draft, autor asako669 (P2), 1 commit y 3 archivos modificados.
- Cambios observados: `docs/tasks/log/T-117.md`, `src/features/trips/maps.ts`, `src/features/trips/route-map.test.tsx`.
- Todos están dentro de "Archivos permitidos" de la ficha T-117.
- La ficha se leyó desde `develop`; la PR no modifica `docs/tasks/T-117.md`.
- Durante la revisión, `develop` avanzó de `c91ec4e...` a `c5d2612d...` por T-206. La rama quedó 1 commit por detrás y GitHub la sigue marcando mergeable.
- No existe `docs/revision-pr/pr-119/` previa en la rama; el autor no escribió la carpeta de revisión.

## Evidencia roja reproducida

La corrida de CI del SHA revisado reproduce el estado rojo declarado por la PR:

- `unit`: **9 fallos + 1241 verdes = 1250 tests**. Los 9 fallos pertenecen a `src/features/trips/route-map.test.tsx`.
- `typecheck`: falla porque el fixture agrega `pickupLat` a `TripDetails`, campo todavía inexistente.
- `lint`: verde; el chequeo de formato es advisory y reporta el archivo nuevo entre muchos preexistentes.
- `build`, `db-tests` y `bundle-budget`: verdes.

CI se consultó aquí para reproducir la evidencia roja del autor, no como criterio de aprobación de una ronda que todavía tiene bloqueantes.

## BLOQUEANTES

### PR119-H01 — El control D3/D15 del feed no cubre la superficie que afirma

**Severidad:** alta · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Ubicación:** `src/features/trips/route-map.test.tsx:150-176`

La prueba dice controlar el feed y la PR afirma que verifica `src/features/offers/**`, pero solo lee tres archivos concretos más `queries.ts`. Componentes montados por el feed, por ejemplo `offer-sheet.tsx`, quedan fuera. Además, cada lectura está detrás de `if (fs.existsSync(...))`: si un archivo se mueve, renombra o desaparece, la prueba simplemente deja de verificarlo y continúa verde.

**Mutaciones de revisión:**

- baseline del checker estático: PASS;
- agregar una referencia a `TripRouteMap` y `pickupLat/dropoffLat` en `offer-sheet.tsx`: **PASS — la mutación escapa**;
- eliminar del conjunto uno de los archivos que el test espera leer: **PASS — la ausencia escapa**.

**Corrección requerida:** hacer el control fail-closed y cubrir la superficie de producción del feed. Una forma acotada y mantenible es enumerar recursivamente los `.ts/.tsx` de producción bajo `src/features/offers/**` y la ruta del feed, excluyendo tests, y fallar si la enumeración queda vacía. Complementarlo con un render de `CourierFeed`/DTO que pruebe que no hay mapa, coordenadas ni direcciones exactas en la UI previa a aceptación.

### PR119-H02 — La suite no demuestra "exactamente dos pines unidos por una traza"

**Severidad:** alta · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Ubicación:** `src/features/trips/route-map.test.tsx:179-221`

Las pruebas solo buscan `map-pin-pickup` y `map-pin-dropoff`, y solo prohíben dos testids concretos (`map-pin-courier`, `live-courier-tracking`). Una implementación con un tercer marcador bajo otro identificador seguiría verde. Tampoco existe ninguna aserción sobre la traza orientativa, aunque C06 y el DoD la exigen.

El mock ya expone todos los `AdvancedMarker` como `mock-advanced-marker`, pero la suite nunca hace un conteo. Tampoco hay aserción de `Polyline`/traza.

**Mutación que hoy escaparía:** renderizar retiro + entrega + un tercer `AdvancedMarker` y omitir por completo la traza. Las aserciones actuales seguirían satisfechas.

**Corrección requerida:** afirmar exactamente dos markers y sus posiciones, y una única traza cuyo path sea `[pickup, dropoff]`. Mockear explícitamente la primitiva elegida para la traza (por ejemplo `Polyline`) y comprobar su path.

### PR119-H03 — Solo se prueba `matched`; la navegación puede desaparecer en `in_transit`

**Severidad:** alta · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Ubicación:** `src/features/trips/route-map.test.tsx:97-130,179-259`

Todo el bloque de mapa y botón usa un único fixture con `status: 'matched'`. No hay ningún caso `in_transit`.

Eso permite una implementación como `trip.status === 'matched' && <TripRouteMap ... />` que pasa la suite y hace desaparecer mapa/botón después de "Marcar como retirado", precisamente cuando el cadete todavía necesita llegar al destino. El master plan habilita el enlace tras alcanzar `matched` **o `in_transit`**.

**Mutación que hoy escaparía:** condicionar mapa y enlace a igualdad estricta con `matched`; todas las pruebas actuales de navegación siguen usando `baseTrip.status = 'matched'`.

**Corrección requerida:** agregar un fixture `in_transit` y exigir al menos en R07 que mapa, dos pines, traza, direcciones y "Abrir en Google Maps" sigan presentes. Mantener el feed como la prueba de que nada se revela antes de la aceptación.

### PR119-H04 — Se declara fallback por `onError`, pero nunca se ejecuta el callback

**Severidad:** media · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Ubicación:** `src/features/trips/route-map.test.tsx:16,41-50,262-305`

El mock captura `APIProvider.onError` en `mockOnError`, e incluso se importa `act`, pero ninguna prueba invoca ese callback. Solo se fuerza `APILoadingStatus.FAILED`.

**Mutación que hoy escaparía:** ignorar por completo `APIProvider.onError` y conservar únicamente el watcher de `FAILED`; la suite actual seguiría verde.

**Corrección requerida:** con estado inicialmente `LOADED`, renderizar R07, confirmar que el callback fue registrado, ejecutar `act(() => mockOnError?.())` y comprobar que aparece el fallback mientras direcciones y enlace externo siguen operativos.

## MEJORAS

Ninguna adicional en esta ronda. El foco es endurecer primero la fase roja antes de implementar.

## Nota de implementación para evitar un cambio de contrato innecesario

T-106 ya dejó las coordenadas exactas en `delivery_request_contacts` con RLS que permite lectura al comercio dueño y al cadete de la oferta aceptada. Por lo tanto T-117 puede mantener `src/domain/**`, migraciones y CC-008 intactos:

- ampliar el tipo local `TripDetails` dentro de `src/features/trips/types.ts`;
- completar `src/features/trips/queries.ts` con una lectura server-side de coordenadas y `route_distance_m` después de que `getTripDetailsServer` autorizó el viaje;
- mantener el feed separado y sin esos campos;
- construir el enlace universal en cliente post-match.

Si durante la implementación esa vía no alcanza, recién entonces corresponde detenerse y abrir `contract-change`; no ampliar CC-008 dentro de T-117.

## No revisado / dudas para Lautaro073

- **Decisiones 🔵:** ninguna.
- No se levantó Supabase ni Docker local.
- No se aprobó ni mergeó la PR.
