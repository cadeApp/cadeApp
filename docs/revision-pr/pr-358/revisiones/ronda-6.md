# PR #358 — T-356 — Revisión independiente — Ronda 6 (cierre del gate E2E)
Fecha: 2026-10-17

**DICTAMEN: SIN BLOQUEANTES PENDIENTES PARA MERGE A DEVELOP, SUJETO A AUTORIZACIÓN EXPRESA DE LAUTARO073.** No se aprobó, cambió estado Draft ni se ejecutó merge.

## SHA y alcance
- **HEAD exacto revisado:** `83b39ca55470582e0a5c1eb0b9c8a1b8f468d983`, commit `docs(T-356): independent PR #358 review round 5`.
- **HEAD funcional idéntico:** `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`. El compare entre esos dos SHAs devuelve **solo cinco archivos** en `docs/revision-pr/pr-358/**`; no hay cambio funcional, E2E ni SQL entre ambos.
- **Base actual:** `develop@711a2f7054d77fd664d3ec09b3bbdd24efb88476`. GitHub `mergeable=true`, `mergeable_state=clean`; compare(develop,HEAD) = 0 behind, 25 ahead. PR sigue `OPEN`, `Draft`.
- Los archivos tocados por la PR son los de la allowlist de `docs/tasks/T-356.md` leído desde develop. La ficha en la PR marca checks del DoD, sin ampliar los «Archivos permitidos», dependencias ni cambiar arquitectura.

## E2E REAL — comprobación final
- **Workflow:** [39053537841](https://github.com/cadeApp/cadeApp/actions/runs/39053537841), `e2e-preview` job `117456835108`, `report-preview-status` job `117461967880`; ambos **SUCCESS**.
- **AVISO de alcance técnico:** La ejecución de Actions aparece con `head_sha=develop@711a2f7` porque el workflow confiable corre desde develop, PERO su job E2E hizo checkout explícito del commit PR `83b39ca55470582e0a5c1eb0b9c8a1b8f468d983` (log: `ref:`, `git fetch origin <sha>`, `git checkout --force <sha>`, `HEAD is now at 83b39ca`). La validación corresponde al **SHA exacto de PR**, no al árbol de develop.
- **Destino:** Supabase Develop, proyecto `kaosdpmqlrtmvsqmceso`, distinto de staging; `Verify Supabase Develop target` y `Health check` **SUCCESS**.
- **Resultado del log:** `Running 86 tests using 1 worker` → **`86 passed (22.1m)`** Chromium; `Running 3 tests using 1 worker` → **`3 passed (56.2s)`** global-settings. Total **89/89 PASS**, cero fallos indicados; no `skipped`.
- Caso concreto **T-356 / CC-025** (`e2e/specs/courier-onboarding.spec.ts:822`) pasó, marcado `✓ 13 [chromium]` en **29.5s**, incluye recarga de documento rechazado, motivo seguro y estados consistentes.
- **Status publicado en SHA PR:** API `/commits/83b39ca/status`: `context=e2e-preview, state=success`, description `trusted E2E gate GREEN contra el Preview [dpl_8vY5a3Sxd4WkDARM6nJCyFWwiGNy]`. No confundir este resultado con el run anterior `39052264162`, que terminó **cancelled** con status error para `ed4a118f`.
- Las 86 pruebas se ejecutaron contra un URL Preview mostrado en la variable `PREVIEW_URL` del job. El status publicado confirmó el ID de despliegue del SHA; la referencia de la ejecución y checkout son la evidencia autoritativa.

## CI completo del HEAD exacto
- [CI 39053456434](https://github.com/cadeApp/cadeApp/actions/runs/39053456434): `unit`, `db-tests`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` **SUCCESS**.
- Log `unit` job `117456551228`: **139 Test Files / 2618 Tests PASS**; workflow tests 79 y ADR 6 adicionales en job.
- Log `db-tests` job `117456551190`: **27 archivos / 2420 pgTAP PASS** en salida final. Las mutaciones intencionales del CI generan RED intermedio pero se restauran; el job terminó SUCCESS. No se corrió SQL remoto ni Docker local durante la revisión.
- [approval-policy 39053455229](https://github.com/cadeApp/cadeApp/actions/runs/39053455229) SUCCESS: verifica formato, no autoría ni aprobación independiente.
- Vercel checks SUCCESS. `Supabase Preview` figura `skipped` (se usa Supabase Develop ya existente, no confundir con que el E2E se omitió).

## Hallazgos y riesgo aceptado
- **H06:** `arreglado-verificado` en SHA funcional `ed4a118f`, método de Ronda 5: función fuente original extraída/ejecutada en V8, GREEN 10 → RED 7 (mutación propia en memoria) → GREEN 10; E2E del descendiente documental pasó. La ejecución no equivale a importar TypeScript completo; se respeta alcance de verificación.
- **H03/H04/H05, R02/R03, H01/H02:** quedan `arreglado-sin-verificar` formalmente (sin mutación independiente ejecutada para esos arreglos); se inspeccionaron sus fuentes y los CI/E2E reales del flujo. Esta ronda no inventa `verificado_en_sha` retrospectivos.
- **R01:** `parcial` por riesgo de objetos Storage huérfanos y upload ambiguo. **DECISIÓN A anterior de Lautaro073:** trasladado a **T-370 / [issue #399](https://github.com/cadeApp/cadeApp/issues/399)**, *bloqueante antes de promover CC-025 a staging o producción, NO bloqueante de merge UI a develop*. T-370 permanece abierta. No declarar que la solución operativa está desplegada.
- **Issue CC-025 [#363](https://github.com/cadeApp/cadeApp/issues/363)** sigue abierto; no cerrar por este dictamen.
- No se detectaron **nuevos** defectos de código al comprobar este cierre; desde ronda 5 el diff es solo documental.

## Límite de revisión y acción habilitada
**Resultado: PR #358 técnicamente lista para que el dueño decida sacarla de Draft y mergearla a DEVELOP únicamente.** No está autorizado staging/main y no se desplegó ni mergeó nada. Al efectuar el merge deberá mantenerse pendiente T-370 como bloqueo del rollout CC-025.

**No solicitar otro CI ni E2E por este commit exclusivo de `docs/revision-pr/pr-358/**`** (regla 10 del proyecto); SHA funcional ya probado. Solo nuevos cambios funcionales, conflictos o divergencia real en develop exigirían revalidación.

**Método de esta ronda:** lectura por GitHub connector de PR, diff SHAs, check-runs, status commit y logs completos de jobs. El revisor no ejecutó Vitest, pgTAP o Playwright local en esta ronda; atribuyó sus resultados a logs CI reales. No ejecutó mutaciones adicionales, porque no cambió código después de R5.
