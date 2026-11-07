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