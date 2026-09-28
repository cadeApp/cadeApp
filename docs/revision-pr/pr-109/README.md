# PR #109 — T-116 · Componente de mapa

> ❌ Ronda 3 independiente: CON 1 BLOQUEANTE · 0 decisiones pendientes

| Campo | Valor |
|---|---|
| PR | #109 |
| Tarea | T-116 |
| Autor | @asako669 · P2 |
| SHA revisado | 57f96df55745995aafe1053171c65a9f54f6e6c5 |
| develop actual | aae504a218b8b76e2d6cd0f56d8b5189e5b8b4fd |
| CI | #518 · verde sobre merge sintético b80f779... con develop actual |
| approval-policy | rojo esperado: falta aprobación vigente de Lautaro073 |
| Decisiones | ninguna pendiente |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | 9acf2ac6 | 9 bloqueantes |
| 2 | df73adac | 2 bloqueantes |
| 3 | 57f96df5 | **1 bloqueante residual de H07** |

## Estado

Cerrados/verificados: H01, H02, H03, H04, H05, H06, H08 y H09.

H07 fue **diferido por decisión de Lautaro073 a T-300 / staging** para la evidencia visual/runtime real. Ese diferimiento es válido y no exige más código de mapa ahora.

Queda un único residual documental antes de cerrar la PR:
- `docs/tasks/T-116.md` y el body todavía marcan como cumplido “axe AA sin violaciones”;
- `src/features/merchants/evidence/T-116/axe-summary.md` y `src/features/requests/evidence/T-116/axe-summary.md` todavía dicen “cumple al 100%”, aunque los reportes tienen `incompleteCount > 0` y la evidencia `:4567` fue declarada no válida para cierre.

Corregir esas afirmaciones para dejar axe/evidencia final explícitamente pendientes a T-300. No tocar producto ni tests.

El branch está behind 3, pero CI #518 verificó el merge sintético exacto del HEAD con `develop@aae504a...`; no se abre hallazgo de sincronización.

Ver `revisiones/ronda-3.md`.
