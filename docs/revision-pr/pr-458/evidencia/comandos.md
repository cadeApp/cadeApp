# Evidencia y comandos · PR #458 / T-380 · Ronda 1

## Entorno / trazabilidad

- SHA inspeccionado: `961d6ea6555f42193fec806d2d216adbee2c6893`.
- Base: `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b`.
- `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` en el contenedor de revisión: `fatal: ... Could not resolve host: github.com`. No hay clon en el contenedor.
- Conector GitHub: leído diff, fichas, contrato, bitácora, contenido de test y logs CI.
- **No se corrieron mutaciones propias de Vitest.** La evidencia runtime corresponde a GitHub Actions y está etiquetada como tal. No se afirma que un harness no ejecutado haya pasado.

## Fuente de CI ajena

- CI `39436669439`, SHA `11f626b52362692f3e6734784158d98f6b9ac0ff`: `unit` → `151 passed (151)` archivos y `2964 passed (2964)` tests.
- `db-tests` → `Files=33, Tests=2959, Result: PASS`; hubo FAIL controlados para pruebas de mutación de otras tareas, restaurados antes del resultado final.
- `e2e-preview` `39436812843`: `admin-courier-reinstate.spec.ts:80:7` → PASS `(44.8s)`; global `92 passed` y `6 passed`.
- `bundle-budget` → success con advertencias de rutas que superan 180 kB; `/admin/applicants/[id] = 248 kB`. No hay contraste cuantitativo contra base, por eso no se atribuye a esta PR.
- La diferencia `11f626b5..961d6ea` modifica solo `docs/tasks/log/T-380.md`.

## H01: control estructural reproducible, sin mutar el árbol

Copiá el siguiente script **completo** a `/tmp/pr458-h01-check.cjs` desde un checkout limpio del SHA a revisar. El script se ejecuta desde la raíz del repo, lee el test real y falla si hay un temporizador arbitrario en el caso de doble envío. Es un control **estático**, no sustituye el test runtime de mutación.

```bash
cat > /tmp/pr458-h01-check.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const filename = path.join(process.cwd(), 'src/features/admin/components/applicant-detail-view.test.tsx');
const source = fs.readFileSync(filename, 'utf8');
const start = source.indexOf("it('dos envíos seguidos del formulario");
const end = source.indexOf("it('idempotent: true", start);
if (start < 0 || end <= start) {
  console.error('FAIL: no se encontró el caso de doble envío esperado');
  process.exitCode = 1;
} else {
  const block = source.slice(start, end);
  if (/\bsetTimeout\s*\(/.test(block) || /\bwaitForTimeout\s*\(/.test(block)) {
    console.error('FAIL: test de doble envío contiene sleep fijo');
    process.exitCode = 1;
  } else {
    console.log('PASS: test de doble envío sin sleep fijo (solo control estático)');
  }
}
NODE
node /tmp/pr458-h01-check.cjs
```

**Resultado esperado en SHA revisado:** FAIL por `setTimeout(resolve, 50)`. Este script fue preparado a partir de la inspección; **no se ejecutó** en este entorno. Luego de reemplazar el sleep, debe pasar.

### Prueba funcional indispensable para el autor

```bash
pnpm exec vitest run src/features/admin/components/applicant-detail-view.test.tsx
pnpm exec vitest run src/features/admin/actions.test.ts
```

Para el RED de H01, aplicar una mutación **temporal** que retire únicamente la condición `decisionInFlight.current` de `onDecisionSubmit` en `applicant-detail-view.tsx` manteniendo los mocks, y comprobar que el test falla **porque la acción se llamó dos veces**. Restaurar contenido original de memoria mediante el harness temporal; no usar `git checkout`, ni falsear aserciones. Guardar salida real de Vitest en bitácora y confirmar GREEN con archivos originales.

## H02: reproducción pendiente del autor

No se dispone del scratchpad citado en la bitácora para M1–M8. Para cada mutación falta el diff/reemplazo exacto, comando, salida `Test Files` y `Tests` en RED/GREEN. Es un bloqueante de evidencia, **no** se han inventado ni replicado resultados. Los comandos se conservan en `/tmp` y su salida se pega en `docs/tasks/log/T-380.md`. Solo se considera válida la propiedad realmente rota; un RED por error de import, mock o harness no verifica el invariante.

## Chequeo final por el autor

```bash
pnpm typecheck && pnpm lint && pnpm test
git diff --check
git status --short
git ls-remote origin feat/T-380-admin-reinstate-courier
```

No exigir nueva ejecución de CI exclusivamente por editar `docs/tasks/log/T-380.md`; si cambia la prueba de H01, ejecutar las comprobaciones reales de esa modificación.

---

## Ronda 2 · SHA de código `acd94ce13e318a279e2926c5dc4dce8200912c02`

### Procedencia y alcance

- `git ls-remote` ejecutado en el contenedor de revisión no puede resolver `github.com`; la comparación GitHub confirmó HEAD exacto `acd94ce13e318a279e2926c5dc4dce8200912c02` y base `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b`.
- Inspección directa de fuente real y del test nuevo, de la bitácora M1–M9, revisión estructural de todos los snippets «Antes», comparación de cambios vs. revisión R1 y lectura del unit job oficial en el SHA.
- **Control independiente ejecutado en el runtime JS del revisor** usando los textos devueltos por el conector GitHub: GREEN del test/componente (sin sleep, con `act` y guarda), RED estático al remover en memoria la guarda, 9/9 registros completos y 9/9 preimágenes exactas. No se ejecutó Vitest local y el RED independiente **no** es un RED dinámico.
- El primer intento de contar secciones usó `m[1]` en lugar de `m[2]`, dando false por error del checker. Corregido en el mismo turno y control reejecutado: `9/9`.
- CI [39445319788](https://github.com/cadeApp/cadeApp/actions/runs/39445319788): unit `151 passed (151)` archivos y `2964 passed (2964)` tests; typecheck, lint, build, audit y bundle-budget success. `db-tests` en curso al emitir el informe; `e2e-preview` [39445508447](https://github.com/cadeApp/cadeApp/actions/runs/39445508447) pendiente. El bundle muestra `/admin/applicants/[id] 248 kB`, valor advisory que ya constaba en R1.
- Autor: M9 declara RED con 2 llamadas, GREEN de 19/19; M1–M9 todos acompañados de comandos reales según bitácora. **No se apropia esa ejecución el revisor.**

### Harness de inspección estática reproducible

Ejecutar desde la raíz de un checkout limpio del SHA de código. No requiere red, dependencias ni muta archivos. Guarda en `/tmp/pr458-r2-static.cjs`:

```bash
cat > /tmp/pr458-r2-static.cjs <<'NODE'
#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const prod = read('src/features/admin/components/applicant-detail-view.tsx');
const test = read('src/features/admin/components/applicant-detail-view.test.tsx');
const log = read('docs/tasks/log/T-380.md');
const map = {
  1: 'src/features/admin/actions.ts',
  2: 'src/features/admin/actions.ts',
  3: 'src/features/admin/actions.ts',
  4: 'src/features/admin/schemas.ts',
  5: 'src/features/admin/components/applicant-detail-view.tsx',
  6: 'src/features/admin/components/applicant-detail-view.tsx',
  7: 'src/features/admin/components/applicant-detail-view.tsx',
  8: 'src/features/admin/components/applicant-detail-view.tsx',
  9: 'src/features/admin/components/applicant-detail-view.tsx',
};
const sections = [...log.matchAll(/#### M(\d+) —[^\n]+\n([\s\S]*?)(?=\n#### M\d+ —|\n- Comprobación final:)/g)];
const guard = 'if (!decisionModal || decisionInFlight.current) return;';
const targetStart = test.indexOf("it('dos envíos seguidos del formulario");
const targetEnd = test.indexOf("it('idempotent: true", targetStart);
const target = targetStart >= 0 && targetEnd > targetStart ? test.slice(targetStart, targetEnd) : '';
const green = prod.includes(guard)
  && prod.includes('decisionInFlight.current = true;')
  && prod.includes('decisionInFlight.current = false;')
  && !/\bsetTimeout\s*\(/.test(target)
  && /await act\(async \(\) => \{\s*fireEvent\.submit\(form\);\s*\}\)/.test(target)
  && /expect\(reinstateCourierAction\)\.toHaveBeenCalledTimes\(1\)/.test(target);
const mutant = prod.replace(guard, 'if (!decisionModal) return;');
const red = mutant !== prod && !mutant.includes(guard);
const fields = ['- Antes:', '- Después', '- Comando:', 'RED (exit 1)', 'GREEN (exit 0)', 'Test Files', 'Tests  '];
const complete = sections.length === 9 && sections.every(m => {
  const index = Number(m[1]);
  const body = m[2];
  const previous = /- Antes:\s*\x60\x60\x60ts\n([\s\S]*?)\n\x60\x60\x60/.exec(body)?.[1];
  if (!previous || !map[index]) return false;
  return fields.every(field => body.includes(field)) && read(map[index]).includes(previous);
});
console.log('GREEN structural H01:', green);
console.log('RED structural with guard removed in memory:', red);
console.log('M1–M9 traceable:', complete, 'records:', sections.length);
if (!(green && red && complete)) process.exitCode = 1;
// Static only: does NOT execute mutated Vitest or confirm author's recorded RED runtime.

NODE
node /tmp/pr458-r2-static.cjs
```

Resultado registrado con el equivalente sobre las fuentes devueltas por GitHub: GREEN H01 = true · RED in-memory H01 = true · M1–M9 9/9 completos, 9/9 preimágenes exactas. El comando Node aquí documentado es reproducible pero **no se ejecutó localmente en este entorno**, porque no se pudo clonar el repositorio.

### Comandos que corresponden a pruebas dinámicas (no ejecutados por el revisor)

```bash
pnpm exec vitest run src/features/admin/components/applicant-detail-view.test.tsx src/features/admin/actions.test.ts
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

Cuando termine el CI de `acd94ce13e318a279e2926c5dc4dce8200912c02`, corroborar `db-tests` (`Files= / Tests= / Result: PASS` y `git diff --exit-code`) y el resultado definitivo de `e2e-preview`. No anunciar merge permitido únicamente por `unit`.
