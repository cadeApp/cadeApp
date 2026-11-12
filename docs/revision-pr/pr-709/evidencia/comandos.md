# Evidencia reproducible — revisión independiente PR #709 / R1

**Head inspeccionado:** `68ed5ba928b1a62d3470949aafda44bae7539f59`. **Base:** `develop@dba3314f`. **Fecha:** 2026-11-12.

## Qué se comprobó (y qué NO)

- GitHub conector: PR abierta, un commit delante de develop; archivos: CC-050, ficha T-434, plan, log. Carpeta `pr-709` inexistente antes del commit del revisor.
- Base T-434: GitHub devuelve 404 (no existía en develop), por lo que no hay `git diff origin/develop -- docs/tasks/T-434.md` de una ficha anterior: es una ficha NUEVA.
- `src/.../cc044_admin_list_applicants.sql:84` excluye de la cola ordinaria `pending` con `application_submitted=false`; `src/features/admin/queries.ts:677` no permite motivo `courier_dni_released` y en línea 820 lo descarta; formulario `vehicle-form.tsx:1` es client; página `.../vehicle/page.tsx` no inyecta URL de soporte.
- Herramienta del revisor: **6/6 observaciones de contenido originales TRUE y 6/6 mutaciones puramente EN MEMORIA detectadas**. La ejecución fue en el runtime JS del conector con los contenidos recibidos de GitHub. Estos controles son ESTÁTICOS, no tests funcionales de SEC-09; no demuestran RED de la futura implementación.
- No hay clon GitHub accesible por DNS en contenedor (`Could not resolve host: github.com`). **No se ejecutó** pnpm, node analizar, git merge-tree, SQL, CI, ni se copiaron credenciales. Los 123 tests del autor siguen **no reproducidos** por esta revisión.
- Los mutantes NO se guardan ni se pushean. No hay `verificado_en_sha` de arreglos en este head.

## Harness COMPLETO de inspección (copiar a /tmp y ejecutar desde clone exacto)

La batería es **del revisor**; no reutiliza tests del autor. Comprueba hechos sobre la especificación y sobre el código base. Para repetir contra un clon del head original, **sin tocar archivos reales**:

```bash
cat > /tmp/pr709-r1-static.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.argv[2] || process.cwd();
const get = (p) => readFileSync(path.join(root, p), 'utf8');
const files = {
  queue: get('supabase/migrations/20261104200100_cc044_admin_list_applicants.sql'),
  queries: get('src/features/admin/queries.ts'),
  page: get('src/app/(courier)/courier/onboarding/vehicle/page.tsx'),
  form: get('src/features/courier-onboarding/components/vehicle-form.tsx'),
  cc: get('docs/contracts/CC-050.md'),
  task: get('docs/tasks/T-434.md'),
};

const guards = {
  pendingHidden: (f) =>
    f.queue.includes("(p_status <> 'pending' or c.application_submitted)"),
  releaseReasonInvisible: (f) => {
    const section = f.queries.match(/const AUDIT_REASON_ACTIONS:[\s\S]*?new Set\(\[([\s\S]*?)\]\)/)?.[1];
    return !!section && !section.includes("'courier_dni_released'");
  },
  noSupportPropAtServerPage: (f) =>
    f.page.includes('<VehicleForm') && !f.page.includes('supportWhatsAppHref'),
  noSupportHrefInClientForm: (f) =>
    f.form.startsWith("'use client';") && !f.form.includes('supportWhatsAppHref'),
  missingFiveFailedFinalizeDoD: (f) =>
    !f.task.includes('cinco errores DNI_ALREADY_REGISTERED'),
  claimsTwoFilesToCompare: (f) =>
    f.cc.includes('compara las fotos de los dos postulantes'),
};

for (const [name, guard] of Object.entries(guards)) {
  assert.equal(guard(files), true, 'control base falla: ' + name);
}
console.log('BASELINE 6/6 observaciones verdaderas (inspección estática)');

const mutants = [
  ['pendingHidden', (f) => ({...f,
    queue: f.queue.replace("(p_status <> 'pending' or c.application_submitted)",
      "(p_status <> 'pending' or true)")})],
  ['releaseReasonInvisible', (f) => ({...f,
    queries: f.queries.replace("'admin_reinstate_courier',",
      "'admin_reinstate_courier',\n  'courier_dni_released',")})],
  ['noSupportPropAtServerPage', (f) => ({...f,
    page: f.page.replace('<VehicleForm', '<VehicleForm supportWhatsAppHref={supportWhatsAppHref}')})],
  ['noSupportHrefInClientForm', (f) => ({...f,
    form: f.form.replace('const EMPTY_INITIAL_DOCS',
      'const supportWhatsAppHref = null;\nconst EMPTY_INITIAL_DOCS')})],
  ['missingFiveFailedFinalizeDoD', (f) => ({...f,
    task: f.task + '\n- cinco errores DNI_ALREADY_REGISTERED consumen cupo\n'})],
  ['claimsTwoFilesToCompare', (f) => ({...f,
    cc: f.cc.replace('compara las fotos de los dos postulantes', 'compara otra cosa')})],
];
let killed = 0;
for (const [name, mutate] of mutants) {
  const changed = mutate(files); // Solamente strings en memoria; originales intactos.
  const caught = guards[name](files) === true && guards[name](changed) === false;
  assert.equal(caught, true, 'mutación CIEGA: ' + name);
  killed++;
}
console.log('MUTACIONES EN MEMORIA: ' + killed + '/6 detectadas');
console.log('NOTA: no demuestra ningún caso RED funcional; solo sensibilidad de observaciones estáticas.');
NODE
node /tmp/pr709-r1-static.mjs "$PWD"
```

Si el archivo es copiado a `/tmp` y ejecutado con el argumento del repo (`"$PWD"`), no modifica el clone. Se debe correr SOBRE `68ed5ba9`: los guards del script detectan los defectos originales, por lo que varios dejarán de ser verdaderos después de que se corrija la ficha. No reutilizarlo como test de aprobación de la futura implementación.

## Comandos de repo pendientes para quien tenga clon

```bash
git fetch origin
git ls-remote origin refs/heads/feat/T-434-sec09-dni-oracle
git diff origin/develop...origin/feat/T-434-sec09-dni-oracle --stat
git log --oneline -- docs/revision-pr/pr-709/
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
pnpm exec vitest run tools > /tmp/pr709-tools.log 2>&1
grep -E 'Test Files|Tests|passed|failed' /tmp/pr709-tools.log | tail -10
```

**NO** lanzar Docker/Supabase local, no ejecutar comandos de Supabase/Vercel remotos, no tocar env/secretos. Si la PR mantiene bloqueantes, CI solo se menciona como no revisado; NO afirmar que está verde.

## Tests y mutaciones RED→GREEN para la futura PR de implementación, NO ejecutados en R1

- M01: 5 `DNI_ALREADY_REGISTERED` con documentación válida, consumo confirmado, sexto `RATE_LIMITED` sin finalize. Mutación: omitir consumo cuando finalize falla; el mismo test debe ponerse rojo.
- M02: límite real 5 por cuenta/ventana; mutación umbral 6, 6ª rechazada falla en pgTAP.
- M03: ADMIN aal1 / courier / anon no pueden buscar candidatos ni liberar; mutación quitar `assert_admin_aal2`, pgTAP debe ir rojo.
- M04: búsqueda de disputa recupera `pending/application_submitted=false` con docs, sin exponer `dni_hmac`; mutación quitar filtro o incluir hash en JSON, pgTAP rojo.
- M05: `courier_dni_released` expone etiqueta, cambio y motivo en UI; mutación quitar evento de `AUDIT_REASON_ACTIONS`, Vitest rojo.
- M06: motivo `null`, espacios, 2 y 501 => `VALIDATION_ERROR`, sin update/audit; 3/500 aceptados. Mutación quitar `btrim` y otra ampliar límite; pgTAP rojo.
- M07: reinstate después de liberar no aprueba; mutación eliminar guarda, pgTAP rojo.
- M08: número WhatsApp inválido => href null y texto de indisponibilidad; válido => enlace al soporte sin DNI; mutación omitir prop al formulario, test SSR/UI rojo.
- M09: dos liberaciones dejan un audit; mutación quitar guarda de `dni_hmac is not null`, falla la aserción de contador.
- M10: dos consumos simultáneos conservan conteo sin overflow aceptado. Mutación convertir upsert atómico a `select`/`update` separados, test de concurrencia rojo.

**Condición para certificar:** en la segunda ronda reproducir las salidas de test y CI exact-head, examinar mocks y resultado del caso semántico, no copiar «esperado rojo» de bitácora. Nunca inventar `Tests failed`.
---

## Ronda 2 — inspección del head 1c84e997 (2026-11-12)

**Origen:** conector GitHub, contenido completo de CC-050, T-434, fila T-434 del plan y log del SHA. `develop` continúa en `dba3314f`. Comparación desde `d74611f`: un commit, cuatro documentos. La carpeta de revisión seguía sin cambios.

**Aserciones independientes ejecutadas directamente sobre los textos recuperados (no usando `docs/revision-pr/**`):** 6/6 PASS para las correcciones H01–H06. **Mutaciones en memoria:** 6/6 controles cambian de verdadero a falso al retirar una cláusula propia. No son tests RED→GREEN de PostgreSQL ni del código que aún no existe. El arnés previo de `evidencia/comandos.md` **no fue ejecutado**.

**Control de seguridad nuevo (H07):** calculado independientemente con `Intl.DateTimeFormat` para el instante `2026-11-12T17:00:00Z`. Inicios de día: UTC=`00:00Z`; Tucumán=`03:00Z`; Los Ángeles=`08:00Z`. La fuente contractual contiene `date_trunc('day', now())` sin tercer parámetro. La documentación de PostgreSQL establece que depende del `TimeZone` de sesión; PostgREST documenta `Prefer: timezone`. No hubo prueba contra instancia ni endpoint real. Fuentes:
- https://www.postgresql.org/docs/16/functions-datetime.html
- https://docs.postgrest.org/en/v12/references/api/preferences.html#timezone

**Control de contratos H08:** `CC-050:135` indica `returns jsonb`, `:144` «hasta 10 filas»; `:174` requiere objeto `{ candidates: array }`. `:142` menciona cast `p_lookup::uuid` o teléfono en el mismo paso, sin prohibir evaluar cast en rama telefónica. La ruta real aun NO existe: defecto por ambigüedad documental, no crash observado.

**Control H09:** `CC-050:220` mantiene «dos RPC», mientras `:3-8` lista tres; cuerpo PR viejo solo enumera D1–D3 y conserva «revisión independiente pendiente».

### Harness del revisor R2 (copiar a /tmp; NO ejecutar desde docs/revision-pr)

Se conserva el control completo aquí para reproducción con un clone en `1c84e997`. **La ejecución independiente original se hizo sobre strings entregados por GitHub mediante JS del conector; este fichero Node de /tmp no se ejecutó en la presente sesión.** No modificar ni parchear la copia del repo para conseguir verde.

```bash
cat > /tmp/pr709-r2-doc-assertions.mjs <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || process.cwd();
const get = p => readFileSync(path.join(root, p), 'utf8');
const docs = {
  cc: get('docs/contracts/CC-050.md'),
  task: get('docs/tasks/T-434.md'),
  plan: get('docs/implementation-plan.md').split('\n').find(s=>s.startsWith('| T-434 |')) || '',
  log: get('docs/tasks/log/T-434.md'),
};
const checks = {
  H01(d) {return /### 3b\. Búsqueda/.test(d.cc)&&d.cc.includes('admin_find_courier_dispute_candidates')&&d.cc.includes('phoneMasked')&&d.cc.includes('application_submitted = false')&&d.task.includes('dispute-candidates.tsx')&&d.plan.includes('dispute-candidates');},
  H02(d) {return d.cc.includes('courier_dni_released')&&d.cc.includes('AUDIT_REASON_ACTIONS')&&d.cc.includes('AUDIT_CHANGE_FIELDS')&&d.task.includes('audit-format.test.ts');},
  H03(d) {return d.cc.includes('Cinco veces seguidas')&&d.cc.includes('sexto consumo da '+String.fromCharCode(96)+'RATE_LIMITED')&&d.task.includes('exactamente un audit');},
  H04(d) {return d.cc.includes('buildSupportWhatsAppHref')&&d.cc.includes('supportWhatsAppHref: string | null')&&d.task.includes('/vehicle/page.test.tsx');},
  H05(d) {return d.cc.includes('Alcanzaste el máximo de 5 intentos')&&d.plan.includes('actions,actions.test,copy');},
  H06(d) {return d.task.includes('Dependencias existentes en develop')&&d.cc.includes('No fueron una elección expresa')&&d.log.includes('no fueron una elección expresa');},
};
for (const [id, check] of Object.entries(checks)) {
  assert.equal(check(docs), true, id+' baseline no documenta la corrección');
}
console.log('BASELINE R2: 6/6 cláusulas verificadas por inspección');

const mutations = {
  H01: d=>({...d,cc:d.cc.replace('### 3b. Búsqueda','### 3b. NO HAY Búsqueda')}),
  H02: d=>({...d,cc:d.cc.replace('AUDIT_REASON_ACTIONS','NO_ALLOWLIST')}),
  H03: d=>({...d,cc:d.cc.replace('Cinco veces seguidas','Algunas veces')}),
  H04: d=>({...d,cc:d.cc.replace('supportWhatsAppHref: string | null','sin soporte')}),
  H05: d=>({...d,cc:d.cc.replace('Alcanzaste el máximo de 5 intentos','Error genérico')}),
  H06: d=>({...d,cc:d.cc.replace('No fueron una elección expresa','Fue una elección expresa')}),
};
let caught=0;
for(const [id, mutate] of Object.entries(mutations)){
  assert.equal(checks[id](mutate(docs)), false, id+' MUTACIÓN NO DETECTADA');
  caught++;
}
console.log('MUTACIONES EN MEMORIA (documentales): '+caught+'/6 detectadas');

assert.equal(docs.cc.includes("date_trunc('day', now())"),true, 'ya se arregló H07');
assert.equal(docs.cc.includes("date_trunc('day', now(),"),false, 'la RPC ya fijó TimeZone');
console.log('H07 en HEAD R2: el SQL aún depende de TimeZone');

const starts = [
  ['UTC','2026-11-12T00:00:00Z'],
  ['America/Argentina/Tucuman','2026-11-12T03:00:00Z'],
  ['America/Los_Angeles','2026-11-12T08:00:00Z']
];
assert.equal(new Set(starts.map(([zone,s])=>s)).size,3);
console.log('MISMO INSTANTE: inicios en UTC: '+starts.map(([z,s])=>z+'='+s).join('; '));
console.log('IMPORTANTE: no se ejecutó una llamada a Supabase/PostgREST ni tests funcionales RED.');
NODE
node /tmp/pr709-r2-doc-assertions.mjs "$PWD"
```

**Nota del verificador:** las mutaciones anteriores prueban que la inspección textual detecta pérdida de requisitos, NO prueban que un test de producción realmente falla al quitar las guardas. La batería funcional nueva se pide para la PR de implementación.

### Batería RED obligatoria para implementación T-434 (todavía no ejecutada)

1. H07: misma cuenta, mismo instante y cinco consumos, cambiar `set_config('TimeZone','UTC',true)` → `set_config('TimeZone','America/Argentina/Tucuman',true)`. Resultado: 6.º `RATE_LIMITED`, una única fila de ventana, no se reabre cupo. **Mutación:** quitar tercer argumento de `date_trunc` → falla pgTAP.
2. H08: RPC vacía da `{"candidates":[]}` (objeto, no array raíz); RPC no vacía devuelve objeto con máximo 10; `RPC_CONTRACTS` y wrapper la aceptan. **Mutación:** `jsonb_agg` raíz sin envelope → Vitest/pgTAP rojo.
3. H08: buscar teléfono `3812345678` y `+54 (9) 3812345678` según normalización pactada sin `invalid input syntax for type uuid`, y rechazar `foo3812345678`/`%3812345678`. **Mutación:** mover `p_lookup::uuid` a la rama telefónica o aceptar input basura -> rojo.
4. Mantener y verificar los casos ya añadidos en R2: 5 fallos de `finalize` consumen 5, sexto rechaza; AAL2 de búsqueda; liberación auditada y sin hash; WhatsApp inválido sin href; filtro `pending` sin envío.
5. No fabricar RED/GREEN, no simular éxito por mocks que eviten RPC real, no usar test skipping, no correr Docker local ni tocar credenciales.

**CI:** no se revisó como criterio de aprobación debido a dos bloqueantes. `tools 123/123` lo dice el autor, no hay reproducción del revisor. Los comandos Git `merge-tree` y `node docs/revision-pr/analizar.mjs verificacion` no se ejecutaron; el segundo está expresamente excluido por la regla de no correr scripts desde `docs/revision-pr/**`.
---

## R3 — head b5983ed3, 2026-11-12

**Verificación real con conector GitHub y JS en memoria:** head exacto y base; diff R2→R3 solo 3 docs; H07–H09 3/3 comprobaciones documentales verdaderas y 3/3 mutaciones sensibles. H10 1/1 comprobación de campo inexistente respaldada por DDL/tipos/CC-044 y 1/1 mutación del alias en texto detectada. **No** se ejecutaron pgTAP, CI, Vitest, Docker ni scripts de `docs/revision-pr/**`. `tools 123/123` lo afirma el autor.

### Script completo portable de los controles R3

Instrumento en `/tmp`, no en `docs/revision-pr/**`. El JS original del revisor se ejecutó sobre textos recuperados por GitHub; este equivalente Node **no se ejecutó en el contenedor actual**. Reproducir solo contra el clone de `b5983ed3`:

```bash
cat > /tmp/pr709-r3-static.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.argv[2]||process.cwd();
const get=p=>readFileSync(path.join(root,p),'utf8');
const d={
 cc:get('docs/contracts/CC-050.md'),
 task:get('docs/tasks/T-434.md'),
 log:get('docs/tasks/log/T-434.md'),
 ddl:get('supabase/migrations/20260922031435_schema_v1.sql'),
 types:get('src/types/database.types.ts'),
 cc044:get('supabase/migrations/20261104200100_cc044_admin_list_applicants.sql')
};
const checks={
 H07:x=>x.cc.includes("date_trunc('day', now(), 'America/Argentina/Tucuman')")&&x.cc.includes('`pg_get_functiondef`')&&x.cc.includes('`America/Los_Angeles`')&&x.task.includes('`date_trunc` sin la zona fija'),
 H08:x=>x.cc.includes("jsonb_build_object('candidates', coalesce(v_rows, '[]'::jsonb))")&&x.cc.includes('`if v_lookup ~*')&&x.cc.includes('`elsif v_lookup ~')&&x.cc.includes('`else` → `VALIDATION_ERROR`')&&x.task.includes('foo3812345678'),
 H09:x=>x.cc.includes('Sin las tres RPC nuevas')&&x.log.includes('PR709-H09:'),
 H10:x=>{
  const ct=x.types.split('      couriers: {')[1]?.split('      delivery_request_contacts: {')[0]||'';
  const cd=x.ddl.split('create table public.couriers (')[1]?.split(');')[0]||'';
  const pd=x.ddl.split('create table public.profiles (')[1]?.split(');')[0]||'';
  return x.cc.includes('order by c.created_at desc')&&!ct.includes('created_at:')&&!cd.includes('created_at')&&pd.includes('created_at')&&x.cc044.includes('p.created_at');
 }
};
for(const [name,fn] of Object.entries(checks))assert.equal(fn(d),true,name+' baseline');
console.log('BASELINE: 4/4 (H07–H09 correctas en docs, H10 error de campo confirmado)');
const mutants={
 H07:x=>({...x,cc:x.cc.replace("date_trunc('day', now(), 'America/Argentina/Tucuman')","date_trunc('day', now())")}),
 H08:x=>({...x,cc:x.cc.replace("jsonb_build_object('candidates', coalesce(v_rows, '[]'::jsonb))","coalesce(v_rows,'[]'::jsonb)")}),
 H09:x=>({...x,cc:x.cc.replace('Sin las tres RPC nuevas','Sin las dos RPC nuevas')}),
 H10:x=>({...x,cc:x.cc.replace('order by c.created_at desc','order by p.created_at desc, c.profile_id desc')})
};
for(const [name,fn] of Object.entries(mutants))
 assert.equal(checks[name](fn(d)),false,name+' mutación no detectada');
console.log('MUTACIONES EN MEMORIA: 4/4 detectadas. NO son tests SQL RED/GREEN.');
NODE
node /tmp/pr709-r3-static.mjs "$PWD"
```

**Prueba RED futura** de `cc050_courier_dni_hardening.sql`: varias filas con fechas conocidas + empate; verificar array de IDs en orden `p.created_at DESC,c.profile_id DESC`, no solo contar filas. Mutación de alias `c.created_at` y mutación de quitar `ORDER BY` deben poner el test en rojo, y restaurar el orden correcto debe dejarlo verde. Solo para la PR de implementación.
---

## Ronda 4 — PR #709 head 1a0b53d6 (2026-11-12)

### Qué se verificó, sobre qué SHA

- GitHub head exacto `1a0b53d6caeb028f471182ed9055896ceb3cd593`, base `dba3314f17f2068b6ff0c7596476d81c2c92e1c1`.
- `compare_commits(7ad637db,1a0b53d6)`: un commit, tres archivos documentales (`CC-050.md` +8/-3; `T-434.md` +3/-1; `log/T-434.md` +15). Ficha y plan conservan archivos permitidos. Sin edición de la carpeta del revisor por parte del agy.
- Fuente de H10: `CC-050 `3b`, `T-434 DoD`, DDL `schema_v1`, `database.types.ts` y SQL de `CC-044` desde develop. **9/9 comprobaciones independientes verdes y 4/4 mutaciones de strings en memoria detectadas**. El control realiza cruces de alias, permisos previstos, campos declarados, DoD de secuencia, fechas, UUIDs y count.
- **19/19 campos contrastados contra `database.types.ts`** en `profiles`, `couriers`, `courier_documents`, `rate_limits` y `audit_log`. Esquema DDL confirma `profiles.created_at`, no `couriers.created_at`. `CC-044` usa `p.created_at`.
- **CI real leído:** run [43193576599](https://github.com/cadeApp/cadeApp/actions/runs/43193576599) de ese SHA `cancelled`, sin jobs; combinado: `approval-policy` y Vercel `success`. No CI GREEN. Autor declara `pnpm exec vitest run tools` 123/123, no reproducido por el revisor.
- **No ejecutado:** clone local, typecheck, lint, unit, test:db, pgTAP, Docker, Supabase, `git merge-tree` o scripts de `docs/revision-pr/**`. Las mutaciones son **documentales en memoria**, no RED→GREEN SQL de la implementación que aún no existe.

### Control completo del revisor R4 (portable, sin ejecutar scripts de docs/revision-pr)

El siguiente script Node reproduce desde un clone limpio en el head exacto el control aplicado a los textos por JS del conector. El equivalente se **ejecutó en el runtime JS del revisor**; el script Node que se muestra abajo **no se ejecutó en esta sesión**. Guardarlo bajo `/tmp`, no en `docs/revision-pr/**`:

```bash
cat > /tmp/pr709-r4-static.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.argv[2]||process.cwd();
const get=p=>readFileSync(path.join(root,p),'utf8');
const d={
  cc:get('docs/contracts/CC-050.md'),
  task:get('docs/tasks/T-434.md'),
  types:get('src/types/database.types.ts'),
  schema:get('supabase/migrations/20260922031435_schema_v1.sql'),
  sql044:get('supabase/migrations/20261104200100_cc044_admin_list_applicants.sql')
};
const rowBlock=(table)=>d.types.split('      '+table+': {')[1]?.split('        Insert: {')[0]||'';
const cols={
  profiles:['display_name','phone','created_at','id'],
  couriers:['profile_id','status','application_submitted','dni_hmac'],
  courier_documents:['courier_id'],
  rate_limits:['subject','action','window_start','count'],
  audit_log:['actor_id','action','target_type','target_id','before','after']
};
const allCols=Object.entries(cols).every(([table,fields])=>fields.every(field=>new RegExp('^          '+field+': ','m').test(rowBlock(table))));
const order='order by p.created_at desc, c.profile_id desc';
const join='from public.couriers c join public.profiles p on p.id = c.profile_id';
const checks={
  contractJoin:d.cc.includes(join),
  contractOrder:d.cc.includes(order)&&!d.cc.includes('order by c.created_at'),
  contractLimit:d.cc.includes('`limit 10`'),
  doDSequence:d.task.includes('secuencia exacta sigue `p.created_at desc, c.profile_id desc`'),
  doDMutants:d.task.includes('Mutaciones: `c.created_at` (falla) y sin `order by` (cambia la secuencia)'),
  cc44Reference:d.sql044.includes('join public.profiles p on p.id = c.profile_id')&&d.sql044.includes('p.created_at'),
  schemaHasProfileDate:d.schema.includes('create table public.profiles')&&d.schema.includes('created_at timestamptz not null default now()'),
  typesNoCourierDate:!rowBlock('couriers').includes('created_at:'),
  allDomainColumns:allCols
};
for(const [name,ok] of Object.entries(checks))assert.equal(ok,true,name+' baseline');
console.log('BASELINE: 9/9 hechos sobre fuentes reales PASS');
const mut={
  badAlias:d.cc.replace(order,'order by c.created_at desc, c.profile_id desc'),
  noOrder:d.cc.replace(order,'-- no order'),
  noJoin:d.cc.replace(join,'from public.couriers c'),
  weakTest:d.task.replace('secuencia exacta sigue `p.created_at desc, c.profile_id desc`','solo cuenta candidatos')
};
assert.equal(mut.badAlias.includes(order),false);
assert.equal(mut.noOrder.includes(order),false);
assert.equal(mut.noJoin.includes(join),false);
assert.equal(mut.weakTest.includes('secuencia exacta sigue `p.created_at desc, c.profile_id desc`'),false);
console.log('MUTACIONES DOC EN MEMORIA: 4/4 detectadas (sin escribir archivos)');
console.log('COLUMNAS: 19/19 por 5 tablas; no se ejecutó SQL ni CI');
NODE
node /tmp/pr709-r4-static.mjs "$PWD"
```

**Precaución:** el caso de la futura pgTAP debe insertar candidatos deliberadamente fuera del orden exigido y comparar la **secuencia completa de UUIDs**, no confiar en que quitar `ORDER BY` altere la salida espontáneamente. Las mutaciones de alias y de ausencia de ORDER BY deberán comprobarse en RED/GREEN de **la PR de implementación**, no en esta documental.

### Checks que deben constar antes del merge documental

- `CI` del head 1a0b53d6: **cancelado**, no evaluable; sin salida de typecheck/lint/unit/db-tests.
- `approval-policy` success; Vercel success. No se sustituye un workflow cancelado por estos checks.
- **No ejecutar manualmente CI o workflow desde esta revisión**. El commit documental de revisión puede lanzar un workflow nuevo, pero por regla no se exige verde nuevo **solo** por ese commit. Queda al responsable del merge verificar el gate exigido por el repositorio y los logs de una corrida que realmente haya terminado o el procedimiento de excepción documentado.
