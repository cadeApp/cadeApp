# Lecciones — PR #179 / T-304

## Ronda 1

No se crea un AG nuevo en esta ronda.

Se refuerzan patrones ya conocidos:

- **P08:** el nombre del runner no demuestra el alcance del control. Un archivo bajo `e2e/specs` ejecutado por Playwright puede seguir siendo una prueba puramente de dominio.
- **AG-76:** una aserción negativa contra una abstracción puede quedar verde aunque la implementación real que debía proteger esté rota.
- **AG-88:** comprobar que una función devuelve el estado esperado no equivale a demostrar que la fuente real fue consultada/persistida.
- **P19:** el body libre no sustituye el template obligatorio ni el informe literal de `revisar-pr`.

La discrepancia “admin — solo por incidente” muestra por qué el E2E debe atravesar la fuente de verdad: la matriz pura y los pgTAP existentes aceptaban una precondición menos estricta que la escrita en §5.1.

## Ronda 2

No se crea un AG nuevo.

Se refuerzan:

- **P08:** un mock de Supabase no valida FKs ni orden relacional. Un seed puede pasar 52 unitarios y ser imposible en PostgreSQL real.
- **P15:** “el spec existe” no equivale a “el gate lo ejecuta”. Todo E2E nuevo debe quedar incluido explícitamente en Preview/Staging y producir status para el SHA exacto.
- **P03:** un E2E debe derivar los códigos de error de la precedencia contractual real; no de una interpretación del estado.
- **P06:** cubrir una fila de §5.1 incluye sus precondiciones y efectos, no solo comprobar el status final.

La existencia de Supabase Develop + Vercel Preview elimina el motivo para cerrar T-304 sin una corrida real del spec.
