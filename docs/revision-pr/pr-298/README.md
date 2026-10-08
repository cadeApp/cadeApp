# PR #298 — T-314 · E2E de mapas, geolocalización y privacidad

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/298 |
| Tarea | T-314 (P3; Issue #46; Fase 3) |
| Rama | `feat/T-314-map-privacy` → `develop` |
| SHA revisado en R4 | `0b5479059927d1f3ebdf56a85a0182ad31c1b6b1` |
| Estado | **CON BLOQUEANTES (2: H07 y H05)** |
| Decisión previa | PR298-D01=A: privacidad DOM + red/RSC |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `d60a047` | 5 bloqueantes | [R1](revisiones/ronda-1.md) |
| 2 | `e72a457` | 3 bloqueantes | [R2](revisiones/ronda-2.md) |
| 3 | `67de7f9` | 5 bloqueantes | [R3](revisiones/ronda-3.md) |
| 4 | `0b54790` | **2 bloqueantes: H07 y H05** | [R4](revisiones/ronda-4.md) |

## Hallazgos al cerrar R4

| ID | Estado | Evidencia |
|---|---|---|
| H01 | arreglado-sin-verificar | E2E privacidad DOM+red/RSC verde; falta mutación independiente |
| H02 | arreglado-sin-verificar | selector único por inspección; flujo no llega al pin porque MapPicker crashea |
| H03 | arreglado-sin-verificar | E2E matched verde; no mutation proof independiente |
| H04 | arreglado-sin-verificar | E2E Google mock verde; **no prueba UI sana**: requiere aserción MapPicker |
| H05 | **abierto (bloqueante de cierre)** | CI E2E rojo; bitácora aún debe registrar último resultado real |
| H06 | arreglado-sin-verificar | autenticación/aislamiento de roles en spec; tests correspondientes verdes |
| H07 | **abierto (bloqueante funcional)** | mock `google.maps.Marker` no tiene `setDraggable`; ambas pantallas caen en error boundary |

## Checks del SHA revisado

- CI **37725958413**: success (unit, typecheck, lint, build, db-tests, audit, bundle-budget).
- Trusted E2E **37726083350**: **47 passed / 2 failed**, las dos fallas son de MapPicker (onboarding y request).
- PR sigue draft y sin merge; mergeability informada como true.
- Comparación vs develop: 10 commits ahead / 6 behind, 9 archivos de la PR dentro del alcance de ficha; correcciones de agy tras R3 solo `e2e/specs/map-privacy.spec.ts` y `docs/tasks/log/T-314.md`.

Informe íntegro en `revisiones/ronda-4.md`. Datos en `hallazgos.jsonl`; pruebas en `evidencia/comandos.md`.
