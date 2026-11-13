# Evidencia y comandos — PR #740, ronda 1
**SHA:** `3350cdb48eb06893626e6d488549d4183805617e`. Lectura GitHub API; no clon local ni acceso a secretos, ni `git merge-tree` ni ejecución local de pnpm/Playwright.

## Evidencia ajena reproducida por inspección de logs
- [e2e-preview Report-Only 43353369384](https://github.com/cadeApp/cadeApp/actions/runs/43353369384), SHA `fd27eaf1`: primer poll `script-src-elem/enforce` falla tres veces, Storage y Realtime PASS, 126 passed/1 failed/1 flaky. No muestra scriptRan, fetch/image o reachedHandler; en CI se aplican dos retries.
- [CI enforce 43358787986](https://github.com/cadeApp/cadeApp/actions/runs/43358787986), SHA `d062028d`: Vitest 3963 PASS, `unit` FAIL por `expectedFailure` sin matcher.
- [CI del arreglo H01 43386434429](https://github.com/cadeApp/cadeApp/actions/runs/43386434429), SHA `3350cdb4`: job `unit 131755898995` con Vitest 3963/3963 y `verify-workflows.test.mjs` 86/86.

## Script COMPLETO del revisor, independiente de la batería del autor

Guardar el siguiente código **en `/tmp/pr740-independent.mjs`** y ejecutar desde checkout limpio del SHA revisado: `node /tmp/pr740-independent.mjs "$PWD"`. Nunca cambia archivos ni llama a servicios remotos. La lógica de las seis mutaciones fue ejecutada por el revisor sobre el contenido del SHA recuperado por GitHub: GREEN original, 6/6 RED *estructurales*. **Esto no prueba que Vitest haya quedado RED**; el agy debe ejecutar mutaciones temporales verdaderas contra los nuevos unit tests.

```js
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.argv[2]||process.cwd();
const read=(p)=>readFileSync(resolve(root,p),'utf8');
const src=read('src/security/headers.ts');
const unit=read('src/security/headers.test.ts');
const spec=read('e2e/specs/security-headers.spec.ts');
const names=['default-src','script-src','style-src','img-src','connect-src','font-src','worker-src','manifest-src','frame-ancestors','object-src','base-uri','form-action'];
const line=(s,n)=>s.match(new RegExp("^    '"+n+"': \\[(.*)\\],?$",'m'))?.[1]||null;
function control(s){
 for(const n of names)assert.ok(line(s,n),'sin directiva '+n);
 for(const [n,words] of Object.entries({
 'script-src':['GOOGLE_MAPS_SCRIPT_HOSTS','unsafe-inline'],
 'style-src':['fonts.googleapis.com'],
 'font-src':['fonts.gstatic.com'],
 'img-src':['...supabaseHttp','GOOGLE_MAPS_ASSET_HOSTS'],
 'connect-src':['...supabaseHttp','...supabaseRealtime'],
 'worker-src':['blob:']
 }))for(const w of words)assert.ok(line(s,n).includes(w),n+' sin '+w);
}
control(src);console.log('CONTROL GREEN');
const mutations=[
 ['M01 style-src',s=>s.replace(/^    'style-src':.*\n/m,'')],
 ['M02 font-src',s=>s.replace(/^    'font-src':.*\n/m,'')],
 ['M03 worker blob',s=>s.replace("'worker-src': [\"'self'\", 'blob:']","'worker-src': [\"'self'\"]")],
 ['M04 connect HTTPS',s=>s.replace("'connect-src': [\"'self'\", ...supabaseHttp,","'connect-src': [\"'self',")],
 ['M05 connect WSS',s=>s.replace("'connect-src': [\"'self'\", ...supabaseHttp, ...supabaseRealtime,","'connect-src': [\"'self', ...supabaseHttp,")],
 ['M06 Maps scripts',s=>s.replace(/('script-src': \[.*), \.\.\.GOOGLE_MAPS_SCRIPT_HOSTS\],/,'$1],')]
];
for(const [n,change] of mutations){
 const altered=change(src);
 assert.notEqual(altered,src,n+' SIN OBJETIVO');
 assert.throws(()=>control(altered),undefined,n+' SOBREVIVIO');
 console.log(n+': RED por control independiente');
}
for(const n of ['style-src','font-src'])assert.ok(!unit.includes(n),'Hay que reexaminar H02 '+n);
assert.ok(spec.includes("Object.defineProperty(window, '__t436CspViolations'"),'H03 SIN OBJETIVO');
assert.ok(spec.includes('const store: { directive: string; disposition: string; origin: string }[] = [];'),'H03 SIN OBJETIVO store');
assert.ok(spec.includes('return page.evaluate(() => {'),'H03 SIN OBJETIVO read');
console.log('H03: store por documento + lectura solo de ventana final');
const a=spec.indexOf("test('T-436: la CSP forzada bloquea");
const b=spec.indexOf("test('T-436: Storage",a);
assert.ok(a>=0&&b>a,'H04 SIN OBJETIVO');
const body=spec.slice(a,b),poll=body.indexOf('await expect.poll(() => blockedBy('),end=body.indexOf('expect(attempt).toEqual(');
assert.ok(poll>=0&&end>poll,'H04 YA NO SE REPRODUCE');
assert.ok(!body.slice(0,poll).includes('console.log('),'H04 YA TIENE LOG PRE-POLL');
console.log('H04: primer poll antes de assertions de resultados; falta log previo');
console.log('Esto solo prueba código estructural en memoria; NO Vitest ni E2E');
```

### Resultado de la evaluación independiente en memoria

```text
CONTROL GREEN
M01 style-src: RED por control independiente
M02 font-src: RED por control independiente
M03 worker blob: RED por control independiente
M04 connect HTTPS: RED por control independiente
M05 connect WSS: RED por control independiente
M06 Maps scripts: RED por control independiente
H03: store por documento + lectura solo de ventana final
H04: primer poll antes de assertions de resultados; falta log previo
```

El test original de H04 **no registró** las cuatro propiedades positivas en el RED antes de enforce. No inferir los resultados por ausencia de una aserción; el próximo autor debe agregar log minimizado antes del poll y reproducir de forma autorizada o dejar H04 sin evidencia plena.

## Comandos para la próxima ronda (solo en checkout local limpio)

```bash
git fetch origin
git diff origin/develop...HEAD --stat
git diff --check
pnpm exec vitest run src/security/headers.test.ts
node --test .github/workflows/verify-workflows.test.mjs
pnpm typecheck && pnpm lint && pnpm test
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
```

No levantar Supabase ni Docker local ni forzar workflows; `e2e-mutation` es trusted y solo admite `develop` mergeado. Mutaciones de código temporales: guardarlo primero en memoria y restaurar con `try/finally`, **no** `git checkout`. No inventar resultados RED/GREEN. No se exige nueva CI verde únicamente por cambios documentales.
