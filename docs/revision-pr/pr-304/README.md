# PR #304 — T-349 · Control de regresión del aislamiento de CC-007

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/304 |
| Tarea | T-349 (Fase 3) · issue #243 (permanece abierto) |
| Autor | @Lautaro073 |
| Rama | `feat/T-349-cc007-isolation-control` → `develop` |
| Base | `958076db46063b4128f72f52a581b95d7e6bf01f` |
| SHA de código revisado | `255fdc2153e2afcfcb1e0c34c64221f04c6b6b5b` |
| Diff inicial | 2 archivos, +77 líneas, 0 eliminaciones |
| Estado | **CON BLOQUEANTES (1)** · decisión A de Lautaro073: endurecer el control |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `255fdc2153e2afcfcb1e0c34c64221f04c6b6b5b` | 1 bloqueante | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Severidad | Estado | Motivo |
|---|---|---|---|
| PR304-H01 | alto | abierto | La guarda previa al hijo y el control final no detectan una escritura posterior al proceso hijo restaurada antes del control final |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Pendientes

1. agy agrega la verificación posterior al proceso hijo en `executeMutation`, antes de `return res`, en el mismo `try`.
2. Demuestra RED con una mutación **distinta** de la usada por el autor: escritura al checkout principal después de `spawnSync` con restauración garantizada en `finally`; documenta RED y GREEN reales del Vitest focal.
3. Verifica mutaciones A-D sin debilitarlas, suite, limpieza de cuatro archivos, CI del nuevo SHA y deja constancia en `docs/tasks/log/T-349.md`.
4. Nueva ronda **independiente**. No aprobar ni mergear ahora. El issue #243 solo se cierra después de verificación del DoD.

> El commit de esta revisión cambia el HEAD: agy debe hacer `git pull` antes de corregir; no rebase, no force-push ni amend.
