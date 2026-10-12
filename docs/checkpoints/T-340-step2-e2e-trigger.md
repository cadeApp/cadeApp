# Checkpoint temporal E2E posmigración — T-340 / PR #318

**Propósito único:** activar el Vercel Preview y el workflow confiable `e2e-preview` contra **Supabase Develop**, después del merge controlado del Paso 2/4 de CC-022. Esta PR se **cierra sin merge** después de documentar el resultado; no introduce lógica ni migraciones.

- PR original: https://github.com/cadeApp/cadeApp/pull/318
- Merge a develop: `0ab96d941854341c75e801c1a326d1e585c87d9d`
- Migración automática de Develop: https://github.com/cadeApp/cadeApp/actions/runs/38316877437 — SUCCESS, incluido `db:types`.
- Revisión independiente: https://github.com/cadeApp/cadeApp/blob/develop/docs/revision-pr/pr-318/revisiones/ronda-9.md
- Pruebas exigidas: `e2e/specs/multi-drop.spec.ts` y `e2e/specs/t340-legacy-checkpoint.spec.ts`, además de suite Chromium / global-settings existente.
- Ninguna migración ni archivo de workflow debe agregarse a esta PR.
- El checkpoint **no se considera GREEN** por la creación de esta PR ni por los tests unitarios: solo un run E2E real, con SHA, job y resultado autenticado, habilita el Paso 3 de Kira.
- Si falla o no corre, detener el rollout y corregir en un nuevo PR del Paso 2; no habilitar la limpieza legacy.
- **NO MERGEAR ESTA PR DE CHECKPOINT.** Es un disparador temporal y debe cerrarse sin merge al registrar evidencias.

Estado inicial: E2E posmigración pendiente de ejecución y verificación.
