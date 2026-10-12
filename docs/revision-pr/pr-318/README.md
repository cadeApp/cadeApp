# PR #318 — T-340 / Paso 2 de 4 — Lectores

**PR:** https://github.com/cadeApp/cadeApp/pull/318. **Rama:** `feat/T-340-lectores` → `develop`. **Estado Draft / CON BLOQUEANTES / NO MERGEAR**.

## Revisiones

| Ronda | SHA de implementación | Veredicto |
|---|---|---|
| [1](revisiones/ronda-1.md) | `4e70e934` | Gate0 pendiente |
| [2](revisiones/ronda-2.md) | `9c5e797` | Gate0 probado; RED pendiente |
| [3](revisiones/ronda-3.md) | `e61fab67` | Gate0 cerrado H01/H02 |
| [4](revisiones/ronda-4.md) | `c7cab174` | 7 bloqueantes en Paso 2 |
| [5](revisiones/ronda-5.md) | `58811a30` | H03/H08 verificados; H10 nuevo |
| [6](revisiones/ronda-6.md) | `5a6daeed` | H04/H07 verificados; resto parcial |
| **[7](revisiones/ronda-7.md)** | **`a71b338b`** | **CI técnico verde; H05/H10 verificados; H06/H09 parciales, H11/H12 nuevos. CON BLOQUEANTES** |

**Cerrados/verificados:** H01, H02, H03, H04, H05, H07, H08, H10. **Parciales:** H06 (cardinalidad publicada 3/1 o 1/0 no falla cerrado), H09 (E2E no ejecutado y oráculo de privacidad insuficiente). **Nuevos:** H11 (el test que dice tres drops crea uno y espera uno, y no llama al historial), H12 (prueba de PII inspecciona payload transformado por Zod, no JSON HTTP crudo).

**CI `a71b338b`:** Run `38306695743` ✅; db-tests job `115002373648`, 21 suites/1995 tests PASS; unit job `115002373677`, 128 archivos/2103 tests PASS; lint/typecheck/build/audit/bundle-budget PASS. **e2e-preview ERROR/BLOCKED**: requiere migración de lectores posterior al merge a Develop, no se ha validado N en Playwright; `approval-policy` FAIL.

**Decisiones del usuario:** opciones A R4 y R5 vigentes; ninguna decisión nueva. Asako termina Paso 2; Kira no inicia Paso 3 hasta merge, migración y checkpoint E2E en Develop, verificados.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
