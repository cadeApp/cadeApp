# PR #386 — T-363 · Mapa de recorrido

- PR: https://github.com/cadeApp/cadeApp/pull/386
- Autor: Lautaro073; base: develop; rama: `feat/T-363-mapa-recorrido-fallback`
- HEAD revisado: `20671da159f9ff0caf83c88abc623f2998ced954`
- develop consultado: `01054b148e9c11eda1358e591abc6e0b82a5af94`
- Fecha: 2026-10-16; tamaño inicial: 18 archivos (+780/-194).
- Estado: **CON BLOQUEANTES (2)**; sin aprobación ni merge.

| Ronda | SHA | Informe |
|---|---|---|
| 1 | `20671da` | [Ronda 1](revisiones/ronda-1.md) |

| ID | Hallazgo | Estado |
|---|---|---|
| PR386-H01 | Límites de Google Maps URL con múltiples entregas | ABIERTO |
| PR386-H02 | Viewport sin fitBounds de todos los pines | ABIERTO |

Decisiones del usuario: **1-C** navegación por tramos; **2-A** excepción D15 para la apertura voluntaria de enlaces externos únicamente post-match. Las decisiones están cerradas, no sustituyen la corrección.

Ver [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md).

Antes de merge: corregir ambos, nueva ronda independiente, CI y E2E de SHA actualizado, resolver PR #385 (revert del push documental erróneo) y sincronizar develop mediante merge sin perder la ficha/bitácora T-363. El autor no puede escribir `docs/revision-pr/**`.
