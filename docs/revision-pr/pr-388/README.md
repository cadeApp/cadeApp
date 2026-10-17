# PR #388 — T-369 · Paquetes de publicaciones y abono ilimitado

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/388 |
| Tarea | T-369 (planificación fase 3) · Issue #356 |
| Autor | @Lautaro073 |
| Rama | `docs/T-369-ficha` → `develop` |
| HEAD original de autor | `b597810ef7eddc319ce8cc9d62002f930379e1d0` |
| HEAD de cambios documentales | `ecd13a15831be01c9473c202151f49a2d7d07840` |
| Archivos originales | 2 (+222 líneas), solo documentación |
| Estado | Ronda 1: sin bloqueantes documentales; CI nuevo HEAD pendiente; implementar bloqueado hasta CC-029 |

## Rondas

| Ronda | SHA documentado revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `ecd13a15831be01c9473c202151f49a2d7d07840` | 4 ajustes resueltos por revisión, sin verificación independiente de autor distinto | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Estado | Resumen |
|---|---|---|
| PR388-H01 | `arreglado-sin-verificar` | Vencimiento con ofertas sin match |
| PR388-H02 | `arreglado-sin-verificar` | no_show y cancelación del repartidor: consumo debe volver a reserva |
| PR388-H03 | `arreglado-sin-verificar` | no_show sin republicar dejaba saldo inmovilizado |
| PR388-H04 | `arreglado-sin-verificar` | Descuento de primera compra no debe dispararse por acreditación gratis |

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia reproducible](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Por hacer

- Comprobar CI del HEAD posterior al commit de revisión, especialmente `approval-policy` y `e2e-preview` (el run anterior se canceló).
- Antes de implementar T-369, redactar y mergear CC-029 en PR separado. No activar monetización mientras haya piloto.
- El merge de #388 lo decide Lautaro073, no la revisión.
