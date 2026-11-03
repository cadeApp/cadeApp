# PR #392 — Promoción B-only a staging

**Propósito:** promover origen congelado `cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6` a `staging` preservando cambios exclusivos del ambiente, antes de Fase C CC025.

**Rama:** `release/CC-025-b-only-promote-staging-20261017` · **Base:** `staging@86c98cae78998ea18e9cc6f7af244d70584018b1`.

| Ronda | Código inspeccionado | Dictamen |
|---|---|---|
| 1 | `61ebc07c1f2ffc23724bc0be0793dd2ac7c15fb6` | **CON BLOQUEANTES (1 documental-operativo)**: H01 rollback afirma no revocar UPDATE, pero CC026 lo revoca y regranta por columnas. CI local y árbol release correctos. |

[Informe R1](revisiones/ronda-1.md) · [Evidencia](evidencia/comandos.md) · [Hallazgos](hallazgos.jsonl) · [Prompt agy](prompt-agy-ronda-1.md).

**CI:** 39003514873 SUCCESS (135/2492 Vitest, 26/2341 pgTAP), approval-policy 39003514915 FAIL por informe independiente faltante. **Staging NO desplegado**; la prueba DB fue efímera, no remoto. No aprobar/mergear.


## Ronda 2 — 2026-10-17

| Ronda | SHA release | Dictamen |
|---|---|---|
| 2 | `a53164916189e4b5d93f51cee285db24523747db` | H01 corregido en PR body por inspección; **SIN BLOQUEANTES de implementación**, pendiente sección de approval-policy, SHA completo correcto y autorización del merge. |

[Informe R2](revisiones/ronda-2.md) · [Evidencia](evidencia/comandos.md) · [Prompt agy](prompt-agy-ronda-2.md). CI #39004412632 PASS (135/2492 unit, 26/2341 pgTAP); approval-policy #39004741813 FAIL por formato del body. No hay deploy de staging ni merge.
