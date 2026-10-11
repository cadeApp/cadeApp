# Evidencia reproducible — PR #317 / ronda 1

**SHA revisado:** `cf69ffd6a99d65418894c57868db86d8e28822fe`. **Limitación:** sin Docker/Supabase locales según instrucciones del proyecto. CI `db-tests` se alcanzó a ejecutar hasta la migración y falló; no llegó a ejecutar pgTAP.

## H01 — CI real en rojo, sin inferencias

Job: https://github.com/cadeApp/cadeApp/actions/runs/38090110065/job/114324632186  
`Applying migration 20261009200000_t340_multi_drop.sql...`  
`ERROR: column "is_active" does not exist (SQLSTATE 42703)`  
`At statement: 83` (backfill de `delivery_request_drops`)  
`Process completed with exit code 1`.

La tabla `public.zones` de `20260922031435_schema_v1.sql` tiene `active`, no `is_active`. La suite nueva no llegó a ejecutarse: no asignar estado verde.

## H02–H05 — harness completo de inspección (solo lectura, autocontenido)

Corré con el checkout del SHA observado o del nuevo HEAD. No escribe en el repo; usa copias en memoria. **Este harness detecta defectos estáticos, NO sustituye ejecución pgTAP ni acredita RED→GREEN SQL.**

```bash
node <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const migration = fs.readFileSync('supabase/migrations/20261009200000_t340_multi_drop.sql','utf8');
const test = fs.readFileSync('supabase/tests/t340_multi_drop.sql','utf8');
const lines = test.split(/\r?\n/);
const assertions = lines.filter(x => /^\s*select\s+(has_table|has_column|throws_matching|is\(|ok\(|has_function|pass\(|lives_ok)/.test(x));
const dummy = assertions.filter(x => /^\s*select\s+pass\(/.test(x));
const plan = Number(test.match(/select plan\((\d+)\)/)?.[1]);
console.log({plan, assertions:assertions.length, dummy:dummy.length});
const checks = {
  'H01 columna inexistente en migración': /where is_active limit 1/.test(migration),
  'H02 consentimiento inventado': /coalesce\(c\.recipient_consent_declared,\s*true\)/.test(migration),
  'H02 datos personales inventados': /'Sin dirección'|'Sin nombre'|'\+543865000000'/.test(migration),
  'H03 tests pasivos': dummy.length > 0,
  'H04 plan incorrecto': plan !== assertions.length,
  'H04 zona inexistente en fixture': /insert into public\.zones\s*\(id, name, code, is_active, polygon\)/.test(test),
  'H04 request sin pickup zone': /insert into public\.delivery_requests\s*\(id, merchant_id, status\)/.test(test),
  'H05 get_trip_details redefinido en etapa 1': /create or replace function public\.get_trip_details\(/.test(migration)
};
for (const [name, broken] of Object.entries(checks)) console.log((broken ? 'BLOQUEANTE' : 'OK')+' | '+name);
assert.equal(plan,38);
assert.equal(assertions.length,39);
assert.equal(dummy.length,22);
assert(Object.values(checks).every(Boolean));
// Prueba del detector mismo: mutación EN MEMORIA para asegurar que alerta desaparezca cuando se corrige.
const cleanTest=test.replace(/^\s*select pass\([^\n]*\);?\s*$/gm,'').replace('select plan(38)','select plan(17)');
assert.equal(cleanTest.split(/\r?\n/).filter(x => /^\s*select\s+pass\(/.test(x)).length,0);
console.log('Detector: baseline observado y mutación negativa en memoria reproducibles.');
NODE
```

> El `plan(38)` original contabiliza 39 aserciones (17 no triviales + 22 `pass`). El test de `app_private.lock_draft_request_for_child_write` debe ejecutarse realmente como cliente `authenticated`, no como dueño del runner.

## Casos de integración necesarios para la siguiente ronda (no ejecutados por esta revisión)

- Verificar CI DB desde cero sobre **SHA nuevo**, inspeccionando `Files=`, `Tests=`, `Result:`, pasos `db --local` y `git diff --exit-code`.
- Migración: backfill repetido no crea duplicados, no inventa destinatario/consentimiento, datos legacy originales permanecen, esquema anterior sigue exponiendo las notas y cambio al lector viejo.
- Trigger: como authenticated dueño/no dueño, insert/update/delete en `draft` y `published`, update contactos, y serialización con publicación desde **sesiones concurrentes reales**.
- Pago: cash+cambio+monto positivo; cash+cambio+NULL; cash sin cambio+NULL; cash sin cambio+monto; transfer/to_agree+cambio; transfer/to_agree sin cambio+NULL; escrituras directas que eludan UI.
- Seguridad: antes de match no leer `drop_contacts`; después de match aceptado sí; actor ajeno nunca; columnas status/fecha/razón solo desde RPC; `drops_count` readable por `authenticated`.
- Antifraude de test: aplicar mutaciones nuevas **independientes del autor** en copia de trabajo descartable (por ejemplo quitar condición `needs_change`, eliminar check de rol, quitar guard de `draft`) y comprobar que la **misma suite** queda roja en lugar de sustituir la aserción. No hacer esto contra la base remota.

## Verificación posterior sugerida

```bash
git fetch origin
git status --short
git diff origin/develop...HEAD --stat
node docs/revision-pr/analizar.mjs verificacion
pnpm typecheck && pnpm lint && pnpm test
# pgTAP solo por job db-tests de CI; sin Docker/Supabase local
```

La rama estaba **detrás de develop por 2 commits** según la comparación de GitHub (merge-base `8ebd5e21`) al consultar la ronda; pedir integración no destructiva de `origin/develop` únicamente después de completar correcciones y sin rebase/force/amend.

## Ronda 2 — inspección independiente, SHA 5bba8319

**CI de base comprobado:** https://github.com/cadeApp/cadeApp/actions/runs/38098236439/job/114348546731. La migración T340 aplica sin error; bootstrap `Files=1, Tests=10, Result: PASS`; pgTAP `Files=21, Tests=1943, Result: PASS`, incluye `t340_multi_drop.sql ... ok`. La suite tiene 40 aserciones y no hay `select pass()`. `approval-policy` permanece rojo.

### H06 — detector de regresión SECURITY DEFINER

Este harness es independiente del autor. Corrélo desde la raíz del checkout del SHA revisado; trabaja solo en memoria, no modifica archivos:

```bash
node <<'NODE'
const fs=require('node:fs');
const m=fs.readFileSync('supabase/migrations/20261009200000_t340_multi_drop.sql','utf8');
const fn=m.match(/create or replace function app_private\.lock_draft_request_for_child_write\(\)[\s\S]*?\n\$\$;/)?.[0] || '';
function accepts(s){ return /security invoker/i.test(s) && /if current_user in \('authenticated', 'anon'\)/i.test(s) && /for update;/i.test(s); }
const mutated=fn.replace(/security definer/i,'security invoker');
console.log('BASE guard protegido:', accepts(fn));
console.log('CONTROL mutado en memoria:', accepts(mutated));
if(accepts(fn) || !accepts(mutated))process.exitCode=1;
NODE
```

**Salida de la revisión:** BASE `false` (RED); mutación que restituye `SECURITY INVOKER` `true` (GREEN). Es verificación estática, NO una carrera ejecutada. El hecho subyacente es semántica estándar de PostgreSQL: dentro de SECURITY DEFINER `current_user` es el dueño de la función, no el cliente authenticated.

### H07 — detectores de pruebas autofabricadas

```bash
node <<'NODE'
const fs=require('node:fs');
const s=fs.readFileSync('supabase/tests/t340_multi_drop.sql','utf8');
const names=['test_backfill_incomplete_draft','test_backfill_inconsistent_nondraft','test_backfill_repeated_no_duplicates'];
for (const name of names){
 const start=s.indexOf('create function pg_temp.'+name+'()');
 const end=s.indexOf('\n$$;',start);
 const body=s.slice(start,end);
 const manuallyInserts=/insert into public\.(delivery_requests|audit_log|delivery_request_drops)/.test(body);
 const callsBackfill=/app_private\.t340_backfill_legacy|pg_temp\.run_productive_backfill/.test(body);
 console.log(name, {manuallyInserts,callsBackfill});
}
const plan=Number(s.match(/select plan\((\d+)\)/)?.[1]);
const count=s.split(/\r?\n/).filter(x=>/^\s*select\s+(has_table|has_column|throws_matching|is\(|ok\(|has_function|lives_ok)/.test(x)).length;
console.log({plan,count,pass:(s.match(/select\s+pass\(/g)||[]).length});
NODE
```

**Observado:** tres casos siembran explícitamente resultados o datos y ninguno invoca el código de backfill; `plan=40`, `count=40`, `pass=0`. Esto comprueba estructura, no demuestra que una mutación productiva corrió contra Postgres. **Mutación RED pendiente para el autor:** deshabilitar el backfill en una copia aislada, correr su prueba real por CI y ver que falla específicamente la aserción.

### H08 — concurrencia ausente

El test inspeccionado tiene actores y consultas secuenciales (`supabase/tests/t340_multi_drop.sql:138-236`). No abre dos conexiones para ejecutar `publish_request` contra `insert/update/delete` de drops y `update` de contactos. **Prueba necesaria:** dos sesiones/locks, verificación de la versión efectivamente publicada; mutar a SECURITY DEFINER o quitar bloqueo y comprobar RED.

### H09 — casos lógicos que la auditoría no cubre

El filtro de `legacy_migration_inconsistent` solo verifica los campos obligatorios/consentimiento. El filtro del `insert` además requiere una combinación válida de medio de pago y `needs_change` con `cash_change_amount`. Para valores completos: `transfer + needs_change=true` y `cash + needs_change=true + cash_change_amount=NULL`, ninguno queda materializado y ninguno queda auditado. El CI existente carece de fixture que verifique ambos filtros en la misma ejecución de backfill.

### Alcance

Solo se usaron la lectura del SHA exacto, los resultados reales de CI y comprobaciones estructurales en memoria. No se levantó Supabase/Docker local, no se modificaron tests/implementación y no se simuló un run de concurrencia. Las mutaciones funcionales de DB quedan explícitamente **pendientes**.

## Ronda 3 — SHA de código `5e2a62c659efe1d5e8e41656a9c10c9137cdd920`

### CI exact-HEAD observado

Run: https://github.com/cadeApp/cadeApp/actions/runs/38105044929 · DB job: https://github.com/cadeApp/cadeApp/actions/runs/38105044929/job/114368652412

En los logs del job `db-tests` de ese commit:
- La migración `20261009200000_t340_multi_drop.sql` se aplicó correctamente.
- Bootstrap: `Files=1, Tests=10, Result: PASS`.
- `t340_multi_drop.sql ... ok`, total `Files=21, Tests=1951, Result: PASS`.
- Regeneración de tipos `pnpm db:types --local`, sin diferencia reportada.
- Otros jobs CI `typecheck`, `lint`, `unit`, `build`, `audit` y `bundle-budget`: GREEN. `approval-policy`: FAIL (informe pendiente).
No se ejecutó Docker/Supabase local ni un ensayo de dos sesiones desde esta revisión.

### Harness independiente — baseline + mutaciones negativas EN MEMORIA

Copiar TODO el código siguiente a `/tmp/pr317-r3-guards.cjs` y ejecutar desde un worktree limpio del SHA examinado: `node /tmp/pr317-r3-guards.cjs`. **No escribe ni altera archivos**.

```javascript
const fs = require('node:fs');
const assert = require('node:assert/strict');

const migration = fs.readFileSync('supabase/migrations/20261009200000_t340_multi_drop.sql', 'utf8');
const tests = fs.readFileSync('supabase/tests/t340_multi_drop.sql', 'utf8');
const guard = migration.match(/create or replace function app_private\.lock_draft_request_for_child_write\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? '';
const backfill = migration.match(/create or replace function app_private\.t340_backfill_legacy\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? '';
assert.ok(guard && backfill, 'Sin objetivo; no se puede confiar en el detector');

const inspect = (s) => ({
  invoker: /security invoker/i.test(s),
  lock: /select status, merchant_id into v_req_status, v_req_merchant_id[\s\S]*?for update;/i.test(s),
});
const validGuard = (s) => Object.values(inspect(s)).every(Boolean);
assert.equal(validGuard(guard), true, 'Baseline H06 no está verde');
assert.equal(validGuard(guard.replace(/security invoker/i, 'security definer')), false, 'M01 no mata SECURITY DEFINER');
assert.equal(validGuard(guard.replace(/for update;/i, ';')), false, 'M02 no mata quitar el lock');

const backfillTestNames = [
  'test_backfill_incomplete_draft',
  'test_backfill_inconsistent_nondraft',
  'test_backfill_repeated_no_duplicates',
];
const getCase = (s, name) => {
  const start = s.indexOf('create function pg_temp.' + name + '()');
  assert.ok(start >= 0, 'Sin objetivo ' + name);
  return s.slice(start, s.indexOf('\n$$;', start) + 4);
};
const performsProductive = (s) =>
  backfillTestNames.every(name => getCase(s,name).includes('perform app_private.t340_backfill_legacy();'));
assert.ok(migration.includes('select app_private.t340_backfill_legacy();'), 'Migración no invoca helper');
assert.ok(performsProductive(tests), 'Alguna prueba no usa helper productivo');
const mutatedCases = tests.replaceAll('perform app_private.t340_backfill_legacy();','perform 1;');
assert.equal(performsProductive(mutatedCases), false, 'M03 no mata omitir llamadas al helper');

const actualPaymentFilter = (r) =>
  (r.method === 'cash' || r.needs_change === false) &&
  (r.method !== 'cash' || !r.needs_change || (r.amount !== null && r.amount > 0));
const cases = [
  {name:'transfer + needs_change true',method:'transfer',needs_change:true,amount:null},
  {name:'cash + needs_change true + monto NULL',method:'cash',needs_change:true,amount:null}
];
const expectedFromCC022 = cases.map(x => ({
  original:x.name, materialize:true,
  needs_change:x.method==='cash' && x.needs_change,
  cash_change_amount:x.method==='cash' ? x.amount : null
}));
assert.ok(backfill.includes("and (r.recipient_payment_method = 'cash' or r.needs_change = false)"), 'Sin objetivo filtro de transfer');
assert.ok(backfill.includes("or (r.cash_change_amount is not null and r.cash_change_amount > 0)"), 'Sin objetivo filtro de cash');
for(const x of cases) assert.equal(actualPaymentFilter(x),false,'Baseline H10 no reproduce omisión: '+x.name);
console.log('H10 current skips',cases.map(x=>x.name),'while CC-022 §5b requires normalization',expectedFromCC022);

const auditLeaks = (s) => /'cash_change_amount'\s*,\s*r\.cash_change_amount/.test(s);
assert.equal(auditLeaks(backfill),true,'Sin objetivo: valor confidencial en audit_log');
const auditWithoutAmount = backfill.replace(/'cash_change_amount'\s*,\s*r\.cash_change_amount\s*,?/,'');
assert.equal(auditLeaks(auditWithoutAmount),false,'M04 no detecta retirar monto de log');

const forgesDeliveredAt = (s) => /coalesce\(r\.delivered_at,\s*r\.updated_at,\s*r\.created_at\)/.test(s);
assert.equal(forgesDeliveredAt(backfill),true,'Sin objetivo: fallback de delivered_at');
const withoutForgery = backfill.replace(/coalesce\(r\.delivered_at,\s*r\.updated_at,\s*r\.created_at\)/,'r.delivered_at');
assert.equal(forgesDeliveredAt(withoutForgery),false,'M05 no detecta quitar fallback');

const plan = Number(tests.match(/select plan\((\d+)\)/)?.[1]);
const assertions = tests.split(/\r?\n/).filter(l=>/^\s*select\s+(has_table|has_column|throws_matching|is\(|ok\(|has_function|lives_ok)/.test(l)).length;
assert.equal(plan,48); assert.equal(assertions,48); assert.equal((tests.match(/select\s+pass\(/g)||[]).length,0);
const concurrent = /dblink_connect|pg_background|\\connect|psql\s+.*-c|two.?session/i.test(tests);
assert.equal(concurrent,false,'Revisar: se detecta posible instrumento de dos sesiones; inspeccionar');
console.log('H06 baseline GREEN; M01/M02 RED');
console.log('H07 baseline GREEN; M03 RED');
console.log('H11 valor sensible en audit_log detectado; M04 lo elimina');
console.log('H12 fecha synthetic detectada; M05 lo elimina');
console.log('H08 sin herramienta de sesiones concurrentes en este archivo');
console.log({plan,assertions,pass:0});
```

**Método y limitación:** estos son detectores estructurales ejecutables; las mutaciones son sobre cadenas **en memoria**. No se confunden con pruebas RED→GREEN de integración real en Postgres. En la revisión independiente se comprobó contra los blobs exactos de GitHub que: H06 invoker y lock verdaderos, H07 las tres pruebas llaman al helper, H08 no tiene instrumento de dos sesiones, H10 ambos tipos se excluyen por los predicados, H11 el monto aparece en `audit_log.before`, H12 el fallback de timestamp fabrica un valor a partir de `updated_at/created_at`.

### Matriz RED→GREEN obligatoria para próxima ronda

1. **H08:** tests reales con dos transacciones intercaladas contra `publish_request` para `INSERT`, `UPDATE`, `DELETE` de drop y `UPDATE` de contactos. Mutación productiva: quitar `FOR UPDATE` o reemplazar `SECURITY INVOKER` por `SECURITY DEFINER`; **la batería de concurrencia tiene que fallar**.
2. **H10:** sembrar dos históricos con todos los datos y consentimiento: `transfer + needs_change=true`, `cash + needs_change=true + amount NULL`. Tras invocar helper, ambos **deben tener exactamente un drop**, con los valores normalizados exigidos por CC-022. Mutación: reponer filtros excluyentes originales; pruebas RED.
3. **H11:** histórico incompleto con monto exacto de cambio no nulo y sin drop; ejecutar helper. `audit_log.before` no debe contener `cash_change_amount` ni otro dato personal; mutación: reintroducir ese campo; RED.
4. **H12:** histórico `delivered` con `delivered_at=NULL`; nunca asignar `created_at` ni `updated_at` como si fueran `delivered_at`. Probar que se preserva y reporta su inconsistencia (sin inventar fecha). Mutación: restituir `coalesce`; RED.

El verificador `node docs/revision-pr/analizar.mjs verificacion` deberá ejecutarse en un clon del repositorio; no se declara ejecutado desde el conector de GitHub.
