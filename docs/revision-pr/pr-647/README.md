# PR #647 — T-406 · Incidentes y parámetros A05/A04

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/647 |
| **Tarea** | T-406 · issue #487 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-406-incidentes-pestanas` → `develop` |
| **SHA de implementación revisado R2** | `4fce771d774ccf5837992e228d46f6de4322f6f1` |
| **Base develop exacta** | `4ae5404ee14651d00ad0c9286f250ba6c5441c49` |
| **Resultado** | SIN BLOQUEANTES propios del diff T-406; **MERGE BLOQUEADO** por gate E2E completo rojo (externo) |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `abf3f63873f4c8a9a1288d604735c7689708b0de` | H01 bloqueante; D01=C decidida | [ronda 1](revisiones/ronda-1.md) |
| 2 | `4fce771d774ccf5837992e228d46f6de4322f6f1` | H01 verificado por gate trusted; D01 implementada; H02 body de PR corregido | [ronda 2](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Diagnóstico | Estado | Evidencia |
|---|---|---|---|
| PR647-H01 | Dos TOTP en el mismo E2E de incidentes | **arreglado-verificado**, R2 | Trusted gate [42303370007](https://github.com/cadeApp/cadeApp/actions/runs/42303370007) ejecutó checkout del SHA y T-406 pasó |
| PR647-H02 | Faltaba sección de informe en body; `approval-policy` rojo | **arreglado-verificado**, R2 | Informe agregado al body; [42309455413](https://github.com/cadeApp/cadeApp/actions/runs/42309455413) `success` |
| D01=C | Contador inicial del layout + polling 60 s visible/foco, sin Realtime | **implementado; inspección de código y unit CI** | Endpoint admin+AAL2 y hook TanStack Query; no se reprodujeron localmente timers |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Bloqueos restantes para el MERGE (no imputados al diff de T-406)

1. **T-407 Auditoría:** `admin-audit-filters.spec.ts:69` encuentra dos textos idénticos y falla 3/3 por strict mode. Issue [#636](https://github.com/cadeApp/cadeApp/issues/636), **reabierto** tras este gate.
2. **T-419/T-356 licencia:** `courier-onboarding.spec.ts:1056` no ve `Rechazado / requiere corrección`, falla 3/3. Fixture inserta `license` sin `vehicle_id` tras CC-042; causa probable no confirmada. Issue [#653](https://github.com/cadeApp/cadeApp/issues/653), nuevo.
3. **Flaky conocido** de `admin-trips.spec.ts:167`, 1 caso recuperado en retry; seguir [#585](https://github.com/cadeApp/cadeApp/issues/585). No confundirlo con los dos rojos persistentes.

**Decisión de revisión:** arreglar ambos E2E persistentes en PRs de QA independientes, mergearlos a `develop`, traer `develop` a #647 con merge normal (no rebase) y exigir un gate trusted **completo verde** sobre el nuevo código integrado. **No** suprimir tests, subir retries ni exceptuar el gate; la ficha T-406 mantiene el requisito E2E verde. No aprobar ni mergear desde la revisión.

CI general de `4fce771d` [42302308824](https://github.com/cadeApp/cadeApp/actions/runs/42302308824): 7 jobs `success`, unit 198 files / 3735 tests. Gate E2E [42303370007](https://github.com/cadeApp/cadeApp/actions/runs/42303370007): 120 passed, 1 flaky, 2 failed; escenario T-406 y T-308 pasan. PR en Draft al revisar.

El commit documental de esta ronda **moverá el head** y podría activar checks nuevos; no exigir otro green por solo esta documentación. La verificación de H01 apunta al SHA original de código `4fce771d`, no al commit del informe.
