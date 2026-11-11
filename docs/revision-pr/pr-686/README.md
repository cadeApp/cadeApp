# PR #686 — T-430 / CC-048 · SEC-06

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/686 |
| Tarea | T-430 (Fase 4), contrato CC-048 |
| Autor | @Lautaro073 |
| Rama | `feat/T-430-sec06-draft-only` → `develop` |
| Base actual revisada | `af023d3099e9e2ea15e3b78bf0cf5937e699058a` |
| SHA de código revisado en ronda 4 | `cbcace19dbe99d972a5873725abe1a9e5430f615` |
| Alcance | Cuatro archivos documentales de la tarea y cinco archivos de revisión de ronda 1; la ronda 2 añade un sexto archivo de revisión |
| Estado de ronda | **SIN BLOQUEANTES DOCUMENTALES (ronda 4)**; sin aprobación ni merge |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `0ed66974` | 2 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `a91e8e40` | H01 parcial, H02 cerrada, H03 alto + I01 integración | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `c777bf3a` | H03 diseño corregido/no runtime; I01 resuelto; H04 nuevo | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `cbcace19` | Sin bloqueantes documentales; H04 verificado; SQL pendiente de T-430 | [Ronda 4](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Hallazgo | Severidad | Estado |
|---|---|---|---|
| PR686-H01 | Falta garantía de serialización de contactos legacy ante publicación concurrente | alto | parcial (H03) |
| PR686-H02 | H07 puede pasar sin modificar ninguna fila ni demostrar `set_updated_at` | medio | arreglado-verificado (documental, a91e8e40) |
| PR686-H03 | Inversión de lock entre contacto legacy y publish_request | alto | arreglado-sin-verificar en PostgreSQL |
| PR686-H04 | INSERT y publish_request legacy ambos órdenes con único contacto obligatorio | medio | arreglado-verificado documental en cbcace19 |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y control: [evidencia/comandos.md](evidencia/comandos.md).

## Qué queda por hacer

Sin bloqueantes para el **PR documental**. La implementación T-430 debe demostrar el diseño en PostgreSQL con fixture legacy 0 drops, control `pg_blocking_pids`, `40P01`, grants y mutaciones RED→GREEN; si falla, volver al CC.

Mejora opcional M06: actualizar el cuerpo de la PR para reflejar que T-409 ya se sincronizó en `develop@af023d3`. No editar código ni requiere nueva ronda.

**Ronda 4: SIN BLOQUEANTES DOCUMENTALES; no es una aprobación ni un merge.**
