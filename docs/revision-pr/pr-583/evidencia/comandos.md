# Evidencia y batería independiente — PR #583

**SHA exacto:** `b082fe414a3eb2507b5b08fa5d013499f8cf5586`. **Base:** `2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a`.

## Verificaciones efectivamente realizadas

- `GitHub Actions` run `41724697871`, unit job `126226297710`: `Test Files 189 passed (189)`, `Tests 3460 passed (3460)`; workflows 81 pass, ADR 6 pass.
- DB job `126226297855`: `Files=40, Tests=3252`, `Result: PASS`; tipos de base comparados sin diff.
- Bundle en PR job `126227209613`: dos rutas de comercios a 263 kB y advertencia; bundle en base run `41722964415` job `126221169120`: mismas dos rutas a 263 kB.
- Barrido textual de **código productivo real del SHA** (cinco archivos) por GitHub: `queries.ts` empieza con `import 'server-only'`; `dniHash` 0 referencias en los cinco; `hasDni: Boolean(c.dni_hmac)` 2; helper de negocio 1; `signupIncomplete` 1; tres condicionales JSX. Sirve para ubicación estática, **no demuestra ejecución**.
- Intento `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` en este runtime: `Could not resolve host: github.com`. Sin clon ni pnpm no se reprodujeron los RED del autor.

## Guion completo para probar nueve mutaciones propias

Guardá el siguiente bloque en `/tmp/review-pr583.sh` y ejecutalo **desde la raíz de un clon con pnpm**. Trabaja sobre un worktree limpio del SHA revisado, revierte cada mutación desde la copia guardada en memoria y elimina su worktree al salir. **El guion es propuesto y no fue ejecutado contra Vitest en esta sesión. No hay resultados RED confirmados por el revisor.**

~~~bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
WT="$TMP/wt"
cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
git -C "$ROOT" worktree add --detach "$WT" b082fe414a3eb2507b5b08fa5d013499f8cf5586 >/dev/null
cd "$WT"
pnpm install --frozen-lockfile >/dev/null
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const q = 'src/features/admin/queries.ts';
const merchant = 'src/features/admin/components/merchants-table.tsx';
const queue = 'src/features/admin/components/applicants-queue.tsx';
const detail = 'src/features/admin/components/applicant-detail-view.tsx';
const qt = 'src/features/admin/queries.test.ts';
const mt = 'src/features/admin/components/merchants-table.test.tsx';
const dt = 'src/features/admin/components/applicant-detail-view.test.tsx';
const cases = [
  ['M1', q, 'return businessName.trim() || ADMIN_COPY.merchants.incompleteSignup;', 'return businessName.trim();', 0, 1, qt, 'T-401: comercio con el alta sin completar'],
  ['M2', q, 'signupIncomplete: !row.business_name.trim(),', 'signupIncomplete: false,', 0, 1, qt, 'T-401: comercio con el alta sin completar'],
  ['M3', q, 'hasDni: Boolean(c.dni_hmac),', 'hasDni: true,', 0, 2, qt, 'T-401: el hash del DNI no viaja al cliente'],
  ['M4', q, 'hasDni: Boolean(c.dni_hmac),', 'hasDni: true,', 1, 2, qt, 'T-401: el hash del DNI no viaja al cliente'],
  ['M5', q, 'hasDni: Boolean(c.dni_hmac),', 'hasDni: Boolean(c.dni_hmac), dni_hmac: c.dni_hmac,', 0, 2, qt, 'T-401: el hash del DNI no viaja al cliente'],
  ['M6', q, 'hasDni: Boolean(c.dni_hmac),', 'hasDni: Boolean(c.dni_hmac), dni_hmac: c.dni_hmac,', 1, 2, qt, 'T-401: el hash del DNI no viaja al cliente'],
  ['M7', merchant, 'merchant.signupIncomplete ? (', 'false ? (', 0, 1, mt, 'T-401: comercio con el alta sin completar'],
  ['M8', queue, 'a.hasDni ? ADMIN_COPY.queue.dniLoaded : ADMIN_COPY.queue.dniPending', 'ADMIN_COPY.queue.dniLoaded', 0, 1, dt, 'T-401: el hash del DNI no se muestra'],
  ['M9', detail, 'applicant.hasDni ? ADMIN_COPY.queue.dniLoaded : ADMIN_COPY.queue.dniPending', 'ADMIN_COPY.queue.dniLoaded', 0, 1, dt, 'T-401: el hash del DNI no se muestra'],
];
function run(testFile, title) {
  const r = spawnSync('pnpm', ['exec', 'vitest', 'run', testFile, '-t', title], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  });
  if (r.error) throw r.error;
  const output = ((r.stdout || '') + '\n' + (r.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '');
  const summary = output.split(/\r?\n/).filter((x) => /Test Files|Tests  |FAIL/.test(x)).slice(-8).join(' | ');
  return { code: r.status, output, summary };
}
function replaceNth(src, needle, replacement, nth, expectedCount) {
  const parts = src.split(needle);
  const count = parts.length - 1;
  if (count !== expectedCount || nth >= count)
    throw new Error('SIN OBJETIVO: ' + needle + ' (encontradas ' + count + ')');
  return parts.slice(0, nth + 1).join(needle) + replacement + parts.slice(nth + 1).join(needle);
}
for (const [id, path, needle, replacement, nth, expected, testFile, title] of cases) {
  const original = readFileSync(path, 'utf8');
  const changed = replaceNth(original, needle, replacement, nth, expected);
  const baseline = run(testFile, title);
  if (baseline.code !== 0) throw new Error(id + ' CONTROL no verde: ' + baseline.summary);
  let red;
  try {
    writeFileSync(path, changed);
    red = run(testFile, title);
  } finally {
    writeFileSync(path, original);
  }
  if (red.code === 0 || !/AssertionError|expected .* to |expected .*not to /i.test(red.output))
    throw new Error(id + ' RED no demostrado por aserción: ' + red.summary);
  const restored = run(testFile, title);
  if (restored.code !== 0) throw new Error(id + ' RESTAURADO no verde: ' + restored.summary);
  console.log(id + ' CONTROL: ' + baseline.summary);
  console.log(id + ' RED: ' + red.summary);
  console.log(id + ' GREEN: ' + restored.summary);
}
console.log('BATERÍA COMPLETA: 9/9 (solo si esta línea aparece sin error)');
NODE
~~~

M1 quita fallback, M2 inutiliza flag, M3/M4 false→true sin razón, M5/M6 filtran HMAC crudo de vuelta en cada salida, M7 ignora el flag de celda, M8/M9 fuerzan UI «cargado» aunque `hasDni=false`. Es una batería distinta de la del autor. **No modificar tests, mocks ni expectativas para conseguir verde.** Ante «SIN OBJETIVO» no cuenta como rojo.

## Smoke manual pendiente

Preview: https://cadeapp-develop-git-feat-t-401-admin-useless-data-lautaroj073.vercel.app
Con admin de prueba: comercio sin nombre y con solo espacios; celda, acciones accesibles, diálogo y créditos; postulantes con y sin DNI en lista y detalle. No exponer credenciales ni hashes reales. El CI `e2e-preview` confirma el gate técnico, pero un E2E genérico no sustituye esta comprobación concreta.


---

## Evidencia de Ronda 2 — SHA `887e280483e8f62d9a8b6cda3734ee08f7124772`

**Diff inspeccionado:** `git compare 87992bba...887e2804` en GitHub, único commit `887e2804`, 3 rutas permitidas: bitácora y 2 tests. No cambió código productivo.

### Mutaciones: registro fiel del resultado declarado

Fuente: `docs/tasks/log/T-401.md`, segunda entrada 2026-11-03:
- Primer intento M1–M6: rojo por aserción, según autor. M7: error de `getByText` — no vale como RED por aserción; la batería se detuvo.
- Corrección de aserciones en tests: `getByText` → `expect(queryByText(...)).not.toBeNull()`, conservando comprobación de clase. La inspección de diff confirma misma propiedad afirmada.
- Segundo intento: M1–M9, CONTROL GREEN → RED por aserción → GREEN restaurado, `BATERÍA COMPLETA: 9/9`, `src/` limpio, **según autor**.
- En Windows se ejecutó el bloque Node copiado a temporal **contra el checkout actual** y con adaptación de `spawnSync` a `shell`; no debe confundirse con el Bash de arriba que fija el worktree del SHA `b082fe4`. Es importante para que M7 use los tests nuevos del commit `887e2804`.

**No son resultados reejecutados por la revisión.** El CI sí ejecuta los tests vigentes del head; no reproduce las mutaciones M1–M9.

### CI de Ronda 2, HEAD funcional `887e2804`

- CI [run 41729270469](https://github.com/cadeApp/cadeApp/actions/runs/41729270469), job `unit` [126242055653](https://github.com/cadeApp/cadeApp/actions/runs/41729270469/job/126242055653): log leído, `Test Files 189 passed (189)` y `Tests 3460 passed (3460)`.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: SUCCESS en ese run.
- `approval-policy` [41729269405](https://github.com/cadeApp/cadeApp/actions/runs/41729269405): SUCCESS.
- `db-tests` [126242056127](https://github.com/cadeApp/cadeApp/actions/runs/41729270469/job/126242056127): en ejecución al producir esta evidencia; **no se atribuye PASS**.
- `e2e-preview` [41729448801](https://github.com/cadeApp/cadeApp/actions/runs/41729448801): `resolve-preview` exitoso, job E2E en cola al producir esta evidencia; **no se atribuye PASS**.
- E2E local `admin-courier-reinstate.spec.ts`, 1 passed (53.1 s) contra Preview de `b082fe41`, **reportado en bitácora del autor**. Sin evidencia de smoke de los ejemplos de comercio sin nombre y las dos etiquetas de DNI.

La revisión no inicia Docker ni Supabase remoto, no modifica tests ni usa claves, y no exige CI nuevo verde **solo** por este commit de documentación.
