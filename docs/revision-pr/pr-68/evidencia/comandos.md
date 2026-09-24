# Evidencia de Comandos — PR #68 (`T-104`) — Ronda 1 (Revisión Independiente)

- **Worktree:** `c:\Users\El Yisus Pai\Desktop\Proyectos\cadeApp-rev68`
- **SHA verificado:** `e6d0b78d20e7b5622af5705126862ef1a062fc28` (`e6d0b78`)
- **Fecha:** 2026-09-23

## 1. Estado de CI en GitHub Actions

```bash
gh pr checks 68 --json name,state
```

```json
[
  { "name": "bundle-budget", "state": "SUCCESS" },
  { "name": "unit", "state": "SUCCESS" },
  { "name": "db-tests", "state": "SUCCESS" },
  { "name": "typecheck", "state": "SUCCESS" },
  { "name": "lint", "state": "SUCCESS" },
  { "name": "build", "state": "SUCCESS" },
  { "name": "audit", "state": "SUCCESS" },
  { "name": "approval-policy", "state": "FAILURE" }
]
```

## 2. Checks locales (`typecheck`, `lint`, `test`, `prettier`)

### `pnpm typecheck`

```text
> cadeapp@0.1.0 typecheck
> tsc --noEmit && tsc --project .github/workflows/tsconfig.json
(exit code 0)
```

### `pnpm lint`

```text
> cadeapp@0.1.0 lint
> next lint --dir src --file middleware.ts --max-warnings 0 && eslint --no-ignore --ext .mjs .github/workflows --max-warnings 0
✔ No ESLint warnings or errors
(exit code 0)
```

### `pnpm test`

```text
 Test Files  24 passed (24)
      Tests  208 passed (208)
# verify-workflows.test.mjs: tests 19, pass 19, fail 0
# verify-adr.test.mjs: tests 6, pass 6, fail 0
(exit code 0)
```

### `npx prettier --check`

```bash
npx prettier --check "src/app/api/cron/**" "src/app/api/health/**" "src/server/cron/**" docs/tasks/T-104.md docs/tasks/log/T-104.md
```

```text
Checking formatting...
[warn] src/server/cron/sweep.ts
[warn] docs/tasks/T-104.md
[warn] docs/tasks/log/T-104.md
[warn] Code style issues found in 3 files. Run Prettier with --write to fix.
```

## 3. Evidencia de hallazgos específicos

### `PR68-H01` — `storage.from('courier-docs').remove()` sin control de `{ error }`

```ts
// src/server/cron/sweep.ts:65-73
// Eliminar binarios de Supabase Storage
await supabase.storage.from('courier-docs').remove(storagePaths);

// Marcar purged_at = now()
await supabase.from('courier_documents').update({ purged_at: nowIso }).in('id', docIds);
```

### `PR68-H02` — Fecha UTC vs zona horaria Argentina (`-03:00`) en `sweep.ts`

```ts
// src/server/cron/sweep.ts:12-13, 122-126
const nowIso = new Date().toISOString();
const currentDateIso = nowIso.split('T')[0] ?? '';
...
const paidUntilDate = new Date(merchant.paid_until);
paidUntilDate.setDate(paidUntilDate.getDate() + graceDays);
const paidUntilWithGraceStr = paidUntilDate.toISOString().split('T')[0] ?? '';
if (paidUntilWithGraceStr < currentDateIso) {
  expiredMerchantIds.push(merchant.profile_id);
}
```

Contra `src/domain/states/index.ts:79-86`:

```ts
const paidUntilMs = parseTimestampMs(
  typeof input.paidUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.paidUntil)
    ? `${input.paidUntil}T23:59:59.999-03:00`
    : input.paidUntil
);
const graceMs = Math.max(0, input.graceDays ?? 0) * MS_PER_DAY;
if (paidUntilMs !== null && paidUntilMs + graceMs >= input.now.getTime()) {
  return ok(true);
}
```

### `PR68-H04` — Comparación con `!==` en `src/app/api/cron/sweep/route.ts:9`

```ts
const authHeader = req.headers.get('authorization');
const expectedAuth = `Bearer ${serverEnv.CRON_SECRET}`;

if (!authHeader || authHeader !== expectedAuth) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```
