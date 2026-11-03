# Lecciones — PR #584 / T-402 — ronda 1

## Patrones observados

**PR584-H01 (P08):** un E2E que demuestra navegación en 390 px no demuestra el cambio de modo responsive en el umbral de lg. Es una aplicación de P08-control-no-cubre-lo-que-dice, no una categoría nueva. La prueba que falta debe ejercitar ambos lados del breakpoint y la geometría del contenido, y fallar ante lg:hidden→md:hidden.

**PR584-H02 (P15):** imágenes declaradas como generadas fuera del repositorio no equivalen a adjuntos publicados en la PR. El DoD incluye el acto de entrega, y cuando las imágenes pueden contener datos personales se necesita revisión y publicación humana controlada.

## Reglas existentes suficientes

No se asigna AG nuevo en ronda 1. Los principios 8 y 40 ya exigen mutaciones RED reales; P08 ya explica la debilidad de un proxy, y P15 cubre un entregable que no puede reproducirse/consultarse. Se documentan los casos concretos para la ronda 2 sin reclamar un número global no verificado contra todas las ramas remotas.

## Mejora de proceso para siguientes PR

En cambios responsive, listar puntos justo debajo, en y por encima de cada breakpoint relevante; comparar no solo visibilidad sino ancho útil, foco, rutas y acciones críticas. Cuando una entrega incluye evidencias fuera de Git, declarar un paso humano verificable antes de considerar satisfecho el DoD.

## Límites de esta ronda

La batería estructural de cuatro mutaciones corre por lectura de clases y no sustituye Playwright. No se verificó el CI ni un servidor local de la PR. No se llama arreglado-verificado a un cambio que el autor anunció pero aún no subió.
