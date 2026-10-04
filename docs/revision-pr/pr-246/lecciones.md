# Lecciones — PR #246 / T-335

## Ronda 1

- Un DoD que por definición ocurre **después del merge** no puede coexistir con `Closes #issue` si cerrar el issue significa declarar terminada la tarea. La salida es conservar el checkbox abierto, usar `Refs` y cerrar el issue después de la validación remota.
- Los tests de catálogo (`pg_publication_tables`) son un buen control para configuración de Realtime: ejercen el contrato real de PostgreSQL en lugar de mockear el cliente.
- La justificación de `REPLICA IDENTITY` debe describir qué datos consume el callback, no confundir “no usamos OLD completo” con “solo escuchamos INSERT”.
- Postgres Changes entrega filas permitidas por RLS al navegador aunque la aplicación use el evento solo para invalidar. Separar datos de contacto/PII en otra tabla evita que publicar la tabla de estado publique esos datos.
