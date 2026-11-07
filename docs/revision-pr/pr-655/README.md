# PR #655 — T-429 · Streaming huérfano en E2E

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/655 |
| **Tarea / issue** | T-429, Fase 4 / #639 |
| **Autor** | @Lautaro073 (P1) |
| **Rama** | `feat/T-429-segmentos-streaming-e2e` → `develop` |
| **Base** | `15dbf93f21662082bd45ca299d271e855049482a` |
| **Tamaño original** | 8 archivos, +375/-5 |
| **Estado** | Abierta, Draft, **CON BLOQUEANTES (3)** |

## Rondas
| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `2b3576e68d8f02c492c810ea31fb47f4da35edae` | 3 abiertos | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo
| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR655-H01 | Template B sin S se interpreta como terminado | alto | abierto |
| PR655-H02 | Timeout total se reinicia por fase | medio | abierto |
| PR655-H03 | Suite no cubre helper nuevo | alto | abierto |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y script íntegro: [evidencia/comandos.md](evidencia/comandos.md).

## Qué queda por hacer
Corregir H01–H03 en la rama sin tocar el contenido de esta revisión; publicar RED→GREEN y nueva CI/E2E del SHA de código. No hay nuevos 🔵 DECISIÓN: D01=B ya consta en ficha. La descripción del PR fue corregida por el revisor sin modificar código.

## Nota de alcance
En la base `develop` no existía aún `docs/tasks/T-429.md`: se creó en esta PR; se contrastaron su alcance y archivos contra el issue #639. `mergeable=true` según GitHub; sin posibilidad de ejecutar `git merge-tree` por DNS en el clon.

## Lecciones
Ver [lecciones.md](lecciones.md). Se aplican patrones existentes; sin numeración AG nueva en esta ronda.