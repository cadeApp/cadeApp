# PR #624 — lecciones de ronda 1

No se asigna un nuevo número AG sin verificar el máximo global entre todas las ramas remotas. Los aprendizajes de esta ronda quedan como candidatos hasta la verificación y cierre de los hallazgos; no se atribuyen al autor como fallas comprobadas en ejecución.

1. **Snapshot versus reflejo mutable.** Si un contrato transaccional anterior usa un campo como identidad inmutable de un envío, no puede conservar esa semántica cuando otra tarea convierte el campo en reflejo operativo. Guardar explícitamente el snapshot y probar secuencias entre contratos (CC-043 → CC-042).
2. **Pruebas que respaldan dos estados contradictorios.** El pgTAP de backfill esperaba a la vez licencia none en bici y verified en couriers; el GREEN no avala el invariante. Añadir comparación cruzada de verdad/reflejo/doc_level.
3. **Idempotencia debe incluir identidad del destino.** Al añadir vehicleId a un payload, mismo idempotencyKey y mismo storagePath pueden dejar de describir la misma operación. Comprobar todas las ramas de retorno temprano.
4. **Compatibilidad legacy no significa atribución nueva.** Un documento sin vehicle_id de la etapa anterior no debe acreditarse automáticamente a cualquier vehículo nuevo activo.
5. **Los finally de E2E deben respetar los mismos guards que producción.** Probar cleanup desde cada estado intermedio, especialmente luego de activar otro vehículo o crear una oferta; evitar borrar directamente el activo.
6. **Agrupar por IDs, no atributos mutables.** Históricos de dos vehículos con mismo tipo/patente siguen siendo entidades distintas.

Patrones P08/P05/P06, relacionados con las lecciones ya registradas en pr-63/AG-68 y pr-68/AG-75 (referencias históricas, no nuevas verificaciones). El GREEN del CI se preserva como evidencia de infraestructura, no como prueba de ausencia de estos escenarios.
