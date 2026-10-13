# Evidencia — PR #323 R1

SHA analizado: 6dd4bc251de1ecf6fffe040069d6f73086a7e419, base: 875f8621fa727c115326cc2f83036e44859ad52e.

- GET pull #323 / changed files: src/features/requests/actions.ts, actions.test.ts, docs/tasks/log/T-352.md.
- Cambio original: redirectTo /merchant/requests; cambio presente: redirectTo /merchant/dashboard.
- El formulario existente sigue router.push(result.data.redirectTo); el alias no se modificó.
- CI remoto: https://github.com/cadeApp/cadeApp/actions/runs/38345371360 — unit 129 suites/2116 tests PASS, 79 workflows PASS, 6 ADR PASS. Typecheck, lint, build, audit, bundle PASS. db-tests estaba pending al leer.
- E2E confiable: https://github.com/cadeApp/cadeApp/actions/runs/38345452343 — pendiente al leer. Run 38345453091 E2E skipped NO es verificación.
- Baseline: https://github.com/cadeApp/cadeApp/actions/runs/38340200745, no prueba GREEN de esta PR.

## Reproducción propuesta al autor (no corrida por esta revisión)

    git fetch origin
    git switch claude/great-brahmagupta-oj1el0
    git pull --ff-only origin claude/great-brahmagupta-oj1el0
    pnpm vitest run src/features/requests/actions.test.ts
    pnpm typecheck && pnpm lint && pnpm test

Para la mutación en memoria o worktree efímero, volver temporalmente solo el literal redirectTo al alias; el par de expectativas de éxito debe fallar de forma real; restaurar y repetir GREEN, sin alterar tests. Se necesitan además evidencias E2E y métricas de tiempo/cantidad contra Vercel Preview + Develop reales, sin cookies, headers, query, body, PII ni secretos. Ningún comando local, Docker ni consulta remota se ejecutó en esta ronda.

## Ronda 2 (comparación con nuevo HEAD 087d5c66)

GitHub compare ac7786c…087d5c6: solo docs/tasks/log/T-352.md modificada (+12/-6). El autor reemplazó «Medición después» por «todavía no hay», separó código observable de predicción sin medir y dejó explícita falta de E2E y cifras. Es corrección documental validada por lectura de archivo, no ejecución de Playwright. El job real e2e-preview de run 38345452343 seguía in_progress al comparar; no declarar green.

## Ronda 3 — Experimento autorizado (2026-10-13)

HEAD fuente PR #323: `ab66689fb736a7d482d788e977c98e8f2d750785`.
HEAD fuente PR #320: `2e0872e8b11410f5f0a880fec30346e17025e240`.
Base Develop: `875f8621fa727c115326cc2f83036e44859ad52e`.
PR temporal: https://github.com/cadeApp/cadeApp/pull/324
Rama: `review/T-340-T-352-checkpoint-320-323`
HEAD temporal: `13658242a4074ec491d417a3c90f152189f6e463`.

**Procedimiento ejecutado con API de GitHub (sin worktree local):**
1. Consultar los HEAD remotos y las listas de archivos modificados de ambas PR (13 y 9).
2. Consultar árboles Git `/git/trees/<sha>?recursive=1` de Develop, base de PR #320 y ambas PR. Todos completos (`truncated:false`). La intersección de los paths modificados fue vacía. Los 13 archivos de PR #320 coinciden en Develop con su base original para los paths afectados (salvo los 5 nuevos).
3. Construir `create_tree` basado en el árbol de Develop y superponer los 13 SHA de blobs de PR #320, sin alterarlos. Commit merge `cbadc4e5df6ad7daa89fd5a5433b9d4ba27de271`, padres Develop y PR #320.
4. Superponer los 9 SHA exactos de PR #323 en un segundo árbol y crear commit merge `13658242a4074ec491d417a3c90f152189f6e463`, padres merge intermedio y PR #323.
5. Verificar en el árbol final que cada uno de los 22 blobs coincide exactamente con su fuente. Crear rama y PR **Draft** #324, título y body **REVIEW ONLY / NEVER MERGE**. Releer PR y comparar con Develop: 22 paths, sin otros cambios.

Las PR originales permanecieron en Draft y no se mergearon. Ningún workflow se disparó manualmente, no se modificaron timeout, specs, fixtures, guardias ni auth para esta integración. El Preview de PR #324 puede disparar E2E automáticamente; resultado pendiente al redactar este informe.

**Datos E2E históricos que sí se verificaron en GitHub:**
- [run 38345452343](https://github.com/cadeApp/cadeApp/actions/runs/38345452343) PR #323 → job e2e-preview cancelled;
- [run 38346169980](https://github.com/cadeApp/cadeApp/actions/runs/38346169980) PR #323 → cancelled dentro de Chromium;
- [run 38343556554](https://github.com/cadeApp/cadeApp/actions/runs/38343556554) baseline sin T-352 → cancelled con grupos de errores equivalentes.
- No hay éxito en `global-settings` en esos tres runs.
- Los tiempos históricos 33.2/31.9 s vs 17.0/19.8 s y 21.1/20.5 s son duración **total del caso**, no medición directa del `waitForURL`.
- [CI PR323 HEAD ab66689](https://github.com/cadeApp/cadeApp/actions/runs/38350025278) fue verificada: 129 suites/2116 Vitest, 21 suites/1995 DB-tests, typecheck, lint, build, audit y bundle-budget PASS.

**Revalidación obligatoria de PR #324:** usar el `resolve-preview` del runner para confirmar SHA `13658242`; registrar `chromium` + `global-settings` en verde sin skips, retries ni cambios de timeout. En caso de error/cancelación, no inventar GREEN. Para medición posterior, no inferir clic→URL a partir de duración total ni forzar falla Playwright para obtener trace. Si requiere instrumentación, pedir autorización de alcance específica.

No se corrieron tests locales/Docker ni se consultó Supabase remoto en esta revisión. Integración validada por SHA de blobs GitHub, no por tests de aplicación.


## Ronda 4 — E2E combinado RED, con evidencia del reporter

- PR temporal: https://github.com/cadeApp/cadeApp/pull/324 ; HEAD `13658242a4074ec491d417a3c90f152189f6e463`.
- Run: https://github.com/cadeApp/cadeApp/actions/runs/38354080733 ; job `115152873446`. Verificado `e2e-preview=failure`, Chromium **63 PASS / 8 FAIL / 1 flaky**, **global-settings no corrió**. Artifact Playwright `11792439365` descargado para la revisión. CI unitaria/build/db y checks técnicos PASS.
- 8 failures (x3 attempts) terminan `expect(request-card).toBeVisible()` con elemento no encontrado: courier-feed-privacy:27, courier-feed-vocabulary:19, fixed-price:72/177/277, main-flow:300, map-privacy:438, multi-drop:37. `courier-private-columns:32` falla un poll Realtime y pasa retry, por eso flaky.
- Snapshot de error del artifact `data/88c9467820d3bdcf6d36b261b9a574f245c25ded.md`: error boundary «No pudimos actualizar las solicitudes abiertas». La causa exacta **no** se concluye solo con el snapshot. `src/features/offers/queries.ts::getAvailableRequests` arroja excepción si una `published` de la página de 50 carece de drop o cuenta incorrecta.
- PASS primera corrida: legacy checkpoint `e2e/specs/t340-legacy-checkpoint.spec.ts:29` (incluye waitForURL 10s), y publicación UI `main-flow.spec.ts:187/:249`.
- Tres traces `1-trace.network` de retries fixed-price confirmados con zip sin leer cuerpos, cookies, headers ni query: POST /merchant/requests/new 1740/1823/1943ms; GET alias /merchant/requests **0** después del POST; GET /merchant/dashboard 717/919/486ms. Coinciden con bitácora del autor SHA ce2bf85, sin atribuir diferencial completo a T-352.

**Reproducción segura de las métricas del artifact local** (guardar zip descargado en /tmp/pr324-playwright-report.zip):

```bash
python - <<'PY'
import json, zipfile, urllib.parse
with zipfile.ZipFile('/tmp/pr324-playwright-report.zip') as outer:
    for name in outer.namelist():
        if not name.endswith('.zip'): continue
        with zipfile.ZipFile(outer.open(name)) as trace:
            for file in (x for x in trace.namelist() if x.endswith('.network')):
                rows=[json.loads(line)['snapshot'] for line in trace.read(file).decode().splitlines() if line]
                result=[(x['request']['method'], urllib.parse.urlsplit(x['request']['url']).path, x['response']['status'], round(x['time'])) for x in rows if urllib.parse.urlsplit(x['request']['url']).path in {'/merchant/requests/new','/merchant/requests','/merchant/dashboard'}]
                if any(method=='POST' for method,path,status,ms in result):print(file, result)
PY
```

**Pendiente:** verificación read-only de causa concreta de falla del feed, y gate completo Chromium + global-settings. No se ejecutó SQL remoto, Supabase, Docker ni mutación de código. No se usó una prueba skip/cancelled como verde.
