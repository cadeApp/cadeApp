# Evidencia — PR #119 / ronda 1

SHA revisado: `28707af32610eb215ccc305086773aee8029de32`.

## 1. Alcance

Diff observado:

- `docs/tasks/log/T-117.md`
- `src/features/trips/maps.ts`
- `src/features/trips/route-map.test.tsx`

Los tres paths están permitidos por T-117.

## 2. Estado del branch frente a develop

Al momento de revisar:

- `develop = c5d2612d211469468ec1ee465939c4b46fa9a6ba`
- `HEAD PR = 28707af32610eb215ccc305086773aee8029de32`
- compare: `diverged`, ahead 1, behind 1
- merge base: `c91ec4e304de0d983cd31be3c77acecf374304bf`
- GitHub: `mergeable=true`

## 3. Reproducción de la fase roja

Workflow CI del SHA `28707af32610eb215ccc305086773aee8029de32`, run 36465157728:

- unit: 1 archivo fallando / 93 verdes; 9 tests fallan / 1241 pasan (1250 total).
- los 9 fallos son de `src/features/trips/route-map.test.tsx`.
- typecheck: `route-map.test.tsx(113,5) TS2561`, `pickupLat` no existe aún en `TripDetails`.
- lint: `✔ No ESLint warnings or errors`.
- db-tests: verde.
- build: verde.
- bundle-budget: verde.

Esta consulta de CI se usó para reproducir el rojo declarado; no para aprobar la ronda.

## 4. Harness independiente de mutaciones del instrumento

Se reprodujo la lógica de los dos tests estáticos de feed contra los contenidos del SHA y se inyectaron mutaciones en memoria.

Resultado:

```text
baseline_static_checks: PASS
mutation_in_offer_sheet_unscanned: PASS (mutation escaped)
mutation_delete_scanned_file: PASS (missing file escaped)
trace_assertion_present: false
exact_marker_count_assertion_present: false
in_transit_test_present: false
mock_on_error_invoked: false
```

### Mutación H01

Se agregó solo en memoria a `src/features/offers/components/offer-sheet.tsx` una referencia a `TripRouteMap` y campos `pickupLat/dropoffLat`. El checker actual sigue PASS porque ese archivo no está entre los paths de las líneas 152-156.

Segunda mutación: se retiró del mapa de archivos `courier-feed.tsx`. El checker sigue PASS porque `existsSync` equivale a "si existe, revisar"; no existe una aserción de existencia.

### Mutación H02

La batería actual exige la presencia nominal de `map-pin-pickup` y `map-pin-dropoff`, pero no consulta `mock-advanced-marker` ni una traza. Por tanto, añadir un tercer marker con otro testid y omitir la traza no contradice ninguna aserción.

### Mutación H03

Todas las renderizaciones de mapa usan `baseTrip.status = 'matched'`. Condicionar el mapa y el enlace a `trip.status === 'matched'` no altera ningún caso actual; no hay fixture `in_transit`.

### Mutación H04

`mockOnError` se captura en el mock de `APIProvider`, pero no se invoca. Quitar el manejo del callback y conservar solo `APILoadingStatus.FAILED` no altera los casos actuales.

## 5. Controles a repetir en ronda 2

La revisión debe atacar con mutaciones propias, como mínimo:

1. insertar una fuga de mapa/coordenadas en un hijo del feed no listado originalmente: el control debe ponerse rojo;
2. añadir un tercer `AdvancedMarker`: rojo;
3. suprimir la traza: rojo;
4. renderizar el mapa solo en `matched`: el caso `in_transit` debe ponerse rojo;
5. ignorar `APIProvider.onError`: el caso explícito de callback debe ponerse rojo.

No se levantó Supabase ni Docker.
