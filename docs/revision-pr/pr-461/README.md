# PR #461 — T-379 · Viajes entregados fuera de «Aceptadas»

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/461 |
| Tarea | T-379 · Fase 3 · #441 |
| Autor | @Lautaro073 |
| Rama | `feat/T-379-delivered-trips` → `develop` |
| SHA revisado | `246c9d2e41fbe7a7bc838827e528c2701500f73b` |
| Base al revisar | `cf2fbe13ab7ee8348b4805dadccef5416abb9265` |
| Diff funcional | 15 archivos, +696/-141 |
| Resultado | **SIN BLOQUEANTES confirmados**, con gate E2E oficial pendiente |

## Rondas

| Ronda | SHA verificado por inspección | Bloqueantes | Informe |
|---|---|---|---|
| 1 | `246c9d2e41fbe7a7bc838827e528c2701500f73b` | 0 | [ronda-1.md](revisiones/ronda-1.md) |

No hay hallazgos de código abiertos ni se atribuyen mutaciones independientes que no se ejecutaron. [`hallazgos.jsonl`](hallazgos.jsonl) está vacío deliberadamente. La observación fuera de alcance OBS-01 está registrada en el informe.

## Resolución de alcance

**Decisión de Lautaro073 (2026-10-20): A.** Ratificada la ampliación exclusivamente para el fixture `src/features/offers/components/notify-resilience.test.tsx` (campo `requestStatus`) y para `e2e/pages/trip.page.ts` (selector `tripHeader` que admite título finalizado). Las justificaciones figuran en «Notas para quien retome» de la ficha de la rama. No se modificó la ficha en esta revisión.

## Para terminar

- Dejar correr el **CI completo incluido `e2e-preview`** en el último push/HEAD; no cancelar el gate final. La evidencia local del autor no lo sustituye.
- Verificar que `approval-policy` reconozca el informe publicado y que los checks requeridos pasen en el HEAD final. Los checks de código en verde pertenecen al SHA revisado, anterior al commit documental de esta ronda.
- El merge y la aprobación corresponden a Lautaro073; esta revisión no los realiza.

Véanse [evidencia/comandos.md](evidencia/comandos.md) y [lecciones.md](lecciones.md).
