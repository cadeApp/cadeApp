# Lecciones de la PR #298

## Ronda 1

El patrón dominante es **P08-control-no-cubre-lo-que-dice**: DOM sin red, wrapper que no distingue fallback y requisitos detrás de ramas opcionales. H04 es **P04-test-tautologico** puro.

Un fail-closed de entorno no es una fase RED funcional: RED debe romper la propiedad que el test dice proteger y fallar por esa propiedad.

No se propone AG nueva; P04 y P08 ya cubren la causa raíz.
