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
| 2 | `f397c21b39f04de03d32615aedbdbaa8a9cbe559` | H05–H09 bloqueantes, H10 mejora | [ronda-2.md](revisiones/ronda-2.md) |

## Estado resumido

- **H01:** parcial, funcionalidad incorporada pero DoD E2E no probado.
- **H02–H04:** arreglados por inspección; **sin ejecución de mutaciones independientes**.
- **H05:** el supuesto E2E no ejerce la UI ni el actor merchant ajeno.
- **H06:** el diálogo controlado conserva paso y motivo después de cierre del padre.
- **H07:** doble submit sin guarda sincrónica.
- **H08:** falta manejo de promesas rechazadas.
- **H09:** mocks/oráculos UI no conectan con la Server Action real.
- **H10:** targets 44px en listado vs declaración >=48px.

**Evidencia de CI:** 2174 unit y 2205 pgTAP PASS para el SHA revisado; insuficiente para completar DoD UI.

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y comandos: [comandos.md](evidencia/comandos.md).
