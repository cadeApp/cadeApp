# PR #95 — T-310 · Backups, observabilidad y simulacro de restauración

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/95 |
| **Tarea** | T-310 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-310-backups-observabilidad` → `develop` |
| **Base** | `cd0e69dabd31aa6531fa212d47a90c47e86ef155` |
| **Head revisado R3** | `135f7fe120573a053a7e9127ad39b9e531e8120d` |
| **Tamaño al SHA revisado** | 26 archivos, +2458 / -30 |
| **Estado** | abierta · Draft · **CON BLOQUEANTES (2)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `56f9c968` | 11 bloqueantes + 2 decisiones aceptadas | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `369756bd` | 4 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `135f7fe1` | H01/H05/H14 cerrados; H04 operativo + H15 test | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Estado R3 |
|---|---|
| H01 | arreglado-verificado |
| H02 | arreglado-verificado |
| H03 | arreglado-verificado |
| H04 | **abierto — DoD operativo pendiente de Lautaro073** |
| H05 | arreglado-verificado |
| H06 | arreglado-verificado |
| H07 | arreglado-verificado |
| H08 | arreglado-verificado |
| H09 | aceptado por decisión de Lautaro073 |
| H10 | arreglado-verificado |
| H11 | arreglado-verificado |
| H12 | aceptado por decisión de Lautaro073 |
| H13 | arreglado-verificado |
| H14 | arreglado-verificado |
| H15 | **abierto — test de caller no entra a Discord** |

## Qué queda

1. **Agy:** corregir H15 para que el test de `publish_request` realmente atraviese un webhook Discord colgado.
2. **Lautaro073:** ejecutar el simulacro real de H04 en staging y aportar la evidencia externa antes de marcar el DoD.
3. Repetir la revisión independiente sobre el SHA que corrija H15; H04 seguirá pendiente hasta la ejecución real.

**No quedan decisiones humanas pendientes.**
