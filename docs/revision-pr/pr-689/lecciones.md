# Lecciones — PR #689 / T-430

## Ronda 1

No se asigna número AG nuevo en esta ronda: todavía no hay resultado de mutación de PostgreSQL que pruebe la ceguera de la batería ante una regresión específica de la policy de INSERT.

- **`PR689-H01` — referencia a `pr-68/AG-75`, `pr-63/AG-68` y `pr-56/AG-37`.** Cuando dos controles hacen cumplir el mismo invariante (RLS `WITH CHECK` y trigger `BEFORE INSERT`), probar solo el resultado compuesto no certifica a cada barrera. En esta tarea ya se quitó el trigger como mutación del autor; falta el complemento independiente de retirar solo el filtro de estado del `WITH CHECK` mientras la prueba evita temporalmente el trigger. La evidencia actual es estática y la siguiente ronda debe comprobar el RED real en PostgreSQL antes de considerar elevarlo a regla AG.
- **`PR689-A01` — cambio de alcance aceptado, no arreglo técnico.** El nuevo `USING` con `draft` cambia un rechazo de `42501` por `UPDATE 0` sobre publicadas. Ajustar un test para verificar semántica nueva **y** persistencia del dato es legítimo cuando el contrato lo respalda; no basta con cambiar el error esperado por un `lives_ok`. La ampliación fue ratificada por Lautaro073 como D01-A.
- **Proceso:** un job E2E con status `error` no demuestra que los tests E2E fallaron. En esta PR el workflow explicita `BLOCKED / REQUIRES DEVELOP MIGRATION` y no ejecuta las pruebas para proteger el ambiente Develop compartido. Registrar la falta de ejecución por separado de fallos funcionales.

## Precaución para la siguiente ronda

Quien implementa D02-A **no edita esta carpeta** ni marca hallazgos como `arreglado-verificado`. La revisión independiente inspeccionará el SHA nuevo, reproducirá la prueba que aísla la policy y cotejará exactamente las mutaciones RED/GREEN de CI.

## Ronda 2 — control por capas verificado

- **Hecho verificable:** la mutación #696 retiró solo `r.status = 'draft'` de `contacts_insert_merchant WITH CHECK` y los tests 108/109 fallaron por **INSERT permitido** (`00000`), aunque la migración mantuvo el trigger. El test temporalmente lo deshabilita y luego deshace ese cambio con una subtransacción; queda protegido también el contador pgTAP. Con la migración correcta, la suite completa de CC-048 quedó 111/111 GREEN en CI.
- **Lección recurrente P08 / referencia `pr-68/AG-75`:** verificar el invariante compuesto no demuestra cada capa de defensa. Cuando hay RLS y trigger para la misma operación, exigir una prueba de policy aislada y su **mutación específica**; mutar el trigger es un control complementario, no sustituto.
- **Lección de protocolo:** un RED solo cuenta si deriva de la pérdida de la propiedad esperada. La mutación #696 cambia una sola línea del SQL, no toca test/fixtures y devuelve `00000` en published/matched; la prueba está protegida contra un falso RED por error de PK o sintaxis. En la rama real, el SQL no fue modificado por el fix.
- **Trazabilidad:** la revisión no ejecutó PostgreSQL local, sino que auditó el log real de CI y ejecutó un control estático propio; esto debe decirse explícitamente. El nuevo `verificado_en_sha` apunta a código `e9aa8848`, no a `3912c5fc`, que solo cambia bitácora.
- **Nueva AG:** no se numera una regla nueva por esta sola ronda; las reglas existentes ya cubren responsabilidad del revisor y control RED→GREEN. Si reaparece el mismo defecto de aislamiento entre capas en otro PR, considerar automatizar esta exigencia en la checklist SQL/RLS.
