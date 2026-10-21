# Lecciones PR #477 — T-388
- Refuerzo de P08 y pr-62/AG-58: una coincidencia textual de varias proyecciones no valida cada consulta realmente ejecutada. Es necesario observar el .select() concreto.
- Refuerzo de P08 y pr-64/AG-61: una regex sobre fuente JSX puede aprobar código dentro de un comentario. Verificar la UI renderizada y mutar el render.
- Refuerzo de pr-68/AG-75: las mutaciones del autor no reemplazan una batería independiente por cada lector.
No se asigna un AG nuevo sin verificar el máximo de todas las ramas remotas.

## Ronda 2
H01/H02 tienen ahora pruebas dinámicas por lector y render real; el fallo del E2E manual se registró como incidencia separada (#478), no como causa adjudicada al PR. El gate automático cancelado no es un GREEN y no se debe llamar «flaky preexistente confirmado» sin evidencias comparables.
