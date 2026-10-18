# Lecciones de revisión — PR #414 / CC-031

1. **Control negativo no equivale a RED:** una aserción `isnt(actual,rechazo)` dentro de un savepoint mutado certifica que se produjo un bypass; no certifica que el *control original* detecte el defecto fallando. Ejecutar test original sin cambios contra la mutación y verificar un exit FAIL específico; restaurar y GREEN.
2. **Serialización nominal ≠ concurrencia:** dos UPDATE sucesivos en una conexión demuestran reglas tras transiciones de estado, no que se excluyan carreras. Para un DoD con simultaneidad, usar dos conexiones, verificación de lock y resultados persistidos; mantener separado el test secuencial, que sí aporta valor.
3. **No invalidar mejoras ya correctas:** el trigger OLD/NEW de CC-031 evita la debilidad de `WITH CHECK` que observamos en PR #410; el problema detectado hoy no exige rehacerlo, solo medir efectivamente su garantía.
4. **Histórico del contrato:** diferenciar «ficha documental de PR #413» de «implementación en PR #414», sin mantener «NO IMPLEMENTADO» como estado vigente después de merge.
5. **No se inventa AG-xx:** no fue posible enumerar todas las ramas remotas para asignar un nuevo índice único. Esperar a disponer de git para numerar cualquier lección transversal.

**Ronda 1 (histórico):** hallazgos H01/H02 inicialmente por análisis; después se contrastó en la ronda 2 el código y la ejecución real de CI (SHA exacto).

## Ronda 2 (2026-10-18)

- La regla de **misma prueba bajo mutación** sí quedó respaldada por control automatizado: línea explícita de CI que ejecuta suite íntegra de 49 tests y confirma `PASS → FAIL específico → PASS`. La prueba positiva `isnt` se mantuvo como evidencia complementaria, sin confundirla con RED.
- La **concurrencia multisesión** quedó automatizada con dos procesos `psql` y comprobación de `wait_event_type='Lock'`, y se documentó el carácter secuencial de los antiguos casos pgTAP. Evita sobredeclarar capacidades de pruebas.
- Mantener actualizado **el cuerpo de la PR**: después de incorporar un workflow nuevo, el autor dejó un SHA anterior y «no se modificaron workflows». Esa mejora de trazabilidad no afecta el resultado de las suites pero dificulta la decisión de merge.
- Un **E2E bloqueado por migración todavía no desplegada** es diferente de un test E2E fallido en ejecución y diferente de un E2E verde. Evitar declarar cerrada la tarea T-355 hasta la migración y nueva ronda.
