# Ronda 2 — PR #175 / T-323

**Fecha:** 2026-10-01  
**SHA funcional:** `04133f01d6a1b42142336ce3bd97db20a2bbd98e`  
**develop vigente:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`  
**Resultado:** **CON BLOQUEANTE (1)**

## Inicio de ronda

- El autor no modificó `docs/revision-pr/pr-175/**` después de la Ronda 1.
- Commits funcionales desde R1: `ce4b014...` + bitácora `04133f0...`.
- Antes del cambio de alcance, el exact-head CI `36942523962` quedó completamente verde.
- PR #176 formalizó posteriormente la decisión P1 sobre UX y fue mergeada a develop.
- Estado actual de rama: `ahead_by=6`, `behind_by=3`, status `diverged`. Debe mergear `origin/develop`, nunca rebase/force/amend.

## Revalidación de Ronda 1

### PR175-H01 — arreglado-verificado

Ahora el bloqueo deriva de las coordenadas efectivas:

```ts
const effectiveLat = defaultPickupLat ?? selectedZoneCenter?.lat ?? null;
const effectiveLng = defaultPickupLng ?? selectedZoneCenter?.lng ?? null;
const hasInvalidEffectiveCoords =
  effectiveLat != null &&
  effectiveLng != null &&
  !isWithinAguilaresBounds(effectiveLat, effectiveLng);
```

`coordsError` ya no forma parte del booleano de bloqueo.

Harness independiente:

```text
H01_PASS current=false, mutation_caught=true
```

La mutación que reintroduce `coordsError === mapOutOfAguilares` vuelve a bloquear el fallback y fue detectada.

### PR175-H02 — arreglado-verificado

El handler global fue reemplazado por un bridge de módulo con `Set` de listeners. El último cleanup restaura el handler externo solo si el global sigue siendo el bridge instalado.

Harness independiente:

```text
H02_PASS non_lifo=[B,external], external_restored=true
H02_MUTATION_CAUGHT=true
```

Esto cubre el caso no-LIFO que fallaba en R1.

### PR175-H03 — arreglado-verificado

Body y bitácora distinguen ahora:
- cobertura heredada GREEN: key vacía, `APIProvider.onError`, `APILoadingStatus.FAILED`, offline/online;
- RED nuevos T-323: `gm_authFailure`, fallback manual, H01 y H02.

No se sigue atribuyendo RED nuevo a cobertura que ya existía en T-116.

## PR175-H04 — ALTO — nuevo DoD P1 de UX no implementado

La ficha vigente en develop exige:

1. pan/zoom fluido sin loop `onCameraChanged → onChange → value → center`;
2. pin real/draggable;
3. click/tap en mapa para seleccionar;
4. coordenadas persistidas solo en eventos discretos;
5. retirar D-pad flotante de 10 m y badge técnico de lat/lng de la UI móvil normal;
6. conservar ajuste por teclado para accesibilidad;
7. RED/mutaciones para este contrato.

El HEAD `04133f01d6a1b42142336ce3bd97db20a2bbd98e` aún hace lo contrario:

```tsx
const handleCameraChange = (...) => {
  ...
  setActiveCoords(rounded);
  onChangeRef.current?.(rounded);
};

<GoogleMap
  center={activeCoords}
  ...
  onCameraChanged={handleCameraChange}
/>
```

y mantiene:
- `data-testid="map-crosshair"`;
- `data-testid="map-fine-adjustment"` con 4 botones y etiqueta `10m`;
- `data-testid="map-coords-badge"`.

Es exactamente la interacción que produjo la mala UX observada manualmente en staging.

Este hallazgo se clasifica `origen=ficha`: el agente terminó R1 antes de que P1 ampliara el contrato; no es una omisión respecto de la ficha anterior.

## CI exact-head funcional 36942523962

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

Los warnings preexistentes de rutas admin y `/design-system` no pertenecen a T-323.

## Conclusión

H01-H03 cerrados. H04 bloquea el merge hasta incorporar la UX decidida por P1 y sincronizar develop.
