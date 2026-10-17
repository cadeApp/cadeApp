# PR #386 — T-363 · Mapa de recorrido

- PR: https://github.com/cadeApp/cadeApp/pull/386
- Autor: Lautaro073; base: develop; rama: `feat/T-363-mapa-recorrido-fallback`
- HEAD revisado en ronda 4: `f91a414ea424f9262de89be458a5b21b10c1cba5` (código de T-363 idéntico a R2; merge develop en `278c11f`)
- develop consultado: `cc7fb54bf24b33f00d06801025bae7f07429e9e4`
- Fecha: 2026-10-16; tamaño inicial: 18 archivos (+780/-194).
- Estado ronda 4: **SIN BLOQUEANTES DE CÓDIGO; PR #385 MERGEADA E INTEGRACIÓN DE DEVELOP COMPLETADA**. CI/E2E del merge `278c11f` en verde (E2E con un retry flaky ajeno a T-363). El SHA documental `f91a414` tenía db-tests en ejecución al cerrar la ronda; aguardar sus checks y los del futuro commit de revisión antes de mergear. Sin aprobación ni merge.

| Ronda | SHA | Informe |
|---|---|---|
| 1 | `20671da` | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `99e3b2a` | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `ddae874` | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `f91a414` | [Ronda 4](revisiones/ronda-4.md) |

| ID | Hallazgo | Estado |
|---|---|---|
| PR386-H01 | Límites de Google Maps URL con múltiples entregas | **ARREGLADO-VERIFICADO (R2)** |
| PR386-H02 | Viewport sin fitBounds de todos los pines | **ARREGLADO-VERIFICADO (R2)** |

Decisiones del usuario: **1-C** navegación por tramos; **2-A** excepción D15 para la apertura voluntaria de enlaces externos únicamente post-match. Las decisiones están cerradas, no sustituyen la corrección.

Ver [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md).

Antes del merge de #386: se completó la dependencia PR #385 (mergeada a develop) y el merge de develop en la rama #386 mediante `278c11f`. CI integrado run [38982843048](https://github.com/cadeApp/cadeApp/actions/runs/38982843048): 2492 unit y 2341 pgTAP, demás jobs success. E2E integrado [38982914091](https://github.com/cadeApp/cadeApp/actions/runs/38982914091): 81 Chromium PASS + un retry flaky en T-360, 3 global-settings PASS. El HEAD documental `f91a414` tiene CI run [38985572731](https://github.com/cadeApp/cadeApp/actions/runs/38985572731); el db-tests de ese run todavía estaba en curso a la hora del informe. Sin cambios sustantivos de T-363 tras la ronda 2. **No mergear sin que los checks finales del HEAD resultante de la revisión concluyan y sean verificados**, respetando advertencias de bundle. El autor no escribe `docs/revision-pr/**`.
