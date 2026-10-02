# Revisión PR #178 — CC-014

- **PR:** #178
- **Rama:** `cc/CC-014-map-picker-hardening`
- **SHA funcional R3:** `ab1dc8b5a234b90ddf01f0c05c6977feab6376c3`
- **develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 3
- **Resultado:** **CON BLOQUEANTE (1)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR178-H01 | alto | parcial |
| PR178-H02 | medio | arreglado-verificado |
| PR178-H03 | medio | arreglado-verificado |
| PR178-H04 | bajo | arreglado-verificado |

## Resumen

La corrección de R3 resuelve el eco controlado inmediato: drag/click actualizan la selección sin tocar `cameraTarget`, y cuando el padre devuelve ese mismo `value`, `sameCoordinates` evita el recentrado. Los dos tests con `ControlledMapPicker` cubren ese round-trip y H04 quedó realmente aplicado en GitHub.

Queda un único residual de H01: una orden externa posterior puede querer volver a una coordenada igual al último `cameraTarget`. Como `MapCameraSynchronizer` deduplica solo por lat/lng, esa orden nueva no produce `panTo()`.

Secuencia adversarial reproducida: **A inicial → drag B → eco B (0 pan) → cambio externo A → 0 pan**, cuando el contrato exige que ese cambio externo legítimo sí sincronice cámara.

CI exact-head `36954731774`: typecheck/lint/unit/build/audit/db-tests/bundle-budget verdes, **1594/1594** unitarios y **1614/1614** DB.
