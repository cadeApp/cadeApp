# Evidencia y arnés completo — PR #737 / T-434

**Comparación:** `632a04f585d4f3ed511a04c45b9407cfe95ec00a` → `a810fdbff53f1bbf43d304cef1af72258dc74625`. No contiene credenciales, `.env` ni comandos para modificar Supabase/Vercel. En esta sesión el origen se leyó por GitHub y se ejecutó el control equivalente **en memoria**; no se ejecutó Playwright propio ni hay clon para copiar el script a `/tmp`. Los resultados de CI citados proceden de los jobs reales.

## RED real observable

- [run 43262434862 (develop)](https://github.com/cadeApp/cadeApp/actions/runs/43262434862) — job `e2e-preview`: fallaron los tres casos originalmente en líneas 271, 803 y 906, junto con `map-privacy:34`. Resumen: `4 failed; 1 flaky; 119 passed`.
- Las tres fallas T-302/T-404 fueron antes del cambio y se originan en la fixture `not_submitted`. En el primer caso el mensaje real fue `INVALID_STATE_TRANSITION`; en los otros, UI sin botones.
- [CI 43273220950](https://github.com/cadeApp/cadeApp/actions/runs/43273220950) sobre `a810fdbff53f1bbf43d304cef1af72258dc74625`: unit/typecheck/lint/build/audit/bundle-budget exitosos; db-tests pendiente al corte. El E2E se activa automáticamente después del CI; **no hay GREEN confirmado** del head al momento de guardar este informe.

## Reproducción independiente: arnés estático M1/M2/M3

Copiar este **bloque completo** en el clon del repo; solo lee objetos Git y muta strings en memoria. Es un control de integridad de la edición, **no reemplaza** una corrida de Playwright.

```bash
cat > /tmp/pr737-review.mjs <<'NODE'
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const path = 'e2e/specs/courier-onboarding.spec.ts';
const base = '632a04f585d4f3ed511a04c45b9407cfe95ec00a';
const head = 'a810fdbff53f1bbf43d304cef1af72258dc74625';
const show = (sha) => execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8' });
const before = show(base);
const after = show(head);

const addedLines = new Set([
  "import { finalizeSeededCourierApplication } from '@/server/e2e/staging-seed';",
  "    // CC-050 (T-434): admin_decide_courier solo decide postulaciones enviadas; el postulante envía su alta como la app.",
  "    await finalizeSeededCourierApplication(createAdminClient(), courier.id, 'bike', null);",
]);
const originalKept = after.split('\n').filter((line) => !addedLines.has(line)).join('\n');
assert.equal(originalKept, before, 'El spec perdió o adulteró líneas preexistentes');
console.log('GREEN: spec base intacto salvo 7 líneas nuevas');

const titles = [
  'DoD: Falla si se quita el chequeo de MFA en aprobación de repartidor',
  'Flujo 3: Admin en UI con MFA aprueba al postulante y lo habilita',
  'T-404: Admin en UI rechaza con un motivo de la lista y el motivo compuesto queda en la auditoría y el historial',
];
const finalizer = "    await finalizeSeededCourierApplication(createAdminClient(), courier.id, 'bike', null);";

function check(code) {
  const errors = [];
  for (const [i, title] of titles.entries()) {
    const start = code.indexOf("test('" + title);
    if (start < 0) { errors.push(`caso ${i + 1} ausente`); continue; }
    const end = code.indexOf('\n  test(', start + 1);
    const body = code.slice(start, end < 0 ? undefined : end);
    const seed = body.indexOf('await usePendingOnboardingCourier(');
    const matches = [...body.matchAll(/await finalizeSeededCourierApplication\(createAdminClient\(\), courier\.id, 'bike', null\);/g)];
    const action = i === 0 ? body.indexOf('unElevatedClient.rpc(') : body.indexOf('await page.goto(');
    if (seed < 0) errors.push(`caso ${i + 1}: no hay seed`);
    if (matches.length !== 1) errors.push(`caso ${i + 1}: finalizer count=${matches.length}`);
    if (matches[0] && matches[0].index < seed) errors.push(`caso ${i + 1}: finaliza antes de seed`);
    if (matches[0] && action >= 0 && matches[0].index > action) errors.push(`caso ${i + 1}: finaliza después del admin`);
  }
  return errors;
}
assert.deepEqual(check(after), [], 'Precondiciones no válidas en head');
console.log('GREEN: tres postulación enviadas ANTES de decidir');

for (let index = 0; index < 3; index += 1) {
  let at = -1;
  let from = 0;
  for (let current = 0; current <= index; current += 1) {
    at = after.indexOf(finalizer, from);
    assert.ok(at >= 0, 'No se encontró la llamada a mutar');
    from = at + finalizer.length;
  }
  const mutant = after.slice(0, at) + after.slice(at + finalizer.length);
  const errors = check(mutant);
  assert.ok(errors.some((e) => e.includes(`caso ${index + 1}: finalizer count=0`)), 'El control aceptó la mutación');
  console.log(`RED M${index + 1}: ${errors.join('; ')}`);
}
console.log('GREEN final: versión no mutada pasa; todos los mutantes fallan');
NODE
node /tmp/pr737-review.mjs
```

**Resultado de la ejecución equivalente en memoria sobre las dos versiones leídas vía GitHub:**

```text
GREEN: spec base intacto salvo 7 líneas nuevas
GREEN: tres postulaciones enviadas ANTES de decidir
RED M1: caso 1: finalizer count=0
RED M2: caso 2: finalizer count=0
RED M3: caso 3: finalizer count=0
GREEN final: versión no mutada pasa; todos los mutantes fallan
```

Las mutaciones no se escribieron en archivos, no se hicieron commits y el código fuente quedó intacto. Este harness protege la integridad estructural de la edición; el oráculo funcional debe ser Playwright.

## Comprobaciones de Git y del E2E (solo lectura)

```bash
git fetch origin
git diff 632a04f585d4f3ed511a04c45b9407cfe95ec00a...a810fdbff53f1bbf43d304cef1af72258dc74625 --stat
git diff 632a04f585d4f3ed511a04c45b9407cfe95ec00a...a810fdbff53f1bbf43d304cef1af72258dc74625 -- e2e/specs/courier-onboarding.spec.ts docs/tasks/log/T-434.md
git merge-tree --write-tree origin/develop a810fdbff53f1bbf43d304cef1af72258dc74625
node docs/revision-pr/analizar.mjs verificacion
# Sobre un entorno local E2E seguro, si está configurado y autorizado:
# pnpm exec playwright test e2e/specs/courier-onboarding.spec.ts --project=chromium --workers=1 \
#   --grep 'DoD: Falla si se quita el chequeo de MFA|Flujo 3: Admin en UI con MFA|T-404: Admin en UI rechaza'
```

No se corrieron `git merge-tree`, `analizar.mjs` ni el comando Playwright en esta sesión por falta de checkout/red. No iniciar Docker local, manipular secretos ni disparar workflows manuales para compensarlo.
