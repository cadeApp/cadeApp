# PR #330 Ronda 1 — evidencia

Inspección con GitHub MCP: get_pr_info, fetch_pr_patch, compare_commits, fetch_file.
HEAD funcional verificado por lectura: 2a9e5e4c0e8545b67f29371a09117f565e5adee8
Archivos inspectados: src/features/requests/{actions.ts,actions.test.ts,schemas.ts,queries.ts,components/create-request-form.tsx}, e2e/specs/multi-drop.spec.ts.
Contrato desde develop: docs/tasks/T-340.md, docs/contracts/CC-022.md, AGENTS.md, .agents/skills/{revisar-pr,contract-change}/SKILL.md.
SQL: supabase/migrations/20261009200000_t340_multi_drop.sql líneas 1048 y 1194: mark_drop_* exige in_transit; 20261013140000_t340_clean_legacy.sql líneas 503–505 marca pickup matched→in_transit.
RLS: supabase/migrations/20260922051650_rls_v1.sql líneas 284–316 da INSERT/UPDATE merchant pero no DELETE parent.
Acción: acciones insert requests (67), contacts (91), drops (111), privados (153), publish (163); los errores retornan sin rollback. E2E nuevo crea oferta admin líneas 605–615.

NO EJECUTADO: pnpm typecheck, pnpm lint, pnpm test, pnpm test:db, E2E nuevo, mutantes propios, SQL remoto o local. No se declararon PASS/FAIL producidos en esta sesión.

Pruebas RED propuestas (a ejecutar por agy, no ejecutadas aquí):
H01 reproducir INVALID_STATE_TRANSITION en SQL al marcar drop con solicitud matched, y GREEN tras pickup.
H02 negar RPC submit_offer para actor no courier, acreditar oferta genuina por courier.
H03 error forzado en inserción de contacto/drop y publish; confirmar 0 rows padre/hijas; contraprueba con mutante que capture excepción/deje insert parcial.
H04 mutar esperaba 3 a 2 en total y permitir nota privada en respuesta pública; fallar en la aserción correcta.
H05 rg de aserciones non-null y sustituir por guards tipados.
GPS: retener callback geolocation, borrar tarjeta anterior, resolver callback y detectar posible escritura cruzada.

Verificación de la documentación: docs/revision-pr/analizar.mjs verificacion se debe ejecutar en runner de autor/revisor con clon; no ejecutada aquí.

## Ronda 2 — 2026-10-14 · HEAD b29d8e8f6638a5d56d9652e33c045ff04c49adac

- GitHub get_pr_info(330): HEAD b29d8e8f6638a5d56d9652e33c045ff04c49adac, base develop 3a4537624, abierta Draft.
- compare_commits(d0c492c3, b29d8e8f6638a5d56d9652e33c045ff04c49adac): 2 commits, 4 archivos (E2E map-privacy, E2E multi-drop, unit formulario, bitácora).
- Inspección del diff: map-privacy.spec.ts cambia el locator por getByTestId('drop-card-0') y mantiene error fuera de Aguilares; multi-drop.spec.ts reemplaza cálculo local de collectibleAmountArs por getByText en TripCourierView autenticada ($3000 y $0); create-request-form.test.tsx reemplaza los 4 ! por pickupZone.id con guard.
- GitHub unit job 115840251827 (run 38560544025): Test Files 129 passed, Tests 2143 passed.
- GitHub db-tests job 115840252038: falla Docker Rate exceeded y port 54322 address already in use; no hubo resultado pgTAP de ese job.
- GitHub E2E run 38560715122 estaba in_progress; no declaramos GREEN. Previous E2E run 38519053397, checkout 046e103, 73 PASS / 1 FAIL map-privacy:657; writer multi-drop pasó, pero no se transfiere automáticamente el PASS al HEAD actual.
- No ejecutado en esta sesión: pnpm local, Docker, pgTAP, mutantes RED/GREEN independientes, Preview Playwright nuevo.

Verificaciones futuras exigidas: E2E chromium del SHA actual con map-privacy y multi-drop, global-settings; nuevo db-tests con arranque Docker real, Result: PASS y Files/Tests; E2E + SQL de la RPC futura Gate 2/3.
## Ronda 3 · 2026-10-14 · HEAD 014029270f431280fa831ea910d052da9b12fd1d

- `get_pr_info(330)` y `compare_commits(1294ed42,01402927)`: 1 commit nuevo de autor, SOLO docs/tasks/log/T-340.md; implementación sin cambio.
- `get_commit_combined_status(01402927)`: e2e-preview SUCCESS; Vercel SUCCESS.
- **Independiente E2E**: `fetch_workflow_job_logs(115856918592)`, checkout 01402927, líneas `74 passed (19.5m)` y `3 passed (1.4m)`; tests map-privacy #36 y multi-drop writer #44/todas failed #45 PASS.
- **Independiente unit**: `fetch_workflow_job_logs(115856413631)` en merge ref del HEAD, `Test Files 129 passed`, `Tests 2143 passed`.
- **Independiente db-tests**: `fetch_workflow_job_logs(115856413342)`, `Files=21, Tests=2039, Result: PASS`; `fetch_workflow_job_logs(115846119404)` para autor cita run 38562296772, también `Files=21, Tests=2039 Result PASS` (no 1980).
- **H07 lectura exacta**: `src/features/requests/components/create-request-form.tsx:643-644` crea requestIdRef; `:710-734` toma `data` reciente + mismo requestIdRef en cada submit fallido; el guard/snapshot contra payload modificado no existe; `docs/contracts/CC-024.md:78-91` lo exige. Prueba de mutación H07 propuesta, NO EJECUTADA en esta revisión (no hay checkout local).
- **H03 lectura exacta**: `src/features/requests/actions.ts:54–179` inserciones HTTP de tablas separadas y luego `publish_request`; no se revisó implementación RPC que aún no está en #330.
- Las pruebas RED/GREEN de `src/features/requests/components/create-request-form.test.tsx` ante fallo de red seguido de edición NO existen todavía. Proponer nuevo test que se ponga en rojo con código actual y quede verde tras aviso/guard.
- Sin SQL/Docker local, sin secretos, sin tests falsos, sin mutantes commiteados.

## Ronda 4 — 2026-10-14 — Asako H07/H08 y CC-024 merge
- PR #330 HEAD `141173d8965f63575cbe51dade4326550fcd7b9d`, diff desde 4ee363b8: `src/features/requests/components/create-request-form.tsx`, su test y `copy.ts` más bitácora; author asako669. No cambios a acciones.ts/SQL ni carp. de revisión.
- H07 lectura: Form :644–655 snapshot; :721–805 comparación canónica, bloqueo, acciones reintento original y nueva solicitud confirmada; tests :686–864 oráculos de 1 RPC accionada, mismo/diferente UUID y dirección. Unit CI run 38574983243 job 115889598848 129 archivos y 2145 tests PASS; form 23 tests PASS. Mutaciones declaradas por autor, no reproducidas por revisor.
- H08: entrada log :1617–1621 coincide con run 38562296772/job 115846119404 `Files=21 Tests=2039 Result PASS`.
- `get_pr_info(333)`, GitHub REST PR#333 merged 2026-10-14T17:46:05Z, merge SHA c97e0d8. Develop fetch HEAD c97e0d8; RPC contracts and wrapper present.
- migrate-develop run 38609451699 job 116008725669 SUCCESS; log `Applying migration 20261014110000_cc024_atomic_multi_drop.sql`, `Finished supabase db push`. No SQL remoto manual ejecutado por revisor.
- e2e-preview workflows 38609638111 / 38609638126 HEAD develop c97e0d8: resolve-preview SUCCESS, e2e-preview SKIPPED. No validación nueva RPC 1/N ni legacy tras merge.
- `compare_commits` desde base 3a453762: único archivo cambiado en ambas ramas docs/tasks/log/T-340.md. GitHub PR330 `mergeable_state=dirty` (conflicto), no merge-tree local corrido.
- actions.ts original mantiene inserts HTTP + publish_request; Gate 4 H03 ABIERTO. CI branch anterior al backend (unit 2145/2145, db 2039 PASS). E2E run 38575138784 chromium 73 PASS, 1 flaky courier-onboarding (pasó en segundo retry), global settings 3 PASS, writer #46 PASS con escritor no transaccional.
- NO ejecutado por revisor: SQL propio, Docker, pnpm local, pruebas mutadas propias, git merge-tree ni E2E Gate 3 postmigración; no atribuirlos como PASS.

## Ronda 5 — 2026-10-14 — SHA fa0b8437ed440278a855a606305711ad6d6f48ec (código funcional a8321157a234bdadab6a1e3c1cce13093fb6ba6e)
- GitHub get_pr_info/pulls/330, compare_commits(d9a8f0f1,a8321157a234bdadab6a1e3c1cce13093fb6ba6e) => 3 commits de autor: merge develop, RPC action y actualización de bitácora docs-only; rango completo 3 archivos (actions.ts, actions.test.ts y log), último commit exclusivamente docs/tasks/log/T-340.md, no se alteró docs/revision-pr/pr-330.
- Inspección actions.ts :51–87 demuestra única llamada callRequestRpc, sin inserts/publish; CC-024 develop :78–85 exige UUID browser y NO generación en Server Action; `actions.ts:52` contiene `data.requestId ?? crypto.randomUUID()`. `schemas.ts:92` requestId optional. UNIT positive tests `validFormInput` sin ID y mock acepta response.
- Inspección actions.test.ts: mocks devuelven `{}` si from(table)!=='profiles'; mutante B relatado en bitácora T-340 15:15 resultó TypeError `insert is not a function`. No se ejecutó mutante independiente; H10 por evidencia de autor + inspección de stub.
- CI run 38613233449 unit job 116021658403: Test Files 129 passed y actions.test.ts 10 PASS; DB job 116021658369 Files=21 Tests=2177 Result PASS, cinco carreras CC024 y db:types --local PASS; typecheck/lint/build/audit/bundle-budget SUCCESS; approval-policy FAIL por falta informe sin bloqueantes.
- E2E Preview run 38613338996, job 116022112698, checkout exacto a8321157; chromium 74 PASS, writer multi-drop (#44) PASS, todas fallidas (#45) PASS, legacy 1 drop (#68) PASS; global-settings 3 PASS. App Preview contra Develop migrado. No atribuir este runtime a code paths sin ID.
- PR mergeable_state unstable, branch ahead develop sin commits behind; status Vercel/e2e-preview SUCCESS. No correr git merge-tree local por falta de clon.
- Mutación H09 propuesta NO EJECUTADA: en rama temporal reintroducir `?? crypto.randomUUID()` con test sin UUID que espera error, debería fallar en expectativa sin RPC. Mutación H10 propuesta NO EJECUTADA: direct `.from('delivery_requests').insert` con stub funcional mockInsert causa fallo de expectativa `mockInsert not called`, no TypeError. Ambas RED→GREEN requieren implementación y logs del autor; no atribuir falsos rojos.
- Prohibición de Supabase/Docker remoto; contenedor sin acceso a github.com (`git ls-remote` fallo DNS). No se ejecutaron pruebas GitHub workflow manualmente, SQL/Playwright/pnpm locales ni mutaciones independientes.

## Ronda 6 — SHA 99c0ac956b85d4736adb43fc36f5dd5a28763be1
- GitHub `get_pr_info(#330)`, `fetch_issue_comments(#330)`, `compare_commits(31137e0c..99c0ac95)`, `fetch_file` actions.ts/actions.test.ts/log y CI job logs. Únicamente 3 archivos tocados, sin cambios del autor en docs/revision-pr/**.
- `actions.ts:50–61`: guard UUID ausente -> VALIDATION_ERROR, no UUID servidor, llamada atómica única. `actions.test.ts`: UUID fijo positivo 1/N; test negativo sin ID, RPC 0; spy funcional INSERT 1/3 drops y aserciones de cero escrituras.
- Los RED del autor (no reejecutados por revisor) constan en bitácora: H09 mutante UUID => 1 fallo, 10 passed, restauración 11 passed; H10 mutante INSERT => 2 fallos por `mockFrom called 1 but got 2`, 9 passed, restauración 11 passed.
- CI auténtico HEAD: run 38620279932; unit job 116045704729 129/129 files, 2154/2154 tests PASS, actions.test 11 PASS; DB job 116045704327 Files=21 Tests=2177 Result PASS, 5 carreras CC024, `pnpm db:types --local` y diff PASS. Typecheck lint build audit bundle success.
- E2E auténtico job 116046227024, run 38620391687: dispatch `head_sha` develop no sirve como evidencia; checkout en JOB confirma HEAD 99c0ac956b85d4736adb43fc36f5dd5a28763be1; writer multi-drop 3, all-failed y legacy 1 PASS; total 73 pass + 1 flaky en T-314 map-privacy por HTTP 500 de /api/live/available-requests, retry pasó; global settings 3 PASS.
- approval-policy job 116045705510 failure `Falta el informe completo de revisar-pr sin bloqueantes`; script .github/workflows/approval-policy.mjs requiere sección body (para PR de Lautaro073) con 6 marcadores; actualizar exclusivamente body con reporte verdadero, NO tocar script.
- No ejecutado por revisor: `git merge-tree` local, pnpm/Docker/SQL, mutantes locales ni Playwright propio. Se inspeccionó REST mergeability unstable y CI workflow verde con flake correctamente registrado. No se inventó causa del HTTP 500.
