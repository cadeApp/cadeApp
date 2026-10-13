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
