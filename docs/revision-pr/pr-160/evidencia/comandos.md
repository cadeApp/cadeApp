# Evidencia y comandos — PR #160

## Ronda 6

**SHA funcional revisado:** `a2365c7068ae7c85afb9b96ea05187210f3481ae`

### Sincronización

Estado inicial de Ronda 6:
- branch: `1c6838062e5af4a0096a478a1f63a90797477716`
- develop: `3a38fdd5d6a7b7a320f9185468e8514c9eae353c`
- behind: 20

Comparación por lados desde merge-base `01f8fb20587beb5b43b606103051deb49e1c01d1`:
- develop: 14 archivos;
- branch: 20 archivos;
- overlap: **0**.

Merge creado por la revisión:
```text
a2365c7068ae7c85afb9b96ea05187210f3481ae
```

Verificación posterior:
```text
ahead=28
behind=0
merge-base=3a38fdd5d6a7b7a320f9185468e8514c9eae353c
```

### CI exact-head

Workflow:
- CI #809
- run 36960750299
- conclusion: success

Unit:
```text
Test Files 110 passed (110)
Tests      1625 passed (1625)
```

Node:
```text
workflow tests: 31
ADR tests: 6
```

DB:
```text
All tests successful.
Files=1, Tests=10
Result: PASS

All tests successful.
Files=13, Tests=1614
Result: PASS
```

El job continuó con:
```text
node tools/db-types.mjs --local
git diff --exit-code -- src/types/database.types.ts
```

y concluyó success.

Otros jobs:
- typecheck success
- lint success
- build success
- audit success
- bundle-budget success

### Issue / cierre

- PR body: `Refs #35`
- `Closes #35`: ausente
- issue #35: open
- labels: P2, fase-3, en-curso
- comentario de acción manual post-merge: publicado

### Gate staging

El workflow actual solo ejecuta:
```bash
pnpm exec playwright test e2e/specs/smoke.spec.ts --project=chromium
```

Para cerrar T-303 debe ejecutarse:
```bash
pnpm exec playwright test e2e/specs/main-flow.spec.ts --project=chromium
```

contra el deployment de staging después de promover develop.
