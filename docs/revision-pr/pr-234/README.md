# PR #234 — T-332 · El audit de CI deja de fallar por braces sin bajar el umbral

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/234 |
| **Tarea** | T-332 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-332-audit-braces` → `develop` |
| **Base inicial** | `20db1bdbfd44f5a398dbfa984cc8ea291a56a493` |
| **develop actual en R2** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **Estado** | BLOQUEADA — H01 parcial + conflicto con develop |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `2a3dc3a77cf453715d9806fba8bdc646aaafc40e` | H02 cerrado; H01 parcial; merge conflict | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR234-H01 | El guard del audit acepta bypasses del entorno del step | alto | parcial |
| PR234-H02 | La regla 00 contradice la excepción GHSA aprobada | alto | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones de Lautaro073

- **D01 — 2026-10-03: A.** Se aceptan excepciones por GHSA puntual cuando no hay versión corregida, la dependencia no llega a producción, la excepción está documentada y existe un control que impide ampliar/debilitar el gate.
- **D02 — 2026-10-03: A.** Como T-332 todavía no existía en `develop`, el issue #227 se acepta como autorización de alcance para que la ficha nazca en esta PR.

## Qué queda por hacer

1. Cerrar el residual de H01 con allowlist estructural del job/steps, incluyendo shell/defaults/steps extra.
2. Mergear `origin/develop` (sin rebase) y resolver `docs/implementation-plan.md` conservando **T-332 y T-333**.
3. Revalidar mutaciones, `verify-fichas`, merge-tree/mergeability y CI del SHA final.

## Para el análisis posterior

No se agrega AG nuevo en R2. H01 vuelve a confirmar `P08-control-no-cubre-lo-que-dice` y AG-75: cada arreglo de un guard necesita mutaciones nuevas de la revisión sobre lo que ese arreglo agregó.
