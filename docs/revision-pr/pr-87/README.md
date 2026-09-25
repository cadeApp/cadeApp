# PR #87 — T-118 · Integración visual Stitch, shells y navegación canónica

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/87 |
| **Tarea** | T-118 |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-118-integracion-visual-stitch → develop |
| **SHA R7 revisado** | `25fa07856ac92bfcb8999ce213c71f688290e6c9` |
| **develop** | `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121` |
| **Estado** | **CON BLOQUEANTES (3)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `027f39e` | 12 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `225cd08` | 13 bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `6c321d0` | 8 bloqueantes | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `cf6fa22` | 4 bloqueantes | [ronda-4.md](revisiones/ronda-4.md) |
| 5 | `bdece0f` | 1 bloqueante | [ronda-5.md](revisiones/ronda-5.md) |
| 6 | `feb3c7f` | SIN BLOQUEANTES | [ronda-6.md](revisiones/ronda-6.md) |
| 7 | `25fa078` | **3 bloqueantes (regresiones post-mejoras)** | [ronda-7.md](revisiones/ronda-7.md) |

## Estado actual

| Estado | IDs |
|---|---|
| Abiertos | R05, R06, H21 |
| Arreglados-verificados | H01–H20, R01–R04 |
| Aceptados por decisión P1 | A01, A02, A03 |

## Nota

Las mejoras post-R6 sí consiguieron el presupuesto de First Load JS de Regla 25 en todas las rutas merchant/courier, pero introdujeron dos regresiones funcionales y dejaron el body desactualizado. No mergear hasta revalidar esos tres puntos.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · evidencia: [evidencia/comandos.md](evidencia/comandos.md)
