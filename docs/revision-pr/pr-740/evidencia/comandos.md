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

## Ronda 2 — 2026-11-13 — SHA f5f9b580a2f99410f801f1a0a29e08214fc48226

**Fuentes:** GitHub API del SHA exacto; cuatro archivos modificados autorizados, revisión R1 del revisor intacta. GitHub compare c40676d0..f5f9b580 = 1 commit; develop..HEAD 25 ahead/0 behind. No `git merge-tree` ni descarga de repo: `git ls-remote` falló por DNS del contenedor. No leímos archivos `.env*` ni secretos.

**Autor, según bitácora (no ejecutado por el revisor):** 7 mutaciones de `headers.ts` provocaron RED por la aserción de matriz y GREEN 12/12. Playwright local en `pnpm dev`, `--retries=0`: H03 RED captura vieja Expected 1/Received 0 y GREEN con captura persistente; H04 RED Report-Only `script=load image=load fetch=ok scriptRan=true handlers=/script.js,/probe.png,/probe.json` seguido de Received 0 en el primer poll; GREEN enforce `script=error image=error fetch=rejected scriptRan=false handlers=ninguno`; 2 PASS al restaurar. Se leyó la bitácora, **no los logs crudos de esas corridas locales**. `pnpm dev` no equivale al build productivo para CSP (development permite `unsafe-eval`).

**Revisor, ejecución independiente en JavaScript:** extraje los bloques de directivas de producción, los tokens literales de la prueba, el cuerpo REAL de `page.addInitScript` y el test de bypass del SHA; ejecuté los dos controles de referencia y 13 mutaciones NUEVAS (ocho H02, cinco H03). Ambos controles GREEN, 13 mutaciones detectadas RED, con objetivos reales. No corrí Vitest ni Playwright en contenedor. El harness completo sigue abajo; si se copia a `/tmp/pr740-r2-independent.mjs` y se ejecuta desde el checkout exacto de `f5f9b580`, solo lee archivos de producción/tests y **no escribe ni toca redes**.

**CI remota:** run [43391477598](https://github.com/cadeApp/cadeApp/actions/runs/43391477598), job [131772194379](https://github.com/cadeApp/cadeApp/actions/runs/43391477598/job/131772194379): `headers.test.ts` 12 PASS; `209/209` archivos Vitest/`3964/3964` casos; `verify-workflows.test.mjs` `86/86`; ADR `6/6`. Build, typecheck, lint, audit y bundle budget con estado success al consultar; db-tests todavía en curso. No se observó e2e-preview ejecutado para ese SHA (runner compartido tiene otros trabajos pendientes). El E2E de producción sigue siendo gate para merge.

### Harness R2 completo

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.argv[2] || process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const prod = read('src/security/headers.ts');
const unit = read('src/security/headers.test.ts');
const e2e = read('e2e/specs/security-headers.spec.ts');

// H02: ejecutar el literal de directivas de PRODUCCIÓN y el mapa literal del UNIT, sin ejecutar Vitest.
const dm = prod.match(/const directives: Record<string, string\[\]> = (\{[\s\S]*?\n  \});/);
const um = unit.match(/expect\(parsed\)\.toEqual\((\{[\s\S]*?\n    \})\);/);
assert.ok(dm && um, 'H02: SIN OBJETIVO: no se encuentran ambos bloques');
const actual = (body) => new Function(
  "const GOOGLE_MAPS_SCRIPT_HOSTS=['https://maps.googleapis.com','https://maps.gstatic.com'];" +
  "const GOOGLE_MAPS_ASSET_HOSTS=['https://*.googleapis.com','https://*.gstatic.com','https://*.google.com'];" +
  "const supabaseHttp=['https://abcd1234.supabase.co'];" +
  "const supabaseRealtime=['wss://abcd1234.supabase.co'];const isDevelopment=false;return (" + body + ");"
)();
const expected = new Function(
  "const mapsScript=['https://maps.googleapis.com','https://maps.gstatic.com'];" +
  "const googleWildcards=['https://*.googleapis.com','https://*.gstatic.com','https://*.google.com'];" +
  "return (" + um[1] + ");"
)();
assert.deepEqual(actual(dm[1]), expected, 'H02 original no es GREEN');
console.log('H02 CONTROL GREEN: 12 directivas exactas');
const changes = [
  ['M13 default data', (s) => s.replace("'default-src': [\"'self'\"]", "'default-src': [\"'self'\", 'data:']")],
  ['M14 unsafe-eval en prod', (s) => s.replace("...(isDevelopment ? [\"'unsafe-eval'\"] : []),", "\"'unsafe-eval'\",")],
  ['M15 quitar blob img', (s) => s.replace("'img-src': [\"'self'\", 'data:', 'blob:',", "'img-src': [\"'self'\", 'data:',")],
  ['M16 img host externo', (s) => s.replace("'img-src': [\"'self'\",", "'img-src': [\"'self'\", 'https://evil.example',")],
  ['M17 form wildcard', (s) => s.replace("'form-action': [\"'self'\"]", "'form-action': ['*']")],
  ['M18 frame self', (s) => s.replace("'frame-ancestors': [\"'none'\"]", "'frame-ancestors': [\"'self'\"]")],
  ['M19 host Maps duplicado', (s) => s.replace("...GOOGLE_MAPS_SCRIPT_HOSTS],", "...GOOGLE_MAPS_SCRIPT_HOSTS, 'https://maps.googleapis.com'],")],
  ['M20 object data', (s) => s.replace("'object-src': [\"'none'\"]", "'object-src': ['data:']")],
];
for (const [id, mutate] of changes) {
  const altered = mutate(dm[1]);
  assert.notEqual(altered, dm[1], id + ' SIN OBJETIVO');
  assert.throws(() => assert.deepEqual(actual(altered), expected), undefined, id + ' SOBREVIVIÓ');
  console.log('H02 ' + id + ': RED del comparador independiente');
}

// H03: ejecutar el callback REAL de page.addInitScript en dos documentos simulados del mismo origen.
const open = 'await page.addInitScript((key) => {';
const start = e2e.indexOf(open);
const end = e2e.indexOf('}, CSP_CAPTURE_KEY);', start);
assert.ok(start >= 0 && end > start, 'H03 SIN OBJETIVO');
const init = e2e.slice(start + open.length, end)
  .replace('let storage: Storage;', 'let storage;')
  .replace('const stored: unknown', 'const stored');
function twoDocuments(source) {
  const store = new Map();
  const sessionStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, v),
  };
  const install = () => {
    let cb = null;
    const window = { sessionStorage };
    const document = { addEventListener: (name, fn) => { if (name === 'securitypolicyviolation') cb = fn; } };
    new Function('key','window','document','URL',source)('__t436_csp_violations', window, document, URL);
    assert.ok(cb, 'H03 no instaló listener');
    return cb;
  };
  const listener = install();
  listener({ blockedURI:'https://csp-test.invalid/script.js?private=redacted', effectiveDirective:'script-src-elem', disposition:'enforce' });
  const before = JSON.parse(sessionStorage.getItem('__t436_csp_violations'));
  install(); // navegación: nuevo document y window, sessionStorage mismo
  const after = JSON.parse(sessionStorage.getItem('__t436_csp_violations'));
  return { before, after };
}
const invariant = (result) => {
  assert.equal(result.before.length, 1);
  assert.deepEqual(result.after, [{ directive:'script-src-elem', disposition:'enforce', origin:'https://csp-test.invalid' }]);
};
invariant(twoDocuments(init));
console.log('H03 CONTROL GREEN: persistencia y minimización');
const captures = [
  ['M08 reset en cada navegación', (s) => s.replace("if (storage.getItem(key) === null) storage.setItem(key, '[]');", "storage.setItem(key, '[]');")],
  ['M09 no persistir evento', (s) => s.replace('storage.setItem(key, JSON.stringify(list));', 'void list;')],
  ['M10 directiva incorrecta', (s) => s.replace('directive: event.effectiveDirective', "directive: 'none'")],
  ['M11 no minimizar origin', (s) => s.replace("origin = url.origin === 'null' ? url.protocol : url.origin", "origin = event.blockedURI")],
  ['M12 disposición incorrecta', (s) => s.replace('disposition: event.disposition', "disposition: 'report'")],
];
for (const [id, mutate] of captures) {
  const altered = mutate(init);
  assert.notEqual(altered, init, id + ' SIN OBJETIVO');
  assert.throws(() => invariant(twoDocuments(altered)), undefined, id + ' SOBREVIVIÓ');
  console.log('H03 ' + id + ': RED del control independiente');
}

// H04: sólo inspección estructural; no fingir E2E real.
const from = e2e.indexOf("test('T-436: la CSP forzada bloquea");
const to = e2e.indexOf("test('T-436: la captura CSP conserva", from);
assert.ok(from >= 0 && to > from, 'H04 SIN OBJETIVO');
const bypass = e2e.slice(from, to);
const log = bypass.indexOf('[T-436 bypass]');
const poll = bypass.indexOf('await expect.poll(() => blockedBy(');
assert.ok(log >= 0 && poll > log, 'H04: diagnóstico no precede al poll');
assert.ok(bypass.includes("expect(reachedHandler).toEqual([])"), 'H04: se debilitó expectativa de handlers');
assert.ok(bypass.includes("scriptRan: false"), 'H04: se debilitó expectativa de ejecución');
console.log('H04: diagnóstico antes del poll, aserciones conservadas (solo inspección)');
console.log('NOTA: los 13 RED son sobre código extraído en JS; no son Vitest/E2E de navegador');

```

### Salida independiente observada

```text
H02 CONTROL GREEN: 12 directivas exactas
H02 M13 default data: RED del comparador independiente
H02 M14 unsafe-eval en prod: RED del comparador independiente
H02 M15 quitar blob img: RED del comparador independiente
H02 M16 img host externo: RED del comparador independiente
H02 M17 form wildcard: RED del comparador independiente
H02 M18 frame self: RED del comparador independiente
H02 M19 host Maps duplicado: RED del comparador independiente
H02 M20 object data: RED del comparador independiente
H03 CONTROL GREEN: persistencia y minimización
H03 M08 reset en cada navegación: RED del control independiente
H03 M09 no persistir evento: RED del control independiente
H03 M10 directiva incorrecta: RED del control independiente
H03 M11 no minimizar origin: RED del control independiente
H03 M12 disposición incorrecta: RED del control independiente
H04: diagnóstico antes del poll, aserciones conservadas (solo inspección)
```

**Limitación de esta verificación:** ejecutar el callback TS extraído (con dos anotaciones eliminadas) contra un `sessionStorage` simulado no es Chromium. La autoría de los RED E2E locales se mantiene atribuida al autor; el revisor no los presenta como reproducidos. No disparar manualmente `e2e-preview` ni `e2e-mutation`. Ambos `RED_CONFIRMED` del catálogo requieren develop **ya mergeado**.
