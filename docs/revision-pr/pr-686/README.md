# PR #686 — T-430 / CC-048 · SEC-06

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/686 |
| Tarea | T-430 (Fase 4), contrato CC-048 |
| Autor | @Lautaro073 |
| Rama | `feat/T-430-sec06-draft-only` → `develop` |
| Base revisada | `f33acf8a2a03e5c54f7da3fe6926464cc1dcbe10` |
| SHA de código revisado en ronda 2 | `a91e8e405ab19e5bb6f70759761d118b95c98df9` |
| Alcance | Cuatro archivos documentales de la tarea y cinco archivos de revisión de ronda 1; la ronda 2 añade un sexto archivo de revisión |
| Estado de ronda | **CON BLOQUEANTES (ronda 2: H03 + conflicto I01)**, sin aprobación |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `0ed66974` | 2 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `a91e8e40` | H01 parcial, H02 cerrada, H03 alto + I01 integración | [Ronda 2](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| PR686-H01 | Falta garantía de serialización de contactos legacy ante publicación concurrente | alto | parcial (H03) |
| PR686-H02 | H07 puede pasar sin modificar ninguna fila ni demostrar `set_updated_at` | medio | arreglado-verificado (documental, a91e8e40) |
| PR686-H03 | Inversión de lock entre contacto legacy y publish_request | alto | abierto |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y control: [evidencia/comandos.md](evidencia/comandos.md).

## Qué queda por hacer

Corregir CC-048, T-430 y su fila del plan: cubrir la carrera de la tabla legacy con el mecanismo de locks existente y prueba multisesión; reforzar el DoD de `rls_matrix.sql` caso 18. Una nueva ronda independiente debe comprobarlo. **No mergear esta PR antes del cierre.**

