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
