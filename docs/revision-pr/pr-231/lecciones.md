# Lecciones — PR #231

**Fuente:** 0 hallazgos bloqueantes o mejoras pendientes.

No se agrega una lección AG nueva: esta PR hace precisamente el contract-change que faltaba en PR #218 y formaliza antes del merge una ampliación de semántica detectada por la revisión.

## Observación

La separación funcionó como estaba diseñada:

1. T-326 introdujo una tercera procedencia de coordenadas.
2. La revisión detectó que CC-017 solo autorizaba derivado o NULL.
3. Se detuvo T-326.
4. Lautaro073 tomó la decisión de producto.
5. CC-020 la formaliza antes de retomar T-326.

No hay un patrón nuevo que justifique otra regla; es aplicación correcta de la skill `contract-change`.
