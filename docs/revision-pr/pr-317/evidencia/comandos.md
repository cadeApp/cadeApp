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

## Ronda 4 — SHA exacto `d2b3285ab837c8a18a3ad2171a08a3668aafdc5c`

**CI run:** https://github.com/cadeApp/cadeApp/actions/runs/38149501869  
**DB job:** https://github.com/cadeApp/cadeApp/actions/runs/38149501869/job/114499806753

Se leyó el log interno del job: `t340_multi_drop.sql ............... ok`; bootstrap `Files=1, Tests=10, Result: PASS`; suite DB `Files=21, Tests=1955, Result: PASS`; `pnpm db:types --local` se ejecutó, sin drift. `unit, lint, typecheck, build, audit, bundle-budget` PASS; `approval-policy` FAIL y Supabase Preview SKIPPED. Hubo respuestas de Docker Hub `toomanyrequests` durante el arranque, pero el job terminó en PASS.

### Harness del revisor — comprobaciones y mutaciones EN MEMORIA

Ejecución reproducible en un checkout limpio del SHA revisado. Guardar este código entero en `/tmp/pr317_r4_verify.cjs`; ejecutar `node /tmp/pr317_r4_verify.cjs` desde la raíz del repo. Lee solo dos fuentes, no las modifica:

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const migration=fs.readFileSync('supabase/migrations/20261009200000_t340_multi_drop.sql','utf8');
const tests=fs.readFileSync('supabase/tests/t340_multi_drop.sql','utf8');
const idx=migration.indexOf('create or replace function app_private.t340_backfill_legacy()');
assert(idx>=0,'Sin objetivo: falta helper backfill');
const b=migration.slice(idx);
const guardStart=migration.indexOf('create or replace function app_private.lock_draft_request_for_child_write()');
assert(guardStart>=0,'Sin objetivo: falta trigger guard');
const guard=migration.slice(guardStart,migration.indexOf('drop trigger if exists trg_lock_draft_drops',guardStart));
function h10(s){
 return /case when r\.recipient_payment_method = 'cash' then r\.needs_change else false end/.test(s)
   && !/and \(r\.recipient_payment_method = 'cash' or r\.needs_change = false\)/.test(s);
}
function h11(s){return /has_cash_change_amount/.test(s) && !/'cash_change_amount'\s*,\s*r\.cash_change_amount/.test(s);}
function h12(s){return /case when r\.status = 'delivered' then r\.delivered_at else null end/.test(s)
 && /r\.status <> 'delivered' or r\.delivered_at is not null/.test(s);}
function h06(s){return /security invoker/i.test(s) && /for update;/.test(s);}
assert(h10(b),'H10 baseline falló');assert(h11(b),'H11 baseline falló');assert(h12(b),'H12 baseline falló');
assert(h06(guard),'H06 baseline falló');
const m10=b.replace("case when r.recipient_payment_method = 'cash' then r.needs_change else false end","r.needs_change");
const m11=b.replace("'has_cash_change_amount', (r.cash_change_amount is not null)","'cash_change_amount', r.cash_change_amount");
const m12=b.replace("case when r.status = 'delivered' then r.delivered_at else null end","case when r.status = 'delivered' then coalesce(r.delivered_at,r.updated_at,r.created_at) else null end");
assert(!h10(m10),'Mutación H10 sobrevivió');assert(!h11(m11),'Mutación H11 sobrevivió');
assert(!h12(m12),'Mutación H12 sobrevivió');
assert(!h06(guard.replace('security invoker','security definer')),'Mutación H06 sobrevivió');
const funcs=['mark_drop_delivered','mark_drop_failed'];
for(const name of funcs){
 assert(migration.includes('create or replace function public.'+name+'('),'Sin definición de '+name);
 const refs=tests.split(/\r?\n/).filter(l=>l.includes(name));
 assert.equal(refs.length,2,'Revisar nuevas referencias a '+name);
 assert(refs.some(l=>l.includes('has_function')),'Sin test de firma '+name);
 assert(!tests.includes('perform public.'+name+'(') && !tests.includes('select public.'+name+'('),
    'Hay nueva cobertura funcional; reauditar H13');
}
const plan=Number(tests.match(/select plan\((\d+)\)/)?.[1]);
const counted=tests.split(/\r?\n/).filter(l=>/^\s*select\s+(has_table|has_column|throws_matching|is\(|ok\(|has_function|lives_ok)/.test(l)).length;
assert.equal(plan,52);assert.equal(counted,52);
assert.equal((tests.match(/select\s+pass\(/g)||[]).length,0);
console.log('H06/H10/H11/H12 baseline estructural GREEN; mutaciones M06/M10/M11/M12 RED');
console.log('H13: RPC presentes; ninguna llamada funcional en suite T340');
console.log({plan,counted,dummies:0});
```

**Observado por la revisión independiente mediante lectura exacta de GitHub y evaluación de las mismas condiciones de control:** H06/H10/H11/H12 condición productiva actual presente y regresiones introducidas en memoria detectables. **No se ejecutó Postgres mutado**; esas mutaciones no constituyen una demostración RED→GREEN de pgTAP. El CI real ejecutó los tests sin mutar y estuvo verde.

### H08 — ausencia de concurrencia real

Toda `supabase/tests/t340_multi_drop.sql` se ejecuta bajo `BEGIN ... ROLLBACK` y usa un rol por vez con `set local role`. No existe orquestación de 2 conexiones para `publish_request` vs acciones de hijos; `pg_proc.prosecdef` y búsqueda de `FOR UPDATE` son comprobaciones útiles pero insuficientes para demostrar serialización. La bitácora del autor indica expresamente que queda pendiente H08. La sección `db-tests` en `.github/workflows/ci.yml:90–194` arranca Postgres local en CI y dispone de `docker exec ... psql` para usar DOS sesiones con un runner de pruebas sin tocar base remota.

### H13 — oráculos de RPC faltantes

Fuente nueva `supabase/migrations/20261009200000_t340_multi_drop.sql:949–1230`: dos RPC públicas `SECURITY DEFINER` `mark_drop_delivered(uuid)` y `mark_drop_failed(uuid,text)`, ambas con `GRANT EXECUTE ... TO authenticated`. Test actual `supabase/tests/t340_multi_drop.sql:620–622`:
```sql
select has_function('public','mark_drop_delivered',ARRAY['uuid'], ...);
select has_function('public','mark_drop_failed',ARRAY['uuid','text'], ...);
```
No hay llamadas a las RPC con identidades reales ni asserts sobre estados/fallos/idempotencia. **Mutaciones productivas propuestas:** quitar chequeo `v_offer.courier_id`, omitir `status='pending'` o la actualización global `status='delivered'`; tras añadir los tests funcionales, cada mutación debe producir RED real en CI y GREEN al revertirla. No hay evidencia de una ejecución de estas mutaciones aún.

### Notas sobre instrucciones y alcance

- No levanté Docker/Supabase local, no usé secretos, y no disparé workflows.
- Esas pruebas sólo prueban propiedades estáticas por inferencia y CI verifica el comportamiento de los casos existentes.
- Tras el commit documental de esta ronda, el HEAD de la PR cambia; volver a identificar SHA y checks antes de merge.

## Ronda 5 — SHA de código `09d2a9206591cb8202e99daee0dafd1fc12dbde0`

### Log CI, leído directamente en GitHub

Run: https://github.com/cadeApp/cadeApp/actions/runs/38156727884  
`db-tests`: https://github.com/cadeApp/cadeApp/actions/runs/38156727884/job/114521129594

**Resumen exacto del log:**
- `Files=1, Tests=10, Result: PASS` (bootstrap).
- `Files=21, Tests=1972, Result: PASS`, T-340 `t340_multi_drop.sql ... ok`, `plan(69)`.
- Runner: `[H08] Escenario 1A...` ... `[H08] Escenario 4B...` con `-> OK`; `[H08] TODOS LOS ESCENARIOS CONCURRENTES COMPLETADOS EXITOSAMENTE (8/8).`
- `pnpm db:types --local` ejecutado, job PASS sin drift.
- Los jobs `unit, typecheck, lint, build, audit, bundle-budget` PASS; `approval-policy` FAIL y `Supabase Preview` SKIPPED.

**Nota de interpretación:** los ocho «OK» provienen de aserciones dentro del runner; **no certifican que la acción de publicación haya sido una RPC en B**. No hay evidencia de mutación productiva SQL RED→GREEN en la bitácora de esta ronda.

### Harness independiente de R5 — completo, sin efectos secundarios

Guárdalo en `/tmp/pr317-r5-check.cjs` y ejecútalo con `node /tmp/pr317-r5-check.cjs` desde un worktree limpio del SHA revisado. No se importa código del autor que efectúe asserts ni se modifica ningún archivo del repositorio. Revisa el código fuente y prueba sus propios detectores con **mutaciones exclusivamente EN MEMORIA**:

```js
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');

const harness = readFileSync('supabase/tests/integration/t340_concurrency.mjs', 'utf8');
const tests = readFileSync('supabase/tests/t340_multi_drop.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20261009200000_t340_multi_drop.sql', 'utf8');

function orderBBlocks(text) {
  const markers = [...text.matchAll(/console\.log\('\[H08\] Escenario ([1-4])B:/g)];
  assert.equal(markers.length, 4, 'Sin los cuatro escenarios B: detector inválido');
  return markers.map(m => {
    const next = text.indexOf("\n    console.log('[H08] Escenario ", m.index + 2);
    const finish = text.indexOf("    console.log('[H08] TODOS", m.index + 2);
    const end = next >= 0 ? next : finish >= 0 ? finish : text.length;
    const body = text.slice(m.index, end);
    return {
      scenario: m[1] + 'B',
      realRPC: body.includes("select public.publish_request('${reqId}');"),
      manualStatusUpdate: /reset role;\s*update public\.delivery_requests set status = 'published'/.test(body)
    };
  });
}

const baselineB = orderBBlocks(harness);
assert(baselineB.every(x => !x.realRPC && x.manualStatusUpdate),
  'R5-H08 no reproducido: revisar el código actual antes de usar el informe');

// Mutación IN MEMORIA: reponer la llamada RPC en vez del update manual.
// Este detector no evalúa si la nueva ejecución SQL corre de verdad.
const improved = harness.replaceAll(
  "reset role;\n          update public.delivery_requests set status = 'published' where id = '${reqId}';",
  "select public.publish_request('${reqId}');"
);
const mutatedB = orderBBlocks(improved);
assert(mutatedB.every(x => x.realRPC && !x.manualStatusUpdate),
  'Detector H08 no reconoce corrección en memoria');

assert(/where l\.granted = false and a\.pid != pg_backend_pid\(\)/.test(harness),
  'R5-H08: observer cambió, revisar de nuevo');
assert(!harness.includes("'ON_ERROR_STOP=1'"),
  'R5-H08: psql fue endurecido, revisar de nuevo');

const posParentClosure = tests.indexOf("select is(pg_temp.test_mark_last_drop_closes_parent()");
const posLegacyAssertion = tests.indexOf("select throws_matching('select pg_temp.test_legacy_mark_delivered_multi_rejected()");
assert(posParentClosure >= 0 && posLegacyAssertion > posParentClosure,
  'R5-H13: orden de fixtures/test cambió');

const cycleStart = migration.indexOf('create or replace function app_private.request_cycle(');
const cycleEnd = migration.indexOf('revoke all on function app_private.request_cycle(', cycleStart);
assert(cycleStart >= 0 && cycleEnd > cycleStart, 'R5-H13: no se encontró código productivo');
const cycle = migration.slice(cycleStart, cycleEnd);
const generalStatusGuard = cycle.indexOf("p_action = 'mark_delivered' and v_eff_status <> 'in_transit'");
const multidropGuard = cycle.indexOf("if p_action = 'mark_delivered' and v_request.drops_count > 1 then");
assert(generalStatusGuard >= 0 && multidropGuard > generalStatusGuard,
  'R5-H13: precondiciones cambiaron');

// Fixture del test de «estado no in_transit» se creó sin oferta aceptada.
assert(tests.includes("'30000000-0000-4000-8000-000000003530', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published', 1"));
const invalidStateStart = tests.indexOf('create function pg_temp.test_rpc_drop_not_in_transit()');
const invalidStateEnd = tests.indexOf('-- Tests de mark_drop_delivered', invalidStateStart);
assert(invalidStateStart >= 0 && tests.slice(invalidStateStart,invalidStateEnd).includes('UNAUTHORIZED_ACTOR|INVALID_STATE_TRANSITION'),
  'R5-H13: el oráculo laxo ya fue corregido');

const plan = Number(tests.match(/select plan\((\d+)\)/)?.[1]);
const counted = tests.split(/\r?\n/).filter(l => /^\s*select\s+(has_table|has_column|throws_matching|is\(|ok\(|has_function|lives_ok)/.test(l)).length;
assert.equal(plan, 69);
assert.equal(counted, 69);
assert.equal((tests.match(/select\s+pass\(/g) || []).length, 0);

console.log('R5-H08: 4/4 B usan UPDATE de estado manual, 0/4 publican mediante RPC real');
console.log('R5-H08: mutación EN MEMORIA del runner corrige detector 4/4, sin ejecutar SQL');
console.log('R5-H13: guard N>1 inaccesible como causa del test legacy por estado ya delivered');
console.log('R5-H13: test de estado no in_transit admite UNAUTHORIZED_ACTOR por falta de offer accepted');
console.log({plan, counted, dummy:0});
```

**Resultado de ejecución en la revisión:** se aplicaron estas condiciones sobre los blobs exactos del SHA desde GitHub usando un JS separado de las pruebas del autor: baseline **4/4 B con update manual y 0/4 con llamada RPC**, versión mutada **4/4 RPC**, `pg_locks` global sin PID atribuido, `psql` sin `ON_ERROR_STOP=1`; caso legacy de multi-drop se ejecuta tras el cierre del padre y la guarda genérica corre antes de la especial. La inspección es **estática**: no alegar que se ejecutó este mismo comando dentro de un checkout real ni mutación real de Postgres; no se dispone de un clon local en esta sesión.

**Siguiente verificación obligatoria de H08/H13:** el autor tiene que añadir tests con oráculos correctos y presentar evidencia RED→GREEN de la propiedad productiva (en CI efímero). No basta con reponer en el texto una llamada RPC o un contador `plan` actualizado.
