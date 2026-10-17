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


## Ronda 3

| Ronda | SHA funcional revisado | Dictamen |
|---|---|---|
| 3 | `6c1d124ce17e271858915df3bb57de9beeb1aa6e` | CON BLOQUEANTES: R03 alto, R04 medio; H02/H05/H06 parciales |

CI real run 38702747664: 133 suites/2254 unit; 23 archivos/2262 pgTAP PASS. [Informe](revisiones/ronda-3.md), [Prompt](prompt-agy-ronda-3.md), [Evidencia](evidencia/ronda-3.md). Historial R1/R2 preservado.


## Ronda 4 — estado actualizado

| Ronda | SHA funcional | Resultado |
|---|---|---|
| 4 | `2251ee79122b914034bf0b28d0b2a2a3e07a4c09` | CON BLOQUEANTES: R04 (rollout), R05 (is_current ausente pre-migración); H02/H06 cuentan con CI real, RED→GREEN autor |

CI verificado run 38711308994: 23 archivos / 2262 pgTAP PASS y 133 archivos unit PASS; revisión independiente NO ejecutó mutaciones DB. [Informe](revisiones/ronda-4.md) · [Prompt](prompt-agy-ronda-4.md) · [Evidencia](evidencia/ronda-4.md).


## Ronda 5 — 2026-10-16

| Ronda | SHA funcional | Dictamen |
|---|---|---|
| 5 | `d0924270b8da6aaefd087c336b7e330339053be0` | CON BLOQUEANTES altos R06 (LIKE) y R07 (INSERT directo); R04 rollout parcial; opción A de revocar INSERT aprobada por Lautaro073 |

[Informe R5](revisiones/ronda-5.md) · [Evidencia](evidencia/ronda-5.md) · [Prompt agy](prompt-agy-ronda-5.md). CI 137/2484 unit y 27/2406 pgTAP verdes, pero e2e-preview **error BLOCKED**, NO verde. No merge ni aprobación.


## Ronda 6 — 2026-10-17

| Ronda | SHA de implementación | Dictamen |
|---|---|---|
| 6 | `f6168c03fedaa34d843c4192f46c6af1aae7b680` | SIN BLOQUEANTES FUNCIONALES NUEVOS; R06/R07 arreglados por inspección+CI (sin DB propia), R04 rollout PARCIAL; **no merge** hasta gate staging y E2E autorizado |

[Informe R6](revisiones/ronda-6.md) · [Evidencia](evidencia/ronda-6.md) · [Prompt de continuidad](prompt-agy-ronda-6.md). CI 38993728305: 137/2515 unit y 27/2420 pgTAP PASS; e2e-preview ERROR BLOCKED / REQUIRES DEVELOP MIGRATION. Sin aprobación, merge ni migración remota.
