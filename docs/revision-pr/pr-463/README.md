# PR #463 — T-381 · Conteo de ofertas del panel del comercio

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/463 |
| Tarea | T-381 · Fase 3 · issue #443 |
| Autor | @Lautaro073 |
| Rama | `feat/T-381-merchant-panel-refresh` → `develop` |
| SHA base | `cf2fbe13ab7ee8348b4805dadccef5416abb9265` |
| SHA de código revisado | `00b3f6d5f020154515f3cc9ea360f251880d992e` |
| Alcance de código | 7 archivos, +653/-2 líneas en PR antes del commit documental |
| Estado | **Ronda 2: SIN BLOQUEANTES de código**; gate E2E oficial pendiente; no mergear todavía |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `6e9e5457cf9267922feaa02997c5b6f8c4a0eb68` | CON BLOQUEANTES (1) | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `00b3f6d5f020154515f3cc9ea360f251880d992e` | SIN BLOQUEANTES de código, CI final pendiente | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Resumen | Severidad | Estado |
|---|---|---|---|
| PR463-H01 | Test de visibilidad no la aísla de foco y Realtime | medio | **arreglado-verificado** (CI unit + sondeo estructural; RED autor) |
| PR463-A01 / D01 | Ampliación acotada de T-366 (salir del panel antes de sembrar) | decisión de alcance | aceptado por Lautaro073 (A) |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia/comandos: [comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md).

## Qué queda

1. En el **último push funcional**, correr el gate oficial completo de CI con `e2e-preview` (Chromium `CI=true --workers=1`, reintentos equivalentes, `global-settings`), confirmar T-366 y T-381 reales en Preview y resolver los checks obligatorios; `db-tests` en curso al redactar.
2. Si aparecen fallas atribuibles a T-381, abrir una nueva ronda con SHA actualizado. No contar `3 flaky` como `0 flaky`.
3. `approval-policy` debe consumir este informe publicado en el comentario de la PR. No pedir otra corrida completa solo por el commit documental de esta ronda.

**La ronda 2 no encontró bloqueantes nuevos de código**; el gate final es un requisito de merge aparte. Esta revisión **NO aprueba ni mergea** la PR.

## Alcance de la verificación independiente

Se ejecutó un sondeo **estructural estático** de aislamiento y mutación de fuente sobre el SHA revisado, y se inspeccionó el log de GitHub Actions de `unit` en ese mismo SHA. El RED de I01 de Vitest proviene **del autor**; no se ejecutó una mutación de Vitest independiente en esta sesión. Registrar esta limitación sin confundirla con un fallo de producto.
