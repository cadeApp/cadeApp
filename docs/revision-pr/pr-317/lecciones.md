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

## Ronda 2 — Hallazgos H06 a H09

- **H06 (crítico), P05/P08:** un `db-tests` verde no garantiza serialización cuando el trigger pasó a `SECURITY DEFINER` y condiciona su ejecución a `current_user`. El propio contrato de CC-022 §2b lo prohibía. Refuerza `pr-64/AG-62`: donde no pueda ejercerse una carrera real, un control estructural específico debe detectar esta configuración peligrosa y probar su propia mutación.
- **H07, P04:** reemplazar `select pass()` por pruebas que insertan ellas mismas la fila esperada sigue siendo una prueba independiente del comportamiento productivo. Refuerza `pr-63/AG-68`.
- **H08, P08:** secuencial no significa concurrente. La prueba de RLS no puede certificar que un lock previene un TOCTOU. Refuerza `pr-68/AG-74` y la exigencia de dos sesiones.
- **H09, P06:** auditar un backfill requiere enumerar las mismas exclusiones que aplica el materializador, incluidas las relaciones entre medio de pago y monto de cambio.

No se modifica `AGENTS.md` ni se asigna numeración AG nueva: las reglas existentes ya contemplan estos patrones y aún falta ejecución de pruebas concurrentes en CI.
