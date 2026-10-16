# Lecciones de revisión — PR #381

- **P08:** un runner que prueba convivencia con el mismo `storage_path` solo está probando una restricción que ya existe; no detecta bypass por otra ruta del mismo kind. Enumerar toda clase de storage paths antes de declarar cobertura.
- **P08:** el mutation runner que convierte CUALQUIER error de proceso en RED produce falsos positivos; el log CI de esta PR registra exit=3, no filas duplicadas. Un oráculo debe comprobar estado y propiedad quebrada.
- **P18:** una RPC SECURITY DEFINER debe comprobar las restricciones completas del actor (rol, consentimiento y estado real del courier), no solo que exista su fila.
- **P08:** comprobar elegibilidad antes de un lock bloqueante sin revalidación deja una ventana TOCTOU. Diseñar el orden global de locks y probar revocación concurrente.
- **Corrección del propio revisor:** la sospecha de duplicación de license/insurance por payload doble no se confirmó; la segunda entrada se relee en la misma transacción y aborta ante path distinto, por lo que no se reportó.
