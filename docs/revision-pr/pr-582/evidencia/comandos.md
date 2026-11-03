# Evidencia reproducible — PR #582 / T-400 / ronda 1

SHA inspeccionado: `9a25af62e93b65f04a384758327ce608d98d3e5c`. **No se ejecutaron checks de Node/Vitest contra un clon**, ya que el entorno rechazó `git ls-remote https://github.com/cadeApp/cadeApp.git` con `Could not resolve host: github.com` y carece de pnpm. La sonda H02 se realizó **solo en memoria del texto** obtenido por el conector GitHub. No se presentarán salidas inventadas.

## Controles base (ejecutar desde worktree limpio del SHA revisado)

```bash
git fetch origin
git ls-remote origin feat/T-400-audit-readable
# Confirmar el SHA que se quiera revisar. Usar un worktree limpio para los checks.
git worktree add /tmp/pr582-wt 9a25af62e93b65f04a384758327ce608d98d3e5c
cd /tmp/pr582-wt
pnpm typecheck > /tmp/pr582-typecheck.log 2>&1
pnpm lint > /tmp/pr582-lint.log 2>&1
pnpm exec vitest run src/features/admin/queries.test.ts src/features/admin/audit-catalog.test.ts > /tmp/pr582-focused.log 2>&1
grep -E '(Test Files|Tests |FAIL|PASS)' /tmp/pr582-focused.log | tail -25
pnpm test > /tmp/pr582-test.log 2>&1
grep -E '(Test Files|Tests |FAIL|PASS)' /tmp/pr582-test.log | tail -25
```

Estos comandos **no se ejecutaron**. No correr Supabase ni Docker local; `test:db` es n.a. para el diff. No disparar workflows manuales.

## Sonda independiente H01

El SQL de `20260924013700_rpc_admin_v1.sql` guarda `p_reason` en `after.reason` para decisión/suspensión; `20261016210000_cc025_courier_document_replacement.sql` hace lo propio para verificación documental. La lectura usa `asText(after.reason)`, cuyo retorno está recortado. Probar con:

```ts
const exactReason = '  Primera línea\nSegunda línea  \n';
mockClient({ audit_log: {
  data: [auditRow(100, 'admin_suspend_courier', 'courier', T400_COURIER, { status: 'approved' }, { status: 'suspended', reason: exactReason })],
  error: null,
} });
expect((await getAuditLog()).items[0]?.reason).toBe(exactReason);
```

Agregarlo a `src/features/admin/queries.test.ts` en el contexto existente. Sobre el SHA original debe dar **RED por diferencia estricta de motivo**, no por fallo de mock. Tras preservar la cadena original debe dar GREEN. Mutación RED propia para ronda 2: cambiar solo la expresión de retorno del helper literal por `.trim()` y comprobar que el test nuevo falla, restaurando del buffer original en `finally`.

## Sonda independiente H02 — script de mutación completo

Este script *temporal* no toca los tests y restaura el SQL usando su contenido original guardado en memoria, sin `git checkout`. Guardarlo como `/tmp/pr582-catalog-mutation.mjs` y ejecutarlo **desde el worktree limpio con pnpm instalado**. Verifica antes el control sin mutación. La salida buscada es verde base, rojo mutado **por falta de etiqueta**. El test antiguo quedará verde con la mutación: eso documenta la ceguera; una vez corregido el test debe quedar rojo. Si no llega a ejecutar la aserción correcta, anotar «sin objetivo».

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const rel = 'supabase/migrations/20261017090000_t369_publication_credits.sql';
const file = path.join(root, rel);
const original = readFileSync(file, 'utf8');
const needle = "p_action in ('publish_request','republish_request','report_no_show')";
const changed = "p_action in ('publish_request','republish_request','report_no_show','new_unlabeled_action')";
if (!original.includes(needle)) throw new Error('Mutación sin objetivo: patrón original ausente');
if (original.includes('new_unlabeled_action')) throw new Error('El repositorio ya incluye el mutante');
const args = ['exec', 'vitest', 'run', 'src/features/admin/audit-catalog.test.ts'];
function check(label) {
  const run = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const log = [run.stdout ?? '', run.stderr ?? ''].join('\n');
  const summary = log.split('\n').filter(x => /Test Files|Tests |FAIL|passed|failed|no tests/i.test(x)).slice(-12).join('\n');
  process.stdout.write(label + '\n' + summary + '\n');
  if (run.error) throw run.error;
  return { status: run.status, log };
}
const baseline = check('CONTROL SIN MUTAR');
if (baseline.status !== 0) throw new Error('Control base rojo: no atribuir resultado a mutación');
let mutant;
try {
  writeFileSync(file, original.replace(needle, changed), 'utf8');
  mutant = check('MUTACIÓN: nuevo p_action sin etiqueta');
} finally {
  writeFileSync(file, original, 'utf8');
}
if (readFileSync(file, 'utf8') !== original) throw new Error('No se restauró el SQL');
if (mutant.status === 0) {
  console.log('CONTROL CIEGO: mutante queda GREEN; no se detecta la nueva acción');
} else if (/new_unlabeled_action|sin etiqueta|etiqueta/i.test(mutant.log)) {
  console.log('RED CON OBJETIVO: el test detecta acción nueva sin etiqueta');
} else {
  console.log('RED SIN OBJETIVO: revisar la causa real del fallo antes de atribuir cobertura');
}
```

Ejemplo de ejecución: `node /tmp/pr582-catalog-mutation.mjs > /tmp/pr582-mut.log 2>&1`. Repetir con una de las migraciones históricas que también escriben `p_action`. No conservar ni commitear una migración alterada.

## Checks de proceso / CI

- `git diff origin/develop -- docs/tasks/T-400.md`: el blob de la ficha coincide con `develop` por conector (ningún cambio en PR).
- `git diff --name-only origin/develop...HEAD`: 15 rutas; todas autorizadas.
- `git merge-tree --write-tree origin/develop HEAD`: **no ejecutado** sin clon; GitHub indicaba mergeable.
- `git log -- docs/revision-pr/pr-582/`: carpeta ausente antes de la revisión.
- `node docs/revision-pr/analizar.mjs verificacion`: **pendiente de ejecutar en un clon**.
- CI oficial y `e2e-preview`: **no inspeccionados en detalle** mientras haya bloqueantes; al estar lista la siguiente ronda, validar job/SHA y líneas concretas, no solo color.
