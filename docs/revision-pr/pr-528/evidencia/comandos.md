# Evidencia reproducible — PR #528 · T-412 / CC-039

**SHA bajo inspección:** `f20ed0db2c8923885c80adbe1b5aa365e6e7d43c`. Estos son los comandos propuestos para un *worktree limpio* del SHA de código, sin Supabase remoto ni Docker local. Este entorno de revisión **no dispone de un clon conectado a GitHub**; la ejecución real proviene de los jobs de CI citados a continuación.

## Resultados realmente leídos
- CI https://github.com/cadeApp/cadeApp/actions/runs/39839093772: `unit` job 120035724515, 168 archivos/3289 tests PASS; `typecheck`, `lint`, `build`, `bundle-budget` PASS.
- `db-tests` job 120035724044 SUCCESS: `cc039_get_publication_offer.sql .......... ok`; `Files=38, Tests=3153`; `Result: PASS`; `git diff --exit-code -- src/types/database.types.ts` completed.
- RED remoto deliberado https://github.com/cadeApp/cadeApp/pull/529 job 120009327256: `function "public.get_publication_offer()" does not exist`; suite pgTAP FAIL, PR cerrada sin merge.
- `audit` job 120035724514 FAILED: advisories Next.js GHSA-2464-fhr4-w9xw y GHSA-p3m5-59mp-jv5r. Issue #530.
- El harness de mutación propio de abajo fue revisado con `node --check` (sintaxis OK); **no se corrió contra este repo por falta de clon y dependencias**. No debe presentarse como RED ejecutado.

## Comandos de control para quien tenga un clon
```bash
git fetch origin
git worktree add /tmp/pr528-revision f20ed0db2c8923885c80adbe1b5aa365e6e7d43c
cd /tmp/pr528-revision
pnpm install --frozen-lockfile
pnpm exec vitest run src/features/merchants/components/publication-offer-section.test.tsx src/domain/cc039-get-publication-offer.test.ts
pnpm typecheck && pnpm lint
# La base se verifica con logs del job db-tests CI; NO levantar Docker o Supabase remoto/local en la revisión.
```

## Harness completo de dos mutaciones independientes H02/H03
Guardar el siguiente contenido como `/tmp/pr528-mutations.mjs`, ejecutar `node --check /tmp/pr528-mutations.mjs` y, **desde el worktree limpio**, ejecutar `node /tmp/pr528-mutations.mjs`. El script hace baseline GREEN, muta **solo el código en el worktree**, exige RED y restaura el archivo desde una copia en memoria en `finally` (no usa `git checkout` ni altera tests).

```js
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const cases = [
  {
    id: 'H02',
    file: 'src/features/merchants/components/publication-offer-section.tsx',
    suite: 'src/features/merchants/components/publication-offer-section.test.tsx',
    test: 'PR528-H02:',
    change(source) {
      const anchor = '        {discount}\n        <Card';
      if (!source.includes(anchor)) throw new Error('H02: ancla no encontrada');
      return source.replace(anchor, '        {null}\n        <Card');
    },
  },
  {
    id: 'H03',
    file: 'src/domain/rpc-contracts.ts',
    suite: 'src/domain/cc039-get-publication-offer.test.ts',
    test: 'PR528-H03:',
    change(source) {
      const pattern = /\.strict\(\)\n  \/\/ PR528-H03:[^\n]*\n  \.refine\([\s\S]*?\n  \}\);/;
      if (!pattern.test(source)) throw new Error('H03: refine no encontrada');
      return source.replace(pattern, '.strict();');
    },
  },
];

function run(testCase) {
  const out = spawnSync('pnpm', ['exec', 'vitest', 'run', testCase.suite, '-t', testCase.test], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (out.error) throw out.error;
  const all = `${out.stdout}\n${out.stderr}`;
  console.log(`${testCase.id}: exit=${out.status}`);
  console.log(all.split('\n').filter(line => /Test Files|Tests|FAIL|PASS|AssertionError/.test(line)).slice(-7).join('\n'));
  return { status: out.status, output: all };
}

for (const testCase of cases) {
  const before = run(testCase);
  if (before.status !== 0) throw new Error(`${testCase.id}: baseline no verde`);
  const original = fs.readFileSync(testCase.file, 'utf8');
  const mutated = testCase.change(original);
  try {
    fs.writeFileSync(testCase.file, mutated, 'utf8');
    const red = run(testCase);
    if (red.status === 0 || !/FAIL|AssertionError|failed/i.test(red.output)) {
      throw new Error(`${testCase.id}: la mutación no produjo una falla atribuible al test`);
    }
  } finally {
    fs.writeFileSync(testCase.file, original, 'utf8');
  }
  const after = run(testCase);
  if (after.status !== 0) throw new Error(`${testCase.id}: no volvió a verde`);
}
```
