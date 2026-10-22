# Evidencia — revisión PR #469 (HEAD c2a833d)

## Fuentes examinadas

- PR: https://github.com/cadeApp/cadeApp/pull/469
- Issue: https://github.com/cadeApp/cadeApp/issues/468
- Diff: `git diff develop...c2a833dec6bcfe6bdd741cee3352886b67b42ce4 -- .github/workflows/ci.yml .github/workflows/verify-workflows.test.mjs`
- SHA base: `127a900bf489dabf319a4f02046c959689487774`.
- CI: https://github.com/cadeApp/cadeApp/actions/runs/39525533747, especialmente `unit` (80/80 tests de verify-workflows) y `audit` (fallo en vulnerabilidad de Vite preexistente).
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/39525594800 (pendiente al consultar).
- Antecedentes: runs `39517803200` y `39521252749`.

## Batería independiente de timeout

Reproducible en un clon del repo: guardá el siguiente bloque JS en `/tmp/pr469-timeout-mutants.mjs` y ejecutá `node /tmp/pr469-timeout-mutants.mjs` **desde la raíz del repositorio** con la PR checkouteada. Solo lee archivos, no escribe al repo. Se eligieron mutaciones diferentes de las que documentó el autor; no se editan tests para ponerlos verdes.

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function job(yaml, name) {
  const normalized = yaml.replace(/\r\n/g, '\n');
  const start = normalized.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `Missing ${name} job`);
  const next = normalized.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? normalized.slice(start) : normalized.slice(start, start + next + 1);
}
const oracle = (yaml) => /\n {4}timeout-minutes: 20\n/.test(job(yaml, 'db-tests'));

const head = readFileSync('.github/workflows/ci.yml', 'utf8');
const base = execFileSync('git', ['show', 'origin/develop:.github/workflows/ci.yml'], { encoding: 'utf8' });

function change(source, regex, replacement) {
  assert.match(source, regex, 'mutación sin objetivo: falla de instrumento');
  const result = source.replace(regex, replacement);
  assert.notEqual(result, source, 'mutación sin cambio');
  return result;
}

const results = [
  ['control GREEN del HEAD', head, true],
  ['control RED de develop', base, false],
  ['M01: retroceso a 10', change(head, /(\n  db-tests:\n[\s\S]*?\n    timeout-minutes: )20(\n)/, '$110$2'), false],
  ['M02: otro límite 30', change(head, /(\n  db-tests:\n[\s\S]*?\n    timeout-minutes: )20(\n)/, '$130$2'), false],
  ['M03: sin timeout', change(head, /(\n  db-tests:\n[\s\S]*?)\n    timeout-minutes: 20\n/, '$1\n'), false],
  ['M04: 20 solamente en unit', change(base, /(\n  unit:\n[\s\S]*?\n    timeout-minutes: )10(\n)/, '$120$2'), false],
  ['M05: texto 20 en comentario', change(base, /(\n  db-tests:\n[\s\S]*?\n    timeout-minutes: 10\n)/, '$1    # timeout-minutes: 20\n'), false],
];
for (const [name, yaml, expected] of results) {
  const actual = oracle(yaml);
  assert.equal(actual, expected, `oráculo defectuoso en ${name}`);
  console.log(`${actual ? 'GREEN' : 'RED'} ${name}`);
}
console.log(`PASS ${results.length}/${results.length}`);
```

**Comprobación efectivamente ejecutada por el revisor:** mismo oráculo contra ambos YAML reales leídos mediante el conector GitHub en memoria, con las 5 mutaciones anteriores: **7/7 resultados esperados**. No se ejecutó el archivo anterior en un checkout local completo; el bloque se conserva para reproducirlo y auditarlo.

## Corridas declaradas por el autor

- RED con `timeout-minutes: 10`: compatible con el control reproducido sobre develop; no se confunde con un test completo ejecutado localmente.
- GREEN con `timeout-minutes: 20`: demostrado además por `unit` CI, suite `verify-workflows` de **80/80**.
- Autor declara `77/80` local sin node_modules; se contrastó con el runner real `80/80`, que instala dependencias. No se necesitó falsear/editar tests para conseguir ese verde.

## Resultado de merge gate en el momento de revisar

`typecheck` ✅ · `lint` ✅ · `unit` ✅ · `build` ✅ · `bundle-budget` ✅ · `audit` ❌ (dependencia fuera del diff) · `db-tests` ⏳ · `e2e-preview` ⏳ · `approval-policy` pendiente de informe. El que el diff no tenga bloqueantes **no** reemplaza checks faltantes.
