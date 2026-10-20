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

## Ronda 2 — mutaciones nuevas sobre el fix (no sustituyen a Vitest)

Con el SHA `0588a5f`, se leyeron los archivos originales de cada rol y las pruebas. Se ejecutaron **en memoria** cinco cambios por rol: quitar icono, quitar bloque de 48 px, quitar foco, quitar sólo `min-w-12` y quitar sólo `h-12`. La propiedad estructural de accesibilidad queda `false` para los 10 casos con baseline `true` para ambos. Esto verifica que las aserciones nuevas protegen cada token, pero **no afirma haber corrido el script original Vitest mutado**. La evidencia de ese RED la aporta la bitácora del autor.

### Script completo de comprobación estructural (Node, sin dependencias)

Este script es un control independiente complementario; para ejecutar RED/GREEN real, usar el primer harness de este mismo archivo. Puede copiarse a `/tmp/pr440-source-mutants.cjs` y ejecutarse desde un checkout limpio de `0588a5f` como `node /tmp/pr440-source-mutants.cjs`.

~~~js
'use strict';
const fs = require('node:fs');
const root = process.cwd();
const file = (p) => fs.readFileSync(require('node:path').join(root,p),'utf8');
const tests = file('src/features/trips/components.test.tsx');
const helper = tests.match(/function expectAccessibleBackArrow\(back: HTMLElement\) \{([\s\S]*?)\n\}/);
if (!helper) throw new Error('falta helper de test');
for (const token of ['svg.lucide-arrow-left','h-12','w-12','min-h-12','min-w-12','focus-visible:ring-2']) {
  if (!helper[1].includes(token)) throw new Error('asercion ausente: '+token);
}
if ((tests.match(/expectAccessibleBackArrow\(back\);/g) || []).length !== 2) {
  throw new Error('el helper debe ejecutarse para ambos roles');
}
const roles = [
 ['merchant','src/features/trips/components/trip-merchant-view.tsx','/merchant/dashboard','Volver al panel'],
 ['courier','src/features/trips/components/trip-courier-view.tsx','/courier/feed','Volver a solicitudes']
];
let red = 0;
for (const [role,path,href,label] of roles) {
 const source = file(path);
 const link = (source.match(/<Link\s+href="[^"]+"[\s\S]*?<\/Link>/g) || [])
  .find(part=>part.includes('aria-label="'+label+'"'));
 if(!link) throw new Error('falta Link '+role);
 const valid=(s)=>{
   const name=s.match(/className="([^"]+)"/)?.[1] || '';
   const tokens=name.split(/\s+/);
   return s.includes('href="'+href+'"') && s.includes('aria-label="'+label+'"') &&
      s.includes('<ArrowLeft ') &&
      ['h-12','w-12','min-h-12','min-w-12','focus-visible:ring-2']
       .every(token=>tokens.includes(token));
 };
 if(!valid(link)) throw new Error('CONTROL GREEN falló: '+role);
 const changes = [
   ['sin SVG',link.replace('<ArrowLeft className="h-5 w-5" aria-hidden="true" />','')],
   ['sin bloque 48px',link.replace('h-12 min-h-12 w-12 min-w-12','')],
   ['sin ring',link.replace('focus-visible:ring-2','')],
   ['sin min-width',link.replace('min-w-12','')],
   ['sin height',link.replace('h-12','')]
 ];
 for(const [name,mutant] of changes) {
   if(mutant===link) throw new Error('instrumento sin objetivo: '+role+' '+name);
   if(valid(mutant)) throw new Error('MUTANTE INDETECTADO: '+role+' '+name);
   red++;
   process.stdout.write('RED estructural esperado: '+role+' / '+name+'\n');
 }
 process.stdout.write('GREEN estructural original: '+role+'\n');
}
if(red!==10)throw new Error('conteo RED incorrecto '+red);
process.stdout.write('10/10 mutaciones estructurales detectadas; fuente intacta\n');
~~~
