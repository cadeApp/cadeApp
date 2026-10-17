# PR #358 — T-356 · Recarga de documentos rechazados

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/358 |
| **Tarea** | T-356 · fase 3 · issue #343 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-356-recarga-documentos-rechazados` → `develop` |
| **Base al revisar** | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| **Head revisado** | `d0cf083dbb42beacc1f0bba4e4d5a4b1fce78408` |
| **Cambio previo a esta revisión** | 1 archivo: `docs/tasks/log/T-356.md`, +13/-0 |
| **Estado** | Draft bloqueada por contrato — issue #363 |

## Rondas

| Ronda | SHA revisado | Bloqueantes de arquitectura | Informe |
|---|---|---|---|
| 1 | `d0cf083dbb42beacc1f0bba4e4d5a4b1fce78408` | 2 (propuesta preimplementación, no fallos de código introducidos) | [Ronda 1](revisiones/ronda-1.md) |

## Hallazgos

| ID | Qué exige | Estado |
|---|---|---|
| PR358-H01 | Cerrar inserciones directas y reemplazar solo documento rechazado por RPC+RLS | Abierto: CC #363 |
| PR358-H02 | Identificar única versión vigente para courier y admin | Abierto: CC #363 |

**Decisiones de producto cerradas por Lautaro073 el 2026-10-15:** 1C, 2C, 3B, 4C. Sin decisiones pendientes en estas cuatro preguntas.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md) · [Prompt completo para agy](prompt-agy.md).

## Próximo paso
Crear, revisar y mergear primero el CC #363 en PR independiente, reconciliar ficha desde `develop` y recién entonces retomar esta PR para código+pruebas+E2E. No mergear #358 todavía.
## Ronda 2 — 2026-10-17
**CON BLOQUEANTES**. SHA funcional affe835b, documental 78b2e79b. R01 ALTO replay de RPC/Storage; R02 MEDIO estado padre stale; R03 MEDIO E2E sin rechazo admin real. CI autor PASS, E2E cancelled/error. [Informe](revisiones/ronda-2.md) · [Evidencia](evidencia/ronda-2.md) · [Hallazgos](hallazgos.jsonl). Históricos H01/H02 arreglado-sin-verificar. PR Draft/no mergear. No exigir CI por revisión documental sola.
