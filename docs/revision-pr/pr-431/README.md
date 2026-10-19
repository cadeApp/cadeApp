# PR #431 — T-375 · restauración de pilot_active ante timeout E2E

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/431 |
| Tarea | T-375 (QA E2E, ficha de autorización) |
| Autor | @Lautaro073 |
| Rama | `docs/T-375-pilot-restore` → `develop` |
| Base consultada | `1e69477dae1e50cd67c307c9a0f987366f90c98e` |
| HEAD inicial del autor | `0c50d73cdb9d676d9bb8d2afe6e502d5d3f32356` |
| SHA revisado tras precisión documental | `86a7b21aac38766c2d1798dc406dc9a08509e811` |
| Tamaño | 2 archivos funcionalmente propuestos; solo documentación |
| Resultado | SIN BLOQUEANTES por inspección de ficha; CI verificada parcialmente |

## Rondas

| Ronda | SHA revisado | Bloqueantes | Informe |
|---|---|---|---|
| 1 | `86a7b21aac38766c2d1798dc406dc9a08509e811` | 0 | [ronda-1.md](revisiones/ronda-1.md) |

**Observación preventiva corregida:** el revisor explicitó en la ficha, mediante el commit `86a7b21aac38766c2d1798dc406dc9a08509e811`, que los hooks no pueden reparar un piloto que ya estaba apagado antes de empezar. El DoD ahora exige una prueba negativa en memoria. No constituye un hallazgo de código implementado: la implementación aún no existe y debe demostrar RED→GREEN en otra PR.

**Datos estructurados:** [hallazgos.jsonl](hallazgos.jsonl) (vacío: sin defectos demostrados en esta PR). **Evidencia:** [comandos.md](evidencia/comandos.md).

## Estado y próxima acción

La ficha está lista para revisión de integración documental, con las reservas del informe. Al momento de inspección la PR seguía Draft; la corrida de CI estaba en curso y el gate `e2e-preview` figuraba pending. No se afirma GREEN final. La tarea T-375 se implementará en una PR distinta; no cerrar el issue #430 por esta ficha.

No se aprobó ni mergeó esta PR.
