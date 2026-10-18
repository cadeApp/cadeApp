# Evidencia y comandos — PR #410 / ronda 1

## Evidencia obtenida

- PR head `dfdee176761e6f580d0e56481595c8ce6a68f090`, base `15c68d9ad57fdb6084483d0ba2702c09391aad7c`; ficha leída en `develop`, diff de ficha solamente `[ ]` → `[x]` para las nueve casillas DoD.
- Log `docs/tasks/log/T-355.md`: el autor declara `pnpm typecheck/lint/test` y afirma que E2E Preview «se ejecutará en CI»; no incluye salida RED independiente para cada invariante.
- CI GitHub: workflow `39091997298`, SHA verificado `dfdee176761e6f580d0e56481595c8ce6a68f090`: typecheck, unit, lint, build, audit, db-tests y bundle-budget SUCCESS. Vitest 145 archivos; pgTAP final Files=29, Tests=2764, Result: PASS. Los fallos RED que aparecen en db-tests son mutaciones de otros controles del repo y **no equivalen** a evidencia RED de T-355.
- Vercel: deployment `dpl_9nZh7PngG7tgui1gyPcqkyJB75wU`, ERROR. `next/font/google` loader para Montserrat (`src/app/layout.tsx`) falla con `TypeError: Cannot read properties of null (reading '1')`.
- `approval-policy` failure. E2E Preview no ejecutado en SHA (no commit status). GitHub indica `mergeable=true`, no se ejecutó git merge-tree.
- No se inspeccionaron secretos, claves ni .env; no Supabase/Docker local ni remoto.

## Script completo de la batería de mutaciones propia (PENDIENTE, NO EJECUTADO)

No hay clon Git utilizable en esta sesión (DNS de `github.com` falla), así que las pruebas descritas abajo **no se reportan como RED/GREEN observados**. El script es reproducible desde un clon con Corepack/PNPM; copia el SHA a worktree de /tmp, hace baseline GREEN y dos mutaciones en archivos temporales con restauración desde contenido en memoria (**nunca git checkout**), sin afectar la rama del autor.

```bash
cat >/tmp/pr410-r1-mutation.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d /tmp/pr410-review-XXXX)"
trap 'git -C "$ROOT" worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
git -C "$ROOT" fetch origin
git -C "$ROOT" worktree add --detach "$TMP/wt" dfdee176761e6f580d0e56481595c8ce6a68f090
cd "$TMP/wt"
corepack pnpm install --frozen-lockfile >"$TMP/install.log" 2>&1
corepack pnpm exec vitest run  src/features/courier-onboarding/schemas.test.ts  src/features/courier-onboarding/actions.test.ts  src/features/courier-onboarding/components.test.tsx  'src/app/(courier)/courier/profile/page.test.tsx' >"$TMP/baseline.log" 2>&1
grep -E 'Test Files|Tests ' "$TMP/baseline.log" | tail -4

node --input-type=module <<'NODE'
import fs from 'node:fs';
import cp from 'node:child_process';
const mutants = [
  {name:'reject-unknown-keys',path:'src/features/courier-onboarding/schemas.ts',
   after:'export const courierUpdatePhoneSchema',old:'.strict();',newText:'.strip();',
   test:'src/features/courier-onboarding/schemas.test.ts'},
  {name:'update-other-user',path:'src/features/courier-onboarding/actions.ts',
   after:'const { data: updatedProfile, error: updateError }',old:".eq('id', user.id)",newText:".eq('id', 'otro-uuid')",
   test:'src/features/courier-onboarding/actions.test.ts'}
];
let unexpected=0;
for (const m of mutants) {
  const source=fs.readFileSync(m.path,'utf8');
  const segment=source.indexOf(m.after);
  const offset=segment<0 ? -1 : source.indexOf(m.old,segment);
  if(offset<0) throw new Error('Sin objetivo: '+m.name);
  const mutated=source.slice(0,offset)+m.newText+source.slice(offset+m.old.length);
  fs.writeFileSync(m.path,mutated);
  try {
    const run=cp.spawnSync('corepack',['pnpm','exec','vitest','run',m.test],{encoding:'utf8',timeout:120000});
    console.log(m.name, 'exit=',run.status, (run.stdout+'\n'+run.stderr).split('\n').filter(x=>/Test Files|Tests |FAIL|failed/i.test(x)).slice(-6).join(' | '));
    if(run.status===0 || run.error || run.status===null || run.signal) unexpected++;
  } finally {
    fs.writeFileSync(m.path,source); // restauración de memoria
  }
}
if(unexpected) process.exitCode=1;
NODE
git diff --exit-code
SH
bash /tmp/pr410-r1-mutation.sh
```

**Límite de esa batería:** sus dos mutaciones no sustituyen los tests NUEVOS de H01/H03/H06/H07. En su arreglo, el autor deberá crear para cada uno un caso real con mocks y expectations no adulteradas que pase GREEN base, falle RED con una mutación diferente de las usadas por el autor, y vuelva GREEN; anexar comando, salida `Test Files/Tests` y SHA a bitácora. La revisión independiente reproducirá todo en ronda 2.

## Comandos de verificación restantes

```bash
git fetch origin
git rev-parse HEAD
git ls-remote origin feat/T-355-courier-phone-edit
git diff origin/develop -- docs/tasks/T-355.md
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
```

Para SQL/RLS usar el log `db-tests` de CI en el CC #412; **no levantar Supabase ni Docker local por esta revisión**. Para E2E, registrar un Vercel Preview READY y el run `e2e-preview` del SHA exacto sobre Supabase Develop, sin deploy de mutaciones inseguras.


## Ronda 2 — 2026-10-18 · SHA 56c458a335e0ff7b729038e16b2e34ad101a8175

**Consulta remota sin secretos:** GitHub PR, diff, CI jobs y logs. Desde este contenedor `git ls-remote https://github.com/cadeApp/cadeApp.git refs/heads/develop` devolvió `Could not resolve host: github.com`. No es posible ejecutar worktree, mutaciones de código o Playwright local; **la batería siguiente queda PROYECTADA, NO EJECUTADA** y los hallazgos están etiquetados por inspección.

- `develop` merge commit CC-031: `29a44225513621ca9430924cd90d4c929c219e8d`.
- Branch code HEAD examinado: `56c458a335e0ff7b729038e16b2e34ad101a8175` (ahead 9, behind 0).
- CI [39106586647](https://github.com/cadeApp/cadeApp/actions/runs/39106586647): typecheck, lint, unit, build, audit, bundle-budget, db-tests, approval-policy PASS.
- db-tests [117613641146](https://github.com/cadeApp/cadeApp/actions/runs/39106586647/job/117613641146): 30 archivos/2815 pgTAP PASS, mutaciones CC-031 RED/GREEN con logs verificables, tipos generados sin diff.
- unit [117613641164](https://github.com/cadeApp/cadeApp/actions/runs/39106586647/job/117613641164): 145 archivos Vitest PASS.
- Vercel READY. [E2E run 39106647405](https://github.com/cadeApp/cadeApp/actions/runs/39106647405), job `117614583076`, estaba `in_progress` («Run preview E2E gate») a la inspección; la casilla sigue pendiente.
- **Mutaciones de H01/H03/H06/H07:** el autor declara mutaciones RED→GREEN en bitácora; solo se comprobó por inspección el oráculo final y su CI GREEN. Esta revisión **NO** afirma haber reproducido sus mutantes.

### Comprobador estático independiente propuesto para H09

Script completo para escribir en `/tmp/pr410-r2-guard.mjs`, ejecutar **solo** desde el worktree del SHA después de sincronizar. No modifica código, umbrales, fixtures, ni workflows. Debe fallar hoy por las expresiones agregadas y pasar una vez corregidas, sin falsificar suites:

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';

const checks = [
  {
    file: 'src/app/(courier)/courier/profile/page.test.tsx',
    banned: /\(profile as any\)\.dniHash/,
    label: 'new any on dniHash',
  },
  {
    file: 'src/features/courier-onboarding/components.test.tsx',
    banned: /\.closest\('\.space-y-4'\)!/,
    label: 'new non-null assertion on personalCard',
  },
  {
    file: 'e2e/specs/authorization.spec.ts',
    banned: /initialProfile!\.(phone|display_name)/,
    label: 'new E2E non-null assertions',
  },
];

let errors = 0;
for (const { file, banned, label } of checks) {
  const source = fs.readFileSync(file, 'utf8');
  const violates = banned.test(source);
  console.log(`${violates ? 'FAIL' : 'PASS'} | ${file} | ${label}`);
  if (violates) errors++;
}
assert.equal(errors, 0, `${errors} expresiones prohibidas nuevas`);
```

**Control de sensibilidad propuesto (no ejecutado):** después de que la autora corrija, correr baseline PASS de la misma comprobación; sobre una COPIA temporal de esos tres archivos reintroducir una a una las cadenas prohibidas y exigir fallo específico; restaurar siempre desde contenido en memoria, sin `git checkout` ni alteraciones de tests. No aceptar un chequeo que nunca cae en rojo.

### Comandos para el agente tras arreglar

```bash
git fetch origin
git switch feat/T-355-courier-phone-edit
git pull --ff-only
node /tmp/pr410-r2-guard.mjs
pnpm typecheck
pnpm lint
pnpm test
git diff --check
git status --short
git ls-remote origin feat/T-355-courier-phone-edit
```

Revisar el E2E mediante UI de Actions **del SHA exacto**, no invocar `workflow_dispatch`, no usar consola remota ni correr SQL privilegiado.
