# Lecciones — PR #128 (T-315)

## Ronda 1

No se agrega número AG nuevo.

- **PR128-H01** aplica `P01-contrato-de-framework-no-verificado`: en GitHub Actions, `actor` y `triggering_actor` no son intercambiables para una compuerta de release.
- **PR128-H02** es otra instancia de `P08-control-no-cubre-lo-que-dice`: que exista `curl --fail` no demuestra que el job falle si se neutraliza el exit.
- La batería de mutaciones de la revisión es necesaria: el RED “sin deploy.yml” demuestra dependencia del archivo, no corrección semántica.
- **PR128-A01** queda como excepción explícita para T-315.

## Ronda 2

No se agrega número AG nuevo.

- H01 quedó correctamente cerrado siguiendo D02/2-A.
- H02 refuerza `P08`: **buscar el texto de un comando no demuestra que ese comando se ejecute**. Un comentario conserva el string y satisface `indexOf`.
- H02 también muestra el límite de las listas negativas: prohibir algunas formas de ignorar errores no prueba propagación del fallo; `! curl ...` rompe la propiedad mediante otra sintaxis.
- La corrección a la propia revisión de R1 es pedir una aserción positiva de la forma ejecutable, no seguir ampliando una blacklist.
- La batería del autor detecta exactamente las mutaciones que se le pidieron; la batería independiente aporta variantes distintas, coherente con AG-75.
