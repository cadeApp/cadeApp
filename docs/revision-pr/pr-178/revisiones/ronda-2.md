# Ronda 2 — PR #178 / CC-014

**Fecha:** 2026-10-01  
**SHA funcional:** `2e8739fb5c406c377c5208d6d70d95f34608148a`  
**Base develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`  
**Resultado:** **CON BLOQUEANTE (1) · MEJORA (1)**

## Cambios desde Ronda 1

Commit funcional del autor:

```text
2e8739f fix(map): isolate camera sync and keep CC-014 API private [CC-014]
```

Comparado contra el commit de revisión R1 `ef353117`, el autor tocó únicamente:
- `docs/contracts/CC-014.md`
- `src/ui/map.tsx`
- `src/ui/map.test.tsx`

No modificó `docs/revision-pr/pr-178/**`.

## PR178-H02 — arreglado-verificado

La suite ya no importa ni ejecuta `resetAuthFailureBridgeForTesting`.

El body reemplazó la afirmación masiva “43 RED” por cuatro corridas dirigidas:
1. `onCameraChanged` persiste en develop.
2. develop no tiene selección por drag.
3. develop no tiene fallback legacy `Marker`.
4. develop todavía renderiza crosshair/D-pad/badge.

Control independiente sobre `develop` y la suite actual:

```text
develop_camera_persists=true
develop_has_crosshair=true
develop_has_dpad=true
develop_has_legacy_marker=false
develop_has_drag_handler=false
final_directed_tests_present=true
body_no_longer_claims_43_behavioral_red=true
```

H02 queda cerrado.

## PR178-H03 — arreglado-verificado

Control independiente:

```text
helper_export_absent=true
test_import_absent=true
non_lifo_test_present=true
external_restore_test_present=true
```

La API pública de producción vuelve a coincidir con CC-014 y el lifecycle del bridge sigue cubierto. H03 queda cerrado.

## PR178-H01 — parcial — el round-trip controlado sigue recentrando

La corrección separó correctamente:

```text
activeCoords
cameraTarget
```

y ahora:
- drag/click cambian solo `activeCoords`;
- GPS/teclado cambian también `cameraTarget`;
- el synchronizer recibe `cameraTarget`.

Eso resuelve el `panTo()` **inmediato**.

Sin embargo, `MapPicker` es un componente controlado en sus consumidores reales.

### Flujo real de onboarding

`src/features/merchants/components/onboarding-form.tsx`:
- L62 observa `defaultPickupLat`;
- L292 monta `MapPicker` con `value`;
- L299-L300, su `onChange` hace `setValue(defaultPickupLat/defaultPickupLng)`.

### Flujo real de request

`src/features/requests/components/create-request-form.tsx`:
- L100 observa `dropoffLat`;
- L403 monta `MapPicker` con `value`;
- L410-L411, su `onChange` hace `setValue(dropoffLat/dropoffLng)`.

### Qué ocurre

En `map.tsx`:
- drag/click → `setActiveCoords(coords)` + `onChange(coords)`;
- el padre acepta el cambio y vuelve a renderizar con `value=coords`;
- el effect de L241-L249 procesa ese `value`;
- L244 ejecuta `setCameraTarget(value)`;
- `MapCameraSynchronizer` recibe el nuevo target y ejecuta `panTo()`.

Harness independiente del flujo controlado:

```text
pans_immediately_after_drag_or_click=0
pans_after_parent_value_roundtrip=1
roundtrip_recenters=true
onboarding_is_controlled=true
request_dropoff_is_controlled=true
direct_tests_assert_no_pan=true
has_controlled_roundtrip_test=false
```

Por lo tanto, el contrato “drag/click seleccionan sin recentrar” todavía no se cumple en los hosts reales.

### Corrección esperada

El sync de props debe distinguir entre:
- una coordenada externa nueva, que sí debe mover `cameraTarget`;
- el eco controlado de la coordenada que MapPicker acaba de emitir, que debe actualizar/confirmar `activeCoords` pero **no** mover `cameraTarget`.

La prueba obligatoria debe montar un wrapper controlado real:
- `value` en estado del padre;
- `onChange={setValue}`;
- disparar drag/click;
- dejar que React procese el rerender;
- afirmar `mockPanTo` = 0 después del round-trip completo.

## PR178-H04 — sigue abierto

El body y el comentario del autor dicen que #171 recibió `bloqueada` y perdió `en-curso`.

Lectura actual del issue:

```text
labels = [P2, fase-3, en-curso]
bloqueada = ausente
```

La mejora no fue aplicada realmente.

## CI exact-head 36952805255

```text
typecheck       success
lint            success
unit            success — 110 files / 1592 tests
build           success
audit           success
db-tests        success — 13 files / 1614 tests
bundle-budget   success

/merchant/onboarding   147 kB OK
/merchant/requests/new 163 kB OK
/design-system         185 kB warning preexistente
```

DB volvió a sufrir rate-limit transitorio de Docker Hub, reintentó y terminó PASS.

## Conclusión

No mergear CC-014 todavía.

H02 y H03 están cerrados. H01 permanece parcialmente abierto por el eco controlado de `value`; H04 sigue pendiente en metadata. Corregir ambos y ejecutar Ronda 3.
