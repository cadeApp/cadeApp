# PR #87 — T-118 · Integración visual Stitch, shells y navegación canónica

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/87 |
| **Tarea** | T-118 |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-118-integracion-visual-stitch → develop |
| **SHA R5 revisado** | `bdece0f187e0f6d9dd480844c5942008d8391f8d` |
| **develop** | `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121` |
| **Tamaño actual** | 95 archivos, +6411 / -799 |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `027f39e` | 12 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `225cd08` | 13 bloqueantes · 0 decisiones pendientes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `6c321d0` | 8 bloqueantes | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `cf6fa22` | 4 bloqueantes | [ronda-4.md](revisiones/ronda-4.md) |
| 5 | `bdece0f` | 1 bloqueante | [ronda-5.md](revisiones/ronda-5.md) |

## Estado resumido después de R5

| Estado | IDs |
|---|---|
| Parcial | H09 |
| Arreglados-verificados | H01–H08, H10–H20, R01–R04 |
| Aceptados por decisión P1 | A01, A02 |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. H09: cerrar la clase de navegación indirecta (objetos `href:`, helpers que devuelven rutas, navegación por variables) o cubrir esos productores con pruebas funcionales/mutaciones que hagan imposible introducir una ruta inexistente.
2. Con H09 en cero: ejecutar la batería independiente y abrir/inspeccionar CI del SHA exacto.

## Nota de entorno

La revisión operó sobre el árbol remoto por GitHub API. No se atribuye verde independiente a typecheck/lint/test/build. CI no se abrió porque queda un bloqueante.

## Decisiones de alcance vigentes

A01/A02 siguen aceptadas por decisión explícita de Lautaro/P1.
