# PR #234 — T-332 · El audit de CI deja de fallar por braces sin bajar el umbral

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/234 |
| **Tarea** | T-332 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-332-audit-braces` → `develop` |
| **Base inicial** | `20db1bdbfd44f5a398dbfa984cc8ea291a56a493` |
| **develop actual** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **Estado** | SIN BLOQUEANTES PROPIOS — CI rojo heredado de T-333 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `2a3dc3a77cf453715d9806fba8bdc646aaafc40e` | H02 cerrado; H01 parcial; merge conflict | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `7b088c87fb97b93e5f90565268f35e858438f963` | merge limpio; H01 parcial | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `3b93acf2433c8ae0dd44ae854add2f395c99cf0e` | H01 parcial: trigger no fijado | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `05e746356da224990ef35af89c619d7a20956628` | H01 y H02 cerrados; CI rojo solo por T-333 | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR234-H01 | El guard del audit no probaba toda la cadena de ejecución | alto | arreglado-verificado |
| PR234-H02 | La regla 00 contradice la excepción GHSA aprobada | alto | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones de Lautaro073

- **D01 — 2026-10-03: A.** Se aceptan excepciones por GHSA puntual cuando no hay versión corregida, la dependencia no llega a producción, la excepción está documentada y existe un control que impide ampliar/debilitar el gate.
- **D02 — 2026-10-03: A.** Como T-332 todavía no existía en `develop`, el issue #227 se acepta como autorización de alcance para que la ficha nazca en esta PR.

## Estado de integración

T-332 ya no tiene hallazgos abiertos. El workflow de CI del SHA revisado falla únicamente en `unit` por `tools/verify-fichas.test.ts` → `T-333`, que está heredada de `develop` y no aparece en el diff de esta PR.

El propio DoD de T-332 exige CI GREEN. Por eso la revisión no marca la PR como lista para merge todavía: primero debe corregirse T-333 fuera de esta rama y revalidarse el CI sobre la nueva base.
