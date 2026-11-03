# Evidencia — PR #392, Ronda 1 (2026-10-17)

**Fuentes:** GitHub connector read-only, SHA auditado `61ebc07c1f2ffc23724bc0be0793dd2ac7c15fb6`. Sin repositorio clonado, Supabase/Docker, E2E ejecutado por revisor. `node docs/revision-pr/analizar.mjs verificacion` NO ejecutado, no inventar resultado.

1. `get_pr_info #392`: HEAD `61ebc07c1f2ffc23724bc0be0793dd2ac7c15fb6`, base staging `86c98cae...`, state open, mergeable true.
2. `fetch commits/61ebc07c1f2ffc23724bc0be0793dd2ac7c15fb6`: padres exactos `86c98cae78998ea18e9cc6f7af244d70584018b1` y `cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6`.
3. `compare staging...61ebc07c1f2ffc23724bc0be0793dd2ac7c15fb6`: 57 commits, 269 archivos; cuatro migraciones nuevas, ninguna C. `compare cf65ce25...61ebc07c1f2ffc23724bc0be0793dd2ac7c15fb6`: 21 commits heredados staging, diferencia de archivos 14, solo cuatro de UI y diez de docs. Se comparó sha de blob de los 14: idénticos al árbol staging. SHA blobs de migrate/deploy/e2e-staging también idénticos staging/release. SQL C fetch_file/API 404 en release.
4. Migración `supabase/migrations/20261015084902_cc026_reconcile_expired_requests.sql:178–195` contiene REVOKE UPDATE para `authenticated` sobre `delivery_requests` y `offers`, seguido de grants por columna. `supabase/tests/cc026_reconcile_expired_requests.sql:251–259` exige 42501 para campos prohibidos. En `staging`, `src/server/cron/sweep.ts` usa createAdminClient; requests/offers actions usan RPC. No se ejecutó rollback ni E2E antiguo en DB migrada.
5. Workflow CI [39003514873](https://github.com/cadeApp/cadeApp/actions/runs/39003514873) SUCCESS. Unit job 117311179215: `Test Files 135 passed`, `Tests 2492 passed`. DB job 117311179490: `Files=26 Tests=2341 Result=PASS`; pruebas CC025 A writer antiguo plain INSERT y UPSERT, guard 23514, mutaciones 42703/42501 RED->GREEN; B0 concurrencia 8 RED / 4 GREEN; CC026 runner sin trigger RED / restore GREEN; tipos locales generados y git diff sin drift. Son logs CI del autor, NO mutaciones independientes del revisor.
6. [approval-policy 39003514915](https://github.com/cadeApp/cadeApp/actions/runs/39003514915) FAIL: `Falta el informe completo de revisar-pr sin bloqueantes.` Vercel Preview estado READY bajo proyecto develop; Supabase Preview skipped. Ningún check acredita migración remota staging.
7. `migrate.yml` y `deploy.yml` idénticos al staging actual. migrate-staging ejecuta db push al push de staging, luego tipos; deploy-staging se dispara por workflow_run success del mismo SHA, health, e2e-staging. La rama staging no se alteró en esta sesión.

**Prueba adicional solicitada a autor antes del merge:** recorrido exhaustivo de consumidores old-staging sobre delivery_requests/offers, rol y operaciones directas; actualizar body con matriz y rollout forward-only. **E2E real staging sólo después de autorización y merge**; no presentarlo anticipadamente como PASS.


## Ronda 2 — 2026-10-17 (GitHub solo lectura)
- `get_pr_info PR392`: body editado 05:02 UTC, HEAD real `a53164916189e4b5d93f51cee285db24523747db`, base staging `86c98cae`, state open, merged false.
- `compare a531649...HEAD`: identical, 0 nuevos commits, 0 archivos cambiados. Body rectifica H01, incluye matriz RPC/admin antigua, rollback forward-only y STOP de staging.
- CI sobre HEAD [39004412632](https://github.com/cadeApp/cadeApp/actions/runs/39004412632): unit 135/2492 PASS, db-tests 26/2341 pgTAP PASS, restantes tests técnicos PASS.
- [approval-policy 39004741813](https://github.com/cadeApp/cadeApp/actions/runs/39004741813): FAIL, literalmente falta informe SIN BLOQUEANTES. `.github/workflows/approval-policy.mjs` hasCompleteReport() parsea sección específica del body y seis rótulos literales. Workflow `approval-policy.yml` dispara al editar PR.
- SHA inventado en body `a5316491d9d9f52f3e07080fae9910d93ea6b6b7`: GitHub GET commit devolvió 422. Real `a53164916189e4b5d93f51cee285db24523747db`.
- El revisor no ejecutó DB/Docker/Supabase, ni deploy/E2E staging, ni `node docs/revision-pr/analizar.mjs verificacion` sin clon. H01 queda `arreglado-sin-verificar` (code inspection y CI de autor, no prueba staging).
