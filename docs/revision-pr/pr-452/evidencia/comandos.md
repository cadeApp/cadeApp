# Evidencia y comandos — PR #452 / ronda 1

## Fuentes verificadas

- PR #452: `844f0c99f91184a5cc4bc069dc8512f0765c3adf`, base `b35b0aef48608d0f3dd767460c65eccf56aed9f0`; `git compare` mediante API: 1 commit adelante / 0 atrás.
- PR #448: `e06cb606651f0c94e4ae00eca12758eb9b2b8b53`, todavía OPEN al revisar.
- CC-033 desde `develop`; CC-034, CC-035, T-380, T-383 y su plan desde el SHA de #448.
- T-376, T-384, T-385, T-386 y plan desde el SHA de #452.
- No se leyó ningún `.env`, token o secreto. No se ejecutó Supabase, Docker ni comando de migración.
- Bitácoras `docs/tasks/log/T-384.md`, `T-385.md` y `T-386.md` no existen aún (las tareas están descritas, pero no implementadas).

## Comprobaciones independientes ejecutadas

Se extrajeron los textos exactamente de las ramas y SHAs anteriores con el conector de GitHub. Se compararon:
1. Primer DoD vs. columna DoD del plan, para T-384..386: **3 PASS**.
2. Permiso de bitácora y `docs/revision-pr/**`: **3 PASS**.
3. Suites de concurrencia y `--mutation-check` exigidas: **3 PASS**.
4. Bloqueo explícito a PR #448 para T-385/386 (ficha + plan): **4 FAIL**.
5. Dependencias entre tareas T-376/T-380/T-383 (ficha + plan): **6 FAIL**.

**Total 9 PASS / 10 FAIL.** Los 10 FAIL corresponden a dos hallazgos documentales, no a diez fallas independientes ni a pruebas de aplicación.

## Arnés completo reproducible

Copiar **todo** el bloque a `/tmp/pr452-audit.mjs`, sobre dos worktrees limpios de los SHAs indicados (no modifica archivos). Para que el rojo sea informativo, el script sale con código 1 cuando faltan condiciones. Después de cada corrección se debe ejecutar nuevamente en el SHA de cada rama afectada.

```bash
git fetch origin
git worktree add /tmp/pr452-h844 844f0c99f91184a5cc4bc069dc8512f0765c3adf
git worktree add /tmp/pr448-e06 e06cb606651f0c94e4ae00eca12758eb9b2b8b53
# Guardar el código siguiente en /tmp/pr452-audit.mjs
node /tmp/pr452-audit.mjs /tmp/pr452-h844 /tmp/pr448-e06
# Esperado en estos SHAs: 9 PASS / 10 FAIL; exit 1.
```

```js
import fs from 'node:fs';
import path from 'node:path';

const [root452, root448] = process.argv.slice(2);
if (!root452 || !root448) {
  console.error('Uso: node pr452-audit.mjs <worktree452> <worktree448>');
  process.exit(2);
}
const read = (root, file) => fs.readFileSync(path.resolve(root, file), 'utf8');
const d452 = (file) => read(root452, file);
const d448 = (file) => read(root448, file);
const plan452 = d452('docs/implementation-plan.md');
const plan448 = d448('docs/implementation-plan.md');
const tests = [];
const check = (name, ok) => tests.push([name, Boolean(ok)]);
const row = (plan, id) =>
  plan.split(/\r?\n/).find((line) => line.startsWith('| ' + id + ' |')) || '';
const cells = (line) => line.split('|').map((part) => part.trim());
const firstDoD = (text) => {
  const section = text.match(/## DoD\r?\n([\s\S]*?)(?:\r?\n## |$)/)?.[1] || '';
  return section.match(/^- \[[ x]\] (.*)$/m)?.[1]?.trim() || '';
};
const depLine = (text) => text.match(/^- \*\*Dependencias[^\n]*/m)?.[0] || '';
const blocked = (text, cc) => {
  const line = text.split(/\r?\n/).find((x) => x.startsWith('- **Bloqueo:**')) || '';
  return line.includes('BLOQUEADA') && line.includes(cc) && line.includes('#448');
};
const blockedPlan = (plan, id, cc) => {
  const deps = cells(row(plan, id))[4] || '';
  return deps.includes('BLOQUEADA') && deps.includes(cc) && deps.includes('#448');
};

for (const [n, cc] of [['384','033'],['385','034'],['386','035']]) {
  const text = d452('docs/tasks/T-' + n + '.md');
  const planRow = row(plan452, 'T-' + n);
  check('T-' + n + ' DoD=plan', cells(planRow)[6] === firstDoD(text));
  check('T-' + n + ' permite bitácora/revisión',
    text.includes('docs/tasks/log/T-' + n + '.md') && text.includes('docs/revision-pr/**'));
  check('T-' + n + ' suite/mutation-check',
    text.includes('cc' + cc + '_concurrency.mjs') && text.includes('--mutation-check'));
}
for (const [n,cc] of [['385','CC-034'],['386','CC-035']]) {
  const text = d452('docs/tasks/T-' + n + '.md');
  check('T-' + n + ' ficha bloqueada a #448', blocked(text,cc));
  check('T-' + n + ' plan bloqueado a #448', blockedPlan(plan452,'T-' + n,cc));
}
for (const [consumer, dependency, file, plan] of [
  ['376','384', d452('docs/tasks/T-376.md'),plan452],
  ['380','385', d448('docs/tasks/T-380.md'),plan448],
  ['383','386', d448('docs/tasks/T-383.md'),plan448]
]) {
  check('T-' + consumer + ' ficha depende T-' + dependency,
    depLine(file).includes('T-' + dependency));
  check('T-' + consumer + ' plan depende T-' + dependency,
    (cells(row(plan,'T-' + consumer))[4] || '').includes('T-' + dependency));
}
for (const [name, ok] of tests) console.log((ok ? 'PASS ' : 'FAIL ') + name);
const pass = tests.filter(([, ok]) => ok).length;
const fail = tests.length - pass;
console.log('Resumen: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exitCode = fail ? 1 : 0;

// Prueba del instrumento: partir de un ejemplo correcto (GREEN) y mutarlo.
const good = '- **Bloqueo:** BLOQUEADA hasta que CC-034 esté mergeado en develop desde PR #448.';
const wrong = good.replace('BLOQUEADA', 'LISTA');
if (!blocked(good,'CC-034') || blocked(wrong,'CC-034')) {
  console.error('ARNÉS FALLA: mutación no detectada');
  process.exitCode = 2;
} else {
  console.log('MUTACIÓN RED: LISTA en lugar de BLOQUEADA detectada; control sano');
}
```

**Prueba de sensibilidad del control:** en memoria, la condición correcta `- **Bloqueo:** BLOQUEADA ... CC-034 ... #448` satisface el control; al cambiar `BLOQUEADA` por `LISTA`, deja de satisfacerlo. Es una **mutación del instrumento**, no un arreglo de la rama ni evidencia de ejecución de pruebas de base.

**Limitación honesta:** se ejecutó la matriz equivalente sobre textos obtenidos por el conector; no se obtuvo clon con terminal ni se corrió `git worktree`/`node` dentro del repo. El bloque queda completo para reproducción, no se atribuye un verde de CI o un `merge-tree` inexistente. No se usaron mocks que sustituyan los datos reales de GitHub.

## Control posterior obligatorio

Cuando el autor termine: registrar su nuevo SHA y el de #448 en su bitácora, reevaluar H01/H02, comparar `git merge-tree --write-tree origin/develop HEAD` en un clon, confirmar el diff acotado y correr `pnpm vitest run tools/verify-fichas.test.ts`. No se deben exigir `db-tests` ni E2E para estas modificaciones de documentación, ni rehacer CI verde únicamente por commitear esta carpeta de revisión.
