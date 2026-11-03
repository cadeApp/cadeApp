# Lecciones R1 — PR335

- Un release de ramas divergentes no se revisa como 823 cambios nuevos de una tarea. Comparar promoción contra `develop` para detectar **los archivos de customización divergentes** y verificar preservación individual, además de probar integración/CI de lote.
- El número de migraciones nuevas debe derivarse de los nombres SQL de `staging` y release, no del texto escrito por agy. `approval-policy` no detecta discrepancias fácticas del body (P03).
- La columna de `auth.users` en preflight no implica que se deban borrar cuentas. Promocionar implica `db push` migratorio, no reset; una migración de limpieza legacy puede contener `UPDATE` guardado sin `DELETE` o `TRUNCATE`.
- «Cuentas Auth 4 / solicitudes 0» en descripción del autor es evidencia útil pero no equivale a SQL independiente; si el conector no expone el proyecto, anotarlo e imponer revalidación read-only/respaldo como paso operacional antes de merge.
- El `e2e-staging.yml` real es disparo manual o workflow_call; CI de PR con db-tests efímera y Supabase Preview SKIPPED NO equivale a E2E staging posmerge.
- No asignar identificador AG nuevo sin revisar máximo en todas las ramas remotas; se conservan como lecciones sin número.
