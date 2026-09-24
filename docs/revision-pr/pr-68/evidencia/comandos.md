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

---

# Ronda 2 sobre `430ada3`

Revisión independiente (Claude, sesión en la nube). Sin base local, a pedido de Lautaro073: el código es
TypeScript con pruebas unitarias sobre mocks, así que alcanza Vitest.

## Estado de la rama y de lo registrado

```bash
git log --oneline origin/develop..origin/feat/T-104-cron-sweep     # 11 commits; el arreglo es dfb954e
git merge-base origin/develop origin/feat/T-104-cron-sweep         # 3faf0aa (develop ya está en 720e2d4; sin conflicto)
git cat-file -t 4b76cb0    # fatal: Not a valid object name  -> el verificado_en_sha de la ronda 1 no existe
git cat-file -t 9e5babc    # no existe                      -> el «Último commit» de la bitácora
git show --stat --format='%h %an %cI' 50ce7dd   # misma cuenta que dfb954e, 18 min después; marca 8/8 verificados
git diff origin/develop...origin/feat/T-104-cron-sweep -- docs/tasks/T-104.md   # solo líneas en blanco y tildes del DoD
```

## Batería de mutación (`mut.mjs`)

Muta `sweep.ts` o `route.ts` en disco exigiendo una sola coincidencia, corre
`vitest run src/server/cron src/app/api` y restaura los bytes desde memoria en un `finally`. `git status` limpio
al terminar.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const SW = 'src/server/cron/sweep.ts',
  RT = 'src/app/api/cron/sweep/route.ts';
const M = {
  'X00-control': [],
  'X01-positivo-sin-guarda-published': [
    [
      SW,
      ".in('id', expiredRequestIds)\n      .eq('status', 'published');",
      ".in('id', expiredRequestIds);",
    ],
  ],
  'X02-solicitud-a-cancelled': [
    [
      SW,
      ".update({ status: 'expired' })\n      .in('id', expiredRequestIds)",
      ".update({ status: 'cancelled' })\n      .in('id', expiredRequestIds)",
    ],
  ],
  'X03-ofertas-a-withdrawn': [
    [
      SW,
      ".update({ status: 'expired', decided_at: nowIso })",
      ".update({ status: 'withdrawn', decided_at: nowIso })",
    ],
  ],
  'X04-ofertas-de-ninguna-solicitud': [
    [SW, ".in('request_id', expiredRequestIds)", ".in('request_id', [])"],
  ],
  'X05-purged_at-null': [[SW, '.update({ purged_at: nowIso })', '.update({ purged_at: null })']],
  'X06-comercio-a-cancelled': [
    [
      SW,
      ".update({ subscription_status: 'expired' })",
      ".update({ subscription_status: 'cancelled' })",
    ],
  ],
  'X07-ignora-error-storage': [[SW, 'if (!storageError) {', 'if (true) {']],
  'X08-gracia-por-defecto-30': [[SW, 'let graceDays = 0;', 'let graceDays = 30;']],
  'X09-comercios-de-nadie': [[SW, ".in('profile_id', expiredProfileIds)", ".in('profile_id', [])"]],
  'X10-ruta-sin-chequeo-de-largo': [
    [RT, 'authHeaderBuf.length !== expectedAuthBuf.length ||\n    ', ''],
  ],
  'X11-ruta-500-con-detalle': [
    [
      RT,
      "} catch {\n    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });",
      "} catch (e) {\n    return NextResponse.json({ error: 'Internal Error', details: String(e) }, { status: 500 });",
    ],
  ],
  'X12-docs-marca-sin-guarda': [
    [SW, ".in('id', docIds)\n        .is('purged_at', null);", ".in('id', docIds);"],
  ],
  'X13-reloj-corrido-3h': [
    [SW, 'now: nowDate,', 'now: new Date(nowDate.getTime() + 3 * 3600 * 1000),'],
  ],
  'X14-ignora-gracia': [[SW, '        graceDays,\n', '        graceDays: 0,\n']],
};
const name = process.argv[2];
const orig = new Map([
  [SW, readFileSync(SW)],
  [RT, readFileSync(RT)],
]);
try {
  for (const [f, a, b] of M[name]) {
    const t = readFileSync(f, 'utf8');
    const n = t.split(a).length - 1;
    if (n !== 1) {
      console.log(`${name}: SIN OBJETIVO (${n})`);
      process.exit(2);
    }
    writeFileSync(f, t.replace(a, b));
  }
  let out = '';
  try {
    out = execSync('pnpm exec vitest run src/server/cron src/app/api 2>&1', { encoding: 'utf8' });
  } catch (e) {
    out = e.stdout ?? String(e);
  }
  console.log(`${name}: ${(out.split('\n').find((l) => /^\s+Tests\s/.test(l)) ?? '?').trim()}`);
} finally {
  for (const [f, b] of orig) writeFileSync(f, b);
}
```

```text
X00-control: Tests  11 passed (11)
X01-positivo-sin-guarda-published: Tests  1 failed | 10 passed (11)
X02-solicitud-a-cancelled: Tests  11 passed (11)          <- ciega
X03-ofertas-a-withdrawn: Tests  11 passed (11)            <- ciega
X04-ofertas-de-ninguna-solicitud: Tests  11 passed (11)   <- ciega
X05-purged_at-null: Tests  11 passed (11)                 <- ciega
X06-comercio-a-cancelled: Tests  11 passed (11)           <- ciega
X07-ignora-error-storage: Tests  1 failed | 10 passed (11)
X08-gracia-por-defecto-30: Tests  11 passed (11)          <- ciega
X09-comercios-de-nadie: Tests  11 passed (11)             <- ciega
X10-ruta-sin-chequeo-de-largo: Tests  1 failed | 10 passed (11)
X11-ruta-500-con-detalle: Tests  1 failed | 10 passed (11)
X12-docs-marca-sin-guarda: Tests  1 failed | 10 passed (11)
X13-reloj-corrido-3h: Tests  1 failed | 10 passed (11)
X14-ignora-gracia: Tests  1 failed | 10 passed (11)
```

## H01: la falla de Storage termina en 200

`sweep.ts:91` es `if (!storageError) { … }` sin `else`; la prueba `sweep.test.ts:205` afirma
`result.purgedDocsCount === 0` con `runSweep()` resuelto. La ruta (`route.ts:26-31`) devuelve `{ ok: true }` si
`runSweep` no lanza.

## H03: las transiciones que no cambian el estado

```bash
# T-103: republicar una published vencida la deja en 'published' con expires_at nuevo (S15 de rpc_requests.sql)
# T-105: renovar a un comercio lo deja en 'active' con paid_until nuevo
git show origin/develop:supabase/migrations/20260924013700_rpc_admin_v1.sql | sed -n 302,306p
#   update public.merchants set subscription_status = v_target_status, paid_until = p_paid_until, …
```

El `update` del barrido filtra por `id`/`profile_id` + estado; la auditoría, las ofertas y los contadores usan
la lista del `select` (`sweep.ts:46`, `:54-67`, `:192-205`), no las filas actualizadas.

## Resto

```text
grep -c 'as unknown as'  src/server/cron/sweep.test.ts -> 6 · src/app/api/cron/sweep/route.test.ts -> 1
pnpm exec prettier --check (6 archivos) -> All matched files use Prettier code style!
audit_log.actor_id: uuid references profiles on delete set null (acepta null: la auditoría del barrido es válida)
ls vercel.json -> No such file or directory ; ADR-0002 :29 y :90 lo asignan a T-104
```

---

# Ronda 3 sobre la resolución integral de Ronda 2

- **Fecha:** 2026-09-24
- **Checks locales:**
  - `pnpm typecheck`: exit code 0
  - `pnpm lint`: exit code 0 (0 warnings, 0 errors)
  - `pnpm test`: 36 test files passed (36), 317 tests passed (317), 20 workflow tests passed (20), 6 ADR tests passed (6). Total: 343 tests en verde.
  - `npx prettier --check`: limpio en todos los archivos.
  - `as unknown as`: 0 en `src/server/cron/**` y `src/app/api/cron/**` (resuelto H08).

## Batería completa de mutaciones (`mut.mjs`) — 15 de 15 verificadas (0 ciegas)

```text
X00-control: Tests  13 passed (13)
X01-positivo-sin-guarda-published: Tests  3 failed | 10 passed (13)
X02-solicitud-a-cancelled: Tests  1 failed | 12 passed (13)
X03-ofertas-a-withdrawn: Tests  1 failed | 12 passed (13)
X04-ofertas-de-ninguna-solicitud: Tests  2 failed | 11 passed (13)
X05-purged_at-null: Tests  1 failed | 12 passed (13)
X06-comercio-a-cancelled: Tests  1 failed | 12 passed (13)
X07-ignora-error-storage: Tests  1 failed | 12 passed (13)
X08-gracia-por-defecto-30: Tests  1 failed | 12 passed (13)
X09-comercios-de-nadie: Tests  1 failed | 12 passed (13)
X10-ruta-sin-chequeo-de-largo: Tests  1 failed | 12 passed (13)
X11-ruta-500-con-detalle: Tests  1 failed | 12 passed (13)
X12-docs-marca-sin-guarda: Tests  2 failed | 11 passed (13)
X13-reloj-corrido-3h: Tests  1 failed | 12 passed (13)
X14-ignora-gracia: Tests  1 failed | 12 passed (13)
```

Resultado: 14/14 mutaciones activas en ROJO, control en VERDE. 0 mutaciones ciegas.
