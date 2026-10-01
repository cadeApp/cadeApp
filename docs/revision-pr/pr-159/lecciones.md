# Lecciones — PR #159 (T-321)

## Ronda 1

H01 confirmó `P08-control-no-cubre-lo-que-dice`: observar estado final después de seed no prueba una garantía de migración.

## Ronda 2

H03 confirmó pr-68/AG-75 y pr-64/AG-61. La revisión anterior había prescrito un checker textual vulnerable a comentarios señuelo.

## Ronda 3

No se agrega AG nuevo.

### PR159-H05 — dejar de perseguir semántica SQL con regex

El checker endurecido ya distingue comentarios y statement objetivo, pero una propiedad semántica global —“esta migración nunca pisa una configuración existente”— no queda demostrada por validar la forma de un único `INSERT`.

M05/M06 preservan ese INSERT perfecto y agregan otra escritura destructiva; el control sigue verde.

La lección es aplicación directa de **pr-68/AG-75**: cuando el riesgo es de comportamiento, la batería independiente debe mutar el comportamiento completo. Para T-321, la prueba adecuada es ejecutar la migración pendiente sobre cinco valores preexistentes y comprobar que sobreviven intactos.
