# PR #587 — T-421 · CC-043 / CC-044

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/587 |
| **Tarea** | T-421 (Fase 4; documentación de contratos para la futura implementación) |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-043-044-postulantes` → `develop` |
| **Base** | `146c9f9749dbc7fa20b63583cbc9b3c939cdc339` |
| **SHA revisado** | `9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f` |
| **Tamaño** | 6 archivos, +560/-24 líneas |
| **Estado** | **CON BLOQUEANTES** — documentación, aún no se valida implementación |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f` | 6 bloqueantes + 1 mejora | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Decisiones de Lautaro073 (recibidas antes del cierre)

- **D01=C:** RPC de finalización explícita y transaccional, solo desde servicio.
- **D02=C:** `application_submitted` como fuente de verdad; backfill histórico sin fechas inventadas.
- **D03=A:** `aal2` en RPC, exposición directa PostgREST pendiente en T-408 por riesgo aceptado.

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR587-H01 | El contrato no contempla la RPC/alcance D01-C | alto | abierto |
| PR587-H02 | Idempotencia histórica falsificaría `submitted_at` | alto | abierto |
| PR587-H03 | La UI/rutas siguen usando `vehicle_type` | alto | abierto |
| PR587-H04 | Flag GUC no equivale a frontera de permisos | alto | abierto |
| PR587-H05 | CC-042 y fixtures E2E contradicen el nuevo evento | medio | abierto |
| PR587-H06 | Descripción MFA exagera protección de RLS | medio | abierto |
| PR587-H07 | Backfill por `vehicle_type` admite históricos inconsistentes | bajo | abierto (mejora) |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Método y pruebas documentales: [evidencia/comandos.md](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Qué falta

1. El agy corrige **solo documentación** con el prompt publicado en la conversación del PR.
2. Revisión independiente nueva sobre el siguiente SHA; luego recién podrá mergearse el contrato a criterio de Lautaro073.
3. T-421 implementará migraciones, servicio, cambios en auth, tests SQL/unitarios/E2E con revisión separada.

**Limitaciones:** sin clon local por fallo DNS a github.com; no se ejecutó `git merge-tree`, `pnpm` ni pgTAP. El compare remoto mostró 1 commit ahead y 0 behind; GitHub reportó mergeable, lo que no sustituye un `merge-tree` local. La batería textual se ejecutó sobre documentos recuperados desde el SHA, no sobre el runtime.
