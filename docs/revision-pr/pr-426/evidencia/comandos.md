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
