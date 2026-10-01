# Lecciones — PR #159 (T-321)

## Ronda 1

H01 confirmó `P08-control-no-cubre-lo-que-dice`: observar estado final después de seed no prueba una garantía de migración.

## Ronda 2

H03 confirmó pr-68/AG-75 y pr-64/AG-61. La revisión anterior había prescrito un checker textual vulnerable a comentarios señuelo.

## Ronda 3

### PR159-H05 — dejar de perseguir semántica SQL con regex

El checker endurecido ya distinguía comentarios y statement objetivo, pero una propiedad semántica global —“esta migración nunca pisa una configuración existente”— no queda demostrada por validar la forma de un único `INSERT`.

M05/M06 preservaban ese INSERT perfecto y agregaban otra escritura destructiva; el control seguía verde.

La lección es aplicación directa de **pr-68/AG-75**: cuando el riesgo es de comportamiento, la batería independiente debe mutar el comportamiento completo.

## Ronda 4

No se agrega AG nuevo.

El cierre de H05 confirma que la solución adecuada era observar estado antes/después de la migración real. El mismo control runtime cubre distintas sintaxis destructivas porque no intenta reconocer SQL: verifica el efecto persistido sobre los cinco valores operativos.

La combinación que queda es:

- **base previa + valores personalizados + migration up + preservación**, para no-sobrescritura;
- **base fresca sin seed + pgTAP**, para presencia/valor/tipo de defaults;
- **suite completa normal**, para regresiones del resto de la base.
