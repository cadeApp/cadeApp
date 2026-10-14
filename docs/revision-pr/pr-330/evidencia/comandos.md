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
