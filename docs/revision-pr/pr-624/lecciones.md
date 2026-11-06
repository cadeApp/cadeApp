# PR #624 — lecciones de ronda 1

No se asigna un nuevo número AG sin verificar el máximo global entre todas las ramas remotas. Los aprendizajes de esta ronda quedan como candidatos hasta la verificación y cierre de los hallazgos; no se atribuyen al autor como fallas comprobadas en ejecución.

1. **Snapshot versus reflejo mutable.** Si un contrato transaccional anterior usa un campo como identidad inmutable de un envío, no puede conservar esa semántica cuando otra tarea convierte el campo en reflejo operativo. Guardar explícitamente el snapshot y probar secuencias entre contratos (CC-043 → CC-042).
2. **Pruebas que respaldan dos estados contradictorios.** El pgTAP de backfill esperaba a la vez licencia none en bici y verified en couriers; el GREEN no avala el invariante. Añadir comparación cruzada de verdad/reflejo/doc_level.
3. **Idempotencia debe incluir identidad del destino.** Al añadir vehicleId a un payload, mismo idempotencyKey y mismo storagePath pueden dejar de describir la misma operación. Comprobar todas las ramas de retorno temprano.
4. **Compatibilidad legacy no significa atribución nueva.** Un documento sin vehicle_id de la etapa anterior no debe acreditarse automáticamente a cualquier vehículo nuevo activo.
5. **Los finally de E2E deben respetar los mismos guards que producción.** Probar cleanup desde cada estado intermedio, especialmente luego de activar otro vehículo o crear una oferta; evitar borrar directamente el activo.
6. **Agrupar por IDs, no atributos mutables.** Históricos de dos vehículos con mismo tipo/patente siguen siendo entidades distintas.

Patrones P08/P05/P06, relacionados con las lecciones ya registradas en pr-63/AG-68 y pr-68/AG-75 (referencias históricas, no nuevas verificaciones). El GREEN del CI se preserva como evidencia de infraestructura, no como prueba de ausencia de estos escenarios.

## Ronda 2 — candidatos a lecciones (sin numeración AG hasta consultar todas las ramas remotas)

7. Un cleanup por categoría (courier_id+vehicle_type) puede borrar datos históricos al probar un flujo con entidades archivables; usar IDs exactos del test, incluido el caso de éxito remoto con fallo de render.
8. El try/finally debe envolver la primera mutación, no comenzar después de un alta y varios asserts de preparación.
9. Cuando el snapshot inmutable está ausente, un fallback a campos mutables debe estar acotado a un estado que todavía no permitió cambios; si no se puede reconstruir la identidad, fallar cerrado.
10. Un test de vista que cuenta pestañas no puede validar la ordenación en la query que construyó los datos. Debe atravesar getApplicantDetail y fallar con el comparador anterior.
11. Las PR #641–#645 muestran RED del autor en CI, pero la verificación independiente conserva su propio umbral para llenar verificado_en_sha.


## Ronda 3 — lecciones adicionales (candidatas sin ID AG)

12. El test de limpieza también necesita teardown propio: una prueba que llama manualmente al helper solo al final del bloque try **no** verifica qué pasa si falla a mitad del setup; sin cleanup en finally crea una nueva fuente de contaminación. Testear el test desde cada prefijo transaccional.
13. Distinguir commit con código verde y commit solo de bitácora cancelado. La cancelación del segundo run no invalida los checks del SHA previo cuando el diff confirma que no hay código modificado, pero tampoco es legítimo decir que el run cancelado pasó.
14. En test E2E con siembra histórica, el historical ID es dato de la fixture creada por la propia prueba: el teardown debe comprobar errores y nunca borrar datos preexistentes sin ID exacto.
15. RED por mutación del autor en CI es evidencia comprobable (#646 falló tests 180 y 181) pero el campo verificado_en_sha se reserva para una comprobación independiente ejecutada. Un test E2E todavía no ejecutado no puede darse por cerrado por simple lectura.


## Ronda 4 — cierre de ciclo y límites de evidencia

16. Si un E2E se diseña para probar restauración tras errores, el propio test necesita un finally externo que garantice cleanup aunque fallen la preparación, el corte intencional, las aserciones o el cleanup interno. La solución de R4 usa dos capas de finally; el exterior conserva IDs preexistentes y solo elimina la bici archivada sembrada con la restauración sin errores.
17. Separar control del flujo y prueba de detección: 13 sondas estructurales y una mutación de texto que cambia GREEN→RED aportan evidencia de estructura, pero no sustituyen RED/GREEN E2E real en staging. La ronda puede aceptarse sin bloqueantes de código y dejar un **gate operacional explícito** antes del merge; no presentar ese gate como cumplido.
18. No pedir CI nuevo por un commit meramente documental si el commit anterior de código en el mismo head tiene los siete jobs verdes; sí registrar el SHA del último código verificado y asegurar que no cambió producción entre commits. En esta ronda el código mismo tiene CI completo en verde.
19. Conservar historial: un hallazgo corregido pero sin reproducción independiente queda arreglado-sin-verificar, incluso en una ronda aceptada. No convertir todos los registros a aceptado ni inventar verificado_en_sha solo para cerrar el informe.

