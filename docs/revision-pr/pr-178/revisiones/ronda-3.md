# Ronda 3 — PR #178 / CC-014

**Fecha:** 2026-10-01  
**SHA funcional:** `ab1dc8b5a234b90ddf01f0c05c6977feab6376c3`  
**Base develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`  
**Resultado:** **CON BLOQUEANTE (1)**

## Delta desde R2

Desde el commit documental R2 `edc3f0d`, el autor modificó únicamente:

- `docs/contracts/CC-014.md`
- `src/ui/map.tsx`
- `src/ui/map.test.tsx`

No tocó `docs/revision-pr/pr-178/**`.

## PR178-H04 — arreglado-verificado

Lectura independiente de issue #171:

```text
P2
fase-3
bloqueada
```

`en-curso` ya no está presente. H04 queda cerrado.

## PR178-H02 / H03 — revalidados

- H02: body mantiene RED dirigido, sin volver a la afirmación masiva enmascarada por setup.
- H03: `resetAuthFailureBridgeForTesting` sigue ausente de producción y tests.
- lifecycle no-LIFO/restauración externa permanece cubierto.

## PR178-H01 — parcial

### Parte corregida

El HEAD actual introdujo:

```ts
const activeCoordsRef = React.useRef<MapCoordinates>(fallbackCenter);

function sameCoordinates(a, b) {
  return a.lat === b.lat && a.lng === b.lng;
}
```

Drag/click actualizan `activeCoordsRef` antes de emitir `onChange`.

El effect de props:

```ts
const isEcho = sameCoordinates(next, activeCoordsRef.current);
updateActiveCoords(next);
if (!isEcho) {
  setCameraTarget(next);
}
```

evita que el eco controlado de la selección directa vuelva a mover la cámara.

Los dos tests `ControlledMapPicker` ejercen el round-trip real y comprueban 0 `panTo`.

### Residual encontrado por control adversarial

`MapCameraSynchronizer` sigue deduplicando únicamente por coordenadas:

```ts
if (
  prevTargetRef.current.lat !== targetCoords.lat ||
  prevTargetRef.current.lng !== targetCoords.lng
) {
  prevTargetRef.current = targetCoords;
  map.panTo(targetCoords);
}
```

Secuencia válida:

1. Estado inicial: selección A, `cameraTarget=A`, último target sincronizado A.
2. Drag/click a B: selección B, cámara no se sincroniza.
3. Padre devuelve B: eco controlado, correctamente ignorado para cámara.
4. Más tarde una fuente externa cambia `value` de B a A.
5. El effect detecta que A difiere de la selección B y solicita `setCameraTarget(A)`.
6. Pero el último target de cámara ya era A; el synchronizer compara A vs A y **no llama `panTo`**.

Harness independiente:

```text
initial_camera_target=A
direct_selection=B
pan_calls_after_controlled_echo=[]
external_change_back_to_A=A
pan_calls_after_external_change_back=[]
external_back_pan_missing=true

has_direct_controlled_echo_tests=true
has_external_after_direct_selection_test=false
```

El problema ya no es distinguir el eco: ahora falta distinguir **una orden nueva de sincronización** de la mera igualdad numérica del target.

### Corrección esperada

Modelar la sincronización de cámara como comando/evento, no solo como coordenada. Una orden externa permitida debe poder ejecutar `panTo(A)` aunque A coincida con el último target guardado.

Patrón recomendado:
- mantener `cameraTarget`;
- agregar una revisión/contador `cameraSyncVersion`;
- encapsular las órdenes permitidas en `requestCameraSync(coords)`, que actualice target e incremente versión;
- `MapCameraSynchronizer` debe ejecutar `panTo` cuando la versión cambie, no deduplicar únicamente por lat/lng;
- drag/click y sus ecos no incrementan versión;
- cambios externos reales, GPS y teclado sí.

Agregar tests que combinen:
- drag B → eco B → externo A → `panTo(A)`;
- click B → eco B → externo A → `panTo(A)`.

## CI exact-head 36954731774

```text
typecheck       success
lint            success
unit            success — 110 files / 1594 tests
build           success
audit           success
db-tests        success — 13 files / 1614 tests
bundle-budget   success

/merchant/onboarding   147 kB OK
/merchant/requests/new 163 kB OK
/design-system         184 kB warning preexistente
```

DB volvió a tener rate-limit transitorio de Docker Hub, reintentó y terminó PASS.

## Conclusión

No mergear CC-014 todavía.

H02, H03 y H04 están cerrados. H01 conserva un único caso residual de sincronización externa hacia el target anterior. Corregir ese caso y ejecutar Ronda 4.
