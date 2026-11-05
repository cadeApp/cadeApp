# Evidencia — PR #617 / ronda 1

**SHA por inspección:** `8116e2397d9a28504024850be4ae31913d35abdc`. **Tests ejecutados por el revisor:** ninguno. No declarar RED, GREEN ni CI verificado a partir de esta evidencia.

## Referencias estáticas

- `src/features/admin/audit-format.ts:26,50-55`: tono positivo incondicional de incidente.
- `supabase/migrations/20260927120000_cc012_incidents_contract.sql`: `p_decision='no_action' → dismissed`, restantes → `resolved`, guardados en `after.status`.
- `src/features/admin/queries.ts:811-812`: página sin filas cancela ambos indicadores de navegación.
- `src/features/admin/components/audit-log-table.tsx:294-305`: no hay fallback de cursor vacío.
- El autor reportó M1/M2/M3 y 109 GREEN restaurados; no fueron reproducidos por el revisor.

## Harness completo propuesto para la próxima ronda

Se ejecuta **después del arreglo** sobre un SHA pusheado, en worktree descartable. No modifica el árbol del usuario; el contenido temporal de cada archivo se restaura **desde memoria** en `finally`, nunca mediante `git checkout`. No se ejecutó en esta ronda. Si el objetivo exacto no existe, falla **SIN OBJETIVO**; no cuenta como mutación roja.

Copiar **solo el siguiente bloque** a `/tmp/cadeapp-pr617-r1-harness.sh`, `bash -n /tmp/cadeapp-pr617-r1-harness.sh` y, desde el repo, `bash /tmp/cadeapp-pr617-r1-harness.sh <SHA-CORREGIDO>`.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SHA="$1"
if [ -z "$SHA" ]; then echo "Pasar SHA"; exit 1; fi
TEMP="$(mktemp -d)"
WT="$TEMP/wt"
cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
  rm -rf "$TEMP"
}
trap cleanup EXIT
git -C "$ROOT" worktree add --detach "$WT" "$SHA" >/dev/null
cd "$WT"
pnpm install --frozen-lockfile > "$TEMP/install.log" 2>&1 || { tail -n 30 "$TEMP/install.log"; exit 1; }
node - <<'NODE'
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const paths = ['src/features/admin/audit-format.test.ts','src/features/admin/components/audit-log-table.test.tsx'];
function run(name) {
  const r = spawnSync('pnpm',['exec','vitest','run',...paths],{encoding:'utf8'});
  const sum = ((r.stdout||'')+'\n'+(r.stderr||'')).split(/\r?\n/).filter(x=>/Test Files |Tests /.test(x)).slice(-2);
  console.log(name+': '+(sum.join(' | ')||'sin resumen'));
  return r.status === 0;
}
if (!run('BASELINE')) throw new Error('Baseline RED: no iniciar mutaciones');
const mutations = [
 {id:'H01: dismissed tratado como positive',
  file:'src/features/admin/audit-format.ts',
  needle:"export function auditActionTone(item: Pick<AuditLogItem, 'action' | 'changes'>): AuditActionTone {",
  replacement:"export function auditActionTone(item: Pick<AuditLogItem, 'action' | 'changes'>): AuditActionTone {\n  if (item.action === 'admin_resolve_incident') return 'positive';"},
 {id:'H02: ocultar retorno desde cursor vacío',
  file:'src/features/admin/components/audit-log-table.tsx',
  needle:'filters.cursor !== undefined && result.items.length === 0',
  replacement:'false /* mutación: se anuló el fallback */'}
];
for (const m of mutations) {
  const original=fs.readFileSync(m.file,'utf8');
  const matches=original.split(m.needle).length-1;
  if (matches !== 1) throw new Error(m.id+': SIN OBJETIVO ('+matches+'), actualizar harness');
  try {
    fs.writeFileSync(m.file,original.replace(m.needle,m.replacement));
    if (run(m.id+' MUTADO')) throw new Error(m.id+': SOBREVIVIÓ, el control no detectó el defecto');
  } finally { fs.writeFileSync(m.file,original); }
  if (!run(m.id+' RESTAURADO')) throw new Error(m.id+': no recuperó GREEN');
}
console.log('Dos mutaciones detectadas; inspeccionar que los RED son aserciones de comportamiento, no setup');
NODE
```

**Comprobación obligatoria:** las pruebas mutadas deben fallar por la aserción de `dismissed` o por la ausencia del link `Volver al inicio`, no por error de import, timeout o sintaxis. Una mutación en rojo por otro motivo no verifica el hallazgo.

## Chequeos al estar sin bloqueantes

```bash
git fetch origin
git merge-tree --write-tree origin/develop origin/feat/T-407-auditoria-a06
pnpm typecheck > /tmp/t407-typecheck.log 2>&1
pnpm lint > /tmp/t407-lint.log 2>&1
pnpm exec vitest run src/features/admin/audit-format.test.ts src/features/admin/components/audit-log-table.test.tsx > /tmp/t407-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/t407-unit.log | tail -n 3
node docs/revision-pr/analizar.mjs verificacion
```

CI oficial y `e2e-preview`: verificar su SHA y log real recién cuando la ronda esté sin bloqueantes. No usar Supabase ni Docker local ni secretos.

---

## Evidencia ronda 2 — `f4a5a1fca3b836e9ee39077e26a63a92f4da900b`

**Ejecutado realmente por el revisor mediante GitHub + V8:**

- H01: función literal `auditActionTone` y maps/set extraídos del SHA, **6/6** casos de comportamiento GREEN; mutaciones independientes `resolved→neutral` y quitar acción del set, ambas detectadas.
- H02: expresión real `emptyAfterCursor` probada en **3** escenarios; cuerpo literal `buildAuditHref` ejecutado conservando siete filtros y sin `cursor`/`dir`; JSX revisado. Mutantes conceptuales propios: quitar condición de cursor o reintroducir cursor en href; sus salidas violan las aserciones.
- H03: cuerpo literal de `formatAuditValue` devuelve `dismissed` y `resolved` sin traducción. `INCIDENTS_COPY.statuses` de A05 proporciona `Cerrado sin sanción` y `Resuelto`.

**Evidencia exclusiva del autor:** bitácora del SHA: H01 RED 1/8 y GREEN; H02 RED 1/20 y GREEN; mutaciones RED 1/29 y GREEN 30; admin 462 tests; typecheck/lint. No se ejecutó su Vitest aquí; el harness anterior no corrió tal cual por restricciones del entorno del autor.

**Límite:** Git desde el contenedor sin DNS. No hay worktree para `pnpm`, React, Playwright ni merge-tree. Los checks funcionales de V8 son acotados y no dan el gate por verde.

### Reproductor completo de los controles aislados (no ejecutado tal cual en un clon en esta sesión)

Copiar el bloque a un script en `/tmp` y ejecutar con Node con `cwd` en la raíz del repositorio; no necesita dependencias del proyecto ni modifica archivos.

```js
// Nodo independiente: ejecutar desde raíz de cadeApp, sin mutar archivos.
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const fmt=read('src/features/admin/audit-format.ts');
const ui=read('src/features/admin/components/audit-log-table.tsx');
const copy=read('src/features/admin/copy.ts');
const ok=(x,m)=>{if(!x)throw Error(m)};
function body(s,n){const p=s.indexOf('export function '+n+'(');ok(p>=0,'missing '+n);const a=s.indexOf('{',p);let d=0;for(let i=a;i<s.length;i++){d+=s[i]==='{'?1:s[i]==='}'?-1:0;if(!d)return s.slice(a+1,i)}throw Error('unclosed');}
function map(name){const p=fmt.indexOf('const '+name+':');ok(p>=0,name);const a=fmt.indexOf('= {',p)+2,b=fmt.indexOf('};',a)+1;return new Function('return ('+fmt.slice(a,b)+')')();}
function setOf(name){const p=fmt.indexOf('const '+name+':'),a=fmt.indexOf('new Set([',p),b=fmt.indexOf(']);',a)+2;return new Function('return '+fmt.slice(a,b))();}
const statuses=map('STATUS_TONES'), actions=map('ACTION_TONES'),set=setOf('STATUS_DRIVEN_ACTIONS');
const toneOf=(o,k)=>Object.prototype.hasOwnProperty.call(o,k)?o[k]??'neutral':'neutral';
const toneBody=body(fmt,'auditActionTone');
const tone=(item,states=statuses,acts=set)=>new Function('item','STATUS_DRIVEN_ACTIONS','STATUS_TONES','ACTION_TONES','toneOf',toneBody)(item,acts,states,actions,toneOf);
const evt=(act,st)=>({action:act,changes:st===null?[]:[{field:'status',after:st}]});
for(const [a,st,want] of [['admin_resolve_incident','resolved','positive'],['admin_resolve_incident','dismissed','neutral'],['admin_resolve_incident',null,'neutral'],['admin_decide_courier','approved','positive'],['admin_decide_courier','rejected','negative'],['view_courier_document',null,'access']])ok(tone(evt(a,st))===want,'H01 '+st);
ok(tone(evt('admin_resolve_incident','resolved'),{...statuses,resolved:'neutral'})!=='positive','mutant resolved survives');
ok(tone(evt('admin_resolve_incident','resolved'),statuses,new Set([...set].filter(x=>x!=='admin_resolve_incident')))!=='positive','mutant action survives');
const expr=ui.match(/const emptyAfterCursor = ([^;]+);/)?.[1];ok(expr,'no guard');const guard=new Function('filters','result','return '+expr);
ok(guard({cursor:5},{items:[]})===true,'cursor+empty');ok(guard({},{items:[]})===false,'initial empty');ok(guard({cursor:5},{items:[{id:1}]})===false,'has rows');
ok(ui.includes('result.hasPrevPage || result.hasNextPage || emptyAfterCursor'),'missing fallback in nav');
ok(ui.includes('<Link href={buildAuditHref(filters)} className={PAGE_LINK_CLASS}>'),'incorrect link');
const href=new Function('filters','cursor','direction','URLSearchParams','AUDIT_PATH',body(ui,'buildAuditHref'));
const q={actorId:'a',action:'b',targetType:'c',courierId:'d',targetId:'e',from:'2026-10-21',to:'2026-10-22',cursor:5,direction:'prev'};
const url=new URL(href(q,undefined,undefined,URLSearchParams,'/admin/audit'),'http://localhost');
for(const [f,p] of [['actorId','actor'],['action','action'],['targetType','entity'],['courierId','courier'],['targetId','target'],['from','from'],['to','to']])ok(url.searchParams.get(p)===q[f],'missing '+p);
ok(!url.searchParams.has('cursor')&&!url.searchParams.has('dir'),'stale paging');
ok(href(q,q.cursor,'prev',URLSearchParams,'/admin/audit').includes('cursor=5'),'mutant cursor');
const audit=copy.slice(copy.indexOf('\n  audit: {'),copy.indexOf('\n  credits: {'));
const values=audit.match(/\n    values: \{([\s\S]*?)\n    \},/);ok(values,'no values');
const translated=new Function('return ({'+values[1]+'})')();
ok(!Object.prototype.hasOwnProperty.call(translated,'dismissed'),'H03 changed; re-review');
console.log('H01/H02 aislados GREEN; H03 estados aún sin traducir');
```

### Gates

`CI` en progreso para `f4a5a1fca3b836e9ee39077e26a63a92f4da900b` al consultar GitHub; el contexto Vercel success era un despliegue ignorado. `e2e-preview` del SHA no confirmado. El revisor no disparó workflows ni usó Docker/Supabase.

---

## Ronda 3 — verificación independiente de H03

**SHA de aplicación:** `d0b408f03aa7ff3e88b82401be69d5b62834e77d` · **2026-11-05**. Leídos por conector: `src/features/admin/copy.ts`, `src/features/admin/audit-format.ts`, sus tests y `src/features/incidents/copy.ts` de A05.

### Realmente ejecutado por el revisor (V8, funciones extraídas)

- **GREEN 4/4:** se ejecutaron los cuerpos literales `describeAuditChange` + `formatAuditValue` con el mapa real: `open→resolved` (Abierto→Resuelto); `reviewing→dismissed` (En revisión→Cerrado sin sanción); `open→dismissed`; estado solo `after='dismissed'`.
- **Igualdad con A05 4/4:** `open:'Abierto'`, `reviewing:'En revisión'`, `resolved:'Resuelto'`, `dismissed:'Cerrado sin sanción'` iguales a `INCIDENTS_COPY.statuses`.
- **Mutaciones propias:** en memoria (i) `dismissed:'Desestimado'`, (ii) `resolved:'resolved'`, (iii) eliminación de `dismissed`. En los tres casos el oráculo devuelve una salida que viola la expectativa correcta. No se editó ni se restauró ningún archivo del repositorio.

**Evidencia exclusiva del autor:** en bitácora RED inicial `expected { before: 'open', after: 'resolved' }` → GREEN; mutación `dismissed:'Desestimado'` produce `Tests 1 failed | 9 passed (10)` y luego se restaura; admin `463 passed`, typecheck/lint OK. No se hizo pasar estas ejecuciones como propias del revisor.

**Límite:** este harness ejecutó las funciones TypeScript sin los tipos en V8 (el cuerpo de las funciones es JavaScript válido); no ejecutó Vitest completo, build, React ni E2E. No se consumieron secretos.

### Reproductor independiente autocontenido (no ejecutado tal cual en un checkout en esta sesión)

Copiar solo el script a `/tmp/pr617-h03-oracle.cjs` y correr `node /tmp/pr617-h03-oracle.cjs` desde el directorio raíz de cadeApp. No instala dependencias ni modifica el árbol.

```js
// Reproductor de H03. Desde la raíz del repositorio, sin imports externos.
const fs = require('node:fs');
const src = fs.readFileSync('src/features/admin/audit-format.ts','utf8');
const copy = fs.readFileSync('src/features/admin/copy.ts','utf8');
const a05 = fs.readFileSync('src/features/incidents/copy.ts','utf8');
const ok = (pass,msg) => { if(!pass)throw Error(msg); };
function body(s,name){
  const p=s.indexOf('export function '+name+'('); ok(p>=0,'missing '+name);
  const a=s.indexOf('{',p); let depth=0;
  for(let i=a;i<s.length;i++){ depth+=s[i]==='{'?1:s[i]==='}'?-1:0;
    if(depth===0)return s.slice(a+1,i);}
  throw Error('unclosed function '+name);
}
const aud=copy.slice(copy.indexOf('\n  audit: {'),copy.indexOf('\n  credits: {'));
const match=aud.match(/\n    values: \{([\s\S]*?)\n    \},/);ok(match,'no A06 values');
const values=new Function('return ({'+match[1]+'})')();
const status=a05.match(/statuses:\s*\{([\s\S]*?)\n  \} satisfies Record<IncidentStatus/);ok(status,'no A05 statuses');
const labels=new Function('return ({'+status[1]+'})')();
for(const state of ['open','reviewing','resolved','dismissed'])ok(values[state]===labels[state], 'mismatch A05 '+state);
const lookup=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key)?obj[key]:undefined;
const fvBody=body(src,'formatAuditValue'),descBody=body(src,'describeAuditChange');
function check(change,v=values){
  const ADMIN_COPY={audit:{values:v,noValue:'—'},settings:{pilotOn:'Sí',pilotOff:'No'},documentKind:{}};
  const value=(item,field,arg)=>new Function('item','field','value','ADMIN_COPY','lookup','CIVIL_DATE','formatArs','formatCivilDate',fvBody)(
    item,field,arg,ADMIN_COPY,lookup,/^\d{4}-\d{2}-\d{2}$/,()=>{throw Error('unexpected ars')},()=>{throw Error('unexpected date')});
  return new Function('item','change','formatAuditValue',descBody)({targetType:'incident',targetRef:'x'},change,value);
}
const cases=[
  {label:'open→resolved',input:{field:'status',before:'open',after:'resolved'},want:{before:'Abierto',after:'Resuelto'}},
  {label:'reviewing→dismissed',input:{field:'status',before:'reviewing',after:'dismissed'},want:{before:'En revisión',after:'Cerrado sin sanción'}},
  {label:'open→dismissed',input:{field:'status',before:'open',after:'dismissed'},want:{before:'Abierto',after:'Cerrado sin sanción'}},
  {label:'dismissed solo after',input:{field:'status',after:'dismissed'},want:{value:'Cerrado sin sanción'}},
];
for(const t of cases)ok(JSON.stringify(check(t.input))===JSON.stringify(t.want),'GREEN failed '+t.label);
for(const [mutant,input] of [
  [{...values,dismissed:'Desestimado'},cases[1]],
  [{...values,resolved:'resolved'},cases[0]],
  [Object.fromEntries(Object.entries(values).filter(([k])=>k!=='dismissed')),cases[2]]
])ok(JSON.stringify(check(input.input,mutant))!==JSON.stringify(input.want),'mutation survived');
console.log('H03: 4/4 casos GREEN, 4 etiquetas iguales a A05, 3 mutaciones detectadas');
```

### CI / E2E

- Al documentar se observó el workflow [CI #42116063239](https://github.com/cadeApp/cadeApp/actions/runs/42116063239) para `d0b408f03aa7ff3e88b82401be69d5b62834e77d` **en progreso**; no hay declaración de GREEN final.
- `e2e-preview` del SHA todavía no confirmado. El estado verde de Vercel no reemplaza el gate E2E.
- La primera corrida del spec en un SHA anterior tampoco valida automáticamente los cambios del SHA nuevo.
