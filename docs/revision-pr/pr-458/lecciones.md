# Lecciones · PR #458 / T-380

## Ronda 1

No se numera ninguna lección AG nueva; ambos hallazgos corresponden a familias ya conocidas.

- **H01 / P08:** una prueba de concurrencia/doble envío no debe depender de que una espera fija alcance para que se ejecute un segundo callback. Es necesario sincronizar su entrega y mostrar un RED causado por retirar la guarda en producción (no por romper un mock o modificar expectations).
- **H02 / P15:** afirmar “M1–M8 RED/GREEN” sin conservar las sustituciones exactas y las salidas necesarias impide a un revisor reproducir la evidencia. La bitácora del autor es el canal apropiado para esos comandos; el informe independiente no debe autocompletar lo que no pudo ejecutar.

**Punto positivo verificable:** la E2E oficial ejercita una transición real con MFA y consulta estado y auditoría, en vez de basarse solo en un mock; la acción separa el cliente AAL2 de `createAdminClient`. No constituye prueba de todas las mutaciones de la bitácora.

No se modifica `AGENTS.md` por esta sola ronda.

## Ronda 2

Se cerraron H01 y H02 sin necesidad de regla AG nueva.

- El test de doble envío eliminó la espera fija y demostró mediante M9 del autor el fallo específico de duplicación de llamadas. El control estático independiente RED/GREEN verifica que el código y la prueba conservan la guarda y ya no dependen de un sleep.
- Los nueve snippets «antes» de la bitácora coinciden exactamente con sus fuentes del SHA revisado, en vez de un resumen de números sin procedimiento.
- **AG-60 también aplica a la revisión:** el primer validador propio devolvió un falso negativo al leer el grupo equivocado de una expresión regular. Se corrigió y ejecutó de nuevo (9/9); nunca se reportó ese resultado provisional como un defecto del autor.
- Límites explícitos: checks estáticos y CI unit en el SHA no equivalen a reejecutar Vitest con las nueve mutaciones locales. Se conserva la distinción en el informe; no se inventa ejecución dinámica del revisor.

El bundle-budget sigue señalando 248 kB en el detalle de admin con resultado advisory, igual que en R1; sin evidencia de regresión atribuible a estos cambios, no se abre hallazgo de esta tarea.
