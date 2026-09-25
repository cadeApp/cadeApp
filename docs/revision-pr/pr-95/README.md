# PR #95 — T-310 · Backups, observabilidad y simulacro de restauración

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/95 |
| **Tarea** | T-310 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-310-backups-observabilidad` → `develop` |
| **Base** | `cd0e69dabd31aa6531fa212d47a90c47e86ef155` |
| **Head revisado R2** | `369756bd91a9757d3f97b420513e8b423d081881` |
| **Tamaño al SHA revisado** | 25 archivos, +2067 / -31 |
| **Estado** | abierta · Draft · **CON BLOQUEANTES (4)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `56f9c968` | 11 bloqueantes + 2 decisiones aceptadas | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `369756bd` | 3 hallazgos previos siguen abiertos + 1 regresión nueva | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Estado R2 |
|---|---|
| H01 | **abierto** — sanitización incompleta del contrato real |
| H02 | arreglado-verificado |
| H03 | arreglado-verificado |
| H04 | **abierto** — acta sin evidencia operativa |
| H05 | **abierto** — mutaciones rojas no registradas / test de uptime no mata quitar alerta |
| H06 | arreglado-verificado |
| H07 | arreglado-verificado |
| H08 | arreglado-verificado |
| H09 | aceptado por decisión de Lautaro073 |
| H10 | arreglado-verificado |
| H11 | arreglado-verificado |
| H12 | aceptado por decisión de Lautaro073 |
| H13 | arreglado-verificado |
| H14 | **abierto (nuevo R2)** — Discord sin timeout |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Completar H01 con una matriz de PII derivada de los campos reales del esquema, no solo pickup/dropoff.
2. Resolver H04 con evidencia real del simulacro; si no existe, el acta/DoD debe quedar pendiente.
3. Resolver H05 con mutaciones rojas registradas y una prueba que falle si se quita la alerta del health check.
4. Resolver H14 añadiendo timeout al webhook Discord.
5. Repetir revisión independiente sobre el nuevo SHA.

No quedan decisiones humanas pendientes.
