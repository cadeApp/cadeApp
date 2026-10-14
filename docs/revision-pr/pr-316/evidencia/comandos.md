# PR #316 — Evidencia y harness reproducible

Fecha 2026-10-09. HEAD de código `839d101fa7b2901c029d815a262b3c8809a1d8ee`.

## Script de revisión independiente

Guardar el siguiente bloque como `/tmp/review-pr316.mjs` y correr desde el **root** del repositorio checkout del SHA funcional: `node /tmp/review-pr316.mjs`. No modifica archivos ni usa redes, tokens, credenciales, scripts del autor ni base remota. Requiere solo Node.

```js
// Reproducir desde el root del repo revisado: node /tmp/review-pr316.mjs
// Script propio de revisión, sin servicios ni secretos ni mutaciones persistentes.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const code = readFileSync('.github/workflows/e2e-mutation.mjs', 'utf8');
const yaml = readFileSync('.github/workflows/e2e-mutation.yml', 'utf8');
const literal = code.match(/^const LOCAL_BASE_URL = (\/.*\/);$/m)?.[1];
assert.ok(literal, 'No se encontró LOCAL_BASE_URL');
const regex = new Function('return (' + literal + ');')();
const accepted = (url) => {
  const match = regex.exec(url);
  return !!match && Number(match[1]) >= 1024 && Number(match[1]) <= 65535;
};
for (const url of ['http://localhost:3100','http://localhost:1024','http://localhost:65535'])
  assert.equal(accepted(url), true, url);
const rejected = ['http://127.0.0.1:3100', 'http://[::1]:3100',
  'https://localhost:3100', 'http://localhost:80', 'http://localhost:65536',
  'http://localhost.evil.example:3100', 'http://localhost:3100/',
  'http://localhost:3100@evil.example', 'http://LOCALHOST:3100',
  'http://localhost:3100?redirect=/x', 'http://localhost:3100#frag',
  'http://localhost:0', 'http://evil.example:3100',
  'http://localhost:3100\\evil', 'http://localhost:443'];
for (const url of rejected) assert.equal(accepted(url), false, url);
function invariant(f= yaml, c=code) {
  return /^\s*PLAYWRIGHT_TEST_BASE_URL: http:\/\/localhost:3100$/m.test(f)
    && (f.match(/^\s*NEXT_PUBLIC_APP_URL: http:\/\/localhost:3100$/gm)||[]).length===2
    && /start: \['pnpm', 'start', '-H', '127\.0\.0\.1'/.test(c);
}
assert.equal(invariant(), true, 'control legítimo');
const alterations = [
  {name:'browser a 127.0.0.1', flow:yaml.replace('PLAYWRIGHT_TEST_BASE_URL: http://localhost:3100','PLAYWRIGHT_TEST_BASE_URL: http://127.0.0.1:3100')},
  {name:'una fase con APP_URL divergente', flow:yaml.replace('NEXT_PUBLIC_APP_URL: http://localhost:3100','NEXT_PUBLIC_APP_URL: http://127.0.0.1:3100')},
  {name:'ambas fases con APP_URL divergente', flow:yaml.replaceAll('NEXT_PUBLIC_APP_URL: http://localhost:3100','NEXT_PUBLIC_APP_URL: http://127.0.0.1:3100')},
  {name:'bind ampliado a 0.0.0.0', src:code.replace("start: ['pnpm', 'start', '-H', '127.0.0.1'","start: ['pnpm', 'start', '-H', '0.0.0.0'")}
];
for (const m of alterations)
  assert.equal(invariant(m.flow ?? yaml,m.src ?? code),false,'mutación sobrevivió: '+m.name);
console.log('CONTROL GREEN: 18 entradas URL (3 aceptadas/15 rechazadas); 4 cambios deliberados detectados RED');

```

**Resultado ejecutado por el revisor sobre los contenidos publicados en ese SHA:** `CONTROL GREEN: 18 entradas URL (3 aceptadas/15 rechazadas); 4 cambios deliberados detectados RED` (validación de rutas y consistencia de configuración; **NO prueba Playwright RED real**).

## Evidencia remota reproducible

- CI: https://github.com/cadeApp/cadeApp/actions/runs/37902006016
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/37902085806
- Bloqueo anterior: https://github.com/cadeApp/cadeApp/actions/runs/37900097487
- PR diff: https://github.com/cadeApp/cadeApp/pull/316/files
- Los logs de CI del HEAD funcional contienen `ok 65` para el test de origen, `# tests 79 / # pass 79 / # fail 0` y el pgTAP `Files=20, Tests=1903, Result: PASS`.
- E2E Chromium muestra un primer intento fallido de T-345 recuperado por `retry #1`; job y status final son success. No confundir esta corrida con `e2e-mutation`.

