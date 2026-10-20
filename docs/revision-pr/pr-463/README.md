# PR #463 — T-381 · Conteo de ofertas del panel del comercio

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/463 |
| Tarea | T-381 · Fase 3 · issue #443 |
| Autor | @Lautaro073 |
| Rama | `feat/T-381-merchant-panel-refresh` → `develop` |
| SHA base | `cf2fbe13ab7ee8348b4805dadccef5416abb9265` |
| SHA de código revisado | `6e9e5457cf9267922feaa02997c5b6f8c4a0eb68` |
| Alcance de código | 7 archivos, +653/-2 líneas en PR antes del commit documental |
| Estado | Ronda 1: **1 bloqueante de cobertura**, 1 ampliación aceptada; no mergear |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `6e9e5457cf9267922feaa02997c5b6f8c4a0eb68` | CON BLOQUEANTES (1) | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Resumen | Severidad | Estado |
|---|---|---|---|
| PR463-H01 | Test de visibilidad no la aísla de foco y Realtime | medio / bloqueante DoD | abierto |
| PR463-A01 / D01 | Ampliación acotada de T-366 (salir del panel antes de sembrar) | decisión de alcance | aceptado por Lautaro073 (A) |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia/comandos: [comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md).

## Qué queda

1. El autor corrige SOLO la prueba de visibilidad según PR463-H01, preservando las demás expectativas y sin alterar código productivo salvo causa demostrada.
2. El autor registra RED/GREEN real y completo en `docs/tasks/log/T-381.md`; commit, push y confirma HEAD remoto.
3. Revisión independiente ronda 2 sobre ese SHA, con mutación propia ejecutada.
4. CI oficial completo incluido `e2e-preview` en el **último push funcional** y resolución de `approval-policy`; no exigir otro CI verde exclusivamente por documentación posterior.

La revisión NO aprueba ni mergea el PR.
