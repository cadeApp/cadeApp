# PR #455 — T-385 · RPC de reactivación CC-034

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/455 |
| Tarea | T-385 (Fase 3) |
| Autor | @Lautaro073 |
| Rama | `feat/T-385-cc034-reinstate-courier` → `develop` |
| Base | `03dec5b074e634d6f3895c282e58f7d7e6eb4456` |
| Último HEAD examinado | `208fbf7e341fb907edc5ebf5ec8d6b9b90476e8c` |
| SHA funcional verificado | `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860` |
| Estado | **SIN BLOQUEANTES**, ronda 2, sin merge |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `cffb9ff62d98eba993a2e14124afa639cdce709a` | 2 abiertos | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `208fbf7e341fb907edc5ebf5ec8d6b9b90476e8c` (código `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`) | 2 cerrados, 0 nuevos | [Ronda 2](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR455-H01 | Fake sobrescribe `available` contra CC-034 | medio | arreglado-verificado en `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860` |
| PR455-H02 | pgTAP no observa el `UPDATE` prohibido en ruta idempotente | medio | arreglado-verificado en `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860` |

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Pendientes operativos (no bloqueos de la ronda)

- Esta revisión solo publica informe, **no** aprueba ni mergea.
- El comentario del PR con el bloque «Informe revisar-pr» debe ser visible para `approval-policy`; revisar si queda rojo.
- El último commit tras la revisión es documental, no necesita otra ronda de CI exclusivamente por bitácora.
- Al mergear T-385, comprobar en `migrate-develop` que la migración CC-034 se aplicó antes de empezar T-380.
- Sin decisiones nuevas de producto.
