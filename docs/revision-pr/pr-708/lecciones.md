# Lecciones — PR #708 / T-433 · Ronda 1

No se asigna nuevo identificador `AG-xx` en esta ronda: la numeración global debe comprobarse contra todas las ramas remotas y el entorno actual no permite `git fetch`. Se deja el aprendizaje sin inventar número.

## Negativos de autenticación: igualar la longitud para ejercitar el contenido

**Origen:** PR708-H01, `P08-control-no-cubre-lo-que-dice`.

El Route Handler protege correctamente una clave con `Buffer.length` + `crypto.timingSafeEqual`. Sin embargo, los tests negativos usan un `CRON_SECRET` de 33 caracteres frente a `PUSH_SEND_SECRET` de 34, y otro token mucho más corto. La barrera de longitud rechaza todos los negativos: se podría quitar la comparación de bytes sin que las expectativas existentes lo vieran.

**Regla propuesta:** para una función que compara secretos, construir al menos un caso negativo de longitud **igual en bytes** y valor distinto, además de los casos de longitud inválida. El negativo de un secreto de otro dominio debe también tener longitud idéntica al secreto esperado, para distinguir identidad de longitud. Una mutación que anula la comparación de contenido debe volver el test rojo por la expectativa funcional.

**Alcance de la constatación:** predicado aislado reproducido con Node; no se ejecutó Vitest contra el repo desde este entorno. En siguiente ronda ejecutar el arnés con el SHA publicado, y recién entonces marcar evidencia de mutación como verificada.

**Relación con antecedentes:** `pr-56/AG-37` (enumeración de clase) y `pr-62/AG-58` (control que solo prueba un sustituto del invariante). No implica que el código de producción tenga hoy ese bypass.

---

## Ronda 2 — confirmación y límite del control

El arreglo de H01 conserva el handler productivo sin modificaciones y añade exactamente los dos elementos que faltaban: un bypass de `CRON_SECRET` con **longitud idéntica** y un token incorrecto que altera el **último byte**. El CI ejecuta la suite real del SHA `0d5616b8` con 10/10 tests, dentro de 3872/3872.

La batería **propia** de la revisión probó un mutante nuevo: comparación de todos los bytes excepto el último. Este caso es más preciso que eliminar toda comparación, porque diferencia igualdad completa de igualdad de prefijo. Dejó 200 el token inválido cuyo último byte cambia, frente a 401 del predicado correcto. **Fue una ejecución aislada con Node; no se atribuye a Vitest.**

Se conserva la lección existente sin nuevo número AG. Tampoco se inventa verificación de los resultados de mutación que solo obran en la bitácora del autor. El control de tamaño y el control de contenido deben comprobarse por separado.
