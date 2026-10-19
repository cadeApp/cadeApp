# Evidencia reproducible — PR #427

```powershell
git diff --stat origin/develop...6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46
git diff origin/develop...6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46
git diff --check origin/develop...6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46
pnpm typecheck
pnpm lint
node --test .github/workflows/verify-workflows.test.mjs
pnpm vitest run src/server/supabase/clients.test.ts
gh pr checks 427
```

El diff funcional inspeccionado contiene una adición y una eliminación en `.github/workflows/e2e-staging.yml`: sólo `timeout-minutes: 20` → `45`.
