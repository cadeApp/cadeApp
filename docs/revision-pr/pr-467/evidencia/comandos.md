# Evidencia reproducible — revisión SEC-466 / PR #467

**Repositorio:** cadeApp/cadeApp
**Base:** `127a900bf489dabf319a4f02046c959689487774`
**SHA original auditado:** `567a4858539c99a485a0c53f790cf1a557455f91`
**Fecha:** 2026-10-20 (America/Argentina/Tucuman)

## Referencias remotas

- RED: https://github.com/cadeApp/cadeApp/actions/runs/39503957919/job/118908294698
  - Línea de salida real: `Package vite`; `Vulnerable versions <=6.4.3`; `Paths .>vitest>vite`; `GHSA-587h-7wmj-h5pm`; `Severity: 5 moderate | 2 high (1 ignored)`; job failure.
- GREEN: https://github.com/cadeApp/cadeApp/actions/runs/39520368768/job/118962472758
  - `pnpm install --frozen-lockfile` exit 0; `pnpm audit --audit-level=high` exit 0; `4 vulnerabilities found`; `Severity: 3 moderate | 1 high (1 ignored)`.
- Unit: https://github.com/cadeApp/cadeApp/actions/runs/39520368768/job/118962472832
  - `Test Files 154 passed (154)` y `Tests 3078 passed (3078)`.
- Build: https://github.com/cadeApp/cadeApp/actions/runs/39520368768/job/118962472887
  - `src/app/layout.tsx`; `next/font`; `TypeError: Cannot read properties of null (reading '1')`; job failure.
- Approval: https://github.com/cadeApp/cadeApp/actions/runs/39520368996/job/118962474133
  - `Falta el informe completo de revisar-pr sin bloqueantes.`

## Control estático y cinco mutaciones independientes

El control siguiente valida coherencia mínima del paquete y lock de Vite. Se diseñó por la revisión, no por el autor de la PR, y opera en memoria. Copiar el harness completo en `/tmp` y ejecutarlo **desde la raíz del repositorio en el SHA deseado**:

~~~bash
cat >/tmp/SEC-466-review-check.mjs <<'NODE'
import { readFileSync } from 'node:fs';

const pkg = readFileSync('package.json', 'utf8');
const lock = readFileSync('pnpm-lock.yaml', 'utf8');
const integrity = 'sha512-xGjU/SyjeNyb0E4KxXBvYz/1C+3JXuujvf2hXNOtnlcE+58o5ajd9N2/n2VhkiJvpCP2qQasnUpx5PXNeI+p1Q==';

function validate(pText, lText) {
  const meta = JSON.parse(pText);
  if (meta.pnpm.overrides.vite !== '6.4.4') throw Error('Package override not 6.4.4');
  const overrides = lText.match(/^overrides:\n([\s\S]*?)(?=^\S)/m);
  if (!overrides || !/^  vite: 6\.4\.4$/m.test(overrides[1])) throw Error('Lock override not 6.4.4');
  if (!lText.includes('  vite@6.4.4:\n    resolution: {integrity: ' + integrity + '}')) {
    throw Error('vite resolution/integrity mismatch');
  }
  if (/vite@6\.4\.3|vite: 6\.4\.3/.test(lText)) throw Error('Vulnerable vite still resolved');
  if (!lText.includes('@vitest/mocker@4.1.11(vite@6.4.4')) throw Error('Mocker peer not updated');
  if (!lText.includes('vitest@4.1.11(@types/node@20.19.43)(@vitest/coverage-v8@4.1.11)(jsdom@26.1.0)(vite@6.4.4')) {
    throw Error('Vitest peer not updated');
  }
}
validate(pkg, lock);
console.log('CONTROL GREEN: package, lock, integrity y peers concordantes');

const mutants = [
  ['old-package-override', pkg.replace('"vite": "6.4.4"', '"vite": "6.4.3"'), lock],
  ['old-lock-override', pkg, lock.replace('  vite: 6.4.4', '  vite: 6.4.3')],
  ['bad-integrity', pkg, lock.replace(integrity, 'sha512-malformed')],
  ['old-mocker-peer', pkg, lock.replace('@vitest/mocker@4.1.11(vite@6.4.4', '@vitest/mocker@4.1.11(vite@6.4.3')],
  ['old-vitest-peer', pkg, lock.replace('vitest@4.1.11(@types/node@20.19.43)(@vitest/coverage-v8@4.1.11)(jsdom@26.1.0)(vite@6.4.4', 'vitest@4.1.11(@types/node@20.19.43)(@vitest/coverage-v8@4.1.11)(jsdom@26.1.0)(vite@6.4.3')],
];
let red = 0;
for (const [name, p, l] of mutants) {
  if (p === pkg && l === lock) throw Error('Mutación sin objetivo: ' + name);
  try {
    validate(p, l);
    throw Error('MUTANT GREEN: ' + name);
  } catch (e) {
    if (String(e.message).startsWith('MUTANT GREEN:')) throw e;
    console.log('RED:', name, '→', e.message);
    red++;
  }
}
if (red !== 5) throw Error('No se obtuvieron cinco RED');
console.log('MUTATIONS: 5/5 RED');
NODE
node /tmp/SEC-466-review-check.mjs
~~~

**Ejecución efectivamente realizada:** la misma lógica JS sobre el contenido completo de `package.json` y `pnpm-lock.yaml` retornado por GitHub conectado (SHA `567a485`), sin escribir archivos. Salida observada:

~~~text
CONTROL GREEN: lock de 241494 caracteres, 7 referencias vite@6.4.4
RED: old-package-override → Package override not 6.4.4
RED: old-lock-override → Lock override not 6.4.4
RED: bad-integrity → vite resolution/integrity mismatch
RED: old-mocker-peer → Vulnerable vite still resolved
RED: old-vitest-peer → Vulnerable vite still resolved
MUTATIONS: 5/5 RED
~~~

El script en `/tmp` reproduce conceptualmente la misma comprobación; **no se ejecutó Node local con el checkout real** ni `pnpm audit` sobre mutantes. La auditoría remota proporciona RED/GREEN real. Este control es adicional, no reemplaza pnpm ni la comprobación de integridad de registry.

## Comprobaciones finales sugeridas para un checkout limpio

~~~bash
git fetch origin
git switch fix/SEC-466-vite-override
git pull --ff-only origin fix/SEC-466-vite-override
git diff origin/develop...HEAD --stat
git merge-tree --write-tree origin/develop HEAD
pnpm install --frozen-lockfile
pnpm why vite
pnpm audit --audit-level=high
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node docs/revision-pr/analizar.mjs verificacion
~~~

No se ejecutaron estos comandos en el entorno de revisión (sin acceso DNS al repositorio y sin pnpm instalado), salvo que sus equivalentes `pnpm` están comprobados por CI en el SHA indicado. No se ejecutó Supabase ni Docker. No se alteraron pruebas, threshold de auditoría ni ignores.

