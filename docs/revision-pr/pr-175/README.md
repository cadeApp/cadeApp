# Revisión PR #175 — T-323

- **PR:** #175
- **Rama:** `feat/T-323-merchant-map-hardening`
- **SHA funcional R4:** `8ae06d83cf89d3b50988316af54c29fdbee27a42`
- **develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 4
- **Resultado:** **CON BLOQUEANTE (1)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR175-H01 | alto | arreglado-verificado |
| PR175-H02 | medio | arreglado-verificado |
| PR175-H03 | medio | arreglado-verificado |
| PR175-H04 | alto | arreglado-verificado |
| PR175-H05 | alto | arreglado-verificado |
| PR175-H06 | alto | abierto |

## Resumen

H05 quedó corregido y verificado: con `mapId` se usa `AdvancedMarker`; sin `mapId`, `Marker` legacy conserva drag, click/tap y redondeo. El CI exact-head `36947374673` está verde con **1597/1597** tests unitarios y **1614/1614** pruebas de base.

La Ronda 4 detecta un bloqueante de contrato que las rondas anteriores omitieron: `CC-011` sigue siendo el contrato vigente de `src/ui/map.tsx` y especifica la interacción anterior (cámara controlada, `onCameraChanged → onChange`, crosshair y D-pad), mientras T-323 implementa deliberadamente el contrato opuesto. P1 decidió **1-A**: conservar la UX nueva y formalizarla en **CC-014** separado antes de cerrar #175.

P1 decidió **2-A** para la evidencia visual: la validación real de esta versión se ejecutará como gate de la promoción `develop → staging`, no como bloqueo previo de la PR feature, porque el workflow estable solo despliega pushes a `staging`.
