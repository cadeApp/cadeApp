# Lecciones de PR #462

No hay hallazgos nuevos de código en esta ronda y por lo tanto no se asigna un nuevo identificador AG.

**Observación operativa:** dos PR distintas pueden introducir migraciones con timestamps definidos antes del orden real de merge. Supabase aplica según el orden de versiones, no según qué PR se abrió primero. Si la migración tardía no se llegó a aplicar en ningún remoto, el renombrado puramente nominal para situarla después de la última aplicada corrige el orden sin ampliar permisos ni alterar SQL.

**Control de salida:** conservar la falla real de `migrate-develop` como evidencia RED y no inferir GREEN remoto de `db-tests`; revisar el nuevo `migrate-develop` después del merge y recién entonces liberar dependencias como T-376. No marcar E2E como éxito cuando el bloqueo por migración es intencional.