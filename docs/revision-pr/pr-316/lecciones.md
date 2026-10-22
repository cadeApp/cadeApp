# PR #316 — Lecciones de la ronda 1

- La URL base que usa el navegador para E2E debe coincidir con el origen que devuelve el middleware al redirigir. En Next.js el normalizado de loopback a `localhost` puede alterar el host aunque el servidor escuche en `127.0.0.1`.
- Exigir un resultado **control GREEN real** antes de atribuir el fallo del mutante a la guarda de seguridad evitó un falso `RED_CONFIRMED`.
- No se agrega nueva regla numerada AG-*: la evidencia sobre esta familia proviene de una sola PR y la prueba estructural quedó incorporada en `verify-workflows.test.mjs`.

