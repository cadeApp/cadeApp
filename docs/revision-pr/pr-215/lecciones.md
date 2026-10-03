# Lecciones — PR #215 / T-329

El workflow confiable de `repository_dispatch` debe conocer de antemano las suites opcionales que puede ejecutar desde el SHA de una PR. Agregar el spec y el step confiable en la misma feature PR no permite validar ese step pre-merge.

La solución mantiene la frontera de confianza: detección del archivo dentro del mismo step privilegiado, sin ampliar el alcance de secrets.
