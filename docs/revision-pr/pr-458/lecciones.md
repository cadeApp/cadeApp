# Lecciones · PR #458 / T-380

## Ronda 1

No se numera ninguna lección AG nueva; ambos hallazgos corresponden a familias ya conocidas.

- **H01 / P08:** una prueba de concurrencia/doble envío no debe depender de que una espera fija alcance para que se ejecute un segundo callback. Es necesario sincronizar su entrega y mostrar un RED causado por retirar la guarda en producción (no por romper un mock o modificar expectations).
- **H02 / P15:** afirmar “M1–M8 RED/GREEN” sin conservar las sustituciones exactas y las salidas necesarias impide a un revisor reproducir la evidencia. La bitácora del autor es el canal apropiado para esos comandos; el informe independiente no debe autocompletar lo que no pudo ejecutar.

**Punto positivo verificable:** la E2E oficial ejercita una transición real con MFA y consulta estado y auditoría, en vez de basarse solo en un mock; la acción separa el cliente AAL2 de `createAdminClient`. No constituye prueba de todas las mutaciones de la bitácora.

No se modifica `AGENTS.md` por esta sola ronda.
