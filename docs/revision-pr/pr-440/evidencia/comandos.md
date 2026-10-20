# Evidencia y comandos reproducibles — PR #440 / T-378

**SHA revisado:** `9e1380239986eda5d7b43c5b1d7949ab6de9c93e`.  
**Estado real de ejecución independiente:** no ejecutado (sin clon de GitHub accesible desde el contenedor de esta revisión). **No hay una salida RED observada; ninguna se simula ni inventa.**

## Control sin mutar (GREEN declarado por CI oficial)

- GitHub Actions, job `unit` 118450875222, SHA `9e138023`: PASS; la bitácora declara 2894/2894, no se reprodujo localmente.
- GitHub Actions, job `build` 118450875054: PASS en SHA nuevo (el anterior 118448662926 falló en `next/font`).
- GitHub Actions, job `typecheck` 118450874943: PASS.
- GitHub Actions, job `lint` 118450874998: PASS, a pesar de avisos Prettier consultivos.
- No se afirmaron ejecuciones de `pnpm` en el entorno del revisor.

## PR440-H01 — Batería de mutaciones propia

El siguiente script completo modifica **solo temporalmente** la copia local de los archivos de producción, guarda el contenido original como string EN MEMORIA y lo restaura con `finally`. **Nunca** usa `git checkout`, `git restore`, rebase, force-push, amend, alteración de tests ni escrituras a remoto.

Copiar el bloque a `/tmp/pr440-mutaciones.cjs` y ejecutarlo desde un clon limpio en el SHA revisado con `node /tmp/pr440-mutaciones.cjs`. Primero corre el control GREEN; luego cada mutación por separado. Un `MUTANTE INDETECTADO` con la prueba actual demuestra el hueco; después del arreglo de los asserts todos los mutantes deben dar `RED esperado` y el control original debe conservar `GREEN`.

~~~js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
const specs = 'src/features/trips/components.test.tsx';
const paths = [
  'src/features/trips/components/trip-merchant-view.tsx',
  'src/features/trips/components/trip-courier-view.tsx',
];
const mutants = [
  {
    label: 'sin icono ArrowLeft',
    before: '<ArrowLeft className="h-5 w-5" aria-hidden="true" />',
    after: '',
  },
  {
    label: 'sin area tactil de 48 px',
    before: 'h-12 min-h-12 w-12 min-w-12',
    after: '',
  },
];

function testCase(label) {
  const r = spawnSync('pnpm', ['exec', 'vitest', 'run', specs], {
    cwd: root, encoding: 'utf8', timeout: 180000,
  });
  const combined = (r.stdout || '') + '\n' + (r.stderr || '');
  const selected = combined.split(/\r?\n/).filter(line =>
    /Test Files|Tests\s|FAIL|AssertionError|Error:/.test(line)
  );
  process.stdout.write(label + ': exit=' + r.status + '\n' + selected.slice(-12).join('\n') + '\n');
  if (r.error) throw r.error;
  if (r.status === null) throw new Error('Vitest no produjo estado verificable: ' + label);
  return r.status;
}

const base = testCase('CONTROL sin mutar');
if (base !== 0) throw new Error('El control original debe estar GREEN antes de hacer mutaciones');

for (const rel of paths) {
  const abs = path.join(root, rel);
  const original = fs.readFileSync(abs, 'utf8');
  for (const mutant of mutants) {
    const count = original.split(mutant.before).length - 1;
    if (count !== 1) throw new Error('Instrumento invalido: target '+rel+' / '+mutant.label+' coincidencias='+count);
    try {
      fs.writeFileSync(abs, original.replace(mutant.before, mutant.after), 'utf8');
      const status = testCase('MUTACION ' + rel + ' / ' + mutant.label);
      process.stdout.write(status === 0
        ? 'MUTANTE INDETECTADO por los tests existentes (GREEN)\n'
        : 'RED esperado: los tests detectaron la mutacion\n');
    } finally {
      fs.writeFileSync(abs, original, 'utf8');
    }
  }
}
if (testCase('CONTROL restaurado') !== 0) {
  throw new Error('Los controles dejaron de estar verdes al restaurar el codigo');
}
process.stdout.write('Comprobar ademas: git diff --exit-code -- src/features/trips/components/\n');
~~~

## Cómo usarlo para el arreglo

1. Comprobar `git status --short` limpio sobre el SHA anunciado, sin `.env` ni secretos.
2. Guardar el script anterior en `/tmp`; ejecutar sin alterar archivos test.
3. Añadir las aserciones a ambos `it('T-378: tiene una flecha ...')` en `src/features/trips/components.test.tsx` únicamente.
4. Repetir el script: original GREEN; cada variante de icono y tamaño RED. Pegá únicamente las líneas `Test Files` / `Tests` y el nombre del mutante.
5. Confirmar `git diff --exit-code -- src/features/trips/components/trip-courier-view.tsx src/features/trips/components/trip-merchant-view.tsx` para garantizar restauración; `git status` mostrará solamente los cambios intencionales a test/bitácora.
6. `pnpm typecheck && pnpm lint && pnpm vitest run src/features/trips/components.test.tsx src/features/offers/courier-panel.test.tsx`; CI posterior al push verifica el conjunto completo.

**Restricción:** esta batería no ejecutó nada desde el entorno del revisor. La ejecución RED/GREEN por el agy no sustituye su posterior verificación independiente.