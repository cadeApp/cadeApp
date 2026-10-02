# Lecciones — PR #198 / T-306

## Ronda 1

No se agrega número AG nuevo en esta ronda.

Los hallazgos refuerzan controles ya conocidos:

- **P08 — control no cubre lo que dice:** “se publicó” no puede probarse con “existe y veo el paquete”; “paid_until vencido” no puede probarse usando un estado que rechaza antes de leer la fecha.
- **P04 — test tautológico:** una función `mutatedPublishCheck` inventada dentro del propio test no demuestra que la suite detecte la eliminación del chequeo real.
- **P15 — entregable declarado pero no ejecutable:** una suite llamada “global-settings” que no matchea el proyecto ni entra al workflow no constituye evidencia E2E.

### Aplicación a prompts siguientes

Para esta PR hay que indicar archivo exacto, patrón a implementar, aserciones de base y mutación RED esperada. También queda explícitamente prohibido:
- fabricar funciones/mocks que representen la mutación en lugar de romper la propiedad real;
- cambiar expectativas para convertir una RED en GREEN sin corregir el comportamiento;
- marcar como ejecutado un E2E que no produjo salida de Playwright.
