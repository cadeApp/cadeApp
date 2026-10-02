# Evidencia reproducible — PR #213 / Ronda 1

**SHA:** `a6cab08fa6aa86762f03f455bc4e67a9919b988e`

## Alcance

```text
src/features/requests/actions.test.ts
supabase/migrations/20261002200000_cc015_zones_without_centroid.sql
supabase/tests/cc015_zones_without_centroid.sql
```

No hay cambios productivos en `actions.ts`.

## Historia de numeración

PR #181:
```text
[CC-015] cancel_request administrativo en in_transit exige incidente registrado
merge: 874a9b71db5001d66de04c15a850565ecee9a6ee
```

El contrato original se puede inspeccionar con:

```bash
git show 874a9b71db5001d66de04c15a850565ecee9a6ee:docs/contracts/CC-015.md
```

Issue #189 vigente:
```text
[CC-017] Permitir zonas activas sin centroide verificado
```

## CI #917

DB:
```text
Applying migration 20261002200000_cc015_zones_without_centroid.sql...
supabase/tests/cc015_zones_without_centroid.sql .. ok
All tests successful.
Files=15, Tests=1660
Result: PASS
```

Unit:
```text
src/features/requests/actions.test.ts (17 tests) PASS
Test Files 113 passed
Tests 1682 passed
```

Lint:
```text
✔ No ESLint warnings or errors
```

Todos los jobs del run #917 concluyeron success.

## E2E Preview

Run asociado:
```text
resolve-preview: success
e2e-preview: skipped
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Es esperado porque el PR cambia una migración y la base Develop no se migra desde ramas feature.

## Verificación después del arreglo

```bash
git diff --name-only origin/develop...HEAD
grep -R "CC-015" docs/contracts/CC-017.md docs/tasks/T-326.md supabase/tests/cc017_zones_without_centroid.sql supabase/migrations/*cc017*
pnpm vitest run src/features/requests/actions.test.ts
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```

DB por CI; no levantar Supabase/Docker local.


## Evidencia faltante — M1/M2

El body de PR #213 declara:

```text
M1 (reintroducir zones_active_centroid) y M2 (debilitar zones_centroid_pair): NO ejecutadas.
```

El GREEN de CI #917 no sustituye esa demostración.

Método requerido sin Docker local:
- commit temporal M1 → push → db-tests RED → guardar run ID/salida → revert → push;
- commit temporal M2 → push → db-tests RED → guardar run ID/salida → revert → push;
- HEAD final GREEN.

La base usada por `db-tests` es efímera; estas mutaciones no migran Supabase Develop.
