# Lecciones — PR #128 (T-315)

## Ronda 1

No se agrega número AG nuevo.

- **PR128-H01** aplica `P01-contrato-de-framework-no-verificado`: en GitHub Actions, campos parecidos del contexto (`actor` y `triggering_actor`) no son intercambiables para una compuerta de release.
- **PR128-H02** es otra instancia de `P08-control-no-cubre-lo-que-dice`: que exista `curl --fail` no demuestra que el job falle si después se neutraliza el exit; que exista una condición de rechazo tampoco demuestra que rechace.
- La batería de mutaciones de la revisión vuelve a ser necesaria: el RED “sin deploy.yml” del autor prueba que los tests dependen del archivo, pero no que distingan una implementación correcta de una implementación parcialmente rota.
- **PR128-A01** queda como excepción explícita, no como regla nueva: T-315 nació con la ficha dentro de la misma PR y Lautaro073 eligió 1-A para no retroceder el proceso.
