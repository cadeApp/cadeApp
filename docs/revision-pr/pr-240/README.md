# PR #240 — T-334 · Onboarding incompleto de comercio y repartidor

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/240 |
| **Tarea** | T-334 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-334-incomplete-onboarding-redirect` → `develop` |
| **Base** | `b4119ef3e16170decda0a1649fc35db207faa8b0` |
| **Tamaño revisado** | 11 archivos, +638 / -15 |
| **Estado** | abierta · draft · CON BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `5c31ed86db8cacd923367deaa190c5880e0b60e5` | 3 bloqueantes + 2 decisiones cerradas | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR240-H01 | La excepción de `/courier/profile` también abre sus descendientes | alto | abierto |
| PR240-H02 | `vehicle_type` se escribe antes de que el onboarding termine | alto | abierto; D01=1-A |
| PR240-H03 | Falta la verificación manual de Develop exigida por el DoD | medio | abierto; humana |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones de Lautaro073

- **D01 = 1-A:** ampliar T-334 a `src/features/courier-onboarding/actions.ts` y `actions.test.ts`; hacer que `vehicle_type` sea el marcador final, escrito después de consentimientos/documentos.
- **D02 = 2-A:** conservar fail-open de navegación cuando el marcador no puede leerse (`onboardingComplete = undefined`). RLS/RPC siguen siendo la autoridad.

La ficha `docs/tasks/T-334.md` se amplió en el mismo commit de revisión para reflejar ambas decisiones.

## Qué queda por hacer

1. Corregir H01 y H02 siguiendo el prompt del comentario de Ronda 1.
2. Agregar controles explícitos para D02 y mutarlos para demostrar que detectan una regresión.
3. Repetir checks en el SHA nuevo.
4. **Lautaro073:** ejecutar la verificación manual en Develop/Preview con un comercio y un repartidor recién registrados y dejar el resultado en la bitácora.
5. Volver a revisión independiente; no mergear todavía.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md).
