# PR #389 — T-362 · Motivos de cancelación por rol

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/389 |
| Tarea | T-362 · Fase 3 · Issue #350 |
| Autor | @KiraK72 |
| Rama | feat/T-362-cancelacion-viaje-por-rol → develop |
| SHA revisado | d872ec9b49a7a7ee0d3a21f7485026545a2ccb49 |
| Base revisada | cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6 |
| Tamaño | 9 archivos · +621 / -35 |
| Resultado | CON BLOQUEANTES (5) · inspección estática |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | d872ec9b49a7a7ee0d3a21f7485026545a2ccb49 | H01–H05 (5 bloqueantes) | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| H01 | No existe E2E de cancelación merchant desde /trips en matched | alto | abierto |
| H02 | E2E de in_transit puede pasar sin visitar el viaje/ejercitar merchant | alto | abierto |
| H03 | Las aserciones unitarias copian razones del código productivo | alto | abierto |
| H04 | No se comprueba el cableado del actor ni una mutación semántica válida de Otro | alto | abierto |
| H05 | Checklist DoD afirma E2E cumplido sin ejecución ni cobertura completa | medio | abierto |

Los datos estructurados están en [hallazgos.jsonl](hallazgos.jsonl). El plan de comprobación independiente y el harness de mutaciones (no ejecutado en este entorno) están en [evidencia/comandos.md](evidencia/comandos.md).

## Alcance y puntos verificados por inspección

- Los 9 archivos están dentro de los globs permitidos en T-362 de develop.
- La ficha cambiada solamente marca 7 casillas del DoD; no introduce permisos ni redefine alcance, pero H05 detecta certificación prematura.
- Actions de trips autentican rol y llaman las RPC existentes courier_cancel_match y cancel_request; no se cambian contratos.
- El botón existente ReportIncidentButton ya ofrece reporte post-retiro en /trips/[id] según el contrato report_incident; no corresponde crear otra RPC.
- La rama está dos commits detrás de develop; esos commits solo afectan docs/tasks/T-359.md y GitHub reporta mergeable=true al consultar. No hubo git merge-tree local.
- No se consultó el CI en esta ronda bloqueada, de acuerdo con el protocolo de revisión. No se ejecutó Vitest, Playwright ni mutaciones debido a que el runtime no puede obtener un clon de GitHub. El informe no atribuye resultados reales a esas comprobaciones.

## Próximo paso

KiraK72 debe hacer git pull antes de modificar, corregir los 5 hallazgos siguiendo el prompt del comentario de la PR y actualizar bitácora, pruebas y push. Luego corresponde otra ronda sobre el nuevo SHA y CI/E2E.

## Ronda 2 — 2026-10-17

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 2 | 1da28ccaa2d9143f74ec0e75f89426b20ec50878 | CON BLOQUEANTES: R01, R02, R03 | [ronda-2.md](revisiones/ronda-2.md) |

- H01 parcial (E2E agregado pero R01 y R02 impiden validarlo).
- H02, H03 y H04 arreglados por inspección, sin verificación de runtime.
- H05 parcial: casilla E2E desmarcada, falta pnpm test completo del HEAD y ejecución Preview.
- R01: copy inexistente en el E2E. R02: negativo de actor ajeno sobre solicitud cancelada. R03: harness R1 del propio revisor no ejecutable tal cual.

El nuevo commit de revisión no equivale a aprobación. No se ejecutó CI ni E2E porque hay bloqueantes.
