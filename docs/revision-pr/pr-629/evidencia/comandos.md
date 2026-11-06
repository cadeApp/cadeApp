# Evidencia reproducible — PR #629 · ronda 1

**SHA inspeccionado:** `ae38d57d34320a840b51db619ec6860af9cc8ed6`

**Limitación:** el contenedor de esta revisión no pudo resolver `github.com` al intentar `git ls-remote`. No se clonó ni ejecutó ningún test, mutación, `pnpm`, `git merge-tree` o CI real. Los fragmentos siguientes son **procedimientos reproducibles propuestos**, NO salidas obtenidas. No atribuir `RED confirmado` ni `GREEN confirmado`.

## Arranque de la siguiente ronda (clon limpio)

~~~bash
git fetch origin
git rev-parse HEAD
git ls-remote origin refs/heads/feat/T-405-comercios-a03
git log --oneline -- docs/revision-pr/pr-629/
git merge-tree --write-tree origin/develop HEAD
git diff origin/develop -- docs/tasks/T-405.md
git status --short
~~~

## H01 — Sonda geométrica real en Playwright (después del merge de CC #630)

Agregar en el E2E existente, después de abrir y ver visible el Sheet:

~~~ts
const box = await sheet.boundingBox();
const viewport = adminPage.viewportSize();
if (!box || !viewport) throw new Error('No se pudo medir el panel lateral');
expect(Math.abs(box.x + box.width - viewport.width)).toBeLessThanOrEqual(2);
~~~

**Comportamiento esperado:** con `justify-center` en el wrapper, esta sonda falla en escritorio (el panel no toca el borde derecho); con `justify-end` y diseño de Sheet correcto, queda verde. Verificar también 390 px y el menú admin en el CC. Estas salidas aún **no fueron ejecutadas**.

### Script completo de guardia estructural (auxiliar, no sustituye geometría)

Guardar este script como `/tmp/pr629-sheet-structural.mjs`, ejecutarlo desde la raíz del worktree. Solo detecta la variante de implementación observada en el SHA inicial. Si el CC elige otra implementación válida, adaptar el instrumento **sin debilitar la prueba Playwright**.

~~~bash
cat > /tmp/pr629-sheet-structural.mjs <<'NODE'
import { readFileSync } from 'node:fs';
const file = readFileSync('src/ui/sheet.tsx', 'utf8');
const start = file.indexOf('export function SheetContent(');
const end = file.indexOf('export function SheetHeader(', start);
if (start < 0 || end <= start) throw Error('Sin objetivo: no se encontró SheetContent');
const source = file.slice(start, end);
const root = source.match(/<DialogPrimitive\.Portal>[\s\S]*?<DialogPrimitive\.Overlay/);
if (!root) throw Error('Sin objetivo: no se encontró contenedor del Sheet');
const code = root[0];
if (!/justify-end/.test(code) || !/justify-center/.test(code)) {
  throw Error('RED estructural: falta selector de alineación right/bottom en wrapper');
}
if (!/side\s*===\s*['"]right['"]/.test(code)) {
  throw Error('RED estructural: no se conecta side=right a la alineación del wrapper');
}
const mutant = code.replace(/justify-end/, 'justify-center');
if (mutant === code) throw Error('Sin objetivo: mutación no aplicada');
if (/justify-end/.test(mutant)) throw Error('Mutación no eliminó el alineado a derecha');
console.log('Control estructural preliminar GREEN; mutación aplicada en memoria');
NODE
node /tmp/pr629-sheet-structural.mjs
~~~

**ATENCIÓN:** este script no es un test geométrico ni proporciona una prueba RED→GREEN independiente; solo es una sonda preliminar, por lo que la evidencia real exigida es Playwright. Se propuso, pero no se pudo comprobar su ejecución en este entorno.

## M01 — Fecha futura dinámica (autor T-405)

Cambiar exclusivamente `e2e/specs/publication-credits.global-settings.spec.ts`:

~~~ts
const future = new Date();
future.setUTCDate(future.getUTCDate() + 60);
const pilotUntil = future.toISOString().slice(0, 10);
const pilotUntilDisplay = pilotUntil.split('-').reverse().join('/');
~~~

Reemplazar las **dos** aserciones `'31/01/2027'` por `pilotUntilDisplay`, conservando el uso de `pilotUntil` en `fill` y en la aserción de la fila Supabase. Validar que la fecha dinámica esté dentro de los límites de la RPC si existe cota de vigencia.

Propuesta de mutación en memoria, con ejecución real posterior: sustituir temporalmente el cálculo por una fecha civil de ayer y verificar que el flujo no pueda extender el piloto; restaurar sin hacer `git checkout` de las mutaciones. Documentar la salida **real** del E2E y de CI. Nunca fabricar tests ni adulterar expectations.

## Checks globales pendientes

~~~bash
pnpm typecheck > /tmp/pr629-typecheck.log 2>&1
pnpm lint > /tmp/pr629-lint.log 2>&1
pnpm test > /tmp/pr629-test.log 2>&1
tail -n 15 /tmp/pr629-typecheck.log
tail -n 15 /tmp/pr629-lint.log
grep -E 'Test Files|Tests |Duration' /tmp/pr629-test.log | tail -n 8
node docs/revision-pr/analizar.mjs verificacion
~~~

Para tests locales usar un worktree limpio del SHA que se evalúa. No levantar Supabase ni Docker. Revisar CI/e2e-preview cuando ya no queden bloqueantes, confirmando SHA y resumen numérico del job. No exigir nueva CI GREEN únicamente por el commit de documentación de revisión.
