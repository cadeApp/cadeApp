# PR #361 — T-364 · Cancelar desde «Mis solicitudes»

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/361 |
| Tarea | T-364 · Fase 3 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-364-cancelar-desde-mis-solicitudes` → `develop` |
| Base inspeccionada | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| Estado de ronda 5 | **SIN BLOQUEANTES en SHA original; CI/E2E sobre nuevo HEAD de informe por reevaluar** |

## Rondas

| Ronda | SHA inspeccionado | Resultado | Informe |
|---|---|---|---|
| 1 | `5d1be4bc129e96a4ba16e493ef355206ee74c44e` | H01–H04 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `f397c21b39f04de03d32615aedbdbaa8a9cbe559` | H05–H10 | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `25a787adfe2aaeeed7b9013231582a5c3dddce14` | H11–H13 | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `2ce18ac6e98ecbc4ae08b6ccbf43f70127ae75c3` | H12 E2E pendiente | [ronda-4.md](revisiones/ronda-4.md) |
| 5 | `0beec112e1d1b114b4e8480ff846c247dfb7421c` | **SIN BLOQUEANTES — E2E confirmado** | [ronda-5.md](revisiones/ronda-5.md) |

## Evidencia del cierre de código

- CI run [38684858567](https://github.com/cadeApp/cadeApp/actions/runs/38684858567) **success**: 2180/2180 unit, 2205 pgTAP PASS, lint/typecheck/build/audit/bundle-budget.
- Trusted E2E run [38684930479](https://github.com/cadeApp/cadeApp/actions/runs/38684930479) **success** sobre `0beec112e1d1b114b4e8480ff846c247dfb7421c`, `e2e-preview=success`, 74 Chromium passed, 1 flaky ajeno (T-314), 3 global-settings passed. Test UI T-364 aprobado en 25.7 s.
- **No cambiar `VERCEL_PROJECT_ID`** por skip de otros proyectos; el gate de develop funcionó.
- La modificación posterior de documentación de revisión mueve HEAD; debe recuperar CI/E2E sobre el SHA final antes del merge.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md).
