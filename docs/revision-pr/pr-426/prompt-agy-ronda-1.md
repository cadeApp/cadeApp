# Prompt detallado de continuidad — PR #426 — Ronda 1

No merges ni promociones ningún ambiente todavía.

1. Esperá a que termine el run CI `39294894287` del merge funcional `16844025f3d6f73725f1045ca05d5022f95cd4c9`. Exigí typecheck, lint, unit/coverage, db-tests, build, audit y bundle-budget verdes; no tomes `skipped` como PASS.
2. PR #427 no forma parte de este release y quedó bloqueada porque T-315 no autoriza `.github/workflows/e2e-staging.yml`. Si su alcance se regulariza y el fix entra a `develop`, hacé `git fetch origin` y un nuevo `git merge --no-ff origin/develop` en esta rama. Nunca rebase, amend, cherry-pick ni force-push. Repetí CI y revisión independiente sobre el nuevo HEAD.
3. Conservá `COURIER_DOCS_ORPHAN_PURGE_MODE=dry-run` para la introducción de CC-030 salvo decisión operativa expresa.
4. Antes de autorizar el merge, completá manualmente el preflight hosted sólo lectura: proyecto correcto, historial de migraciones, backup disponible, ventana operativa y configuración de staging, sin imprimir secretos ni PII.
5. Sólo después de autorización expresa de Lautaro073: merge de PR #426 a staging. Verificá en secuencia `migrate-staging` → tipos sin drift → `deploy-staging` mismo SHA → `/api/health` 200 → E2E staging completo. Ante cualquier fallo, detener; no adulterar tests, SQL, expectativas ni checks.
6. Pegá en la sección `### Informe de revisión de agy` del body el informe corto de esta ronda para que `approval-policy` evalúe el formato correcto. La fuente es la revisión independiente, no una autoevaluación.

No edites `docs/revision-pr/pr-426/**`. No toques Supabase remoto, Vercel, secretos, `staging`, `main` ni producción durante esta continuidad previa a autorización.
