# Harness independiente R12 — contrato allowlist legal H16

**Código:** Copiar este archivo como `/tmp/pr295-r12-harness.cjs` y ejecutarlo en un checkout limpio del SHA `4e26d24feba002b8247ba7feb2c20b052418f9fa` desde la raíz del repo con `node /tmp/pr295-r12-harness.cjs src/features/auth/guards.ts`.

Este harness **NO es test de runtime Next**: extrae la allowlist literal de source, aplica 16 casos y 3 mutaciones en memoria. La revisión ejecutó equivalencia JS sobre texto de source obtenido por GitHub y comprobó ejecutabilidad del script con un excerpt idéntico en `/tmp`. Runtime de guards y seguridad se verifican mediante `guards.test.ts` en CI, no aquí.

```js
'use strict';
const fs = require('node:fs');
const filename = process.argv[2] || 'src/features/auth/guards.ts';
const source = fs.readFileSync(filename, 'utf8');
const match = source.match(/const PUBLIC_LEGAL_ROUTES = new Set\(\[([\s\S]*?)\]\);/);
if (!match) throw new Error('No se encontro PUBLIC_LEGAL_ROUTES; fail-closed');
const routes = [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const expectedPublic = ['/legal','/legal/terms','/legal/privacy','/legal/courier','/legal/pilot'];
const expectedPrivate = ['/legal/admin','/legal/terms/private','/legal/pilot-extra','/legal/terms-bypass','/legal/terms.json','/legal/terms/','/legal2','/courier/feed','/merchant/dashboard','/admin/applicants','/login/mfa'];
const cases = [...expectedPublic.map(path => [path,true]), ...expectedPrivate.map(path => [path,false])];
function failures(check) { return cases.filter(([path,want]) => check(path) !== want).map(([path]) => path); }
function exact(path) { return routes.includes(path); }
const baseline = failures(exact);
if (baseline.length) throw new Error(`Baseline FAIL: ${baseline.join(', ')}`);
const mutations = {
  'sin-terms': failures(p => routes.filter(r => r !== '/legal/terms').includes(p)),
  'prefijo-demasiado-amplio': failures(p => p.startsWith('/legal')),
  'admin-accidental-publico': failures(p => [...routes,'/legal/admin'].includes(p)),
};
for (const [key, red] of Object.entries(mutations)) {
  if (red.length === 0) throw new Error(`Mutacion ${key} no produjo RED`);
}
console.log(`BASELINE GREEN ${cases.length}/${cases.length}`);
for (const [key, red] of Object.entries(mutations)) console.log(`RED ${key}: ${red.join(', ')}`);
console.log('Nota: prueba solo la allowlist literal; NO ejecuta evaluateRouteGuard/Next/middleware');
```

**Salida observada con excerpt idéntico:**
```text
BASELINE GREEN 16/16
RED sin-terms: /legal/terms
RED prefijo-demasiado-amplio: /legal/admin, /legal/terms/private, /legal/pilot-extra, /legal/terms-bypass, /legal/terms.json, /legal/terms/, /legal2
RED admin-accidental-publico: /legal/admin
Nota: prueba solo la allowlist literal; NO ejecuta evaluateRouteGuard/Next/middleware
```
