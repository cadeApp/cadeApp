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


## Ronda 2 — 2026-11-03 — SHA `2764de210c4929ac2b5a6ea07357d441f1db3759`

### Evidencia independiente en memoria, sin Vitest

El revisor recuperó la función `app_private.request_cycle` de la migración T-369 y corrió el **mismo patrón** de `returnsBeforeWrite` de `audit-catalog.test.ts:167-172`, apuntando al índice real del `INSERT audit_log`. Resultados:

| Variación sobre el SQL | ¿Existe RETURN ejecutable en la rama? | `returnsBeforeWrite` |
|---|---|---|
| Original | Sí | `true` |
| `return ...` → `perform ...` | No | `false` |
| `return ...` → `perform ...; -- return eliminado` | No | **`true` (ciego)** |
| `return ...` → `perform ...; /* return */` | No | **`true` (ciego)** |
| `return ...` → `perform ...; raise notice 'return';` | No | **`true` (ciego)** |

La comparación del dominio de `p_action` (siete valores escritos contra los siete declarados, tras excluir `report_incident`) siguió igual en todos estos casos. **No se afirma que Vitest se haya ejecutado**: estas sondas corrieron sobre SQL leído del repo, con un evaluador JS de la expresión del control; el harness adjunto será la prueba final de mutation runtime.

### Batería independiente completa — H03 y H01

Copiar **el siguiente bloque completo** a `/tmp/pr582-r2-mutate.mjs`, arrancar desde worktree limpio y ejecutar `node /tmp/pr582-r2-mutate.mjs > /tmp/pr582-r2.log 2>&1`. El script verifica primero que el test original sea GREEN, muta una propiedad por vez, corre el test real y restaura desde buffer en `finally`. Nunca commitear SQL mutado ni adulterar los tests. El script no se ejecutó aquí porque la red no permite clonar y falta pnpm.

```js
// Guardar este bloque en /tmp/pr582-r2-mutate.mjs. Ejecutar desde la raíz de un worktree limpio.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const sqlFile = path.join(root, 'supabase/migrations/20261017090000_t369_publication_credits.sql');
const srcFile = path.join(root, 'src/features/admin/queries.ts');
const oldReturn = "return jsonb_build_object('incidentId', v_incident, 'requestId', p_request_id, 'status', 'open', 'createdAt', v_now);";
const oldReason = "return typeof value === 'string' && value.trim().length > 0 ? value : null;";
const replacements = [
  { label: 'R2-1: el texto -- return no es una sentencia ejecutable', file: sqlFile,
    from: oldReturn, to: oldReturn.replace(/^return /, 'perform ') + ' -- return eliminado',
    spec: 'src/features/admin/audit-catalog.test.ts', expected: 'report_incident' },
  { label: 'R2-2: /* return */ tampoco es una sentencia', file: sqlFile,
    from: oldReturn, to: oldReturn.replace(/^return /, 'perform ') + ' /* return */',
    spec: 'src/features/admin/audit-catalog.test.ts', expected: 'report_incident' },
  { label: "R2-3: raise notice 'return' tampoco es una sentencia", file: sqlFile,
    from: oldReturn, to: oldReturn.replace(/^return /, 'perform ') + " raise notice 'return';",
    spec: 'src/features/admin/audit-catalog.test.ts', expected: 'report_incident' },
  { label: 'R2-4: H01 no debe recortar el motivo', file: srcFile,
    from: oldReason, to: "return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;",
    spec: 'src/features/admin/queries.test.ts', expected: 'motivo completo' },
];
function run(spec) {
  const isWindows = process.platform === 'win32';
  const proc = spawnSync(isWindows ? 'pnpm.cmd' : 'pnpm', ['exec','vitest','run',spec], { cwd:root, encoding:'utf8', maxBuffer:25_000_000, shell:isWindows });
  if (proc.error) throw proc.error;
  const output = [proc.stdout||'', proc.stderr||''].join('\n');
  const lines = output.split('\n').filter(line => /Test Files|Tests |FAIL|AssertionError|expected|report_incident|motivo completo/i.test(line)).slice(-22);
  console.log(lines.join('\n'));
  return { status:proc.status,output };
}
for (const spec of [...new Set(replacements.map(m=>m.spec))]) {
  const baseline = run(spec);
  if (baseline.status !== 0) throw new Error('CONTROL BASE ROJO: '+spec);
  console.log('CONTROL GREEN:',spec);
}
for (const mutation of replacements) {
  const original = readFileSync(mutation.file, 'utf8');
  if (!original.includes(mutation.from)) throw new Error('SIN OBJETIVO: '+mutation.label);
  if (original.split(mutation.from).length !== 2) throw new Error('OBJETIVO AMBIGUO: '+mutation.label);
  let result;
  try {
    writeFileSync(mutation.file,original.replace(mutation.from,mutation.to),'utf8');
    console.log('MUTACIÓN',mutation.label);
    result=run(mutation.spec);
  } finally {
    writeFileSync(mutation.file,original,'utf8');
  }
  if (readFileSync(mutation.file,'utf8') !== original) throw new Error('RESTAURACIÓN FALLIDA');
  if (result.status === 0) console.log('CEGUERA CONFIRMADA: mutación GREEN',mutation.label);
  else if (result.output.toLowerCase().includes(mutation.expected.toLowerCase()))
    console.log('RED CON OBJETIVO:',mutation.label);
  else console.log('RED SIN OBJETIVO: inspeccionar fallo',mutation.label);
}

```

**Control de instrumentación:** un RED atribuible es el que falla por la aserción de `report_incident` o la igualdad estricta del motivo; no cuentan errores de TS, mocks rotos o ausencia de objetivo. Cuando el guard se arregle, las tres mutaciones de SQL deberán emitir **RED CON OBJETIVO**. Si quedan GREEN, el control sigue incompleto.

### Estado de checks observados

Para SHA `2764de210c4929ac2b5a6ea07357d441f1db3759`, `build`, `typecheck`, `lint`, `unit`, `audit` y `bundle-budget` figuran `success` en GitHub Actions run `41694433794`. El run `41693263827` corresponde al SHA intermedio `40197470`. En el log unit se leyó `Test Files 189 passed (189)`, `# pass 81` de la suite workflow y `# pass 6` de ADR; el resumen de número de casos Vitest está por debajo de cobertura y no se debe deducir del conteo de archivos. El job `db-tests` seguía en curso en el head actual (no se cambió Supabase en esta PR), `approval-policy` falló con «Falta el informe completo de revisar-pr sin bloqueantes» y `e2e-preview` aún estaba pendiente. La bitácora en `2764de21` declara GREEN local de 3452 pruebas, 1 passed del E2E local sobre el Preview `40197470` y la ejecución de mutaciones del arnés anterior; siguen siendo resultados del autor, no verificados en este entorno.

**Protocolo pendiente:** registrar resumen del E2E oficial y del job db-tests del próximo SHA de código; no exigir CI nuevo solo por el commit documental de esta ronda.
