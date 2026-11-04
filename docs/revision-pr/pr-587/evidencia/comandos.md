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

---

## Ronda 2 — harness independiente de lectura/mutaciones de contratos

Se ejecutó con documentos traídos directamente de GitHub por conector, todos con `ref=2512a3735ff7ce10d67a0e846218a6f3e4e74e36`: **12 baseline GREEN y 12 RED cuando se eliminó en memoria la cláusula correspondiente**. No se ejecutó código SQL ni aplicación. Los siguientes controles son **de existencia textual**, no tests reales de conducta. No son evidencia suficiente para aprobar una migración.

Reproducción en clon del SHA, sin tocar archivos:
```bash
git fetch origin
git worktree add /tmp/wt-pr587-r2 2512a3735ff7ce10d67a0e846218a6f3e4e74e36
node /tmp/pr587-r2-document-controls.mjs /tmp/wt-pr587-r2
git worktree remove /tmp/wt-pr587-r2
```

Guardá este programa en `/tmp/pr587-r2-document-controls.mjs` (si no hay clon, no afirmes haberlo corrido). Lee solo documentos versionados; hace sustituciones **en memoria**.

```js
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2] ?? '.');
const paths={
  cc043:'docs/contracts/CC-043.md',
  cc044:'docs/contracts/CC-044.md',
  t421:'docs/tasks/T-421.md',
};
const doc=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,fs.readFileSync(path.join(root,p),'utf8')]));
const checks=[
  {
    "file": "cc043",
    "name": "RPC de servicio",
    "re": "grant execute … to service_role"
  },
  {
    "file": "cc043",
    "name": "guarda dual",
    "re": "current_setting('app.courier_application_finalize', true) = 'on'"
  },
  {
    "file": "cc043",
    "name": "fecha del primer envío",
    "re": "Solo la transición `false → true` fija la fecha"
  },
  {
    "file": "cc043",
    "name": "histórico sin fecha",
    "re": "un histórico devuelve `submittedAt: null` y sigue `null`"
  },
  {
    "file": "cc043",
    "name": "lectores auth",
    "re": "`updateSession`, `loginAction` y `updatePasswordAction` seleccionan `application_submitted`"
  },
  {
    "file": "cc043",
    "name": "CC-042",
    "re": "`finalize_courier_application` marca el envío"
  },
  {
    "file": "cc043",
    "name": "fixtures sin reset",
    "re": "pasan a usar un repartidor nuevo sin envío"
  },
  {
    "file": "cc043",
    "name": "backfill",
    "re": "`submitted_at` queda `null`"
  },
  {
    "file": "cc043",
    "name": "diagnóstico",
    "re": "`raise notice` con la **cantidad** de filas"
  },
  {
    "file": "cc044",
    "name": "pending",
    "re": "En `pending` se suma `c.application_submitted`"
  },
  {
    "file": "cc044",
    "name": "MFA directo",
    "re": "un admin `aal1` todavía puede leer nombres por PostgREST"
  },
  {
    "file": "t421",
    "name": "bypass del dueño",
    "re": "trigger sin la condición de dueño"
  }
];
let green=0, red=0;
for(const test of checks){
  const original=doc[test.file];
  const needle=test.re;
  const pass=original.includes(needle);
  // Reemplaza todas las copias exactas en memoria para no dar un falso verde por duplicados.
  const mutant=original.split(needle).join('[REMOVED_MUTANT]');
  const killed=pass && !mutant.includes(needle);
  console.log(test.name+': '+(pass?'GREEN':'FAIL')+' -> '+(killed?'RED':'BLIND'));
  if(pass) green++;
  if(killed) red++;
}
console.log('SUMMARY '+green+'/'+checks.length+' GREEN; '+red+'/'+checks.length+' RED');
if(green!==checks.length || red!==checks.length) process.exitCode=1;
```

### H08: caso real a probar en implementación

```sql
-- Después de la migración, como service_role, simular EXACTAMENTE
-- el UPDATE anterior de actions.ts sobre una cuenta recién registrada:
-- update couriers set dni_hmac=?, vehicle_type='moto', vehicle_plate='AB 123 CD'
-- where profile_id=? and status in ('pending','approved');
-- El pgTAP debe afirmar:
-- 1) o bien se produce un error del dominio, reintentable al deploy;
-- 2) o bien éxito Y application_submitted=true Y submitted_at real.
-- PROHIBIDO dar éxito con application_submitted=false.
```

### H09: tabla de casos que debe matar una mutación real

| Vehículo | Patente | Resultado esperado |
|---|---|---|
| moto | `AB 123 CD` | acepta |
| moto | `ABC 123` | acepta (vieja) |
| car | `A 123 BCD` | acepta |
| car | `123 ABC` | acepta |
| moto | `NOT_A_PLATE` | `VALIDATION_ERROR` |
| car | `null` | `VALIDATION_ERROR` |
| bike | `AB 123 CD` | `VALIDATION_ERROR` |
| walk | `AB 123 CD` | `VALIDATION_ERROR` |
| walk | `null` | acepta |

Mutación: quitar la validación SQL de patente e invalidar `pgTAP` por una aserción sobre el dato escrito, no por un `TypeError`. No adulterar tests, expectations, mocks ni fingir RED/GREEN.

---


## Ronda 3 — evidencia independiente sobre SHA a3fe70ee3336b65ffb2390044857afcf71430a09

**Ejecución realizada:** en el conector GitHub se leyeron CC-043, CC-044, T-421, T-403, T-404, la fila de plan y la bitácora; se comprobó el delta remoto R2→R3 (solo 3 documentos). Los 12 controles de consistencia documental fueron conformes.

**Checks en el modelo de los requisitos publicados** (NO SQL real):
- Patente: **13/13** casos correctos al ejecutar en JS el regex extraído **literalmente** del Markdown CC-043 tras normalizar; 4 casos fallaron con mutante que acepta cualquier patente no vacía.
- Guarda H08: **5/5** transiciones correctas según el predicado *descrito* en CC-043; 3 casos fallaron con mutante que quita el guard.
- No se ejecutó SQL ni pgTAP, no se arrancó Supabase ni se tocaron secretos; los tests declarados por el autor (91) no se reprodujeron.

**Harness íntegro, reproducible en un clon del SHA indicado:**
\`\`\`bash
git fetch origin
git worktree add /tmp/wt-pr587-r3 a3fe70ee3336b65ffb2390044857afcf71430a09
node /tmp/pr587-r3-contract-model.mjs /tmp/wt-pr587-r3
git worktree remove /tmp/wt-pr587-r3
\`\`\`

Guardar el siguiente programa completo como \`/tmp/pr587-r3-contract-model.mjs\`:
\`\`\`js
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2] ?? '.');
const cc=fs.readFileSync(path.join(root,'docs/contracts/CC-043.md'),'utf8');
const task=fs.readFileSync(path.join(root,'docs/tasks/T-421.md'),'utf8');
const ts=fs.readFileSync(path.join(root,'src/features/courier-onboarding/schemas.ts'),'utf8');
const regexLine=cc.split('\\n').find(x=>x.includes('[A-Z]{2}') && x.includes('[0-9]{3}'));
const pattern=regexLine?.match(/\x60(\^\([^\\x60]+\)\$)\x60/)?.[1];
if(!pattern) throw new Error('SQL plate regex not found in CC-043');
const plateRe=new RegExp(pattern);
const normalize=p=>p==null?null:(p.trim().toUpperCase()||null);
const validPlate=(type,raw)=>{
  const p=normalize(raw);
  return ['moto','car'].includes(type) ? (p!==null && plateRe.test(p)) :
    ['bike','walk'].includes(type) ? p===null : false;
};
const plateCases=[
  ['moto','AB 123 CD',true],['moto','A 123 BCD',true],
  ['moto','ABC 123',true],['moto','123 ABC',true],
  ['car','ab123cd',true],['car','abc123',true],
  ['car',null,false],['moto','NOT_A_PLATE',false],
  ['car','XX-999-ZZ',false],['bike','AB 123 CD',false],
  ['walk','AB 123 CD',false],['walk',null,true],['bike',null,true]
];
const mutantPlate=(t,p)=>['moto','car'].includes(t)?normalize(p)!==null:
  ['walk','bike'].includes(t)?true:false;
let greenPlate=0, redPlate=0;
for(const [type,p,want] of plateCases){
  if(validPlate(type,p)===want) greenPlate++;
  if(mutantPlate(type,p)!==want) redPlate++;
}
if(!cc.includes('Guarda de compatibilidad (fail-closed)') ||
   !cc.includes('INVALID_STATE_TRANSITION') ||
   !task.includes('guarda de compatibilidad:')) {
  throw new Error('The declared compatibility guard or DoD is missing');
}
const protectedByGuard=(old,n,authorized)=>
  !authorized && !old.application_submitted && !n.application_submitted &&
  n.dni_hmac!==null && n.vehicle_type!==null &&
  (old.dni_hmac!==n.dni_hmac || old.vehicle_type!==n.vehicle_type);
const h='a'.repeat(64);
const guardCases=[
  ['legacy-both-null',{application_submitted:false,dni_hmac:null,vehicle_type:null},
   {application_submitted:false,dni_hmac:h,vehicle_type:'moto'},true,false],
  ['legacy-hmac-preexisting',{application_submitted:false,dni_hmac:h,vehicle_type:null},
   {application_submitted:false,dni_hmac:h,vehicle_type:'moto'},true,false],
  ['legacy-vehicle-preexisting',{application_submitted:false,dni_hmac:null,vehicle_type:'moto'},
   {application_submitted:false,dni_hmac:h,vehicle_type:'moto'},true,false],
  ['CC042-vehicle-only',{application_submitted:false,dni_hmac:null,vehicle_type:null},
   {application_submitted:false,dni_hmac:null,vehicle_type:'moto'},false,false],
  ['authorized-finalization',{application_submitted:false,dni_hmac:null,vehicle_type:null},
   {application_submitted:true,dni_hmac:h,vehicle_type:'moto'},false,true]
];
let greenGuard=0, redGuard=0;
for(const [name,old,n,want,authorized] of guardCases){
  if(protectedByGuard(old,n,authorized)===want) greenGuard++;
  if(false!==want) redGuard++; // mutación que elimina la guarda
}
const claims=[
  cc.includes("un histórico devuelve \x60submittedAt: null\x60 y sigue \x60null\x60"),
  cc.includes("\x60current_user\x60 es el dueño de \x60finalize_courier_application\x60"),
  cc.includes("Guarda de compatibilidad (fail-closed)"),
  cc.includes("La guarda de compatibilidad lo rechaza"),
  cc.includes("Para \x60walk\x60 y \x60bike\x60 tiene que ser"),
  task.includes("guarda de compatibilidad:"),
  task.includes("patente: los cuatro formatos argentinos válidos"),
  ts.includes("ARGENTINA_PLATE_REGEX")
];
console.log({plate:{passed:greenPlate,total:plateCases.length,mutantRed:redPlate},
 guard:{passed:greenGuard,total:guardCases.length,mutantRed:redGuard},
 claims:{passed:claims.filter(Boolean).length,total:claims.length}});
if(greenPlate!==plateCases.length || greenGuard!==guardCases.length ||
   claims.some(x=>!x) || redPlate<1 || redGuard<1) process.exitCode=1;
\`\`\`

**Nota sobre el harness:** modela la condición en prosa del trigger, no extrae ni ejecuta un trigger SQL futuro. Una mutación de ese modelo es solo evidencia contra el modelo; pgTAP + mutaciones SQL reales quedan en el DoD de T-421.

**Para la PR posterior de implementación:**
\`\`\`bash
pnpm db:types
pnpm typecheck
pnpm lint
pnpm test
# pnpm test:db solo en CI, con evidencia de job + mutaciones RED
node docs/revision-pr/analizar.mjs verificacion
\`\`\`
No presentar estos comandos como ejecutados por la revisión de esta PR.
