# Lecciones PR #411 — ronda 1

- **P15 — E2E de terceros puede bloquear el gate de una PR no relacionada.** Un fixture preexistente que usa un identificador fijo (DNI 35999888) dejó un HMAC duradero en Supabase Develop y volvió a colisionar contra la unique constraint. Aislar seeds por corrida, garantizar cleanup propio y no borrar filas ajenas.
- **P08 — La ausencia de ejecución no es un PASS.** Cuando Chromium falla, el script de `e2e-preview` ni siquiera llega al proyecto `global-settings`; registrar cuántos specs propios corrieron en vez de citar solo la existencia del archivo.
- Mantener separación de alcance: un bloqueo real de T-302 se repara en un cambio separado y auditado; no abrir silenciosamente permisos de edición ajenos para hacer pasar #411.
- La guía de acta staging pendiente no es evidencia de validación; no cerrar #356 hasta que el gate E2E y el checkpoint manual reales se completen.