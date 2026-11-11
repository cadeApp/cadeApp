# Evidencia y comandos — PR #686 · SHA 0ed66974

## Fuente y resultado de esta ronda

**Fuente:** GitHub conector, archivos leídos contra `develop@f33acf8a` y `0ed66974`. No hay clon local con dependencias ni PostgreSQL disponible en esta sesión; no se corrieron comandos de proyecto, Docker ni Supabase remotos.

**Control independiente en memoria** sobre el contenido obtenido de GitHub:

```text
GREEN (reconciliación documental)
M1 remover condición de contactos: RED_CONFIRMED
M2 quitar suite CC048 de ficha: RED_CONFIRMED
M3 quitar rls_matrix de ficha: RED_CONFIRMED
M4 cambiar DoD T430: RED_CONFIRMED
M5 quitar using de contrato: RED_CONFIRMED
```

Se comprobaron además los orígenes `t340:288-310`, `rls_v1:331-338`, `cc026:178-192`, `cc047:29-32`, `t340:71-132,643,727,794` y `rls_matrix:282-287`. **Estas mutaciones prueban cobertura del control documental, no seguridad de la migración futura.**

## Harness completo para reproducir en un clon local

Copiar literalmente el siguiente bloque desde la raíz de cadeApp. Lee archivos; no escribe en el repo, no abre red ni requiere Docker. En esta sesión la versión lógica equivalente se ejecutó con textos del conector en memoria. **No se presenta como una ejecución local del script**, porque no existió clon.

```bash
cat > /tmp/pr686-doc-check.cjs <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const d = {
  cc: read('docs/contracts/CC-048.md'),
  task: read('docs/tasks/T-430.md'),
  plan: read('docs/implementation-plan.md'),
  t409: read('docs/tasks/T-409.md'),
  t340: read('supabase/migrations/20261009200000_t340_multi_drop.sql'),
  c026: read('supabase/migrations/20261015084902_cc026_reconcile_expired_requests.sql'),
  rls: read('supabase/tests/rls_matrix.sql'),
  ci: read('.github/workflows/ci.yml')
};
function first(txt) {
  return txt.match(/## DoD\n\n- \[ \] (.*)/)?.[1];
}
function row(txt,id) {
  return txt.split('\n').find(s=>s.startsWith('| '+id+' |'))
    ?.split('|').map(s=>s.trim()).at(-2);
}
function verify(x) {
  assert.equal(row(x.plan,'T-430'), first(x.task), 'T430 DoD/plan');
  assert.equal(row(x.plan,'T-409'), first(x.t409), 'T409 DoD/plan');
  assert.ok(x.task.includes('supabase/tests/cc048_merchant_draft_only.sql'),'cc048 suite');
  assert.ok(x.task.includes('supabase/tests/rls_matrix.sql'),'rls_matrix');
  assert.ok(x.cc.includes("using (merchant_id = auth.uid() and status = 'draft')"),'policy request');
  assert.ok(x.cc.includes("r.status = 'draft'"),'policy contacts');
  assert.ok(x.t340.includes('create trigger trg_lock_draft_drops'),'trigger drops');
  assert.ok(!x.t340.includes('on public.delivery_request_contacts;'),'sin trigger legacy en t340');
  assert.ok(x.rls.includes('merchant can update its own request and trigger set_updated_at'),'caso H07');
  assert.ok(x.ci.includes('node supabase/tests/integration/t340_concurrency.mjs'),'runner CI');
  const columns=x.c026.match(/grant update \(([\s\S]*?)\) on public.delivery_requests to authenticated;/)[1]
    .split(',').map(s=>s.trim()).filter(Boolean);
  assert.equal(columns.length,12,'12 columnas CC026');
  for (const col of columns) {
    assert.ok(x.task.includes('`'+col+'`') || x.task.includes(col),'columna '+col+' en DoD');
  }
}
verify(d); console.log('GREEN: DoD, alcance, policies, 12 grants, H07, runner');
const mutations=[
  ['M1 contacts policy', {cc:d.cc.replace("r.status = 'draft'","r.status = 'published'")}],
  ['M2 missing CC048 suite', {task:d.task.replace('- `supabase/tests/cc048_merchant_draft_only.sql`','')}],
  ['M3 missing rls_matrix', {task:d.task.replace('- `supabase/tests/rls_matrix.sql`','')}],
  ['M4 T430 DoD drift', {task:d.task.replace('- [ ] Fuera de `draft`','- [ ] Fuera de `published`')}],
  ['M5 requests policy', {cc:d.cc.replace("using (merchant_id = auth.uid() and status = 'draft')","using (merchant_id = auth.uid())")}]
];
for (const [label, changed] of mutations) {
  const mutated={...d,...changed};
  assert.ok(Object.keys(changed).some(k=>changed[k]!==d[k]),'sin objetivo '+label);
  assert.throws(()=>verify(mutated),undefined,'mutación indetectada '+label);
  console.log('RED_CONFIRMED: '+label);
}
NODE
node /tmp/pr686-doc-check.cjs
```

**Advertencia del script:** los cambios textuales detectados no prueban cobertura pgTAP ni que la futura RLS filtre todas las intercalaciones. La batería SQL es independiente del autor y debe diseñarse durante la implementación.

## Comandos pendientes para un clon limpio / CI del SHA correspondiente

```bash
# Sobre la base original y la propuesta, sin alterar .env ni tokens:
git diff f33acf8a 0ed66974 -- docs/contracts/CC-048.md docs/tasks/T-430.md docs/implementation-plan.md docs/tasks/log/T-430.md
node /tmp/pr686-doc-check.cjs
pnpm exec vitest run tools
pnpm typecheck && pnpm lint && pnpm test
# No lanzar Docker/Supabase local en esta ronda documental.
# En la implementación, revisar el log db-tests del CI y comparar SHA, Files/Tests/Result.
```

## Prueba multisesión exigida en la implementación

Ampliar `supabase/tests/integration/t340_concurrency.mjs` (el runner ya se llama desde CI en `.github/workflows/ci.yml:197-200,251-262`) con escenarios para `delivery_request_contacts` y `publish_request` en ambos órdenes. Sin sleeps: coordinar por barreras/locks como ya hace el harness. Con permiso `authenticated`, comprobar estado final, 0 modificaciones tras publicación, visibilidad de los datos esperados y ausencia de `40P01`. Mutar solo el trigger añadido en una copia temporal y comprobar RED, restaurar y comprobar GREEN.

## Fuente CI

No se inspeccionó ni certificó el estado de CI de `0ed66974`: hay bloqueantes de documentación abiertos y la instrucción de revisión posterga la inspección de CI hasta una ronda candidata a aprobar.

