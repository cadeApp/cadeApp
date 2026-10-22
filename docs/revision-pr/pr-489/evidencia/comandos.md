# Evidencia y comandos — PR #489, R1

## Referencias y alcance
- PR: https://github.com/cadeApp/cadeApp/pull/489
- HEAD: `25ad3cf36cf580bdc632448ad88d926220b1dec6`; base develop: `824c4fdb8a4277220e14b575eaf6a15e40df8406`.
- CI `39696803014` (`unit` job `119556048845`): `tools/verify-fichas.test.ts` falla 1/7; resumen general 1 failed, 3169 passed.
- Job `db-tests` success, sin levantar Supabase/Docker local. `e2e-preview` estado error tras cancelación, no prueba funcional roja.
- Archivos de la PR: `docs/implementation-plan.md`, `docs/tasks/T-400.md` ... `T-407.md`. No se modificaron archivos productivos.
- Inspección en develop: `src/features/admin/queries.ts`, `types.ts`, `schemas.ts`, `copy.ts`, `components/applicant-detail-view.tsx`, `src/features/incidents/schemas.ts`, migraciones SQL citadas en el informe.

## Comandos normales para un checkout real (no ejecutados localmente en esta sesión)
```bash
git fetch origin
git rev-parse origin/docs/T-400-407-fichas
git rev-parse origin/develop
git diff --stat origin/develop...origin/docs/T-400-407-fichas
git merge-tree --write-tree origin/develop origin/docs/T-400-407-fichas
pnpm exec vitest run tools/verify-fichas.test.ts
# Revisión tras arreglo documental:
node docs/revision-pr/analizar.mjs verificacion
```

## Control INDEPENDIENTE de consistencia documental
El harness completo siguiente compara las filas reales del plan con el primer DoD de cada ficha, sin tocar archivos del repo. En el HEAD actual debe dar **ROJO** para las ocho tareas; después de corregir plan/fichas, **VERDE**. También prueba su propia sensibilidad: introduce una mutación SOLO EN MEMORIA sobre cada DoD y exige que el detector vuelva a ROJO.

Copiar a `/tmp/pr489-check.mjs` y ejecutarlo desde la raíz del repo con Node:

```bash
cat > /tmp/pr489-check.mjs <<'NODE'
import fs from 'node:fs';
import assert from 'node:assert/strict';

const tasks = [400, 401, 402, 403, 404, 405, 406, 407];
const plan = fs.readFileSync('docs/implementation-plan.md', 'utf8').replace(/\r\n/g, '\n');
const rows = new Map();
for (const line of plan.split('\n')) {
  const m = line.match(/^\|\s*(T-\d+)\s*\|/);
  if (m) rows.set(m[1], line.split('|').map(s => s.trim())[6]);
}
function firstDod(contents) {
  const section = contents.split('\n## DoD\n')[1];
  assert.ok(section, 'Falta ## DoD');
  const m = section.match(/^- \[[ x]\] (.*)$/m);
  assert.ok(m, 'Falta primer checklist');
  return m[1].trim();
}
function compare(expected, text) { return expected === firstDod(text); }
const broken = [];
for (const n of tasks) {
  const id = 'T-' + n;
  const contents = fs.readFileSync('docs/tasks/' + id + '.md', 'utf8').replace(/\r\n/g, '\n');
  const expected = rows.get(id);
  assert.ok(expected, 'No existe fila del plan: ' + id);
  if (!compare(expected, contents)) broken.push(id);
  const mutated = contents.replace(/^- \[[ x]\] /m, '- [ ] MUTACION_MEMORIA_');
  assert.equal(compare(expected, mutated), false, 'CONTROL CIEGO: ' + id);
}
console.log('REPRODUCCION: ' + (broken.length ? 'RED' : 'GREEN') + ' fichas desincronizadas=' + broken.join(','));
console.log('MUTACIONES: ' + tasks.length + '/' + tasks.length + ' RED detectados en memoria');
if (broken.length) process.exitCode = 1;
NODE
node /tmp/pr489-check.mjs
```

No se ejecutó el script contra un clon local: el ambiente disponible no resolvió `github.com`. La línea de fallo del test oficial sí se inspeccionó desde los logs del runner en el mismo SHA. No se falsifica una corrida local ni se dejan mutaciones en la rama.

## Hallazgos estáticos para verificar en la siguiente ronda
1. T-400: enumerar acciones SQL **incluidas acciones p_action dinámicas**, tipos de entidad y etiquetas, sin N+1 ni filtración de motivo libre.
2. T-402/403: comprobar archivo E2E nuevo en rutas permitidas.
3. T-403: enlaces a #498 y #499, sin tratar esas capacidades como existentes.
4. T-404: eventos de `audit_log` reales más fechas de `profiles`/#499 explícitas; visor existente preservado.
5. T-405: auditoría por `target_id`, lectura con RLS y enlaces filtrados; no SELECT directo a merchant_plan_periods.
6. T-406: conjunto exacto open+reviewing/resolved/dismissed para tres pestañas.
7. T-407: `gte` inicio local y `lt` siguiente inicio local; prueba microsegundos.

## Ronda 2 — HEAD `be515ec74e9f0da54e4f5f709c247250251db840` — lectura 2026-10-21

- GitHub compare `60e1f249...be515ec7`: 11 archivos cambiados (10 fichas + plan), **0 cambios a `docs/revision-pr/pr-489/**`**. PR mantiene 16 archivos contra develop porque la carpeta de revisión se agregó en R1.
- `docs/tasks/log/T-312.md` está en PR #491, rama `feat/T-312-release-checklist`, SHA `81d3266e`, **no en develop**. CC-036/T-390/T-391 están en PR #497, SHA `74ba30a0`, **no mergeados**.
- Comprobación propia ejecutada con GitHub connector, contenido de las 10 fichas del SHA: igualdad primer DoD con celda 6 del plan = `10/10`; mutar en memoria el PRIMER ítem de `## DoD` de cada ficha = `10/10` detectadas (sin tocar archivos). Un intento preliminar atacó inadvertidamente un checkbox anterior al DoD en T-408: detectó 9/10. Se descartó como fallo del *harness*, corrigió el ancla a `## DoD` y se repitió: 10/10. **No ocultar esta discrepancia**.
- Job CI `119569612551` del SHA R2: `tools/verify-fichas.test.ts (7 tests) ✅`; `Test Files 155 passed (155)`; `Tests 3170 passed (3170)`. URL: https://github.com/cadeApp/cadeApp/actions/runs/39700774152 .
- El estado de `db-tests` se consultó y estaba en progreso durante el análisis, por lo que no se declara como verde; este PR no edita SQL.

### Harness reproducible (en /tmp, no dentro del repo)
Ejecutar desde la raíz de un checkout del SHA `be515ec74e9f0da54e4f5f709c247250251db840`, creando solo este archivo fuera del repo:

```bash
cat > /tmp/pr489-r2-check.mjs <<'NODE'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const ids = Array.from({length: 10}, (_,i) => 'T-' + (400+i));
const plan = fs.readFileSync('docs/implementation-plan.md','utf8').replace(/\r\n/g,'\n');
const byId = new Map(plan.split('\n').filter(l=>/^\|\s*T-\d+/.test(l)).map(l=>{
  const id = l.match(/^\|\s*(T-\d+)/)[1];
  return [id, l.split('|').map(s=>s.trim())[6]];
}));
const getDoD = text => {
  const s=text.match(/(?:^|\n)## DoD\n([\s\S]*?)(?=\n## |$)/);
  assert.ok(s, 'No ## DoD');
  const m=s[1].match(/^- \[[ x]\] (.+)$/m);
  assert.ok(m, 'Falta primer ítem del DoD');
  return {block:s[1], first:m[1].trim()};
};
let ok=0, reds=0;
for (const id of ids) {
  const raw=fs.readFileSync('docs/tasks/'+id+'.md','utf8').replace(/\r\n/g,'\n');
  const expected=byId.get(id);
  assert.ok(expected,'Sin fila '+id);
  const {block,first}=getDoD(raw);
  if (first===expected) ok++;
  const tampered=block.replace(/^- \[[ x]\] (.+)$/m,(_,s)=>'- [ ] MUTADO_'+s);
  const mutated=tampered.match(/^- \[[ x]\] (.+)$/m)?.[1]?.trim();
  if (mutated!==expected) reds++;
}
console.log('BASE '+ok+'/'+ids.length+' DoD=plan');
console.log('MUTATIONS '+reds+'/'+ids.length+' independent red');
assert.equal(ok,ids.length);
assert.equal(reds,ids.length);
NODE
node /tmp/pr489-r2-check.mjs
```

Esperado (comprobado por comparación de contenido en la revisión): `BASE 10/10 DoD=plan` y `MUTATIONS 10/10 independent red`. **El script como archivo Node no se ejecutó en un checkout**, porque el repositorio se inspeccionó por API; no confundir su salida esperada con log de ejecución local.

### Validaciones futuras de las fichas
- T-408 SEC-01: pgTAP WRITE directo como admin aal1 y aal2 denegados en tablas RPC-owned, mientras RPC admin en aal2 inserta auditoría.
- T-408 SEC-02: pgTAP revokes INSERT/UPDATE/DELETE/TRUNCATE y trigger anti-UPDATE/DELETE; acción viewCourierDocumentAction service-role inserta audit.
- T-408 SEC-11: probar que el comercio con SELECT de merchants NO obtiene `admin_notes`; evidencia de notes con autor verificable antes de migrar.
- T-405: añadir `action` a filtro SQL **antes** de limit 5; pruebas con merchant_profile_update/admin_grant_publication_credits intercaladas.
- T-409: comprobar que al dividir en tasks hijas los paths nuevos están autorizados en sus PR separados; no crear docs/contracts/** sin CC.

### Actualización de estados del SHA be515ec7
- CI #39700774152 terminó `success`, con todos sus jobs en verde. `unit`: 155 archivos / 3170 tests, incluidos 7/7 verify-fichas. `db-tests`: `Files=34, Tests=3019`, `Result: PASS` (job 119569612666); finalizó el control de tipos sin diff. Estas evidencias pertenecen al SHA `be515ec7`, no a los commits de informe.
- `e2e-preview` context `error`: run #39700908423, `repository_dispatch`, job e2e-preview `cancelled`, no aserción roja. No rerun manual durante la revisión.

## Ronda 3 — HEAD `3a70d5561624d30382bbb48b407ceaea9514c1a0` (21/10/2026 Argentina)

### Comparación y CI
- Compare `c3715379ae4174842a3733ec3fd6274be8f7d11e..3a70d5561624d30382bbb48b407ceaea9514c1a0`: un commit del autor; 4 archivos cambiados únicamente: T-405, T-408, T-409, implementation-plan. Carpeta `docs/revision-pr/pr-489/**` sin alteraciones.
- `develop` avanzó a `3db48fbcf9fdebf58648411f8e312a2d94298af3` por merge de PR #497. PR #491 (T-312) aún abierta.
- CI run `39705887020` para `3a70d5561624d30382bbb48b407ceaea9514c1a0`: todos sus jobs terminados success. Unit: `tools/verify-fichas.test.ts (7 tests)` y `Test Files 155 passed`, `Tests 3170 passed`. DB: job `119585708030` muestra `Files=34, Tests=3019`, `Result: PASS` y paso de control `git diff --exit-code -- src/types/database.types.ts`.
- Vercel success en el SHA. Run e2e-preview `39706002645` tuvo `conclusion=cancelled`; status GitHub `error`, sin evidencia de aserción E2E.
- Approval-policy fallo previo: logs de jobs `119585709059` y `119587843306` indican literalmente `Falta el informe completo de revisar-pr sin bloqueantes.`; el script exige sección `### Informe de revisión de agy` y `Resultado: SIN BLOQUEANTES` en el cuerpo de la PR. El revisor añadió ese informe sin engañar sobre tests locales.

### Verificaciones independientes sobre la documentación
- Lee `docs/tasks/T-400.md` ... `T-409.md` y `docs/implementation-plan.md` del SHA `3a70d5561624d30382bbb48b407ceaea9514c1a0`; todas las 10 primeras entradas de `## DoD` coinciden con la columna DoD (celda 6) de su fila del plan.
- Cada ítem fue mutado **solo en memoria**, alterando el primer `- [ ]` dentro de `## DoD`, no otro checkbox: 10/10 controles detectaron el cambio. En la rama no se aplicó ninguna mutación.
- Para H13–H18 se extrajo `## DoD` y se verificaron cláusulas específicas:
  H13 SEC-01, AAL1/AAL2 con RPC auditada; H14 SEC-11, grants, backfill, select *; H15 SEC-02, revoke/trigger/TRUNCATE; H16 plan action SQL; H17 PR separadas; H18 Realtime y CHECK. Mutar la cláusula correspondiente exclusivamente en memoria hizo fallar la aserción.
- No se ejecutó un test SQL de bypass contra Supabase para estos futuros CC porque **esta PR no implementa las mitigaciones**; ese trabajo queda para T-408 y sus hijas.

### Script reproducible de control documental para checkout del SHA
Guardar en `/tmp/pr489-r3-check.mjs` y ejecutar desde raíz del repo. No escribe archivos de proyecto ni altera expectations:

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = 'docs/tasks/';
const normalize = s => s.replace(/\r\n/g, '\n');
const plan = normalize(fs.readFileSync('docs/implementation-plan.md','utf8'));
const rows = new Map(
  plan.split('\n').filter(x => /^\|\s*T-\d+\s*\|/.test(x))
    .map(line => [line.match(/^\|\s*(T-\d+)/)[1],line.split('|').map(z => z.trim())[6]])
);
const load = n => normalize(fs.readFileSync(root + 'T-' + n + '.md','utf8'));
const dod = n => {
  const part = load(n).match(/(?:^|\n)## DoD\n([\s\S]*?)(?=\n## |$)/);
  assert.ok(part, 'Missing DoD '+n);
  return part[1];
};
for (let n=400; n<=409; n++){
  const s=dod(n), actual=s.match(/^- \[[ x]\] (.+)$/m)?.[1]?.trim();
  const expected=rows.get('T-'+n);
  assert.ok(expected, 'Missing plan row '+n);
  assert.equal(actual,expected,'DoD mismatch '+n);
  const mutated=s.replace(/^- \[[ x]\] (.+)$/m,(_,v)=>'- [ ] MUTATED_'+v);
  assert.notEqual(mutated.match(/^- \[[ x]\] (.+)$/m)?.[1]?.trim(),expected,'Blind first DoD '+n);
}
const checks=[
 [408, /- \[ \] \*\*SEC-01, pruebas:\*\*[^\n]*JWT de admin `aal1` y `aal2`[^\n]*UPDATE directo[^\n]*RPC correspondiente con `aal2`[^\n]*Mutación:/m, /- \[ \] \*\*SEC-01, pruebas:\*\*[^\n]*\n/m],
 [408, /- \[ \] \*\*SEC-11, nota interna aislada:\*\*[^\n]*tabla separada `merchant_admin_notes`[^\n]*Backfill solo con procedencia verificable[^\n]*`select \*`[^\n]*Mutación:/m, /- \[ \] \*\*SEC-11, nota interna aislada:\*\*[^\n]*\n/m],
 [408, /- \[ \] \*\*SEC-02, `audit_log` inmutable para clientes:\*\*[^\n]*`revoke insert, update, delete, truncate on public\.audit_log from anon, authenticated`[^\n]*trigger `before update or delete`[^\n]*incluido TRUNCATE; mutación:/m, /- \[ \] \*\*SEC-02, `audit_log` inmutable para clientes:\*\*[^\n]*\n/m],
 [405, /- \[ \] \*\*Últimos movimientos\*\*:[^\n]*`action in \('admin_set_subscription', 'admin_register_plan_period'\)`[^\n]*filtrados en la base \*\*antes\*\* de ordenar y limitar a 5/m, /`action in \('admin_set_subscription', 'admin_register_plan_period'\)`/m],
 [409, /- \[ \] \*\*Sin escrituras fuera de alcance:\*\*[^\n]*[Cc]ada ficha hija[^\n]*propia PR documental[^\n]*fila del plan y su issue/m, /- \[ \] \*\*Sin escrituras fuera de alcance:\*\*[^\n]*\n/m],
 [409, /- \[ \] \*\*SEC-12:\*\* su CC exige primero la captura de Realtime[^\n]*regresión del flujo real del cambio en efectivo[^\n]*ningún CHECK de `null`/m, /- \[ \] \*\*SEC-12:\*\*[^\n]*\n/m]
];
for(const [n,check,mutation] of checks){
  const s=dod(n), mutated=s.replace(mutation,'');
  assert.ok(check.test(s),'Missing requirement '+n);
  assert.notEqual(mutated,s,'Blind mutation '+n);
  assert.equal(check.test(mutated),false,'Mutation missed '+n);
}
console.log('PASS first-DoD/plan: 10/10; first-DoD mutations: 10/10');
console.log('PASS H13–H18 documentary controls: 6/6; negative mutations: 6/6');
```

**Nota:** este script de Node se deja para repetir en checkout real; el revisor ejecutó el mismo contraste sobre los contenidos recuperados vía GitHub (sin clon local). No declarar salida local de `node /tmp/...` como si se hubiera ejecutado.
