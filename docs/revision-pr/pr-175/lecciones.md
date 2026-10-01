# Lecciones — PR #175 / T-323

## Ronda 1

No se agrega número AG nuevo en esta ronda.

- **H01 refuerza P05 y AG-37:** un string de presentación como `coordsError` no debe convertirse en la fuente de verdad del invariante de bloqueo. Hay que enumerar todos los productores/limpiadores y derivar el bloqueo desde el dato canónico actual.
- **H02 refuerza P08 y AG-37:** un test de “preservar/restaurar handler global” con una sola instancia no cubre ownership concurrente. Para un callback global de slot único hay que probar montaje/desmontaje no-LIFO o usar una capa de subscripción.
- **H03:** la cobertura heredada puede y debe seguir verde; no se etiqueta como RED nuevo. La evidencia de TDD separa “regresión que ya existía” de “caso nuevo que falló antes del arreglo”.
