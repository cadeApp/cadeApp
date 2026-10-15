# PR #368 — T-354 · Texto consistente «Selfie con el DNI»

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/368 |
| Tarea | T-354 · Issue #341 |
| Autor | @KiraK72 (P2) |
| Rama | `feat/T-354-unificar-texto-selfie-dni` → `develop` |
| Base consultada | `eff5274dd5dbb1d6a0fb658299bbbdaceff44911` |
| HEAD de implementación inspeccionado | `83734650a04cc438ce117772419f2f3a61142083` |
| HEAD revisado (incluida actualización autorizada de ficha) | `8316ea4f25a5e02b8db1e1c78a0efafb1d96e960` |
| Estado | Draft, **CON BLOQUEANTES 2** (sin código de implementación todavía) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `8316ea4f25a5e02b8db1e1c78a0efafb1d96e960` | 2 abiertos | [Ronda 1](revisiones/ronda-1.md) |

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR368-H01 | Objetivo de T-354 todavía no implementado | alto | abierto |
| PR368-H02 | Pruebas nuevas, mutaciones y E2E todavía sin evidencia | alto | abierto |

Registro estructurado: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y comandos: [evidencia/comandos.md](evidencia/comandos.md).

## Decisiones resueltas
- **1-A:** autorizar exclusivamente `src/features/offers/courier-panel.test.tsx` para actualizar aserción del nombre, conservando estado.
- **2-B:** `Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones`, sin truncar en móvil.
- **3-A:** etiqueta completa `Selfie con el DNI` también en el badge de cola admin.

Las tres decisiones quedaron registradas en la ficha de la PR. Esta revisión no implementa cambios de interfaz; los debe realizar el autor y luego deben recibir verificación independiente nueva.

## Pendiente
Implementación de copy en cuatro vistas y estados, actualización controlada de aserciones, RED→GREEN real, test accesible, evidencia visual móvil, E2E Preview con SHA y run, checks completos y próxima ronda independiente. La rama se encontraba 4 commits por detrás de develop en la consulta previa; el autor debe integrarlo por merge, sin rebase.

Ver [lecciones.md](lecciones.md).
