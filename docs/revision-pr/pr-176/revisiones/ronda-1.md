# Ronda 1 — PR #176 / T-323

**Fecha:** 2026-10-01  
**SHA funcional:** `12e7a477f18ac5c4406d944d67c2d45e8ed3d8a9`  
**Resultado:** **SIN BLOQUEANTES**

## Verificación

- La ampliación surge de una decisión explícita de P1 durante la validación manual de staging.
- El objetivo nuevo está acotado al mismo componente y archivos ya permitidos.
- Se especifica el problema observable: loop controlado `onCameraChanged → onChange → value → center`, pin/crosshair poco directo, D-pad intrusivo y badge técnico.
- El DoD nuevo exige eventos discretos para persistir coordenadas, pin real/draggable, tap/click, eliminación del D-pad/badge visual y conservación de accesibilidad por teclado.
- No agrega dependencias, migraciones, secretos ni cambios de DB/RLS.
- El primer DoD queda sincronizado exactamente con la fila T-323 del plan.

No hay hallazgos ni decisiones pendientes.
