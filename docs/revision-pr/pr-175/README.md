# Revisión PR #175 — T-323

- **PR:** #175
- **Rama:** `feat/T-323-merchant-map-hardening`
- **SHA funcional R3:** `8a6c8846fe59105f6eac968f3f0e8508297bdc79`
- **develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 3
- **Resultado:** **CON BLOQUEANTE (1)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR175-H01 | alto | arreglado-verificado |
| PR175-H02 | medio | arreglado-verificado |
| PR175-H03 | medio | arreglado-verificado |
| PR175-H04 | alto | arreglado-verificado |
| PR175-H05 | alto | abierto |

## Resumen

La mejora P1 de interacción quedó implementada correctamente en el HEAD: cámara libre, pin real, drag/click discreto, sin D-pad/crosshair/badge y con teclado preservado. H04 fue revalidado con harness independiente y CI exact-head.

Queda un único bloqueante de integración real con Google Maps: `AdvancedMarker` requiere `mapId`, pero el proyecto sigue declarando `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` como opcional y la implementación renderiza AdvancedMarker incluso cuando queda vacío.
