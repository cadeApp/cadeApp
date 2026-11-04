# Lecciones — PR #583 (T-401)

Ronda 1 sin hallazgos estructurados; no se asigna AG nueva.

- El control de privacidad debe mirar **el objeto que sale de las queries** además del JSX. Aquí hay aserciones que prueban que el HMAC no viaja en el resultado y que el booleano da true y false.
- `bundle-budget` es advisory: al igual que `pr-82/AG-92`, su éxito puede acompañarse de «Supera el límite». En esta PR se contrastaron los números con `develop` antes de atribuir una regresión: 263 kB contra 263 kB.
- Los RED de bitácora son **afirmaciones del autor**, no verificación independiente; un entorno sin clon no autoriza presentarlos como reproducidos. Se deja un guion específico para un futuro checkout sin alterar tests, mocks ni expectations.

## Ronda 2

- Un `getByText` negativo produce un error del selector incluso cuando el test tiene un `expect` externo; si la batería exige **RED por aserción**, usar `queryByText` y asertar presencia o ausencia explícitamente. La comparación del diff confirma que no se debilitó la obligación de hallar el texto ni la clase de la etiqueta.
- Un harness **diseñado por la revisión** y **ejecutado por el autor** sigue siendo evidencia de ejecución declarada por el autor: no debe confundirse con una reproducción independiente. El resumen 9/9 se documenta como tal. Se refuerza `pr-63/AG-68` sin agregar número nuevo.
- El workflow `e2e-preview` con evento `repository_dispatch` puede figurar bajo el SHA de la rama base: cruzar siempre el deployment target y el estado de commit de la PR antes de certificar E2E del head.

No se cambia `AGENTS.md` por esta revisión.
