# PR #458 — T-380 · Reactivar repartidores desde admin

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/458 |
| Tarea | T-380 · Fase 3 · issue #442 |
| Autor | @Lautaro073 |
| Rama | `feat/T-380-admin-reinstate-courier` → `develop` |
| Base al revisar | `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b` |
| Estado | **Ronda 2: SIN BLOQUEANTES técnicos**; pendiente el cierre de CI oficial del SHA de código |

## Rondas

| Ronda | SHA de código revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `961d6ea6555f42193fec806d2d216adbee2c6893` | 2 bloqueantes, 0 decisiones | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `acd94ce13e318a279e2926c5dc4dce8200912c02` | 0 bloqueantes nuevos, H01/H02 corregidos | [ronda-2.md](revisiones/ronda-2.md) |

## Estado de hallazgos

| ID | Hallazgo | Estado |
|---|---|---|
| PR458-H01 | Sleep fijo en test de doble envío | arreglado-verificado (control estático propio + Vitest oficial; RED dinámico documentado por autor) |
| PR458-H02 | Evidencia M1–M8 incompleta | arreglado-verificado (cotejo propio de 9 preimágenes y formato + CI; sin reejecutar mutaciones Vitest) |

## Condición operativa de merge

La revisión del código queda **SIN BLOQUEANTES**. Antes de mergear, confirmar `db-tests` y `e2e-preview` verdes en el SHA `acd94ce13e318a279e2926c5dc4dce8200912c02`, y que el HEAD/base no cambiaron. El CI anterior de `11f626b5` fue verde, pero no sustituye afirmar el estado de un job pendiente. El commit documental de esta revisión no requiere por sí solo un CI nuevo. La PR permanece en Draft; la revisión no la aprueba ni mergea.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).
