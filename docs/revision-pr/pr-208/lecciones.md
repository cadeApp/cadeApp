# Lecciones — PR #208 / CC-016

## Ronda 1

No se crea un AG nuevo.

Se refuerza un patrón ya visto en PR #160 y PR #181: un CI GREEN deja de ser evidencia de integración cuando develop avanza después del merge-base usado por ese run.

También se reafirma la regla de no certificar evidencia RED que no se ejecutó de forma independiente. Cuando el runtime de revisión no está disponible, se registra la limitación y se distingue inspección estática de verificación ejecutada.

## Ronda 2

No se crea un AG nuevo.

- H01 queda cerrado por la misma disciplina de AG-71/P15: volver a comparar el target justo antes de declarar readiness y exigir CI sobre la integración vigente.
- El `e2e-preview` rojo no debe interpretarse solo por color: el contenido del resolver demuestra que es el bloqueo diseñado para PRs con migraciones (`BLOCKED / REQUIRES DEVELOP MIGRATION`).
- La batería RED ejecutada por el autor fue la prescripta por la revisión anterior; se conserva la distinción entre esa evidencia y una reproducción independiente, que no fue posible por falta de resolución de red del entorno.
