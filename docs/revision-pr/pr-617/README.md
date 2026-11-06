# PR #617 — T-407 · Auditoría A06

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/617 |
| Tarea | T-407 · issue #488 · Fase 4 |
| Rama | `feat/T-407-auditoria-a06` → `develop` |
| Autor | Lautaro073 |
| Base original | `a7c6d809f87804415499d7fc70aaf06349717c16` |
| Último SHA de código revisado | `7411c8656f1001738431ff9f4d7d8b66438a516a` |
| Estado | H01/H02/H03 resueltos; D06 E2E corregido estáticamente, pendiente confirmación E2E; CI nuevo en curso |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `8116e2397d9a28504024850be4ae31913d35abdc` | H01 y H02 abiertos | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `f4a5a1fca3b836e9ee39077e26a63a92f4da900b` | H01 y H02 corregidos; H03 mejora | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `d0b408f03aa7ff3e88b82401be69d5b62834e77d` | H03 corregido/verificado; gate pendiente | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `7411c8656f1001738431ff9f4d7d8b66438a516a` | D06 selector E2E corregido; gate pendiente | [Ronda 4](revisiones/ronda-4.md) |

## Estado

| ID | Hallazgo | Estado |
|---|---|
| H01 | Tono de incidentes según resultado `resolved`/`dismissed` | arreglado-verificado en funciones aisladas |
| H02 | «Volver al inicio» en página vacía con cursor y filtros | arreglado-verificado en funciones aisladas |
| H03 | Estados de incidentes localizados como A05 | arreglado-verificado (funciones extraídas + mutaciones independientes) |
| H04 | Selector global ambiguo en E2E legado T-380; alcance D06 | arreglado-sin-verificar E2E |

**D01=B** confirmada por Lautaro073: diferir nota de inmutabilidad a T-408. No se reabre. La revisión independiente no aprobó ni mergeó esta PR.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md)

## Qué queda por hacer

1. Inspeccionar logs de CI y `e2e-preview` del último SHA de código `7411c8656f1001738431ff9f4d7d8b66438a516a`: confirmar `admin-audit-filters.spec.ts`, `admin-courier-reinstate.spec.ts`, total y conclusión. En el E2E `workflow_run`, comprobar el SHA de **checkout**, no el `head_sha` de `develop`.
2. H04 no se considera `arreglado-verificado` hasta E2E real GREEN sobre el nuevo selector. El commit documental de la revisión no obliga a repetir gates por sí solo.
3. H03 sigue corregido; issue #621 se cierra **cuando** la PR entre en develop, no antes.
4. Tras el nuevo commit de revisión, el autor debe hacer `git pull`; sin rebase/force/amend ni cambios en `docs/revision-pr/**`.
