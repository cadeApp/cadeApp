# PR #617 — T-407 · Auditoría A06

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/617 |
| Tarea | T-407 · issue #488 · Fase 4 |
| Rama | `feat/T-407-auditoria-a06` → `develop` |
| Autor | Lautaro073 |
| Base original | `a7c6d809f87804415499d7fc70aaf06349717c16` |
| Último SHA de código revisado | `7411c8656f1001738431ff9f4d7d8b66438a516a` |
| Estado | **ACEPTADA SIN BLOQUEANTES · CI y E2E GREEN · APTA PARA MERGE POR LAUTARO073** (sin GitHub Approve ni Merge del revisor) |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `8116e2397d9a28504024850be4ae31913d35abdc` | H01 y H02 abiertos | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `f4a5a1fca3b836e9ee39077e26a63a92f4da900b` | H01 y H02 corregidos; H03 mejora | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `d0b408f03aa7ff3e88b82401be69d5b62834e77d` | H03 corregido/verificado; gate pendiente | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `7411c8656f1001738431ff9f4d7d8b66438a516a` | D06 selector E2E corregido; gate pendiente | [Ronda 4](revisiones/ronda-4.md) |
| 5 | `7d966e77bc3dbd33e74e28e4f79822a30d4e8373` (HEAD; solo docs desde `7411c865`) | H04 verificado en E2E; aceptación | [Ronda 5](revisiones/ronda-5.md) |

## Estado

| ID | Hallazgo | Estado |
|---|---|
| H01 | Tono de incidentes según resultado `resolved`/`dismissed` | arreglado-verificado en funciones aisladas |
| H02 | «Volver al inicio» en página vacía con cursor y filtros | arreglado-verificado en funciones aisladas |
| H03 | Estados de incidentes localizados como A05 | arreglado-verificado (funciones extraídas + mutaciones independientes) |
| H04 | Selector global ambiguo en E2E legado T-380; alcance D06 | **arreglado-verificado en Playwright real** |

**D01=B** confirmada por Lautaro073: diferir nota de inmutabilidad a T-408. No se reabre. La revisión independiente no aprobó ni mergeó esta PR.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md)

## Gate final comprobado

- **CI:** run [42151756302, intento 2](https://github.com/cadeApp/cadeApp/actions/runs/42151756302), SHA `7d966e77bc3dbd33e74e28e4f79822a30d4e8373`, **7/7 jobs success**. Unit **3654/3654**; pgTAP **3396/3396**; build, lint, typecheck, audit y bundle-budget GREEN. Approval-policy [42151754006](https://github.com/cadeApp/cadeApp/actions/runs/42151754006) success.
- **E2E:** [42154936711](https://github.com/cadeApp/cadeApp/actions/runs/42154936711), checkout exacto `7d966e77bc3dbd33e74e28e4f79822a30d4e8373`: **117 passed** Chromium y **6 passed** global-settings; `admin-audit-filters.spec.ts` ✓ 18,1 s y `admin-courier-reinstate.spec.ts` ✓ primer intento 28,4 s.
- Los jobs lint/bundle-budget emiten **avisos no bloqueantes** sobre formato global (333 archivos) y `/admin/audit` (267 kB vs 180 kB). No se imputa una regresión a esta PR sin contraste de base.
- Desde el último código `7411c865` hasta el SHA del gate solo cambió `docs/revision-pr/pr-617/**`. Un nuevo commit documental del revisor no obliga a volver a correr CI/E2E.

## Acción pendiente

**Solo humana:** Lautaro073 decide el merge. No se aprobó ni mergeó desde esta revisión. Hacer `git pull` si se continúa trabajando en la rama; no rebase/force/amend. El issue [#621](https://github.com/cadeApp/cadeApp/issues/621) debe cerrarse después de que H03 esté integrado en `develop`. D01=B mantiene la nota de inmutabilidad diferida a T-408.
