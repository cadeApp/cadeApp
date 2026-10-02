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
