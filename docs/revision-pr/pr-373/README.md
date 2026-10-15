# PR #373 — CC-026 · Reconciliación transaccional de expiraciones

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/373 |
| CC / Issue | CC-026 · #371 · @Lautaro073 |
| Tarea bloqueada | T-366 · #355 / PR #370 · @KiraK72 |
| Rama | `cc/CC-026-reconciliacion-expiraciones` → `develop` |
| HEAD revisado, sin informe | `eadaf54581b1c1cd3875e4a039ba66ffe70f0548` |
| Base examinada | `687e2043817340b2951714cb6e7b179be2e3973a` |
| Diff | 7 archivos, +160 / -7 líneas |
| Estado | Draft WIP, CON BLOQUEANTES de contrato y cobertura; NO MERGEAR |

## Rondas

| Ronda | SHA inspeccionado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `eadaf54581b1c1cd3875e4a039ba66ffe70f0548` | 4 (1 alto, 2 medios, 1 bajo) | [Ronda 1](revisiones/ronda-1.md) |

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Gate de contrato — pendiente, no hallazgo nuevo del código WIP

La PR declara de forma expresa que sigue WIP. Aún no existen la migración SQL, el helper transaccional, la RPC del cron ni el refactor de `src/server/cron/sweep.ts`; tampoco pgTAP, concurrencia real ni regeneración de tipos. **No tratar el WIP declarado como implementación terminada.** La aprobación técnica del CC-026 y el cierre de issue #371 quedan prohibidos hasta que el contrato esté implementado, la revisión independiente lo verifique y CI/migración esté disponible en Develop. T-366 de Kira sigue bloqueada.

## Resumen de hallazgos abiertos

| ID | Tema | Severidad | Estado |
|---|---|---|---|
| PR373-H01 | Respuesta de validación no declarada en errorCodes | alto | abierto |
| PR373-H02 | Output permite conteos e IDs contradictorios | medio | abierto |
| PR373-H03 | Falta matriz negativa/batches en pruebas introducidas | medio | abierto |
| PR373-H04 | Plan maestro aún afirma vencimiento estrictamente posterior | bajo | abierto |

## Qué sigue

Corregir H01-H04, completar el CC funcional según `docs/contracts/CC-026.md` de `develop` y recién entonces pedir otra revisión, con evidencia SQL/pgTAP y tests RED→GREEN reales.
