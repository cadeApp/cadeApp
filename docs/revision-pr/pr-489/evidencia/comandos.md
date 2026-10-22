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
