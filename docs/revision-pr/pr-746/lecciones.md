# Lecciones — PR #746 / T-437 (ronda 1)

**Hallazgos nuevos:** ninguno. No se crea un número `AG-xx` sin un defecto demostrado en este diff.

## Aprendizaje aplicable (sin abrir nueva regla todavía)

- Un test de Playwright con texto que puede aparecer temporalmente en más de un lugar debe localizar primero la región accesible **que representa la acción protegida** (`toolbar` con nombre) y luego el motivo y el botón en ella. No resolver ambigüedad con `.first()` ni `nth()` sin criterio semántico.
- `CONTROL_NOT_GREEN` no es `RED_CONFIRMED`: aunque el mutante falle por la aserción esperada, un control rojo invalida la atribución. En la run 43532734795 ocurrió exactamente eso.
- Un diagnóstico de streaming huérfano en el mismo log no demuestra por sí solo el origen del segundo DOM: distinguir síntoma verificado e hipótesis.
- La batería estructural propia detecta regresiones textuales del selector pero no reemplaza el browser ni las mutaciones funcionales. La prueba real post-merge debe producir una sola prueba en verde sin mutar y un rojo atribuible al guard.

**Patrones del catálogo relacionados, no registrados como hallazgo de la PR #746:** `P08-control-no-cubre-lo-que-dice` y `P06-enumeracion-incompleta`. Repetir la ejecución real antes de añadir una regla formal; esta revisión de dos archivos no demuestra una falla nueva del control corregido.

## Límites

Sin Playwright ejecutado independientemente; se contrastaron diff, componente, contrato E2E y logs Actions. No hay base para afirmar que desaparecieron todos los duplicados del DOM ni que el streaming haya sido la causa exacta.
