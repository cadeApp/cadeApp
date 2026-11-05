# Evidencia reproducible — PR #622 / T-422 (ronda 1)

**SHA fuente:** 58cb60e0c24b0f28a7300c933e9d3773cbf22c10. **Fecha:** 2026-11-05.

## Fuentes y resultados reales

- Fallo origen: run https://github.com/cadeApp/cadeApp/actions/runs/42117303547, job 127560339320.
  - Log: imagen ubuntu26/20261101.186; @playwright/test 1.55.1; Playwright does not support chromium on ubuntu26.04-x64.
- CI de la PR: run https://github.com/cadeApp/cadeApp/actions/runs/42131903532, unit job 127610328844.
  - Test Files 193 passed (193), Tests 3568 passed (3568).
  - verify-workflows: # tests 86, # pass 86, # fail 0.
- El control independiente se corrió como JavaScript en memoria sobre el contenido exacto de los nueve YAML de GitHub, sin escribir ni mutar el árbol remoto. Resultado: 3 jobs encontrados, 3 correctos; cada uno de 3 cambios de runner detectado como RED; nuevo instalador adicional con ubuntu-latest ignorado por el control publicado (GREEN) y detectado por el independiente (RED).
- **Límite:** no se pudo clonar el repositorio desde este entorno; no se ejecutó aquí el comando original completo de node --test ni la instalación real de Chromium sobre 24.04. El log del CI aporta la comprobación real del test del autor.

## Harness COMPLETO e independiente, sin dependencias ni archivos modificados

Desde un clon limpio en el SHA anterior, guardá este bloque en /tmp y ejecutalo con la raíz del repo como argumento. Todas las mutaciones son **en memoria** y por eso no requieren restauración con git checkout.

```bash
cat > /tmp/pr622-runner-mutations.mjs <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd());
const dir = join(root, '.github/workflows');
const sources = readdirSync(dir).filter((name) => name.endsWith('.yml')).map((name) => ({
  name,
  content: readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n'),
}));

function jobs(source) {
  const start = source.indexOf('\njobs:\n');
  if (start < 0) return [];
  const section = source.slice(start + '\njobs:\n'.length);
  const headings = [...section.matchAll(/^ {2}([a-zA-Z_][\w-]*):\s*$/gm)];
  return headings.map((heading, i) => ({
    name: heading[1],
    content: section.slice(heading.index, i + 1 < headings.length ? headings[i + 1].index : section.length),
  }));
}

function scan(files) {
  const found = [];
  for (const file of files) {
    for (const current of jobs(file.content)) {
      if (/\bplaywright install --with-deps chromium\b/.test(current.content)) {
        const runner = current.content.match(/^ {4}runs-on:\s*(.+)$/m)?.[1] || '(ausente)';
        found.push({ file: file.name, job: current.name, runner, ok: runner === 'ubuntu-24.04' });
      }
    }
  }
  return found;
}

function originalJob(source, name) {
  const start = source.indexOf('\n  ' + name + ':\n');
  assert.notEqual(start, -1);
  const next = source.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next < 0 ? source.slice(start) : source.slice(start, start + next + 1);
}

// Replica solo el control nuevo de la PR para mostrar su límite, no cambia su código.
function authorControl(files) {
  for (const [file, name] of [
    ['e2e-preview.yml', 'e2e'],
    ['e2e-mutation.yml', 'mutation'],
    ['e2e-staging.yml', 'e2e'],
  ]) {
    const body = originalJob(files.find((item) => item.name === file).content, name);
    if (!/playwright install --with-deps chromium/.test(body)) return false;
    if (!/\n {4}runs-on: ubuntu-24\.04\n/.test(body)) return false;
  }
  return true;
}

const initial = scan(sources);
assert.equal(initial.length, 3, 'La enumeración debe encontrar 3 jobs instaladores');
assert(initial.every((entry) => entry.ok), 'BASE debe ser GREEN');
assert.equal(authorControl(sources), true, 'Control publicado BASE GREEN');
console.log('BASE GREEN: ' + initial.map((j) => j.file + '/' + j.job).join(', '));

for (const file of ['e2e-preview.yml', 'e2e-mutation.yml', 'e2e-staging.yml']) {
  const variant = sources.map((entry) =>
    entry.name !== file ? entry : {
      ...entry,
      content: entry.content.replace('runs-on: ubuntu-24.04', 'runs-on: ubuntu-latest'),
    }
  );
  const bad = scan(variant).filter((entry) => !entry.ok);
  assert.equal(bad.length, 1, 'M1-M3: una mutación debe crear exactamente un fallo');
  assert.equal(bad[0].file, file);
  assert.equal(authorControl(variant), false);
  console.log('MUTACIÓN RED: runner ubuntu-latest en ' + file);
}

const phantom = [
  '', '  phantom-e2e:', '    runs-on: ubuntu-latest',
  '    steps:', '      - name: Install Playwright browsers',
  '        run: pnpm exec playwright install --with-deps chromium', '',
].join('\n');
const added = sources.map((entry) =>
  entry.name !== 'e2e-preview.yml' ? entry : {
    ...entry, content: entry.content + phantom,
  }
);
const missed = scan(added).filter((entry) => !entry.ok);
assert.equal(missed.length, 1);
assert.equal(missed[0].job, 'phantom-e2e');
assert.equal(authorControl(added), true, 'El control publicado no detecta el cuarto job');
console.log('M4: control publicado GREEN FALSO; barrido independiente RED (phantom-e2e)');
console.log('FIN: sin cambios persistidos en el repo');
NODE
node /tmp/pr622-runner-mutations.mjs "$(pwd)"
```

## Checks para seguir en el repositorio

```bash
node --test .github/workflows/verify-workflows.test.mjs
pnpm typecheck
pnpm lint
pnpm test
git diff --check
node docs/revision-pr/analizar.mjs verificacion
```

La salida RED→GREEN que declara el autor (85/86 antes, 86/86 después, y un fallo por cada vuelta a ubuntu-latest) es **consistente** con los parches y con CI 86/86. Esta revisión reproduce las tres mutaciones de runner con un **control propio**, no finge haber ejecutado la batería completa del autor en un clon.

## Prueba operacional pendiente

No ejecutar workflows a mano. Tras merge por una persona autorizada, esperar a una corrida regular del CI de una PR interna; el `workflow_run` de develop debe instalar Chromium con Ubuntu 24.04, correr `chromium` y `global-settings` y publicar commit status del SHA. Si no ocurre, registrar el run y el step fallido; no declarar GREEN por el mero pin.
