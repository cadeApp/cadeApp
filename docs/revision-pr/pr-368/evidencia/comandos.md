# Evidencia reproducible — PR #368 / T-354 — Ronda 1

## Hechos verificados por consultas de solo lectura a GitHub
- Pull request `#368`, HEAD de autor `83734650a04cc438ce117772419f2f3a61142083`, 1 archivo modificado: `docs/tasks/log/T-354.md` (+13).
- La bitácora confirma tests RED pendientes y que no hay implementación de copy.
- Comparación con develop: 2 commits delante / 4 detrás en la consulta. Nota: develop es móvil.
- Ficha desde develop: inicialmente no autorizaba `src/features/offers/courier-panel.test.tsx`.
- Luego se registró la decisión explícita (1-A, 2-B, 3-A) en el commit documental `8316ea4f25a5e02b8db1e1c78a0efafb1d96e960`.

**No se corrió ningún comando local de suite ni de mutación** en esta sesión: Git remoto accesible mediante conector de GitHub, pero no hay clon ejecutable con dependencias. No representar estos comandos como resultados obtenidos.

## Cómo reproducir la ausencia de implementación inicial (solo lectura)

```bash
git fetch origin
git diff --name-status 14c28ed3c41cb2bde92705fc018c7dd0df73245b...83734650a04cc438ce117772419f2f3a61142083
git show 83734650a04cc438ce117772419f2f3a61142083:docs/tasks/log/T-354.md
git show 14c28ed3c41cb2bde92705fc018c7dd0df73245b:src/features/courier-onboarding/copy.ts | grep -F "Selfie de validación"
git show 14c28ed3c41cb2bde92705fc018c7dd0df73245b:src/features/courier-onboarding/components/status-view.tsx | grep -F "Selfie de seguridad"
```

**Resultado esperado al ejecutar (no ejecutado localmente):** diff solo bitácora y coincidencias de texto viejo.

## Comandos para la próxima ronda, cuando exista implementación (pendientes)

```bash
git fetch origin
git ls-remote origin feat/T-354-unificar-texto-selfie-dni
git diff --name-status origin/develop...origin/feat/T-354-unificar-texto-selfie-dni
git merge-tree --write-tree origin/develop origin/feat/T-354-unificar-texto-selfie-dni
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx src/features/offers/courier-panel.test.tsx src/features/admin/components/applicant-detail-view.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

La próxima revisión debe añadir y **ejecutar** una batería propia de mutaciones RED→GREEN en un worktree temporal limpio sobre el nuevo SHA, guardar aquí el harness completo y comprobar que el control lo detecta. Hoy sería incorrecto inventar una batería «pasada» sobre código que aún no existe. No levantar Docker/Supabase local; si no hay CC servidor, test:db n.a. E2E Preview contra Develop solo si su ejecución está autorizada por el flujo preexistente.


## Ronda 2 — Inspección y mutaciones INDEPENDIENTES (2026-10-15)

Se consultaron 8 archivos de código/test de GitHub, sobre SHA `b94c683756b3f37b3574d6691f95b2557c030416`, y se ejecutaron controles JavaScript puros **en el proceso de consulta conectado a GitHub** (no contra un clon local). Resultado observado: **11/11 reglas de fuente GREEN**; **10/10 mutaciones propias sobre copias in-memory detectadas**. Las dos construcciones prohibidas se confirmaron por lectura directa: `(globalThis as any).React = React` y `describedById!`. La primera comprobación regex se rechecó con igualdad exacta al advertir un escape incorrecto; resultado confirmado.

**Importante:** lo anterior demuestra invariantes *estáticos*, no sustituye los 9 tests Vitest mutados que el autor afirma ni una captura visual. No se ejecutó `pnpm` ni se conectó a Supabase/Vercel desde esta sesión.

### Harness completo para ejecutar en un clon limpio (equivalente a los controles JavaScript ejecutados en memoria)

Copiar el siguiente bloque, entero, a `/tmp/pr368-r2-static.mjs` y ejecutar `node /tmp/pr368-r2-static.mjs` desde la raíz del repositorio en el SHA revisado. No modifica archivos. La traducción a script Node queda reproducible; en esta sesión se comprobó la lógica in-memory sobre los contenidos remotos y **no** se afirma haber ejecutado este archivo concreto en un clon:

```js

// Ronda 2 — ejecutar con node /tmp/pr368-r2-static.mjs desde la raíz de cadeApp.
// NO modifica fuentes: las mutaciones ocurren únicamente sobre copias en memoria.
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const paths = {
  copy:'src/features/courier-onboarding/copy.ts',
  status:'src/features/courier-onboarding/components/status-view.tsx',
  profile:'src/features/courier-onboarding/components/courier-profile-view.tsx',
  card:'src/features/courier-onboarding/components/document-upload-card.tsx',
  admin:'src/features/admin/copy.ts',
  courierTest:'src/features/courier-onboarding/components.test.tsx',
  adminTest:'src/features/admin/components/applicant-detail-view.test.tsx',
  crossTest:'src/features/offers/courier-panel.test.tsx'
};
const S=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,fs.readFileSync(path.join(root,v),'utf8')]));
const instruction='Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones';
const controls=[
['C1-titulo-real',q=>/selfieTitle:\s*'Selfie con el DNI'/.test(q.copy)],
['C2-instruccion',q=>q.copy.includes("'" + instruction + "'")],
['C3-estado',q=>/title:\s*COURIER_ONBOARDING_COPY\.selfieTitle,\s*status:\s*selfieStatus/.test(q.status)],
['C4-perfil',q=>/\{COURIER_ONBOARDING_COPY\.selfieTitle\}/.test(q.profile)],
['C5-admin-detalle',q=>/selfie:\s*'Selfie con el DNI'/.test(q.admin)],
['C6-admin-badge',q=>/selfieBadge:\s*'Selfie con el DNI'/.test(q.admin)],
['C7-file-input',q=>/type="file"\s+aria-label=\{title\}/.test(q.card)],
['C8-multilinea',q=>/status === 'error' \|\| kind === 'selfie'\s*\?\s*'whitespace-normal break-words'/.test(q.card)],
['C9-estado-pending-preservado',q=>/rowOf\(\/Selfie con el DNI\/\)\?\.textContent\)\.toContain\('Pendiente'\)/.test(q.crossTest)],
['C10-descripcion-DOM',q=>q.courierTest.includes('expect(describedNode?.textContent).toBe(instructionText)')],
['C11-admin-DOM',q=>q.adminTest.includes('screen.getByText(/Selfie con el DNI\\s*✓/)')&&q.adminTest.includes("expect(selfieTab?.textContent).toContain('Selfie con el DNI')")]
];
const mutations=[
['M1-titulo','copy',"selfieTitle: 'Selfie con el DNI'","selfieTitle: 'Selfie de validación'",'C1-titulo-real'],
['M2-instruccion','copy',instruction,'Rostro y DNI legibles','C2-instruccion'],
['M3-estado','status','title: COURIER_ONBOARDING_COPY.selfieTitle, status: selfieStatus',"title: 'Selfie de seguridad', status: selfieStatus",'C3-estado'],
['M4-perfil','profile','{COURIER_ONBOARDING_COPY.selfieTitle}','Selfie de identidad','C4-perfil'],
['M5-admin-detalle','admin',"selfie: 'Selfie con el DNI'","selfie: 'Selfie con DNI'",'C5-admin-detalle'],
['M6-admin-badge','admin',"selfieBadge: 'Selfie con el DNI'","selfieBadge: 'Selfie'",'C6-admin-badge'],
['M7-input','card','aria-label={title}','aria-label="Selfie"','C7-file-input'],
['M8-multilinea','card',"? 'whitespace-normal break-words'","? 'truncate'",'C8-multilinea'],
['M9-pending','crossTest',"expect(rowOf(/Selfie con el DNI/)?.textContent).toContain('Pendiente');","expect(rowOf(/Selfie con el DNI/)?.textContent).toBeDefined();",'C9-estado-pending-preservado'],
['M10-descripcion','courierTest','expect(describedNode?.textContent).toBe(instructionText);','expect(describedNode).not.toBeNull();','C10-descripcion-DOM']
];
const failed=[];
for (const [id,fn] of controls){if(!fn(S))failed.push('BASE '+id);}
let detected=0;
for (const [id,key,from,to,expected] of mutations){
  if(!S[key].includes(from)){failed.push('OBJETIVO AUSENTE '+id);continue;}
  const q={...S,[key]:S[key].replace(from,to)};
  const rule=controls.find(x=>x[0]===expected)?.[1];
  if(!rule || rule(q)){failed.push('CONTROL CIEGO '+id);}else{detected++;}
}
const forbidden=[
["any-global",/\(globalThis as any\)\.React = React;/.test(S.adminTest)],
["non-null-DOM",/getElementById\(describedById!\)/.test(S.courierTest)]
];
console.log('Baselines',controls.length-failed.filter(x=>x.startsWith('BASE')).length,'/',controls.length);
console.log('Mutaciones detectadas',detected,'/',mutations.length);
console.log('Prohibiciones actuales',forbidden);
for(const f of failed)console.error(f);
if(failed.length)process.exitCode=1;

```

### Tests originales y validación siguiente (no ejecutados por esta revisión)

```bash
git fetch origin
git merge-tree --write-tree origin/develop origin/feat/T-354-unificar-texto-selfie-dni
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx src/features/offers/courier-panel.test.tsx src/features/admin/components/applicant-detail-view.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

### CI leído del mismo SHA

- `unit`: log con `Test Files 130 passed (130)` y `Tests 2172 passed (2172)` (job 116265009597).
- `lint`: `✔ No ESLint warnings or errors` (job 116265009279); su subpaso `format:check` dio warnings y no bloqueó. No representa violación grave de esta PR en sí.
- `typecheck`, `build`, `audit`, `bundle-budget`: success a la consulta; `db-tests`: in_progress, `approval-policy`: failure (falta informe en body); E2E Preview: sin corrida asociada verificada.

### Reproducción pendientísima de autor

Los 9 RED de KiraK72 están únicamente **declarados como sumarios** en bitácora. Falta harness con mutaciones en código real + salidas RED reales de Vitest para reproducirlos sin confiar en el autor. Ronda siguiente deberá ejecutar sus controles originales (GREEN) y mutarlos independientemente (RED), no inventar el resultado. Ver H02.

## Ronda 3 — SHA 0acb5a7e975638d128921851fc39cc39e3f30f45

Consulta de 9 archivos por conector; ejecución directa en JavaScript sobre los contenidos remotos, sin escribir sobre el repositorio. **14 controles GREEN y 14 mutaciones propias sobre copias de memoria detectadas**; NO es Vitest runtime. Script completo equivalente para un worktree en SHA fijado:

```js
// Ejecutar en un worktree limpio sobre el SHA indicado: node /tmp/pr368-r3.mjs
// INSPECCION ESTATICA: muta strings en memoria; NO ejecuta Vitest/Playwright.
import fs from 'node:fs';
const files={
 copy:'src/features/courier-onboarding/copy.ts',
 status:'src/features/courier-onboarding/components/status-view.tsx',
 profile:'src/features/courier-onboarding/components/courier-profile-view.tsx',
 card:'src/features/courier-onboarding/components/document-upload-card.tsx',
 admin:'src/features/admin/copy.ts',
 test:'src/features/courier-onboarding/components.test.tsx',
 adminTest:'src/features/admin/components/applicant-detail-view.test.tsx',
 queue:'src/features/admin/components/applicants-queue.tsx',
 cross:'src/features/offers/courier-panel.test.tsx'
};
const src=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,fs.readFileSync(p,'utf8')]));
const instruction='Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones';
const cases=[
 ['title','copy',"selfieTitle: 'Selfie con el DNI'","selfieTitle: 'Selfie de validación'"],
 ['subtitle','copy',instruction,'Rostro y DNI legibles'],
 ['status','status','COURIER_ONBOARDING_COPY.selfieTitle, status: selfieStatus',"'Selfie de seguridad', status: selfieStatus"],
 ['profile','profile','{COURIER_ONBOARDING_COPY.selfieTitle}','Selfie de identidad'],
 ['detail','admin',"selfie: 'Selfie con el DNI'","selfie: 'Selfie con DNI'"],
 ['badge','admin',"selfieBadge: 'Selfie con el DNI'","selfieBadge: 'Selfie'"],
 ['wrap','card',"status === 'error' || kind === 'selfie'","status === 'error'"],
 ['aria','card','aria-label={title}','aria-label="Selfie"'],
 ['pending','cross',"rowOf(/Selfie con el DNI/)?.textContent).toContain('Pendiente')","rowOf(/Selfie con el DNI/)?.textContent).toBeDefined()"],
 ['noAny','adminTest',"import React from 'react';","import React from 'react';\n(globalThis as any).React = React;"],
 ['noBang','test','getElementById(describedById)','getElementById(describedById!)'],
 ['react','queue',"import * as React from 'react';",''],
 ['ariaTest','test','expect(describedNode?.textContent).toBe(instructionText);','expect(describedNode).not.toBeNull();'],
 ['adminTest','adminTest',"expect(selfieTab?.textContent).toContain('Selfie con el DNI');","expect(selfieTab).toBeDefined();"]
];
const verify=(key,s)=>key==='noAny'?!s.adminTest.includes('(globalThis as any).React = React;')
:key==='noBang'?!s.test.includes('getElementById(describedById!)')
:key==='react'?s.queue.includes("import * as React from 'react';")
:s[({ariaTest:'test',adminTest:'adminTest'})[key]||cases.find(x=>x[0]===key)[1]]
.includes(cases.find(x=>x[0]===key)[2]);
let green=0,red=0;
for(const [k,f,from,to] of cases){
 if(!src[f].includes(from))throw Error('MUTANT TARGET MISSING: '+k);
 if(!verify(k,src))throw Error('BASELINE RED: '+k);
 green++;
 if(verify(k,{...src,[f]:src[f].replace(from,to)}))throw Error('MUTANT UNDETECTED: '+k);
 red++;
}
console.log('GREEN',green,'/',cases.length,' MUTANTS DETECTED',red,'/',cases.length);

```

CI de SHA exacto: unit job 116281255834: Test Files 131 passed (131), Tests 2209 passed (2209). DB job 116281255838: Files=22 Tests=2205 Result PASS. e2e-preview commit status pending con run 38692469970. Run 38687321259 del SHA viejo cancelado. Approval-policy requiere aprobación formal de Lautaro073 (según log y regla actual, NO informe de texto).

No se ejecutaron comandos en Vercel, Supabase ni git clone; no se visualizaron capturas scratch. No declarar e2e verde sin status success. No se corrieron RED de Vitest del autor en esta sesión.

## Ronda 4 — reproducción independiente sobre SHA 20392c26a3f2dbdef41f75984b925af43dc65021

### Harness defectuoso: experimento hermético realmente ejecutado

```bash
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf 'original\n' > "$tmp/source.txt"
cat > "$tmp/demo.mjs" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const root = process.cwd();
const m = {id:'demo',file:'source.txt',target:'original',replacement:'mutant',testCmd:'node -e "process.exit(0)"'};
const filePath = path.join(root,m.file);
const originalContent = fs.readFileSync(filePath,'utf8');
if(!originalContent.includes(m.target))throw Error('target missing');
try {
  fs.writeFileSync(filePath,originalContent.replace(m.target,m.replacement),'utf8');
  execSync(m.testCmd,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']});
  throw new Error('Expected mutation demo to fail!');
} catch(err) {
  // Same generic catch as author: treats a surviving mutant as RED.
} finally {
  fs.writeFileSync(filePath,originalContent,'utf8');
}
execSync(m.testCmd,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']});
console.log('HARNESS_EXITED_SUCCESS; TEST_WAS_ALWAYS_GREEN; RESTORED='+fs.readFileSync(filePath,'utf8').trim());
JS
(cd "$tmp" && node demo.mjs)
# Observed: HARNESS_EXITED_SUCCESS; TEST_WAS_ALWAYS_GREEN; RESTORED=original
```

**Resultado observado con exit 0:** `HARNESS_EXITED_SUCCESS; TEST_WAS_ALWAYS_GREEN; RESTORED=original`.
Este es un control negativo: el comando es SIEMPRE GREEN, y el harness incorrecto debió detectar que ningún RED ocurrió. No usó código privado, DB, GitHub, ni alteró el árbol de cadeApp.

### Checks oficiales leídos (del SHA exacto)

- GitHub `unit` job 116289562284: 131 Vitest files y 2230 tests passed. `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: success.
- `db-tests` job 116289562303: `Files=22, Tests=2205, Result: PASS`, sin atribuir ese control al copy de T-354.
- `e2e-preview`: commit status SHA 20392c26 success y run 38695142292, intento 2, job 116302712269: `76 passed (20.4m)` Chromium y `3 passed (1.0m)` global-settings.
- Reviews: @Lautaro073 APPROVED sobre 20392c26 a las 07:58:46Z; dos jobs recientes approval-policy success.
- Artefactos del run 38695142292: `playwright-report` id 11955984022; no se obtuvo enlace a capturas mobiles indicadas como `mobile-verification.md`.
- El contenedor no puede resolver github.com: `git ls-remote` falló DNS; no se corrió `pnpm` local, `git merge-tree` ni E2E nuevo. La ejecución propia fue solo el control negativo del harness.

## Ronda 5 — 2026-10-15 — SHA e97323fe2290a33dec2152ab1b0020037d327a5f

### Experimento independiente realmente ejecutado (Node, sin repo)

Se reprodujo la lógica nueva del harness publicado por Kira en `docs/tasks/log/T-354.md` sobre una copia temporal que muta `source.txt`. Se comprobó GREEN inicial, RED (fallo esperado) y GREEN restaurado, y dos casos negativos. Para reproducir copiar todo el siguiente código a `/tmp/check_harness_t354.mjs` y ejecutar `node /tmp/check_harness_t354.mjs`:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'t354-harness-review-'));
const filePath=path.join(root,'source.txt');
fs.writeFileSync(filePath,'expected-content');
function runVitest(cmd){
 try {const stdout=execSync(cmd,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});return {code:0,output:stdout}}
 catch(e){if(typeof e.status!=='number')throw e;return {code:e.status,output:String(e.stdout??'')+'\n'+String(e.stderr??'')}}
}
function validate(cmd){
 const original=fs.readFileSync(filePath,'utf8');
 if(!original.includes('expected-content'))throw Error('Missing target');
 const initial=runVitest(cmd);
 if(initial.code!==0||!/Tests\s+\d+\s+passed/.test(initial.output))throw Error('Control GREEN inicial ausente');
 let mutated;
 try {fs.writeFileSync(filePath,original.replace('expected-content','mutant'),'utf8');mutated=runVitest(cmd)}
 finally {fs.writeFileSync(filePath,original,'utf8')}
 if(mutated.code!==1||!/Tests\s+\d+\s+failed/.test(mutated.output))throw Error('Mutante sobreviviente o fallo no atribuible a test: exit='+mutated.code);
 const restored=runVitest(cmd);
 if(restored.code!==0||!/Tests\s+\d+\s+passed/.test(restored.output))throw Error('GREEN tras restaurar ausente');
 return 'DETECTED';
}
const cases={
 'always-green-vitest-looking':`node -e "console.log('Tests 1 passed (1)')"`,
 'invalid-command':'comando_que_no_existe_12345',
 'real-red-green-dummy':`node -e "const fs=require('fs');const s=fs.readFileSync('source.txt','utf8');if(s==='mutant'){console.log('Tests 1 failed (1)');process.exit(1)}console.log('Tests 1 passed (1)')"`,
};
try {
 for(const [name,cmd] of Object.entries(cases)){
  try{const r=validate(cmd);console.log(name+' RESULT='+r+' CLEAN='+fs.readFileSync(filePath,'utf8'))}
  catch(e){console.log(name+' RESULT=REJECTED reason='+e.message+' CLEAN='+fs.readFileSync(filePath,'utf8'))}
 }
} finally {fs.rmSync(root,{recursive:true,force:true})}
```

**Salida observada real:**

```text
always-green-vitest-looking RESULT=REJECTED reason=Mutante sobreviviente o fallo no atribuible a test: exit=0 CLEAN=expected-content
invalid-command RESULT=REJECTED reason=Control GREEN inicial ausente CLEAN=expected-content
real-red-green-dummy RESULT=DETECTED CLEAN=expected-content
```

Este harness demuestra que la lógica corregida no crea falsos RED ante un mutante sobreviviente y restaura fuentes. **No equivale a ejecutar las nueve mutaciones de Vitest originales.** Los textos de los controles negativos reportados por Kira difieren de los que produce el código publicado si se emplean exactamente los comandos citados, sin un wrapper adicional.

### Controles de aplicación independientes

Se leyeron las fuentes reales de 9 archivos (copy, status, profile, card, admin, tests, queue, cross) en el SHA e97323fe2290a33dec2152ab1b0020037d327a5f. 14/14 invariantes de fuente GREEN: título y subtítulo exactos, status, perfil, badge admin, no truncate selfie, aria-label, Pendiente cruzado, test descripción, no globalThis ni non-null assertion, import React explícito. La cadena `1. DOCUMENTUPLOADCARD` **no aparece como encabezado JSX de cliente**. Es terminología técnica presente solo como nombre del componente; el recorte entregado por el usuario parece documento/reporte QA. Se corrigió el rótulo de las dos imágenes y se añadió aclaración en el body de la PR, sin alterar capturas.

### CI oficial GitHub

- SHA e97323fe2290a33dec2152ab1b0020037d327a5f unit 116621365095: 133 files, 2370 Vitest passed, más 79 workflow tests y 6 ADR. db-tests 116621365268: Files=24, Tests=2283, Result: PASS. typecheck, lint, build, audit, bundle-budget SUCCESS. approval-policy SUCCESS por review APPROVED vigente.
- E2E commit status ERROR, Vercel deployment `dpl_8isGQv9cJEi1pBJfof727GfxvMTj`, run 38792914312, `e2e-preview` CANCELLED. Run anterior 38695142292 PASSED sobre SHA anterior 20392c26, NO es equivalente.
- `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` intentado desde contenedor, exit=128, `Could not resolve host: github.com`; no hubo pnpm Vitest de repo ni navegador directo.

## Ronda 6 — 2026-10-16 — SHA 5388ed3627e4958cb3bcd112eb38ed66aa892bed

### Comprobación autónoma independiente — caso GREEN superviviente y RED real

Se creó `/tmp/t354-r6-harness-check.mjs` y se ejecutó con `node` en un directorio temporal limpio, **sin clonar cadeApp, sin alterar tests del repositorio y sin conexiones a Supabase/Vercel**. Se transcribe el script completo para reproducción:

```js
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execSync} from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'t354-r6-'));
const file=join(root,'dummy.txt');
writeFileSync(file,'original\n');
const runVitest=command=>{
  try{return {code:0,output:execSync(command,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}})}}
  catch(e){if(typeof e.status!=='number')throw e;return {code:e.status,output:String(e.stdout??'')+'\n'+String(e.stderr??'')}}
};
function validate(command){
  const original=readFileSync(file,'utf8');
  const initial=runVitest(command);
  if(initial.code!==0||!/Tests\s+\d+\s+passed/.test(initial.output))throw Error('Control GREEN inicial ausente');
  let mutated;
  try{writeFileSync(file,'mutant\n');mutated=runVitest(command)}
  finally{writeFileSync(file,original)}
  if(mutated.code!==1||!/Tests\s+\d+\s+failed/.test(mutated.output))
    throw Error('Mutante sobreviviente o fallo no atribuible a test: exit='+mutated.code);
  const restored=runVitest(command);
  if(restored.code!==0||!/Tests\s+\d+\s+passed/.test(restored.output))throw Error('GREEN tras restaurar ausente');
  return 'DETECTED';
}
const tests=[
 ['always-GREEN','node -e "console.log(\'Tests 1 passed (1)\')"','REJECTED'],
 ['nonexistent-command','comando_que_no_existe_12345','REJECTED'],
 ['RED-and-GREEN','node -e "const fs=require(\'fs\');if(fs.readFileSync(\'dummy.txt\',\'utf8\').startsWith(\'mutant\')){console.log(\'Tests 1 failed (1)\');process.exit(1)}console.log(\'Tests 1 passed (1)\')"','DETECTED']
];
try{
 for(const [name,command,expected] of tests){
   let result;try{result=validate(command)}catch(e){result='REJECTED';console.log(name,'reason='+e.message)}
   const clean=readFileSync(file,'utf8')==='original\n';
   console.log(name,result,'clean='+clean);
   if(result!==expected||!clean)process.exitCode=1;
 }
}finally{rmSync(root,{recursive:true,force:true})}
```

Salida real:

```text
always-GREEN reason=Mutante sobreviviente o fallo no atribuible a test: exit=0
always-GREEN REJECTED clean=true
nonexistent-command reason=Control GREEN inicial ausente
nonexistent-command REJECTED clean=true
RED-and-GREEN DETECTED clean=true
R6_HARNESS_VALIDATION=PASS
```

### Fuente y gates del commit

- Lectura independiente vía GitHub API de 9 fuentes en el HEAD; 14 controles GREEN, 14 mutantes de fuente en memoria detectados. No se ejecutaron los 9 RED originales de Vitest.
- Autor cambió SOLO `docs/tasks/log/T-354.md` desde el commit de ronda 5, aclarando experimentos. `develop` 4 commits adelantado, `mergeable=true` según GitHub, sin ejecución local `git merge-tree` por falta de clon.
- CI SHA 5388ed3: unit job 116635958117 -> 133 archivos, 2370 Vitest pass, 79 node:test, 6 ADR; DB job 116635958806 -> 24 files, 2283 tests PASS; typecheck/lint/audit/approval-policy success. `build` 116635958258 FAIL -> `next/font` google loader TypeError reading 1 of null; bundle-budget SKIPPED.
- E2E commit status `error`, run 38797126543, job 116636476695 CANCELLED; Vercel deployment dpl_GGvsTyGPrmMFKhKyVNqc3dYonmCT success. El autor documentó honestamente la cancelación en bitácora y cuerpo de PR.
- Las dos capturas nuevas figuran con URLs GitHub user-attachments; no pudimos descargar imágenes originales desde las herramientas de esta sesión, así que no se declara visual revisado. La cadena técnica `DOCUMENTUPLOADCARD` no aparece en el JSX del cliente.
- Nota de reproducibilidad: `node docs/revision-pr/analizar.mjs verificacion`, los tests reales de Vitest mutado y `git merge-tree` **no se ejecutaron localmente** desde la revisión actual.

 
## Ronda 7 — comprobaciones finales del SHA `6c2a6d2d2f5f71d47ca0ae4837e88a862d416322`
 
**Fuente oficial:** API GitHub sobre PR #368, comparación `develop...6c2a6d2d2f5f71d47ca0ae4837e88a862d416322`, diff de 21 archivos, tareas/ficha, CI logs, tests E2E y reviews. La revisión independiente ejecutó sobre nueve contenidos reales **14 checks de fuente baseline** y luego **14 sustituciones de texto en copias in-memory**; todos los baselines GREEN y los 14 mutantes detectados por sus checks. No se editó ningún archivo fuente ni se ejecutó Vitest mutado en clone; esa limitación se conserva expresamente en H02.
 
### Invariantes comprobados y mutados en memoria
 
| ID | Cambio que hizo fallar el control estático |
|---|---|
| title | `selfieTitle` nuevo → texto obsoleto |
| subtitle | subtítulo literal → frase corta |
| status | StatusView deja de consumir copy |
| profile | perfil deja de consumir copy |
| detail | admin documentKind.selfie cambia de texto |
| badge | admin queue badge cambia de texto |
| wrap | remoción de condición `kind==='selfie'` |
| input | aria-label deja de apuntar al título |
| pending | test cruzado pierde `Pendiente` |
| noGlobal | test admin reintroduce `globalThis as any` |
| noBang | test onboarding reintroduce `describedById!` |
| react | falta import React directo en ApplicantsQueue |
| ariaTest | test ya no verifica descripción literal |
| adminTest | test admin ya no verifica badge |
 
**Resultado del instrumento de fuente sobre archivos reales del SHA:** `14/14 baseline GREEN, 14/14 mutantes detectados`. Estos controles **NO son equivalentes a mutaciones de Vitest**. El harness Node hermético de la ronda 6 sigue documentado en el apartado anterior.
 
### Logs consultados del SHA
 
- Unit job `117142235252`: `Test Files 135 passed (135)`, `Tests 2419 passed (2419)`, node:test `79 passed`, ADR `6 passed`.
- Build job `117142235214`: `Compiled successfully in 28.9s`, `Generating static pages (50/50)`, success.
- DB job `117142235118`: `Files=26, Tests=2341, Result: PASS` (pruebas normales; se registran también RED intermedios intencionales en otros CC).
- E2E job `117142691597`, run `38951164081`: `78 passed (20.3m)`, `1 flaky` en `map-privacy.spec.ts:498` por HTTP 500 (expected 200), `3 passed (1.0m)` global-settings. El run y el commit status del **SHA target `6c2a6d2d2f5f71d47ca0ae4837e88a862d416322`** quedaron success.
- Review formal de Lautaro073: estado `APPROVED`; `approval-policy` success. Branch develop sincronizada (behind=0), `mergeable_state=clean` al consultar.
 
**No observado directamente:** las dos capturas de user-attachments, la ejecución independiente de las nueve mutaciones Vitest y un `git merge-tree` local. La prueba E2E *flaky* de T-314 es evidencia concreta de un HTTP 500 transitorio y justifica seguimiento separado, no un bloqueo de esta PR de copy.
