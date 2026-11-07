# PR #655 — T-429 · Streaming huérfano en E2E

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/655 |
| **Tarea / issue** | T-429, Fase 4 / #639 |
| **Autor** | @Lautaro073 (P1) |
| **Rama** | `feat/T-429-segmentos-streaming-e2e` → `develop` |
| **Base** | `15dbf93f21662082bd45ca299d271e855049482a` |
| **Tamaño original** | 8 archivos, +375/-5 |
| **Estado** | Abierta, Draft, **SIN BLOQUEANTES — ronda 2** |

## Rondas
| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `2b3576e68d8f02c492c810ea31fb47f4da35edae` | 3 abiertos | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `002797727bbb564b9c99f35050dfbfecab4fb108` | 3 cerrados, 0 nuevos | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo
| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR655-H01 | Template B sin S se interpreta como terminado | alto | arreglado-verificado en `00279772` |
| PR655-H02 | Timeout total se reinicia por fase | medio | arreglado-verificado en `00279772` |
| PR655-H03 | Suite no cubre helper nuevo | alto | abierto |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y script íntegro: [evidencia/comandos.md](evidencia/comandos.md).

## Qué queda por hacer
H01–H03 cerrados por comprobación independiente sobre `002797727bbb564b9c99f35050dfbfecab4fb108` y CI/E2E del mismo SHA. **La revisión queda sin bloqueantes.** Lautaro073 decide el merge; el revisor no aprueba ni mergea. Intermitencia local de la primera ejecución de `pnpm test` sin nombres de tests: observación de seguimiento, no regresión reproducida. No hay nuevas 🔵 DECISIÓN: D01=B vigente.

## Nota de alcance
En la base `develop` no existía aún `docs/tasks/T-429.md`: se creó en esta PR; se contrastaron su alcance y archivos contra el issue #639. `mergeable=true` según GitHub; sin posibilidad de ejecutar `git merge-tree` por DNS en el clon.

## Lecciones
Ver [lecciones.md](lecciones.md). Se aplican patrones existentes; sin numeración AG nueva en esta ronda.