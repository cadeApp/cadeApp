# PR #386 — T-363 · Mapa de recorrido

- PR: https://github.com/cadeApp/cadeApp/pull/386
- Autor: Lautaro073; base: develop; rama: `feat/T-363-mapa-recorrido-fallback`
- HEAD revisado en ronda 3: `ddae87422246df38ad7fa96142260993125a6f4f` (código idéntico al verificado en ronda 2: `99e3b2a`)
- develop consultado: `cd9071110107c393537bc7a71307b2f806cf176c`
- Fecha: 2026-10-16; tamaño inicial: 18 archivos (+780/-194).
- Estado ronda 3: **SIN BLOQUEANTES DE CÓDIGO; CI Y E2E DEL SHA `ddae874` VERDES**. Pendiente exclusivamente secuencia de integración PR #385 → merge de `develop` → revalidación sobre SHA combinado. Sin aprobación ni merge.

| Ronda | SHA | Informe |
|---|---|---|
| 1 | `20671da` | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `99e3b2a` | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `ddae874` | [Ronda 3](revisiones/ronda-3.md) |

| ID | Hallazgo | Estado |
|---|---|---|
| PR386-H01 | Límites de Google Maps URL con múltiples entregas | **ARREGLADO-VERIFICADO (R2)** |
| PR386-H02 | Viewport sin fitBounds de todos los pines | **ARREGLADO-VERIFICADO (R2)** |

Decisiones del usuario: **1-C** navegación por tramos; **2-A** excepción D15 para la apertura voluntaria de enlaces externos únicamente post-match. Las decisiones están cerradas, no sustituyen la corrección.

Ver [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md).

Antes del merge de #386: PR #385 continúa abierta (revert documental separado). Después de que Lautaro073 decida integrarla, fusionar `origin/develop` con **merge, no rebase**, conservar la ficha/bitácora T-363, ejecutar `git merge-tree`/fichas/checks y E2E del SHA integrado. El SHA `ddae874` tiene CI [38975035726](https://github.com/cadeApp/cadeApp/actions/runs/38975035726) SUCCESS, incluidos 2464 unit y 2341 pgTAP; E2E [38975178318](https://github.com/cadeApp/cadeApp/actions/runs/38975178318) con checkout exacto `ddae874`: 81 Chromium y 3 global-settings PASS. `bundle-budget` sigue WARNING de tamaño en rutas `/trips/[id]` (225 kB) y `/merchant/requests/[id]` (192 kB), aun con job verde. No atribuir a T-363 un fallo `next/font` anterior que no reapareció. El autor no escribe `docs/revision-pr/**`.
