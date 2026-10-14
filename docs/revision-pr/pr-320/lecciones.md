# Lecciones de PR #320

**Se documentan como propuestas; no se asignan números AG nuevos hasta verificar el máximo global y realizar revisión por otro agente.**

1. Las dos funciones seed (`seedStagingData` y `seedDeliveryRequestInState`) deben verificar el mismo invariante: no hay solicitud no-draft visible sin drops y private contacts completos. Exigir tests unitarios de **ambos** caminos, con mutation RED al omitir cada insert.
2. Los cambios de fuente de verdad (columnas legacy → `delivery_request_drops`) exigen actualización de *todos* los fixtures, no solo de los tests principales. T-343 escribía solo el parent.
3. Un test puede quedar GREEN en CI con mocks que no capturan fallos vistos por el runtime real. E2E cancelado es NO GREEN aunque 61 casos pasen.
4. No hacer `.first()` sobre dos badges idénticos: apuntar al estado semántico mediante contenedor accesible y probar que el selector falla frente a estados incorrectos.
5. No borrar filas de Develop por el solo hecho de estar mal formadas: demostrar procedencia E2E, impacto y autorización para intervención.

## Ronda 2 — comprobación independiente

El contraste de logs muestra por qué es importante probar el HEAD real del checkout, no el head_sha de un workflow `repository_dispatch`. Los nuevos fixtures materializan drops antes de hacer visible `published` en ambas rutas; el E2E de 72 Chromium más 3 `global-settings` sobre Develop limpio es evidencia más fuerte que los 2133 tests unitarios solos.

La limpieza autorizada de huérfanas transitorias fue una intervención humana de entorno, no un cambio a la lógica ni una política de limpieza automática. La cancelación del runner antes del `finally` continúa como riesgo operativo para tarea separada.

Evitar dependencia circular obsoleta en cuerpos/bitácoras: una vez que #320 logra su GREEN completo por sí sola, no mantener «primero hay que integrar #323» como requisito documental que contradice la evidencia. El revisor conserva la carpeta; el autor debe corregir su propia bitácora antes del merge.
