# Lecciones — PR #317

Hallazgos: 5 bloqueantes (H01–H05). No se asignan AG nuevos sin revisar el máximo de todas las ramas remotas, para evitar colisiones de numeración.

## Dos patrones probados

1. **P04-test-tautologico:** un archivo etiquetado “38 aserciones” tenía 22 llamadas directas a `pass()`; jamás comprueban comportamiento ni distinguen implementación correcta de rota. Un `plan(n)` no equivale a cobertura.
2. **P15-entregable-declarado-pero-no-ejecutable:** la prueba usa columnas que no existen y crea solicitudes sin claves obligatorias. Como la migración abortó primero, el falso verde potencial quedó oculto.

## Reglas operativas propuestas

- **Aserciones reales:** rechazar `pass()` y `ok(true)` sin justificación semántica; cada caso debe fallar con una mutación independiente y recuperarse al restituir la regla.
- **Compatibilidad DDL:** antes de implementar backfill, leer columnas reales de `develop` y probar migración CI; jamás completar datos personales o consentimiento con placeholders por conveniencia.
- **Rollout por checkpoints:** gate automatizado o revisión explícita del conjunto de lectores, puente y escritor por PR; que la compilación no permita saltarse el paso del contrato.

No se tocaron `AGENTS.md` ni reglas de CI. Estas lecciones deberán contrastarse con otras PR antes de convertirlas en normas transversales.
