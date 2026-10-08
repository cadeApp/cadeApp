# PR #309 — T-351 · REVIEW ONLY / NEVER MERGE

**PR:** https://github.com/cadeApp/cadeApp/pull/309
**Rama:** `review/T-351-onboarding-axe` → `develop`, **Draft**, no merge.
**HEAD de código revisado:** `0a249a803a42db4e74b8ff6e7a435895f6f02fca`
**Base:** `8750d3f86e9abf0b9f4ebba7a3ba11917e11baa3` · **Fuente T-309:** `3ff8984`.
**Estado:** **CON BLOQUEANTES DE EVIDENCIA (2)**. No se detectaron nuevas fallas de código en las dos clases modificadas.

## Rondas
| Ronda | SHA | Estado | Informe |
|---|---|---|---|
| 1 | `0a249a803a42db4e74b8ff6e7a435895f6f02fca` | 2 bloqueos de evidencia | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos
| ID | Estado | Pendiente |
|---|---|---|
| PR309-H01 | abierto | GREEN E2E exact-head, Vercel sin cuota |
| PR309-H02 | abierto | RED reales de `htmlFor` y tarjeta DNI frente ausente, cada uno con revert + GREEN |

[JSONL](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

Esta PR solo prueba T-351 sobre el código E2E de T-309. Tras documentar los RED/GREEN exigidos y otra revisión independiente, **cerrar sin mergear**. El arreglo productivo está en [PR #310](https://github.com/cadeApp/cadeApp/pull/310).
