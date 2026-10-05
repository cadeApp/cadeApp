# Lecciones — PR #251 / T-313

- H05 y H06 existían desde rondas anteriores: fueron huecos de la revisión independiente, no regresiones nuevas.
- H07 corrige una sobreafirmación compartida: el artifact permite afirmar “registro falla y luego hay rate-limit”, pero no “SMTP es la causa” sin error Auth concreto.
- H08 recuerda que un body funcional no reemplaza la plantilla obligatoria.
- No se agrega una AG nueva: H05/H06/H07 caen en P08 y H08 ya tiene P19.
