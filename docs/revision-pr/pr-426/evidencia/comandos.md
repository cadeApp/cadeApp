# Evidencia reproducible — PR #426

```powershell
git rev-list --parents -n 1 16844025f3d6f73725f1045ca05d5022f95cd4c9
git merge-base --is-ancestor 59fb3daa82eb1c0394dca9bad143d7fd246ec34b 16844025f3d6f73725f1045ca05d5022f95cd4c9
git merge-base --is-ancestor fb7db3f035251a78e5a9e32f5e3465735a36ba4f 16844025f3d6f73725f1045ca05d5022f95cd4c9
git diff --name-only origin/staging..16844025 -- supabase/migrations
git diff --check
pnpm typecheck
pnpm lint
pnpm test
node --test .github/workflows/verify-workflows.test.mjs
node --test docs/adr/verify-adr.test.mjs
pnpm build
pnpm test:db
gh run view 39289651766 --json attempt,status,conclusion,headSha,jobs,url
gh run view 39294894287 --json status,conclusion,headSha,jobs,url
```

`pnpm test:db` local devuelve `ECONNREFUSED 127.0.0.1:54322` porque Docker Desktop no está iniciado. No se usó Supabase remoto.


## Ronda 2 — 2026-10-19 (inspección GitHub + logs CI)

HEAD: 497172151c4ea003bb883ed27b7ee46138587f43. Develop incorporado: d9b49647f484b5f1b5a502225e9f3b6f95d7402a. Staging base: fb7db3f035251a78e5a9e32f5e3465735a36ba4f.

Se consultaron metadata de PR, padres del commit, comparación con develop y staging, los tres TSX de personalizaciones y SVG, workflows deploy/e2e-staging/verify-workflows, inventario de supabase/migrations y logs de la corrida oficial. Resultado: sólo cuatro personalizaciones app respecto de develop; 39 migraciones en develop/release, 33 en staging; 6 pendientes. Run https://github.com/cadeApp/cadeApp/actions/runs/39335801078 success, Vitest 2890/2890, workflow tests 79/79, ADR 6/6, pgTAP Files=31 Tests=2868 Result: PASS. Supabase Preview skipped, NO contado como verde. E2E de staging no realizado.

### Harness para reproducción por otro revisor (NO ejecutado aquí)

Copiar el siguiente bloque completo a /tmp/pr426-r2.sh y correrlo desde un clon limpio del repo con dependencias instaladas; no usa secretos ni escribe en remoto. **Los resultados anteriores son los de GitHub, no de este script**.

```bash
#!/usr/bin/env bash
set -euo pipefail
SHA="497172151c4ea003bb883ed27b7ee46138587f43"
DEV="d9b49647f484b5f1b5a502225e9f3b6f95d7402a"
STAGE="fb7db3f035251a78e5a9e32f5e3465735a36ba4f"
git fetch origin
test "$(git rev-parse origin/develop)" = "$DEV" || { echo "develop avanzó: hay que volver a revisar"; exit 1; }
git merge-base --is-ancestor "$DEV" "$SHA"
git merge-base --is-ancestor "$STAGE" "$SHA"
git diff --check "$STAGE" "$SHA"
git diff --name-only "$DEV" "$SHA" | grep -v '^docs/revision-pr/' || true
comm -13 <(git ls-tree -r --name-only "$STAGE" -- supabase/migrations | sort) <(git ls-tree -r --name-only "$SHA" -- supabase/migrations | sort) > /tmp/pr426-r2-migrations.txt
test "$(wc -l < /tmp/pr426-r2-migrations.txt)" -eq 6
cat /tmp/pr426-r2-migrations.txt
git show "$SHA:.github/workflows/e2e-staging.yml" | grep 'timeout-minutes: 45'
echo "Para reproducir test exacto en worktree limpio:"
echo "git worktree add /tmp/pr426-wt $SHA"
echo "cd /tmp/pr426-wt && pnpm install --frozen-lockfile && node --test .github/workflows/verify-workflows.test.mjs"
```

No se atribuyen resultados inventados a este harness. No se ejecutaron mutaciones RED propias porque ronda 2 no cambia el control ni código de producto; el RED del timeout está en la evidencia de PR #427 y no fue reproducido aquí.
