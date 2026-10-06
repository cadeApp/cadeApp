# Lecciones de la PR #275

> Esta carpeta evita asignar nuevos números globales `AG-xx` sin enumerar primero todas las ramas remotas. Las observaciones quedan descriptivas y los hallazgos no referencian un número local duplicado.

## Un error de contrato no debe degradarse a “sin datos”

**Origen:** PR275-H01.

Cuando una frontera valida datos externos y la UI diferencia error de lista vacía, un fallo de contrato debe activar el camino de error; no convertirse en `[]`, `null` o un default que signifique “sin datos”.

## El informe del PR es un contrato machine-readable

**Origen:** PR275-H03.

El bloque de `revisar-pr` debe conservar encabezados y markers requeridos por `approval-policy`; un resumen no lo reemplaza.

## No mezclar evidencia de comandos distintos

**Origen:** PR275-H04.

Un targeted test verde o un job de CI no permite afirmar que otro comando local pasó cuando su salida fue roja. Cada check debe reflejar literalmente su propia evidencia.

## Los mutation tests no deben escribir el checkout compartido

**Origen:** PR275-H04.

Una mutación que reescribe archivos que otros workers pueden importar crea carreras y falsos fallos. Si la demostración necesita modificar código real, debe hacerlo en un workspace/worktree aislado y ejecutar el test mutante desde allí.

## Cold-start costoso: preparar una vez, afirmar muchas veces

**Origen:** PR275-H04.

Cuando varias pruebas ejercen el mismo analizador pesado sobre distintos fixtures, conviene ejecutar la preparación determinista una vez y conservar las assertions por caso, en vez de esconder el costo con timeouts mayores.
