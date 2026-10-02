# Ronda 3 — PR #175 / T-323

**Fecha:** 2026-10-01  
**SHA funcional:** `8a6c8846fe59105f6eac968f3f0e8508297bdc79`  
**Base develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`  
**Resultado:** **CON BLOQUEANTE (1)**

## Inicio de ronda

- La rama ya incorporó `origin/develop` y está 10 commits ahead / 0 behind.
- El autor no modificó `docs/revision-pr/pr-175/**` después de Ronda 2.
- Archivos funcionales nuevos de R3: `src/ui/map.tsx`, `src/ui/map.test.tsx` y bitácora; el merge trae la ampliación documental #176.
- No hay desvíos de archivos permitidos.

## Revalidación H01–H03

Los arreglos previos siguen presentes sobre el nuevo HEAD:
- H01: el bloqueo de comercio deriva de coordenadas efectivas y no de `coordsError`;
- H02: el bridge global de `gm_authFailure` con `Set` permanece intacto;
- H03: body/bitácora siguen separando regresión heredada GREEN de RED nuevos.

El exact-head CI vuelve a ejecutar todas las suites relacionadas y queda verde.

## PR175-H04 — arreglado-verificado

La UX ampliada por P1 está implementada:

- `GoogleMap` usa `defaultCenter` en lugar de `center` controlado;
- `handleCameraChange` es no-op respecto de la selección;
- `AdvancedMarker` actualiza en `onDragEnd`;
- `GoogleMap.onClick` actualiza el pin;
- D-pad, badge y crosshair fijo desaparecieron;
- las flechas de teclado siguen ajustando de forma discreta.

### Verificación independiente

`node /tmp/pr175_r3_harness.mjs`:

```text
H04_PASS camera=0 drag=1 click=1
H04_MUT_CAMERA_CAUGHT=true
H04_MUT_DRAG_CAUGHT=true
H04_MUT_CLICK_CAUGHT=true
```

El harness reproduce los handlers finales y demuestra que las mutaciones solicitadas rompen el contrato.

Los tests del autor además verifican ausencia de `map-crosshair`, `map-fine-adjustment`, `map-coords-badge` y los cuatro botones visibles.

## PR175-H05 — ALTO — AdvancedMarker requiere mapId pero mapId sigue siendo opcional

El proyecto define actualmente:

```ts
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().optional().default('')
```

y `.env.example` lo documenta como “ID de Mapa opcional”.

El nuevo `MapPicker` convierte un valor vacío en `undefined`:

```ts
const mapId = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;
```

pero renderiza `AdvancedMarker` siempre:

```tsx
<GoogleMap mapId={mapId} ...>
  <AdvancedMarker ... />
</GoogleMap>
```

El contrato oficial de `@vis.gl/react-google-maps` para `AdvancedMarker` exige que el `Map` tenga un `mapId` (los advanced markers solo funcionan en mapas con cloud-based map styling).

Esto deja una configuración actualmente válida del proyecto — API key presente + map ID vacío — en un estado donde el mapa puede cargar pero el nuevo pin draggable no está soportado.

### Por qué los tests no lo detectan

El mock de `@vis.gl/react-google-maps` en `map.test.tsx` implementa `AdvancedMarker` como un `<div>` sin ninguna relación con `mapId`. Por eso las 1593 pruebas pueden quedar verdes aunque el SDK real rechace ese uso.

Harness de contrato:

```text
H05_MAP_ID_CONTRACT_CAUGHT=true
```

### Clase enumerada

Se revisaron las dos configuraciones públicas válidas:
1. `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` no vacío → AdvancedMarker soportado.
2. `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` vacío → configuración permitida por schema/.env.example, pero AdvancedMarker no soportado.

No hay una rama de fallback en el HEAD actual.

## CI exact-head 36945662064

```text
typecheck       success
lint            success
unit            success — 110 files / 1593 tests
build           success
audit           success
db-tests        success — 13 files / 1614 tests
bundle-budget   success
/merchant/onboarding   147 kB — OK
/merchant/requests/new 163 kB — OK
```

Los warnings preexistentes de rutas admin y `/design-system = 184 kB` quedan fuera de T-323.

## Residual manual

La API key ya fue configurada manualmente por P1 en Vercel y el mapa actual de staging carga correctamente. La prueba visual de **esta nueva UX** sigue pendiente hasta promover la PR corregida.

## Conclusión

H04 queda cerrado. H05 bloquea el merge hasta que el pin draggable funcione también cuando el map ID opcional no está configurado, o hasta que se cambie formalmente el contrato de entorno. Para T-323, la solución preferida es preservar el contrato opcional y agregar fallback técnico.
