# PR #234 — T-332 · El audit de CI deja de fallar por braces sin bajar el umbral

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/234 |
| **Tarea** | T-332 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-332-audit-braces` → `develop` |
| **Base revisada** | `20db1bdbfd44f5a398dbfa984cc8ea291a56a493` |
| **Tamaño inicial** | 6 archivos, +221 / -0 líneas |
| **Estado** | BLOQUEADA — 2 hallazgos |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR234-H01 | El guard del audit acepta bypasses que hacen inalcanzable el comando | alto | abierto |
| PR234-H02 | La regla 00 contradice la excepción GHSA aprobada | alto | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones de Lautaro073

- **D01 — 2026-10-03: A.** Se aceptan excepciones por GHSA puntual cuando no hay versión corregida, la dependencia no llega a producción, la excepción está documentada y existe un control que impide ampliar/debilitar el gate.
- **D02 — 2026-10-03: A.** Como T-332 todavía no existía en `develop`, el issue #227 se acepta como autorización de alcance para que la ficha nazca en esta PR. La revisión no trata la ficha de la rama como autoridad previa al SHA.

## Qué queda por hacer

1. Corregir PR234-H01 con un control estructural del job/step de audit y demostrar las mutaciones nuevas en RED.
2. Codificar D01 en `.agents/rules/00-confianza-y-seguridad.md`; actualizar el alcance de T-332/plan para permitir exactamente ese archivo.
3. Revalidar la PR en una Ronda 2 y recién entonces auditar los logs de CI del SHA corregido.

## Para el análisis posterior

No se agrega una lección AG nueva en esta ronda. H01 repite `P08-control-no-cubre-lo-que-dice` y la disciplina de AG-75: la batería del autor no sustituye mutaciones nuevas de la revisión.
