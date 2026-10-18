# Lecciones de revisión — PR #414 / CC-031

1. **Control negativo no equivale a RED:** una aserción `isnt(actual,rechazo)` dentro de un savepoint mutado certifica que se produjo un bypass; no certifica que el *control original* detecte el defecto fallando. Ejecutar test original sin cambios contra la mutación y verificar un exit FAIL específico; restaurar y GREEN.
2. **Serialización nominal ≠ concurrencia:** dos UPDATE sucesivos en una conexión demuestran reglas tras transiciones de estado, no que se excluyan carreras. Para un DoD con simultaneidad, usar dos conexiones, verificación de lock y resultados persistidos; mantener separado el test secuencial, que sí aporta valor.
3. **No invalidar mejoras ya correctas:** el trigger OLD/NEW de CC-031 evita la debilidad de `WITH CHECK` que observamos en PR #410; el problema detectado hoy no exige rehacerlo, solo medir efectivamente su garantía.
4. **Histórico del contrato:** diferenciar «ficha documental de PR #413» de «implementación en PR #414», sin mantener «NO IMPLEMENTADO» como estado vigente después de merge.
5. **No se inventa AG-xx:** no fue posible enumerar todas las ramas remotas para asignar un nuevo índice único. Esperar a disponer de git para numerar cualquier lección transversal.

Hallazgos H01/H02 por análisis; los estados de CI fueron verificados en logs del SHA.
