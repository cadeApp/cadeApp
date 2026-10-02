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

## Ronda 2 — verificación final

### H01
- `docs/contracts/CC-015.md` actual comparado byte a byte con merge de PR #181: **igual**.
- `docs/contracts/CC-017.md` existe y apunta a #189.
- T-326 referencia CC-017 / PR #213 y mantiene el bloqueo hasta merge.

### H02
```text
throws_ok(..., '23514', null::text, ...)
```
en los cinco casos de pair/bounds.

### M1
```text
SHA: c5f4f8cfa6fd67da652ada967d5b96efe0dfcab8
CI: 37052789350 (#928)
db-tests: FAILURE
Failed tests: 1, 6-7, 10, 15
```

Fallos directos:
- `zones_active_centroid no longer exists`;
- `active zone with both centroid coordinates null is accepted`.

### M2
```text
SHA: 32b746f5a859bcbb359724385db2e5aabd013c04
CI: 37069932109 (#931)
db-tests: FAILURE
Failed tests: 2, 8-10
```

Fallos:
- `zones_centroid_pair is preserved`;
- lat sin lng;
- lng sin lat;
- update a una sola coordenada.

### HEAD restaurado
```text
SHA: 2fac315e6d86ffa43863d3fc574bd48a72b89a67
CI: 37070408547 (#932)
unit: 113 files / 1682 tests PASS
db-tests: 15 files / 1660 tests PASS
cc017_zones_without_centroid.sql .. ok
typecheck/lint/audit/build/bundle-budget: success
```

### Develop
La rama está 4 commits detrás, con 0 archivos solapados. Requiere sincronización mecánica antes del merge.
