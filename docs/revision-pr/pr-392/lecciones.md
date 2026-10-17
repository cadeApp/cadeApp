# Lecciones — PR #392

- **P03 / revisión de promoción:** no asumir que la condición de rollback de un contrato (CC-025 A/B0 aditivas) vale para todas las migraciones del lote. CC-026 revoca UPDATE de columnas operativas. Revisar la semántica de grants y legacy clients antes de prometer rollback transparente.
- **P08 / release gate:** pruebas SQL contra base efímera y Vercel Preview develop no acreditan migraciones aplicadas en staging; la prueba real ocurre después del merge autorizado. Mostrar condición de STOP y actor operativo.
- **Alcance:** merge de dos padres y hash de archivos staging preservados prueban que la reconciliación conservó personalizaciones; no volver a revisar 269 archivos como si fueran 269 cambios inéditos, pero sí auditar las cuatro migraciones nuevas y los cruces entre contratos.
