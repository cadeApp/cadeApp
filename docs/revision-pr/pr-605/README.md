# PR #605 — T-403 · Postulantes según A01

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/605 |
| Tarea | T-403 · Fase 4 |
| Autor | @Lautaro073 |
| Rama | `feat/T-403-postulantes-a01` → `develop` |
| SHA de implementación revisado | `159ecd097523c6d13918f31e00a9069000db8230` |
| Base al revisar | `844bab43491fb30f171b6a72e9ec750a93f40dbc` |
| Diff | 15 archivos · +803/-270 líneas |
| Estado | Ronda 1, **CON BLOQUEANTES (1)**; no aprobar/mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos nuevos | Informe |
|---|---|---|---|
| 1 | `159ecd0` | H01 (alto, test-coverage) | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR605-H01 | E2E no diferencia vehículo de postulación enviada | alto | abierto · decisión D01=A |

- [hallazgos.jsonl](hallazgos.jsonl) conserva el estado estructurado, sin autoverificación.
- [evidencia/comandos.md](evidencia/comandos.md) incluye un control lógico ejecutable y comandos de comprobación; no atribuye RED/GREEN no corridos.
- [lecciones.md](lecciones.md) documenta el patrón y los límites de la revisión.

## Qué falta

1. El agente corrige solo `e2e/specs/admin-applicants-search.spec.ts` (y bitácora) conforme a D01=A: el courier no enviado debe tener moto y patente, DNI nulo y `application_submitted=false`.
2. La revisión independiente comprueba el E2E y los tests sobre el SHA nuevo, sin confiar únicamente en la bitácora.
3. `e2e-preview` debe dar un resultado real en el SHA de código correspondiente. Si el commit de revisión solo cambia docs, no se exige otro CI verde por ese motivo.
4. Seguimiento **fuera de T-403**: [issue #606](https://github.com/cadeApp/cadeApp/issues/606), refuerzo del pgTAP CC-044; no tocar ese test dentro de esta PR.

Decisión de Lautaro073: **D01=A**. No quedan decisiones abiertas de esta ronda.
