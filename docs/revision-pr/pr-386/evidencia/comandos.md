# Evidencia — PR #386 / ronda 1

SHA examinado `20671da159f9ff0caf83c88abc623f2998ced954`. Datos remotos: CI https://github.com/cadeApp/cadeApp/actions/runs/38962593100, E2E anterior https://github.com/cadeApp/cadeApp/actions/runs/38957275905 y Maps https://developers.google.com/maps/documentation/urls/get-started.

**Límites:** el revisor no dispone de clon ni de red GitHub desde el contenedor; los comandos siguientes están preparados para reproducir en un clon y NO fueron ejecutados contra él. No se inventa mutación RED→GREEN. Cálculo aislado sí ejecutado con Node: 5 drops implican 4 waypoints; una URL de origen+destino de 200 caracteres `Á` cada una mide 2459 caracteres; al zoom 14 la separación latitudinal de límites de Aguilares necesita ≈1313 px, contra 192 del mapa.

## Script independiente para /tmp (completo, solo lectura de git)

Requiere `pnpm install` realizado previamente para `typescript`. Carga el **código real** de `maps.ts` y `route-points.ts` desde el SHA por `git show`, transpila en memoria; el mock del schema solo rechaza coordenadas nulas y no afecta la composición de links.

```bash
cat > /tmp/pr386-probes.mjs <<'NODE'
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const ref = process.argv[2] || '20671da159f9ff0caf83c88abc623f2998ced954';
const ts = createRequire(resolve('package.json'))('typescript');
const read = (file) => execFileSync('git', ['show', ref + ':' + file], { encoding: 'utf8' });
const compile = (file, deps = {}) => {
  const js = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  new Function('module','exports','require',js)(mod,mod.exports,(id) => {
    if (Object.hasOwn(deps,id)) return deps[id];
    throw new Error('Dependencia inesperada: ' + id);
  });
  return mod.exports;
};
const maps = compile('src/features/trips/maps.ts');
const noCoord = { safeParse: () => ({success:false}) };
const routes = compile('src/features/trips/route-points.ts', {
  '@/domain': { aguilaresLatSchema:noCoord, aguilaresLngSchema:noCoord },
  './maps': maps
});
const make = (n,address=(i)=>'Calle '+i+', Aguilares') => ({
  pickupAddress:address(0),pickupZoneName:'Centro',pickupLat:null,pickupLng:null,
  dropoffAddress:address(1),dropoffZoneName:'Centro',
  drops:Array.from({length:n},(_,i)=>({
    position:i+1,dropoffAddress:address(i+1),dropoffZoneName:'Centro',
    dropoffLat:null,dropoffLng:null
  }))
});
const urls = (plan) => plan.navigationLegs
  ? plan.navigationLegs.map(x=>x.url).filter(Boolean)
  : [plan.externalUrl];
const wp = (url) => {
  const s = new URL(url).searchParams.get('waypoints');
  return s ? s.split('|').length : 0;
};
let red=0;
function check(name,fn){
  try { fn(); console.log('GREEN '+name); }
  catch(e){ red++; console.error('RED '+name+': '+e.message); }
}
const five=urls(routes.buildTripRoutePlan(make(5)));
console.log('URL count='+five.length+', waypoints='+five.map(wp).join(','));
check('H01 max 3 waypoints por URL',() =>
  assert.ok(five.every(u=>wp(u)<=3),'límite móvil excedido'));
const long=urls(routes.buildTripRoutePlan(make(5,()=> 'Á'.repeat(200))));
check('H01 longitudes <=2048',() =>
  assert.ok(long.every(u=>u.length<=2048),'límite de URL excedido'));
const map=read('src/features/trips/components/trip-route-map.tsx');
check('H02 viewport cubre extremos',()=>{
  const fit=/[.]fitBounds\s*[(]/.test(map);
  const z=Number(map.match(/defaultZoom=\{(\d+)\}/)?.[1]||14);
  const pixels=0.10*256*(2**z)/(360*Math.cos(-27.43*Math.PI/180));
  assert.ok(fit||pixels<=192,'requiere '+Math.round(pixels)+'px y hay 192');
});
console.log('RED esperados en HEAD examinado=3; obtenidos='+red);
process.exitCode=red?1:0;
NODE
node /tmp/pr386-probes.mjs 20671da159f9ff0caf83c88abc623f2998ced954
```

Se espera fallo del **control independiente** frente al código actual, no un RED de suite de Vitest ya corrido por el revisor. No confundir el script con una mutación real: para aprobar se exigen mutaciones propias posteriores y resultados reales.

## Comandos de revisión en clon limpio

```bash
git fetch origin
git ls-remote origin feat/T-363-mapa-recorrido-fallback
git merge-tree --write-tree origin/develop HEAD
git diff --check origin/develop...HEAD
pnpm exec vitest run src/features/trips/route-map.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
# db-tests: leer el job de CI, no levantar Supabase o Docker local
```

E2E: flujo normal Preview de la PR y verificar su HEAD exacto, job Chromium completo, global-settings y cleanup; no disparar workflows manuales. Guardar salidas resumidas y redactar nueva ronda sin reescribir esta.

## Ronda 2 (2026-10-16) — Batería **independiente** en memoria sobre SHA `99e3b2a`

**Método y resultado real:** El revisor obtuvo los archivos fuente exactos del SHA por GitHub conectado. Evaluó mediante JavaScript los cuerpos originales de `buildLegUrl`, `buildNavigationLegs`, `computeRouteBounds` y `RouteBoundsFitter` tras retirar **únicamente anotaciones TypeScript**; se inyectaron el serializador de Maps (igual a `maps.ts`), `useMap` y `React.useEffect` de prueba. No modificó ningún archivo ni runner. La batería NO es de autor, ni ejecuta UI Next completa. Los controles base fueron GREEN y las nueve mutaciones propias RED:
- Navigation GREEN; mutación MAX_WAYPOINTS 3→4 RED `mas de 3 waypoints`; frontera `start=end+1` RED `se pierde o duplica una parada`; longitud sin límite RED `tramo manual no representado`; URL demasiado larga aceptada RED `tramo manual no representado`.
- Bounds GREEN; mutación norte máximo→mínimo RED `extremos no cubiertos`; span mínima→0 RED `coincidentes sin margen`.
- Fitter con mapa GREEN, sin mapa GREEN; mutaciones eliminar fitBounds, invertir norte/sur y padding 32→0 RED `no ajusta cámara con bounds completos y padding`.

### Harness completo para reproducir en un clon (solo lectura)

Los resultados se obtuvieron ejecutando los mismos cuerpos reales con mutaciones en memoria; el siguiente script reconstruye la batería desde `git show` en un clon.

```bash
cat > /tmp/pr386-r2-invariants.mjs <<'NODE'
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const sha=process.argv[2]||'99e3b2ab097326625da4d58f59718976eb643c96';
const read=p=>execFileSync('git',['show',sha+':'+p],{encoding:'utf8'});
const r=read('src/features/trips/route-points.ts'),m=read('src/features/trips/components/trip-route-map.tsx');
let nav=r.slice(r.indexOf('function buildLegUrl('))
.replace('function buildLegUrl(stops: readonly RouteStop[]): string {','function buildLegUrl(stops) {')
.replace('export function buildNavigationLegs(stops: readonly RouteStop[]): NavigationLeg[] {','function buildNavigationLegs(stops) {')
.replace('const legs: NavigationLeg[] = [];','const legs = [];')
.replace('let leg: NavigationLeg | null = null;','let leg = null;');
if(!nav.includes('function buildNavigationLegs(stops)'))throw Error('cambio inesperado de firma nav');
const makeNav=(code,max=3,len=2048)=>new Function('MAX_NAVIGATION_WAYPOINTS','MAX_NAVIGATION_URL_LENGTH','toUrlEndpoint','buildGoogleMapsDirectionsUrl',code+'; return buildNavigationLegs')(max,len,s=>s.coordinate??s.address,({origin,destination,waypoints})=>{
 const ser=v=>typeof v==='string'?v:v.lat+','+v.lng;
 let url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(ser(origin))+'&destination='+encodeURIComponent(ser(destination));
 if(waypoints?.length)url+='&waypoints='+encodeURIComponent(waypoints.map(ser).join('|'));
 return url;
});
const make=(n,addr=i=>'Dirección '+i+' Aguilares')=>Array.from({length:n+1},(_,i)=>({label:i?'Entrega '+i:'Retiro',address:addr(i),coordinate:null}));
function navInvariant(fn){
 const legs=fn(make(9));
 const ordered=legs.flatMap((leg,i)=>(i?leg.stops.slice(1):leg.stops)).map(s=>s.label);
 assert.deepEqual(ordered,make(9).map(s=>s.label),'se pierde o duplica una parada');
 assert.ok(legs.every(l=>l.stops.length<=5),'más de 3 waypoints');
 assert.ok(legs.every(l=>l.url===null||l.url.length<=2048),'URL supera 2048');
 assert.equal(fn(make(1,()=> 'Á'.repeat(200)))[0].url,null,'tramo manual no representado');
}
const bs=m.slice(m.indexOf('function computeRouteBounds('),m.indexOf('/**\n * Encuadra el mapa',m.indexOf('function computeRouteBounds('))).replace('function computeRouteBounds(points: readonly RouteCoordinate[]): RouteBounds | null {','function computeRouteBounds(points) {');
if(!bs.includes('function computeRouteBounds(points)'))throw Error('firma bounds cambiada');
const buildBounds=(src,min=0.002)=>new Function('MIN_ROUTE_BOUNDS_SPAN_DEG',src+'; return computeRouteBounds')(min);
function boundsInvariant(fn){
 const b=fn([{lat:-27.48,lng:-65.64},{lat:-27.38,lng:-65.58}]);
 assert.ok(b.north>=-27.38&&b.south<=-27.48&&b.east>=-65.58&&b.west<=-65.64,'extremos no cubiertos');
 const x=fn([{lat:-27.43,lng:-65.61},{lat:-27.43,lng:-65.61}]);
 assert.ok(x.north-x.south>=0.0019&&x.east-x.west>=0.0019,'coincidentes sin margen');
}
const fitter=m.slice(m.indexOf('function RouteBoundsFitter('),m.indexOf('export interface TripRouteMapDrop')).replace('function RouteBoundsFitter({ bounds }: { bounds: RouteBounds }) {','function RouteBoundsFitter({ bounds }) {');
if(!fitter.includes('function RouteBoundsFitter({ bounds })'))throw Error('firma fitter cambiada');
function fitterInvariant(source,withMap){
 const calls=[],map=withMap?{fitBounds:(...args)=>calls.push(args)}:null;
 const comp=new Function('useMap','React','ROUTE_BOUNDS_PADDING_PX',source+'; return RouteBoundsFitter')(()=>map,{useEffect:fn=>fn()},32);
 comp({bounds:{north:-27.38,south:-27.48,east:-65.58,west:-65.645}});
 if(withMap)assert.deepEqual(calls,[[{north:-27.38,south:-27.48,east:-65.58,west:-65.645},32]],'no ajusta cámara con bounds completos y padding');
 else assert.equal(calls.length,0,'fitBounds sin mapa');
}
let red=0,green=0;
function check(name,fn,wantRed=false){
 try{fn(); if(wantRed)throw Error('NO RED: mutación quedó verde'); green++;console.log('GREEN '+name);}
 catch(e){if(!wantRed)throw e; red++;console.log('RED '+name+': '+e.message);}
}
check('Navegación original',()=>navInvariant(makeNav(nav)));
check('Navegación M1 waypoints 3->4',()=>navInvariant(makeNav(nav,4)),true);
check('Navegación M2 se pierde frontera',()=>navInvariant(makeNav(nav.replace('start = end;','start = end + 1;'))),true);
check('Navegación M3 se quita límite URL',()=>navInvariant(makeNav(nav.replace('if (url.length <= MAX_NAVIGATION_URL_LENGTH) {','if (true) {'))),true);
check('Navegación M4 enlace manual inválido',()=>navInvariant(makeNav(nav.replace('leg = { stops: legStops, url: null };','leg = { stops: legStops, url };'))),true);
check('Bounds originales',()=>boundsInvariant(buildBounds(bs)));
check('Bounds M5 norte min',()=>boundsInvariant(buildBounds(bs.replace('Math.max(...lats)','Math.min(...lats)'))),true);
check('Bounds M6 sin margen',()=>boundsInvariant(buildBounds(bs,0)),true);
check('Fitter original con mapa',()=>fitterInvariant(fitter,true));
check('Fitter original sin mapa',()=>fitterInvariant(fitter,false));
check('Fitter M7 sin fitBounds',()=>fitterInvariant(fitter.replace('map.fitBounds({ north, south, east, west }, ROUTE_BOUNDS_PADDING_PX);','/* sin fitBounds */'),true),true);
check('Fitter M8 norte invertido',()=>fitterInvariant(fitter.replace('map.fitBounds({ north, south, east, west }, ROUTE_BOUNDS_PADDING_PX);','map.fitBounds({north:south,south:north,east,west}, ROUTE_BOUNDS_PADDING_PX);'),true),true);
check('Fitter M9 sin padding',()=>fitterInvariant(fitter.replace('map.fitBounds({ north, south, east, west }, ROUTE_BOUNDS_PADDING_PX);','map.fitBounds({north,south,east,west}, 0);'),true),true);
assert.equal(red,9);assert.equal(green,4);
console.log('Resumen GREEN originales='+green+', RED mutaciones='+red);
NODE
node /tmp/pr386-r2-invariants.mjs 99e3b2ab097326625da4d58f59718976eb643c96
```

El arnés ha sido diseñado con los mismos reemplazos que los usados en la ejecución independiente del revisor; **no se afirma que este archivo de /tmp se haya probado contra un clon** porque desde aquí falla el DNS de github.com. No se hace commit de scripts al proyecto.

### Evidencia CI real del SHA

- `unit` job 117197915609: `Test Files 135 passed (135); Tests 2450 passed (2450)`.
- `db-tests` job 117197915977: `Files=26, Tests=2341, Result: PASS`.
- `build` job 117197915672: `src/app/layout.tsx` `next/font` `TypeError: Cannot read properties of null (reading '1')` → EXIT 1; bundle-budget omitido. [CI 38967624235](https://github.com/cadeApp/cadeApp/actions/runs/38967624235).
- E2E `e2e-preview` run 38967749373, job 117198417323: checkout `99e3b2a`, `81 passed (19.7m)` Chromium incluido caso de cinco drops; `3 passed (1.0m)` global-settings. El `head_sha` de workflow por repository_dispatch es develop, **no** el SHA que se testeó. [E2E exact SHA](https://github.com/cadeApp/cadeApp/actions/runs/38967749373).

## Ronda 3 — SHA exacto `ddae87422246df38ad7fa96142260993125a6f4f` (2026-10-16)

**Origen:** GitHub conectado; sin clon local por DNS de `github.com`. Los siguientes son comandos reproducibles en clon; **no fueron ejecutados localmente por el revisor**. Los resultados CI/E2E que se consignan sí vienen de logs abiertos, no de una afirmación del autor.

```bash
git fetch origin
git rev-parse origin/feat/T-363-mapa-recorrido-fallback
git diff --name-status 6e76e28874179ecc11f51e09f9b147ef5c233989..ddae87422246df38ad7fa96142260993125a6f4f
git show --stat ddae87422246df38ad7fa96142260993125a6f4f
git merge-tree --write-tree origin/develop ddae87422246df38ad7fa96142260993125a6f4f
node docs/revision-pr/analizar.mjs verificacion
pnpm exec vitest run tools/verify-fichas.test.ts
git diff --check origin/develop...ddae87422246df38ad7fa96142260993125a6f4f
```

**Comprobado por GitHub API `compare(6e76e28,ddae874)`:** +23/-0, **solo `docs/tasks/log/T-363.md`**; ficha desde `develop` idéntica a la del HEAD; directorio `docs/revision-pr/pr-386/**` intacto. Head remoto `ddae874`, parent `6e76e28`. No requieren mutaciones independientes adicionales del código que no cambió; el script íntegro de R2 permanece arriba y es el control reproducible.

- CI HEAD: https://github.com/cadeApp/cadeApp/actions/runs/38975035726
  - unit job 117222316573: `135 passed (135)`, `2464 passed (2464)`.
  - db-tests job 117222316505: `Files=26, Tests=2341, Result: PASS`; `pnpm db:types --local` y `git diff --exit-code -- src/types/database.types.ts`.
  - build job 117222316546: `Compiled successfully in 25.4s`; `/trips/[id] 225 kB`, `/merchant/requests/[id] 192 kB`.
  - bundle job 117222771744: SUCCESS con WARNING por rutas sobre 180 kB.
  - audit, typecheck, lint SUCCESS; approval-policy run 38975034935 SUCCESS.
- E2E HEAD: https://github.com/cadeApp/cadeApp/actions/runs/38975178318 ; job 117237111767: checkout exacto `ddae87422246df38ad7fa96142260993125a6f4f`; `81 passed (20.1m)` Chromium y `3 passed (58.7s)` global-settings; prueba multi-drop #386 incluida PASS.

**Ausencia de verificación local:** `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` devolvió `fatal: ... Could not resolve host: github.com`. No se encendieron contenedores ni Supabase local/remoto. No se fabricó RED ni prueba mutada; se conserva la de R2 con su SHA de verificación.

**Acciones posteriores:** esperar decisión/merge independiente de PR #385, fusionar `develop` sin rebase en la rama T-363 y probar el SHA combinado; no inferir que el E2E anterior certifica código posterior a ese merge.

## Ronda 4 — revalidación post-merge #385 · SHA examinado `f91a414ea424f9262de89be458a5b21b10c1cba5`

**Comprobaciones efectivamente efectuadas a través de GitHub:** PR #385 `merged:true`, PR #386 abierta, merge commit `278c11fb` con segundo padre `cc7fb54b` (HEAD de develop). `f91a414` parent `278c11fb`; solo modificó `docs/tasks/log/T-363.md`. `compare(develop,f91a414)` lista 26 archivos propios; contiene la ampliación autorizada de T-363 (17 líneas) ausente en develop por #385. No hay modificaciones de componentes de otras PRs en ese diff neto.

**SHA de blobs idénticos entre `7e55ba0` y `f91a414`:**
```
src/features/trips/route-points.ts                   5d6c15175043ec6ec318ae7b0caad74708ffbe26
src/features/trips/components/trip-route-map.tsx      e89489b7fc7ba9e9fd31c226901612a09f78aab9
e2e/specs/map-privacy.spec.ts                        a2b55e8ad866ad719b17c74d88683d3eda1ae4d3
src/features/offers/queries.ts                       891185027542a93548c3b6f68224815b0cbb94cb
src/features/requests/components/request-offers-list.tsx fa9d484f3cd954fc1b316a3a47daddf224b770f5
src/server/live/t204.ts                              433bd599017d0c2eddb2e6b6ad0e2dd933fb4318
src/lib/live-contracts.ts                            a3eacd05244fc844051bf4679663ee75714d8f4e
docs/revision-pr/pr-386/hallazgos.jsonl              86f13ce30655d125e78f78b4168b33fc9643169d
```

**CI de merge `278c11f`:** https://github.com/cadeApp/cadeApp/actions/runs/38982843048, logs jobs 117247444555 (unit 2492/2492), 117247444915 (db-tests 26 archivos / 2341 tests PASS), 117247444823 (build SUCCESS); approval-policy run 38982843149 SUCCESS.

**E2E del merge:** https://github.com/cadeApp/cadeApp/actions/runs/38982914091, job 117247720073: logs muestran `git checkout --force 278c11fb`, `main-flow.spec.ts:585` T-360 timeout 60000 ms, `retry #1` PASS, `map-privacy.spec.ts:958` PR386-H01/H02 PASS (16.1 s), salida final `81 passed (24.1m)` + `1 flaky`, luego `3 passed (1.1m)` global-settings. La condición de flaky se mantiene visible.

**CI sobre `f91a414`:** https://github.com/cadeApp/cadeApp/actions/runs/38985572731: `build`, `unit`, `typecheck`, `lint`, `audit`, `bundle-budget`, `approval-policy` PASS; `db-tests` IN_PROGRESS al registrar R4. No presumir conclusión futura.

**Comandos del autor (no ejecutados por el revisor, pero evidencia contrastable):**
```bash
git fetch origin
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run tools/verify-fichas.test.ts
git diff --check origin/develop...HEAD
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Autor registró `merge-tree exit 0 tree 2805a660`, fichas 7/7, test general con timeout 1/2492 y test aislado 10/10; CI completo del mismo merge 2492/2492. Sin mutaciones nuevas del revisor: ninguna función relevante cambió desde la batería independiente R2. No se ejecutaron pruebas locales, Supabase ni Docker.
