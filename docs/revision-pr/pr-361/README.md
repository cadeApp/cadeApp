# PR #361 — T-364 · Cancelar desde «Mis solicitudes»

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/361 |
| Tarea | T-364 · Fase 3 |
| Autor | @asako669 |
| Rama | `feat/T-364-cancelar-desde-mis-solicitudes` → `develop` |
| Base | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| Estado | **CON BLOQUEANTES — NO MERGEAR** |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `5d1be4bc129e96a4ba16e493ef355206ee74c44e` | H01–H04 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `f397c21b39f04de03d32615aedbdbaa8a9cbe559` | H05–H09, H10 mejora | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `25a787adfe2aaeeed7b9013231582a5c3dddce14` | H11–H13 bloqueantes | [ronda-3.md](revisiones/ronda-3.md) |

## Estado resumido

- **H01 / H05:** parcial; el E2E ahora recorre UI y otro comercio, pero no valida historial ni contador y no hay evidencia de corrida Playwright en Preview.
- **H02–H04 / H06–H10:** arreglados por inspección, sin mutación ejecutada por esta revisión.
- **H11:** aserción `Canceladas` tautológica; contador no verificado.
- **H12:** bypass `else rpc()`, botón `first()` y ausencia de run E2E exacto.
- **H13:** `as any` en la prueba de doble clic (prohibido por skill).

CI del SHA original de ronda 3: run [38681382821](https://github.com/cadeApp/cadeApp/actions/runs/38681382821), success; 2180 Vitest / 2205 pgTAP PASS. No confundir con E2E Playwright.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).
