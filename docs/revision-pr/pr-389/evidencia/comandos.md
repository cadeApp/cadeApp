# Evidencia y comandos — PR #389 / ronda 1

**Estado:** inspección remota. El runtime de la revisión no tiene clon y git ls-remote falla por resolución DNS de github.com. No se ejecutaron Vitest, Playwright ni las mutaciones aquí. **Los resultados de abajo son expectativas para probar**, no salidas observadas. El harness es independiente de las mutaciones del autor y restaura los contenidos originales en finally (sin git checkout, rebase ni commit).

## A. Precondiciones de revisión en un clon limpio

~~~bash
git fetch origin
git rev-parse HEAD
git ls-remote origin refs/heads/feat/T-362-cancelacion-viaje-por-rol
git status --short
git diff origin/develop...HEAD --stat
git diff origin/develop -- docs/tasks/T-362.md
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
~~~

HEAD inspeccionado: d872ec9b49a7a7ee0d3a21f7485026545a2ccb49. Si el SHA cambió, hacer ronda nueva y no trasladar etiquetas de verificado.

## B. Harness completo de mutaciones de UI (copiar de la caja /tmp)

Ejecutar desde la raíz del repositorio, preferentemente en un worktree limpio fijado al SHA que se está revisando. El script guarda cada archivo como string y lo repone siempre. No utilizar el script si hay cambios sin commitear sobre los archivos objetivo.

~~~bash
cat >/tmp/pr389-mutations.mjs <<'SCRIPT'
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const suite = 'src/features/trips/components/trip-cancel-dialog.test.tsx';
const target = {
  dialog: 'src/features/trips/components/trip-cancel-dialog.tsx',
  courier: 'src/features/trips/components/trip-courier-container.tsx',
  merchantView: 'src/features/trips/components/trip-merchant-view.tsx',
};
function run() {
  const p = spawnSync('pnpm', ['exec', 'vitest', 'run', suite], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  const log = (p.stdout || '') + '\n' + (p.stderr || '');
  const summary = log.split('\n').filter(line =>
    /Test Files|Tests |FAIL |AssertionError|ReferenceError|Error:/.test(line)
  ).slice(-12).join('\n');
  return { ok: p.status === 0, summary, code: p.status };
}
const original = run();
console.log('CONTROL SIN MUTAR, esperado GREEN:', original);
if (!original.ok) throw new Error('El control ya estaba ROJO; detener la mutación');

function mutate(label, relativePath, beforeText, afterText, expectGreen) {
  const absolutePath = path.join(root, relativePath);
  const before = fs.readFileSync(absolutePath, 'utf8');
  const occurrences = before.split(beforeText).length - 1;
  if (occurrences !== 1) throw new Error(label + ': objetivo no unívoco (' + occurrences + ')');
  try {
    fs.writeFileSync(absolutePath, before.replace(beforeText, afterText));
    const outcome = run();
    console.log('\n' + label + ' (esperado ' + (expectGreen ? 'GREEN/SURVIVE' : 'RED') + '):\n' + outcome.summary);
    if (outcome.ok !== expectGreen) throw new Error(label + ': resultado inesperado, revisar la aserción funcional');
  } finally {
    fs.writeFileSync(absolutePath, before);
  }
}
mutate('M1 lista de cadete equivocada', target.dialog,
  'const reasons = actor === \'courier\' ? COURIER_CANCELLATION_REASONS : MERCHANT_CANCELLATION_REASONS;',
  'const reasons = MERCHANT_CANCELLATION_REASONS;', false);
mutate('M2 razón Emergencia borrada (debe sobrevivir ANTES de arreglar H03)', target.dialog,
  "  'Emergencia',", "  'Otro problema',", true);
mutate('M3 cancelación merchant visible in_transit', target.merchantView,
  '{onCancelTrip && isMatched && (', '{onCancelTrip && !isDelivered && (', false);
mutate('M4 Otro vacío permitido sin ReferenceError', target.dialog,
  'otherReason.trim().length > 0 && otherReason.trim().length <= 500',
  'otherReason.trim().length >= 0 && otherReason.trim().length <= 500', false);
mutate('M5 actor courier perdido en container (debe sobrevivir ANTES de arreglar H04)', target.courier,
  'actor="courier"', 'actor="merchant"', true);
const end = run();
console.log('\nCONTROL RESTAURADO, esperado GREEN:', end);
if (!end.ok) throw new Error('Fallo al restaurar GREEN');
SCRIPT
node /tmp/pr389-mutations.mjs
git status --short
~~~

**Importante:** los mutantes M2 y M5 deben sobrevivir antes de reparar los tests, y dar RED después de añadir los oráculos independientes. En las siguientes rondas la expectativa del harness para esos mutantes debe cambiarse de true a false. No alterar asserts para ocultar fallos. El script está documentado pero no ejecutado por esta revisión: no reemplaza el log real.

## C. Tests y E2E sobre el SHA final (sin secrets)

~~~bash
pnpm exec vitest run src/features/trips/components/trip-cancel-dialog.test.tsx src/features/trips/components.test.tsx src/features/trips/actions.test.ts
pnpm typecheck
pnpm lint
pnpm test
# E2E Preview se observa desde el workflow e2e-preview de GitHub Actions
# Comprobar run, SHA, estado y aserciones DB reales; no ejecutar comandos contra Supabase remoto.
~~~

El spec de E2E se probará mediante el gate del proyecto contra Vercel Preview + Supabase Develop, con fixtures segregados. Las mutaciones de seguridad E2E solo pueden ejecutarse mediante e2e-mutation contra develop **después** de mergear y mediante un cambio/PR autorizado; no desplegar mutantes en PR abierta. Si el run no existe o no terminó, registrar PENDIENTE, nunca GREEN.

## D. Cruce estático

- El spec añadido desde la línea 1151 solo ejecuta courier_cancel_match por UI en matched; merchant aparece solo en el chequeo negativo de in_transit.
- La expectativa positiva unitaria itera constantes exportadas por producción: M2 altera la expectativa automáticamente.
- La suite nueva no monta TripCourierContainer: M5 no ejerce el actor desde el consumidor.
- La mutación C del autor declara ReferenceError, no RED por longitud vacía.
- En /trips/[id] el botón de report_incident ya está disponible en estados autorizados; no modificar RPC de incidentes.
