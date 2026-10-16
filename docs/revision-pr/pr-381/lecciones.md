# Lecciones de revisión — PR #381

- **P08:** un runner que prueba convivencia con el mismo `storage_path` solo está probando una restricción que ya existe; no detecta bypass por otra ruta del mismo kind. Enumerar toda clase de storage paths antes de declarar cobertura.
- **P08:** el mutation runner que convierte CUALQUIER error de proceso en RED produce falsos positivos; el log CI de esta PR registra exit=3, no filas duplicadas. Un oráculo debe comprobar estado y propiedad quebrada.
- **P18:** una RPC SECURITY DEFINER debe comprobar las restricciones completas del actor (rol, consentimiento y estado real del courier), no solo que exista su fila.
- **P08:** comprobar elegibilidad antes de un lock bloqueante sin revalidación deja una ventana TOCTOU. Diseñar el orden global de locks y probar revocación concurrente.
- **Corrección del propio revisor:** la sospecha de duplicación de license/insurance por payload doble no se confirmó; la segunda entrada se relee en la misma transacción y aborta ante path distinto, por lo que no se reportó.


## Ronda 2
- **P08/H01:** reproducir un bypass REST por ruta alternativa puede justificar aceptar temporalmente una limitación PREEXISTENTE de alcance para una migración aditiva, pero no transformarlo en «corregido» ni en garantía global. CC Fase C debe incorporar constraint/policy y tener gate de escritores.
- **P08/H02:** un RED confiable comprueba la propiedad quebrada (8 docs) y GREEN restituye el estado esperado (4 docs). Error de infraestructura o psql exit=3 no es prueba de mutación correcta.
- **P18/H03:** comprobar status courier en la propia RPC Security Definer bajo lock, no confiar en rechazo exclusivo de frontend.
- **P08/H04:** releer consentimiento con `profiles FOR SHARE` después del lock courier y probar revocación durante espera, no sólo before/after en serial.
- **Alcance:** no confundir merge de develop con archivos modificados funcionalmente por B0; comparar rama actual con develop, además de commits desde ronda anterior.
