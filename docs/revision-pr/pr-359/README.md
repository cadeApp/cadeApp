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
| Estado | Draft, **SIN BLOQUEANTES detectados en ronda 4** (no se aprobó ni mergeó) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `65997dd27f652cf4d00aa616b1d26c46d16fd3e0` | 2 históricos | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5` | 4 históricos | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `0aa411eb6731c8113718cc363190ad24d76d6820` | 2 históricos | [revisiones/ronda-3.md](revisiones/ronda-3.md) |
| 4 | `361317a17b9b99d0c3bdc3d9366966eb898064a0` | 0 bloqueantes; 3 verificados por CI y 4 corregidos sin mutación independiente | [revisiones/ronda-4.md](revisiones/ronda-4.md) |

## Hallazgos

| ID | Alcance | Estado |
|---|---|---|
| PR359-H01 | Consulta y sección de viajes activos faltantes | Arreglado-verificado (CI E2E) |
| PR359-H02 | Tests RED/GREEN y E2E faltantes | Arreglado-sin-verificar (mutaciones propias pendientes) |
| PR359-H03 | Refetch Realtime no probado mediante evento | Arreglado-sin-verificar |
| PR359-H04 | E2E incompleto/no ejecutado | Arreglado-verificado (CI E2E) |
| PR359-H05 | Fallo de drops ignorado | Arreglado-sin-verificar |
| PR359-H06 | Monto multi-drop ambiguo | Arreglado-sin-verificar |
| PR359-H07 | E2E recurre a la primera oferta por selector inválido | Arreglado-verificado (CI E2E) |

[Datos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Decisiones cerradas por Lautaro073

1-A consulta específica con RLS y correspondencia oferta/request; 2-A ocultar sección solo con cero confirmado; 3-A resumen multi-drop; 4-A realtime + query invalidation y refetch de respaldo. Se registran en el comentario de cierre de esta ronda, que contiene el prompt **completo** para agy.

## Pendiente

Ronda 4: no se observaron bloqueantes. E2E Preview PASS en 361317a17b9b99d0c3bdc3d9366966eb898064a0 (75 Chromium, 3 global-settings). H02/H03/H05/H06 continúan en `arreglado-sin-verificar` respecto de mutaciones independientes no ejecutadas aquí; NO se falsificó esa evidencia. Esta revisión no aprueba ni mergea. El commit documental posterior puede generar nuevos checks y requiere que Lautaro073 confirme el HEAD final antes del merge.
