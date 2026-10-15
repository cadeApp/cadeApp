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
