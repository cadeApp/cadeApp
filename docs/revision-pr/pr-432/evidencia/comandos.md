# Evidencia reproducible — PR #432 / T-375

**SHA de código verificado:** 35b2792ba68eaff8c33d4e7851e056098e8ac87a. **No se escribió en Supabase Develop**.

## Resultados independientes

Helper real de 101 líneas, SHA-256 del archivo: a5f1c1e423ffcb1dd73afa2d1e74413913901fc772f7deed880d31f0e822ab70 (coincide con la bitácora).

- 01–08: restauración correcta, precondición fail-closed, set prohibido antes de validar, escritura aplicada con respuesta 500, relectura y reintento, idempotencia.
- 09: orden adverso de write pendiente demostrado en memoria (seguimiento issue #433, no implica defecto comprobado en Supabase).
- MUT-1: desactivar restore; el oracle original espera true y queda RED.
- MUT-2: mover mustRestore detrás del write; el oracle true queda RED tras 500.
- MUT-3: eliminar el chequeo de relectura; el oracle que exige rechazar un restore no efectivo queda RED.

**Ejecución observada:** 12/12 casos esperados, con los tres mutantes detectados por aserciones que fallan. La batería y sus mutaciones son de la revisión, no del autor.

Para repetirlo en un checkout limpio exactamente en el SHA revisado, guardá el siguiente código íntegro en /tmp/t375-revisar.mjs y corré desde la raíz del repo:

~~~bash
node /tmp/t375-revisar.mjs
~~~

~~~javascript
// Copiar este archivo a /tmp/t375-revisar.mjs y ejecutar desde la raíz del repo:
// node /tmp/t375-revisar.mjs
// No conecta a Supabase, no modifica la rama: transpilación y mutaciones EN MEMORIA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const requireRoot = createRequire(path.join(process.cwd(), 'package.json'));
let ts;
try { ts = requireRoot('typescript'); }
catch { ts = createRequire(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'index.js'))('typescript'); }
const file = process.argv[2] || 'e2e/helpers/pilot.ts';
const src = fs.readFileSync(file,'utf8');
function load(code) {
  const js = ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod = {exports:{}};
  vm.runInNewContext(js,{module:mod,exports:mod.exports,require:(p)=>{
    if(p==='@/server/supabase/admin') return {createAdminClient:()=>{throw Error('No Supabase in harness');}};
    throw Error('Unexpected import '+p);
  }});
  return mod.exports.createPilotGuard;
}
const guard=load(src);
const make=(initial=true)=>({value:initial,writes:[],async read(){return this.value;},async write(v){this.value=v;this.writes.push(v);}});
let n=0;
async function check(name,fn){await fn();n++;console.log('PASS',name);}
await check('01: false -> restore true',async()=>{const s=make(),p=guard(s,'t');await p.assertBaseline();await p.set(false);await p.restore();assert.equal(s.value,true);assert.deepEqual(s.writes,[false,true]);});
await check('02: false inicial rechaza sin escribir, incluso teardown',async()=>{const s=make(false),p=guard(s,'t');await assert.rejects(p.assertBaseline(),/pilot_active=false/);await p.restore();assert.deepEqual(s.writes,[]);});
await check('03: set sin baseline rechaza',async()=>{const s=make(),p=guard(s,'t');await assert.rejects(p.set(false),/No se verificó/);assert.deepEqual(s.writes,[]);});
await check('04: baseline fallido no habilita set tras corrección externa',async()=>{const s=make(false),p=guard(s,'t');await assert.rejects(p.assertBaseline());s.value=true;await assert.rejects(p.set(false));});
await check('05: set(true) conserva baseline',async()=>{const s=make(),p=guard(s,'t');await p.assertBaseline();await p.set(true);await p.restore();assert.deepEqual(s.writes,[true,true]);});
await check('06: escritura aplicada + 500 todavía restaura',async()=>{const s=make();s.write=async v=>{s.value=v;s.writes.push(v);if(v===false)throw Error('500');};const p=guard(s,'t');await p.assertBaseline();await assert.rejects(p.set(false));await p.restore();assert.equal(s.value,true);});
await check('07: relectura detecta restore ineficaz, reintento posible',async()=>{const s=make();let ignore=true;s.write=async v=>{if(v===false||!ignore)s.value=v;};const p=guard(s,'t');await p.assertBaseline();await p.set(false);await assert.rejects(p.restore(),/no volvió/);ignore=false;await p.restore();assert.equal(s.value,true);});
await check('08: restore idempotente',async()=>{const s=make(),p=guard(s,'t');await p.assertBaseline();await p.set(false);await p.restore();await p.restore();assert.deepEqual(s.writes,[false,true]);});
await check('09: contraejemplo escritura tardía, aceptado en issue #433',async()=>{const s=make();let release;const pending=new Promise(resolve=>release=resolve);s.write=async v=>{if(v===false)await pending;s.value=v;s.writes.push(v);};const p=guard(s,'t');await p.assertBaseline();const inFlight=p.set(false);await Promise.resolve();await p.restore();assert.equal(s.value,true);release();await inFlight;assert.equal(s.value,false);});
const mutantRestore=src.replace('if (!mustRestore) return;','if (true) return;');
assert.notEqual(mutantRestore,src);
await check('MUT-1: sin restore, oracle true da ROJO',async()=>{const s=make(),p=load(mutantRestore)(s,'t');await p.assertBaseline();await p.set(false);await p.restore();await assert.rejects(Promise.resolve().then(()=>assert.equal(s.value,true)),{name:'AssertionError'});});
const needle='mustRestore = true;\n      await store.write(active);';assert.ok(src.includes(needle));
const mutantLate=src.replace(needle,'await store.write(active);\n      mustRestore = true;');
await check('MUT-2: responsabilidad después del write, oracle true da ROJO',async()=>{const s=make();s.write=async v=>{s.value=v;if(v===false)throw Error('500');};const p=load(mutantLate)(s,'t');await p.assertBaseline();await assert.rejects(p.set(false));await p.restore();await assert.rejects(Promise.resolve().then(()=>assert.equal(s.value,true)),{name:'AssertionError'});});
const mutantNoRead=src.replace('if (restored !== PILOT_BASELINE) {','if (false) {');assert.notEqual(mutantNoRead,src);
await check('MUT-3: sin comparar relectura, oracle de rechazo da ROJO',async()=>{
  const broken=()=>{const s=make();s.write=async v=>{if(v===false)s.value=false;};return s;};
  const sc=broken(),control=guard(sc,'t');await control.assertBaseline();await control.set(false);await assert.rejects(control.restore(),/no volvió/);
  const sm=broken(),mutated=load(mutantNoRead)(sm,'t');await mutated.assertBaseline();await mutated.set(false);
  let rejected=false;try{await mutated.restore();}catch{rejected=true;}
  await assert.rejects(Promise.resolve().then(()=>assert.equal(rejected,true)),{name:'AssertionError'});
});
console.log('TOTAL '+n+'/12: 9 casos (incl. riesgo separado) + 3 mutaciones en memoria');
~~~

### Límites del alcance

Este harness evalúa el helper exacto como módulo en Node y muta solo cadenas en memoria. No simula el reinicio real del worker de Playwright ni sustituye el RED/GREEN de timeout de prueba reportado por el autor. No necesita credenciales ni invoca la base. El RED del autor se describió en docs/tasks/log/T-375.md; el harness temporal Playwright no se conservó y no se afirma haberlo reejecutado.

## Controles oficiales del SHA de código

- CI https://github.com/cadeApp/cadeApp/actions/runs/39336725694: unit 148 archivos / 2890 tests, typecheck, lint, build, audit, db-tests y bundle-budget PASS. db-tests incluye pruebas de mutación intencional que producen salidas FAIL intermedias, seguidas de PASS y job final verde.
- E2E https://github.com/cadeApp/cadeApp/actions/runs/39336816251: Chromium **91 passed** y global-settings **6 passed** con --workers=1, en el preview del SHA revisado.
- GitHub compare: head 1 ahead / 0 behind del develop base; mergeable=true.
- approval-policy estaba rojo antes del informe independiente. Tras el comentario de cierre debe comprobarse su actualización.

**No ejecutado localmente en clon:** git merge-tree, pnpm typecheck, lint, test o Playwright (sin acceso de red a GitHub ni dependencias Playwright en el entorno de revisión). No se presentan como comandos locales ejecutados.
