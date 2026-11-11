# PR #686 — T-430 / CC-048 · SEC-06

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/686 |
| Tarea | T-430 (Fase 4), contrato CC-048 |
| Autor | @Lautaro073 |
| Rama | `feat/T-430-sec06-draft-only` → `develop` |
| Base actual revisada | `af023d3099e9e2ea15e3b78bf0cf5937e699058a` |
| SHA de código revisado en ronda 3 | `c777bf3a81b7b21ecc0546a224f702fc0762d570` |
| Alcance | Cuatro archivos documentales de la tarea y cinco archivos de revisión de ronda 1; la ronda 2 añade un sexto archivo de revisión |
| Estado de ronda | **CON BLOQUEANTES (ronda 3: H04)**, sin aprobación |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `0ed66974` | 2 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `a91e8e40` | H01 parcial, H02 cerrada, H03 alto + I01 integración | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `c777bf3a` | H03 diseño corregido/no runtime; I01 resuelto; H04 nuevo | [Ronda 3](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| PR686-H01 | Falta garantía de serialización de contactos legacy ante publicación concurrente | alto | parcial (H03) |
| PR686-H02 | H07 puede pasar sin modificar ninguna fila ni demostrar `set_updated_at` | medio | arreglado-verificado (documental, a91e8e40) |
| PR686-H03 | Inversión de lock entre contacto legacy y publish_request | alto | arreglado-sin-verificar en PostgreSQL |
| PR686-H04 | INSERT y publish_request legacy ambos órdenes con único contacto obligatorio | medio | abierto |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y control: [evidencia/comandos.md](evidencia/comandos.md).

## Qué queda por hacer

1. Resolver H04: separar fixture legacy para UPDATE (contacto previo) y para INSERT primero (sin contacto), y no exigir «publicación primero + INSERT» como carrera legítima de `publish_request`.
2. Corregir M05 (prioridad de §Propuesto 6 sobre 2 y mención condicional del helper opcional).
3. Probar la estrategia real de locks cuando se implemente T-430; la PR actual solo es documental. Pedir ronda 4.

**No aprobar ni mergear esta PR antes del cierre de H04.**
