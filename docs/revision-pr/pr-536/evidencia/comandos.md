# Comandos y resultados — PR #536 / T-413 — ronda 1

El control siguiente comprueba **por cada paquete** las versiones de `package.json` y `pnpm-lock.yaml` y prueba tres situaciones: versión vieja RED, HEAD GREEN y dos mutaciones nuevas RED. Requiere un clon local en el raíz del repo, con los SHAs presentes; no accede a la red ni modifica archivos. Puede copiarse el script completo a `/tmp/t413-review-check.cjs` y ejecutarse desde la raíz.

```bash
cat > /tmp/t413-review-check.cjs <<'NODE'
const { execFileSync } = require('node:child_process');
const BASE = '0e4e83a699b118a1464b01bd546a947447025b01';
const HEAD = '4bc500cd5e15c21887a4b1ed70423e3cd8bcf920';
const packages = ['next', 'eslint-config-next'];
const lockPackages = [
  'next', 'eslint-config-next', '@next/env', '@next/eslint-plugin-next',
  '@next/swc-darwin-arm64', '@next/swc-darwin-x64',
  '@next/swc-linux-arm64-gnu', '@next/swc-linux-arm64-musl',
  '@next/swc-linux-x64-gnu', '@next/swc-linux-x64-musl',
  '@next/swc-win32-arm64-msvc', '@next/swc-win32-x64-msvc'
];
function read(ref, file) {
  return execFileSync('git', ['show', ref + ':' + file], {encoding: 'utf8'});
}
function escapeRegExp(x) {return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
function test(pkgText, lockText) {
  const p = JSON.parse(pkgText), errors=[];
  for (const name of packages) {
    const actual = p.dependencies?.[name] || p.devDependencies?.[name];
    if (actual !== '15.5.28') errors.push('manifest ' + name + ' = ' + actual);
  }
  for (const name of lockPackages) {
    const pattern = new RegExp("'?" + escapeRegExp(name) + "@(15\\.5\\.\\d+)'?", "g");
    const hits = [...lockText.matchAll(pattern)].map(x => x[1]);
    if (hits.length < 2 || hits.some(x => x !== '15.5.28')) errors.push('lock ' + name + ' = ' + hits.join(','));
  }
  if (lockText.includes('15.5.26')) errors.push('lock contiene versión vieja');
  if (!lockText.includes('sharp@0.35.5') || !lockText.includes('sharp: 0.35.5')) errors.push('sharp no verificado');
  return errors;
}
const p0=read(BASE,'package.json'), l0=read(BASE,'pnpm-lock.yaml');
const p1=read(HEAD,'package.json'), l1=read(HEAD,'pnpm-lock.yaml');
const cases = [
  ['base RED', test(p0,l0), true],
  ['HEAD GREEN', test(p1,l1), false],
  ['mutación next en manifest RED', test(p1.replace('"next": "15.5.28"', '"next": "15.5.26"'),l1), true],
  ['mutación next lock RED', test(p1,l1.replace('next@15.5.28:', 'next@15.5.26:')), true]
];
for (const [name, errors, expectRed] of cases) {
  const good = expectRed ? errors.length > 0 : errors.length === 0;
  console.log((good?'PASS':'FAIL') + ' ' + name + ' (' + errors.length + ' incumplimientos)');
  if(!good) process.exitCode=1;
}
NODE
node /tmp/t413-review-check.cjs
```

**Resultado de la comprobación equivalente sobre textos del conector en la sesión de revisión:**
- Base 15.5.26: **RED**, 15 condiciones incorrectas.
- HEAD 15.5.28: **GREEN**, 16/16.
- Mutación manifest `next` a 15.5.26: **RED**.
- Mutación lock `next@15.5.28` a 15.5.26: **RED**.

**Límite de ejecución:** no fue posible correr este shell en un clon real desde esta sesión: `git ls-remote` dio `Could not resolve host: github.com`. No atribuirle una ejecución local que no sucedió.

## CI del SHA revisado

```bash
# Ejecutar en clon (solo lectura + validación), sin modificar package.json:
pnpm install --frozen-lockfile
pnpm audit --audit-level=high
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm build
# E2E contra Preview con entorno Develop aislado, usando el workflow confiable e2e-preview
```

En el log del job audit del run 39867665428: `4 vulnerabilities found`, `Severity: 3 moderate | 1 high (1 ignored)` sin los advisories objetivo. En el job unit: `168 passed` / `3289 passed`; build compiló. El E2E y db-tests estaban pendientes al cerrar esta evidencia.

La batería de mutaciones es de la revisión; no se tomó un harness del autor. Las mutaciones se hacen sobre cadenas en memoria, no sobre el working tree.
