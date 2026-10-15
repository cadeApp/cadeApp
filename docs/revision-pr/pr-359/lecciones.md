# Lecciones — PR #359 / T-360, ronda 1

**Fuente:** 2 hallazgos abiertos, ambos por ausencia de implementación en un Draft, no por comportamiento de código ejecutado.

## Patrón observado

La PR existe como punto de coordinación pero no demuestra ninguna propiedad funcional ni test de T-360. Al autor le faltaban decisiones arquitectónicas ahora cerradas por Lautaro073. La ficha conserva una nota histórica contradictoria con el fin de este PR; no se interpreta como permiso para cambiar contratos.

## Prevención

- Separar *Draft esperando decisiones* de *implementación fallida*: la ausencia de código no es una regresión reproducida.
- Proveer un prompt de implementación con archivos, mocks, invariantes, RED/GREEN, límites de seguridad y E2E verificable antes de reclamar cobertura.
- No producir nueva regla `AG-xx` a partir de este solo Draft. Ronda 2 decidirá si hay una lección de código real respaldada por evidencia.

## Advertencia

No se ejecutaron suites ni mutaciones en esta ronda. Ninguna frase de este documento equivale a verificación independiente de la implementación.
