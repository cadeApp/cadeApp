# PR #617 — T-407 · Auditoría A06

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/617 |
| Tarea | T-407 · issue #488 · Fase 4 |
| Rama | `feat/T-407-auditoria-a06` → `develop` |
| Autor | Lautaro073 |
| Base original | `a7c6d809f87804415499d7fc70aaf06349717c16` |
| SHA revisado en ronda 2 | `f4a5a1fca3b836e9ee39077e26a63a92f4da900b` |
| Estado | **Sin bloqueantes funcionales**; H03 mejora no bloqueante; gates CI/E2E pendientes |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `8116e2397d9a28504024850be4ae31913d35abdc` | H01 y H02 abiertos | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `f4a5a1fca3b836e9ee39077e26a63a92f4da900b` | H01 y H02 corregidos; H03 mejora | [Ronda 2](revisiones/ronda-2.md) |

## Estado

| ID | Hallazgo | Estado |
|---|---|
| H01 | Tono de incidentes según resultado `resolved`/`dismissed` | arreglado-verificado en funciones aisladas |
| H02 | «Volver al inicio» en página vacía con cursor y filtros | arreglado-verificado en funciones aisladas |
| H03 | Estados de incidentes sin traducción en A06 | mejora menor, abierta, no bloqueante |

**D01=B** confirmada por Lautaro073: diferir nota de inmutabilidad a T-408. No se reabre. La revisión independiente no aprobó ni mergeó esta PR.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md)

## Qué queda por hacer

1. Comprobar CI y `e2e-preview` GREEN para el código revisado, con SHA real y logs; el commit de documentación de esta ronda no obliga por sí mismo a repetir un CI verde.
2. H03 se puede resolver aparte: añadir `open`, `reviewing`, `resolved`, `dismissed` a las etiquetas de A06 y test. No impide merge por sí sola.
3. El autor hace `git pull` después del commit de revisión, sin rebase/force/amend y sin editar `docs/revision-pr/pr-617/**`.
