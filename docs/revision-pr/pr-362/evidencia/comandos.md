# Evidencia y comandos reproducibles — PR #362 / Ronda 1

## Alcance real de esta sesión
- PR y archivos leídos mediante conector GitHub al SHA `1a433728edcd8e7d6a5e89f27e07763fe330083a`.
- `git ls-remote https://github.com/cadeApp/cadeApp.git refs/heads/develop refs/heads/feat/T-353-validacion-formularios` → `Could not resolve host: github.com`. No se obtuvo clon ni pudo instalarse `pnpm`.
- El control JS aislado de abajo **sí** se ejecutó con Node 22, copiando la lógica de `src/lib/whatsapp.ts` y las regex de producción. No importa Zod, no afirma RED→GREEN de Vitest y no cambia archivos del PR.
- El autor declaró 129 archivos / 2196 tests GREEN en bitácora; no se verificó independientemente.

## Control aislado de patrones JS (script COMPLETO)

Pegá este bloque en una shell con Node >= 20; solo crea `/tmp/pr362-probes.cjs` y lo ejecuta:

```bash
cat >/tmp/pr362-probes.cjs <<'JS'
'use strict';
const plate = /^(?:[A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]\s?\d{3}\s?[A-Z]{3}|[A-Z]{3}\s?\d{3}|\d{3}\s?[A-Z]{3})$/i;
function extractValidArgentineTenDigits(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string' || rawPhone.trim().length === 0) throw Error('Número inválido: se requieren 10 dígitos');
  if (/[a-zA-Z]/.test(rawPhone)) throw Error('letras');
  if (/[^0-9\s+().-]/.test(rawPhone)) throw Error('símbolos');
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('549') && digits.length >= 13) digits = digits.slice(3);
  else if (digits.startsWith('54') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 12 && digits.slice(4, 6) === '15') digits = `${digits.slice(0, 4)}${digits.slice(6)}`;
  else if (digits.length === 12 && digits.slice(3, 5) === '15') digits = `${digits.slice(0, 3)}${digits.slice(5)}`;
  else if (digits.length === 12 && digits.slice(2, 4) === '15') digits = `${digits.slice(0, 2)}${digits.slice(4)}`;
  if (digits.length !== 10) throw Error('longitud');
  return digits;
}
for (const v of ['++54 9 3865 123456', '3865 +123456', '+54 9 3865 123456']) {
  try { console.log('phone', JSON.stringify(v), '->', extractValidArgentineTenDigits(v)); }
  catch (e) { console.log('phone', JSON.stringify(v), '-> ERR', e.message); }
}
for (const v of ['123 ABC', 'ELA 666']) console.log('regex plate', JSON.stringify(v), '=', plate.test(v), '(sin vehicleType)');
for (const v of ['Dejar en portería\nSegundo piso', 'Portón azul\t tocar']) console.log('notes controls', JSON.stringify(v), 'rejected=', /[\x00-\x1F\x7F]/.test(v));
JS
node /tmp/pr362-probes.cjs
```

Salida observada:

```text
phone "++54 9 3865 123456" -> 3865123456
phone "3865 +123456" -> 3865123456
phone "+54 9 3865 123456" -> 3865123456
regex plate "123 ABC" = true (sin vehicleType)
regex plate "ELA 666" = true (sin vehicleType)
notes controls "Dejar en portería\\nSegundo piso" rejected= true
notes controls "Portón azul\\t tocar" rejected= true
```

## Controles exactos a ejecutar con el clon limpio, en ronda de corrección
```bash
git pull origin feat/T-353-validacion-formularios # sin rebase, force ni amend
pnpm exec vitest run src/features/courier-onboarding/schemas.test.ts src/features/courier-onboarding/components.test.tsx src/features/courier-onboarding/actions.test.ts src/features/merchants/schemas.test.ts src/features/merchants/actions.test.ts src/features/requests/schemas.test.ts src/features/requests/actions.test.ts src/lib/whatsapp.test.ts > /tmp/pr362-focused.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr362-focused.log | tail -8
pnpm typecheck > /tmp/pr362-typecheck.log 2>&1
pnpm lint > /tmp/pr362-lint.log 2>&1
pnpm test > /tmp/pr362-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr362-unit.log | tail -8
node docs/revision-pr/analizar.mjs verificacion
git status --short
git ls-remote origin feat/T-353-validacion-formularios
```

**Plan de mutaciones (no ejecutado aquí, debe ejecutarse en el scratch del agente y verificarse independientemente después):** H01 restaurar `.max(10_000_000)`; H02 eliminar transform del phone y permitir `++54`; H03 reemplazar transform `walk/bike` por rechazo; H04 usar regex de controles completo en notes; H05 saltar el parseo de Action; H06 invertir el caso UI válido/inválido. Nunca commitear mutaciones, ni modificar tests para conseguir verde.

Para E2E, usar el job existente asociado al Preview de la PR y registrar URL, SHA y run verdaderos; nunca ejecutar contra producción.

---

## Ronda 2 — inspección `5dfb57b` (2026-10-15)

**Fuente:** GitHub conector, comparación de `edcc933a` a `5dfb57b`, lectura de archivos exact-head y estado de Actions. No había clon por imposibilidad de resolver DNS github.com. Se respetó la regla de no presentar inspección como ejecución.

- `e2e/specs/multi-drop.spec.ts:968-982`: `if (await phoneInput.isVisible())` abarca todas las aserciones. Ausencia del campo → cero expectativas ejecutadas.
- `e2e/specs/courier-onboarding.spec.ts:672-707`: tras corregir DNI la última línea afirma que no se muestra el error; no hay submit ni destino válido.
- `src/lib/whatsapp.test.ts`: 109 líneas, pero la bitácora afirma RED para `162-178`.
- `src/features/courier-onboarding/schemas.test.ts`: 189 líneas, pero la bitácora afirma RED para `384-406`.
- `src/features/merchants/schemas.test.ts`: 295 líneas, pero la bitácora cita `285-300`.

### Arreglos exigidos y mutaciones en scratch — ejecutar en entorno del agy

```bash
# Primero actualizar rama sin rebase
git pull origin feat/T-353-validacion-formularios

# Tests enfocados antes de mutar (GREEN real capturado)
pnpm exec vitest run src/lib/whatsapp.test.ts src/features/requests/schemas.test.ts src/features/merchants/schemas.test.ts src/features/courier-onboarding/schemas.test.ts src/features/requests/actions.test.ts src/features/merchants/actions.test.ts src/features/courier-onboarding/actions.test.ts > /tmp/pr362-r2-focused.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr362-r2-focused.log | tail -10

# Solo E2E contra Preview+Supabase Develop, mediante el workflow existente.
# Aportar run ID, SHA exacto, resultado de specs aplicables y pasos reales, sin producción.
# Mutación 1: apuntar el locator de recipientPhone a un name imposible; el test DEBE caer por toBeVisible.
# Mutación 2: impedir el submit final de formulario reparado; el E2E DEBE caer por no completar flujo.
# Las mutaciones se revierten antes del commit, nunca se pushean ni se despliegan.
pnpm typecheck > /tmp/pr362-r2-typecheck.log 2>&1
pnpm lint > /tmp/pr362-r2-lint.log 2>&1
pnpm test > /tmp/pr362-r2-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr362-r2-unit.log | tail -10
git diff --check
git status --short
git ls-remote origin feat/T-353-validacion-formularios
```

Este documento registra condiciones para las pruebas, no resultados inventados. La verificación RED de E2E exige corrida segura de la spec en el ambiente configurado (sin desplegar código mutado).

---

## Ronda 3 — lectura exacta de `55fa228e8d8b37b3d06426d02e816ce776398419` (2026-10-15)

**Lecturas verificables mediante conector GitHub:** `compare(57f748c5,55fa228)`=1 commit, 3 archivos: `docs/tasks/log/T-353.md`, `e2e/specs/courier-onboarding.spec.ts`, `e2e/specs/multi-drop.spec.ts`. No cambios a `docs/revision-pr/**` escritos por P2. Los snippets exactos están en el informe R3.

**GitHub check-runs** `GET /repos/cadeApp/cadeApp/commits/55fa228e8d8b37b3d06426d02e816ce776398419/check-runs` (consultado durante R3):
- success: lint, unit, typecheck, build, audit, bundle-budget, Vercel Preview Comments.
- in_progress: db-tests.
- failure: approval-policy.
- skipped: Supabase Preview.
- No contexto `e2e-preview` visible entre los 10 checks de este SHA. Es falta de evidencia de ejecución, no un RED E2E probado.

**Comandos de lectura que puede usar el agy SIN disparar workflows:**
```bash
gh api repos/cadeApp/cadeApp/commits/55fa228e8d8b37b3d06426d02e816ce776398419/check-runs --jq '.check_runs[] | [.name,.status,.conclusion,.details_url] | @tsv'
gh api repos/cadeApp/cadeApp/commits/55fa228e8d8b37b3d06426d02e816ce776398419/status --jq '.statuses[] | [.context,.state,.target_url] | @tsv'
```
- `e2e-preview` confiable se activa por `repository_dispatch` de Vercel, no mediante test: los cambios de la PR no deben editar ese workflow ni simular un green.
- En `e2e/specs/multi-drop.spec.ts`, eliminar la dependencia de `order(created_at).limit(1)` usando conjuntos de IDs antes y después de la acción. Dejar la consulta privada al drop identificado, sin revelar datos sensibles por consola.
- **Mutaciones R3 de este revisor:** NO ejecutadas por falta de clon runtime. Reproducir en worktree aislado más adelante, no presentar control Node copiado como ejecución de Playwright.

### Validación local pendiente del autor

```bash
pnpm exec vitest run src/features/requests/schemas.test.ts src/features/merchants/schemas.test.ts src/features/courier-onboarding/schemas.test.ts src/features/requests/actions.test.ts src/features/merchants/actions.test.ts src/features/courier-onboarding/actions.test.ts src/lib/whatsapp.test.ts > /tmp/pr362-r3-focused.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr362-r3-focused.log | tail -10
pnpm typecheck > /tmp/pr362-r3-typecheck.log 2>&1
pnpm lint > /tmp/pr362-r3-lint.log 2>&1
pnpm test > /tmp/pr362-r3-test.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr362-r3-test.log | tail -10
git diff --check
git status --short
git ls-remote origin feat/T-353-validacion-formularios
```

---

## Ronda 4 — `aa191cbc` (2026-10-15)

Revisión remota por conector GitHub. Comparación `266f125..aa191cbc`: 1 commit, 2 archivos, fuera de `docs/revision-pr`.
`GET /repos/cadeApp/cadeApp/commits/aa191cbc039f3600cfc46abe79edc090c72a8f5f/check-runs`: 10 checks, success en unit/lint/typecheck/build/audit/bundle-budget/Vercel Preview Comments; in_progress en db-tests, failure en approval-policy, skipped en Supabase Preview; NO `e2e-preview`. Combined status muestra Vercel – cadeapp-staging: success, sin `e2e-preview`.

### Probe Node aislado (ejecutado aquí, NO Vitest)

```bash
node <<'JS'
const parsed = { success: false, data: undefined };
try {
  if (false && !parsed.success) throw Error('VALIDATION_ERROR');
  const data = parsed.data;
  if (!data.requestId) throw Error('VALIDATION_ERROR');
} catch (error) {
  console.log(error.name + ': ' + error.message);
}
JS
```

**Salida verificada:** `TypeError: Cannot read properties of undefined (reading 'requestId')`. La mutación que suprime la guarda no es un mutante semántico válido para la expectativa de no-escritura.

### Propuesta de control RED válido para el agy (no ejecutado por la revisión)

Copiar a `/tmp/pr362-mutant-h05.cjs` (fuera de la rama). Ejecuta `GREEN control → RED semántico → GREEN restaurado` y restaura `src/features/requests/schemas.ts` con `finally` incluso ante error. El usuario del runner debe disponer de `pnpm`, Vitest y worktree limpio:

```js
'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const file = 'src/features/requests/schemas.ts';
const original = fs.readFileSync(file, 'utf8');
const needle = ".refine((val) => !/[<>]/.test(val), {\n        message: 'El nombre no puede contener etiquetas HTML o scripts',";
const altered = ".refine(() => true, {\n        message: 'El nombre no puede contener etiquetas HTML o scripts',";
if (original.split(needle).length !== 2) throw new Error('El objetivo H05 no es único, abortar');
const run = (label) => {
  const r = cp.spawnSync('pnpm', ['exec','vitest','run','src/features/requests/actions.test.ts'], { encoding:'utf8' });
  const out = String(r.stdout||'')+'\n'+String(r.stderr||'');
  console.log('--- '+label+' exit='+r.status+' ---');
  console.log(out.split('\n').filter(x => /Test Files|Tests|AssertionError|TypeError|SyntaxError/.test(x)).slice(-20).join('\n'));
  return { status:r.status, out };
};
try {
  const control=run('GREEN-ORIGINAL');
  if (control.status!==0) throw new Error('Control original no verde');
  fs.writeFileSync(file, original.replace(needle,altered));
  const red=run('RED-PREDICADO-NOMBRE');
  if (red.status===0) throw new Error('Mutante sobrevivió');
  if (!red.out.includes('AssertionError') || /TypeError|SyntaxError/.test(red.out)) throw new Error('RED inválido: excepción del arnés y no aserción');
} finally {
  fs.writeFileSync(file, original);
}
const restored=run('GREEN-RESTABLECIDO');
if (restored.status!==0) throw new Error('Restauración no quedó GREEN');
```

**No declarar que el script anterior se ejecutó:** solamente la semántica de TypeError se probó en esta revisión.

Comandos finales tras restauración:
```bash
node /tmp/pr362-mutant-h05.cjs > /tmp/pr362-h05-output.log 2>&1
grep -E 'GREEN-|RED-|Test Files|Tests|AssertionError|TypeError|SyntaxError' /tmp/pr362-h05-output.log | tail -25
git diff --exit-code -- src/features/requests/schemas.ts
pnpm typecheck > /tmp/pr362-r4-typecheck.log 2>&1
pnpm lint > /tmp/pr362-r4-lint.log 2>&1
pnpm test > /tmp/pr362-r4-test.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr362-r4-test.log | tail -8
git diff --check
git status --short
```
