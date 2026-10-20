# PR #455 — T-385 · RPC de reactivación CC-034

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/455 |
| Tarea | T-385 (Fase 3) |
| Autor | @Lautaro073 |
| Rama | `feat/T-385-cc034-reinstate-courier` → `develop` |
| Base | `03dec5b074e634d6f3895c282e58f7d7e6eb4456` |
| HEAD revisado | `cffb9ff62d98eba993a2e14124afa639cdce709a` |
| Tamaño | 11 archivos, +1260 / −1 |
| Estado | CON BLOQUEANTES (2), ronda 1 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `cffb9ff62d98eba993a2e14124afa639cdce709a` | 2 | [Ronda 1](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR455-H01 | Fake sobrescribe `available` contra CC-034 | medio | abierto |
| PR455-H02 | pgTAP no observa el `UPDATE` prohibido en ruta idempotente | medio | abierto |

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Qué queda por hacer

1. Que el agy modifique únicamente `src/domain/testing/rpc-fake.ts`, `src/domain/cc034-admin-reinstate-courier.test.ts`, `supabase/tests/cc034_admin_reinstate_courier.sql` y `docs/tasks/log/T-385.md`.
2. Demostrar RED→GREEN por cada caso sin manipular expectativas ni controles.
3. Ejecutar CI `db-tests`, suite de dominio y checks generales sobre el commit de arreglo.
4. Pedir ronda 2 de revisión independiente. No mergear hasta cerrar los hallazgos.

No hay decisiones de producto nuevas: CC-034 está aprobado y explícito. Se revisó el HEAD indicado, no el commit que contiene esta documentación.
