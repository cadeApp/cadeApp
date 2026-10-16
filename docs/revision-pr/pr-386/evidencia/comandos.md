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
