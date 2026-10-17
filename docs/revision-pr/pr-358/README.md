# PR #358 — T-356 · Recarga de documentos rechazados

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/358 |
| **Tarea** | T-356 · fase 3 · issue #343 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-356-recarga-documentos-rechazados` → `develop` |
| **Base al revisar** | `711a2f7054d77fd664d3ec09b3bbdd24efb88476` |
| **Head revisado** | `157b492dc708a70795cca4cee0c87ba87b57c356` |
| **Cambio previo a esta revisión** | 1 archivo: `docs/tasks/log/T-356.md`, +13/-0 |
| **Estado** | Draft; Ronda 4 con bloqueante H06; E2E del HEAD en ejecución |

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

## Ronda 3 — 2026-10-17

| Ronda | SHA revisado | Resultado | Evidencia |
|---|---|---|---|
| 3 | `af4838a6cda959288651f54c2b93e3c75aa33441` | **CON BLOQUEANTES H03/H04/H05**; R01 parcial (riesgo #399 separado), R02/R03 arreglado-sin-verificar | [Informe](revisiones/ronda-3.md) / [Evidencia](evidencia/comandos.md) |

**Decisión A:** [issue #399](https://github.com/cadeApp/cadeApp/issues/399), reconciliación de Storage huérfano, bloquea promoción CC-025 a staging/main pero no merge a develop de la UI si H03/H04/H05 pasan. E2E 83/83 Chromium + 3/3 visual en [run 39040606398](https://github.com/cadeApp/cadeApp/actions/runs/39040606398) SHA exacto; no mutaciones del revisor. PR aún Draft, mergeable dirty (58 commits behind). No exigir CI por commit documental solo; sí por merge funcional/correcciones.

## Ronda 4 — 2026-10-17

**Resultado: CON BLOQUEANTE H06 ALTO** (getDocumentExtension toma ext de nombre y crea `license_<ts>.jfif` para MIME JPEG, rechazado por CC-025 tras posible subida Storage). SHA funcional `157b492d`; R3 H03/H04/H05 `arreglado-sin-verificar` por inspección + CI del autor, merge con develop clean. CI 39047554976 PASS, E2E HEAD 39047622636 estaba `in_progress` al revisar; no confundir con 83/83 del SHA anterior. [Informe R4](revisiones/ronda-4.md) · [Evidencia](evidencia/comandos.md) · [Hallazgos](hallazgos.jsonl). Limpieza de huérfanos [T-370 #399](https://github.com/cadeApp/cadeApp/issues/399) es gate pre-staging/main, no de develop. No aprobar/mergear PR #358 aún.

## Ronda 5 — 2026-10-17

**Sin nuevos bloqueantes de código; gate E2E del HEAD pendiente.** HEAD revisado `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad` (R5); `PR358-H06` **arreglado-verificado** con prueba independiente de cuerpo fuente MIME (10 GREEN → 7 RED propios → 10 GREEN), CI del HEAD 139 suites / 2618 unit y 27 archivos / 2420 pgTAP PASS. E2E [39052264162](https://github.com/cadeApp/cadeApp/actions/runs/39052264162) estaba en ejecución; no mergear mientras falte su resultado. Reporte [ronda-5](revisiones/ronda-5.md), [evidencia](evidencia/comandos.md). T-370 #399 permanece gate pre-staging/main, no impedimento propio para develop.
