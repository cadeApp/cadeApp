# Evidencia y comandos reproducibles — PR #631 / CC-046 · Ronda 1

## Lo que se observó (no es ejecución local)

- SHA funcional 83deda5662462550816c579d49dfe9dfbccb9d7c.
- GitHub Actions CI: https://github.com/cadeApp/cadeApp/actions/runs/42182058746 — success, incluyendo build, typecheck, lint, unit y db-tests.
- Log unit, job 127773690188: Test Files 194 passed (194); Tests 3657 passed (3657).
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/42183187374 — failure global, SHA objetivo 83deda56. Job 127777368393: admin-nav-mobile dos ✓, 117 passed / 1 failed / 1 flaky.
- T-410 admin-trips.spec.ts:202: strict locator de Entrega 1 entregada con dos coincidencias, rojo en los 3 intentos.
- T-407 admin-audit-filters.spec.ts:108: strict locator de Mostrando los eventos de una sola entidad. con dos coincidencias, flaky tras reintento.
- git ls-remote https://github.com/cadeApp/cadeApp.git: Could not resolve host github.com en el contenedor del revisor. Sin npm/pnpm, worktree ni mutaciones reales independientes.

## Harness propuesto: unit baseline, mutación propia de alineación y foco, restauración en memoria

Este harness es para ejecutar sobre worktree limpio del SHA de **arreglo de la próxima ronda**, desde raíz de ese worktree. NO está ejecutado ni se considera evidencia RED. Pegá el siguiente bloque completo en cualquier shell; crea el script autocontenido en /tmp. Los cambios temporales del origen se restauran con los bytes guardados en memoria: nunca se usa git checkout para revertir mutaciones.

~~~bash
cat > /tmp/verify-cc046-review.mjs <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';

const path = 'src/ui/sheet.tsx';
const original = readFileSync(path, 'utf8');
const testFile = 'src/ui/sheet.test.tsx';
const testSource = readFileSync(testFile, 'utf8');
assert.match(testSource, /SheetTrigger/, 'Falta test con el trigger real');
assert.match(testSource, /Escape/, 'Falta test de Escape');
const mutations = [
  {
    id: 'M1-alineacion',
    from: "side === 'right' ? 'justify-end' : 'justify-center'",
    to: "side === 'right' ? 'justify-center' : 'justify-center'",
    redTest: /side="right" apoya el panel|justify-end/i,
  },
  {
    id: 'M2-foco',
    from: 'toFocus.focus();',
    to: 'void toFocus;',
    redTest: /foco|focus|Escape/i,
  },
];
function run(label) {
  const p = spawnSync('pnpm', ['exec', 'vitest', 'run', testFile, '--reporter=verbose'], {
    encoding: 'utf8', maxBuffer: 8_000_000,
  });
  const output = (p.stdout ?? '') + '\n' + (p.stderr ?? '');
  const summary = output.split('\n').filter(line =>
    /Test Files|Tests  |FAIL |✓|×|✗|passed|failed/i.test(line)
  );
  console.log(label, 'exit=', p.status, summary.slice(-12).join('\n'));
  assert.notEqual(p.status, null, 'No se pudo ejecutar pnpm: ' + (p.error?.message ?? 'sin salida'));
  return { status: p.status, output };
}
try {
  assert.equal(run('BASELINE').status, 0, 'Baseline no está verde');
  for (const m of mutations) {
    assert.equal(original.includes(m.from), true, m.id + ': objetivo no encontrado');
    const modified = original.replace(m.from, m.to);
    assert.notEqual(modified, original, m.id + ': mutación sin cambio');
    try {
      writeFileSync(path, modified);
      const red = run('RED ' + m.id);
      assert.notEqual(red.status, 0, m.id + ': el test no detecta la mutación');
      assert.match(red.output, m.redTest, m.id + ': rojo ajeno al invariante');
    } finally {
      writeFileSync(path, original);
    }
    assert.equal(run('GREEN restaurado ' + m.id).status, 0);
  }
  console.log('BASELINE + 2 RED + 2 GREEN: completados');
} finally {
  writeFileSync(path, original);
}
JS

# Correr desde un worktree limpio del SHA correcto:
node /tmp/verify-cc046-review.mjs
git status --short
~~~

El harness requiere que el autor haya creado **realmente** el test nuevo con SheetTrigger y Escape, y que la aserción detecte la falta de foco. Si M2 queda verde, el test es insuficiente y no se marca resuelto. El harness debe reproducirse independientemente en ronda 2 (incluida la copia en /tmp); este informe no declara haberlo corrido.

## E2E geométrico: matriz mínima para el autor

- Test existente: e2e/specs/admin-nav-mobile.spec.ts.
- 390 px: el menú derecho ocupa el viewport; verificar borde derecho ≈390, x≈0 y foco del botón después de Escape.
- 1023 px: borde derecho ≈1023, x>0 y foco después de Escape; no eliminar la aserción que ya pasó CI.
- 1024 y 1280 px: sidebar de escritorio, botón Menú oculto, main a la derecha.
- La mutación de producción de justify-end a justify-center debe dejar rojo el test estructural; si se quiere un rojo E2E con secretos de Develop, usar solo la infraestructura autorizada por AGENTS.md/T-347, sin desplegar una mutación en Preview público ni ejecutar manualmente workflows.
- Al finalizar, volver a consultar el SHA y el log del gate; la geometría de T-405 se verifica en la PR #629 tras el merge del CC.

## Comandos finales sugeridos al autor

~~~bash
git pull
git fetch origin
# Trabajar en la rama cc/CC-046-sheet-lado-derecho, sin rebase ni force-push.
pnpm exec vitest run src/ui/sheet.test.tsx
pnpm typecheck
pnpm lint
pnpm test > /tmp/cc046-tests.log 2>&1
grep -E 'Test Files|Tests ' /tmp/cc046-tests.log | tail -5
pnpm build > /tmp/cc046-build.log 2>&1
tail -12 /tmp/cc046-build.log
git status --short
git ls-remote origin cc/CC-046-sheet-lado-derecho
~~~

No ejecutar Supabase/Docker local ni leer .env/secretos. No declarar en verde un control que no se haya corrido.


---

## Ronda 2 — 2026-11-06 (f54dc934…)

**R1 M2 estaba mal definida.** Quitar solo `toFocus.focus()` **no** rompe necesariamente el foco: Radix Dialog conserva el auto-focus al Trigger. El autor documentó GREEN de ambas mutaciones individuales y RED al anular las dos rutas; el reviewer no lo reprodujo por DNS del clon.

### Evidencia leída directamente de GitHub (no confundible con ejecución del revisor)

- [CI 42244785621](https://github.com/cadeApp/cadeApp/actions/runs/42244785621) job unit 127984516985. `HEAD is now at 4027075 Merge f54dc934... into 6e793e...` (merge virtual de PR).
- `src/ui/sheet.test.tsx (4 tests)` GREEN.
- `tools/verify-fichas.test.ts (7 tests | 2 failed)`: `docs/tasks/T-424.md` sin `docs/revision-pr/**` y sin primer DoD igual a fila plan. Resumen `1 failed | 193 passed` archivos y `2 failed | 3656 passed` tests.
- `develop` propio: CI [42183449414](https://github.com/cadeApp/cadeApp/actions/runs/42183449414) failure de unit. No es falla propia del CC.
- Issues de QA: T-424 [#637](https://github.com/cadeApp/cadeApp/issues/637); T-410 [#585](https://github.com/cadeApp/cadeApp/issues/585); T-407 [#636](https://github.com/cadeApp/cadeApp/issues/636).

### Harness independiente CORREGIDO para R2 (propuesto, **NO ejecutado**)

Este script sustituye **conceptualmente** la mutación de foco sola de la sección anterior; conserva bytes originales y requiere un worktree limpio sin `pnpm` en paralelo. Provoca mutación nueva en **bottom** y doble mutación en **foco**. Si un mutante queda GREEN, registrar supervivencia y no reportar éxito. No copiar salidas de otro run ni alterar el test:

~~~bash
cat > /tmp/cc046-r2-review.mjs <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';

const file = 'src/ui/sheet.tsx';
const test = 'src/ui/sheet.test.tsx';
const original = readFileSync(file, 'utf8');
const replacement = (source, from, to) => {
  assert.equal(source.split(from).length, 2, 'Objetivo mutación no único: ' + from);
  return source.replace(from, to);
};
const mutants = [
  {
    name: 'M-R2-01-bottom-no-centrado',
    make: (s) => replacement(
      s,
      "side === 'right' ? 'justify-end' : 'justify-center'",
      "side === 'right' ? 'justify-end' : 'justify-end'"
    ),
  },
  {
    name: 'M-R2-02-doble-foco',
    make: (s) => {
      s = replacement(s, 'toFocus.focus();', 'void toFocus;');
      return replacement(
        s,
        '          data-sheet-side={side}',
        '          onCloseAutoFocus={(event) => event.preventDefault()}\n          data-sheet-side={side}'
      );
    },
  },
];
function run(tag) {
  const p = spawnSync('pnpm', ['exec', 'vitest', 'run', test, '--reporter=verbose'], {
    encoding:'utf-8',maxBuffer:8_000_000
  });
  if (p.error) throw p.error;
  const out = (p.stdout ?? '') + '\n' + (p.stderr ?? '');
  const summary = out.split('\n').filter(x =>
    /Test Files|Tests  |FAIL |×|✗|passed|failed/.test(x)
  );
  console.log(tag, 'exit=' + p.status, summary.slice(-9).join('\n'));
  return {code:p.status,output:out};
}
try {
  assert.equal(run('BASELINE').code,0,'baseline rojo');
  for (const mutant of mutants) {
    try {
      writeFileSync(file,mutant.make(original));
      const red = run('RED ' + mutant.name);
      assert.notEqual(red.code,0,'mutación sobrevivió: ' + mutant.name);
      if(mutant.name.endsWith('bottom-no-centrado')) {
        assert.match(red.output,/bottom|centrado horizontalmente/i);
      } else {
        assert.match(red.output,/PR631-H01|foco vuelve/i);
      }
    } finally {
      writeFileSync(file,original);
    }
    assert.equal(run('GREEN ' + mutant.name).code,0,'restaurado rojo');
  }
} finally {
  writeFileSync(file,original);
}
JS
node /tmp/cc046-r2-review.mjs
git status --short
~~~

**No ejecutado por el revisor:** `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` devolvió `Could not resolve host: github.com`. El script anterior se entrega íntegro pero no declara RED propio ni GREEN propio. Ejecutar tras corregir el bloqueo de CI y sobre el SHA funcional objetivo, no sobre el commit documental de revisión.

### Estado de E2E

El workflow `e2e-preview` (trusted) tiene condición CI success. En f54dc934, CI quedó rojo por T-424 heredado de develop, así que el E2E de ancho 390 y Escape del nuevo código **no está verificado** en este gate. No se inventan métricas de Playwright.
