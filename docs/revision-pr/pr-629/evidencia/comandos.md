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

---

# Ronda 2 — comprobación del SHA `af61096fdad07593686f7c6870dc8a204323f695`

## Origen y condiciones

- **Inspección directa por conector GitHub:** código de `src/ui/sheet.tsx` y `sheet.test.tsx` y comparación de blobs contra `89c9ed13615d02980f7ff28d3599fecb89b52852`.
- **Control de carpeta:** `revisiones/ronda-1.md` conserva blob `9e25e2b7079bf77e08449c6efdd24db74eda7744`, mismo que en `d5d2ca0a`. Sin modificación del autor.
- **Reintento de clonar:** `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` → `Could not resolve host: github.com`. No se ejecutó git merge-tree, mutaciones ni Playwright local.

## CC-046: H01 compartido verificado

```text
src/ui/sheet.tsx blob:
  af61096fdad07593686f7c6870dc8a204323f695 = 59e13841f7aa7ad7d2589d46e2e59c11174b84b2
  89c9ed13615d02980f7ff28d3599fecb89b52852 = 59e13841f7aa7ad7d2589d46e2e59c11174b84b2
src/ui/sheet.test.tsx blob:
  af61096fdad07593686f7c6870dc8a204323f695 = 06d9ae8f5929ccf6103caafa3effb51958553814
  89c9ed13615d02980f7ff28d3599fecb89b52852 = 06d9ae8f5929ccf6103caafa3effb51958553814
```

**CC E2E:** https://github.com/cadeApp/cadeApp/actions/runs/42249814951 (job `128001704352`, `e2e-preview=success`): `admin-nav-mobile.spec.ts:72` y `:109` pasaron, con geometría 390/1023 y retorno del foco. Aceptación independiente: `docs/revision-pr/pr-631/revisiones/ronda-3.md`.

El **test E2E de T-405** hace 1280/390 y sigue hasta guardar, auditoría y sus filas. Fue leído desde `af61096f`, pero no tenía ejecución de gate disponible al cerrar R2.

## CI del SHA funcional

Run: https://github.com/cadeApp/cadeApp/actions/runs/42258573043

| Job | ID | Estado al consultar |
|---|---|---|
| lint | 128032199675 | completed/success |
| typecheck | 128032200195 | completed/success |
| unit | 128032200126 | completed/success |
| audit | 128032200181 | completed/success |
| build | 128032200276 | completed/success |
| bundle-budget | 128033080941 | completed/success |
| db-tests | 128032200249 | in_progress |

Salida del job `unit` (registrada desde los logs oficiales, no ejecutada localmente):

```text
Test Files  195 passed (195)
     Tests  3686 passed (3686)
# tests 86
# pass 86
# fail 0
# tests 6
# pass 6
# fail 0
```

## Control de diseño contra mutación (procedimiento **pendiente**, no salida inventada)

Después del CC, para probar la sensibilidad del **E2E nuevo T-405**: en una rama aislada de prueba y bajo la regla de mutaciones, cambiar temporalmente en `src/ui/sheet.tsx` el ternario `side === 'right' ? 'justify-end' : 'justify-center'` por `'justify-center'`. La prueba geométrica a 1280 px debe fallar **por borde derecho**, no por error de mocks o compilación. Restaurar antes de cualquier deploy público o commit real. En la prueba específica, una mutación de `expect(...).toBeLessThanOrEqual(2)` a una condición siempre verdadera sería una **adulteración de aserción prohibida** y no una mutación válida.

Mutación alternativa segura solo en pruebas internas: quitar temporalmente la condición `if (width >= 640)` para comprobar que en móvil no exige `x>0`; restaurar. **No da por sí sola un RED funcional**, así que no sirve como evidencia suficiente.

Para M01, antes de declarar GREEN, ejecutar el E2E con fecha dinámica y comprobar el par guardar + auditoría; una fecha forzada al pasado debería fallar por contrato del dominio si realmente se valida vigencia. No modificar expectativas para fabricar ese RED. No se ejecutaron estas mutaciones en R2.

## Gate pendiente

Verificar un run de `e2e-preview` que informe `TARGET_SHA=af61096fdad07593686f7c6870dc8a204323f695`, y dentro de `global-settings` buscar la línea:

```text
T-405: extender el piloto desde el panel lateral y seguir el movimiento hasta la auditoría
```

El resultado debe incluir ejecución de esta prueba, su salida y el estado final del job. Si falla por `getByText('Mostrando los eventos de una sola entidad.')` duplicado, correlacionar con T-426 (#639/#640) mediante trace; **no** declarar verde ni alterar expectations para pasarlo. El estado de CC-046 no reemplaza este gate.

**No exigir otro CI GREEN solo por el commit de documentación de R2.**
