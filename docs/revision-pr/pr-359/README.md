# PR #359 — T-360 · Viajes activos en el feed del repartidor

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/359 |
| Tarea | T-360 · Fase 3 · Issue #347 |
| Autor | @Lautaro073 |
| Rama | `feat/T-360-resumen-viajes-activos` → `develop` |
| Base examinada | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| SHA revisado en ronda 1 | `65997dd27f652cf4d00aa616b1d26c46d16fd3e0` |
| Tamaño al revisar | 1 archivo, +13 líneas (solo bitácora) |
| Estado | Draft, **CON BLOQUEANTES** (ronda 2: 4 pendientes) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `65997dd27f652cf4d00aa616b1d26c46d16fd3e0` | 2 históricos | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

| 2 | `bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5` | 4 abiertos | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos

| ID | Alcance | Estado |
|---|---|---|
| PR359-H01 | Consulta y sección de viajes activos faltantes | Arreglado-sin-verificar |
| PR359-H02 | Tests RED/GREEN y E2E faltantes | Parcial |
| PR359-H03 | Refetch Realtime no probado mediante evento | Abierto |
| PR359-H04 | E2E incompleto/no ejecutado | Abierto |
| PR359-H05 | Fallo de drops ignorado | Abierto |
| PR359-H06 | Monto multi-drop ambiguo | Abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Decisiones cerradas por Lautaro073

1-A consulta específica con RLS y correspondencia oferta/request; 2-A ocultar sección solo con cero confirmado; 3-A resumen multi-drop; 4-A realtime + query invalidation y refetch de respaldo. Se registran en el comentario de cierre de esta ronda, que contiene el prompt **completo** para agy.

## Pendiente

Corregir bloqueantes H03-H06; E2E Preview real y revisión independiente ronda 3 sobre nuevo SHA. No se autoriza merge ni aprobación con esta ronda.
