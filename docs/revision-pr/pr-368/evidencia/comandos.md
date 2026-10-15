# Evidencia reproducible — PR #368 / T-354 — Ronda 1

## Hechos verificados por consultas de solo lectura a GitHub
- Pull request `#368`, HEAD de autor `83734650a04cc438ce117772419f2f3a61142083`, 1 archivo modificado: `docs/tasks/log/T-354.md` (+13).
- La bitácora confirma tests RED pendientes y que no hay implementación de copy.
- Comparación con develop: 2 commits delante / 4 detrás en la consulta. Nota: develop es móvil.
- Ficha desde develop: inicialmente no autorizaba `src/features/offers/courier-panel.test.tsx`.
- Luego se registró la decisión explícita (1-A, 2-B, 3-A) en el commit documental `8316ea4f25a5e02b8db1e1c78a0efafb1d96e960`.

**No se corrió ningún comando local de suite ni de mutación** en esta sesión: Git remoto accesible mediante conector de GitHub, pero no hay clon ejecutable con dependencias. No representar estos comandos como resultados obtenidos.

## Cómo reproducir la ausencia de implementación inicial (solo lectura)

```bash
git fetch origin
git diff --name-status 14c28ed3c41cb2bde92705fc018c7dd0df73245b...83734650a04cc438ce117772419f2f3a61142083
git show 83734650a04cc438ce117772419f2f3a61142083:docs/tasks/log/T-354.md
git show 14c28ed3c41cb2bde92705fc018c7dd0df73245b:src/features/courier-onboarding/copy.ts | grep -F "Selfie de validación"
git show 14c28ed3c41cb2bde92705fc018c7dd0df73245b:src/features/courier-onboarding/components/status-view.tsx | grep -F "Selfie de seguridad"
```

**Resultado esperado al ejecutar (no ejecutado localmente):** diff solo bitácora y coincidencias de texto viejo.

## Comandos para la próxima ronda, cuando exista implementación (pendientes)

```bash
git fetch origin
git ls-remote origin feat/T-354-unificar-texto-selfie-dni
git diff --name-status origin/develop...origin/feat/T-354-unificar-texto-selfie-dni
git merge-tree --write-tree origin/develop origin/feat/T-354-unificar-texto-selfie-dni
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx src/features/offers/courier-panel.test.tsx src/features/admin/components/applicant-detail-view.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

La próxima revisión debe añadir y **ejecutar** una batería propia de mutaciones RED→GREEN en un worktree temporal limpio sobre el nuevo SHA, guardar aquí el harness completo y comprobar que el control lo detecta. Hoy sería incorrecto inventar una batería «pasada» sobre código que aún no existe. No levantar Docker/Supabase local; si no hay CC servidor, test:db n.a. E2E Preview contra Develop solo si su ejecución está autorizada por el flujo preexistente.
