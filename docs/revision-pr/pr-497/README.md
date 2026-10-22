# PR #497 — CC-036 / T-390, T-391, T-408 y T-409 · fichas de seguridad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/497 |
| **Tarea principal** | CC-036, T-390 y T-391; fichas diferidas T-408 y T-409 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-036-offers-rpc-only` → `develop` |
| **Base** | `824c4fdb8a4277220e14b575eaf6a15e40df8406` |
| **SHA revisado** | `b845f260aad15652c566a7d0f37b6c27a2e8b58c` |
| **Tamaño original** | 6 archivos, +552 líneas, 0 eliminaciones |
| **Estado** | CON BLOQUEANTES (3); no aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Bloqueantes | Informe |
|---|---|---:|---|
| 1 | `b845f260aad15652c566a7d0f37b6c27a2e8b58c` | 3 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Resumen | Severidad | Estado |
|---|---|---|---|
| PR497-H01 | Caso 49 de `rls_matrix.sql` queda sin adaptar al REVOKE DELETE | alto | abierto |
| PR497-H02 | Faltan filas T-408/T-409 de Fase 4 en §8 | alto | abierto |
| PR497-H03 | Primer DoD de T-390/T-391 desincronizado del plan | alto | abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Qué queda

1. Completar H01 en CC-036, T-390 y fila T-390; después modificar casos 46, 49, 50 y 51 de `rls_matrix.sql` durante la implementación de T-390.
2. Integrar PR #489 (sección Fase 4) **cuando esté revisada/mergeada**; añadir filas T-408 y T-409 en `docs/implementation-plan.md`.
3. Sincronizar el primer checkbox DoD de T-390/T-391 con las celdas de DoD del plan; conservar la especificación detallada como los siguientes ítems.
4. Revalidación independiente sobre nuevo SHA antes de merge.

**Decisiones nuevas pendientes:** ninguna. La aceptación de riesgos admin y Fase 4 consta en la bitácora de T-312 del PR #491; no fue reabierta.
