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


## Ronda 2 — control documental independiente sobre a91e8e40

Fuente: GitHub conector, archivos a91e8e40 y bases f33acf8a. **Control ejecutado en memoria:** GREEN para el contrato actual, con las siete mutaciones siguientes detectadas como RED:
1. Quitar fallback `SELECT status, merchant_id`.
2. Quitar `status='draft'` de la policy de solicitudes.
3. Omitir `40P01` en la ficha.
4. Omitir fijar `updated_at` de H07.
5. Alterar la expectativa de UPDATE fuera de draft de «0 filas» a «excepción».
6. Borrar la referencia al runner `t340_concurrency.mjs`.
7. Desincronizar la primera línea del DoD T-430 respecto a la fila del plan.

Resultado separado, **no verde**: la secuencia de deadlock de H03 es posible por inspección y el contrato NO especifica un test con cero drops para el camino legacy. PostgreSQL no fue ejecutado.

### Harness completo para copiar a /tmp (lectura y mutaciones solo en memoria)

Desde la raíz de un clon en el SHA a91e8e40, copiarlo a `/tmp/pr686-r2-check.cjs` y ejecutar `node /tmp/pr686-r2-check.cjs`. No modifica archivos ni toca Supabase remoto. La lógica equivalente fue ejecutada por el revisor en memoria con archivos recuperados de GitHub; la ejecución del archivo copiado a /tmp en un clon real queda pendiente (no hay clon local en este entorno).

```javascript
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const files={
 cc:read('docs/contracts/CC-048.md'),
 task:read('docs/tasks/T-430.md'),
 plan:read('docs/implementation-plan.md'),
 t409:read('docs/tasks/T-409.md'),
 migration:read('supabase/migrations/20261009200000_t340_multi_drop.sql'),
 cc023:read('supabase/migrations/20261006180000_t345_cc023_private_columns.sql'),
 runner:read('supabase/tests/integration/t340_concurrency.mjs')
};
function validate(x){
 const row=id=>x.plan.split('\n').find(s=>s.startsWith('| '+id+' |'))?.split('|').map(s=>s.trim()).at(-2);
 const first=txt=>txt.match(/## DoD\n\n- \[[ x]\] (.*)/)?.[1];
 assert.equal(row('T-409'),first(x.t409),'plan/ficha T-409');
 assert.equal(row('T-430'),first(x.task),'plan/ficha T-430');
 assert.ok(x.cc.includes('select status, merchant_id')&&x.cc.includes('sin lock'),'fallback');
 assert.ok(x.cc023.includes('merchant_id,')&&x.cc023.includes('status,'),'grants de lectura');
 assert.ok(x.task.includes('supabase/tests/integration/t340_concurrency.mjs'),'suite integración');
 assert.ok(x.task.includes('pg_blocking_pids')&&x.task.includes('40P01'),'espera/ausencia de deadlock');
 assert.ok(x.task.includes('updated_at` fijado')&&x.task.includes('1 fila'),'H07 robusto');
 assert.ok(x.task.includes('update fuera de `draft` → sin excepción y 0 filas'),'M01');
 assert.ok(x.cc.includes("r.status = 'draft'"),'policy contactos');
 assert.ok(x.cc.includes("using (merchant_id = auth.uid() and status = 'draft')"),'policy solicitudes');
}
validate(files); console.log('GREEN: documento, fallback, permisos, DoD');
const mutations=[
 ['sin fallback','cc',x=>x.replace('select status, merchant_id','select merchant_id')],
 ['sin status draft','cc',x=>x.replace("using (merchant_id = auth.uid() and status = 'draft')","using (merchant_id = auth.uid())")],
 ['sin 40P01','task',x=>x.replace('40P01','40PXX')],
 ['H07 timestamp no controlado','task',x=>x.replace('updated_at` fijado','updated_at` omitido')],
 ['UPDATE fuera de draft falso','task',x=>x.replace('update fuera de `draft` → sin excepción y 0 filas','update fuera de `draft` → con excepción y 0 filas')],
 ['sin integración','task',x=>x.replace('supabase/tests/integration/t340_concurrency.mjs','sin_sesion')],
 ['DoD plan desincronizado','task',x=>x.replace('Fuera de `draft`, un update','Fuera de `published`, un update')]
];
for(const [id,key,mutate] of mutations){
 const alt=mutate(files[key]);
 assert.notEqual(alt,files[key],'mutación sin objetivo '+id);
 assert.throws(()=>validate({...files,[key]:alt}),undefined,'mutación no detectada '+id);
 console.log('RED_CONFIRMED: '+id);
}
const legacy=files.migration.includes('if v_drops_count = 0 then') &&
 files.migration.includes('select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for update;');
const newTrigger=files.cc.includes('trg_lock_draft_contacts before insert or update');
assert.ok(legacy&&newTrigger,'rutas del posible deadlock');
const after=files.cc.split('## Concurrencia e idempotencia')[1]||'';
const exact=/((escenario|fixture|prueba|test|caso)[^\n]{0,125}(0 drops|cero drops|sin drops)|legacy[^\n]{0,125}(0 drops|cero drops|sin drops))/i.test(after);
console.log(exact?'LEGACY_CASE_DECLARED':'H03: NO EXPLICIT LEGACY ZERO-DROP SCENARIO');
```

### Reproducción SQL requerida para H03 — no ejecutada

Sobre una base efímera de CI, con request `draft` de cero drops y contacto completo:
1. B: `BEGIN; SELECT id FROM public.delivery_requests WHERE id=:req FOR UPDATE;` (parent lock).
2. A: `BEGIN; SET LOCAL ROLE authenticated; ...; UPDATE public.delivery_request_contacts SET dropoff_address='cambio' WHERE request_id=:req;`; confirmar con `pg_blocking_pids` que A espera a B **después de adquirir lock de hijo**, si ocurre.
3. B: ejecutar `public.publish_request(:req)` (el flujo legacy adquiere `FOR UPDATE` de contacto). Observar espera mutua, `40P01`, timeout o resultado. No usar sleeps: sincronizar con marcadores/barreras como el runner T-340.
4. Una vez corregido el diseño, exigir publicación consistente y ausencia de `40P01`, y repetir con el orden inverso.
5. Mutación independiente de mecanismo de lock en copia efímera: quitar sólo el prelock de padre de la policy de contactos, y comprobar RED en el caso adverso; restaurar GREEN.

La intercalación es análisis de código, no afirmación de haberla ejecutado.

### Conflicto con develop

En esta ronda GitHub devolvió `mergeable_state='dirty'`; develop `af023d3` agrega T-431 y también actualiza T-409 en el plan, mientras la rama agrega T-430. Pedir merge de develop a feat sin rebase, conservar las tres filas y verificar `tools/verify-fichas.test.ts` + merge-tree.
