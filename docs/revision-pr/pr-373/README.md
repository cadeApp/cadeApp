# PR #373 — CC-026 · Reconciliación transaccional de expiraciones

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/373 |
| CC / Issue | CC-026 · #371 · @Lautaro073 |
| Tarea bloqueada | T-366 · #355 / PR #370 · @KiraK72 |
| Rama | `cc/CC-026-reconciliacion-expiraciones` → `develop` |
| HEAD inspeccionado R1 | `eadaf54581b1c1cd3875e4a039ba66ffe70f0548` |
| HEAD inspeccionado R2 | `f62a385c6e152ea206598aa3460eeec31f97b2a1` |
| Base examinada | `687e2043817340b2951714cb6e7b179be2e3973a` |
| Estado | Draft WIP, CON BLOQUEANTES; NO MERGEAR |

## Rondas

| Ronda | SHA inspeccionado | Hallazgos nuevos | Informe |
|---|---|---|---|
| 1 | `eadaf545` | H01–H04 | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `f62a385` | H05–H10 | [Ronda 2](revisiones/ronda-2.md) |

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Ronda 2 — situación

- H01/H02: corregidos **por inspección de código**, sin verificación runtime independiente.
- H03: ampliado fake y pruebas TS; pgTAP/concurrencia real aún pendientes.
- H04: fuente documental `docs/master-plan.md` no reconciliada.
- H05: **brecha crítica de seguridad**. PostgreSQL/CI NO rechazó los UPDATE directos de `expires_at` y `decided_at`.
- H06: harness de dos sesiones no se ejecuta en job CI y tiene salida potencialmente no fiable.
- H07-H09: FK de fixture, test de endpoint cron y tipos generados impiden CI GREEN.
- H10: cron ignora `hasMore` con batch 200.
- SQL/RPC implementados provisionalmente en 17 archivos; aún no se autoriza el merge.

**Gate T-366:** #355 permanece `bloqueada` para @KiraK72; #371 sigue abierta para @Lautaro073.
