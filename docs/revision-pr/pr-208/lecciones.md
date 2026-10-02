# Lecciones — PR #208 / CC-016

## Ronda 1

No se crea un AG nuevo.

Se refuerza un patrón ya visto en PR #160 y PR #181: un CI GREEN deja de ser evidencia de integración cuando develop avanza después del merge-base usado por ese run.

También se reafirma la regla de no certificar evidencia RED que no se ejecutó de forma independiente. Cuando el runtime de revisión no está disponible, se registra la limitación y se distingue inspección estática de verificación ejecutada.
