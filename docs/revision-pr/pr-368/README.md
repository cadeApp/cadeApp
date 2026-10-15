# PR #368 — T-354 · Texto consistente «Selfie con el DNI»

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/368 |
| Tarea | T-354 · Issue #341 |
| Autor | @KiraK72 (P2) |
| Rama | `feat/T-354-unificar-texto-selfie-dni` → `develop` |
| Base develop de ronda 2 | `b5b9bf036c4c863c334948065a8780f76a88f758` |
| HEAD de implementación inspeccionado ronda 2 | `b94c683756b3f37b3574d6691f95b2557c030416` |
| Estado | Draft · CON BLOQUEANTES (2 nuevos + evidencia parcial H02) |

## Rondas

| Ronda | HEAD revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `8316ea4f25a5e02b8db1e1c78a0efafb1d96e960` | 2 pendientes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `b94c683756b3f37b3574d6691f95b2557c030416` | 2 bloqueantes nuevos; H01 resuelto, H02 parcial | [Ronda 2](revisiones/ronda-2.md) |

## Estado de hallazgos

| ID | Clasificación | Estado |
|---|---|---|
| PR368-H01 — no había implementación | Alto | arreglado-verificado por inspección + CI unit + controles estáticos propios |
| PR368-H02 — falta prueba de efectividad | Alto | parcial: CI y estructura sí, RED Vitest de autor no reproducido y E2E no verificado |
| PR368-H03 — `any`, mutación de `globalThis` y `!` | Alto | abierto |
| PR368-H04 — falta evidencia E2E y visual | Alto | abierto |

La revisión preserva `revisiones/ronda-1.md` intacto. Los datos estructurados están en [hallazgos.jsonl](hallazgos.jsonl) y los pasos independientes en [evidencia/comandos.md](evidencia/comandos.md).

## Decisiones resueltas por Lautaro073

1-A test cruzado puntual; 2-B instrucción literal y multilínea; 3-A nombre completo en badge administrativo. Se aplicaron en la implementación; **no hay decisiones adicionales**.

## Verificaciones y límites

- En CI del SHA `b94c683756b3f37b3574d6691f95b2557c030416`: typecheck, lint, unit, build, audit y bundle-budget en verde; unit: **130 archivos, 2172 tests pasados** según log leído. `db-tests` en curso al consultar; `approval-policy` rojo a la espera de informe y body; E2E Preview sin run verificable.
- Revisión estática independiente vía conector GitHub: 11/11 controles sobre fuentes reales y 10/10 mutaciones de copia en memoria detectadas. **No equivalen a ejecutar los tests de Vitest mutados**.
- El entorno de revisión no permite clonar el repositorio ni instalar dependencias externas; no se declara ejecución local ni verificación visual de la web.
- Comparación remota detectó rama 12 commits por detrás de develop antes de cerrar ronda; integrar por merge antes del siguiente cierre, no rebase.

Para continuar: corregir H03 y H04 y completar evidencia pendiente de H02. No aprobar ni mergear.
