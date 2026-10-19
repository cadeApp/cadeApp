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


## Ronda 3 — 2026-10-17

| SHA funcional | Resultado | Informe |
|---|---|---|
| 059270f612fcfd00fdefab24e5aea3ebf57f81ef | Sin bloqueantes nuevos de código; gates E2E cancelado, rama desactualizada y aprobación pendiente | [ronda-3.md](revisiones/ronda-3.md) |

CI del SHA funcional: 140/140 archivos, 2593/2593 tests, DB Files=27 Tests=2420 PASS. E2E Preview run #39053732705 CANCELLED, no hay oráculo E2E. La rama lleva más de 160 commits de retraso respecto a develop en el último chequeo. La documentación de esta ronda no exige repetir el CI verde por sí sola.

## Ronda 4 — 2026-10-17

| SHA funcional | Resultado | Informe |
|---|---|---|
| dfe467ada888fe5893e9216842ecb06ca8c12a7d | Sin hallazgos nuevos de código, atrás de develop: 0; gate E2E cancelado, aprobación humana pendiente | [ronda-4.md](revisiones/ronda-4.md) |

CI sobre código integrado: 142 archivos y 2.685 tests unit PASS; DB 29 archivos y 2.735 tests PASS. E2E Preview #39061870840 CANCELLED antes de ejecutar Playwright (se confirmó target SHA). La reejecución autorizada del mismo run no requiere cambio de código ni de workflow. Una actualización exclusivamente documental de la revisión/bitácora NO exige otro CI GREEN.

## Ronda 5 — 2026-10-17

| SHA funcional | Resultado | Informe |
|---|---|---|
| ae05b35cf46b5217f37932c76fdff9cad2fe996a | T-362 E2E PASS (44.9s), Chromium 87/87 PASS; E2E global FAIL por T-306, issue #405; aprobación pendiente | [ronda-5.md](revisiones/ronda-5.md) |

El HEAD de PR 37c7e8a solo cambia bitácora respecto de ae05b35: no invalida E2E de T-362. El run #39064324483 terminó con 87 tests Chromium PASS (no 77 como cita la bitácora), pero el job total FAIL por global-settings T-306 DoD1. Issue separado #405. No repetir CI solo por documentación.


## Ronda 6 — 2026-10-17

| SHA integrado | Resultado | Informe |
|---|---|---|
| `476ff4dbee7bf0e6fc43b4b507a1e772e27c62f4` | Fix T-371 integrado, detrás de develop=0; CI 142/2687 unit PASS y DB 29/2735 PASS; E2E auto #39079295420 CANCELLED antes de Playwright, falta gate real y aprobación P1 | [ronda-6.md](revisiones/ronda-6.md) |

Se conservaron exactamente los blobs del código y el spec E2E de T-362 respecto al SHA ae05b35 que pasó su test específico. La PR #407 T-371 se mergeó a develop, issue #405 cerrado y su E2E global quedó GREEN. La PR #389 **sigue bloqueada**, no por el viejo error T-306 sino porque el nuevo run de #389 fue CANCELLED. R6 registrada por revisor; no exigir otro CI solo por cambios documentales.


## Ronda 7 — 2026-10-18

| SHA funcional verificado | Resultado | Informe |
|---|---|---|
| `88ef846a74b4ff6a46ca344f0c4b2e728f9bbbe2` | **SIN BLOQUEANTES de código ni gate**: CI 146 suites / 2799 unit PASS; DB 30 archivos / 2815 tests PASS; E2E Chromium **90 PASS** y global-settings **6 PASS** (run 39175803818); PR Ready + aprobación P1 vigente en ese SHA. `develop` ahead 22 sin conflicto GitHub. | [ronda-7.md](revisiones/ronda-7.md) |

H05 se marca ahora arreglado-verificado: el E2E original cancelado fue reemplazado por una **ejecución completa real y GREEN** del HEAD 88ef846. Para el commit exclusivamente documental de R7 **no exigir nuevo CI**; revisar si la aprobación existente sigue vigente después de este commit.
