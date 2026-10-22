# Informe de revisión — PR #139 / T-317 — Ronda 5

**SHA:** `8b347e4c64d147d9ec6702bfaf68057fa027d867`  
**Resultado:** CON BLOQUEANTES (1)

La evidencia real en `cadeapp-staging` pasó login, rol admin y `mfa.enroll()`, pero la herramienta devolvió `QR_FORMAT` antes de escribir el archivo.

## PR139-H13

La versión instalada de Supabase JS concatena el SVG crudo al prefijo `data:image/svg+xml;utf-8,`. Supabase Auth genera el SVG con SVGo, cuyo preámbulo incluye declaración XML y comentario antes de `<svg`. El parser exigía `startsWith('<svg')` después de aplicar `decodeURIComponent`, por lo que el formato oficial era rechazado.

Se pidió:
- quitar solo el prefijo exacto;
- preservar el XML crudo;
- aceptar preámbulo XML permitido antes de una raíz SVG;
- mantener fail-closed para raw/base64/basura;
- agregar fixture fiel al proveedor y RED por mutación inversa;
- ajustar la redacción de la ficha sin exponer QR/secret/uri.
