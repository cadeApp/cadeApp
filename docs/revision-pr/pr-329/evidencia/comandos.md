# Comandos y evidencia — PR #329 / ronda 1

## Obtención de código de la rama (sin checkouts locales)
- GitHub PR #329: `get_pr_info`, HEAD `767e382abfed73eb2dd266a63a22b20d9d4bc2e8`; `fetch_pr_patch`, 3 archivos.
- `compare_commits(base=883ee17d..., head=767e382abfed73eb2dd266a63a22b20d9d4bc2e8)`: 2 commits, 3 archivos, 0 fuera de alcance.
- `compare_commits(base=bd46622b..., head=767e382abfed73eb2dd266a63a22b20d9d4bc2e8)`: **solo** `docs/tasks/log/T-340.md`, +12 líneas.
- Lectura independiente desde `develop`: `docs/tasks/T-340.md`; `docs/revision-pr/{README.md,COMO-ENTREGAR.md}`; `.agents/skills/revisar-pr/SKILL.md`.
- Inspección de diff de T-342, T-345, seed `src/server/e2e/staging-seed.ts` (materializa drop 1 y limpia parent) y migraciones de `set_updated_at()`/CC-023 (sin edición).

## CI de implementación
- `fetch_workflow_job_logs(repo=cadeApp/cadeApp,job_id=115616301245)` -> run [38491111892](https://github.com/cadeApp/cadeApp/actions/runs/38491111892). Extracción directa:
  - checkout `bd46622be411277a377e4bb39d662418e02da1c3`;
  - `Running 72 tests using 1 worker`;
  - T-342 `courier-feed-privacy.spec.ts:27` PASS, test #5;
  - T-345 `courier-private-columns.spec.ts:32` PASS, test #12;
  - `multi-drop.spec.ts:37` PASS, test #43;
  - `t340-legacy-checkpoint.spec.ts:29` PASS, test #64;
  - `72 passed (16.0m)`;
  - `Running 3 tests using 1 worker`;
  - DoD1/DoD2/DoD3 global-settings PASS; `3 passed (1.0m)`.

## CI de HEAD documental posterior
- `GET /repos/cadeApp/cadeApp/commits/767e382abfed73eb2dd266a63a22b20d9d4bc2e8/check-runs`: `unit`, `db-tests`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `approval-policy` SUCCESS.
- `get_commit_combined_status(767e382abfed73eb2dd266a63a22b20d9d4bc2e8)`: Vercel SUCCESS; `e2e-preview` inicialmente pending; run [38492968909](https://github.com/cadeApp/cadeApp/actions/runs/38492968909) en progreso al redactar.
- No se ejecutó `pnpm test` local ni `pnpm test:db` ni Docker/Supabase locales (entorno de revisión sin clon preparado y política de no levantar Docker/Supabase). No se mutó código; **no hay RED adicional independiente**.
- `e2e-preview` anterior en #327: run `38486242487`, `70 passed, 2 failed` por errores del seed preexisting, no por assert de privacidad; estos son los RED originales.
- Reproducibilidad mutantes M-T342/M-T345: no invocados; no atribuir fallos de infraestructura como negativos.
