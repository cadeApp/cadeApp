# PR #240 — T-334 · Onboarding incompleto de comercio y repartidor

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/240 |
| **Tarea** | T-334 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-334-incomplete-onboarding-redirect` → `develop` |
| **Base** | `b4119ef3e16170decda0a1649fc35db207faa8b0` |
| **Estado** | abierta · draft · BLOQUEADA SOLO POR H03 MANUAL |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `5c31ed86db8cacd923367deaa190c5880e0b60e5` | H01/H02/H03 abiertos; D01/D02 decididos | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `94cf3db9635833b3ef1c8723717908c11fac1bff` | H01 ✅ · H02 ✅ · D02 ✅ · H03 pendiente humana | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR240-H01 | La excepción de `/courier/profile` también abre sus descendientes | alto | ✅ cerrado en R2 |
| PR240-H02 | `vehicle_type` se escribe antes de que el onboarding termine | alto | ✅ cerrado en R2 |
| PR240-H03 | Falta la verificación manual de Develop exigida por el DoD | medio | ⏳ abierto; humana |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones vigentes

- **D01 = 1-A:** `vehicle_type` es el marcador final y se escribe después de consentimientos/documentos.
- **D02 = 2-A:** error/desconocido al leer el marcador mantiene fail-open de navegación (`undefined`).

## Ronda 2

Agy corrigió H01/H02 sin tocar `docs/revision-pr/pr-240/**` ni archivos fuera de alcance. Los tests nuevos no son tautológicos: ejercen el descendiente real `/courier/profile/notifications`, fallos reales de consentimientos/documentos y los dos roles para D02.

CI del SHA `94cf3db9635833b3ef1c8723717908c11fac1bff`: **run #1073 / 37159108997 SUCCESS** con build, lint, typecheck, unit/test:coverage, db-tests, audit y bundle-budget verdes.

La falla local reportada al ejecutar `pnpm test` fue atribuida a una carrera preexistente de `src/server/rpc/cc007.test.ts`, que muta `guards.ts`/`queries.ts` en disco mientras otras suites pueden importarlos. Se abrió **issue #243** para corregir esa infraestructura; no bloquea T-334.

Vercel no desplegó el SHA nuevo por límite diario de deployments. Por eso H03 sigue abierta: la prueba manual debe hacerse sobre un entorno que realmente ejecute este SHA o uno posterior.

## Qué queda por hacer

1. **Lautaro073:** verificación manual con un comercio recién registrado e incompleto.
2. **Lautaro073:** verificación manual con un repartidor recién registrado e incompleto.
3. Registrar resultado en `docs/tasks/log/T-334.md`.
4. Ronda final de revisión para cerrar H03 y recién ahí decidir merge.

## Seguimiento fuera de alcance

- #243 — aislar las mutaciones de `cc007.test.ts` para que `pnpm test` no tenga carreras sobre archivos fuente.
