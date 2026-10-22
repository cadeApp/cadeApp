# Evidencia de revisión — PR #453 / T-377 (rondas 1 y 2)

## Fuente del código y estados del PR

```bash
git fetch origin
git rev-parse origin/feat/T-377-trip-street-route
git diff --name-only 253fee23692be3e43c22927d87e055c9f15d6d9b 1aa545786a55bd100e4f810c95222e600b55228d
git diff origin/develop -- docs/tasks/T-377.md
git merge-tree --write-tree origin/develop 1aa545786a55bd100e4f810c95222e600b55228d
```

Consultado mediante GitHub conectado: revisión inicial SHA `253fee23`; arreglo SHA `1aa54578`; 5 archivos cambiados exactamente, `behind_by=0`, GitHub `mergeable=true`. No se ejecutó git local ni `git merge-tree` por falta de clon.

## CI (se leyeron logs, no se ejecutaron localmente)

- **CI original:** https://github.com/cadeApp/cadeApp/actions/runs/39383129125 — unit 148 archivos/2909 tests, db-tests 31 archivos/2868 pgTAP, demás checks verdes.
- **E2E original:** https://github.com/cadeApp/cadeApp/actions/runs/39383260156 — checkout explícito de `253fee23`, 91 E2E principales + 6 global.
- **CI arreglo:** https://github.com/cadeApp/cadeApp/actions/runs/39392342174 — checks verdes, unit 149 archivos/2927 tests en merge sintético `641c928` (otra base de develop).
- **E2E arreglo:** https://github.com/cadeApp/cadeApp/actions/runs/39392466688 — checkout explícito `1aa545786a55bd100e4f810c95222e600b55228d`; `map-privacy.spec.ts` «tras matched» (incluye modo `reject-import`) PASS; 91+6 casos PASS.
- El autor registró en `docs/tasks/log/T-377.md` RED 5 failed / 53 passed, GREEN 58/58 y 5 mutaciones RED. **No reproducido por el revisor**; no inventar cifras propias.

## Arnés independiente de mutaciones (pendiente de ejecutar)

Los cinco casos mutan SOLO memoria de archivo temporalmente, abortan con anclas ausentes o múltiples, validan GREEN antes, RED por **fallo real de aserción Vitest** y GREEN al restaurar. No modifica expectativas, mocks, hooks, workflows, dependencias ni `docs/revision-pr/**`. Copiar completo a `/tmp/pr453-review-mutants.cjs`, correr desde raíz del proyecto, y conservar las líneas `Tests …` verdaderas. No se ejecutó en esta sesión: el contenedor de revisión no tiene `pnpm` ni acceso de red a GitHub.

```javascript
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = process.cwd();
const file = 'src/features/trips/components/trip-route-map.tsx';
const target = path.join(root, file);
const spec = 'src/features/trips/route-map.test.tsx';
if (!fs.existsSync(target) || !fs.existsSync(path.join(root, spec))) {
  throw new Error('Ejecutar desde la raíz del repositorio cadeApp');
}
const status = spawnSync('git', ['diff', '--quiet', '--', file], {cwd:root});
if (status.status !== 0) throw new Error('El archivo objetivo debe comenzar limpio');

const cases = [
  {
    id:'PR453-H01 / pie sin mapa',
    filter:'PR453-H01',
    from:"              ? 'Mapa no disponible'",
    to:"              ? 'Línea recta orientativa'",
  },
  {
    id:'PR453-H02 / rechazo sin fallback',
    filter:'PR453-H02',
    from:"      () => finish(straight)\n    );",
    to:"      () => { /* mutación: descartar el rechazo y no publicar fallback */ }\n    );",
  },
  {
    id:'PR453-H03 / sin timeout de cálculo',
    filter:'PR453-H03',
    from:"        computeTimer = setTimeout(() => finish(straight), COMPUTE_ROUTES_TIMEOUT_MS);",
    to:"        computeTimer = undefined;",
  },
  {
    id:'PR453-H02 / importación obsoleta calcula',
    filter:'PR453-H02',
    from:"      (routesLibrary) => {\n        if (!active || settled) return;",
    to:"      (routesLibrary) => {\n        // mutación: ignorar guarda de carga tardía",
  },
  {
    id:'PR453-H03 / publica dos veces',
    filter:'PR453-H03',
    from:"    const finish = (result: StreetRouteResult) => {\n      if (!active || settled) return;",
    to:"    const finish = (result: StreetRouteResult) => {\n      if (!active) return;",
  },
];
function check(label, filter, shouldBeGreen) {
  const args = ['exec','vitest','run',spec,'-t',filter];
  const run = spawnSync('pnpm',args,{
    cwd:root,encoding:'utf8',timeout:180000,
    env:{...process.env,FORCE_COLOR:'0',NO_COLOR:'1'},
    maxBuffer:6*1024*1024,
  });
  const output = (run.stdout || '')+'\n'+(run.stderr || '');
  const plain = output.replace(/\x1B\[[0-9;]*m/g,'');
  const summary = plain.split('\n').filter(l=>/Tests\s|Test Files\s/.test(l)).slice(-2);
  process.stdout.write(label+': '+summary.join(' | ')+' (exit='+run.status+')\n');
  if (run.error || !summary.some(x=>/Tests\s/.test(x))) {
    throw new Error(label+': ejecución inválida / sin resumen; NO contar como RED');
  }
  if (shouldBeGreen && (run.status !== 0 || !/Tests\s+\d+ passed/.test(plain))) {
    throw new Error(label+': el control no está GREEN');
  }
  if (!shouldBeGreen && (run.status === 0 || !/Tests\s+\d+ failed/.test(plain))) {
    throw new Error(label+': el mutante NO produjo un RED de pruebas válido');
  }
}
for (const test of cases) {
  const original = fs.readFileSync(target,'utf8');
  const count = original.split(test.from).length - 1;
  if (count !== 1 || test.from===test.to) throw new Error(test.id+': ancla ausente, ambigua o inválida; SIN OBJETIVO');
  check(test.id+' CONTROL',test.filter,true);
  try {
    fs.writeFileSync(target,original.replace(test.from,test.to));
    check(test.id+' MUTANTE',test.filter,false);
  } finally {
    fs.writeFileSync(target,original);
  }
  check(test.id+' RESTAURADO',test.filter,true);
}
const end = spawnSync('git',['diff','--exit-code','--',file],{cwd:root,stdio:'inherit'});
if(end.status!==0) throw new Error('El archivo no quedó restaurado');
process.stdout.write('5/5 mutaciones con control GREEN y mutante RED: ver stdout anterior\n');
```

### Ejecución real exigida antes de marcar `arreglado-verificado`

```bash
# Desde un worktree limpio creado en el SHA de código, no el HEAD documental.
git worktree add /tmp/cadeapp-pr453-1aa5457 1aa545786a55bd100e4f810c95222e600b55228d
cd /tmp/cadeapp-pr453-1aa5457
pnpm install --frozen-lockfile
pnpm exec vitest run src/features/trips/route-map.test.tsx
# Copiar el bloque JavaScript anterior a /tmp/pr453-review-mutants.cjs y:
node /tmp/pr453-review-mutants.cjs
pnpm typecheck && pnpm lint && pnpm test
```

No ejecutar Docker/Supabase local ni acciones con secretos. Solo cambiar estados estructurados a `arreglado-verificado` después de ejecutar y registrar `verificado_en_sha` = SHA probado, método, fecha y salidas exactas. **El CI verde documental no reemplaza este paso**.
