# Ronda 4 — PR #175 / T-323

**Fecha:** 2026-10-01  
**SHA funcional:** `8ae06d83cf89d3b50988316af54c29fdbee27a42`  
**Base develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`  
**Resultado:** **CON BLOQUEANTE (1)**

## Inicio de ronda

- PR Draft, mergeable, 13 commits ahead / 0 behind respecto de `develop`.
- El delta funcional posterior a R3 es `bfe13a6` (`src/ui/map.tsx` + `src/ui/map.test.tsx`) y la bitácora `8ae06d8`.
- El autor no modificó la carpeta de revisión después del commit documental de R3; los cambios visibles en `docs/revision-pr/pr-175/**` provienen de la propia revisión.
- No hay desvíos de los “Archivos permitidos” de T-323.
- CI exact-head `36947374673` completamente verde.

## Revalidación H01–H04

Los arreglos anteriores siguen presentes en el SHA actual:

- H01: el bloqueo de onboarding deriva de coordenadas efectivas, no de `coordsError`.
- H02: el bridge de `gm_authFailure` mantiene ownership por `Set` y no fue alterado por H05.
- H03: body/bitácora continúan separando cobertura heredada GREEN de RED nuevos.
- H04: `onCameraChanged` no persiste, drag/click sí; no reaparecieron crosshair, D-pad ni badge y el teclado sigue activo.

El CI exact-head vuelve a cubrir estas rutas y queda verde.

## PR175-H05 — arreglado-verificado

El arreglo implementa las dos configuraciones públicas válidas:

1. `mapId` presente → `AdvancedMarker` draggable con pin personalizado.
2. `mapId` vacío/ausente → `Marker` legacy draggable.

Ambas variantes comparten `handleMarkerDragEnd`, por lo que conservan extracción, redondeo a 6 decimales y una única llamada a `onChange`. Los tests capturan props reales de ambos mocks y ejercen `onDragEnd`, `disabled` y click/tap.

Control adversarial independiente sobre R3 vs R4:

```text
H05_OLD_RED_PROPERTY=true
H05_CURRENT_GREEN_PROPERTY=true
H05_CONTROL_EXERCISES_BOTH_VARIANTS=true
```

La propiedad que fallaba en R3 — AdvancedMarker incondicional con `mapId` vacío — desaparece y el control actual contempla ambas ramas.

## PR175-H06 — ALTO — contrato compartido vigente contradice la implementación

Este hallazgo es un agujero de las rondas anteriores.

`AGENTS.md §1.4` establece que `src/ui/**` es contrato y no debe cambiarse dentro de una tarea normal; si el contrato no alcanza, corresponde la skill `contract-change`.

Sin embargo, `docs/contracts/CC-011.md` sigue vigente y define para `MapPicker`:

- `center={activeCoords}` como cámara controlada;
- `onCameraChanged` notificando coordenadas a `onChange`;
- crosshair central fijo;
- D-pad de ajuste fino visible.

El SHA actual implementa deliberadamente lo contrario:

- `defaultCenter={fallbackCenter}`;
- `handleCameraChange` no persiste selección;
- selección por drag del marcador y click/tap;
- sin crosshair ni D-pad;
- además agrega el bridge de `gm_authFailure` y fallback `AdvancedMarker → Marker`.

Los propios tests todavía se titulan “CC-011 · Contrato compartido de mapa” mientras hacen cumplir el comportamiento opuesto al documento CC-011.

Harness de consistencia:

```text
ccControlled=true
curControlled=false
curDefault=true
ccCameraPersist=true
curCameraPersist=false
ccCrosshair=true
curCrosshair=false
ccDpad=true
curDpad=false
TEST_SUITE_LABELS_ITSELF_CC011=true
TESTS_ENFORCE_OPPOSITE_OF_CC011=true
CC011_DRIFT_CAUGHT=true
```

PR #176 sí formalizó la decisión P1 dentro de T-323 y del plan de implementación, pero **no** fue un `contract-change`: no tocó `docs/contracts/CC-011.md` ni creó un contrato sucesor.

### Decisión P1

**1-A:** mantener la UX nueva y crear **CC-014** separado. El contract-change debe absorber el contrato compartido deseado de `MapPicker` y mergearse a `develop` antes de cerrar T-323. No se revierte la UX a CC-011.

## Evidencia manual de staging — decisión P1

**2-A:** la validación visual de la versión final pasa a ser gate de promoción `develop → staging`, no bloqueante de esta PR antes del merge.

Motivo operativo: `.github/workflows/deploy.yml` despliega staging únicamente tras un `push` a la rama `staging`; una feature branch no actualiza el staging estable. Por lo tanto, exigir esa evidencia antes de integrar el contrato canónico crearía un mecanismo especial ajeno al flujo normal.

La validación visual sigue siendo obligatoria **antes de `staging → main`** y debe cubrir:
- pan/zoom fluido;
- pin visible y draggable;
- click/tap reposicionando;
- fallback sin `mapId`;
- degradación de Google Maps sin bloquear dirección manual.

## CI exact-head 36947374673

```text
typecheck       success
lint            success
unit            success — 110 files / 1597 tests
build           success
audit           success
db-tests        success — 13 files / 1614 tests
bundle-budget   success

/merchant/onboarding   147 kB OK
/merchant/requests/new 163 kB OK
/design-system         184 kB warning preexistente
```

El warning de `/design-system` permanece fuera del alcance de T-323.

## Conclusión

H05 queda cerrado. **No mergear #175 todavía.**

El único bloqueante actual es H06: crear y mergear CC-014 desde `develop`, luego incorporar `develop` a `feat/T-323-merchant-map-hardening` mediante merge (nunca rebase), resolver `src/ui/map.tsx` y sus tests a favor del contrato canónico ya mergeado, revalidar H01–H05 y hacer Ronda 5.
