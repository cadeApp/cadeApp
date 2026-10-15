# Evidencia reproducible — PR #361 / ronda 1

## Alcance de esta revisión
**Solo inspección estática remota:** no hubo clon de trabajo utilizable ni ejecución de comandos. No hay demostración RED→GREEN independiente, ni se afirma lo contrario. Las líneas siguientes son instrucciones para la **próxima revisión**, no resultados ya obtenidos.

**SHA inspeccionado:** `5d1be4bc129e96a4ba16e493ef355206ee74c44e`
**Base:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`

## Inspección estática comprobada por lectura
- El diff del PR solo modifica `docs/tasks/log/T-364.md` y `src/features/requests/components/merchant-requests-list.test.tsx`.
- `src/features/trips/actions.ts` ya contiene `merchantCancelTripAction` que valida rol y delega la RPC `cancel_request`.
- `src/domain/errors.ts`: `err(code)` produce `{ ok:false, code }`.
- `src/features/trips/components/trip-cancel-dialog.tsx`: dos pasos y motivos.
- SQL de `request_transition` en migración `20260924010124_rpc_requests_v1.sql` y sustituciones posteriores: merchant cancela `published/matched`; para `published` expirada retorna `REQUEST_EXPIRED`.
- `src/features/requests/queries.ts` filtra por estado persistido, no convierte `published` caducada antes de pintar el listado.
- `mockRefresh` carece de `clearAllMocks`, y es consultado en dos tests distintos por `toHaveBeenCalled()`.

## Comandos a ejecutar en una siguiente sesión con clon y dependencias

```bash
git fetch origin
git checkout feat/T-364-cancelar-desde-mis-solicitudes
git status --short
git rev-parse HEAD
git diff --stat origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/features/requests/components/merchant-requests-list.test.tsx > /tmp/pr361-unit.log 2>&1
grep -E 'Test Files|Tests|FAIL|PASS' /tmp/pr361-unit.log | tail -25
```

**No lanzar Docker ni Supabase local.** Para E2E usar los mecanismos de Preview+Develop ya previstos. No usar `--force`, rebase, secretos ni producción.

## Batería de mutaciones independientes a preparar cuando haya un baseline GREEN

1. **H02:** quitar `router.refresh()` del camino `INVALID_STATE_TRANSITION` sin tocar el camino de éxito; exigir que el test específico falle. Comprobar GREEN antes y después de restaurar.
2. **H03:** cambiar el mapeo de `INVALID_STATE_TRANSITION` por un mensaje genérico; exigir RED del oráculo que usa una respuesta `{ok:false,code:'INVALID_STATE_TRANSITION'}` real.
3. **H04:** alterar el predicado de visibilidad para admitir `published` con `expiresAt <= now`; exigir RED con reloj fijo.
4. **H01:** evitar la llamada real a `merchantCancelTripAction` en confirmación y demostrar RED en control de ejecución; las mutaciones sobre permisos deben seguir `e2e-mutation`, nunca desplegar una versión insegura.

**Limitación conocida:** todavía no es posible ofrecer un harness mutacional reproducido para esos caminos porque en el SHA de esta ronda los caminos no existen. Fabricar un falso GREEN/RED violaría las reglas de revisión. En la siguiente ronda, incorporar el script completo ejecutado y su resumen, no solo esta lista.


---

# Ronda 2 — `f397c21b39f04de03d32615aedbdbaa8a9cbe559` (2026-10-15)

## Evidencia remota revisada
- GitHub PR #361, HEAD `f397c21b39f04de03d32615aedbdbaa8a9cbe559`, rama `feat/T-364-cancelar-desde-mis-solicitudes`, base `14c28ed3c41cb2bde92705fc018c7dd0df73245b`.
- Log CI run 38677584928: 7 jobs lint/build/typecheck/unit/db-tests/audit/bundle-budget success.
- `unit`: `Test Files 129 passed (129)`; `Tests 2174 passed (2174)`.
- `db-tests`: `Files=22, Tests=2205`; `Result: PASS`.
- Vercel Preview: success, pero **sin corrida demostrada del nuevo E2E UI T-364**.
- Comandos locales/no red: `git ls-remote https://github.com/cadeApp/cadeApp.git` falló por DNS (`Could not resolve host: github.com`). Por tanto no se corrió `pnpm`, ni mutaciones independientes, ni `git merge-tree`.
- Se inspeccionaron cuerpos completos de `merchant-requests-list.tsx`, `merchant-request-cancel-dialog.tsx`, `actions.ts`, pruebas y patch E2E. Hallazgos H05-H10 marcados `analisis` únicamente.

## Reproducción propuesta en clon limpio (no ejecutada)
```bash
git fetch origin
git checkout feat/T-364-cancelar-desde-mis-solicitudes
git rev-parse HEAD # comparar con f397c21b39f04de03d32615aedbdbaa8a9cbe559 ANTES del commit de revisión
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/features/requests/components/merchant-requests-list.test.tsx src/features/requests/actions.test.ts > /tmp/pr361-r2-vitest.log 2>&1
grep -E 'Test Files|Tests|FAIL|PASS' /tmp/pr361-r2-vitest.log | tail -20
```

## Plan de batería independiente para siguiente ronda — NO ejecutado
- H05: usar Playwright para cancelar desde la tarjeta. Si se elimina la llamada de UI, test E2E debe ser RED sin tocar `rpc`; controles sensibles solo por `e2e-mutation`.
- H06: reabrir una segunda tarjeta tras éxito y tras error. Mutar la lógica de reset y esperar RED específico por paso 2 visible o motivo guardado.
- H07: resolver la promesa diferida después de dos eventos de confirmación; quitar localmente la guarda y verificar RED en conteo de RPC.
- H08: stub que rechaza promesa. Quitar catch y verificar RED de mensaje de red ausente.
- H09: cambiar resultado de la action real; eliminar la invocación efectiva y verificar RED. Cambiar mapeo de error e imponer aserción literal.
- H10: inspección de clase exacta `min-h-12` en controles reales.

**IMPORTANTE:** no hay harness de mutación aquí porque no puede ejecutarse en este contenedor. Estos son escenarios futuros, no falsos resultados. El agente no debe escribir la carpeta de revisión ni firmar verificación independiente. Prohibido ejecutar Supabase o Docker local y usar secretos remotos.

---

# Ronda 3 — `25a787adfe2aaeeed7b9013231582a5c3dddce14` — 2026-10-15

## Orígenes
- Diff entre ronda 2 y este HEAD: dos commits `12f6e01f...` y `25a787adfe2aaeeed7b9013231582a5c3dddce14`; se tocaron solo `docs/tasks/log/T-364.md`, `e2e/specs/request-states.spec.ts`, `merchant-request-cancel-dialog.tsx`, `merchant-requests-list.tsx`, `merchant-requests-list.test.tsx`. **No hubo edición autoral en carpeta de revisión.**
- GitHub informa `mergeable=true` pero clon local y `merge-tree` no disponibles; comando `git ls-remote https://github.com/cadeApp/cadeApp.git refs/heads/feat/T-364-cancelar-desde-mis-solicitudes` devolvió `fatal: ... Could not resolve host: github.com`.
- GitHub Actions CI run 38681382821 para `25a787adfe2aaeeed7b9013231582a5c3dddce14`: lint, typecheck, build, audit, bundle-budget, unit y db-tests **success**.
- Logs CI: `Tests 2180 passed (2180)` en unit y `Files=22, Tests=2205, Result: PASS` en pgTAP.
- No aparece ejecución identificada del `T-364` Playwright UI en el comentario/bitácora del autor ni en la ejecución de CI revisada. No afirmar que falló; informar que **no está comprobada**.
- Usuario: no se extrajeron claves/secretos ni se conectó a DB/Vercel de forma operativa.

## Demostración ejecutada con Node de la falsedad de un oráculo léxico (H11)

```bash
node -e 'for (const s of ["Canceladas","Cancelada","Cancelado"]) console.log(s, /cancelad[ao]/i.test(s))'
```

**Salida observada:**
```text
Canceladas true
Cancelada true
Cancelado true
```

Esta reproducción **no es una mutación ni un E2E**, solo prueba que el matcher coincide con el tab que siempre existe en la pantalla.

## Comandos de revalidación (propuestos, no ejecutados por este revisor)

```bash
git fetch origin
git switch feat/T-364-cancelar-desde-mis-solicitudes
git rev-parse HEAD
git status --short
git merge-tree --write-tree origin/develop HEAD
pnpm typecheck > /tmp/pr361-r3-typecheck.log 2>&1
pnpm lint > /tmp/pr361-r3-lint.log 2>&1
pnpm exec vitest run src/features/requests/components/merchant-requests-list.test.tsx > /tmp/pr361-r3-unit.log 2>&1
grep -E 'Test Files|Tests|FAIL|PASS' /tmp/pr361-r3-unit.log | tail -20
# Requiere Preview del HEAD y Supabase Develop:
pnpm exec playwright test e2e/specs/request-states.spec.ts --project=chromium -g 'T-364'
```

## Batería independiente propuesta (NO ejecutada)
- **H11 / oráculo historial:** mantener tab `Canceladas` mientras se quita temporalmente **solo** la fila cancelada del listado (mutación no desplegada) y exigir RED de `href` ligado a `requestId`, no match del tab. Para el contador, mutar el incremento/cómputo de `activeCount` en un control seguro y exigir RED exacto de diferencia.
- **H12 / fail-closed:** quitar temporalmente navegación/clic del E2E dentro de una copia de la spec y exigir RED de estado final; no dejar alternativa `rpc` en flujo positivo. No tocar endpoint ni mutar políticas de autorización; mutaciones de seguridad vía `e2e-mutation`.
- **H13 / contrato:** pasar como retorno diferido `{ok:false,error:'INVALID_STATE_TRANSITION'}` y exigir error de tipos TS; devolver el tipo real, baseline GREEN y sin `as any`.
- **H06–H10:** reproducir independiente con mutantes nuevos por familia, sin adoptar como hechos propios las salidas declaradas en la bitácora del autor.

**Restricción de verificación:** no se pudo levantar un clon limpio en el contenedor (DNS de github.com), así que no hay harness local de mutaciones copiado/corrido en esta ronda. Nunca presentar lo anterior como una ejecución real. La carencia de esa comprobación obliga a mantener `verificado_en_sha=null`.

---

# Ronda 4 — `2ce18ac6e98ecbc4ae08b6ccbf43f70127ae75c3` — 2026-10-15

## Consultas reales
- PR #361 HEAD `2ce18ac6e98ecbc4ae08b6ccbf43f70127ae75c3`, base `14c28ed3c41cb2bde92705fc018c7dd0df73245b`, `mergeable=true`, sin merge.
- Compare `56032fbc7bdd2ae1c129a54bb87b7b9f27637fde...2ce18ac6e98ecbc4ae08b6ccbf43f70127ae75c3`: 2 commits, cambios solo en E2E, test unitario, bitácora. Revisión no tocada por agy.
- Inspect `e2e/specs/request-states.spec.ts:879–920`: `requestLink` por ID, `activeCountLocator`, `historyLink` por ID, sin branch fallback a RPC.
- Inspect `merchant-requests-list.test.tsx:657–664`: Promise con `Awaited<ReturnType<...>>`, sin `as any`.
- Log CI `unit`: `Test Files 129 passed (129)`, `Tests 2180 passed (2180)`.
- GitHub Actions run 38683222503: typecheck, lint, build, audit, unit, bundle-budget success; db-tests in_progress al observar.
- Combined commit status: solo `Vercel – cadeapp-staging: success`, **no `e2e-preview`**.
- `.github/workflows/e2e-preview.yml` en develop: `repository_dispatch`, job `e2e-preview` en Environment `develop`, `pnpm exec playwright test --project=chromium --workers=1`, publica status e2e-preview al SHA probado. Ese workflow **no** aparece entre los jobs de CI PR.
- Bitácora autor: ejecución local `pnpm.cmd exec playwright test ... -g 'T-364'` devolvió error fail-closed `Proyecto Supabase 'desconocido'`. No hay ejecución GREEN real sobre Preview/Develop demostrada.

## Límites
Solo análisis remoto estático y resultados CI existentes. NO corrida Playwright propia; NO acceso a Supabase Develop; NO mutaciones propias; NO completé E2E. `verificado_en_sha` queda `null` en todos.

## Instrucciones de comprobación futura (NO EJECUTADAS)

```bash
git rev-parse HEAD
git status --short
# Requerir URL Vercel Preview del SHA exacto (NO producción)
# Gate automatizado existente: .github/workflows/e2e-preview.yml
# Verificar en GitHub el commit status e2e-preview=success con URL de run.
# Verificar que Playwright en el run descubrió T-364 y que su caso pasó.
# Evidencia: contar activas antes/después, fila requestId historial, SQL status/motivo/oferta y actor ajeno.
```

El aviso del autor "entorno local bloqueado" **no** significa que el E2E de Preview falló: significa que **su resultado sigue pendiente/no demostrado**. No simular credenciales ni alterar el guard de staging.

---

# Ronda 5 — CI / Trusted E2E confirmado en `0beec112e1d1b114b4e8480ff846c247dfb7421c`

## Metodología: solo observación de run real y código
Se consultaron GitHub PR #361, commit statuses, changed files, CI jobs/logs y repositorio trusted `.github/workflows/e2e-preview-target.mjs`. No se dispone de clon/Playwright propios en esta sesión; **no se ejecutaron mutaciones propias**. No se alteraron secretos, runners, workflows, Supabase ni deployment.

### Datos verificables (sin contraseñas)
- HEAD del autor: `0beec112e1d1b114b4e8480ff846c247dfb7421c`. Comparación con el reviewer commit de R4: solo `docs/tasks/log/T-364.md` modificado, un commit `0beec112`.
- CI general run 38684858567 `success`, unit 129 files / 2180 tests PASS, db-tests 22 files / 2205 pgTAP PASS, typecheck/lint/build/audit/bundle-budget success.
- Trusted E2E run 38684930479, jobs 116257499357 resolve (success), 116257546537 Playwright (success), 116263773415 reporter (success).
- El resolver escribió `PR interna #361 contra develop.` y `Preview listo para E2E.`.
- El reporter publicó `TARGET_SHA: 0beec112e1d1b114b4e8480ff846c247dfb7421c`, `RESULT: success` y `DEPLOYMENT_ID: dpl_6VTyStofwVUxbH1v1WwX7aejX3Am`.
- Preview validado `https://cadeapp-develop-57xcy4uv5-lautaroj073.vercel.app`; el Environment `develop` confirmó refs de Supabase develop ≠ staging, sin exponer secretos.
- Test T-364 Chromium lineado: `✓ 65 [chromium] › e2e/specs/request-states.spec.ts:827:7 › T-364 (§5.1): Cancelación rápida por comercio dueño en published: UI Playwright, oráculo SQL y rechazo ajeno (25.7s)`.
- Browser: `74 passed (20.0m)`; `1 flaky` de `e2e/specs/map-privacy.spec.ts:438` T-314, falla HTTP 200 en intento #1 y `✓` en retry #1. global-settings: `3 passed (1.1m)`.
- Commit status antes de escribir ronda: `e2e-preview=success`, target URL `https://github.com/cadeApp/cadeApp/actions/runs/38684930479`.
- Evento viejo run 38684575890: `El deployment no pertenece al proyecto Vercel de develop`, 2 jobs E2E/report skipped; es un **skip legítimo** de proyecto ajeno. La rama trusted `matchPreview` menciona explícitamente staging como ejemplo de skip.

## Estado de verificación
- H01/H05/H11/H12: chequeo real confiable bajo commit SHA y revisión independiente de logs, **sin mutación propia**; `verificado_en_sha=0beec112e1d1b114b4e8480ff846c247dfb7421c`.
- Otros hallazgos: correcciones leídas, unit CI exitosos; no mutación independiente; `verificado_en_sha=null`.
- No dar por GREEN el nuevo commit del revisor hasta que se observe CI/E2E sobre ese nuevo HEAD.

## Reproducción futura recomendada (NO EJECUTADA)
```bash
git rev-parse HEAD
git status --short
# Si la PR sigue abierta, GitHub: comprobar estado Vercel, CI y e2e-preview por SHA HEAD.
# Run 38684930479 debe figurar vinculado a 0beec112..., no a un commit de docs posterior.
# node docs/revision-pr/analizar.mjs verificacion
```
