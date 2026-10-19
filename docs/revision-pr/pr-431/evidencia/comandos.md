# Evidencia y comandos — PR #431 / T-375

## Evidencia realmente observada

- PR HEAD original: `0c50d73cdb9d676d9bb8d2afe6e502d5d3f32356`.
- Base develop: `1e69477dae1e50cd67c307c9a0f987366f90c98e`.
- Commit de precisión documental del revisor: `86a7b21aac38766c2d1798dc406dc9a08509e811`.
- Diff inicial del PR por conector GitHub: 2 archivos, nueva `docs/tasks/T-375.md` y una fila T-375 en `docs/implementation-plan.md`.
- `e2e-preview`, job 118264227729, run 39305230026: `Running 6 tests using 1 worker`, timeout `60000ms` en `publication-credits.global-settings.spec.ts:165`; retry #1 pasa, global-settings informa `5 passed (4.4m)` y 1 fallo del primer intento.
- Inicialmente CI run 39330788964: `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` success; `db-tests` aún in_progress. Estado `e2e-preview`: pending.
- Los datos precedentes provienen del conector GitHub; **no** se ejecutaron tests locales.

## Reproducción recomendada en un clon limpio (NO EJECUTADA aquí)

```bash
git fetch origin
git rev-parse origin/develop
git rev-parse origin/docs/T-375-pilot-restore
git diff --stat origin/develop...origin/docs/T-375-pilot-restore
git diff --check origin/develop...origin/docs/T-375-pilot-restore
git diff origin/develop...origin/docs/T-375-pilot-restore -- docs/tasks/T-375.md docs/implementation-plan.md
git merge-tree --write-tree origin/develop origin/docs/T-375-pilot-restore
pnpm exec vitest run tools/verify-fichas.test.ts
node docs/revision-pr/analizar.mjs verificacion
```

Los comandos son recetas de verificación documental, **no** resultados afirmados. El harness RED→GREEN de Playwright pertenece a la futura PR de implementación: no se fabricó ni ejecutó una mutación sobre la ficha, no se tocó Supabase ni se alteraron controles. Ante una falla del test de precondición, verificar que el estado in-memory queda `false`; ante timeout tras mutación, que la restauración termine en `true`.
