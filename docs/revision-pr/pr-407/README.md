# PR #407 — T-371 · QA E2E de suscripción vencida

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/407 |
| Ficha | docs/tasks/T-371.md en develop |
| Autor | Lautaro073 (P1) |
| Rama | feat/T-371-fix-subscription-e2e → develop |
| SHA funcional revisado | b2dbfc2bba82ed5e2d9e01495761ec8fa30e75a2 |
| Resultado | CON BLOQUEANTES (1 test-coverage + sincronización documental de rama) |

## Ronda 1 — 2026-10-17

| Ronda | SHA | Informe |
|---|---|---|
| 1 | b2dbfc2bba82ed5e2d9e01495761ec8fa30e75a2 | [ronda-1.md](revisiones/ronda-1.md) |

## Estado de hallazgos

| ID | Sev. | Estado |
|---|---|---|
| H01 — Test unitario sin aserción de wiring | medio / BLOQUEANTE | abierto |
| A01 — Normalización de ficha-plan omitida | medio / proceso | arreglado-sin-verificar; corregido en develop por PR #408, falta merge de la rama |

No hay hallazgo de corrección de contrato: PUBLICATION_CREDITS_EXHAUSTED es correcto después de CC-029. El run E2E Preview #39069904081 fue SUCCESS con 86 Chromium PASS y 3 global-settings PASS. Los checks CI del SHA funcional fueron SUCCESS, pero el approval-policy sigue FAIL porque el cuerpo del PR aún carece de Informe revisar-pr sin bloqueantes.

## Entregables

- [Revisión R1](revisiones/ronda-1.md)
- [Hallazgos estructurados](hallazgos.jsonl)
- [Evidencia y harness propuesto](evidencia/comandos.md)
- [Lecciones](lecciones.md)

**No aprobar ni mergear hasta que H01 sea cerrado, la rama integre develop y approval-policy esté verde.** Los cambios solo documentales de esta carpeta o de la bitácora no requieren otro CI GREEN por sí solos.

## Ronda 2 — 2026-10-17

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 2 | `672425967bebfc18e5bb80e32139be35bd0a3e7b` | H01 y A01 arreglados-verificados; CI success; E2E rerun pendiente, no merge aún | [ronda-2.md](revisiones/ronda-2.md) |

RED independiente en PR aislada [#409](https://github.com/cadeApp/cadeApp/pull/409), cerrada SIN merge. GREEN real en CI [#39075002912](https://github.com/cadeApp/cadeApp/actions/runs/39075002912). E2E previo 86+3 PASS sobre mismo código productivo; run nuevo #39075070502 attempt 2 pendiente. La R2 deja sin bloqueantes el **código**, no certifica los gates operativos pendientes.
