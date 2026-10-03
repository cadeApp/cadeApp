# PR #234 — T-332 · El audit de CI deja de fallar por braces sin bajar el umbral

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/234 |
| **Tarea** | T-332 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-332-audit-braces` → `develop` |
| **Base inicial** | `20db1bdbfd44f5a398dbfa984cc8ea291a56a493` |
| **develop actual** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **Estado** | BLOQUEADA — H01 residual; T-333 rompe verify-fichas en develop |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `2a3dc3a77cf453715d9806fba8bdc646aaafc40e` | H02 cerrado; H01 parcial; merge conflict | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `7b088c87fb97b93e5f90565268f35e858438f963` | merge limpio; H01 aún parcial | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR234-H01 | El guard del audit no protege defaults de ejecución a nivel workflow | alto | parcial |
| PR234-H02 | La regla 00 contradice la excepción GHSA aprobada | alto | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones de Lautaro073

- **D01 — 2026-10-03: A.** Se aceptan excepciones por GHSA puntual cuando no hay versión corregida, la dependencia no llega a producción, la excepción está documentada y existe un control que impide ampliar/debilitar el gate.
- **D02 — 2026-10-03: A.** Como T-332 todavía no existía en `develop`, el issue #227 se acepta como autorización de alcance para que la ficha nazca en esta PR.

## Qué queda por hacer

1. Cerrar H01 también sobre el contexto global del workflow: ninguna `defaults:` / `env:` nueva puede alterar los `run` sin revisión.
2. Revalidar el guard con la mutación de `defaults.run.shell` a nivel workflow.
3. El fallo de T-333 en `verify-fichas` se corrige fuera de T-332; quedó registrado en issue #229.
4. Solo cuando H01 cierre y develop vuelva a estar verde, auditar CI del SHA final.

## Para el análisis posterior

No se agrega AG nuevo en R3. H01 sigue siendo `P08-control-no-cubre-lo-que-dice`: la allowlist cerró el job pero no el contexto global que heredan sus steps.
