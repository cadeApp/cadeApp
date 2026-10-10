# Evidencia propia reproducible — PR #295 Ronda 10

**SHA:** `3b7484e4b310f41d78eb6de06d21a6cedee10686`. Se usó `src/middleware.ts` y `src/middleware.test.ts` del SHA, cotejados por inspección de repositorio y CI. El harness externo reproduce la expresión fuente en Node.js usando regexp nativo JS: **no es una instancia real de `unstable_doesMiddlewareMatch`**. Mutaciones en memoria: no se modificó código GitHub ni feature branch.

Se guardó el siguiente script completo en un archivo temporal local `/tmp/pr295-matcher-review-r10.cjs` y se ejecutó mediante `node /tmp/pr295-matcher-review-r10.cjs`:

```js
'use strict';
const matcherLiteral = '/((?!api|_next/static|_next/image|favicon.ico|manifest\\.webmanifest$|sw\\.js$|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)';
const cases = [
  ['/manifest.webmanifest',false], ['/sw.js',false],
  ['/manifest.webmanifest.bak',true], ['/manifest.webmanifest-extra',true],
  ['/sw.js.map',true], ['/sw.js.backup',true],
  ['/courier/feed',true], ['/merchant/dashboard',true],
  ['/admin/applicants',true], ['/login',true],
  ['/api/health',false], ['/_next/static/chunks/app/page.js',false],
  ['/brand/logo.svg',false], ['/some.css',true]
];
function run(expr) {
  const re = new RegExp('^' + expr + '$');
  return cases.map(([path,want]) => ({path,want,actual:re.test(path)}))
    .filter(x => x.want !== x.actual);
}
const base=run(matcherLiteral);
if(base.length)throw Error('Baseline no pasa: '+JSON.stringify(base));
const mutations = [
  ['no-exclude-manifest',matcherLiteral.replace('manifest\\.webmanifest$|',''),'/manifest.webmanifest'],
  ['no-exclude-sw',matcherLiteral.replace('|sw\\.js$',''),'/sw.js'],
  ['manifest-prefix-bypass',matcherLiteral.replace('manifest\\.webmanifest$','manifest\\.webmanifest'),'/manifest.webmanifest.bak'],
  ['sw-prefix-bypass',matcherLiteral.replace('sw\\.js$','sw\\.js'),'/sw.js.backup']
];
console.log('Baseline: '+cases.length+' casos PASS en motor RegExp JS');
for(const [name,regex,target] of mutations) {
  const fails = run(regex);
  if(!fails.some(x => x.path === target))
    throw Error(name+' no produjo RED esperado '+JSON.stringify(fails));
  console.log(name+': RED '+fails.map(x=>x.path+' esperado='+x.want+' recibido='+x.actual).join(', '));
}
console.log('Mutaciones RED ejecutadas solo en memoria.');
```

**Resultado observado en revisión independiente:**
```
Baseline: 14 casos PASS en motor RegExp JS
no-exclude-manifest: RED /manifest.webmanifest esperado=false recibido=true
no-exclude-sw: RED /sw.js esperado=false recibido=true
manifest-prefix-bypass: RED /manifest.webmanifest.bak esperado=true recibido=false, /manifest.webmanifest-extra esperado=true recibido=false
sw-prefix-bypass: RED /sw.js.map esperado=true recibido=false, /sw.js.backup esperado=true recibido=false
Las 4 mutaciones RED se aplicaron en memoria y no alteraron el repositorio.
```

**Limitaciones:** este script no compila el matcher de Next ni hace GET de Preview; ese alcance fue cubierto parcialmente por tests Next CI. Para manifest/SW en producción se requiere HTTP anónimo y Chrome Android sobre el nuevo deployment.
