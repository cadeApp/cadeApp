# Evidencia y comandos — PR #407, ronda 1

## Fuente de verdad y comparación

Repositorio: cadeApp/cadeApp.
PR https://github.com/cadeApp/cadeApp/pull/407
SHA funcional revisado b2dbfc2bba82ed5e2d9e01495761ec8fa30e75a2
Al comienzo: 6 archivos cambiados, fuente nueva de revisión aún no existente.

Plan/ficha se normalizaron en PR documental #408, merge SHA d885b24a6790e54453a07650b0d4f1b2e174f489, sólo 2 documentos, antes de registrar esta ronda. Al agent toca incorporar develop; NO rebase. No exigir otra CI por este merge documental.

## CI real, no solo etiquetas verdes

- Run CI https://github.com/cadeApp/cadeApp/actions/runs/39069842415, head b2dbfc2: success.
- unit job 117504984669: Test Files 141 passed (141), Tests 2670 passed (2670). Workflows 79/79, ADR 6/6.
- db-tests job 117504984768: Files=29 Tests=2735 Result: PASS. Los FAILED test internos pertenecen a mutaciones SQL negativas deliberadas; el job final success.
- typecheck/lint/build/audit/bundle-budget success.
- approval-policy #39069840780: fallo porque el body carece de informe de revisión completo sin bloqueantes.
- Trusted e2e-preview run https://github.com/cadeApp/cadeApp/actions/runs/39069904081, job 117505215877: HEAD is now at b2dbfc2; Chromium 86 passed (26.1m); global-settings 3 passed (1.1m).
- Casos global-settings DoD1 línea 136 PASS 19.2s, DoD2 línea 218 PASS 24.1s, DoD3 línea 280 PASS 22.9s. Resultado del job success y commit status e2e-preview success.
- No se corrieron tests ni mutaciones en runtime propio: no hay clon ni pnpm accesibles, git ls-remote devuelve Could not resolve host: github.com. La evidencia CI sí fue leída del run real y asociada al SHA.

## H01: harness de mutación temporal propuesto para el agente (NO EJECUTADO por revisor)

La propiedad a probar: la UI invoca createDeliveryRequestAction y la acción invoca create_and_publish_multi_drop; no basta un error correcto fabricado antes de llamar.

Ejecución en worktree limpio del SHA arreglado, CON las nuevas aserciones de spy ya implementadas. Guardá el siguiente script COMPLETO en /tmp/t371-review-mutations.mjs (NO commitearlo). Rutas relativas se interpretan desde raíz del repo.

~~~js
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const cases = [
  {
    name: 'M1: Action retorna código antes de llamar RPC',
    path: 'src/features/requests/actions.ts',
    needle: '  const data = parsed.data;\n',
    replacement: "  const data = parsed.data;\n  return err('PUBLICATION_CREDITS_EXHAUSTED');\n",
    testFile: 'src/features/requests/actions.test.ts',
    title: 'T-371: propaga PUBLICATION_CREDITS_EXHAUSTED',
  },
  {
    name: 'M2: Form inventa rechazo sin llamar Server Action',
    path: 'src/features/requests/components/create-request-form.tsx',
    needle: [
      '      const result = await createDeliveryRequestAction({',
      '        ...data,',
      '        requestId: requestIdRef.current,',
      '      });',
    ].join('\n'),
    replacement: "      const result = { ok: false, code: 'PUBLICATION_CREDITS_EXHAUSTED' } as const;",
    testFile: 'src/features/requests/components/create-request-form.test.tsx',
    title: 'T-371: si la publicación es rechazada por PUBLICATION_CREDITS_EXHAUSTED',
  },
];

function test(c) {
  const result = spawnSync(pnpm, ['exec', 'vitest', 'run', c.testFile, '-t', c.title], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const summary = (result.stdout + '\n' + result.stderr)
    .split('\n')
    .filter(line => /Test Files|Tests\s|AssertionError|AssertionError|toHaveBeenCalled|expected spy/i.test(line))
    .slice(-20);
  process.stdout.write(summary.join('\n') + '\n');
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + '\n' + result.stderr };
}

for (const c of cases) {
  const original = fs.readFileSync(c.path, 'utf8');
  if (original.split(c.needle).length !== 2)
    throw new Error(c.name + ': needle debe ocurrir exactamente 1 vez');
  console.log('CONTROL GREEN:', c.name);
  const initial = test(c);
  if (initial.status !== 0) throw new Error('El control original NO está verde');
  try {
    fs.writeFileSync(c.path, original.replace(c.needle, c.replacement));
    console.log('MUTANTE RED:', c.name);
    const mutated = test(c);
    if (mutated.status === 0) throw new Error('Falso GREEN, mutación no detectada');
    if (!/toHaveBeenCalled|AssertionError/i.test(mutated.output))
      throw new Error('RED no semántico, analizar la falla');
  } finally {
    fs.writeFileSync(c.path, original);
  }
  console.log('CONTROL RESTAURADO GREEN:', c.name);
  const restored = test(c);
  if (restored.status !== 0) throw new Error('No se restauró GREEN');
}
console.log('Mutaciones M1 y M2 completas; verificar git diff vacío en productivo');
~~~

Comandos:

~~~bash
node --check /tmp/t371-review-mutations.mjs
node /tmp/t371-review-mutations.mjs
pnpm exec vitest run src/features/requests/actions.test.ts src/features/requests/components/create-request-form.test.tsx tools/verify-fichas.test.ts
pnpm typecheck && pnpm lint && pnpm test
git diff --check
~~~

La falla del test objetivo debe ser semántica (expect spy not called). El script propone mutar EN LA MÁQUINA DEL AUTOR, temporalmente y restaurar en finally; NO fue ejecutado por el revisor por no tener clone. No interpretar un fallo de TypeScript o ReferenceError como RED válido. El control inicial/restaurado debe pasar.

## Proceso de verificación adicional

- Después de merge de develop, verificar que el plan tenga una sola fila T-371, que la ficha tenga encabezados exactos y que el DoD siga marcado según evidencia.
- Esta tarea NO modifica workflows, src/server ni schema; no correr SQL administrativo desde estación local. E2E usa sólo CI confiable.
- El commit de revisión modifica únicamente docs/revision-pr/pr-407/. No exigir otro CI sólo por la carpeta/bitácora.
