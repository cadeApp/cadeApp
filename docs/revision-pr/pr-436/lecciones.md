# Lecciones de PR #436 — CC-033

**Fuente:** 3 hallazgos de alcance exclusivamente documental ([hallazgos.jsonl](hallazgos.jsonl)). No se añade un número AG ni se modifica `AGENTS.md` solo por esta PR.

## Patrones observados

- **P06 — Enumeración incompleta (H01):** un guard puede revisar el estado de aprobación sin mirar el estado de *onboarding*. Cuando se ofrece una operación «posterior», documentar explícitamente la frontera temporal (en este caso `vehicle_type IS NOT NULL`) y el lugar autoritativo de la validación.
- **P08 — El control no cubre lo declarado (H02):** describir locks y races no equivale a exigir evidencia de dos sesiones reales. Un test secuencial no detecta necesariamente deadlocks o ventanas de simultaneidad.
- **P15 — Entregable declarado pero no ejecutable en todas las etapas (H03):** el rollback de una RPC debe considerar que una UI desplegada ya la consume.

## Acción propuesta si reincide

En la plantilla de CC para nuevas RPC que afecten onboarding, pedir:
1. regla explícita para actor + estado de onboarding y aserción de caso incompleto;
2. matriz de carreras que identifique una prueba concurrente real cuando la operación serializa filas compartidas;
3. dos rollback diferenciados: antes de la UI consumidora y después de desplegarla.

**No generalizar a nuevas reglas de repositorio todavía:** tres observaciones de una misma PR no prueban reincidencia entre PRs.

## Limitación

Esta ronda no ejecutó PostgreSQL, E2E ni Vitest. Los riesgos y omisiones son comprobaciones de coherencia documental y lectura estática, no fallos runtime reproducidos.
