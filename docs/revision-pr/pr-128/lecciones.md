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
- H02 refuerza `P08`: buscar el texto de un comando no demuestra que ese comando se ejecute. Un comentario conserva el string y satisface `indexOf`.
- H02 también muestra el límite de las listas negativas: prohibir algunas formas de ignorar errores no prueba propagación del fallo; `! curl ...` rompe la propiedad mediante otra sintaxis.
- La corrección a la propia revisión de R1 es pedir una aserción positiva de la forma ejecutable, no seguir ampliando una blacklist.
- La batería del autor detecta exactamente las mutaciones que se le pidieron; la batería independiente aporta variantes distintas, coherente con pr-68/AG-75.

## Ronda 3

No se agrega número AG nuevo.

- H02 queda cerrado porque el control pasó de “texto presente” a “comando activo del bloque run”. Las mutaciones de comentario, `echo`, orden y ausencia real del comando ya cambian el resultado.
- Al hacer mutaciones adversariales hay que respetar el alcance del invariante. `pull ... || true` y `build ... || true` son endurecimientos posibles de fail-fast, pero no son el DoD que originó H02; convertir cada sintaxis shell imaginable en un nuevo bloqueante transformaría un test de contrato en un parser de shell.
- El `pnpm test` local rojo por carreras entre suites no se convirtió en hallazgo de T-315 porque el runner limpio del mismo SHA ejecutó 1381/1381 tests. Esto es el tipo de caso donde la evidencia del entorno importa más que repetir un fallo contaminado.
- El bundle-budget terminó success pero el log contiene rutas por encima de 180 kB. Se leyó el valor real, como exige pr-82/AG-92; no se abre hallazgo porque T-315 no modifica producto ni bundle.
