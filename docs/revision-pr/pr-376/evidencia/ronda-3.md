# Evidencia independiente PR #376 — Ronda 3

**SHA:** `610204b206b952f85d04e93fb8b0adb47220749b`. Lectura exclusiva de GitHub connector (fetch_file/compare, logs CI, logs trusted E2E, commit statuses). No DB/Docker/Supabase local o remoto ni Playwright ejecutado por revisor.

## CI principal
- [Run 38936922299](https://github.com/cadeApp/cadeApp/actions/runs/38936922299) SUCCESS sobre HEAD; unit job 117098240721 135 suites / 2405 tests; db-tests job 117098176526 Files=26, Tests=2341, Result PASS; types locales generados.
- DB runner CC025-B0: rutas iguales y distintas serializadas, consent revocado, mutación original sin FOR UPDATE provoca 8 documentos (RED), con FOR UPDATE restaurado 4 (GREEN). Es evidencia ejecutada por el CI del autor, no prueba propia de revisor.

## E2E SHA exacto
- GitHub commit status API `610204b206b952f85d04e93fb8b0adb47220749b`: `e2e-preview=failure`, apunta a [38937045004](https://github.com/cadeApp/cadeApp/actions/runs/38937045004).
- Workflow repository_dispatch corre en develop SHA default 224a36b7, pero job e2e-preview 117095140090 hizo checkout `HEAD is now at 610204b`. 78 tests Chromium, 77 PASS/1 FAIL, retry1/retry2 fallidos.
- Error test spec courier-onboarding.ts:330, línea 446 `TimeoutError page.waitForURL('/courier/onboarding/status')`. Screenshots y error-context adjuntados, no leídos; por tanto no se atribuye mensaje de error específico a UI.
- Spec líneas 368-377 precarga `e2e/fixtures/*.jpg`; action líneas 220-229 y B0 SQL líneas 81-98 exigen `courier/<uuid>/...`. Causa probable de rechazo, no demostrada por trace. Run previo 38923012210 mismo error con código app idéntico (GitHub compare solo bitácora).

## Hallazgo de carrera administrativa (solo análisis)
- B0 SQL 47–60 consulta status bajo FOR UPDATE, lock termina al COMMIT RPC; Server Action 286–299 hace UPDATE como admin con `eq(profile_id)` únicamente. Una revocación de status entre operaciones podría registrar metadata y éxito; no se ejecutó test race ni se afirma exploit confirmado.
- Compare rama contra develop ahead 11 behind 1; no nuevos SQL/RPC fuera del delta B. H01-H03 históricos corregidos por inspección+CI, sin mutación independiente. Ninguna aprobación/merge.