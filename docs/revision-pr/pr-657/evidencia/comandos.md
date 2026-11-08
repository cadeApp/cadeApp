# Evidencia y comandos reproducibles — PR #657 / ronda 1

## Alcance efectivamente inspeccionado

- Head: `f4878f8814f0002a758545d6e9617ae2da7299b7`.
- Base: `develop@4e700aa2d5f3edb362446675a736903fbb55dd35`.
- Comparación de GitHub: ahead 1, behind 0, solo `docs/contracts/CC-047.md` y `docs/tasks/T-408.md`.
- Confirmación de política y líneas vía lectura de archivos de migraciones y tests del SHA base.
- No existe clon git ni DB local en esta sesión. **Los comandos siguientes no se ejecutaron**, no hay tests RED/GREEN ni evidencia de CI atribuible a esta ronda. Los hallazgos H01-H04 son por inspección.

## Inspección git al tomar la siguiente ronda (solo lectura)

~~~bash
git fetch origin
git status --short
git rev-parse origin/develop
git rev-parse origin/cc/CC-047-admin-hardening
git diff --stat origin/develop...origin/cc/CC-047-admin-hardening
git diff origin/develop...origin/cc/CC-047-admin-hardening -- docs/contracts/CC-047.md docs/tasks/T-408.md
git diff origin/develop -- docs/tasks/T-408.md
git merge-tree --write-tree origin/develop origin/cc/CC-047-admin-hardening
git log -- docs/revision-pr/pr-657/
node docs/revision-pr/analizar.mjs verificacion
~~~

## Harness completo de revisión documental (copiable a /tmp)

El control siguiente no es pgTAP ni reemplaza la prueba SQL. Verifica que las cuatro correcciones contractuales figuren en el CC y que la ficha permita las suites históricas. **Sobre el SHA revisado de ronda 1 se espera salida NO CONFORME** (todavía no corregido); después de que el autor aplique los cambios, se espera CONFORME. No presentar este resultado como pruebas de seguridad RED→GREEN.

Guardá el contenido a `/tmp/pr657-contrato-check.cjs` y ejecutá `node /tmp/pr657-contrato-check.cjs "$PWD"`; no crea ni modifica archivos del repo.

~~~javascript
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
if (!root) { console.error('Uso: node /tmp/pr657-contrato-check.cjs RUTA_REPO'); process.exit(2); }
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const cc = read('docs/contracts/CC-047.md');
const t = read('docs/tasks/T-408.md');
const checks = [
  ['H01: trigger invoker y roles efectivos', /audit_log_reject_client_change[\s\S]{0,1200}security invoker/i.test(cc) &&
     /current_user[\s\S]{0,220}(anon|authenticated)/i.test(cc)],
  ['H02: RPCs auditadas CC-031 y FOR UPDATE', /admin_correct_courier_display_name/i.test(cc) &&
     /admin_revoke_courier_consent/i.test(cc) && /for update/i.test(cc) && /audit_log/i.test(cc)],
  ['H02: pgTAP CC-031 permitida', t.includes('cc031_courier_display_name_guard.sql')],
  ['H02: concurrencia CC-031 permitida', t.includes('integration/cc031_profile_concurrency.mjs')],
  ['H03: rpc_admin.sql permitida', t.includes('rpc_admin.sql')],
  ['H04: migración sin limpieza automática de merchants.notes',
     /no (update|delete|borra|toca)\s.{0,30}merchants\.notes/i.test(cc) ||
     /sin borrado autom[aá]tico/i.test(cc)],
  ['H04: consulta SELECT y orden total', /consulta[^\n]{0,100}select/i.test(cc) &&
     /audit_log\.id|order by[^\n]*id\s+desc/i.test(cc)],
  ['D3: autoservicio preservado con prueba de columnas', /autoservicio/i.test(cc) &&
     /privilegiadas|privilegios/i.test(cc)]
];
let failed = 0;
for (const [name, ok] of checks) { console.log((ok ? 'OK' : 'NO CONFORME') + ' — ' + name); if (!ok) failed++; }
console.log('Verificaciones documentales: ' + (checks.length - failed) + '/' + checks.length);
process.exitCode = failed ? 1 : 0;
~~~

## SQL de solo lectura para candidatos D2 — ejecutar MANUALMENTE por Lautaro073

Consulta orientativa (corregir nombres de columnas si la migración final los modifica). Ejecutar en consola SQL autorizada **en cada ambiente** y antes de promover. Produce solo identificadores y marcador de coincidencia; no muestra texto privado. El resultado no demuestra autoría y **no** autoriza UPDATE automático.

~~~sql
WITH ultimas AS (
  SELECT DISTINCT ON (a.target_id)
         a.target_id,
         a.id AS audit_id,
         a.created_at,
         a.after ->> 'notes' AS nota_admin
  FROM public.audit_log AS a
  WHERE a.action = 'admin_set_subscription'
    AND a.target_type = 'merchant'
    AND a.after ->> 'notes' IS NOT NULL
  ORDER BY a.target_id, a.id DESC
)
SELECT m.profile_id AS merchant_id,
       u.audit_id,
       u.created_at AS audit_created_at,
       'COINCIDE_REVISAR_AUTORIA'::text AS resultado
FROM public.merchants AS m
JOIN ultimas AS u ON u.target_id = m.profile_id::text
WHERE m.notes IS NOT NULL
  AND m.notes = u.nota_admin
ORDER BY m.profile_id;
~~~

Registros humanos a conservar por ambiente: nombre de ambiente, fecha, SHA de migración, cantidad de candidatos, cada ID y resolución (sin registrar contenido de la nota). Si hay candidatos sin resolver, **no promover**. La revisión no ejecutó esta consulta en ninguna base y no accedió a datos personales.

## Mutaciones SQL exigidas para T-408 (TODAVÍA NO EJECUTADAS)

- **H01:** con rol authenticated y una fila visible, reponer temporalmente GRANT y policy permisiva para demostrar que un UPDATE/DELETE/TRUNCATE sigue rechazado por el trigger. Mutar en memoria el control de invocador y demostrar que el caso da rojo; después restaurar. El test debe probar operación real, no solo `pg_proc.prosecdef`.
- **H02:** mutar temporalmente el control `aal2` y el `FOR UPDATE` de las nuevas RPC; los casos de autorización y carrera CC-031 deben fallar respectivamente. Restaurar y comprobar serialización y auditoría.
- **H03:** mutar SQL de `admin_set_subscription` para volver a escribir `merchants.notes`; la aserción de `rpc_admin.sql` debe dar rojo.
- **H04:** mutar el SQL de migración para que borre coincidencias; el test de preservación de nota debe dar rojo.
- **D3:** intentar UPDATE directo de columnas privilegiadas sobre la propia fila admin, con JWT `aal1` y `aal2`. Ninguna mutación debe alcanzar la columna auditada. Conservá los tests de autoservicio legítimo.

No usar Docker ni Supabase local; la prueba SQL queda para el job oficial de db-tests (leer Files/Tests/Result y drift db --local) de T-408. No abrir PR de mutación para E2E público; aplicar las reglas de T-347 si corresponde. No se inventan resultados de CI.

## Formato y límites

El documento `hallazgos.jsonl` contiene 4 entradas JSONL, ninguna marcada `arreglado-verificado`. Al disponer de clon, ejecutar `node docs/revision-pr/analizar.mjs verificacion` y el harness anterior. El control de CI no se considera verde por la edición de estos docs.

---
## Ronda 2 — SHA `ec341a04939b9cc9ae24b574c440a19d6690e591` (2026-11-07)

### Qué se ejecutó realmente

- GitHub: verificación de HEAD, base y comparaciones de commits. Dos archivos modificados desde la ronda 1; sin cambios a la carpeta de revisión.
- Lectura completa de `docs/contracts/CC-047.md` y `docs/tasks/T-408.md` en el SHA indicado y de fuentes SQL de `develop`.
- **Comprobación documental en memoria** de H01–H04 y D3: todas positivas. Mutaciones independientes: sustituir invoker por definer (H01), `FOR UPDATE` por `FOR SHARE` (H02), quitar `rpc_admin.sql` (H03), ordenar por `created_at` (H04), quitar autoservicio (D3): las cinco vuelven su control de texto a falso. **No se ejecutó SQL ni pgTAP**.
- Reproducción del algoritmo real de `tools/verify-fichas.test.ts:44-47` con rutas concretas: **10/10 suites no admitidas por entradas con llaves**; una ruta real de migración tampoco coincide con `<timestamp>`. La edición solo en memoria de las rutas las vuelve permitidas; no se hizo cambio en la ficha.
- Contradicción H05 reproducida por comparador de frases: CC conserva grants, T-408 los pide revocar, checklist omite D1; las sustituciones editoriales en memoria eliminan las tres contradicciones. No es prueba de RLS.
- `node --check /tmp/pr657-r2-doc-check.cjs`: **Syntax OK**, ejecutado sobre harness local. El harness del repositorio remoto no se pudo ejecutar porque no había clon Git.
- `git diff --check`: **el autor reportó limpio**, no verificado por esta revisión.
- `git merge-tree`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db`, E2E, pruebas SQL mutadas: **NO EJECUTADOS**.

### Harness completo reproducible — solo texto, no seguridad RLS

Copiar este bloque completo a `/tmp/pr657-r2-doc-check.cjs` y ejecutarlo desde un clon del SHA revisado:

~~~bash
node --check /tmp/pr657-r2-doc-check.cjs
node /tmp/pr657-r2-doc-check.cjs "$PWD"
# Tras aplicar la corrección a la ficha y CC:
node /tmp/pr657-r2-doc-check.cjs "$PWD" --expect-clear
~~~

~~~javascript
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || process.cwd();
const expectClear = process.argv.includes('--expect-clear');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const cc = read('docs/contracts/CC-047.md');
const task = read('docs/tasks/T-408.md');
const required = [
 'cc007_consent_enforcement','cc023_private_columns',
 'cc032_request_cancellation_history','cc036_offers_rpc_only',
 'rls_coordinates','rpc_distance','rpc_accept','t339_fixed_price',
 't369_publication_credits','structure'
].map(name => 'supabase/tests/'+name+'.sql');
const sec=(s,from,to)=>s.split(from)[1]?.split(to)[0]||'';
function uncovered(t) {
 const part=sec(t,'## Archivos permitidos','## Fuera de alcance');
 const entries=(part.match(/`([^`]+)`/g)||[]).map(s=>s.slice(1,-1));
 const paths=[...required,'supabase/migrations/20261108020000_cc047_admin_hardening.sql'];
 return paths.filter(p=>!entries.some(e=>e.endsWith('**')?p.startsWith(e.slice(0,-2)):e===p));
}
function check(c,t) {
 const audit=sec(c,'3. **`audit_log`','4. **Storage.');
 const rpc=sec(c,'7. **Dos RPC','## Seguridad y permisos');
 const notes=sec(c,'6. **Nota interna','7. **Dos RPC');
 return {
  H01:/security invoker/i.test(audit)&&/current_user/.test(audit)&&/before truncate/.test(audit),
  H02:/admin_correct_courier_display_name/.test(rpc)&&/admin_revoke_courier_consent/.test(rpc)&&/for update/i.test(rpc)&&/audit_log/.test(rpc),
  H03:c.includes('supabase/tests/rpc_admin.sql')&&t.includes('supabase/tests/rpc_admin.sql'),
  H04:/distinct on \(a\.target_id\)/i.test(notes)&&/order by a\.target_id, a\.id desc/i.test(notes)&&/Sin borrado autom[aá]tico/.test(notes)&&!/update\s+public\.merchants\s+set\s+notes/i.test(notes),
  D3:c.includes('Autoservicio de la cuenta admin (D3=B)'),
  R01:uncovered(t).length===0,
  H05:!/pierde su policy y su grant de escritura directa/.test(t)&&!/no tiene ninguna\s+policy de escritura/.test(c)&&!/Idempotencia y concurrencia:\*\* no aplica salvo/.test(t)
 };
}
const baseline=check(cc,task);
const mutations=[
 ['H01',cc.replace('**`security invoker`**','**`security definer`**'),task],
 ['H02',cc.replace(/for update/gi,'for share'),task],
 ['H03',cc.replaceAll('supabase/tests/rpc_admin.sql','omitida'),task.replaceAll('supabase/tests/rpc_admin.sql','omitida')],
 ['H04',cc.replace('order by a.target_id, a.id desc','order by a.target_id, a.created_at desc'),task],
 ['D3',cc.replace('Autoservicio de la cuenta admin (D3=B)','Autoservicio no definido'),task]
];
let failed=0;
for (const [key,c,t] of mutations) {
 const outcome=check(c,t)[key];
 if(!baseline[key]||outcome) failed++;
 console.log(key+' mutation '+baseline[key]+' -> '+outcome+' (expected true -> false)');
}
const fixedTask=task
 .replace('`supabase/tests/{cc007_consent_enforcement,cc023_private_columns,cc032_request_cancellation_history,cc036_offers_rpc_only,rls_coordinates,rpc_distance}.sql`',required.slice(0,6).map(x=>'`'+x+'`').join(', '))
 .replace('`supabase/tests/{rpc_accept,t339_fixed_price,t369_publication_credits,structure}.sql`',required.slice(6).map(x=>'`'+x+'`').join(', '))
 .replace('`supabase/migrations/<timestamp>_cc047_admin_hardening.sql`','`supabase/migrations/20261108020000_cc047_admin_hardening.sql`')
 .replace('pierde su policy y su grant de escritura directa','pierde su policy de escritura administrativa; los grants compartidos se conservan')
 .replace('**Idempotencia y concurrencia:** no aplica salvo `accept_offer`.','**Idempotencia y concurrencia:** incluye accept_offer y las dos RPC D1 con FOR UPDATE y CC-031 B/C.');
const fixedCC=cc.replace(/La barrera es que el admin no tiene ninguna\s+policy de escritura:/,'El admin no tiene policy de escritura privilegiada, pero conserva policies self:');
const repaired=check(fixedCC,fixedTask);
console.log('Permisos ausentes: '+JSON.stringify(uncovered(task)));
console.log('R01 simulated repair: '+baseline.R01+' -> '+repaired.R01);
console.log('H05 simulated repair: '+baseline.H05+' -> '+repaired.H05);
console.log('NOTA: solo controles de texto; no PostgreSQL ni SQL runtime');
if(failed || !repaired.R01 || !repaired.H05)process.exitCode=2;
if(expectClear && (!baseline.R01 || !baseline.H05))process.exitCode=1;
~~~

**Resultados sobre el texto remoto del SHA revisado** (comprobación independiente en memoria): H01/H02/H03/H04/D3: `true`; mutaciones: `false`. R01: `false`, faltan diez suites y una ruta real de migración; reparación simulada: `true`. H05: `false`; reparación de contradicciones simulada: `true`. Estos valores no equivalen a tests funcionales.

### Para la siguiente ronda

~~~bash
git fetch origin
git diff origin/develop -- docs/tasks/T-408.md
git diff origin/develop...origin/cc/CC-047-admin-hardening --stat
git diff --check origin/develop...origin/cc/CC-047-admin-hardening
git merge-tree --write-tree origin/develop origin/cc/CC-047-admin-hardening
node docs/revision-pr/analizar.mjs verificacion
~~~

No levantar bases locales ni ejecutar credenciales de Supabase. Las mutaciones reales de SQL/RLS que se enumeran en `ronda-1.md` solo se verifican al implementar T-408 y revisar logs de los jobs oficiales.

---

## Ronda 3 — SHA `09df17bc0be7bbdf4ef97a12f7bf32f849537c7d` (2026-11-07)

**Origen del resultado:** comparación y lectura GitHub del commit indicado. La lógica independiente se ejecutó en JavaScript sobre ambas cadenas leídas de GitHub, sin base ni Docker. El script completo está abajo y fue validado sintácticamente con Node 22 (`node --check`). No se ejecutó `git merge-tree` ni `node docs/revision-pr/analizar.mjs verificacion` en un clon local, porque no había checkout Git.

### Resultado reproducido

- Antes de corregir R01 (`ec341a04`): **11/11 rutas rechazadas**.
- Después (`09df17bc`): **0/11 rechazadas**.
- **Mutación RED independiente:** reemplazar la entrada literal `supabase/tests/rpc_distance.sql` por `supabase/tests/{rpc_distance}.sql` en memoria: falla exactamente una ruta.
- Validación de coherencia H05: checklist de grants, DoD de grants, concurrencia con dos RPC y auditoría, ausencia de backfill y CC con privilegios por columna: **5/5 condiciones verdaderas**. Cinco mutaciones independientes produjeron la condición falsa correspondiente. Una primera mutación de concurrencia no quitaba la palabra «auditoría» y no fallaba: se corrigió el mutante y se repitió antes de cerrar.
- No hay colisión de `20261108020000_cc047_admin_hardening.sql` entre las **51 migraciones** de `develop` (última `20261106120000_cc042_courier_vehicles.sql`).
- Autor reportó `git diff --check` sin errores. **No reproducido** localmente por falta de clon.
- **CI #42436346316 para SHA del producto**: `typecheck`, `lint`, `build`, `audit`, `unit`, `bundle-budget`: success. En el log completo del job `unit`: **199 files passed / 3755 tests passed**; `tools/verify-fichas.test.ts` **7 tests**. `db-tests` estaba in_progress cuando se consultó; resultado no adjudicado. No hubo ejecución de E2E/pgTAP mutado por parte del revisor.
- La descripción de la PR se corrigió directamente para reflejar D1–D3; esto no mueve el commit.

### Harness autónomo (se ejecuta sobre checkout del SHA; no modifica archivos)

Copiar el bloque a `/tmp/pr657-r3-check.cjs` y ejecutar:

```bash
node --check /tmp/pr657-r3-check.cjs
node /tmp/pr657-r3-check.cjs "$PWD"
# Sobre el SHA 09df17bc debe producir BASE con 6 true,
# MISSING 0, seis mutaciones RED_DOCUMENTAL y RESULT PASS.
```

```javascript
'use strict';
// Verificación independiente del contrato documental, no sustituye pgTAP.
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
if (!root) { console.error('Uso: node check_ronda3.cjs ROOT'); process.exit(2); }
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const cc = read('docs/contracts/CC-047.md');
const task = read('docs/tasks/T-408.md');
const paths = [
 'cc007_consent_enforcement','cc023_private_columns',
 'cc032_request_cancellation_history','cc036_offers_rpc_only',
 'rls_coordinates','rpc_distance','rpc_accept','t339_fixed_price',
 't369_publication_credits','structure'
].map(x => 'supabase/tests/' + x + '.sql')
 .concat('supabase/migrations/20261108020000_cc047_admin_hardening.sql');
const sec = (s, start, end) => s.split(start)[1]?.split(end)[0] || '';
function permitted(t, p) {
 const allowed = sec(t, '## Archivos permitidos', '## Fuera de alcance');
 const entries = [...allowed.matchAll(/`([^`]+)`/g)].map(m => m[1]);
 return entries.some(e => e.endsWith('**') ? p.startsWith(e.slice(0, -2)) : e === p);
}
function checks(c,t) {
 const cl = sec(t,'## Checklist de esquema/RPC','## Archivos permitidos');
 const dod = sec(t,'## DoD','## Regla de pruebas');
 const access = sec(c,'- **Acceso directo frente a RPC:**','## Concurrencia e idempotencia');
 const gcl = cl.split('- [ ] **RLS y permisos:**')[1]?.split('- [ ] **Idempotencia y concurrencia:**')[0] || '';
 const gdod = dod.split('- [ ] **SEC-01, matriz de escrituras directas del admin:**')[1]?.split('- [ ] **SEC-01, pruebas:**')[0] || '';
 const concurrent = cl.split('- [ ] **Idempotencia y concurrencia:**')[1]?.split('- [ ] **Privacidad y exposición:**')[0] || '';
 const backfill = cl.split('- [ ] **Migración y backfill:**')[1]?.split('- [ ] **pgTAP:**')[0] || '';
 return {
  R01: paths.every(p=>permitted(t,p)),
  H05_check_grants: /policies de escritura \*\*administrativa\*\*/.test(gcl) &&
    /conserva los grants de tabla compartidos/.test(gcl) && /Excepción: `audit_log`/.test(gcl),
  H05_dod_grants: /policies de escritura \*\*administrativa\*\*/.test(gdod) &&
    /conserva los grants de tabla compartidos/.test(gdod) && /Excepción: `audit_log`/.test(gdod),
  H05_concurrency: ['accept_offer','admin_correct_courier_display_name',
    'admin_revoke_courier_consent','for update','CC-031','auditoría']
    .every(v=>concurrent.toLowerCase().includes(v.toLowerCase())),
  H05_backfill: /sin backfill/.test(backfill) &&
    /no modifica `merchants.notes`/.test(backfill) && /Lautaro073 corre a mano/.test(backfill),
  H05_CC: /policies de escritura \*\*privilegiada administrativa\*\*/.test(access) &&
    /profiles_update_self/.test(access) && /\*\*por columna privilegiada\*\*/.test(access)
 };
}
const base=checks(cc,task);
const missing=paths.filter(p=>!permitted(task,p));
console.log('BASE ' + JSON.stringify(base));
console.log('MISSING ' + missing.length + ' ' + JSON.stringify(missing));
const mutants=[
 ['R01',cc,task.replace('`supabase/tests/rpc_distance.sql`','`supabase/tests/{rpc_distance}.sql`'),'R01'],
 ['H05-check',cc,task.replace('conserva los grants de tabla compartidos que necesitan',
   'revoca los grants compartidos de tabla que necesitan'),'H05_check_grants'],
 ['H05-DoD',cc,task.replace('conserva los grants de tabla compartidos necesarios',
   'revoca los grants compartidos de tabla necesarios'),'H05_dod_grants'],
 ['H05-concurrency',cc,task.replace('y la\n      auditoría en la misma transacción',
   'sin registro en la misma transacción'),'H05_concurrency'],
 ['H05-backfill',cc,task.replace('**Migración y backfill:** sin backfill',
   '**Migración y backfill:** backfill automático'),'H05_backfill'],
 ['H05-CC',cc.replace('**por columna privilegiada**','**por tabla entera**'),task,'H05_CC']
];
let failed=0;
for (const [name,c,t,key] of mutants) {
 const observed=checks(c,t)[key], red=base[key] && !observed;
 console.log('MUTATION ' + name + ': ' + base[key] + ' -> ' + observed +
   ' ' + (red?'RED_DOCUMENTAL':'NO_DETECTADA'));
 if(!red)failed++;
}
if(!Object.values(base).every(Boolean))failed++;
console.log('RESULT ' + (failed?'FAIL':'PASS') + ' (solo documentación, no SQL runtime)');
if(failed)process.exitCode=1;
```

### Otros comandos de verificación del repo (no ejecutados por el revisor)

```bash
git fetch origin
git rev-parse HEAD
git diff --check origin/develop...origin/cc/CC-047-admin-hardening
git merge-tree --write-tree origin/develop origin/cc/CC-047-admin-hardening
node docs/revision-pr/analizar.mjs verificacion
```

**No usar un resultado de texto como evidencia de seguridad runtime.** La consulta D2 de la ronda 1 sigue siendo el paso manual de Lautaro073 al promover T-408, no un comando ejecutado durante la revisión.
