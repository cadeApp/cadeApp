# PR #138 — T-317 · Ficha de alta de admin y enrolamiento MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/138 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `docs/T-317-ficha` → `develop` |
| **Base inicial** | `a7f9b172d7988fdec7865d6327f4b7f95b10e06e` |
| **Estado** | abierta / bloqueada en Ronda 2 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `bb66fadd6c17545b5332f237e06e729eb169f20e` | 7 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `f280bc918d3203cc29a2381c68da82611154112f` | 2 bloqueantes + 1 mejora | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR138-H01 | D01 incompleta en contratos raíz | alta | abierto |
| PR138-H02 | T-317 ausente del plan; verify-fichas no lo detecta | alta | abierto |
| PR138-H03 | Issue #137 conserva referencia muerta | media | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Sincronizar `AGENTS.md` y `docs/onboarding.md` con D01 / 1-B sin habilitar secretos privilegiados.
2. Agregar control RED real para fichas ausentes del plan y luego registrar T-317 en `docs/implementation-plan.md §8`.
3. Corregir `verifyMfaAction` → `verifyAdminMfaAction` en Issue #137.
4. Revisión independiente Ronda 3.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md).
