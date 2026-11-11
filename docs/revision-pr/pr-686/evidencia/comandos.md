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

## Ronda 3 — evidencia de H04 y de cobertura documental en c777bf3a

**Fuentes inmutables:** GitHub connector `c777bf3a` para contrato/ficha/plan y `af023d3` para base de T-409/T-431, esquema, `request_cycle` y runner. **Ejecutado por el revisor en memoria:** baseline GREEN y **12 mutaciones propias RED**; la primera versión interna de la batería tenía detecciones débiles y se descartó, las 12 de esta versión fueron verificadas y ninguna quedó verde. **Comprobación de sintaxis adicional:** `node --check /mnt/data/pr686-r3-check.cjs` → «Syntax check OK» (script generado en entorno local; no es clon del repo). Por no haber clon local no se ejecutó sobre el árbol de GitHub con `node`. No PostgreSQL/Docker ni tests DB.

**Control por casos:** si `delivery_request_contacts.request_id` ya existe → segundo INSERT no es válido por PK; si no existe → `publish_request` con cero drops no publica por `MISSING_REQUIRED_FIELDS`. Esta contradicción está demostrada por el esquema y código fuente, no es una hipótesis de lock. La mutación necesaria para asegurar que el test cubre la propiedad sería eliminar solo la guarda de INSERT en una migración temporal; la expectativa no debe pasar únicamente por PK, otra policy o mensaje genérico.

### Harness completo para copiar a /tmp y ejecutar desde un clon en c777bf3a

Crear `/tmp/pr686-r3-check.cjs` con el contenido siguiente. Ejecutar desde la **raíz del repo** en SHA `c777bf3a`: `node /tmp/pr686-r3-check.cjs`. Es de solo lectura y no necesita DB. El código del harness fue comprobado sintácticamente; su ejecución en clon no pudo repetirse en esta sesión. Si el contrato se corrige después de la ronda, cambiarán los marcadores; fijar el SHA para esta evidencia.

~~~javascript
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const base = {
  cc: read('docs/contracts/CC-048.md'),
  task: read('docs/tasks/T-430.md'),
  plan: read('docs/implementation-plan.md'),
  t409: read('docs/tasks/T-409.md'),
  t431: read('docs/tasks/T-431.md'),
  schema: read('supabase/migrations/20260922031435_schema_v1.sql'),
  cycle: read('supabase/migrations/20261009200000_t340_multi_drop.sql'),
  runner: read('supabase/tests/integration/t340_concurrency.mjs'),
};
const need = (condition, name) => assert.ok(condition, name);
function validate(x) {
  const row = id => x.plan.split('\n').find(s => s.startsWith('| ' + id + ' |'))?.split('|').map(s => s.trim()).at(-2);
  const first = s => s.match(/## DoD\n\n- \[[ x]\] (.*)/)?.[1];
  for (const [id, key] of [['T-409', 't409'], ['T-430', 'task'], ['T-431', 't431']]) {
    assert.equal(row(id), first(x[key]), 'DoD versus plan ' + id);
  }
  need(x.cc.includes('before insert on public.delivery_request_contacts') &&
      !x.cc.includes('before insert or update on public.delivery_request_contacts'), 'trigger only INSERT');
  need(x.cc.includes('for update of r'), 'parent FOR UPDATE in policy USING');
  need(x.cc.includes('returns boolean') && x.cc.includes('security invoker'), 'optional helper');
  need(x.cc.includes('select status, merchant_id') && x.cc.includes('sin lock'), 'fallback');
  need(x.cc.includes('todas con una **solicitud legacy de 0 drops**'), '0 drops fixture');
  need(x.cc.includes('pg_blocking_pids') && x.cc.includes('40P01'), 'waiting and no deadlock');
  need(x.task.includes('sin el lock de la solicitud') && x.task.includes('update adverso de H03'), 'H03 RED mutation');
  need(x.task.includes('`updated_at` fijado') && x.task.includes('1 fila'), 'H07 real UPDATE');
  need(x.cc.includes('supabase/tests/t340_multi_drop.sql:175'), 'M03 exact test path');
  need(x.cc.includes('un UPDATE concurrente queda esperando'), 'M04');
}
validate(base); console.log('GREEN: control documental sobre archivos de c777bf3a');
const mutations = [
  ['trigger UPDATE again', 'cc', s => s.replace('before insert on public.delivery_request_contacts', 'before insert or update on public.delivery_request_contacts')],
  ['parent lock removed', 'cc', s => s.replaceAll('for update of r', 'for share of r')],
  ['helper changed', 'cc', s => s.replace('returns boolean', 'returns void')],
  ['0 drops gone', 'cc', s => s.replace('todas con una **solicitud legacy de 0 drops**', 'todas con varios drops')],
  ['blocking PID removed', 'cc', s => s.replaceAll('pg_blocking_pids', 'pg_sleep')],
  ['40P01 removed', 'cc', s => s.replaceAll('40P01', 'ZZZ01')],
  ['H07 updated_at not controlled', 'task', s => s.replace('`updated_at` fijado', '`updated_at` sin controlar')],
  ['H03 mutation removed', 'task', s => s.replace('sin el lock de la solicitud', 'con el lock de la solicitud')],
  ['M03 back to ambiguous path', 'cc', s => s.replaceAll('supabase/tests/t340_multi_drop.sql:175', 't340_multi_drop.sql:175')],
  ['M04 removed', 'cc', s => s.replace('un UPDATE concurrente queda esperando', 'un UPDATE concurrente ignora el lock')],
  ['T430 DoD diverged', 'task', s => s.replace('Fuera de `draft`, un update', 'Fuera de `published`, un update')],
  ['T431 row deleted', 'plan', s => s.split('\n').filter(v => !v.startsWith('| T-431 |')).join('\n')],
];
for (const [name, key, change] of mutations) {
  const changed = change(base[key]);
  assert.notEqual(changed, base[key], 'mutation without target: ' + name);
  assert.throws(() => validate({ ...base, [key]: changed }), undefined, 'unexpected GREEN for ' + name);
  console.log('RED_CONFIRMED: ' + name);
}
const proof = {
  pk: base.schema.includes('request_id uuid primary key'),
  zeroDrops: base.cycle.includes('if v_drops_count = 0 then'),
  lockedRead: base.cycle.includes('select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for update;'),
  required: base.cycle.includes('if not found or not v_contacts.recipient_consent_declared') && base.cycle.includes("raise exception 'MISSING_REQUIRED_FIELDS'"),
  bothInsertOrders: base.cc.includes('**insert:** los dos órdenes'),
  sameCompleteFixture: base.cc.includes('todas con una **solicitud legacy de 0 drops**') && base.cc.includes('y contacto completo'),
  existingRunnerCreatesContact: base.runner.includes('function createDraftFixture(initialDrops = 1)') && base.runner.includes('insert into public.delivery_request_contacts'),
};
for (const [k, v] of Object.entries(proof)) need(v, 'missing H04 evidence: ' + k);
console.log('H04_CONTRADICTION: no contact => publish_request missing required fields; existing contact => second INSERT violates PK. Cannot test both as valid races with a single legacy fixture.');
console.log('LIMIT: structural/documentary only, not PostgreSQL executed.');

~~~

**Resumen de la batería que se ejecutó en memoria con el texto exacto recuperado:** baseline GREEN; RED confirmado al: (1) reintroducir trigger BEFORE UPDATE, (2) cambiar FOR UPDATE OF r a FOR SHARE, (3) alterar helper, (4) borrar 0 drops, (5) borrar pg_blocking_pids, (6) borrar 40P01, (7) omitir timestamp controlado H07, (8) quitar mutación de H03, (9) revertir cita M03, (10) eliminar distinción M04, (11) desincronizar primer DoD T-430, (12) borrar T-431 del plan. **Resultado separado:** H04 detectado por la comprobación de precondiciones/PK y comportamiento del puente legacy.

**Alcance prohibido / no visto:** no se corrió ni se afirma `pnpm exec vitest run tools`, `test:db`, `pgTAP`, CI ni prueba concurrencia real. El autor declaró Vitest 123/123 y diff --check limpio; no se adopta como evidencia independiente.

