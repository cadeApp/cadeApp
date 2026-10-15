# Lecciones — PR #362 / ronda 1

No se asigna un AG nuevo: se reutilizan los patrones existentes mientras no pueda enumerarse con `git` el máximo de todas las ramas. Evitar colisiones de numeración.

- **P08 y AG-37:** una matriz de `safeParse().success` no sustituye el barrido de **todas** las fronteras `Actions → RPC/persistencia → E2E`. El valor normalizado debe afirmarse, no solo el booleano.
- **P04:** un test de comportamiento positivo no puede aceptar `success=false` como alternativa: el rechazo total equivale a invalidar la función y dar verde al mismo tiempo.
- **P06:** no reutilizar una única expresión para nombres/direcciones y textarea de notas, donde CR/LF/TAB tienen semántica legítima.
- **AG-70:** una prueba roja debe caer por su aserción del invariante, no por un fallo previo del mock ni por un import inexistente.
- **Decisión 1B:** evitar introducir una regla comercial sin contrato de servidor; el límite de un `integer` de Postgres NO define un precio recomendado, solo la cota técnica. Si el negocio necesita otra, definir CC aparte.

En una nueva ronda, agregar mutaciones propias a lo que el autor arregle, sin adoptar ciegamente su batería.
