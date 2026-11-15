# Lecciones — PR #748 / T-438 / CC-053

**Fuente:** 9 hallazgos de ronda 1 (8 bloqueantes, 1 mejora) en una PR **solo documental**. Ver [hallazgos.jsonl](hallazgos.jsonl).

## Patrón dominante

Un CC puede ser extenso y cubrir seguridad, carreras, impacto y rollout, pero contener un **desajuste entre contratos vigentes, archivos concretos y comprobaciones de aceptación**: nombre de decisión distinto al de la RPC, historia de eventos ampliada sin todas las fronteras/consumidores, y transición de esquema que rompe al lector desplegado. No son defectos de SQL nuevo (todavía no existe), sino defectos que el documento propagaría a una implementación.

## Lecciones existentes reafirmadas (sin numeración nueva)

- **pr-56/AG-37 — enumerar la clase completa:** ocho funciones de locks **más** una de historial; enumerar también todos los componentes y tests que consumen la misma unión discriminada. No alcanza revisar solo el componente padre `cancellation-history-card.tsx`.
- **pr-63/AG-69 — una transición nueva hereda todas sus pruebas:** `matched → published` por suspensión necesita todos sus efectos de fila, eventos, auditoría, créditos, seguridad y tests de mutaciones RED; no solo `status`.
- **pr-68/AG-74 — guards y efectos atómicos bajo concurrencia:** cada RPC debe tomar la fila de courier antes de request/offer en su rama afectada, y los conteos y auditorías deben salir de las filas efectivamente modificadas.
- **pr-68/AG-75 — las mutaciones del autor no reemplazan las del revisor:** la revisión de la futura implementación debe agregar casos ajenos a los que armó el autor, especialmente omisión de `decided_at`, `cancel_reason`, `unconsume_publication` y actor visible en historial.
- **pr-63/AG-71 — CC se reserva solo en develop:** el número CC-053 se revalidará en cada ronda contra develop; un CC en Draft no tiene reserva de numeración.

## Sugerencia de control de proceso

Antes de cerrar un CC que agrega una variante de un payload: 1) enumerar productores de eventos, consumidores y tests de todos los tipos; 2) reconciliar rutas exactas con ficha/plan; 3) probar la matriz `viejo/nuevo` de schema y UI; 4) registrar **en la fuente previa** toda enmienda autorizada a una decisión ratificada. La evidencia de «Actual» tiene que citar la versión vigente de la RPC, no solo un contrato histórico.

**No se propone AG-xx nueva.** Además de evitar colisiones de numeración entre ramas, una sola PR documental no justifica modificar `AGENTS.md`. Se consolidará el aprendizaje al cerrar los hallazgos con verificación independiente. Los controles RED→GREEN de SQL y concurrencia quedan pendientes de la PR real T-438, sin falsificar resultados.


## Ronda 2 — 2026-11-15 · Cierre documental

Los 9 hallazgos de la ronda 1 están corregidos por inspección en `4129bf6f`, sin hallazgos nuevos. No se creó otra regla AG ni se modificó `AGENTS.md`.

**Lección positiva sobre compatibilidad de contratos:** la recomendación de «dos PRs» era una forma válida de evitar romper al lector viejo, pero **no era la única**. El autor diseñó un contrato con evento opt-in y salida legacy por defecto, más fallback del servidor ante `PGRST202`. Es una solución compatible de **una PR** en el papel y se debe aceptar si la implementación comprueba los cuatro cuadrantes en CI. Evitar recomendaciones basadas únicamente en el número de despliegues; comprobar la matriz cliente/esquema antes de exigir una excepción a la regla 50.

**Tareas de revisión futura, no nuevos hallazgos documentales:** verificar PostgREST schema cache después de la nueva firma; que el primer fetch y «Ver más» soliciten el evento; y demostrar los cinco escenarios con SQL real, RED de mutaciones no tautológicas y E2E de Develop. No se ejecutó DB en esta revisión.
