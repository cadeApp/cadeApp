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
