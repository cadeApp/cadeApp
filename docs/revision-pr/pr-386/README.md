# PR #386 — T-363 · Mapa de recorrido

- PR: https://github.com/cadeApp/cadeApp/pull/386
- Autor: Lautaro073; base: develop; rama: `feat/T-363-mapa-recorrido-fallback`
- HEAD revisado: `20671da159f9ff0caf83c88abc623f2998ced954`
- develop consultado: `01054b148e9c11eda1358e591abc6e0b82a5af94`
- Fecha: 2026-10-16; tamaño inicial: 18 archivos (+780/-194).
- Estado ronda 2: **H01/H02 cerrados técnicamente**; **merge bloqueado por CI build FAIL y dependencia PR #385**; sin aprobación ni merge.

| Ronda | SHA | Informe |
|---|---|---|
| 1 | `20671da` | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `99e3b2a` | [Ronda 2](revisiones/ronda-2.md) |

| ID | Hallazgo | Estado |
|---|---|---|
| PR386-H01 | Límites de Google Maps URL con múltiples entregas | **ARREGLADO-VERIFICADO (R2)** |
| PR386-H02 | Viewport sin fitBounds de todos los pines | **ARREGLADO-VERIFICADO (R2)** |

Decisiones del usuario: **1-C** navegación por tramos; **2-A** excepción D15 para la apertura voluntaria de enlaces externos únicamente post-match. Las decisiones están cerradas, no sustituyen la corrección.

Ver [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md).

Antes de merge: conseguir CI build verde sobre HEAD actualizado (el run 38967624235 sobre `99e3b2a` falló por `next/font` en `src/app/layout.tsx`), resolver PR #385 (revert del push documental erróneo), sincronizar develop mediante merge sin perder ficha/bitácora T-363 y verificar los checks posteriores. E2E 38967749373 verificó `99e3b2a`: chromium 81/81 y global-settings 3/3. Reporte de R2 y mutaciones independientes están en los entregables. No se atribuye el error `next/font` a cambios de esta tarea. El autor no puede escribir `docs/revision-pr/**`.
