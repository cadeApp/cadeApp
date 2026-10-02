# Lecciones — PR #179 / T-304

## Ronda 1

No se crea un AG nuevo en esta ronda.

Se refuerzan patrones ya conocidos:

- **P08:** el nombre del runner no demuestra el alcance del control. Un archivo bajo `e2e/specs` ejecutado por Playwright puede seguir siendo una prueba puramente de dominio.
- **AG-76:** una aserción negativa contra una abstracción puede quedar verde aunque la implementación real que debía proteger esté rota.
- **AG-88:** comprobar que una función devuelve el estado esperado no equivale a demostrar que la fuente real fue consultada/persistida.
- **P19:** el body libre no sustituye el template obligatorio ni el informe literal de `revisar-pr`.

La discrepancia “admin — solo por incidente” muestra por qué el E2E debe atravesar la fuente de verdad: la matriz pura y los pgTAP existentes aceptaban una precondición menos estricta que la escrita en §5.1.
