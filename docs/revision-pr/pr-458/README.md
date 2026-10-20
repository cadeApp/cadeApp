# PR #458 — T-380 · Reactivar repartidores desde admin

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/458 |
| Tarea | T-380 · Fase 3 · issue #442 |
| Autor | @Lautaro073 |
| Rama | `feat/T-380-admin-reinstate-courier` → `develop` |
| SHA revisado | `961d6ea6555f42193fec806d2d216adbee2c6893` |
| Base al revisar | `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b` |
| Diff | 10 archivos · +617 / -30 |
| Estado | Ronda 1: **CON BLOQUEANTES (2)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `961d6ea6555f42193fec806d2d216adbee2c6893` | 2 bloqueantes, 0 decisiones | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Síntesis | Severidad | Estado |
|---|---|---|---|
| PR458-H01 | Sleep fijo en prueba de doble envío | medio | abierto |
| PR458-H02 | Mutaciones RED/GREEN no reproducibles con la bitácora | medio | abierto |

## Para continuar

1. Autor: seguir **únicamente** el prompt adjunto al comentario de cierre en la PR; no editar esta carpeta de revisión.
2. Nueva ronda independiente después del push; no merge ni aprobación mientras haya bloqueantes.
3. CI de código verde en `11f626b5`; `961d6ea6555f42193fec806d2d216adbee2c6893` solo modificó la bitácora desde ese SHA y las corridas del nuevo HEAD estaban en curso cuando se inspeccionó. El cambio de bitácora **no exige repetir CI** por sí solo.

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · [comandos](evidencia/comandos.md) · [lecciones](lecciones.md).
