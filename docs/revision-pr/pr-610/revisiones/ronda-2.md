# PR #610 — T-422 — Revisión independiente · Ronda 2

- **Fecha:** 2026-11-04 (ART); **SHA revisado:** `ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7`, parent `ae034eb0a75f5ba1bebb5bd9e6d23d47a92fde28`; **base develop:** `7d07fdf80d94bce49580ec84cc39722b5bff4756`.
- **Resultado:** **SIN BLOQUEANTES** · H01, H02 y H03 verificados, no residuales funcionales detectados. **No aprobar ni mergear** por cuenta del reviewer.
- **Precondiciones:** PR abierta y Draft; el HEAD remoto coincide con el solicitado. Diff R1-review → R2 = un commit con 7 archivos (dos workflows, resolvedor, tests, runbook, ficha y bitácora); no se tocó `docs/revision-pr/pr-610/` por el autor.
- **Alcance:** la ficha vigente en la PR permite los cambios; D01=B (ficha creada en la PR) y D03=B (edición **solo** `queue: max` de `e2e-mutation.yml`) son decisiones expresamente aceptadas por P1. Se comparó mecánicamente contra la versión de R1. `develop` no avanzó respecto de la base indicada, con `mergeable:true` de GitHub; no se pudo ejecutar `git merge-tree` en un clon por fallo de DNS del entorno.

## Revalidación de los hallazgos previos

### PR610-H01 — ALTO — arreglado-verificado
`.github/workflows/e2e-preview.yml`: `Build PR without privileged secrets` corre `pnpm build` con variables públicas `NEXT_PUBLIC_*`. El job no hereda secretos; `Run preview E2E gate` recibe `SUPABASE_SERVICE_ROLE_KEY`, `DNI_HMAC_SECRET` y `CRON_SECRET` únicamente después y no recompila, sino que arranca `next start` y los dos proyectos de Playwright. El test original de H01 revisa el orden y los env. **Verificación independiente:** controles GREEN sobre el YAML exacto, mutaciones en memoria M06/M07/M08 RED al inyectar service role al build, DNI a nivel job o nuevo build en el runtime.

**Límite:** esto prueba aislamiento de `env` del step de build, no un sandbox de seguridad entre steps del mismo runner. El code under test sigue siendo confiado por ser PR interna, como en el gate anterior; no se afirma protección completa frente a colaborador interno malicioso.

### PR610-H02 — ALTO — arreglado-verificado
`.github/workflows/e2e-preview-target.mjs`, `matchPullRequest`: requiere una asociación única en `workflow_run.pull_requests`, con el mismo número de PR, base `develop` y head SHA exacto. Las respuestas de `/commits/{sha}/pulls` siguen verificando estado abierto, base/head repo y unicidad. **RED → GREEN real:** con run de staging #999 y PR a develop #321 del mismo SHA, el helper del SHA anterior respondió `match`; el nuevo responde `skip`. La mutación independiente que elimina la guarda vuelve a dar RED. También pasaron escenarios negativos de array vacío, ambiguo, número distinto o malformado y CI rojo/fork.

### PR610-H03 — MEDIO — arreglado-verificado
`.github/workflows/e2e-preview.yml::jobs.e2e.concurrency` y `.github/workflows/e2e-mutation.yml::jobs.mutation.concurrency` conservan el grupo `cadeapp-develop-e2e`, `cancel-in-progress: false` e incluyen `queue: max`. Mutaciones independientes que quitan la línea en cada workflow por separado: RED; controles originales: GREEN. Documentación GitHub Actions actual confirma máximo 100 pendientes y prohibición de combinar `queue: max` con `cancel-in-progress: true`.

## Ejecución y CI

**Controles del revisor:** 27/27 resultados esperados contra el contenido exacto del SHA (17 controles positivos, 10 mutaciones negativas en memoria, con defensa de objetivo ausente). La batería es independiente de la que consta en la bitácora del autor. Script reproducible íntegro en `evidencia/comandos.md` y `evidencia/mutaciones-pr610-r2.mjs`.

**Evidencia del autor contrastada:** bitácora de sesión 2 declara RED de H02 antes del arreglo, seis mutaciones RED con control 82/82 y `REVIEW_MODE=fixed` 15 casos esperados. Se corroboró la transición funcional del helper de R1 a R2; la existencia de los tests en el diff y las pruebas verdes en CI. No se adjudica una reproducción local de cada comando del autor porque no hubo clon ni dependencias instaladas en este entorno.

**CI real:** workflow run `41950852316` sobre `ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7`: `typecheck`, `lint`, `build`, `unit`, `db-tests`, `audit`, `bundle-budget` SUCCESS.
- `unit`: Vitest 192 archivos / 3532 tests PASS, `verify-workflows` 82/82 PASS, ADR 6/6 PASS.
- `db-tests`: `Files=42, Tests=3396, Result: PASS` al principio y al final, mutaciones intencionalmente RED con recuperación GREEN, `git diff --exit-code -- src/types/database.types.ts` sin cambios.
- `bundle-budget` es advisory y registra muchas rutas >180 kB (por ejemplo `/merchant/dashboard` 293 kB) aunque el job es SUCCESS. No se modificó `src/**`, por lo que no se atribuye a T-422; se mantiene como deuda de bundle existente.

## Observaciones sin nuevo bloqueante

- La sección **Diseño/E2E** de `docs/tasks/T-422.md` conserva una descripción antigua: «un único step con secretos que hace `pnpm build`», contradiciendo la D02=B y el workflow real. La sección de decisiones y el runbook ya describen lo correcto. Es una inconsistencia editorial de ficha, no una regresión funcional; conviene corregirla en una pasada documental sin reabrir el gate.
- `verify-workflows.test.mjs` cambió también el test del lock de `e2e-mutation` por D03=B, autorizado explícitamente en la decisión y limitado a esa aserción.
- No hubo revisión operativa de `workflow_run` con secretos reales porque el workflow se lee de `develop` y todavía no fue mergeado; no afirmar DoD postmerge completo. No se accedió a secretos, Supabase ni Vercel, ni se dispararon workflows.

## Pendiente manual OBLIGATORIO después del merge por P1

1. Mantener los Previews de `feat/*` habilitados **hasta** que exista una PR interna con CI exitoso y un primer `e2e-preview` GREEN iniciado por el **nuevo** `workflow_run` en `develop`. Revisar SHA probado y que pasen `chromium` + `global-settings` y health 200 del build efímero.
2. **Solo después de verificar ese GREEN**, cambiar el `Ignored Build Step` del proyecto Vercel `cadeapp-develop` a la condición que construye solo `develop` (ej.: `[ "$VERCEL_GIT_COMMIT_REF" = develop ] && exit 1 || exit 0`). Anotar resultados en `docs/tasks/log/T-422.md`.
3. La PR permanece abierta y sin aprobar/mergear desde esta revisión. La transición de producción y panel no puede declararse completa anticipadamente.

**Conclusión:** H01–H03 quedan `arreglado-verificado` en `ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7`. Sin nuevo hallazgo bloqueante; la responsabilidad de merge y de la verificación del gate desplegado continúa en P1.
