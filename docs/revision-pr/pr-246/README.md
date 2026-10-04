# PR #246 — T-335 · Versionar publicación Supabase Realtime para datos vivos

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/246 |
| **Tarea** | T-335 / #244 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-335-realtime-publication` → `develop` |
| **SHA funcional revisado** | `7f6cf8b81b8e9fa7e35a82de47d5456fa40556a5` |
| **Estado R1** | **CON BLOQUEANTES (1)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `7f6cf8b81b8e9fa7e35a82de47d5456fa40556a5` | 1 bloqueante + 1 mejora | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado

La implementación SQL está bien encaminada y el RED/GREEN remoto es auténtico. El bloqueo no está en la migración sino en el cierre de tarea: #244 exige una validación post-merge sobre Supabase Develop + PR #180, pero la ficha de la rama eliminó ese DoD y el PR usa `Closes #244`.

No aprobar ni mergear hasta corregir PR246-H01.
