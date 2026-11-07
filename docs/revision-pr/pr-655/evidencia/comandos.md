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