# Evidencia y comandos reproducibles — PR #304 / T-349 / ronda 1

**HEAD de código examinado:** `255fdc2153e2afcfcb1e0c34c64221f04c6b6b5b`  
**Precisión:** se reprodujo el mecanismo con un harness aislado; no se ejecutó Vitest del repositorio en esta sesión. El entorno no pudo resolver `github.com` desde `git ls-remote`; evidencia de CI proviene de logs GitHub, SHA correspondiente.

## H01 — Script independiente completo, sin tocar el checkout

Copiá este bloque entero a una terminal con Node >= 18. Crea archivos sintéticos en `os.tmpdir()`, los elimina al terminar y comprueba la misma función `isInside`, la misma comparación `Buffer.equals` y el orden de las comprobaciones del HEAD. El objeto `res` imita el retorno del hijo **solo** para aislar la ventana entre `spawnSync` y `return res`; no es Vitest ni prueba de producción.

```bash
cat > /tmp/pr304-h01.cjs <<'JS'
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pr304-h01-'));
const repoRoot = path.join(scratch, 'main');
const mutationWorktree = path.join(scratch, 'isolated');
const relativeFilePath = 'src/features/auth/guards.ts';
const main = path.join(repoRoot, relativeFilePath);
const temp = path.join(mutationWorktree, relativeFilePath);
fs.mkdirSync(path.dirname(main), {recursive:true});
fs.mkdirSync(path.dirname(temp), {recursive:true});
fs.writeFileSync(main, 'ORIGINAL');
fs.writeFileSync(temp, 'ORIGINAL');
const initial = fs.readFileSync(main);
function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
function assertMutationIsolated(relativeFilePath, filePath, mainBefore) {
  if (!isInside(mutationWorktree, filePath) || isInside(repoRoot, filePath)) {
    throw new Error('Isolation broken: mutation outside temporary worktree: ' + relativeFilePath);
  }
  const mainAfter = fs.readFileSync(path.join(repoRoot, relativeFilePath));
  if (!mainAfter.equals(mainBefore)) {
    throw new Error('Isolation broken: ' + relativeFilePath + ' changed in the main checkout while mutated');
  }
}
function run(postCheck, injectAfterChild) {
  const filePath = temp;
  const mainBefore = fs.readFileSync(main);
  const original = fs.readFileSync(filePath);
  let injected = false;
  try {
    fs.writeFileSync(filePath, 'MUTATED');
    assertMutationIsolated(relativeFilePath, filePath, mainBefore);
    const res = {status:1, stdout:'failed'}; // Child returns here
    if (injectAfterChild) {
      fs.writeFileSync(main, 'MUTATED');
      injected = true;
    }
    if (postCheck) assertMutationIsolated(relativeFilePath, filePath, mainBefore);
    return res;
  } finally {
    fs.writeFileSync(filePath, original);
    if (injected) fs.writeFileSync(main, mainBefore); // Only RED experiment
  }
}
try {
  assert.equal(run(false, true).status, 1);
  assert.ok(fs.readFileSync(main).equals(initial));
  console.log('ORIGINAL: GREEN despite post-child checkout write and restoration');
  assert.throws(() => run(true, true), /Isolation broken: .*changed in the main checkout/);
  assert.ok(fs.readFileSync(main).equals(initial));
  console.log('POST-CHECK: RED with the same injected regression');
  assert.equal(run(true, false).status, 1);
  assert.ok(fs.readFileSync(main).equals(initial));
  console.log('POST-CHECK: GREEN without regression; bytes preserved');
} finally {
  fs.rmSync(scratch, {recursive:true, force:true});
}
JS
node /tmp/pr304-h01.cjs
```

Salida esperada (reproducida en un arnés equivalente y ligeramente más extenso, Node v22.16.0):

```text
ORIGINAL: GREEN despite post-child checkout write and restoration
POST-CHECK: RED with the same injected regression
POST-CHECK: GREEN without regression; bytes preserved
```

**Limitación:** este script no descarga el repositorio ni corre `pnpm vitest`; no sustituye la mutación de RED en el test real requerida al autor.

## Mutación independiente exigida al autor (NO COMMIT)

En una copia temporal de `src/server/rpc/cc007.test.ts` o modificación local **restaurada**, inyectar inmediatamente después del bloque `const res = spawnSync('pnpm', testArgs, ...);` de `executeMutation`:

```ts
// INYECCIÓN LOCAL SOLO PARA RED (no commitear)
fs.writeFileSync(path.join(repoRoot, relativeFilePath), mutated, 'utf8');
```

Y, solo mientras dure la mutación experimental, agregar al `finally` existente una restauración del **checkout principal** usando el `Buffer mainBefore` (protegida para ejecutarse aun si la aserción lanza). La restauración debe estar en un `finally`, no depender de que el caso pase. En el estado original, la suite focal debe mantenerse verde pese al desvío; con la segunda aserción entre `spawnSync` y `return res`, debe mostrar **4 RED por `Isolation broken: ... changed in the main checkout while mutated`**; tras revertir inyección y su restauración temporal, debe volver a **13 GREEN**. **No adulterar expectations, tests, mocks, condiciones ni timeouts.** Registrar salida real y hashes/diff de los cuatro archivos.

Comandos de comprobación para autor, desde raíz y rama de la PR:

```bash
git pull
pnpm vitest run src/server/rpc/cc007.test.ts
pnpm typecheck && pnpm lint && pnpm test
git diff --exit-code -- src/features/auth/guards.ts src/features/auth/queries.ts src/features/auth/actions.ts supabase/migrations/20260925170000_cc007_consent_enforcement.sql
git diff --check
git status --short
git ls-remote origin refs/heads/feat/T-349-cc007-isolation-control
```

## CI observado sobre `255fdc2`

- Unit: `Test Files 123 passed (123)`, `Tests 1942 passed (1942)`; la suite `cc007.test.ts`: 13 casos.
- DB: `Files=19, Tests=1854, Result: PASS`; etapa adicional `Files=1, Tests=10, Result: PASS`.
- Typecheck, lint, build, audit, bundle-budget: success.
- Vercel + e2e-preview: success.
- approval-policy: failure por informe independiente faltante. No debe ser reemplazado con un informe ficticio de aprobación.
- Ejecutable para validar informe tras la ronda: `node docs/revision-pr/analizar.mjs verificacion`.

## Ronda 2 — batería independiente con hijos reales

**SHA leído:** `12c7e9a5fa004e6715a84751b6f9e847b0d9487c`. **Herramienta:** Node v22.16.0 / filesystem temporal real; solo reproducción del helper y orden de llamadas, no Vitest de cadeApp.

La mutación independiente del revisor es distinta de la de agy: **un proceso hijo real** es el que escribe al checkout principal *mientras* se ejecuta `spawnSync`. Se inyecta por cada una de las 4 rutas bajo `os.tmpdir()`, sin modificar `cadeApp`. El control original solo pre-hijo no detecta el cambio; el nuevo control post-hijo sí. Se comprueban buffers originales tras cada intento y se elimina el temporal.

Script íntegro autocontenido, copiable y ejecutable en `/tmp`:

```bash
cat > /tmp/pr304-r2-harness.cjs <<'JS'
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr304-r2-'));
const repoRoot = path.join(root, 'checkout');
const mutationWorktree = path.join(root, 'worktree');
const targets = ['src/features/auth/guards.ts', 'src/features/auth/queries.ts', 'src/features/auth/actions.ts', 'supabase/migrations/20260925170000_cc007_consent_enforcement.sql'];
for (const rel of targets) for(const dir of [repoRoot,mutationWorktree]) {const p = path.join(dir,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'ORIGINAL:'+rel);}
function isInside(parent, candidate) { const relative = path.relative(parent, candidate); return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative); }
function assertMutationIsolated(relativeFilePath, filePath, mainBefore) {
  if (!isInside(mutationWorktree, filePath) || isInside(repoRoot, filePath)) throw new Error(`Isolation broken: mutation of ${relativeFilePath} resolved to ${filePath}, outside the temporary worktree`);
  const mainAfter = fs.readFileSync(path.join(repoRoot, relativeFilePath));
  if (!mainAfter.equals(mainBefore)) throw new Error(`Isolation broken: ${relativeFilePath} changed in the main checkout while mutated`);
}
// Procesos hijos reales: no se emula el momento de la escritura.
function runMutant(rel, checkAfterChild, childWritesCheckout) {
 const filePath = path.join(mutationWorktree, rel), main = path.join(repoRoot, rel);
 const mainBefore = fs.readFileSync(main), original = fs.readFileSync(filePath), mutant = 'MUTATED:'+rel;
 try {
   fs.writeFileSync(filePath, mutant);
   assertMutationIsolated(rel,filePath,mainBefore);
   const program = childWritesCheckout ? `require('node:fs').writeFileSync(process.argv[1],process.argv[2]); process.exit(1)` : `process.exit(1)`;
   const res = spawnSync(process.execPath,['-e',program,main,mutant],{encoding:'utf8'});
   if(checkAfterChild) assertMutationIsolated(rel,filePath,mainBefore);
   return res;
 } finally {fs.writeFileSync(filePath,original);fs.writeFileSync(main,mainBefore);}
}
try {
 for(const rel of targets) {
   const before=fs.readFileSync(path.join(repoRoot,rel));
   assert.equal(runMutant(rel,false,true).status,1);
   assert.throws(()=>runMutant(rel,true,true),/Isolation broken: .*changed in the main checkout while mutated/);
   assert.equal(runMutant(rel,true,false).status,1);
   assert.ok(fs.readFileSync(path.join(repoRoot,rel)).equals(before));
   console.log(`PASS ${rel}: old control misses child checkout write; post-child control detects; normal GREEN; originals restored`);
 }
 console.log('ALL FOUR INDEPENDENT CHILD-WRITE MUTATIONS DETECTED; 4/4; CHECKOUT UNCHANGED');
} finally {fs.rmSync(root,{recursive:true,force:true});}
JS
node /tmp/pr304-r2-harness.cjs
```

Salida real (reproducida dos veces):

```text
PASS src/features/auth/guards.ts: old control misses child checkout write; post-child control detects; normal GREEN; originals restored
PASS src/features/auth/queries.ts: old control misses child checkout write; post-child control detects; normal GREEN; originals restored
PASS src/features/auth/actions.ts: old control misses child checkout write; post-child control detects; normal GREEN; originals restored
PASS supabase/migrations/20260925170000_cc007_consent_enforcement.sql: old control misses child checkout write; post-child control detects; normal GREEN; originals restored
ALL FOUR INDEPENDENT CHILD-WRITE MUTATIONS DETECTED; 4/4; CHECKOUT UNCHANGED
```

**CI inspeccionado:** unit 123/123, 1942/1942 (suite cc007 13). db-tests: Files=19, Tests=1854, Result: PASS (log CI); `e2e-preview` pendiente al realizar la observación. No se ejecutó `node docs/revision-pr/analizar.mjs verificacion` en un clon porque no se pudo clonar; el JSONL de la ronda fue parseado y conservó los campos del esquema. Sin tests falsos, mocks de lógica de producción, branches `if (test)` o cambios al código principal.
