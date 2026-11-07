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


## Ronda 3 — SHA `3c4d3e56c0317f7e925941429aa8a672519be012` — batería independiente H04

**Origen de la prueba:** texto de `app_private.request_cycle` en `supabase/migrations/20261017090000_t369_publication_credits.sql`, leído con GitHub; control `returnsBeforeWrite` y `scrubSql` copiados fielmente del código `3c4d3e56c0317f7e925941429aa8a672519be012` y ejecutados en JS en memoria. No se ejecutaron pgTAP, PostgreSQL ni Vitest del repo en el entorno de revisión, porque el clon no es accesible por DNS y no hay pnpm. La bitácora del autor declara GREEN base y RED de los cuatro mutantes del revisor de ronda 2.

| Mutación en la rama `report_incident` | Salida garantizada | Guard esperado | Guard actual |
|---|---|---|---|
| SQL original `RETURN` directo | sí | true | true |
| `RETURN` → `PERFORM` directo | no | false | false |
| `IF false THEN RETURN; END IF; PERFORM` | no | false | **true** |
| `IF v_uid IS NULL THEN RETURN; END IF; PERFORM` | no (el uid nulo ya es rechazado antes) | false | **true** |
| `PERFORM; /* exterior /* interior */ return */` | no | false | **true** |
| `PERFORM; -- return eliminado` | no | false | false |
| `RAISE NOTICE 'literal -- no comentario'; RETURN` real | sí | true | true |

**Base del hallazgo:** `returnsBeforeWrite` busca `/\b(return|elsif|else|end\s+if)\b/` y no distingue la profundidad de un `IF` interno; `scrubSql` usa `indexOf('*/')` sin contador de profundidad. En PostgreSQL los comentarios de bloque `/* */` **se pueden anidar** ([documentación oficial, §4.1.5](https://www.postgresql.org/docs/16/sql-syntax-lexical.html)). Ambos son falsos positivos independientes de la corrección de H03.

**Harness completo de mutación sobre el Vitest real (pendiente de ejecución externa):** copiar el bloque siguiente a `/tmp/pr582-r3-mutate.mjs` y ejecutar `node /tmp/pr582-r3-mutate.mjs > /tmp/pr582-r3.log 2>&1` dentro del worktree. En el SHA actual, H04-1/2/3 deberían aparecer como **FALSO GREEN CONFIRMADO**; después de corregirlo deben salir **RED CON OBJETIVO**, siempre con control base GREEN y restauración explícita. No cuenta un fallo por TypeScript, otro test o instrumento sin objetivo.

```js
// Guardar como /tmp/pr582-r3-mutate.mjs (fuera del repo).
// Ejecutar desde un worktree limpio del SHA que contiene el fix.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'supabase/migrations/20261017090000_t369_publication_credits.sql');
const target = "return jsonb_build_object('incidentId', v_incident, 'requestId', p_request_id, 'status', 'open', 'createdAt', v_now);";
const perform = target.replace(/^return /, 'perform ');
const spec = 'src/features/admin/audit-catalog.test.ts';
const cases = [
  {
    label: 'R3-CONTROL: sin RETURN, debe ser RED',
    mutant: perform,
    red: true,
  },
  {
    label: 'R3-H04-1: RETURN inalcanzable dentro de IF false',
    mutant: 'if false then\n      ' + target + '\n    end if;\n    ' + perform,
    red: true,
  },
  {
    label: 'R3-H04-2: RETURN inalcanzable dentro de IF v_uid IS NULL (ya validado)',
    mutant: 'if v_uid is null then\n      ' + target + '\n    end if;\n    ' + perform,
    red: true,
  },
  {
    label: 'R3-H04-3: return en comentario /* anidado */',
    mutant: perform + ' /* comentario exterior /* interior */ return */',
    red: true,
  },
  {
    label: 'R3-REGRESION: comentario simple + PERFORM debe ser RED',
    mutant: perform + ' -- return eliminado',
    red: true,
  },
  {
    label: 'R3-CONTROL GREEN: SQL string con -- y RETURN real',
    mutant: "raise notice 'literal -- no es comentario';\n    " + target,
    red: false,
  },
];
function run(label) {
  const win = process.platform === 'win32';
  const r = spawnSync(win ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'vitest', 'run', spec],
    { cwd: root, encoding: 'utf8', shell: win, maxBuffer: 20_000_000 });
  if (r.error) throw r.error;
  const log = [r.stdout || '', r.stderr || ''].join('\n');
  const summary = log.split('\n')
    .filter(l => /Test Files|Tests |FAIL|AssertionError|report_incident|p_action en/i.test(l))
    .slice(-18).join('\n');
  console.log('\n' + label + '\n' + summary);
  return { exit: r.status, log };
}
const original = readFileSync(file, 'utf8');
if (original.split(target).length !== 2)
  throw new Error('SIN OBJETIVO o ambiguo: el retorno de report_incident no es único');
const before = run('CONTROL sin mutar');
if (before.exit !== 0) throw new Error('CONTROL BASE NO GREEN; no atribuir mutaciones');
for (const c of cases) {
  let result;
  try {
    writeFileSync(file, original.replace(target, c.mutant), 'utf8');
    result = run(c.label);
  } finally {
    writeFileSync(file, original, 'utf8');
  }
  if (readFileSync(file, 'utf8') !== original) throw new Error('RESTAURACIÓN FALLIDA');
  const matchedTarget = /report_incident|p_action en/.test(result.log);
  if (c.red) {
    if (result.exit === 0)
      console.log('FALSO GREEN CONFIRMADO (control ciego): ' + c.label);
    else if (matchedTarget)
      console.log('RED CON OBJETIVO: ' + c.label);
    else
      console.log('RED SIN OBJETIVO: revisar causa, no contar: ' + c.label);
  } else {
    console.log((result.exit === 0 ? 'GREEN CON OBJETIVO' : 'GREEN FALLÓ') + ': ' + c.label);
  }
}
const status = spawnSync('git', ['status','--short','--', 'supabase/migrations/20261017090000_t369_publication_credits.sql'],
  { cwd:root, encoding:'utf8' });
console.log('SQL clean:', status.status === 0 && !status.stdout.trim());

```

### CI del SHA de código

Al consultar GitHub para `3c4d3e56c0317f7e925941429aa8a672519be012`: `build`, `lint`, `typecheck`, `audit`, `bundle-budget` estaban `success`; `unit` y `db-tests` `in_progress`; `e2e-preview` `pending` (Preview de Vercel desplegado). `approval-policy` falla mientras no exista informe de revisión **SIN BLOQUEANTES**. **No se declara CI global verde**. Se omitió inspección detallada de logs por existir H04 bloqueante, salvo el check `db-tests` previsto como sustituto de SQL local; aún no había terminado.


## Ronda 4 — `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b` — cierre independiente

### ALCANCE Y MÉTODO

- **Verificado por el revisor:** código `scrubSql`, `returnsBeforeWrite`, `comparedDomain` y `asAuditReason` leído desde el SHA exacto; SQL histórico real T-369 y CC-007 leído desde la misma rama mediante conector GitHub. Ejecutó V8 JS con **transcripciones explícitas** de estos helpers (no el Vitest del repo) y mutaciones solo en memoria; no se creó ni ejecutó ninguna migración modificada.
- **H04/H03:** 17 de 17 casos de la matriz independientes tienen resultado esperado. Incluye R3-H04-1 `IF false`, R3-H04-2 `IF v_uid IS NULL`, R3-H04-3 comentario bloque anidado, R2 comentarios simples y strings, loops, IF cerrados, `E'...'`, dólar literal y `RETURN` válido. El control original es `true`, todos los regresivos probados son `false`.
- **H02:** para T-369 y CC-007, `comparedDomain` deriva exactamente el conjunto de 7 acciones al quitar la exclusión `report_incident`; mutar temporalmente en memoria `p_action in ('publish_request','republish_request','report_no_show')` por la misma condición con `'new_unlabeled_action'` agrega el valor 8, que **no existe** en `ADMIN_COPY.audit.actions`. Una aserción real de catálogo sería RED. No se afirma haber ejecutado el Vitest mutado.
- **H01:** `asAuditReason` retorna `null` para nulo, número, vacío y solo-whitespace; devuelve sin cambios `'  Primera línea\nSegunda línea  \n'`. Es una comprobación en V8 del helper, no un E2E DOM.
- **CI real:** en job `unit` del [run 41698034807](https://github.com/cadeApp/cadeApp/actions/runs/41698034807) del SHA `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b`, se leyó `Test Files 189 passed (189)`, `# pass 81` de workflow tests y `# pass 6` de ADR, sin fallos. `build`, `lint`, `typecheck`, `audit` y `bundle-budget` constaban success.
- **Gates pendientes:** `db-tests` seguía en ejecución; `e2e-preview` estaba pending en [run 41698361572](https://github.com/cadeApp/cadeApp/actions/runs/41698361572) con Vercel Preview desplegado, y `approval-policy` falló porque la sección del cuerpo de la PR seguía con «Pendiente». Se completará el informe en el cuerpo para que lo reevalúe el evento edited. **No declarar merge-ready hasta ver los tres gates.**

### Script para reproducir la sonda de ronda 4 (sin modificación de archivos)

Guardar el siguiente código como `/tmp/pr582-r4-v8.mjs`, desde la raíz de un worktree `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b`, y ejecutar `node /tmp/pr582-r4-v8.mjs`. La prueba de autor sobre **Vitest real** está documentada en `docs/tasks/log/T-400.md`; para reproducir esos RED de verdad, usar el harness de ronda 3 en esta misma carpeta y `pnpm exec vitest run src/features/admin/audit-catalog.test.ts`. Ningún script de esta ronda modifica el repo.

```js
// Verificación local sin dependencias; ejecutable como node /tmp/pr582-r4-v8.mjs desde el repositorio.
// Reproduce por separado (NO reemplaza a Vitest) las funciones puras de audit-catalog.test.ts del SHA revisado.
// El origen de la función se contrastó por inspección con 9a0b6f5d; no importa producción ni accede a red.
import fs from 'node:fs';
const sql = fs.readFileSync('supabase/migrations/20261017090000_t369_publication_credits.sql','utf8');
const head = sql.indexOf('create or replace function app_private.request_cycle(');
const end = sql.indexOf('$$;',head);
const body = sql.slice(head,end);
const needle = "return jsonb_build_object('incidentId', v_incident, 'requestId', p_request_id, 'status', 'open', 'createdAt', v_now);";
if (head < 0 || end < 0 || body.split(needle).length !== 2)
  throw Error('INSTRUMENTO SIN OBJETIVO: revisar SQL antes de atribuir resultado');
function scrubSql(sql, emptyLiterals) {
  let out = ''; let i = 0;
  while (i < sql.length) {
    if (sql.startsWith('--',i)) {const end = sql.indexOf('\n',i);i=end===-1?sql.length:end;out+=' ';}
    else if (sql.startsWith('/*',i)) {let depth=1;i+=2;while (i<sql.length&&depth>0){if(sql.startsWith('/*',i)){depth++;i+=2;}else if(sql.startsWith('*/',i)){depth--;i+=2;}else i++;}out+=' ';}
    else if (sql[i] === "'") {
      const escaped = /[eE]/.test(sql[i-1]??'') && !/[a-zA-Z0-9_]/.test(sql[i-2]??'');
      let end = i+1;
      while(end<sql.length){if(escaped&&sql[end]==='\\')end+=2;else if(sql[end]==="'"&&sql[end+1]==="'")end+=2;else if(sql[end]==="'")break;else end++;}
      out += emptyLiterals ? "''" : sql.slice(i,end+1);i=end+1;
    } else out+=sql[i++];
  }
  return out;
}
function returnsBeforeWrite(expression,value,body,writeAt) {
  const beforeWrite = scrubSql(body.slice(0,writeAt),false);
  const branch = new RegExp("\\bif\\s+"+expression+"\\s*=\\s*'"+value+"'\\s+then\\b",'i').exec(beforeWrite);
  if (!branch) return false;
  const rest = scrubSql(beforeWrite.slice(branch.index+branch[0].length),true);
  const keywords = /\$[a-z_]*\$|\b(end\s+if|elsif|else|if|return|end|loop|while|for|foreach|case|begin|exception|declare)\b/gi;
  let depth = 0;
  for (const m of rest.matchAll(keywords)) {
    const k=(m[1]??'$').toLowerCase().replace(/\s+/g,' ');
    if(k==='if')depth++;
    else if(k==='end if'){if(depth===0)return false;depth--;}
    else if(k==='elsif'||k==='else'){if(depth===0)return false;}
    else if(k==='return'){if(depth===0)return true;}
    else return false;
  }
  return false;
}
const perform = needle.replace(/^return /,'perform ');
const cs = [
  ['original',needle,true],
  ['perform',perform,false],
  ['if false', 'if false then\n'+needle+'\nend if;\n'+perform,false],
  ['if uid null','if v_uid is null then\n'+needle+'\nend if;\n'+perform,false],
  ['comment nested',perform+' /* outer /* inner */ return */',false],
  ['comment --',perform+' -- return eliminado',false],
  ['comment /* */',perform+' /* return */',false],
  ['literal',perform+" raise notice 'return';",false],
  ['string with -- then real return',"raise notice 'x -- y'; "+needle,true],
  ['closed inner IF then real return',"if v_uid is null then perform 1; end if; "+needle,true],
  ['loop with return',"loop "+needle+" end loop; "+perform,false],
  ['E quote escaped',"raise notice E'can\\'t -- return'; "+perform,false],
  ['E quote then real return',"raise notice E'x\\\\'; "+needle,true],
  ['commented IF decoy',"-- if p_action = 'report_incident' then return;\n"+perform,false],
  ['nested comment then return',"/* comment outer /* inner */ after */ "+needle,true],
  ['two nested IFs',"if true then if false then "+needle+" end if; end if; "+perform,false],
  ['dollar quoted return',perform+" raise notice $q$return$q$;",false],
];
let ok=0;
for (const [name,rep,expected] of cs) {
  const mut=body.replace(needle,rep),writeAt=mut.indexOf('insert into public.audit_log');
  if(writeAt<0)throw Error('No se pudo localizar insert: '+name);
  const got=returnsBeforeWrite('p_action','report_incident',mut,writeAt);
  const pass=got===expected; if(pass)ok++;
  console.log((pass?'PASS ':'FAIL ')+name+' expected='+expected+' observed='+got);
}
console.log('MATRIZ '+ok+'/'+cs.length);
if(ok!==cs.length)process.exitCode=1;

```

**Resultado independiente realizado en el runtime de la revisión:** matriz 17/17; T369/CC007 dominio base 7/7, mutación 8/7 sin etiqueta; asAuditReason 5/5. La sonda no sustituye al runner de Vitest ni a PostgreSQL. El job oficial unit respalda que el test real no falla con código intacto.

**Protocolo operativo:** el commit que cierra la carpeta es exclusivamente de revisión. No pedir un CI verde adicional solo por este commit documental, conforme a la regla 10. Esperar el resultado de los gates automáticos del SHA de código antes de mergear.
