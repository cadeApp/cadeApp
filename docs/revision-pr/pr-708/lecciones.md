# Lecciones — PR #708 / T-433 · Ronda 1

No se asigna nuevo identificador `AG-xx` en esta ronda: la numeración global debe comprobarse contra todas las ramas remotas y el entorno actual no permite `git fetch`. Se deja el aprendizaje sin inventar número.

## Negativos de autenticación: igualar la longitud para ejercitar el contenido

**Origen:** PR708-H01, `P08-control-no-cubre-lo-que-dice`.

El Route Handler protege correctamente una clave con `Buffer.length` + `crypto.timingSafeEqual`. Sin embargo, los tests negativos usan un `CRON_SECRET` de 33 caracteres frente a `PUSH_SEND_SECRET` de 34, y otro token mucho más corto. La barrera de longitud rechaza todos los negativos: se podría quitar la comparación de bytes sin que las expectativas existentes lo vieran.

**Regla propuesta:** para una función que compara secretos, construir al menos un caso negativo de longitud **igual en bytes** y valor distinto, además de los casos de longitud inválida. El negativo de un secreto de otro dominio debe también tener longitud idéntica al secreto esperado, para distinguir identidad de longitud. Una mutación que anula la comparación de contenido debe volver el test rojo por la expectativa funcional.

**Alcance de la constatación:** predicado aislado reproducido con Node; no se ejecutó Vitest contra el repo desde este entorno. En siguiente ronda ejecutar el arnés con el SHA publicado, y recién entonces marcar evidencia de mutación como verificada.

**Relación con antecedentes:** `pr-56/AG-37` (enumeración de clase) y `pr-62/AG-58` (control que solo prueba un sustituto del invariante). No implica que el código de producción tenga hoy ese bypass.
