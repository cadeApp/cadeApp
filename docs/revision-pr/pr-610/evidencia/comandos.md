# Evidencia reproducible — PR #610 / SHA 7c3f6a044a1e76e86d9ca8f17fcdaac49a24f0b9

## Cómo correr

En un clon **limpio** situado en el SHA examinado, sin secrets ni Supabase remoto:

```bash
cp docs/revision-pr/pr-610/evidencia/mutaciones-pr610.mjs /tmp/pr610-revision-harness.mjs
REPO_ROOT="$PWD" REVIEW_MODE=baseline node /tmp/pr610-revision-harness.mjs
# Tras corregir H01/H02/H03, sobre el nuevo SHA:
REPO_ROOT="$PWD" REVIEW_MODE=fixed node /tmp/pr610-revision-harness.mjs
node --test .github/workflows/verify-workflows.test.mjs
pnpm typecheck
pnpm lint
pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

El harness **no** altera checkout ni escribe mutaciones en archivos. Construye controles y reemplazos en memoria. Si cambia la firma del helper y un objetivo ya no existe, aborta con «Instrumento sin objetivo», no cuenta ese error como RED legítimo. No instalar dependencias nuevas.

## Resultados observados sobre GitHub (código exacto del SHA)

```text
C01_internal_develop GREEN
C02_bad_CI GREEN
C03_fork GREEN
C04_migrations GREEN
H02_CI_wrong_PR RED (original devuelve match en evento asociado a staging)
M01_fork_guard RED (esperado)
M02_migrations_guard RED (esperado)
M03_exact_SHA RED (esperado)
M04_source_event RED (esperado)
M05_CI_conclusion RED (esperado)
H01_build_without_secrets RED (pnpm build comparte env con service role, DNI y cron)
H03_queue_preview RED (falta queue: max)
H03_queue_mutation RED (falta queue: max)
C05_shared_lock GREEN
C06_no_cancel_active GREEN
```

Estas verificaciones se ejecutaron sobre contenido obtenido directamente de GitHub en una evaluación JS aislada. `node --check` del script autocontenido se ejecutó en el contenedor local. **La ejecución del script contra un clon completo** queda pendiente porque el contenedor no resuelve `github.com`. Por eso no se afirma que todos los comandos de la sección anterior se hayan corrido localmente.

## CI observado (run 41945869055)

- SHA: `7c3f6a044a1e76e86d9ca8f17fcdaac49a24f0b9`; `build`, `typecheck`, `lint`, `unit`, `db-tests`, `audit`, `bundle-budget`: SUCCESS.
- `unit`: Vitest `Test Files 192 passed`; workflow `# tests 80 / # pass 80 / # fail 0`; ADR `# tests 6 / # pass 6 / # fail 0`.
- `db-tests`: `Files=42, Tests=3396, Result: PASS`; y `git diff --exit-code -- src/types/database.types.ts` correcto. Los FAIL intencionales corresponden a pruebas de mutación, seguidos de GREEN.
- El nuevo E2E por `workflow_run` **no** fue probado: solo se activa después del merge a `develop`.

## Script completo (copiable a /tmp)

```js
/* PR #610: harness independiente; solo Node.js 22, sin escrituras. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root=process.env.REPO_ROOT ?? process.cwd();
const file=(path)=>readFileSync(join(root,path),'utf8');
const src=file('.github/workflows/e2e-preview-target.mjs');
const preview=file('.github/workflows/e2e-preview.yml');
const mutationYml=file('.github/workflows/e2e-mutation.yml');
function productionHelper(code) {
  const a=code.indexOf('export const STATUS_CONTEXT');
  const b=code.indexOf('async function githubApi');
  if(a<0||b<a) throw new Error('Instrumento sin objetivo: helper puro');
  // Evaluar copia EN MEMORIA del helper de producción, no tocar checkout.
  return Function(`${code.slice(a,b).replace(/^export /gm,'')}\nreturn {matchPullRequest,gatePullRequest};`)();
}
const base=productionHelper(src);
const sha='a'.repeat(40),repository='cadeApp/cadeApp';
const pull={number:999,state:'open',
  base:{ref:'develop',repo:{full_name:repository}},
  head:{sha,repo:{full_name:repository}}};
const event=(more={})=>({event:'pull_request',conclusion:'success',head_sha:sha,
  pull_requests:[{number:999,base:{ref:'develop'},head:{sha}}],...more});
const mode=process.env.REVIEW_MODE??'baseline';
if(!['baseline','fixed'].includes(mode)) throw Error('REVIEW_MODE: baseline|fixed');
const expectedAfterFix=mode==='fixed'?'GREEN':'RED';
let failures=0;
function check(id,pass,expected='GREEN'){
  const observed=pass?'GREEN':'RED';
  console.log(id+': '+observed+(observed===expected?' (esperado)':' (INESPERADO)'));
  if(observed!==expected) failures++;
}
check('C01_internal_develop',base.matchPullRequest({run:event(),repository,pulls:[pull]}).outcome==='match');
check('C02_bad_CI',base.matchPullRequest({run:event({conclusion:'failure'}),repository,pulls:[pull]}).outcome==='skip');
const fork={...pull,head:{sha,repo:{full_name:'other/cadeApp'}}};
check('C03_fork',base.matchPullRequest({run:event(),repository,pulls:[fork]}).outcome==='skip');
check('C04_migrations',base.gatePullRequest({changedFiles:['supabase/migrations/x.sql']}).outcome==='blocked');
// RED real: el run pertenece a otra PR (staging), pero coincide el SHA de una PR develop.
const runStaging=event({pull_requests:[{number:1000,base:{ref:'staging'},head:{sha}}]});
check('H02_CI_wrong_PR',base.matchPullRequest({run:runStaging,repository,pulls:[pull]}).outcome!=='match',expectedAfterFix);
// Mutaciones independientes: deben dar RED si los controles protegen realmente.
function mutant(from,to){
  if(!src.includes(from))throw Error('Instrumento sin objetivo: '+from);
  return productionHelper(src.replace(from,to));
}
const noFork=mutant('if (pull.head.repo?.full_name !== repository) {','if (false) {');
check('M01_fork_guard',noFork.matchPullRequest({run:event(),repository,pulls:[fork]}).outcome==='skip','RED');
const noMigration=mutant("file.startsWith('supabase/migrations/')","file.startsWith('unrelated/migrations/')");
check('M02_migrations_guard',noMigration.gatePullRequest({changedFiles:['supabase/migrations/x.sql']}).outcome==='blocked','RED');
const noSha=mutant('pull.head.sha === sha','true');
const old={...pull,head:{sha:'b'.repeat(40),repo:{full_name:repository}}};
check('M03_exact_SHA',noSha.matchPullRequest({run:event(),repository,pulls:[old]}).outcome==='skip','RED');
const noEvent=mutant("text(data.event) !== 'pull_request'",'false');
check('M04_source_event',noEvent.matchPullRequest({run:event({event:'push'}),repository,pulls:[pull]}).outcome==='skip','RED');
const noConclusion=mutant("text(data.conclusion) !== 'success'",'false');
check('M05_CI_conclusion',noConclusion.matchPullRequest({run:event({conclusion:'failure'}),repository,pulls:[pull]}).outcome==='skip','RED');
// H01: no se permite que pnpm build herede service-role, DNI ni cron.
// Buscar todos los steps y comprobar que ningún step con build declare esos secretos.
const lines=preview.split('\n');
let stepStart=-1,hasExposedBuild=false,stepCount=0;
for(let i=0;i<=lines.length;i++){
  const boundary=i===lines.length||/^      - (?:name:|uses:|run:)/.test(lines[i]);
  if(boundary&&stepStart>=0){
    const step=lines.slice(stepStart,i).join('\n');
    if(/pnpm build/.test(step)&&/SUPABASE_SERVICE_ROLE_KEY|DNI_HMAC_SECRET|CRON_SECRET/.test(step))hasExposedBuild=true;
    stepCount++;
  }
  if(i<lines.length&&/^      - (?:name:|uses:|run:)/.test(lines[i]))stepStart=i;
}
if(stepCount===0)throw Error('Instrumento sin objetivo: steps e2e');
check('H01_build_without_secrets',!hasExposedBuild,expectedAfterFix);
const hasQueue=(s)=>/^\s*queue: max\s*$/m.test(s);
check('H03_queue_preview',hasQueue(preview),expectedAfterFix);
check('H03_queue_mutation',hasQueue(mutationYml),expectedAfterFix);
check('C05_shared_lock',/group: cadeapp-develop-e2e/.test(preview)&&/group: cadeapp-develop-e2e/.test(mutationYml));
check('C06_no_cancel_active',/cancel-in-progress: false/.test(preview)&&/cancel-in-progress: false/.test(mutationYml));
console.log(failures?'UNEXPECTED_OUTCOMES='+failures:'REVIEW_EXPECTED_OUTCOMES=PASS');
process.exitCode=failures?1:0;

```


## Ronda 2 — SHA `ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7` (2026-11-04 ART)

**Chequeos externos del SHA exacto:**
- `github compare ae034eb0a75f5ba1bebb5bd9e6d23d47a92fde28...ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7`: 1 commit, 7 archivos; `develop` en la misma base, PR mergeable.
- Run CI `41950852316`: build/typecheck/lint/unit/db-tests/audit/bundle-budget SUCCESS.
- Unit log: `Test Files 192 passed (192)`, `Tests 3532 passed (3532)`; `# tests 82 / # pass 82 / # fail 0` workflow, ADR 6/6.
- DB log: `Files=42, Tests=3396, Result: PASS` (repetido tras restauración de mutaciones); `git diff --exit-code -- src/types/database.types.ts` ejecutado sin diferencia.
- En `bundle-budget`: rutas con warning presupuestario pese al status SUCCESS. No pertenece al diff T-422.
- No se clonó ni levantó Supabase: el contenedor no resuelve `github.com`, y no hay autorización para Docker remoto/local.

**Reproducción comparativa con helper de producción:** sobre `7c3f6a0`, para `workflow_run.pull_requests=[{number:999,base:{ref:'staging'},head:{sha}}]` y lista de PR de API con `#321` abierta a develop y mismo SHA, `matchPullRequest()` devolvió `match` (RED real). En `ce259f7` devolvió `skip` (GREEN). Sin mocks del helper, fuente real de ambos SHAs.

**Batería independiente, en memoria (sin edits a repo):** 27/27 observaciones esperadas. Controles de H01/H02/H03 positivos y 10 mutaciones RED: M01 retirar asociación, M02 retirar fork, M03 retirar migraciones, M04 omitir éxito del CI, M05 omitir tipo de evento, M06 inyectar service role en build, M07 heredar DNI en job, M08 recompilar con secretos de runtime, M09 quitar queue en preview, M10 quitar queue en mutation. **Toda mutación se ejecuta contra cadenas de archivos leídos del árbol exacto; no hay branch `if(test)` ni sustitución de las funciones del helper**. `INSTRUMENT_WITHOUT_TARGET` aborta el instrumento si el código objetivo no existe.

**Para reproducir sobre un clon limpio del SHA:**

```bash
git switch --detach ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7
node docs/revision-pr/pr-610/evidencia/mutaciones-pr610-r2.mjs
node --test .github/workflows/verify-workflows.test.mjs
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

**Script completo:** ver archivo hermano `evidencia/mutaciones-pr610-r2.mjs` (idéntica fuente, no depende de secretos) y su contenido en esta sección siguiente.


```js
/* PR #610 R2: memory-only mutations against exact repo sources; Node 22. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const base=process.env.REPO_ROOT ?? process.cwd();
const read=p=>readFileSync(join(base,p),'utf8');
const src=read('.github/workflows/e2e-preview-target.mjs');
const yaml=read('.github/workflows/e2e-preview.yml');
const myaml=read('.github/workflows/e2e-mutation.yml');
const tests=read('.github/workflows/verify-workflows.test.mjs');
function helper(code) {
 const a=code.indexOf('export const STATUS_CONTEXT'), b=code.indexOf('async function githubApi');
 if(a<0||b<a)throw Error('INSTRUMENT_WITHOUT_TARGET helper');
 return new Function(code.slice(a,b).replace(/^export /gm,'')+'\nreturn {matchPullRequest,gatePullRequest};')();
}
const p=helper(src),sha='a'.repeat(40),repo='cadeApp/cadeApp';
const pull=(x={})=>({number:321,state:'open',base:{ref:'develop',repo:{full_name:repo}},head:{sha,repo:{full_name:repo}},...x});
const assoc=(x={})=>({number:321,base:{ref:'develop'},head:{sha},...x});
const run=(x={})=>({event:'pull_request',conclusion:'success',head_sha:sha,pull_requests:[assoc()],...x});
const match=(h,x={})=>h.matchPullRequest({run:x.run??run(),repository:repo,pulls:x.pulls??[pull()]});
let good=0,bad=0;
function T(name,got,want=true){const ok=got===want;console.log(name+': '+(got?'GREEN':'RED')+' expected '+(want?'GREEN':'RED')+(ok?'':' UNEXPECTED'));if(ok)good++;else bad++;}
function mutated(a,b){if(!src.includes(a))throw Error('INSTRUMENT_WITHOUT_TARGET '+a);return helper(src.replace(a,b));}
T('H02-valid-association',match(p).outcome==='match');
T('H02-staging-other-PR',match(p,{run:run({pull_requests:[assoc({number:999,base:{ref:'staging'}})]})}).outcome!=='match');
T('H02-develop-other-PR',match(p,{run:run({pull_requests:[assoc({number:999})]})}).outcome!=='match');
T('H02-missing-association',match(p,{run:run({pull_requests:[]})}).outcome!=='match');
T('H02-ambiguous-association',match(p,{run:run({pull_requests:[assoc(),assoc({number:999})]})}).outcome!=='match');
T('H02-malformed-association',match(p,{run:run({pull_requests:[assoc({number:'321'})]})}).outcome!=='match');
const a=src.indexOf('  const associations = Array.isArray(data.pull_requests)');
const b=src.indexOf("  return {\n    outcome: 'match'",a);
if(a<0||b<a)throw Error('INSTRUMENT_WITHOUT_TARGET association');
const unsafe=helper(src.slice(0,a)+src.slice(b));
T('M01-remove-association',match(unsafe,{run:run({pull_requests:[assoc({number:999,base:{ref:'staging'}})]})}).outcome!=='match',false);
T('M02-remove-fork',match(mutated('if (pull.head.repo?.full_name !== repository) {','if (false) {'),{pulls:[pull({head:{sha,repo:{full_name:'another/fork'}}})]}).outcome!=='match',false);
T('M03-remove-migration',mutated("file.startsWith('supabase/migrations/')","file.startsWith('other/')").gatePullRequest({changedFiles:['supabase/migrations/abc.sql']}).outcome==='blocked',false);
T('M04-remove-CI-success',match(mutated("text(data.conclusion) !== 'success'",'false'),{run:run({conclusion:'failure'})}).outcome!=='match',false);
T('M05-remove-PR-event',match(mutated("text(data.event) !== 'pull_request'",'false'),{run:run({event:'push'})}).outcome!=='match',false);
function job(text,name){const m=new RegExp('^  '+name+':\\s*$','m').exec(text);if(!m)throw Error('INSTRUMENT_WITHOUT_TARGET job '+name);const tail=text.slice(m.index+m[0].length),end=/\n  [a-zA-Z0-9_-]+:\s*\n/.exec(tail);return text.slice(m.index,end?m.index+m[0].length+end.index:undefined);}
function step(text,name){const m=new RegExp('^      - name: '+name+'$','m').exec(text);if(!m)throw Error('INSTRUMENT_WITHOUT_TARGET step '+name);const tail=text.slice(m.index+m[0].length),end=/\n      - (?:name:|uses:|run:)/.exec(tail);return text.slice(m.index,end?m.index+m[0].length+end.index:undefined);}
const ejob=job(yaml,'e2e'),mjob=job(myaml,'mutation');
const build=step(ejob,'Build PR without privileged secrets'),gate=step(ejob,'Run preview E2E gate');
const privileged=/^\s*(SUPABASE_SERVICE_ROLE_KEY|DNI_HMAC_SECRET|CRON_SECRET|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN)\s*:/m;
const jobEnv=ejob.slice(ejob.indexOf('\n    env:'),ejob.indexOf('\n    steps:'));
T('H01-build-command',/^\s+run: pnpm build\s*$/m.test(build));
T('H01-build-no-secrets',!privileged.test(build));
T('H01-job-no-secret-inheritance',!privileged.test(jobEnv));
T('H01-runtime-has-required-secrets',privileged.test(gate));
T('H01-runtime-does-not-build',!/^\s+pnpm (?:run )?build\s*$/m.test(gate));
T('H01-build-before-runtime',ejob.indexOf('Build PR without privileged secrets')<ejob.indexOf('Run preview E2E gate'));
const inject=build.replace('          NEXT_PUBLIC_SUPABASE_ANON_KEY:','          SUPABASE_SERVICE_ROLE_KEY: injected\n          NEXT_PUBLIC_SUPABASE_ANON_KEY:');
if(inject===build||!gate.includes('          pnpm start'))throw Error('INSTRUMENT_WITHOUT_TARGET build mutation');
T('M06-add-service-role-to-build',!privileged.test(inject),false);
T('M07-inherit-DNI-through-job',!privileged.test(jobEnv+'\n      DNI_HMAC_SECRET: injected'),false);
T('M08-rebuild-with-secrets',!/^\s+pnpm (?:run )?build\s*$/m.test(gate.replace('          pnpm start','          pnpm build\n          pnpm start')),false);
function lock(j){const m=/\n    concurrency:\n((?: {6}[^\n]*\n)+)/.exec(j);if(!m)throw Error('INSTRUMENT_WITHOUT_TARGET concurrency');return m[1];}
const aLock=lock(ejob),bLock=lock(mjob);
const valid=s=>/^\s*group: cadeapp-develop-e2e$/m.test(s)&&/^\s*queue: max$/m.test(s)&&/^\s*cancel-in-progress: false$/m.test(s);
T('H03-preview-max-queue',valid(aLock));
T('H03-mutation-max-queue',valid(bLock));
T('M09-remove-preview-queue',valid(aLock.replace(/^\s*queue: max\s*$/m,'')),false);
T('M10-remove-mutation-queue',valid(bLock.replace(/^\s*queue: max\s*$/m,'')),false);
T('AUTHOR-H01-test-exists',tests.includes('PR610-H01: the PR is built'));
T('AUTHOR-H02-test-exists',tests.includes('PR610-H02: the CI run must'));
T('AUTHOR-H03-both-tests-exist',tests.includes('D03=B: un grupo fijo')&&tests.includes('D03=B: el mismo lock'));
console.log('TOTAL '+(good+bad)+' EXPECTED '+good+' UNEXPECTED '+bad);
if(bad)process.exitCode=1;
```
