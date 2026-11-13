# PR #744 — T-437 · CC-052 / B-05: documentos obligatorios verificados

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/744 |
| Tarea | T-437 (B-05), issue #670; CC-052 mergeado en #742 |
| Autor | @Lautaro073 |
| Rama | `feat/T-437-b05-verified-documents` → `develop` |
| Base de PR | `f0e217ac028633f22f52d74632f8615ceb886a7e` |
| SHA de implementación revisado más reciente | `a20402a999084fd60d91ca6e62143b10a20d134d` |
| Tamaño de la PR antes del commit de R2 | 56 archivos, +2935/-44 líneas |
| Estado de R2 | **SIN BLOQUEANTES DE CÓDIGO**; 2 hallazgos corregidos y verificados estructuralmente, CI unit verde; DB/E2E según condiciones abajo |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `e96473185354589b3820a345cc7a089127919afd` | 2 (1 bloqueante y 1 mejora) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `a20402a999084fd60d91ca6e62143b10a20d134d` | 0 nuevos; H01/H02 corregidos | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR744-H01 | El fake subsana un documento sin objeto en Storage | alto · bloqueante | **arreglado-verificado** en `a20402a9` (oráculo estructural independiente + CI unit) |
| PR744-H02 | Estado de subsanación no se refleja en el resumen del perfil | medio · mejora | **arreglado-verificado** en `a20402a9` (oráculo estructural independiente + CI unit) |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Qué queda por hacer

1. **Antes de merge:** completar `db-tests` del CI de `a20402a9` en verde y revisar evidencia de pgTAP y generación de tipos. El CI `unit` ya tiene 212 suites / 4016 tests PASS en este SHA. Los controles de R2 están verificados estructuralmente y mediante CI, **sin Vitest independiente ejecutado por el revisor**.
2. **Decisión de integración de P1:** mantener Draft/no merge hasta que los gates aplicables estén verdes. No surgieron decisiones nuevas de alcance.
3. **Después del merge y de migrar Develop:** ejecutar E2E reales (incluida subsanación) y las tres mutaciones `t437-ui-{approve,reactivate,reconsider}-guard`, registrando `RED_CONFIRMED` solo con evidencia. El estado BLOCKED / REQUIRES DEVELOP MIGRATION no se cuenta como PASS.

## Observaciones de integridad

- `CI 43515294798` fue verde sobre `55b5098`; `55b5098..e9647318` modifica únicamente `docs/tasks/log/T-437.md`. No se exige otro CI solo por la bitácora.
- `#745` (review-only, cerrada sin mergear) prueba la ausencia de las guardas SQL con 23/76 casos RED. Es evidencia reproducible del **autor** vista en Actions, no una mutación ejecutada por esta revisión.
- `e2e-preview` está BLOCKED/REQUIRES DEVELOP MIGRATION, como informa la PR. No se declaró verde.
- No hubo autorización para aprobar ni mergear. Las decisiones D1-A…D7-A ratificadas se mantuvieron; no surgió una nueva decisión de alcance.
