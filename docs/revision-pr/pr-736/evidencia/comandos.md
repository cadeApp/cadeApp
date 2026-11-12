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
