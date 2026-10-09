# Evidencia y comandos — PR #315 / ronda 1

**Revisor:** independiente; **HEAD funcional leído:** `c6220ba587ffaab7c27fe83f2746600d60e0cbb7`.
**Importante:** las tres mutaciones se comprobaron evaluando en memoria el predicado textual real contra el spec de #251. No se ejecutó el harness de `node --test` en esta sesión: no hubo clon local autenticado. Los logs de CI sí se inspeccionaron en GitHub. No declarar `Tests 76 ...` del autor como una prueba local del revisor.

## Evidencia observada (sin mutar código en GitHub)

- `verify-workflows.test.mjs:1866-1868`: `spec.includes(test('<grep>')` y `spec.includes('.toHaveURL(')` global.
- `e2e/specs/merchant-registration.spec.ts` de #251, blob `33dfeb5bd2ef9e6794692c846227cf48f6ab14d6`, helper en 201-205, caso en 380-399.
- M1: quitar la llamada `await expect(page).toHaveURL(expectedUrl);` del helper deja la condición global `.toHaveURL(` verdadera por otras expectativas.
- M2: quitar `await expectMerchantPanelBlocked(page, path, expectedUrl);` del bucle courier deja `test('DoD...')` y `.toHaveURL(` presentes.
- M3: cambiar el patrón de URL del primer `/merchant/dashboard` por `/merchant/dashboard` deja ambas condiciones textuales verdaderas.
- El blob `src/features/auth/guards.ts` en develop postmerge de #314 sigue siendo `b5c2de551e4bf435966a9bbc3739dddee32d38d9`, coincidente con índice del patch nuevo `b5c2de5`.
- CI `37880568621`: unit, db-tests, build, typecheck, lint, audit y bundle-budget verdes; workflow tests `# tests 76 / # pass 76 / # fail 0`; pgTAP `Files=20, Tests=1903, Result: PASS`.
- Trusted E2E `37880647344` (SHA base develop `24aad21`): 53 passed, 3 failed de `fixed-price.spec.ts`, `hydration.ts:38`. Reproducción paralela `37879412368`. El E2E GREEN de #314 sobre el SHA documental `dc582d2` está en `37868847377`.

## Harness completo para reproducir M1 / M2 / M3 en un worktree temporal

Requiere un clon limpio de la PR #315 con dependencias instaladas y acceso de solo lectura a origin. **No muta ni stagea la rama del PR**. El script conserva un string `original` en memoria y lo restaura con `writeFileSync`; no usa `git checkout` para restaurar mutaciones. No ejecutar Docker/Supabase remoto ni `repository_dispatch`.

Copiar todo el bloque a `/tmp/pr315-h01.sh`, luego `bash /tmp/pr315-h01.sh` desde la raíz del clon:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
git -C "$ROOT" fetch origin
git -C "$ROOT" fetch origin refs/pull/251/head
git -C "$ROOT" worktree add --detach "$TMP/wt" HEAD
mkdir -p "$TMP/wt/e2e/specs"
git -C "$ROOT" show FETCH_HEAD:e2e/specs/merchant-registration.spec.ts > "$TMP/wt/e2e/specs/merchant-registration.spec.ts"
if [ -d "$ROOT/node_modules" ]; then
  ln -s "$ROOT/node_modules" "$TMP/wt/node_modules"
fi
cd "$TMP/wt"
node <<'NODE'
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = 'e2e/specs/merchant-registration.spec.ts';
const original = fs.readFileSync(path,'utf8');
const expectedRoute = String.raw`{ path: '/merchant/dashboard', expectedUrl: /\/courier\/feed/ }`;
const alternateRoute = String.raw`{ path: '/merchant/dashboard', expectedUrl: /\/merchant\/dashboard/ }`;
const mutations = [
  ['M1-eliminar-url-helper', source => source.replace(
    'await expect(page).toHaveURL(expectedUrl);',
    '/* M1: URL oracle omitted */'
  )],
  ['M2-omitir-helper-caso', source => source.replace(
    'await expectMerchantPanelBlocked(page, path, expectedUrl);',
    '/* M2: check omitted */'
  )],
  ['M3-cambiar-primera-ruta', source => source.replace(
    expectedRoute, alternateRoute
  )],
];
const run = (source) => {
  fs.writeFileSync(path, source);
  const r = spawnSync('node',[
    '--test',
    '--test-name-pattern=e2e-mutation catalog is valid',
    '.github/workflows/verify-workflows.test.mjs'
  ],{encoding:'utf8'});
  const tail = (r.stdout+'\n'+r.stderr).split('\n')
    .filter(x => /# tests |# pass |# fail |not ok|ok [0-9]/.test(x)).slice(-8);
  return {status:r.status, tail};
};
try {
  const control = run(original);
  console.log('CONTROL', JSON.stringify(control));
  if(control.status!==0) throw Error('CONTROL_NOT_GREEN; no interpretar mutantes');
  for(const [name,mutate] of mutations) {
    const changed=mutate(original);
    if(changed===original) throw Error(name+': MUTATION_DID_NOT_APPLY');
    const result=run(changed);
    console.log(name, result.status===0?'SURVIVED (defecto)': 'RED (control detectó)', JSON.stringify(result));
  }
} finally {
  fs.writeFileSync(path,original);
}
NODE
git status --short
```

**Expectativa sobre `c6220ba587ffaab7c27fe83f2746600d60e0cbb7`:** CONTROL GREEN, M1/M2/M3 SURVIVED. Es hipótesis contrastada con el predicado en memoria; el script es el método para corroborarlo con `node --test` completo. **Expectativa tras arreglo 1-A:** CONTROL GREEN, M1/M2/M3 RED con aserciones informativas. No inventar logs antes de ejecutar.

## Siguiente ronda

Tras los cambios del autor, correr una batería **distinta** a la de agy: por ejemplo sustituir en el helper `toHaveURL` por `not.toHaveURL`, comentar la iteración de rutas sin cambiar el título del caso y alterar el destino de una ruta merchant distinta de dashboard. Si alguna sobrevive, revisar el detector antes de declarar verificado.

**CI tras el commit de revisión:** el commit mueve el HEAD y requiere revalidación; los checks previos no se trasladan de SHA.

## Ronda 2 — harness adicional independiente (Node, sin escribir archivos del repo)

El revisor ejecutó una reproducción **aislada** con el texto de las funciones de `cc1f5fd` y un fixture fiel a los símbolos reales de #251, obteniendo:
```text
CONTROL: GREEN | []
X1_no_courier_login: GREEN | []
X2_assertion_only_a_string: GREEN | []
X3_assertion_unreachable: GREEN | []
X4_loop_unreachable: GREEN | []
X5_routing_commented: GREEN | []
```
Estos GREEN mutados representan falsos negativos del **control estructural**, no un run E2E de Playwright. Para reproducir usando *exactamente el código revisado* y el *spec real* en cualquier clon, copiar todo el siguiente bloque a `/tmp/pr315-ronda2.mjs`, ejecutar desde la raíz de la rama:
```bash
git fetch origin refs/pull/251/head
node /tmp/pr315-ronda2.mjs
```

```javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const source = readFileSync('.github/workflows/verify-workflows.test.mjs', 'utf8');
const start = source.indexOf('function stripComments(source)');
const end = source.indexOf("\ntest('e2e-mutation catalog is valid", start);
assert.ok(start >= 0 && end > start, 'localizar versión real del control');
const code = source.slice(start, end);
const spec = execFileSync('git', ['show', 'FETCH_HEAD:e2e/specs/merchant-registration.spec.ts'], { encoding: 'utf8' });
const mutation = {
  id: 't313-courier-merchant-guard',
  grep: 'DoD: Un courier no entra a (merchant)',
  expectedFailure: ['toHaveURL', 'Expected pattern: /\\/courier\\/feed/'],
};
function check(src) {
  const ctx = vm.createContext({ spec: src, mutation });
  return [...vm.runInContext(code + '\ncaseOracleProblems(spec,mutation)', ctx, { timeout: 1500 })];
}
const control = check(spec);
assert.deepEqual(control, [], 'control original debe dar GREEN');
console.log('CONTROL: GREEN');
const changes = [
  ['X1-sin-login-courier', 'await loginAsCourier(0, page);', '/* courier login removed */'],
  ['X2-oraculo-de-string', 'await expect(page).toHaveURL(expectedUrl);', "const decoy = 'await expect(page).toHaveURL(expectedUrl);';"],
  ['X3-oraculo-inaccesible', 'await expect(page).toHaveURL(expectedUrl);', 'if (false) { await expect(page).toHaveURL(expectedUrl); }'],
  ['X4-loop-inaccesible', 'for (const { path, expectedUrl } of routes) {', 'if (false) { for (const { path, expectedUrl } of routes) {'],
  ['X5-ruta-history-quitada', "{ path: '/merchant/history', expectedUrl: /\\/courier\\/feed/ },", '/* removed */'],
];
for (const [id, from, to] of changes) {
  assert.ok(spec.includes(from), id + ': objetivo ausente (MUTATION_DID_NOT_APPLY)');
  let changed = spec.replace(from, to);
  // X4: cerrar el if(false) adicional para mantener el spec sintácticamente válido.
  if (id === 'X4-loop-inaccesible') {
    const closing = '      await expectMerchantPanelBlocked(page, path, expectedUrl);\n    }';
    assert.ok(changed.includes(closing), 'X4: falta cierre exacto de la iteración');
    changed = changed.replace(closing, closing + '\n    }');
  }
  const problems = check(changed);
  console.log(id + ': ' + (problems.length ? 'RED' : 'SURVIVED / FALSO GREEN') + ' ' + JSON.stringify(problems));
}
```

> Controles: no `eval` de código de aplicación, `vm` solo ejecuta las funciones puras extraídas del test revisado en un sandbox Node efímero; no escribe en el repo, no requiere Supabase ni secretos. El spec se obtiene de PR #251 por git, nunca se edita. En futuros refactors del test, si no se encuentra el cuerpo, el harness falla en vez de afirmar falsos GREEN.

## Ronda 3 — verificaciones independientes y microfix de salida anticipada

**Código evaluado:** `caseOracleProblems` y funciones auxiliares extraídas sin modificar del archivo `.github/workflows/verify-workflows.test.mjs`, primero en `88e490b` (autor), luego en `849d235` (microfix). **Entrada:** texto real de `e2e/specs/merchant-registration.spec.ts` del HEAD de PR #251 `77d430b`. Las mutaciones son sustituciones de cadenas solo en memoria: no se editó el spec real.

| Test | Sobre 88e490b | Sobre 849d235 |
|---|---|---|
| CONTROL | GREEN | GREEN |
| Y1: `return;` inmediatamente tras `await loginAsCourier(0, page);` | GREEN indebido | RED |
| Y2: `throw new Error('early exit');` tras login | GREEN indebido | RED |
| M1, M2, M3, X1, X2, X3, X4, L1, A1 | no regresión detectada | RED correctos |
| Z1: `console.log('finished');` después del bucle | GREEN | GREEN |

Resultado independiente de la batería final: **13/13 esperado** (2 controles GREEN, 11 mutaciones RED; contado por caso). El criterio `routesAt !== 1` se comprueba solo si `statements[0] === oracle.login`, para no duplicar errores sobre mutaciones donde el login ya falta. Se añadieron **2 asserts de regresión** en la suite fuente, además de los 77 tests existentes; el número de tests de Node sigue siendo 77 porque los asserts viven dentro de un mismo `test(...)`.

**No se afirma:** ejecución local del repositorio completo por el revisor, `git apply --check` por el revisor ni RED de seguridad Playwright real. La verificación auténtica del runtime CI/E2E corre desde GitHub sobre SHA fijado y el dispatch de mutación queda posmerge.

Para repetir una mutación aislada del checker real sin manipular el árbol de GitHub, usar el harness del bloque de Ronda 2 de este archivo con `git fetch origin refs/pull/251/head`, y agregar:

```javascript
const login = '    await loginAsCourier(0, page);';
for (const [id, postfix] of [
  ['Y1-early-return', '    return;'],
  ['Y2-early-throw', "    throw new Error('early exit');"],
]) {
  const changed = spec.replace(login, login + '\n' + postfix);
  assert.notEqual(changed, spec, id + ': mutación no aplicada');
  const failures = check(changed);
  console.log(id, failures.length ? 'RED' : 'SURVIVED', failures);
}
```
