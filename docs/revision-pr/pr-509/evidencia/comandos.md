# Evidencia reproducible — PR #509 / ronda 1

## Origen y límites

Inspección API GitHub: SHA de código `a03a4179532f13ccec32b666859037cb7305a50b`; `.github/workflows/health-cron.yml` y `.github/workflows/verify-workflows.test.mjs:599-609`. Se usó el `job()` original y las mismas aserciones del test nuevo. Las mutaciones se aplicaron **solo en memoria** al string leído; no se alteró el workflow ni se falsearon resultados. En esta sesión, el harness se ejecutó en un motor JS aislado con los dos YAML recuperados mediante el conector; aquí se deja la variante completa ejecutable por Node desde la raíz del repositorio.

## Harness completo — copiar a /tmp y ejecutar desde raíz del repo

```bash
cat > /tmp/pr509-mutations.mjs <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const health = readFileSync('.github/workflows/health-cron.yml', 'utf8');

function job(yaml, name) {
  const normalized = yaml.replace(/\r\n/g, '\n');
  const start = normalized.indexOf('\n  ' + name + ':\n');
  assert.notEqual(start, -1, 'Missing ' + name + ' job');
  const next = normalized.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? normalized.slice(start) : normalized.slice(start, start + next + 1);
}
function checkCurrent(yaml) {
  for (const name of ['staging', 'production']) {
    const body = job(yaml, name).replace(/\r\n/g, '\n');
    assert.ok(body.includes('\n    environment: '), name + ': usa un environment');
    assert.ok(!/\n {4}if: [^\n]*\bvars\./.test(body), name + ': el if del job no puede leer vars');
  }
}
function checkProposed(yaml) {
  for (const name of ['staging', 'production']) {
    const body = job(yaml, name).replace(/\r\n/g, '\n');
    assert.ok(body.includes('\n    environment: '), name + ': usa un environment');
    assert.doesNotMatch(body, /^ {4}if\s*:/m, name + ': sin if a nivel de job');
  }
}
function mutate(insert) {
  const needle = '    name: health-cron-production\n';
  assert.ok(health.includes(needle), 'Falta ancla del job production');
  return health.replace(needle, needle + insert);
}
const cases = [
  ['HEAD sin mutar', health, true, true],
  ['RED original', mutate("    if: vars.PRODUCTION_APP_URL != ''\n"), false, false],
  ['MUT-A condition-event', mutate("    if: github.event_name == 'workflow_dispatch'\n"), true, false],
  ['MUT-B multiline-vars', mutate("    if: >-\n      vars.PRODUCTION_APP_URL != ''\n"), true, false],
];
for (const [label, yaml, currentExpected, proposedExpected] of cases) {
  const outcomes = [];
  for (const [name, fn, expected] of [
    ['current', checkCurrent, currentExpected],
    ['proposed', checkProposed, proposedExpected],
  ]) {
    let passed = true;
    try { fn(yaml); } catch { passed = false; }
    assert.equal(passed, expected, label + ' / ' + name + ': resultado inesperado');
    outcomes.push(name + '=' + (passed ? 'PASS' : 'FAIL'));
  }
  console.log(label + ': ' + outcomes.join(' | '));
}
JS
node /tmp/pr509-mutations.mjs
```

## Resultados de la revisión (predicado actual / guard propuesto)

| Fixture | Control actual | Guard estricto |
|---|---|---|
| HEAD sin mutar | PASS | PASS |
| Condición vieja `vars.PRODUCTION_APP_URL` | FAIL | FAIL |
| MUT-A `github.event_name == 'workflow_dispatch'` | **PASS indebido** | FAIL |
| MUT-B `if: >-` + `vars` en otra línea | **PASS indebido** | FAIL |

**Interpretación:** el script demuestra que el nuevo test puede permanecer verde con producción salteada en todos los schedules. La mutación B prueba una segunda falla del instrumento, no un bug actual de producción. Hay que agregar pruebas dentro de `verify-workflows.test.mjs` que fallen con esas variantes y no solo citar este harness.

## Comandos de verificación de la próxima ronda

```bash
node /tmp/pr509-mutations.mjs
node --test .github/workflows/verify-workflows.test.mjs
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git diff origin/develop...HEAD --stat
git merge-tree --write-tree origin/develop HEAD
```

No se ejecutaron comandos del repositorio en esta sesión: el contenedor no pudo resolver GitHub para clonar. No se corrió Docker, Supabase remoto, secrets ni despliegues.
