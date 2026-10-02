# Evidencia — PR #178 / CC-014

## Ronda 1

SHA funcional: `de6e475b3167a72c80d2688712b6e1a74928b55a`  
develop: `1457072a7cac1ae9e2a8a92abe9253d45b745082`.

### Estado de rama

```text
ahead_by=1
behind_by=0
mergeable=true
changed_files_autor=3
```

Archivos del autor:
- `docs/contracts/CC-014.md`
- `src/ui/map.tsx`
- `src/ui/map.test.tsx`

### Harness independiente H01

```text
current_wiring_target_activeCoords=true
drag_changes_activeCoords=true
click_changes_activeCoords=true
executable_drag_causes_panTo=true
executable_click_causes_panTo=true
drag_click_tests_assert_no_panTo=false
```

Modelo ejecutado:
1. target inicial = activeCoords inicial;
2. drag/click cambia activeCoords;
3. el efecto compara target nuevo contra prevTargetRef;
4. detecta diferencia y ejecuta panTo.

### Control de RED H02

```text
final_beforeEach_calls_new_reset_helper=true
develop_exports_reset_helper=false
```

Conclusión: la suite final aplicada sola sobre develop no ofrece un RED conductual limpio porque el setup depende de un export que todavía no existe.

### Enumeración de exports H03

```text
MapCoordinates
AGUILARES_CENTER
AGUILARES_BOUNDS
aguilaresCoordinatesSchema
isWithinAguilaresBounds
MapPickerProps
resetAuthFailureBridgeForTesting   <-- nuevo
MapPicker
```

### Calidad estática independiente

```text
any=false
@ts-ignore/@ts-expect-error=false
.only/.skip=false
setTimeout en tests=false
process.env directo=false
deep import @vis.gl=false
style inline=false
```

### Coordinación H04

Issue #171:
```text
labels: P2, fase-3, en-curso
bloqueada: ausente
```

Issue #177:
```text
label: contract-change
body: Bloquea T-323 (#171, PR #175)
```

### CI exact-head 36949995243

```text
unit: Test Files 110 passed (110)
unit: Tests 1592 passed (1592)
workflow tests: 31
ADR tests: 6

db-tests:
Files=13, Tests=1614
Result: PASS

typecheck success
lint success
build success
audit success
bundle-budget success

/merchant/onboarding 147 kB OK
/merchant/requests/new 163 kB OK
/design-system 184 kB — warning preexistente
```

DB tuvo varios `toomanyrequests: Rate exceeded` de Docker Hub al preparar el entorno, pero los reintentos finalizaron PASS.

## Ronda 2

SHA funcional: `2e8739fb5c406c377c5208d6d70d95f34608148a`.

### Delta desde R1

```text
ef353117..2e8739fb
docs/contracts/CC-014.md
src/ui/map.tsx
src/ui/map.test.tsx
```

El autor no tocó `docs/revision-pr/pr-178/**`.

### H02 — RED dirigido

```text
develop_camera_persists=true
develop_has_crosshair=true
develop_has_dpad=true
develop_has_legacy_marker=false
develop_has_drag_handler=false
final_directed_tests_present=true
body_no_longer_claims_43_behavioral_red=true
```

### H03 — API/lifecycle

```text
helper_export_absent=true
test_import_absent=true
non_lifo_test_present=true
external_restore_test_present=true
```

### H01 — harness de round-trip controlado

Código relevante:
- `map.tsx:238` activeCoords;
- `map.tsx:239` cameraTarget;
- `map.tsx:244` value → setCameraTarget(value);
- `map.tsx:271` handleMarkerDragEnd;
- `map.tsx:286` handleMapClick;
- `map.tsx:495` synchronizer con cameraTarget.

Consumidores:
- onboarding L292/L299-L300: value controlado + setValue en onChange;
- create-request L403/L410-L411: value controlado + setValue en onChange.

Harness:

```text
pans_immediately_after_drag_or_click=0
pans_after_parent_value_roundtrip=1
roundtrip_recenters=true
onboarding_is_controlled=true
request_dropoff_is_controlled=true
direct_tests_assert_no_pan=true
has_controlled_roundtrip_test=false
```

### H04 — metadata actual

```text
issue #171 labels:
P2
fase-3
en-curso

bloqueada: ausente
```

### CI exact-head 36952805255

```text
Test Files 110 passed (110)
Tests 1592 passed (1592)
workflow tests 31
ADR tests 6

db-tests:
Files=13, Tests=1614
Result: PASS

typecheck success
lint success
build success
audit success
bundle-budget success

/merchant/onboarding 147 kB OK
/merchant/requests/new 163 kB OK
/design-system 185 kB warning preexistente
```

## Ronda 3

SHA funcional: `ab1dc8b5a234b90ddf01f0c05c6977feab6376c3`.

### Delta desde revisión R2

```text
edc3f0d..ab1dc8b
docs/contracts/CC-014.md
src/ui/map.tsx
src/ui/map.test.tsx
```

### H04 — metadata verificada

```text
issue #171 labels:
P2
fase-3
bloqueada

en-curso: ausente
```

### H01 — eco controlado corregido

Código:
- `activeCoordsRef` mantiene selección inmediatamente;
- `sameCoordinates` compara por lat/lng;
- drag/click no tocan cameraTarget;
- echo `value === activeCoordsRef` no toca cameraTarget.

Tests:
- ControlledMapPicker drag → 0 panTo;
- ControlledMapPicker click → 0 panTo.

### H01 — control adversarial adicional

Modelo:

```text
A = target inicial
B = selección directa

A inicial
drag/click B
echo controlado B
cambio externo value -> A
```

Resultado con la semántica actual:

```text
pan_calls_after_controlled_echo=[]
pan_calls_after_external_change_back=[]
external_back_pan_missing=true
```

Causa: `MapCameraSynchronizer` deduplica por igualdad numérica de `prevTargetRef` y `targetCoords`. No existe una identidad/version de orden de cámara.

Cobertura actual:

```text
has_direct_controlled_echo_tests=true
has_external_after_direct_selection_test=false
```

### CI exact-head 36954731774

```text
Test Files 110 passed (110)
Tests 1594 passed (1594)
workflow tests 31
ADR tests 6

db-tests:
Files=13, Tests=1614
Result: PASS

typecheck success
lint success
build success
audit success
bundle-budget success

/merchant/onboarding 147 kB OK
/merchant/requests/new 163 kB OK
/design-system 184 kB warning preexistente
```

## Ronda 4

SHA funcional: `3f80a276fb936de6c06ed81030fe6ccedbad4242`.

### Delta desde revisión R3

```text
0c4d82d..3f80a276
docs/contracts/CC-014.md
src/ui/map.tsx
src/ui/map.test.tsx
```

### H01 — control adversarial final

```text
after_controlled_echo=[]
after_external_return_A=[A]
after_same_A_object=[A]
after_manual_B_then_same_incoming_A=[A]
after_external_C=[A,C]

versioned_sync=true
input_dedupe=true
controlled_echo_guard=true
no_fake_tests=true
```

Cobertura observada:
- target anterior tras drag;
- target anterior tras click;
- mismo value numérico;
- mismo defaultZoneCenter tras selección manual;
- defaultZoneCenter realmente distinto;
- value externo;
- GPS;
- teclado;
- marker mapId/no-mapId;
- auth bridge.

### Scope / coordinación

```text
develop...HEAD:
ahead_by=7
behind_by=0
mergeable=true
draft=false

issue #171:
P2
fase-3
bloqueada
en-curso ausente

issue #177:
contract-change
en-review
```

### Calidad estática

```text
any=false
@ts-ignore/@ts-expect-error=false
.only/.skip=false
setTimeout=false
test helper export=false
process.env directo=false
deep import=false
```

### CI exact-head 36956307854

```text
Test Files 110 passed (110)
Tests 1599 passed (1599)
workflow tests 31
ADR tests 6

db-tests:
Files=13, Tests=1614
Result: PASS

typecheck success
lint success
build success
audit success
bundle-budget success

/merchant/onboarding 147 kB OK
/merchant/requests/new 163 kB OK
/design-system 184 kB warning preexistente
```

DB tuvo rate-limit transitorio de Docker Hub durante preparación, con reintentos exitosos.
