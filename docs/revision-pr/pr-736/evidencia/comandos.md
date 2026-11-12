# Evidencia reproducible — PR #736, R1

Se inspeccionó el diff de `43726568` y los logs de `e2e-preview` run 43262434862 con GitHub. Este es un **harness local propio que modela los predicados**; no ejecuta Playwright, Realtime, API ni mutaciones contra Develop. Su GREEN/RED no se presenta como E2E real. El control sin mutaciones fue verde; el control positivo S sin notes fue rojo. Cada mutación adversa pasa en el predicado de la implementación y falla en el predicado propuesto.

Para reproducir **exactamente** (guardar el siguiente bloque completo como `/tmp/pr736-check.cjs`):

```js
// Oraculo CC-051 reducido de 43726568; simulacion LOCAL, no E2E/Develop.
const assert = require('node:assert/strict');
const P = 'publicada', D = 'borrador';
const T1 = '2026-11-12T17:17:01.000Z', T2 = '2026-11-12T17:17:02.000Z', T3 = '2026-11-12T17:17:03.000Z';
function e(actor,id,event,updatedAt,priv=false) {
  return {actor,id,event,updatedAt,status:id===P?'published':'draft',
    keys:priv?['id','updated_at','notes','cash_change_amount']:['id','updated_at'],
    hasMarker:priv,hasAmount:priv};
}
function setup(){return [e('A',P,'INSERT',T1),e('A',P,'UPDATE',T1),e('M',P,'INSERT',T1),
 e('S',P,'UPDATE',T2,true),e('A',P,'UPDATE',T2),e('M',P,'UPDATE',T2),
 e('S',D,'INSERT',T2,true),e('M',D,'INSERT',T2),e('S',D,'UPDATE',T3,true),e('M',D,'UPDATE',T3)];}
const okAnon={data:null,error:{code:'42501'}};
function original(events, opts={}){
  const at=(a,id,ev,t)=>events.filter(x=>x.actor===a&&x.id===id&&x.event===ev&&(!t||Date.parse(x.updatedAt)===Date.parse(t)));
  const restricted=items=>items.forEach(x=>{
    assert(!x.keys.includes('notes'));assert(!x.keys.includes('cash_change_amount'));
    assert.equal(x.hasMarker,false);assert.equal(x.hasAmount,false);
  });
  assert(at('A',P,'UPDATE',T1).some(x=>x.status==='published'));
  restricted(at('A',P,'UPDATE',T1));restricted(at('A',P,'INSERT',T1));
  const nPublished=opts.nPublished??okAnon;
  assert.equal((nPublished.data??[]).length,0); // ignorar el error es el hueco H03
  assert(at('S',P,'UPDATE',T2).some(x=>x.keys.includes('notes')&&x.hasMarker));
  restricted(at('A',P,'UPDATE',T2));restricted(at('M',P,'UPDATE',T2));
  assert(at('S',D,'INSERT').some(x=>x.keys.includes('notes')&&x.hasMarker));
  restricted(at('M',D,'INSERT'));
  assert(at('S',D,'UPDATE',T3).some(x=>x.keys.includes('notes')&&x.hasMarker));
  restricted(at('M',D,'UPDATE',T3));
  assert.equal(events.filter(x=>x.actor==='A'&&x.id===D).length,0);
  assert.equal(events.filter(x=>x.actor==='N').length,0);
  void opts.cleanup; // se ignora el error de limpieza (H04)
}
function corrected(events,opts={}) {
  original(events,opts);
  events.filter(x=>['A','M'].includes(x.actor)).forEach(x=>{
    assert(!x.keys.includes('notes'));assert(!x.keys.includes('cash_change_amount'));
    assert.equal(x.hasMarker,false);assert.equal(x.hasAmount,false);
  });
  [atS(events,P,'UPDATE',T2),atS(events,D,'INSERT'),atS(events,D,'UPDATE',T3)].forEach(items=>{
    assert(items.length>0);
    items.forEach(x=>{assert(x.keys.includes('notes'));assert(x.keys.includes('cash_change_amount'));
      assert.equal(x.hasMarker,true);assert.equal(x.hasAmount,true);});
  });
  assert.equal((opts.nPublished??okAnon).error?.code,'42501');
  assert.equal((opts.cleanup??{error:null}).error,null);
}
function atS(events,id,kind,t){return events.filter(x=>x.actor==='S'&&x.id===id&&x.event===kind&&(!t||x.updatedAt===t));}
function run(name,make,redOriginal,redCorrected){const [ev,opts]=make();let a='GREEN',b='GREEN';
  try{original(ev,opts)}catch{a='RED'}try{corrected(ev,opts)}catch{b='RED'}
  assert.equal(a,redOriginal);assert.equal(b,redCorrected);
  console.log(name+': actual='+a+' | propuesto='+b);
}
run('Control limpio',()=>[setup(),{}],'GREEN','GREEN');
run('Control de sensibilidad S sin notes',()=>{const a=setup();a.find(x=>x.actor==='S'&&x.id===P).keys=['id'];return[a,{}]},'RED','RED');
run('H01 A recibe INSERT tardio con claves',()=>[setup().concat(e('A',P,'INSERT',T3,true)),{}],'GREEN','RED');
run('H01 M recibe INSERT publicado con claves',()=>{const a=setup();a.find(x=>x.actor==='M'&&x.id===P).keys.push('notes');return[a,{}]},'GREEN','RED');
run('H02 S sin cash en UPDATE',()=>{const a=setup();const s=a.find(x=>x.actor==='S'&&x.id===P);s.keys=s.keys.filter(x=>x!=='cash_change_amount');s.hasAmount=false;return[a,{}]},'GREEN','RED');
run('H02 S sin cash en INSERT',()=>{const a=setup();const s=a.find(x=>x.actor==='S'&&x.id===D&&x.event==='INSERT');s.keys=s.keys.filter(x=>x!=='cash_change_amount');s.hasAmount=false;return[a,{}]},'GREEN','RED');
run('H03 anon tiene 500 en vez de 42501',()=>[setup(),{nPublished:{data:null,error:{code:'500'}}}],'GREEN','RED');
run('H04 update de limpieza falla',()=>[setup(),{cleanup:{error:{code:'42501'}}}],'GREEN','RED');
console.log('Control y 6 mutaciones: resultados esperados confirmados. Simulacion, NO E2E real.');
```

```sh
node /tmp/pr736-check.cjs
```

```text
Control limpio: actual=GREEN | propuesto=GREEN
Control de sensibilidad S sin notes: actual=RED | propuesto=RED
H01 A recibe INSERT tardio con claves: actual=GREEN | propuesto=RED
H01 M recibe INSERT publicado con claves: actual=GREEN | propuesto=RED
H02 S sin cash en UPDATE: actual=GREEN | propuesto=RED
H02 S sin cash en INSERT: actual=GREEN | propuesto=RED
H03 anon tiene 500 en vez de 42501: actual=GREEN | propuesto=RED
H04 update de limpieza falla: actual=GREEN | propuesto=RED
Control y 6 mutaciones: resultados esperados confirmados. Simulacion, NO E2E real.
```

**Límites:** los predicados se redujeron manualmente para el análisis; los contraejemplos no prueban fuga en producción ni demuestran que el test E2E de `43726568` falló. La evidencia real está en [run 43262434862](https://github.com/cadeApp/cadeApp/actions/runs/43262434862): checkout `43726568`, CC-051 PASS, registros `[CC-051 captura]` solo keys; run completo failure 4/1/119 por pruebas ajenas.

**Mutación de rollback no realizada:** no se alteró schema, grants ni publicación en Develop (prohibición operativa). La sensibilidad de la captura ya tiene control S real, pero le falta exigir cash y monto. Tampoco se inventan rojos del autor.

**Comandos de control para el autor (en su clon, no ejecutados por la revisión):**

```sh
git pull
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run tools e2e
node docs/revision-pr/analizar.mjs verificacion
git status --short
git ls-remote origin feat/T-435-sec12-realtime-capture
```

`e2e-preview` debe ejecutarse **por CI de la PR** sobre el nuevo SHA de implementación contra Develop; no lanzarlo manualmente ni falsificar su resultado. En la verificación del oráculo, usar una batería temporal /tmp con eventos controlados **de manera explícita y aislada**, comprobar RED ante claves y valores prohibidos, y registrar separadamente GREEN real del E2E. No adulterar expectations de producción ni usar mocks para sustituir la ruta real del E2E.

---

## R2 — Batería independiente nueva y carrera de limpieza

El revisor escribió y ejecutó esta batería **independiente** en Node 22. Reproduce en memoria los predicados usados por `courier-private-columns.spec.ts` en SHA `6fa6dd5bbc525ce75884f61940af2a5d26c2e2c2` (no ejecuta el spec, Playwright ni endpoints); comprueba **8 mutaciones adversas nuevas**, más una carrera real del event loop en el control de altas. No requiere claves ni servicios. Conservar íntegro para reproducir (copiar a `/tmp/pr736-r2.cjs`):

```js
'use strict';
const assert = require('node:assert/strict');
const marker = 'synthetic-marker', amount = 43210, P = 'published-id', D = 'draft-id';
const tPub = '2026-11-12T17:00:01.000Z', tValue = '2026-11-12T17:00:02.000Z';
const tDraft = '2026-11-12T17:00:03.000Z', tUpdate = '2026-11-12T17:00:04.000Z';
function event(actor,id,eventType,updatedAt,fields={}) {
  const row={id,status:id===P?'published':'draft',updated_at:updatedAt,...fields};
  const json=JSON.stringify(row);
  return {actor,id,event:eventType,updatedAt,status:row.status,keys:Object.keys(row).sort(),
    hasMarker:json.includes(marker),hasAmount:json.includes(String(amount)),
    notesMatchesMarker:row.notes===marker,amountMatches:row.cash_change_amount===amount};
}
function baseline(){const priv={notes:marker,cash_change_amount:amount};return [
  event('A',P,'UPDATE',tPub),event('A',P,'INSERT',tPub),event('M',P,'INSERT',tPub),
  event('S',P,'UPDATE',tValue,priv),event('A',P,'UPDATE',tValue),event('M',P,'UPDATE',tValue),
  event('S',D,'INSERT',tDraft,priv),event('M',D,'INSERT',tDraft),
  event('S',D,'UPDATE',tUpdate,priv),event('M',D,'UPDATE',tUpdate)];}
let records=[];
const eventsOf=(a,id,type,at)=>records.filter(e=>e.actor===a&&e.id===id&&e.event===type&&
  (at===undefined||Date.parse(String(e.updatedAt))===Date.parse(at)));
function expectRestricted(evs){for(const e of evs){
  assert(!e.keys.includes('notes'));assert(!e.keys.includes('cash_change_amount'));
  assert.equal(e.hasMarker,false);assert.equal(e.hasAmount,false);
}}
function expectSourcePositive(evs){assert(evs.some(e=>e.keys.includes('notes')&&
  e.keys.includes('cash_change_amount')&&e.notesMatchesMarker&&e.amountMatches));}
function oracle(evs, opts={}){
  records=evs;
  const aPub=eventsOf('A',P,'UPDATE',tPub);
  assert(aPub.some(e=>e.status==='published'));expectRestricted(aPub);
  expectRestricted(eventsOf('A',P,'INSERT'));
  const sUpdate=eventsOf('S',P,'UPDATE',tValue);assert(sUpdate.length>0);expectSourcePositive(sUpdate);
  const aUpdate=eventsOf('A',P,'UPDATE',tValue),mUpdate=eventsOf('M',P,'UPDATE',tValue);
  assert(aUpdate.length&&mUpdate.length);expectRestricted(aUpdate);expectRestricted(mUpdate);
  const sInsert=eventsOf('S',D,'INSERT',tDraft),mInsert=eventsOf('M',D,'INSERT',tDraft);
  assert(sInsert.length&&mInsert.length);expectSourcePositive(sInsert);expectRestricted(mInsert);
  const sDraft=eventsOf('S',D,'UPDATE',tUpdate),mDraft=eventsOf('M',D,'UPDATE',tUpdate);
  assert(sDraft.length&&mDraft.length);expectSourcePositive(sDraft);expectRestricted(mDraft);
  const nPublished=opts.nPublished??{error:{code:'42501'},data:null};
  const nDraft=opts.nDraft??{error:{code:'42501'},data:null};
  const aDraft=opts.aDraft??{error:null,data:[]};
  assert.equal(nPublished.error?.code,'42501');assert.equal(nPublished.data,null);
  assert.equal(nDraft.error?.code,'42501');assert.equal(nDraft.data,null);
  assert.equal(aDraft.error,null);assert.equal(aDraft.data.length,0);
  expectRestricted(evs.filter(e=>['A','M'].includes(e.actor)&&[P,D].includes(e.id)));
  assert.equal(evs.filter(e=>e.actor==='A'&&e.id===D).length,0);
  assert.equal(evs.filter(e=>e.actor==='N').length,0);
}
function check(label,mutate,expected){const ev=baseline(),opts={};mutate?.(ev,opts);
  let result='GREEN';try{oracle(ev,opts)}catch{result='RED'}
  assert.equal(result,expected,label);console.log(label+': '+result);
}
check('Control limpio',null,'GREEN');
check('H01 A INSERT tardio notes',ev=>ev.push(event('A',P,'INSERT',tUpdate,{notes:marker})),'RED');
check('H01 M INSERT publico cash',ev=>ev.push(event('M',P,'INSERT',tUpdate,{cash_change_amount:amount})),'RED');
check('H02 S UPDATE sin cash',ev=>{const s=ev.find(x=>x.actor==='S'&&x.id===P);s.keys=s.keys.filter(k=>k!=='cash_change_amount');s.amountMatches=false},'RED');
check('H02 S INSERT cash incorrecto',ev=>{ev.find(x=>x.actor==='S'&&x.id===D&&x.event==='INSERT').amountMatches=false},'RED');
check('H03 anon 500',(_,o)=>{o.nPublished={error:{code:'500'},data:null}},'RED');
check('H03 A draft 500',(_,o)=>{o.aDraft={error:{code:'500'},data:null}},'RED');
check('H05 A UPDATE wrong updated_at',ev=>{ev.find(x=>x.actor==='A'&&x.id===P&&x.event==='UPDATE').updatedAt='2026-11-12T17:00:00.000Z'},'RED');
check('H05 M INSERT draft wrong updated_at',ev=>{ev.find(x=>x.actor==='M'&&x.id===D&&x.event==='INSERT').updatedAt=tValue},'RED');

function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
async function race(useSettled){
  const gate=deferred(),channels=[],removed=[];
  async function subscribe(actor){if(actor==='A')throw new Error('CHANNEL_ERROR');
    await gate.promise;channels.push(actor)}
  if(useSettled){
    const all=Promise.allSettled([subscribe('A'),subscribe('M')]);gate.resolve();await all;
  } else {
    try{await Promise.all([subscribe('A'),subscribe('M')])}catch{}
  }
  const removals=await Promise.allSettled(channels.map(async c=>{removed.push(c);return 'ok'}));
  if(!useSettled){gate.resolve();await Promise.resolve();await Promise.resolve();}
  return {channels:[...channels],removed,removals:removals.length,orphaned:channels.filter(c=>!removed.includes(c))};
}
(async()=>{
  const current=await race(false),proposed=await race(true);
  assert.deepEqual(current.orphaned,['M']);
  assert.deepEqual(proposed.orphaned,[]);
  console.log('H04 alta con Promise.all: canales='+current.channels.length+', removidos='+current.removed.length+', huerfanos='+current.orphaned.length+' (RED)');
  console.log('H04 alta con Promise.allSettled: canales='+proposed.channels.length+', removidos='+proposed.removed.length+', huerfanos='+proposed.orphaned.length+' (GREEN)');
  console.log('Resultado: control GREEN, 8 mutaciones de oraculos RED, carrera H04 actual RED/propuesto GREEN');
})().catch(e=>{console.error(e);process.exitCode=1});
```

```sh
node /tmp/pr736-r2.cjs
```

**Salida esperada y reproducida (Node 22):**
```text
Control limpio: GREEN
H01 A INSERT tardio notes: RED
H01 M INSERT publico cash: RED
H02 S UPDATE sin cash: RED
H02 S INSERT cash incorrecto: RED
H03 anon 500: RED
H03 A draft 500: RED
H05 A UPDATE wrong updated_at: RED
H05 M INSERT draft wrong updated_at: RED
H04 alta con Promise.all: canales=1, removidos=0, huerfanos=1 (RED)
H04 alta con Promise.allSettled: canales=1, removidos=1, huerfanos=0 (GREEN)
Resultado: control GREEN, 8 mutaciones de oraculos RED, carrera H04 actual RED/propuesto GREEN
```

**Advertencia:** RED de H04 no significa que haya ocurrido en Develop; es una reproducción determinística de la posibilidad de carrera en JavaScript bajo un fallo asíncrono de suscripción. Los resultados de R2-H01/H02/H03/H05 son de un modelo local, no una ejecución del test E2E del repositorio. El script de 8 RED declarado por el autor no está en la rama: no se reproduce como fuente primaria y por eso `verificado_en_sha` sigue nulo. El preview de R2 estaba en cola al revisar.
