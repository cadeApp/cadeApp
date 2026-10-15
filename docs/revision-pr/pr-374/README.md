# Revisión independiente PR #374 — CC-025 fase A

- PR: https://github.com/cadeApp/cadeApp/pull/374
- Rama: `cc/CC-025-expand-courier-documents`
- SHA funcional auditado: `b6d6a921c556e7ad2e69d208984e866b09654ca3`
- Fecha: 2026-10-15
- Estado ronda 1: **CON BLOQUEANTES (3)**. No aprobar / no mergear.
- Antecedente: decisión de rollout A (EXPAND → APP → CONTRACT), [PR #364](https://github.com/cadeApp/cadeApp/pull/364), issue #363 permanece abierto.

[Informe R1](revisiones/ronda-1.md) · [Evidencia](evidencia/comandos.md) · [Hallazgos](hallazgos.jsonl) · [Lecciones](lecciones.md) · [Prompt](prompt-agy.md).

La revisión encontró lagunas de la prueba UPSERT real (H01) y del actor (H02), más build fallido en HEAD actual (H03). CI previo SHA 09846602 PASS, **no** extrapolable al SHA b6d6a921c556e7ad2e69d208984e866b09654ca3.


## Ronda 2 — 2026-10-15

| Ronda | SHA funcional auditado | Resultado |
|---|---|---|
| 2 | `f8d338af2c72c64ffe8ccdead0d032c4700ff92d` | SIN BLOQUEANTES para Fase A; H01–H03 corregidos por inspección + CI real, sin RED funcional independiente |

**CI del HEAD funcional:** [38784606824](https://github.com/cadeApp/cadeApp/actions/runs/38784606824), 133 suites / 2328 unit, 23 archivos / 2229 pgTAP PASS; build ✅. [Informe R2](revisiones/ronda-2.md) · [Evidencia R2](evidencia/ronda-2.md) · [Prompt continuidad](prompt-agy-ronda-2.md).

**Importante:** el commit de revisión cambia SHA y requerirá CI nuevo antes de merge. PR #374 es solo fase A. PR #364/#358 e issue #363 siguen pendientes.
