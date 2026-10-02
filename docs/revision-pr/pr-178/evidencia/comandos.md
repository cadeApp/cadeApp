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
