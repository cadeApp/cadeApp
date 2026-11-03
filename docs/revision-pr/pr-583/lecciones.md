# Lecciones — PR #583 (T-401)

Ronda 1 sin hallazgos estructurados; no se asigna AG nueva.

- El control de privacidad debe mirar **el objeto que sale de las queries** además del JSX. Aquí hay aserciones que prueban que el HMAC no viaja en el resultado y que el booleano da true y false.
- `bundle-budget` es advisory: al igual que `pr-82/AG-92`, su éxito puede acompañarse de «Supera el límite». En esta PR se contrastaron los números con `develop` antes de atribuir una regresión: 263 kB contra 263 kB.
- Los RED de bitácora son **afirmaciones del autor**, no verificación independiente; un entorno sin clon no autoriza presentarlos como reproducidos. Se deja un guion específico para un futuro checkout sin alterar tests, mocks ni expectations.

No se cambia `AGENTS.md` por una sola observación.
