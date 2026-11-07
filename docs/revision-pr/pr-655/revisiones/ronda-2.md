# Informe de revisión independiente — PR #655 / T-429 — Ronda 2

**Fecha:** 2026-11-07  
**PR:** https://github.com/cadeApp/cadeApp/pull/655  
**SHA revisado:** `002797727bbb564b9c99f35050dfbfecab4fb108`  
**Base develop:** `15dbf93f21662082bd45ca299d271e855049482a`

**Resultado: SIN BLOQUEANTES.** 3 hallazgos de R1 cerrados, 0 bloqueantes nuevos, 0 decisiones pendientes. No aprobar ni mergear automáticamente.

## Correcciones verificadas
| Hallazgo | Estado | Evidencia independiente |
|---|---|---|
| PR655-H01 · `B:` aislado | **Arreglado-verificado** | `isStreamingSettled` retorna false con `B:1` aislado, `B+S` y mezcla; true con `S` huérfano; control 5/5, mutaciones M01/M02 RED. |
| PR655-H02 · timeout único | **Arreglado-verificado** | `waitForNoSkeletons` toma deadline; para 14 s skeleton + 2 s streaming con T=15 s, `waitForFunction` solo recibe 1000ms y rechaza; M03/M06 RED. |
| PR655-H03 · integración real | **Arreglado-verificado** | 20 tests CI exact-head; test importa el helper y evalúa el predicado serializado en jsdom; comprobación independiente del callsite y mutaciones M04/M05 RED. |

## Enumeración completa de clases y seguridad de los controles
- Streaming DOM: vacío, B sin S, B+S, S huérfano, mezcla de múltiples IDs. No se borra DOM de la app. `isStreamingSettled` es autocontenida para el navegador y `inspectStreamingSegments` distingue pending/orphaned.
- Skeletons: la espera usa `locator(selector).filter({ visible: true }).first().waitFor({ state: 'detached' })`, sin limitarse a un skeleton oculto. El `timeout` es por llamada y el remanente nunca pasa como 0. Los mocks unitarios prueban la forma del callsite, no todas las garantías del motor real de Playwright; el gate real del SHA completo está verde.
- Aserciones: no se cambió ningún `toHaveCount(0)` de privacidad ni el spec `admin-courier-reinstate`. Los cuatro filtros `visible:true` de la fase previa se mantienen.
- Cambios desde el commit de R1 `95b431b`: solo cuatro archivos autorizados (`skeletons.ts`, `streaming.ts`, `e2e-streaming.test.ts`, `docs/tasks/log/T-429.md`); sin alteraciones del autor a `docs/revision-pr/pr-655/`.

## Checks oficiales (SHA exacto)
| Control | Resultado |
|---|---|
| `CI 42414714756` | **success**, typecheck ✅, lint ✅, build ✅; 199 files y 3755 tests ✅; db-tests `Files=43, Tests=3582, Result: PASS` |
| `e2e-preview 42415349609` | checkout exacto de `002797727bbb564b9c99f35050dfbfecab4fb108`, 123 Chromium + 7 global-settings aprobados, 0 flaky, 0 failed, 9 diagnósticos de huérfanos |
| Controles independientes R2 | 5 casos funcionales GREEN + 6 mutaciones (M01–M06) detectadas en RED en código eval. V8/Node con DOM/Page controlado |
| `analizar.mjs verificacion` | Script inspeccionado y ejecutado en copia temporal limitada a `pr-655`: 3 verificados/0 pendientes; no se pudo ejecutar la agregación global sin clon |
| `git merge-tree` | No ejecutado (DNS github.com indisponible en contenedor); GitHub responde `mergeable:true`, develop no cambió |

## Observaciones no bloqueantes
- El autor registró dos fallos intermitentes sin identificar en su primer `pnpm test`; el segundo intento y la corrida independiente de CI finalizaron 3755/3755. Sin salida de los fallos no se puede asignar causa ni afirmar una regresión de T-429. En una futura intermitencia conservar nombres y salida resumida; no exigir un gate extra por este dato.
- `isStreamingSettled` vuelve a recorrer los `S:` después de comprobar que no hay `B:`; esa segunda pasada es lógicamente redundante, pero no cambia corrección ni amerita nueva ronda/refactor.
- Excesos de bundle preexistentes (CI advisory) quedan fuera de esta PR; no son causados por los cambios E2E.

## Verificación / no verificaciones
La función real del SHA se ejecutó en controles V8 y Node sobre código extraído de GitHub y un checkout temporal de extractos exactos; no es equivalente a ejecutar todo el proyecto. No se reprodujeron **literalmente** los RED de Vitest del autor. Sí se inspeccionó la suite nueva y el job oficial confirmó 20/20 en ese SHA; las seis mutaciones son nuevas y propias del revisor. Detalle y **script íntegro** en `../evidencia/comandos.md`.

## Resultado operativo
**Se puede considerar lista para el merge desde la revisión independiente.** Lautaro073 decide si y cuándo mergear; el revisor no aprobó, no mergeó, ni ejecutó comandos contra Supabase/Vercel. Como este commit de ronda es solo `docs/revision-pr/**`, no exigir CI/E2E adicional al de `002797727bbb564b9c99f35050dfbfecab4fb108` (regla décima). No hay 🔵 DECISIÓN nuevas.