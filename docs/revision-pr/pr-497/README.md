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
| **Estado** | SIN BLOQUEANTES DOCUMENTALES en ronda 2; CI pendiente de cierre |

## Rondas

| Ronda | SHA revisado | Bloqueantes | Informe |
|---|---|---:|---|
| 1 | `b845f260aad15652c566a7d0f37b6c27a2e8b58c` | 3 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `74ba30a0e46ceda4f1c093c6e0ccbe7922d0d738` | 0 nuevos; 3 corregidos | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Resumen | Severidad | Estado |
|---|---|---|---|
| PR497-H01 | Caso 49 enumerado en contrato y T-390 | alto | corregido por inspección documental |
| PR497-H02 | T-408/T-409 trasladadas íntegramente a PR #489 | alto | verificado por inspección cruzada |
| PR497-H03 | DoD T-390/T-391 igual al plan | alto | verificado mediante comparación ejecutada |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Actualización de ronda 2

Revisé el HEAD `74ba30a0e46ceda4f1c093c6e0ccbe7922d0d738` después de los commits del autor. Los tres bloqueantes documentales se corrigieron: H01 por enumeración completa de 46/49/50/51; H02 trasladando las fichas y las filas a PR #489; H03 por igualdad literal DoD-plan. La ejecución independiente de PostgreSQL corresponde a **T-390**, no a este CC documental. Ver [ronda 2](revisiones/ronda-2.md). Los checks de CI del nuevo HEAD estaban aún en curso al registrar la ronda; no afirmo su resultado final.

## Qué queda

1. Completar H01 en CC-036, T-390 y fila T-390; después modificar casos 46, 49, 50 y 51 de `rls_matrix.sql` durante la implementación de T-390.
2. Integrar PR #489 (sección Fase 4) **cuando esté revisada/mergeada**; añadir filas T-408 y T-409 en `docs/implementation-plan.md`.
3. Sincronizar el primer checkbox DoD de T-390/T-391 con las celdas de DoD del plan; conservar la especificación detallada como los siguientes ítems.
4. Revalidación independiente sobre nuevo SHA antes de merge.

**Decisiones nuevas pendientes:** ninguna. La aceptación de riesgos admin y Fase 4 consta en la bitácora de T-312 del PR #491; no fue reabierta.
