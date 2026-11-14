# Comandos reproducibles — PR #708 / T-433 · Ronda 1

**Importante:** la revisión se hizo mediante el conector de GitHub. No se pudo clonar el repositorio ni ejecutar Vitest en este entorno; por ello **no se atribuye ningún RED/GREEN local** al revisor. A continuación está el arnés íntegro para que un entorno con el repositorio y dependencias instaladas lo reproduzca.

## Identidad y control previo

```bash
git fetch origin
git status --short
git rev-parse HEAD
git ls-remote origin feat/T-433-sec08-cron-secret
git diff --name-only dba3314f...e61a9e31
git diff dba3314f...e61a9e31 -- docs/tasks/T-433.md
# El último diff debe quedar vacío. Antes de la ronda 2, comprobar la rama nueva y la base actual.
```

## H01 · Predicado aislado (sí ejecutado por el revisor en Node)

```bash
node <<'NODE'
const crypto = require('node:crypto');
const cron = 'test-cron-secret-0123456789abcdef';
const push = 'test-push-send-secret-0123456789ab';
const incorrectoIgualLongitud = 'Bearer ' + push.slice(0, -1) + 'X';
const casos = [
  ['CRON', 'Bearer ' + cron],
  ['invalido corto', 'Bearer token-invalido'],
  ['invalido igual longitud', incorrectoIgualLongitud],
  ['PUSH valido', 'Bearer ' + push],
];
function authorize(header, mutant) {
  const actual = Buffer.from(header);
  const expected = Buffer.from('Bearer ' + push);
  return !(actual.length !== expected.length || (mutant ? false : !crypto.timingSafeEqual(actual, expected)));
}
for (const [nombre, header] of casos) {
  console.log(nombre, 'length=', Buffer.byteLength(header),
    'normal=', authorize(header, false) ? 200 : 401,
    'mutante=', authorize(header, true) ? 200 : 401);
}
NODE
```

Salida verificada: CRON `40, 401, 401`; invalido corto `21, 401, 401`; invalido igual longitud `41, 401, 200`; PUSH valido `41, 200, 200`. Demuestra un hueco en **el diseño de los tests**, no una falla actual del handler.

## H01 · Arnés íntegro para Vitest (pendiente de ejecutar)

En un worktree **limpio** en el SHA que querés evaluar, con `pnpm install --frozen-lockfile` ya hecho, copiá **este bloque completo** a `/tmp/pr708-h01.mjs`. Se ejecuta con `node /tmp/pr708-h01.mjs` **desde la raíz del repositorio**. No ejecutarlo sobre cambios de autor sin commitear. El script restaura el archivo productivo desde un buffer en memoria; NO usa `git checkout`.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const target = resolve(root, 'src/app/api/push/send/route.ts');
const original = readFileSync(target);
const originalText = original.toString('utf8');
const needle = '!crypto.timingSafeEqual(authHeaderBuf, expectedAuthBuf)';
const hits = originalText.split(needle).length - 1;
if (hits !== 1) throw new Error('Sin objetivo único: no mutar. Coincidencias=' + hits);
const mutant = originalText.replace(needle, 'false');
if (mutant === originalText) throw new Error('La mutación no hizo nada');

function test(label) {
  const run = spawnSync('pnpm', [
    'exec', 'vitest', 'run', 'src/app/api/push/send/route.test.ts',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const log = (run.stdout || '') + '\n' + (run.stderr || '');
  const summary = log.split(/\r?\n/).filter(x => /Test Files|Tests\s+|FAIL |AssertionError/.test(x));
  console.log('\n### ' + label + ' exit=' + run.status);
  console.log(summary.slice(-14).join('\n'));
  if (run.error) throw run.error;
  return run.status;
}

if (readFileSync(target).compare(original) !== 0) throw new Error('El archivo ya cambió');
try {
  if (test('CONTROL SIN MUTAR') !== 0) throw new Error('El control base no pasa. No interpretar mutaciones');
  writeFileSync(target, mutant);
  const red = test('MUTACIÓN: timingSafeEqual desactivado');
  if (red === 0) console.log('H01 CIEGA: suite quedó VERDE con la igualdad de bytes desactivada');
  else console.log('H01 DETECTADA: suite ROJA; mirar que falle por 401 vs 200 y no por mocks');
} finally {
  writeFileSync(target, original);
  if (readFileSync(target).compare(original) !== 0) throw new Error('RESTAURACIÓN FALLIDA');
}
if (test('CONTROL RESTAURADO') !== 0) throw new Error('No volvió a GREEN');
console.log('Restauración bytes exactos: OK. Revisar git status --short');
```

Después de corregir H01, la suite debe ponerse **ROJA por 401 esperado vs 200 recibido** con este mutante y volver a verde sin él. No aceptar un error de import, mock o setup como RED válido. No alterar expectativas para hacerla pasar.

## Reproducción del RED del autor (no ejecutada independientemente)

```bash
git fetch origin
# Usar un worktree separado; no volver a commits anteriores en la rama del autor.
git worktree add --detach /tmp/pr708-red e1887fcf7184f0c06acb0746ce8606d20576caf7
(
  cd /tmp/pr708-red
  pnpm install --frozen-lockfile
  pnpm exec vitest run src/server/env.test.ts src/app/api/push/send/route.test.ts     src/server/e2e/staging-seed.test.ts src/app/api/cron/sweep/route.test.ts     src/app/api/cron/health/route.test.ts > /tmp/pr708-red.log 2>&1
  echo "exit=$?"
  grep -E 'Test Files|Tests[[:space:]]' /tmp/pr708-red.log | tail -8
)
git worktree remove --force /tmp/pr708-red
```

El autor declara `Tests 8 failed | 105 passed (113)`, pero sin correr este bloque no se marca como reproducido. Para `d0096c1d`, repetir en otro worktree limpio y contrastar el `121 passed` declarado.

## GitHub Actions observado

- Run: https://github.com/cadeApp/cadeApp/actions/runs/43180302035
- Head del run: `e61a9e318208cf3385f80f4eadb8af95c304799e`; `unit`: `Test Files 204 passed (204)`, `Tests 3871 passed (3871)`.
- `build`, `typecheck` y `lint`: SUCCESS.
- `db-tests`: todavía RUNNING en la lectura del revisor. No se levanta Supabase/Docker local.
- `bundle-budget`: SUCCESS advisory; `/api/push/send`: 104 kB OK, otras rutas con warnings preexistentes no atribuibles al cambio.

## Validación del reporte

```bash
node docs/revision-pr/analizar.mjs verificacion
git diff --name-only
# stagear SOLO docs/revision-pr/pr-708/ y respetar que los hallazgos son exclusivos del revisor
```

---

# Ronda 2 — verificación independiente del arreglo H01

**SHA del código revisado:** `0d5616b8e7efa85325a2ddeda31a773f4cb838a0`. **Solo inspección de repositorio a través de GitHub y ejecución local del predicado aislado con Node**. No se ejecutó Vitest. Ningún script bajo `docs/revision-pr/**` fue ejecutado.

## Diferencia exacta R1 → R2

```bash
git fetch origin
git diff --name-only 9fa2b836cec7450826b7a880907cadf51d935c28 0d5616b8e7efa85325a2ddeda31a773f4cb838a0
# Observado por la API compare de GitHub:
# docs/tasks/log/T-433.md
# src/app/api/push/send/route.test.ts
git diff 9fa2b836cec7450826b7a880907cadf51d935c28 0d5616b8e7efa85325a2ddeda31a773f4cb838a0 -- src/app/api/push/send/route.ts
# Vacío
```

## Arnés PROPIO del revisor, separado de la mutación del autor

El script completo siguiente se creó en `/tmp/pr708-r2-independent.cjs`, **fuera del repo**. Reproduce el predicado literal de `route.ts` y los literales exactos del test en `0d5616b8`. También mide un mutante **nuevo**: ignorar únicamente el último byte de la comparación (`prefix`). No usa secretos reales, base de datos ni servicios remotos.

```bash
cat > /tmp/pr708-r2-independent.cjs <<'NODE'
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cron = 'test-cron-secret-0123456789abcdefX';
const push = 'test-push-send-secret-0123456789ab';
const wrong = push.slice(0,-1) + 'X';
assert.equal(Buffer.byteLength(cron),34);
assert.equal(Buffer.byteLength(push),34);
assert.equal(Buffer.byteLength(wrong),34);
assert.notEqual(cron,push);
assert.notEqual(wrong,push);
function allowed(header, mutate) {
  const actual = Buffer.from(header);
  const expected = Buffer.from('Bearer '+push);
  return actual.length === expected.length && (mutate==='bypass'
    ? true
    : mutate==='prefix'
      ? crypto.timingSafeEqual(actual.subarray(0,expected.length-1),expected.subarray(0,expected.length-1))
      : crypto.timingSafeEqual(actual,expected));
}
for (const [kind, header] of [['cron','Bearer '+cron],['wrong-last-byte','Bearer '+wrong],['correct','Bearer '+push]]) {
  const orig=allowed(header,'original') ? 200 : 401;
  const bypass=allowed(header,'bypass') ? 200 : 401;
  const prefix=allowed(header,'prefix') ? 200 : 401;
  console.log(kind, 'original='+orig, 'mutant-bypass='+bypass, 'mutant-prefix='+prefix);
}
assert.equal(allowed('Bearer '+cron,'original'),false);
assert.equal(allowed('Bearer '+wrong,'original'),false);
assert.equal(allowed('Bearer '+push,'original'),true);
assert.equal(allowed('Bearer '+cron,'bypass'),true);
assert.equal(allowed('Bearer '+wrong,'bypass'),true);
assert.equal(allowed('Bearer '+wrong,'prefix'),true);
console.log('INDEPENDENT PREDICATE CHECK OK, without Route Handler/Vitest');
NODE
node /tmp/pr708-r2-independent.cjs
```

**Salida real del revisor:**

```text
cron original=401 mutant-bypass=200 mutant-prefix=401
wrong-last-byte original=401 mutant-bypass=200 mutant-prefix=200
correct original=200 mutant-bypass=200 mutant-prefix=200
INDEPENDENT PREDICATE CHECK OK, without Route Handler/Vitest
```

Esto predice que el test nuevo se pone rojo con el mutante de solo prefijo, pero **esa predicción no se ejecutó con Vitest**; no disfrazarla como resultado del Route Handler.

## Evidencia del autor, no ejecutada por el revisor

- Control: `Test Files 1 passed (1)`; `Tests 10 passed (10)`.
- Mutación `!crypto.timingSafeEqual(...) → false`: `Test Files 1 failed (1)`; `Tests 2 failed | 8 passed (10)`, casos bypass y secreto erróneo mismo largo.
- Restore buffer: `Tests 10 passed (10)`; route.ts sin cambios (comprobado también por diff entre commits).
- Tests generales declarados: 3872; tools declarados: 123.

## GitHub CI del SHA (consulta independiente)

- Run https://github.com/cadeApp/cadeApp/actions/runs/43182730559, commit `0d5616b8`.
- `unit` con `route.test.ts (10 tests)`, `Test Files 204 passed (204)`, `Tests 3872 passed (3872)`.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: SUCCESS.
- `db-tests`: en ejecución al consultar; **no se certifica PASS**.
- Vercel /api/push/send (build): 104 kB first load JS.
- Se valida `hallazgos.jsonl` como JSONL con Node; el comando del proyecto `node docs/revision-pr/analizar.mjs verificacion` queda para un entorno con clon; no se ejecutó desde el repositorio aquí.

**Criterio de H01:** el código publicado y su suite positiva/negativa están corregidos y el test real corre verde en CI del SHA; el mutante real de Vitest está respaldado por la bitácora del autor, mientras el revisor añadió un control independiente sobre el predicado exacto.
