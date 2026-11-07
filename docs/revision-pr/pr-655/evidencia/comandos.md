# Evidencia y comandos — PR #655, ronda 1

## Procedencia y límites
- Código de referencia leído con GitHub Connector en `2b3576e68d8f02c492c810ea31fb47f4da35edae`. Se pudo ejecutar en V8 la lógica extraída de `inspectStreamingSegments` y `waitForNoSkeletons` con stubs controlados; no se ejecutó Playwright real en el revisor.
- El clon por HTTPS no estuvo disponible (`Could not resolve host: github.com`). Por ello `pnpm`, `git merge-tree`, `analizar.mjs` y las mutaciones del autor M1/M2 no se reejecutaron localmente. Las salidas de CI se verificaron en logs oficiales y NO son verificaciones propias.
- El script de abajo es autocontenido, usa Node estándar y lee la implementación REAL del checkout indicado. Antes de contar un RED verifica que las expresiones objetivo existan; no modifica archivos del repositorio. Se contrastó la copia en `/tmp` contra extractos exactos de ambas funciones.

## Script íntegro de control y mutación (guardar en /tmp)

```bash
cat > /tmp/pr655-r1-check.cjs <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[2] || process.cwd();
const s = fs.readFileSync(path.join(root, 'e2e/helpers/streaming.ts'), 'utf8');
const h = fs.readFileSync(path.join(root, 'e2e/helpers/skeletons.ts'), 'utf8');
const tests = fs.readFileSync(path.join(root, 'tools/e2e-streaming.test.ts'), 'utf8');
const rawInspect = s.match(/export function inspectStreamingSegments\(doc: Document\): StreamingSegmentsState \{[\s\S]*?\n\}/)?.[0];
const rawWait = h.match(/export async function waitForNoSkeletons\([\s\S]*?\n\}\n/)?.[0];
assert(rawInspect && rawWait, 'SIN OBJETIVO: revisar extractor; no contar como rojo');
const inspectJS = rawInspect.replace('export function inspectStreamingSegments(doc: Document): StreamingSegmentsState', 'function inspectStreamingSegments(doc)').replace('const pending: string[]', 'const pending').replace('const orphaned: string[]', 'const orphaned');
const inspect = new Function(inspectJS + ';return inspectStreamingSegments')();
function makeWait(mutated) {
  let j = rawWait.replace(/export async function waitForNoSkeletons\([\s\S]*?\): Promise<void> \{\n/, 'async function waitForNoSkeletons(page, options={}) {\n');
  if (mutated) {
    const target = 'await page.waitForFunction(NO_PENDING_SEGMENTS, undefined, { timeout });';
    assert(j.includes(target), 'SIN OBJETIVO: la mutación no encontró el código');
    j = j.replace(target, '/* MUTACIÓN: se quita la espera */');
  }
  return new Function('NO_PENDING_SEGMENTS', 'reportOrphanedSegments', j + ';return waitForNoSkeletons')('no pending', async () => {});
}
function doc(boundaries, segments) {
  const b = new Set(boundaries);
  return {
    querySelectorAll(q) { assert.equal(q, 'div[hidden][id^="S:"]'); return segments.map(id => ({ id })); },
    getElementById(id) { return b.has(id) ? { id } : null; },
    querySelector(q) { assert.equal(q, 'template[id^="B:"]'); return b.size ? { id: [...b][0] } : null; },
  };
}
function check(name, action, expectedRed = false) {
  try {
    action();
    if (expectedRed) throw Error('MUTANTE SOBREVIVIÓ / comportamiento incorrecto NO detectado');
    console.log('GREEN', name);
  } catch (e) {
    if (!expectedRed) throw e;
    console.log('RED', name, String(e.message).slice(0, 140));
  }
}
(async () => {
  check('control: pendiente B:1+S:1', () => assert.deepEqual(inspect(doc(['B:1'], ['S:1'])), {pending:['S:1'],orphaned:[]}));
  check('control: huérfano S:1', () => assert.deepEqual(inspect(doc([], ['S:1'])), {pending:[],orphaned:['S:1']}));
  check('H01 B:1 sin S:1 debe bloquear fin de streaming', () => assert.equal(inspect(doc(['B:1'], [])).pending.length === 0, false), true);
  let elapsed = 0, calls = 0;
  await makeWait(false)({
    async waitForSelector(_s, o) { assert.equal(o.timeout, 15000); elapsed += 14000; },
    async waitForFunction(_s, _arg, o) { calls++; assert.equal(o.timeout, 15000); elapsed += 2000; },
  }, {timeout:15000});
  check('H02 timeout total no supera 15000ms', () => assert(elapsed <= 15000, 'transcurrieron '+elapsed+'ms'), true);
  check('H03 control: helper original sí llama waitForFunction', () => assert.equal(calls, 1));
  let mutantCalls = 0;
  await makeWait(true)({ async waitForSelector() {}, async waitForFunction() { mutantCalls++; } }, { timeout:15000 });
  check('H03 mutación: eliminar espera debe romper nueva prueba', () => assert.equal(mutantCalls, 1), true);
  check('H03 suite del autor no invoca el helper', () => assert(!tests.includes('waitForNoSkeletons')));
})().catch(e => {console.error(e);process.exitCode=2;});
NODE
node /tmp/pr655-r1-check.cjs "$PWD"
```

**Entorno requerido:** ejecutar desde el checkout del SHA `2b3576e68d8f02c492c810ea31fb47f4da35edae` o pasar su carpeta como argumento; no requiere dependencias npm. La `mutación` del H03 sustituye la instrucción en memoria, sin editar archivos. Si el código cambia y el patrón deja de existir, el harness termina por `SIN OBJETIVO`; **eso no es rojo**.

**Salida observada con extractos exactos de código en `/tmp`:**

```text
GREEN control: pendiente B:1+S:1
GREEN control: huérfano S:1
RED H01 B:1 sin S:1 debe bloquear fin de streaming — true !== false
RED H02 timeout total no supera 15000ms — transcurrieron 16000ms
GREEN H03 control: helper original sí llama waitForFunction
RED H03 mutación: eliminar espera debe romper nueva prueba — 0 !== 1
GREEN H03 suite del autor no invoca el helper
```

El harness ejecuta invariantes con stubs: no atribuirle resultados E2E de Chromium. H03 constata que la suite actual no ejercita el helper; el RED de mutación pertenece al control nuevo de la revisión y aún debe convertirse en un test mantenido en `tools/e2e-streaming.test.ts`.

## Checks oficiales verificados
- SHA `b1858f176a7d4c078e76f72fe52deba4604dd7e9`: [CI 42405014900](https://github.com/cadeApp/cadeApp/actions/runs/42405014900), `success`: `unit` 199 archivos / 3743 tests, `typecheck`, `lint`, `build` y `db-tests` OK. El job `db-tests` termina con `Files=43, Tests=3582, Result: PASS`; los `Failed test` intermedios pertenecen a controles de mutación y **no** al resultado final.
- SHA `b1858f176a7d4c078e76f72fe52deba4604dd7e9`: [e2e-preview 42405675955](https://github.com/cadeApp/cadeApp/actions/runs/42405675955), intento 1 y 2 `success`. En el intento 2: 123 passed Chromium, 7 passed global-settings, 11 diagnósticos `[T-429 streaming]` en el log. El intento 1 fue confirmado por API de GitHub como exitoso; su resumen y 6 avisos están en la bitácora del autor, no se releyó su log completo.
- SHA anterior `3843d05e`: [gate 42398265912](https://github.com/cadeApp/cadeApp/actions/runs/42398265912), 122 passed / 1 flaky en Chromium + 7 passed global-settings; en el log se leyeron 9 avisos del streaming.
- HEAD revisado `2b3576e68d8f02c492c810ea31fb47f4da35edae`: comparación GitHub contra `b1858f176a7d4c078e76f72fe52deba4604dd7e9` muestra **solo** 11 líneas agregadas en `docs/tasks/log/T-429.md`. Su CI 42412285862 fue cancelado. Conforme a la regla décima, no se exige CI green extra solo por esta edición documental.

## Tras arreglar (otro SHA)
Verificar RED→GREEN de cada control sin cambiar expectativas ni falsificar mocks: `pnpm exec vitest run tools/e2e-streaming.test.ts`; `pnpm typecheck && pnpm lint && pnpm test`; push a la rama y revisar CI + E2E del nuevo código. Mantener un test que falle si se borra `waitForFunction`, y un test con `B:1` sin `S:1`.

## Ronda 2 — 2026-11-07 — SHA 002797727bbb564b9c99f35050dfbfecab4fb108

**Resultado: SIN BLOQUEANTES NUEVOS. H01–H03 cerrados/verificados en el SHA revisado.** Esta sección añade evidencia; no reemplaza la ronda 1.

### Script independiente completo
El siguiente script exacto lee las dos funciones de los archivos del checkout y las evalúa en Node con `Document`/`Page` controlados. Las mutaciones se aplican exclusivamente a cadenas en memoria; no modifica el checkout. Si cambia un patrón, `assert.notEqual` frena con `SIN OBJETIVO`. Se copió a `/tmp/pr655-r2-check-copy.cjs` y se ejecutó en Node 22 contra un árbol temporal con **extractos idénticos** de esas dos funciones leídos del SHA. Las mismas funciones completas también se evaluaron directamente desde GitHub en V8. No equivale a Playwright ni a ejecutar la suite del autor.

Para ejecutarlo en checkout limpio de 002797727bbb564b9c99f35050dfbfecab4fb108:
```bash
cat > /tmp/pr655-r2-check.cjs <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.argv[2] || process.cwd();
const S=fs.readFileSync(path.join(root,'e2e/helpers/streaming.ts'),'utf8');
const H=fs.readFileSync(path.join(root,'e2e/helpers/skeletons.ts'),'utf8');
const rawSet=S.match(/export function isStreamingSettled\(doc: Document\): boolean \{[\s\S]*?\n\}/)?.[0];
const rawWait=H.match(/export async function waitForNoSkeletons\([\s\S]*?\n\}\n/)?.[0];
assert(rawSet && rawWait,'SIN OBJETIVO: no se encontraron las funciones del SHA revisado');
function setFn(raw){return new Function(raw.replace('export function isStreamingSettled(doc: Document): boolean','function isStreamingSettled(doc)')+';return isStreamingSettled;')()}
let clock=0;
function waitFn(raw,settled,report){
 const body=raw.replace(/export async function waitForNoSkeletons\([\s\S]*?\): Promise<void> \{\n/,'async function waitForNoSkeletons(page, options={}) {\n');
 return new Function('performance','STREAMING_SETTLED','reportOrphanedSegments',body+';return waitForNoSkeletons')({now:()=>clock},`(${settled.toString()})(document)`,report);
}
function doc(boundaries=[],segments=[]){
 let b=new Set(boundaries),s=[...segments];return {
  querySelector(selector){assert.equal(selector,'template[id^="B:"]');return b.size?{id:[...b][0]}:null},
  querySelectorAll(selector){assert.equal(selector,'div[hidden][id^="S:"]');return s.map(id=>({id}))},
  getElementById(id){return b.has(id)?{id}:null},
  clear(){b.clear();s=[]}
 }
}
const cases=[['vacío',[],[],true],['B aislado',['B:1'],[],false],['B+S',['B:1'],['S:1'],false],['S huérfano',[],['S:1'],true],['mixto',['B:2'],['S:1','S:2'],false]];
const settled=setFn(rawSet);
for(const [name,bs,ss,expect] of cases)assert.equal(settled(doc(bs,ss)),expect,'control '+name);
console.log('GREEN control isStreamingSettled 5/5');
for(const [label,mut] of [
 ['M01 B ignorado',rawSet.replace('if (doc.querySelector(\'template[id^="B:"]\')) return false;','if (doc.querySelector(\'template[id^="B:"]\')) return true;')],
 ['M02 huérfano bloqueado',rawSet.replace('return pending === 0;','return pending === 0 && doc.querySelectorAll(\'div[hidden][id^="S:"]\').length === 0;')]
]){
 assert.notEqual(mut,rawSet,'SIN OBJETIVO '+label);
 const f=setFn(mut);const broken=cases.filter(([_name,bs,ss,expected])=>f(doc(bs,ss))!==expected).map(x=>x[0]);
 assert(broken.length>0,'MUTANTE SOBREVIVIÓ '+label);console.log('RED',label,broken.join(', '));
}
function mkPage(streamDoc,{skeletonMs=0,streamMs=0}={}){
 const calls={filtered:null,remaining:null,called:false,report:0};
 const page={
  locator(){return {filter({visible}){calls.filtered=visible;return this},first(){return this},async waitFor({timeout,state}){assert.equal(state,'detached');assert.equal(timeout,15000);clock+=skeletonMs}}},
  async waitForFunction(expression,_arg,{timeout}){
   calls.called=true;calls.remaining=timeout;
   const predicate=new Function('document',`return (${expression});`);
   if(predicate(streamDoc))return;
   clock+=streamMs;
   if(streamMs>timeout)throw new Error('timeout '+timeout+'ms');
   streamDoc.clear();assert(predicate(streamDoc),'condición falsa con DOM terminado');
  }
 };return {page,calls};
}
(async()=>{
 clock=0;let doc1=doc(['B:1'],['S:1']);const c=mkPage(doc1,{skeletonMs:14000,streamMs:2000});
 await assert.rejects(waitFn(rawWait,settled,async()=>{})(c.page,{timeout:15000}),/timeout 1000ms/);
 assert.equal(c.calls.filtered,true);assert.equal(c.calls.remaining,1000);assert.equal(c.calls.called,true);
 console.log('GREEN deadline compartido: 14000 + 2000 > 15000, restante 1000');
 const mutations=[
  ['M03 reiniciar timeout',rawWait.replace('Math.floor(deadline - performance.now())','timeout'),'remaining',15000],
  ['M04 omitir waitForFunction',rawWait.replace('await page.waitForFunction(STREAMING_SETTLED, undefined, { timeout: remaining });','void STREAMING_SETTLED;'),'called',false],
  ['M05 omitir diagnóstico',rawWait.replace('await reportOrphanedSegments(page);','void page;'),'report',0],
  ['M06 filtrar ocultos',rawWait.replace('.filter({ visible: true })','.filter({ visible: false })'),'filtered',false],
 ];
 for(const [label,mut,key,expected] of mutations){
  assert.notEqual(mut,rawWait,'SIN OBJETIVO '+label);
  clock=0;let reports=0;const z=mkPage(doc(['B:1'],['S:1']),{skeletonMs:14000,streamMs:2000});
  try{await waitFn(mut,settled,async()=>{reports++})(z.page,{timeout:15000})}catch(_){}
  z.calls.report=reports;
  assert.equal(z.calls[key],expected,'MUTANTE NO REPRODUJO DEFECTO '+label);
  console.log('RED',label,key,'=',JSON.stringify(expected));
 }
 console.log('MUTACIONES 6/6 detectadas (2 de estado y 4 del helper)');
})().catch(e=>{console.error(e);process.exitCode=1});
NODE
node /tmp/pr655-r2-check.cjs "$PWD"
```

Salida de la ejecución independiente:
```text
GREEN control isStreamingSettled 5/5
RED M01 B ignorado B aislado, B+S, mixto
RED M02 huérfano bloqueado S huérfano
GREEN deadline compartido: 14000 + 2000 > 15000, restante 1000
RED M03 reiniciar timeout remaining = 15000
RED M04 omitir waitForFunction called = false
RED M05 omitir diagnóstico report = 0
RED M06 filtrar ocultos filtered = false
MUTACIONES 6/6 detectadas (2 de estado y 4 del helper)
```

Nota de validez: las líneas RED M01–M06 indican que el **control independiente** descubre el comportamiento roto por la mutación. No son líneas del runner de Vitest ni se atribuyen al autor.

### Evidencia del autor no reproducida exactamente
La bitácora del autor informa `5 failed | 15 passed (20)` sobre el helper anterior y `3 failed | 17 passed (20)` al quitar `waitForFunction`, con `20 passed` restaurado. No se pudo volver a ejecutar ese mismo RED de Vitest por no disponer de clon ni dependencias; **no se marca como evidencia propia**. En CI del SHA final sí se observaron los 20 unitarios verdes. Independientemente se ejecutaron los mutantes M01–M06 anteriores.

### CI/E2E del SHA exacto
- [CI run 42414714756](https://github.com/cadeApp/cadeApp/actions/runs/42414714756): head_sha `002797727bbb564b9c99f35050dfbfecab4fb108`, status success; unit 199 archivos, 3755 tests, incluido `tools/e2e-streaming.test.ts` con 20 tests. Typecheck y lint exitosos.
- En db-tests: línea final `Files=43, Tests=3582`, `Result: PASS`; los `Result: FAIL` intermedios son tests de mutación del arnés, no el resultado final. `git diff --exit-code -- src/types/database.types.ts` se ejecutó y el job terminó success.
- [Gate 42415349609](https://github.com/cadeApp/cadeApp/actions/runs/42415349609): checkout explícito `002797727bbb564b9c99f35050dfbfecab4fb108`, 123 passed Chromium, 7 passed global-settings, 0 flaky/failed, 9 advertencias `[T-429 streaming]`. Los datos del usuario coinciden con el log oficial.
- Bundle-budget CI se muestra verde pero revela presupuestos preexistentes excedidos en rutas admin/courier; esta PR no modifica bundles de UI y no se crea nuevo hallazgo de T-429.
- GitHub indica `mergeable=true`; develop sigue en `15dbf93f21662082bd45ca299d271e855049482a`. Sin `git merge-tree` local por DNS.

### Script analizar.mjs
Se copió el contenido leído de `docs/revision-pr/analizar.mjs` a un entorno temporal mínimo y se ejecutó **en alcance `pr-655` únicamente** con una proyección fiel de sus tres estados de cierre: `3 hallazgos en 1 PR(s)`, `corregidos y VERIFICADOS: 3`, `SIN verificar: 0`, `decisiones PENDIENTES: 0`. La ejecución global con todas las demás carpetas del repo no se pudo realizar sin el clon: **no se presenta como una verificación global**.
