# Evidencia y comandos — PR #587 · ronda 1

**SHA exacto leído con conector GitHub:** `9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f`. El clon local no fue posible: `git ls-remote` devolvió `Could not resolve host: github.com`. No se ejecutaron pgTAP, Vitest ni E2E. El script de abajo comprueba **solo afirmaciones textuales de documentación**, sin mutar archivos.

La inspección independiente sobre los 5 documentos recuperados del SHA dio:
```
sin backfill GREEN -> RED
no fecha manual GREEN -> RED
gate MFA en revokes GREEN -> RED
normalización nombre GREEN -> RED
total filtrado GREEN -> RED
buscador usa RPC GREEN -> RED
historial real GREEN -> RED
tarea registrada GREEN -> RED
SUMMARY baseline=8/8 mutate_red=8/8
```

## Harness completo independiente (reproducir en clon limpio)

Copiar el contenido completo como `/tmp/pr587-doc-mutation.mjs` y correr desde el root del repo: `node /tmp/pr587-doc-mutation.mjs .`. No modifica archivos; lee solamente los 5 .md indicados; toda la mutación es en memoria.

```js
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const files = {
  CC043: 'docs/contracts/CC-043.md',
  CC044: 'docs/contracts/CC-044.md',
  T403: 'docs/tasks/T-403.md',
  T404: 'docs/tasks/T-404.md',
  PLAN: 'docs/implementation-plan.md',
};
const docs = Object.fromEntries(
  Object.entries(files).map(([k, f]) => [k, fs.readFileSync(path.join(root, f), 'utf8')])
);
const cases = [
  ['CC043', 'sin backfill', /\*\*Backfill:\*\* \*\*ninguno\.\*\*/],
  ['CC043', 'no fecha manual', /si `new\.submitted_at is distinct from old\.submitted_at`/],
  ['CC044', 'gate MFA en revokes', /La autorización la hace\s+`assert_admin_aal2\(\)` antes de leer nada/],
  ['CC044', 'normalización nombre', /strpos\(app_private\.search_normalize\(p\.display_name\)/],
  ['CC044', 'total filtrado', /cantidad exacta de filas con ese estado y esa búsqueda/],
  ['T403', 'buscador usa RPC', /se manda como `p_query` a `admin_list_applicants`/],
  ['T404', 'historial real', /`couriers\.submitted_at` de CC-043, solo si no es `null`/],
  ['PLAN', 'tarea registrada', /\| T-421 \|/],
];
let green = 0;
let red = 0;
for (const [file, name, re] of cases) {
  const baseline = re.test(docs[file]);
  const mutated = docs[file].replace(re, ''); // MUTACIÓN EN MEMORIA, sin checkout
  const killed = baseline && !re.test(mutated);
  if (baseline) green++;
  if (killed) red++;
  console.log(name + ' ' + (baseline ? 'GREEN' : 'FAIL') + ' -> ' + (killed ? 'RED' : 'BLIND'));
}
console.log('SUMMARY baseline=' + green + '/' + cases.length + ' mutate_red=' + red + '/' + cases.length);
if (green !== cases.length || red !== cases.length) process.exitCode = 1;
```

**Interpretación:** estos controles caracterizan cláusulas preexistentes en el SHA *antes* de D01-C y D02-C. Después de modificar el contrato, probablemente fallen hasta que se reescriban para la especificación nueva; **no** eliminarlos o adulterarlos para lograr GREEN. No son sustituto de pruebas de invariantes SQL.

## Comandos de contraste pendientes en un clon habilitado

```bash
git fetch origin
git diff origin/develop...9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f --stat
git diff origin/develop...9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f -- docs/contracts/CC-043.md docs/contracts/CC-044.md docs/tasks/T-421.md docs/tasks/T-403.md docs/tasks/T-404.md docs/implementation-plan.md
git diff origin/develop 9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f -- docs/tasks/T-403.md docs/tasks/T-404.md
git merge-tree --write-tree origin/develop 9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f
node docs/revision-pr/analizar.mjs verificacion
pnpm vitest run tools/verify-fichas.test.ts src/domain/domain.test.ts > /tmp/pr587-vitest.log 2>&1
grep -E 'Test Files|Tests |PASS|FAIL' /tmp/pr587-vitest.log | tail -15
```

Para la futura PR de implementación: pgTAP con bypass `authenticated`, admin `aal1/aal2`, `service_role`, pruebas de históricos, carrera, marcador, cursor y total. Mutaciones de SQL se hacen solo en PR `review/...` aislada NEVER MERGE conforme a la ficha; **no** se corre Supabase ni Docker local sin permiso.
