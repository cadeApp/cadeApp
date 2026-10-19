# PR #431 — T-375 · restauración de pilot_active ante timeout E2E

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/431 |
| Tarea | T-375 (QA E2E, ficha de autorización) |
| Autor | @Lautaro073 |
| Rama | `docs/T-375-pilot-restore` → `develop` |
| Base consultada | `1e69477dae1e50cd67c307c9a0f987366f90c98e` |
| HEAD inicial del autor | `0c50d73cdb9d676d9bb8d2afe6e502d5d3f32356` |
| SHA de la ficha revalidada | `580a1e64ccd8ed178d3e407fee61e0750098653c` |
| Tamaño | 2 archivos funcionalmente propuestos; solo documentación |
| Resultado | SIN BLOQUEANTES por inspección de ficha; CI verificada parcialmente |

## Rondas

| Ronda | SHA revisado | Bloqueantes | Informe |
|---|---|---|---|
| 1 | `580a1e64ccd8ed178d3e407fee61e0750098653c` | 0 | [ronda-1.md](revisiones/ronda-1.md) |

**Observaciones preventivas corregidas:** el revisor explicitó en la ficha (commits `86a7b21` y `580a1e6`) que los hooks no pueden reparar un piloto que ya estaba apagado antes de empezar y que la prueba en memoria no puede usar el reinicio del worker para aparentar que se restauró el estado. La ficha revalidada en el commit `580a1e64ccd8ed178d3e407fee61e0750098653c`, ahora exige prueba negativa y comprobación real de la restauración antes de descartar el worker o con almacén externo. No constituye un hallazgo de código implementado: la implementación aún no existe y debe demostrar RED→GREEN en otra PR.

**Datos estructurados:** [hallazgos.jsonl](hallazgos.jsonl) (vacío: sin defectos demostrados en esta PR). **Evidencia:** [comandos.md](evidencia/comandos.md).

## Estado y próxima acción

La ficha está lista para revisión de integración documental, con las reservas del informe. Al momento de inspección la PR seguía Draft; la corrida de CI estaba en curso y el gate `e2e-preview` figuraba pending. No se afirma GREEN final. La tarea T-375 se implementará en una PR distinta; no cerrar el issue #430 por esta ficha.

No se aprobó ni mergeó esta PR.
