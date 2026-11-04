# PR #587 — T-421 · CC-043 / CC-044

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/587 |
| **Tarea** | T-421 (Fase 4; documentación de contratos para la futura implementación) |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-043-044-postulantes` → `develop` |
| **Base** | `146c9f9749dbc7fa20b63583cbc9b3c939cdc339` |
| **SHA inspeccionado (ronda 3)** | `a3fe70ee3336b65ffb2390044857afcf71430a09` |
| **Alcance** | PR documental; revisión en `docs/revision-pr/pr-587/` |
| **Estado** | **R3: SIN BLOQUEANTES DOCUMENTALES**; CI y aprobación humana previos al merge |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f` | 6 bloqueantes + 1 mejora | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `2512a3735ff7ce10d67a0e846218a6f3e4e74e36` | H01–H07 corregidos en documentación; H08–H09 abiertos | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `a3fe70ee3336b65ffb2390044857afcf71430a09` | H08–H09 corregidos en contrato; 9/9 hallazgos cerrados documentalmente | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Decisiones de Lautaro073 (recibidas antes del cierre)

- **D01=C:** RPC de finalización explícita y transaccional, solo desde servicio.
- **D02=C:** `application_submitted` como fuente de verdad; backfill histórico sin fechas inventadas.
- **D03=A:** `aal2` en RPC, exposición directa PostgREST pendiente en T-408 por riesgo aceptado.

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR587-H01 | El contrato no contempla la RPC/alcance D01-C | alto | arreglado-verificado en contrato R2 (NO SQL) |
| PR587-H02 | Idempotencia histórica falsificaría `submitted_at` | alto | arreglado-verificado en contrato R2 (NO SQL) |
| PR587-H03 | La UI/rutas siguen usando `vehicle_type` | alto | arreglado-verificado en contrato R2 (NO SQL) |
| PR587-H04 | Flag GUC no equivale a frontera de permisos | alto | arreglado-verificado en contrato R2 (NO SQL) |
| PR587-H05 | CC-042 y fixtures E2E contradicen el nuevo evento | medio | arreglado-verificado en contrato R2 (NO SQL) |
| PR587-H06 | Descripción MFA exagera protección de RLS | medio | arreglado-verificado en contrato R2 (NO SQL) |
| PR587-H07 | Backfill por `vehicle_type` admite históricos inconsistentes | bajo | arreglado-verificado en contrato R2 (NO SQL) |
| PR587-H08 | Ventana de rollout acepta envío viejo sin marcar | alto | arreglado-verificado en contrato R3 (NO SQL) |
| PR587-H09 | La RPC no valida formato/relación de patente | medio | arreglado-verificado en contrato R3 (NO SQL) |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Método y pruebas documentales: [evidencia/comandos.md](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Próximo paso

La revisión de **contratos/documentación terminó SIN BLOQUEANTES** sobre el SHA de ronda 3. Se mantienen pendientes de proceso la aprobación de Lautaro073 y checks CI aplicables. La implementación T-421 es un PR separado y necesitará SQL, pgTAP, unitarias, E2E y revisión independiente.

**Alcance de la verificación:** inspección remota de documentos, controles textuales y modelo de los invariantes (13/13 patente, 5/5 guard). No se ejecutó SQL, Docker, Supabase ni E2E; los 91 tests son los declarados por el autor, no verificados por el revisor.
