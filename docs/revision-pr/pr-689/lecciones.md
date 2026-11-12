# Lecciones — PR #689 / T-430

## Ronda 1

No se asigna número AG nuevo en esta ronda: todavía no hay resultado de mutación de PostgreSQL que pruebe la ceguera de la batería ante una regresión específica de la policy de INSERT.

- **`PR689-H01` — referencia a `pr-68/AG-75`, `pr-63/AG-68` y `pr-56/AG-37`.** Cuando dos controles hacen cumplir el mismo invariante (RLS `WITH CHECK` y trigger `BEFORE INSERT`), probar solo el resultado compuesto no certifica a cada barrera. En esta tarea ya se quitó el trigger como mutación del autor; falta el complemento independiente de retirar solo el filtro de estado del `WITH CHECK` mientras la prueba evita temporalmente el trigger. La evidencia actual es estática y la siguiente ronda debe comprobar el RED real en PostgreSQL antes de considerar elevarlo a regla AG.
- **`PR689-A01` — cambio de alcance aceptado, no arreglo técnico.** El nuevo `USING` con `draft` cambia un rechazo de `42501` por `UPDATE 0` sobre publicadas. Ajustar un test para verificar semántica nueva **y** persistencia del dato es legítimo cuando el contrato lo respalda; no basta con cambiar el error esperado por un `lives_ok`. La ampliación fue ratificada por Lautaro073 como D01-A.
- **Proceso:** un job E2E con status `error` no demuestra que los tests E2E fallaron. En esta PR el workflow explicita `BLOCKED / REQUIRES DEVELOP MIGRATION` y no ejecuta las pruebas para proteger el ambiente Develop compartido. Registrar la falta de ejecución por separado de fallos funcionales.

## Precaución para la siguiente ronda

Quien implementa D02-A **no edita esta carpeta** ni marca hallazgos como `arreglado-verificado`. La revisión independiente inspeccionará el SHA nuevo, reproducirá la prueba que aísla la policy y cotejará exactamente las mutaciones RED/GREEN de CI.
