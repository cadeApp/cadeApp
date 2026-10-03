# PR #228 — T-327 · El gate confiable corre notifications si el SHA lo trae

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/228 |
| **Tarea** | T-327 (Fase 3) · Issue #205 · habilita T-307 / PR #180 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/e2e-notifications-gate` → `develop` |
| **Base** | `2e43d71` (1 ahead / 0 behind) |
| **Tamaño** | 3 archivos, +18 / −2 |
| **Estado** | abierta · CON BLOQUEANTES (3) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `a3d13d72a440f2523698b83ce93d5330469cc3af` | 3 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | La aserción no exige que el bloque esté antes de la invocación chromium (M2/M3 sobreviven) | medio | abierto |
| H02 | `e2e-staging.yml` fuera del alcance de T-327 · decisión P1: autorizar y anotar | medio | abierto |
| H03 | Sin informe en el cuerpo, sin checks y bitácora sin la sesión (`approval-policy` rojo) | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. H01: ordenar las aserciones de los dos tests (notifications y request-states) y mostrar M2/M3 en rojo y después en verde.
2. H02: anotar en `docs/tasks/T-327.md` la excepción de alcance autorizada.
3. H03: bitácora de T-327, checks pegados y bloque del informe en el cuerpo.
4. Re-ejecutar `build`: el rojo es `next/font` (red del runner), no esta PR.
5. Ronda 2.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md).
