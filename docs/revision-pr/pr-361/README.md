# PR #361 — T-364 · Cancelar desde «Mis solicitudes»

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/361 |
| Tarea | T-364 · Fase 3 |
| Autor | @asako669 |
| Rama | `feat/T-364-cancelar-desde-mis-solicitudes` → `develop` |
| Base | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| Estado | **CON BLOQUEANTE DE EVIDENCIA E2E — NO MERGEAR** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `5d1be4bc129e96a4ba16e493ef355206ee74c44e` | H01–H04 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `f397c21b39f04de03d32615aedbdbaa8a9cbe559` | H05–H09, mejora H10 | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `25a787adfe2aaeeed7b9013231582a5c3dddce14` | H11–H13 | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `2ce18ac6e98ecbc4ae08b6ccbf43f70127ae75c3` | H11/H13 corregidos por inspección; **H12 pendiente de E2E** | [ronda-4.md](revisiones/ronda-4.md) |

**Único pendiente bloqueante:** prueba Browser E2E en Preview + Supabase Develop con SHA, run, resultado y commit status `e2e-preview` exitoso. El autor confirmó fallo local fail-closed por no tener credenciales, que no debe evadirse.

CI del SHA revisado: run 38683222503, unit 2180 PASS; seis jobs verdes y db-tests en progreso al momento de consulta. **No confundir CI/Vercel con prueba E2E certificada.**

Detalle de estados: [hallazgos.jsonl](hallazgos.jsonl). Evidencia: [comandos.md](evidencia/comandos.md).
