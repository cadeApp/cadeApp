# PR #364 — CC-025 · Reemplazo seguro de documentos

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/364 |
| Issue | #363 · T-356 (#343 / PR #358) |
| Autor | @Lautaro073 |
| Rama | `cc/CC-025-courier-document-replacement` → `develop` |
| SHA de autor auditado | `9be93c5bbd7450059e8104c47f87d7ea077f2785` |
| Develop al revisar | `b5b9bf036c4c863c334948065a8780f76a88f758` |
| Diff | 12 archivos · +1723/-4 |
| Estado | Bloqueada por 7 hallazgos; sin aprobación ni merge |

## Rondas

| Ronda | SHA auditado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9be93c5bbd7450059e8104c47f87d7ea077f2785` | 7 abiertos (5 altos, 2 medios) | [Ronda 1](revisiones/ronda-1.md) |

## Índice de hallazgos
- PR364-H01 — La RPC omite validar Storage si el bucket no tiene objetos
- PR364-H02 — Orden de locks opuesto entre RPC courier y admin: riesgo concreto de deadlock
- PR364-H03 — is_current y rejection_code no tienen barrera efectiva contra UPDATE directo admin AAL1
- PR364-H04 — La política SELECT existente permite ver históricos pese a la matriz de privacidad del CC
- PR364-H05 — Unicidad nueva colisiona con el reintento UPSERT del onboarding existente
- PR364-H06 — Backfill purga históricos desde uploaded_at y puede vencerlos antes de 30 días tras quedar obsoletos
- PR364-H07 — idempotencyKey aceptada por contrato y wrapper, pero ignorada por SQL y fake

**Decisiones confirmadas por Lautaro073:** 1C, 2C, 3B, 4C y B nueva de retención de 30 días **después del reemplazo**. Sin decisiones pendientes de esta ronda.

[Informe](revisiones/ronda-1.md) · [JSONL](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md) · [Prompt completo](prompt-agy.md).

**CI del SHA original:** run 38684238884, 23 archivos / 2231 pgTAP PASS y 131 archivos / 2179 Vitest PASS; no cubre los 7 escenarios. Desfase develop: 12 commits behind y mergeable=false; revalidar tras integrar develop.

## Ronda 2 — 2026-10-15

| Ronda | SHA revisado | Dictamen |
|---|---|---|
| 2 | 6e06e8ae7ade883d974644344f3597dcb526e2c2 | Bloqueada: nueva R01 alta, nueva R02 media; cuatro hallazgos arreglados sin verificar y tres parciales |

[Informe ronda 2](revisiones/ronda-2.md) · [Evidencia ronda 2](evidencia/ronda-2.md) · [Prompt ronda 2](prompt-agy-ronda-2.md).

**CI HEAD auditado:** 133 archivos / 2228 Vitest PASS; 23 archivos / 2245 pgTAP PASS, run 38692082266. Rama 2 commits detrás de develop. No mezclar el SHA de la carpeta de revisión con el SHA funcional auditado.
