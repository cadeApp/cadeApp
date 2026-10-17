# Evidencia reproducible — PR #403 / Ronda 1

**Inspección independiente:** SHA `d1af180bbe7a0ac562dfe20fd5ed919aca3aa3c3`, 2026-10-17. El contenedor no puede resolver `github.com` y carece de clon; no ejecuté Vitest/E2E ni las mutaciones. No inventar líneas `Tests ...` RED.

## Evidencia fuente consultada

- `queries.ts:157-161` solo valida `courier/<id>/`. La RPC `20261016033941_cc025_onboarding_atomic.sql` comprueba solo la carpeta y `..` para el alta original. No hay verificación de `avatar_`.
- `queries.test.ts:311,334` introduce `any` y el mock de tabla ignora argumentos de filtros.
- `courier-onboarding.spec.ts:1542-1546` prueba DOM src/token pero no imagen decodificada ni otro courier.
- CI: https://github.com/cadeApp/cadeApp/actions/runs/39061969728 — 7 jobs verdes; job DB 117481608182: `Files=29, Tests=2735, Result: PASS`.
- E2E Preview: https://github.com/cadeApp/cadeApp/actions/runs/39062060834 — `cancelled`; check del SHA `error`.
- Approval policy: https://github.com/cadeApp/cadeApp/actions/runs/39062004953 — `failure`.

## Revalidación GREEN independiente (pendiente)

Desde un clon actualizado del HEAD del autor, en worktree limpio y **sin Supabase/Docker local**:

```bash
git fetch origin
git worktree add /tmp/pr403-verify origin/feat/T-367-avatar-perfil
cd /tmp/pr403-verify
corepack pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm exec vitest run src/features/courier-onboarding/queries.test.ts 'src/app/(courier)/courier/profile/page.test.tsx' src/features/courier-onboarding/components.test.tsx
node docs/revision-pr/analizar.mjs verificacion
```

## Harness completo para mutation RED del filtro de nombre (solo DESPUÉS del fix)

El agente debe introducir el test `rechaza kind avatar con path selfie/DNI` y la guarda exacta `const expectedPrefix = `courier/${courierId}/avatar_`;`. Para demostrar que la prueba detecta su debilitamiento, el siguiente script primero comprueba GREEN en árbol limpio, reemplaza en memoria el guard estricto por el débil solo temporalmente, exige RED y restaura el texto original en un bloque `finally`. Ejecutarlo desde la raíz del worktree; copiar el bloque a `/tmp/pr403-mutation.cjs` y ejecutar `node /tmp/pr403-mutation.cjs`. No usar `git checkout` para revertir la mutación.

```js
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const file = 'src/features/courier-onboarding/queries.ts';
const initial = fs.readFileSync(file, 'utf8');
const strict = 'const expectedPrefix = `courier/${courierId}/avatar_`;';
const weak = 'const expectedPrefix = `courier/${courierId}/`;';
if (!initial.includes(strict)) {
  throw new Error('Falta la guarda estricta esperada; revisar el arreglo primero');
}
function run(label) {
  const out = spawnSync('pnpm', [
    'exec', 'vitest', 'run', 'src/features/courier-onboarding/queries.test.ts'
  ], { encoding: 'utf8' });
  console.log(label + ' exit=' + out.status);
  console.log((out.stdout || '').split('\n').filter(x =>
    /Test Files|Tests |failed|passed|avatar|selfie|dni/i.test(x)
  ).slice(-35).join('\n'));
  console.log((out.stderr || '').slice(-1500));
  if (out.error) throw out.error;
  return out.status;
}
if (run('CONTROL GREEN') !== 0) throw new Error('El control ya fallaba antes de mutar');
let red;
try {
  fs.writeFileSync(file, initial.replace(strict, weak));
  red = run('MUTACION RED: prefix débil');
} finally {
  fs.writeFileSync(file, initial);
}
if (red === 0) throw new Error('TEST INSENSIBLE: guard debilitado y sigue GREEN');
if (fs.readFileSync(file, 'utf8') !== initial) throw new Error('No se restauró el archivo');
if (run('CONTROL RESTAURADO GREEN') !== 0) throw new Error('No recuperó GREEN');
```

**Criterio adicional:** corroborar que el RED sea exactamente el test del path sensible, no un import roto ni una falla ambiental. Este harness aún no fue ejecutado ni está validado en worktree; ejecutarlo y pegar líneas reales antes de darlo por prueba.

## E2E por validar

Ejecutar desde el flujo habitual de Preview en el HEAD de implementación. Aserciones: cadete dueño con imagen `complete && naturalWidth > 0`, rechazo/ausencia/error con placeholder, segunda cuenta sin URL ajena y Storage propio de la cuenta ajena denegado. Una URL previamente firmada es bearer token: no probar denegación de su uso hasta vencer como si fuera una URL privada sin firma.
