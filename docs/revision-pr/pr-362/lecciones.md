# Lecciones — PR #362 / ronda 1

No se asigna un AG nuevo: se reutilizan los patrones existentes mientras no pueda enumerarse con `git` el máximo de todas las ramas. Evitar colisiones de numeración.

- **P08 y AG-37:** una matriz de `safeParse().success` no sustituye el barrido de **todas** las fronteras `Actions → RPC/persistencia → E2E`. El valor normalizado debe afirmarse, no solo el booleano.
- **P04:** un test de comportamiento positivo no puede aceptar `success=false` como alternativa: el rechazo total equivale a invalidar la función y dar verde al mismo tiempo.
- **P06:** no reutilizar una única expresión para nombres/direcciones y textarea de notas, donde CR/LF/TAB tienen semántica legítima.
- **AG-70:** una prueba roja debe caer por su aserción del invariante, no por un fallo previo del mock ni por un import inexistente.
- **Decisión 1B:** evitar introducir una regla comercial sin contrato de servidor; el límite de un `integer` de Postgres NO define un precio recomendado, solo la cota técnica. Si el negocio necesita otra, definir CC aparte.

En una nueva ronda, agregar mutaciones propias a lo que el autor arregle, sin adoptar ciegamente su batería.

---

## Ronda 2 (SHA `5dfb57b`)

No se asigna AG nuevo sin enumeración remota completa de todas las ramas.

- **H08 — P04/P08:** en E2E está prohibido envolver TODAS las aserciones en `if (await locator.isVisible())`. Un campo ausente debe poner el test en rojo, no omitirlo silenciosamente.
- **H06:** desaparecer un error no equivale a completar una operación válida; el test tiene que observar su efecto posterior y el destino esperado.
- **H07:** la bitácora append-only no debe presentar números de línea inexistentes como prueba de una ejecución; citar el nombre de la prueba y pegar salida capturada verificable. Una descripción de lo que hubiera fallado NO equivale al rojo real.
- **H01-H05:** los cambios son consistentes por inspección; falta ejecución y mutación independiente, sin prematuro `arreglado-verificado`.
