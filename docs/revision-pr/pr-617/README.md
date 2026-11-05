# PR #617 — T-407: Auditoría A06

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/617 |
| Tarea | T-407; issue #488; Fase 4 |
| Autor | Lautaro073 |
| Rama | `feat/T-407-auditoria-a06` → `develop` |
| Base consultada | `a7c6d809f87804415499d7fc70aaf06349717c16` |
| SHA de implementación revisado | `8116e2397d9a28504024850be4ae31913d35abdc` |
| Tamaño inicial | 16 archivos |
| Estado | CON BLOQUEANTES (2); sin aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Archivo |
|---|---|---|---|
| 1 | `8116e2397d9a28504024850be4ae31913d35abdc` | PR617-H01 y PR617-H02 | [Ronda 1](revisiones/ronda-1.md) |

## Estado

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| PR617-H01 | `admin_resolve_incident`: desestimación presentada como positiva | medio, bloqueante | abierto |
| PR617-H02 | Cursor sin filas: la tabla impide regresar conservando filtros | medio, bloqueante | abierto |

**D01=B aprobada por Lautaro073 (2026-11-05).** La nota «Este registro no se puede editar ni borrar.» queda diferida a T-408 (SEC-02). No presentarla antes de que la base garantice la inmutabilidad. Decisión resuelta, no hallazgo abierto.

[Datos estructurados](hallazgos.jsonl) · [Evidencia y harness](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Siguiente paso

El autor hace `git pull` antes de editar; corrige exclusivamente H01 y H02, registra RED→GREEN real, actualiza la bitácora, commitea y pushea. Luego corresponde **ronda 2 independiente** sobre el nuevo SHA. La carpeta `docs/revision-pr/pr-617/**` pertenece solo al revisor.

