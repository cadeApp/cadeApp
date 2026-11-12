# Evidencia reproducible — PR #711, R1

**Verificación documental GitHub, no ejecución local de Supabase.** SHA de código: `6beb2104`; SHA inspeccionado: `0d6ee1fc`. Base `develop@c41129d3`. Sin clon local (el contenedor disponible no resuelve github.com); no se ejecutaron `pnpm`, `git merge-tree`, Docker, Supabase ni E2E. La evidencia SQL se contrasta con los logs del runner oficial y los scripts independientes son *inspección*, no pgTAP.

## Comprobaciones de GitHub

- `GET /repos/cadeApp/cadeApp/pulls/711`: head `0d6ee1fc4b395bd7e2a560e131700a04e1e51704`, base `c41129d3`, 48 archivos, 15 commits; mergeable=true en el snapshot.
- `GET /repos/cadeApp/cadeApp/actions/runs/43196349049/jobs` + logs `db-tests`, `unit`: RED, fallo SQL al no existir `consume_courier_application_attempt()`; Vitest 41 failed / 3865 passed.
- `GET /repos/cadeApp/cadeApp/actions/runs/43200528662/jobs` + logs `db-tests`, `unit`: GREEN, pgTAP `cc050_courier_dni_hardening.sql .... ok`, `Files=47, Tests=3932, Result: PASS`, `Tests 3926 passed (3926)`. job `db-tests` genera tipos locales y ejecuta `git diff --exit-code -- src/types/database.types.ts` correctamente. Job typecheck, lint, build, audit, bundle-budget exitosos.
- Mutaciones SQL (PR #712–#726) jobs db-tests de runs `43200566691, 43200581098, 43200593834, 43200608192, 43200621374, 43200635604, 43200649732, 43200666399, 43200682412, 43200697703, 43200713142, 43200722416, 43200738407, 43200756081, 43200769706`: 15/15 failure; logs confirman ids de pruebas 18,19,22,27; 26; 36,39; 47,49; 29,30; 45; 54; 56,57; 67,68,72; 11,22,23; 64–72; excepción UUID; 61,62; excepción de columna; 67. Excepción SQL aborta algunos tests: no equipararla con aserción específica.
- Mutaciones TS locales del autor: resultados anotados en `docs/tasks/log/T-434.md`, **no reproducidas por revisor**.
- H04: `GET /repos/cadeApp/cadeApp/commits/f9741d3439b15b96218e64b051bc3bd99f0d9891` (autor/committer Lautaro Emanuel Jimenez, 5 documentos); `GET .../commits/5baba42f1926f2179b09c41dc6f52286870c758b` (dos padres: `2989aaeb`, `f9741d34`). Retiro de H04 respaldado.

## Arnés independiente completo, para copiar a /tmp y ejecutar sobre el checkout del SHA

**No ejecutar scripts dentro de `docs/revision-pr/**`**. Este bloque crea el arnés en `/tmp`. `--expect-red` exige los cinco invariantes faltantes en el SHA de R1. Sin esa bandera exige que los cinco pasen, para R2. También verifica tres mutaciones del detector en memoria. No escribe archivos del repo.

```bash
cat >/tmp/pr711-r1-static.mjs <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.argv[2];
assert.ok(root && fs.existsSync(path.join(root, 'src')), 'Pasá la raíz del checkout');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sql = read('supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql');
const detail = read('src/features/admin/components/applicant-detail-view.tsx');
const disputes = read('src/features/admin/components/dispute-candidates.tsx');
const page = read('src/app/(admin)/admin/applicants/disputes/page.tsx');
const fake = read('src/domain/testing/rpc-fake.ts');
function body(name) {
  const start = sql.indexOf('create or replace function public.' + name + '(');
  if (start < 0) return '';
  return sql.slice(start).split('$$;')[0];
}
const decide = body('admin_decide_courier');
const resolver = body('admin_find_courier_dni_reservation');
const pred = {
  H01_SQL: decide.includes('application_submitted') && decide.includes('for update') &&
           /not\s+v_application_submitted/i.test(decide),
  H01_UI: detail.includes('applicant.applicationSubmitted'),
  H02_POST: !disputes.includes('method="get"') &&
            !page.includes('searchParams') && /onSubmit/.test(disputes),
  H03_RPC: resolver.includes('assert_admin_aal2') &&
           resolver.includes('dni_hmac') &&
           resolver.includes('audit_log') &&
           /revoke all on function public\.admin_find_courier_dni_reservation/i.test(sql),
  H05_FAKE: !fake.includes('doc.courierId === courierId && doc.isCurrent') &&
            sql.includes('exists (select 1 from public.courier_documents d where d.courier_id = c.profile_id)')
};
for (const [k,v] of Object.entries(pred)) console.log(k + ': ' + (v?'PASS':'RED'));
const wantRed = process.argv.includes('--expect-red');
assert.equal(Object.values(pred).every(x => x === !wantRed), true,
  'Los predicados no concuerdan con el estado esperado');
const sensitivity = [
  ['H01', "if v_courier_status <> 'pending' then", "if v_courier_status <> 'pending' or not v_application_submitted then", x => /not v_application_submitted/.test(x)],
  ['H02', '<form method="get"', '<form method="post"', x => /method="post"/.test(x)],
  ['H05', 'doc.courierId === courierId && doc.isCurrent', 'doc.courierId === courierId', x => /doc\.courierId === courierId(?! && doc\.isCurrent)/.test(x)]
];
for (const [name,original,mutated,check] of sensitivity) {
  assert.equal(check(original), false, name + ' original');
  assert.equal(check(mutated), true, name + ' mutant');
  console.log('SENSIBILIDAD ' + name + ': baseline RED, mutada PASS');
}
NODE
node /tmp/pr711-r1-static.mjs "$PWD" --expect-red
```

**Resultado inspección dirigida sobre el head (datos leídos mediante GitHub):**

```text
RED H01_SQL
RED H01_UI
RED H02_POST
RED H03_RPC
RED H05_FAKE
SENSIBILIDAD H01: baseline=false, mutada=true
SENSIBILIDAD H02: baseline=false, mutada=true
SENSIBILIDAD H05: baseline=false, mutada=true
```

Limitación: el modo `--expect-red` confirma ausencia de predicados en R1. El arnés no simula ejecución de PostgreSQL; las mutaciones funcionales solicitadas en el informe deben producir verdaderos fallos de pgTAP/Vitest en la rama corregida.

## Reproducciones funcionales a exigir para R2

1. **H01**: pgTAP antes y después de quitar guarda en `admin_decide_courier` (dos decisiones, 0 updates y 0 audits); no basta afirmar que la UI oculta botones.
2. **H02**: tests DOM y, postmerge de migración, E2E garantizan POST y que el teléfono no aparece en URL; mutar a GET obliga al test a fallar.
3. **H03**: pgTAP con HMAC conocido, rol courier/aal1/aal2/anon, resultado exacto, audit sin PII, no auto-release. Mutantes contra cada propiedad y pruebas de action con secreto mockeado (nunca imprimir secreto real).
4. **H05**: test fake con sólo históricos; `documentsCount=0`; mutar elegibilidad a `isCurrent` falla.
5. Checks finales: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm exec vitest run tools`, `node --test .github/workflows/verify-workflows.test.mjs`; `test:db` + comparación de tipos a cargo del CI ya existente. Mantener E2E Develop para después de migración del entorno.

**Validación estructural:** todas las líneas de `hallazgos.jsonl` deben parsear con `JSON.parse`; al tener checkout local completo, ejecutar también `node docs/revision-pr/analizar.mjs verificacion`.

## Ronda 2 — `27dd4143` / implementación `0eef5a0f`

### Origen verificado

- `GET /repos/cadeApp/cadeApp/pulls/711`: head `27dd41437b7910797d19d7eca3e6864e5e95936c`, base `c41129d3`, `mergeable=true`. Commit de código padre: `0eef5a0f10c2bfd9b2fe9e44deb2efc812e928f3`.
- `compare 661991e2...27dd4143`: 2 commits (código y bitácora), 28 paths, ninguna edición de `docs/revision-pr/pr-711/`. Se verificaron blobs iguales en los cinco archivos de R1.
- `GET /actions/runs/43214418100`: head SHA `0eef5a0f`, `success`; jobs lint, unit, db-tests, build, typecheck, audit, bundle-budget todos exitosos. Logs descargados: `db-tests` = `cc050...ok`, `Files=47, Tests=3950, Result: PASS`; `unit` = `209 passed`, `3951 passed`. En `db-tests` existe y pasa el paso `git diff --exit-code -- src/types/database.types.ts` posterior a regenerar los tipos.
- Mutantes SQL #727–#732: seis ramas efímeras, seis runs failure con `db-tests` failure (los demás jobs pasan). Revisión directa de logs:
  
  | ID PR mutante | Run y SHA | Aserciones que fallan |
  |---|---|---|
  | #727 `decide-no-guard` | 43214527418 / `df25c454` | `75, 77` |
  | #728 `reservation-no-aal2` | 43214554074 / `0266df2b` | `82, 83, 85, 89, 91` |
  | #729 `reservation-hash-output` | 43214570915 / `8e0935a6` | `87` |
  | #730 `reservation-hash-audit` | 43214584575 / `188cde8c` | `90` |
  | #731 `reservation-no-filter` | 43214593441 / `461bbd3d` | `87, 88, 91` |
  | #732 `reservation-auto-release` | 43214608152 / `6dcc5cc3` | `92` |

- Cinco mutantes TS en la bitácora: GET, fake sólo vigentes, UI sin guarda, fake decide sin envío, action DNI claro. No se pudo reproducir localmente ni atribuir verificación independiente.
- `supabase/tests/rpc_admin.sql` antes de `finish()` sigue plan(111); el nuevo fixture marca pendientes enviados en `DO` con `set_config('app.courier_application_finalize','on')` como postgres/owner, no agrega documentos ni quita aserciones.
- **Límite del entorno:** sin checkout local, pnpm, git merge-tree, Postgres o Docker. Inspección con GitHub del SHA indicado y mutaciones estáticas en memoria, no ejecución de Vitest/pgTAP del revisor. La salida del GREEN ya existía al empezar esta ronda.

### Arnés de inspección independiente (completo)

El siguiente arnés sólo lee archivos. Guardarlo en `/tmp` en un checkout auténtico y limpio del commit. En `0eef5a0f` debe dar H01-H05 PASS y H06/H07 RED, con 7 mutaciones estáticas detectadas; en R3 se omite `--r2-red`. Este programa inspecciona propiedades estructurales, **no demuestra ejecución de Postgres/React**.

~~~bash
cat > /tmp/pr711-r2-static.mjs <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
assert.ok(root && fs.existsSync(path.join(root, 'src')), 'Uso: node /tmp/pr711-r2-static.mjs /ruta/al/checkout');
const file = p => fs.readFileSync(path.join(root, p), 'utf8');
const d = {
  sql: file('supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql'),
  ui: file('src/features/admin/components/dispute-candidates.tsx'),
  details: file('src/features/admin/components/applicant-detail-view.tsx'),
  page: file('src/app/(admin)/admin/applicants/disputes/page.tsx'),
  fake: file('src/domain/testing/rpc-fake.ts'),
  cc034: file('supabase/tests/cc034_admin_reinstate_courier.sql'),
};
function part(sql, name, next) {
  const from = sql.indexOf('create or replace function public.' + name);
  assert.ok(from >= 0, 'no existe ' + name);
  const end = next ? sql.indexOf('create or replace function public.' + next, from + 1) : sql.length;
  return sql.slice(from, end < 0 ? undefined : end);
}
function run(x) {
  const decide = part(x.sql, 'admin_decide_courier', 'admin_find_courier_dni_reservation');
  const reserve = part(x.sql, 'admin_find_courier_dni_reservation');
  const reinstate = part(x.sql, 'admin_reinstate_courier', 'admin_decide_courier');
  const audit = (reserve.split('insert into public.audit_log')[1] || '').split(';')[0];
  return {
    H01_SQL: decide.includes('for update') && decide.includes('or not v_application_submitted') &&
      decide.indexOf('or not v_application_submitted') < decide.indexOf('update public.couriers'),
    H01_UI: /applicant\.status === 'pending' && !applicant\.applicationSubmitted/.test(x.details),
    H02_POST: (x.ui.match(/method="post"/g) || []).length === 2 &&
      !x.ui.includes('method="get"') && !x.page.includes('searchParams'),
    H03_AUTH: reserve.includes('perform app_private.assert_admin_aal2();'),
    H03_FILTER: /where dni_hmac\s*=\s*p_dni_hmac/.test(reserve),
    H03_OUTPUT: reserve.includes("'courierId', v_courier_id, 'status', v_status") &&
      !reserve.includes("'dniHmac',") && !reserve.includes("'dni_hmac',") && !reserve.includes("'hash',"),
    H03_AUDIT: reserve.includes('courier_dni_reservation_searched') &&
      !/p_dni_hmac|'dni_hmac'|'dniHmac'/.test(audit),
    H05_FAKE: x.fake.includes('const hasAnyDocument') && x.fake.includes('hasAnyDocument(c.courierId)') &&
      !x.fake.includes('some((doc) => doc.courierId === courierId && doc.isCurrent);'),
    H06_CLEAR_CLAIMANT: /onChange=\{\(event\) => \{[\s\S]{0,200}setLookup\(event\.target\.value\);[\s\S]{0,200}setCandidates\(/.test(x.ui),
    H06_CLEAR_DNI: /onChange=\{\(event\) => \{[\s\S]{0,200}setDni\(event\.target\.value\);[\s\S]{0,200}setReservation\(/.test(x.ui),
    H06_EPOCH: /requestVersion|requestSeq|queryEpoch|requestEpoch/.test(x.ui) &&
      /if\s*\([^)]*(?:requestVersion|requestSeq|queryEpoch|requestEpoch)/.test(x.ui),
    H07_REINSTATE: reinstate.includes('or not v_application_submitted'),
  };
}
const before=run(d);
for(const [name,passes] of Object.entries(before))
  console.log(name + ' ' + (passes ? 'PASS' : 'RED'));
for(const name of ['H01_SQL','H01_UI','H02_POST','H03_AUTH','H03_FILTER','H03_OUTPUT','H03_AUDIT','H05_FAKE'])
  assert.equal(before[name], true, 'R1 no reparado: ' + name);
if(process.argv.includes('--r2-red')) {
  for(const name of ['H06_CLEAR_CLAIMANT','H06_CLEAR_DNI','H06_EPOCH','H07_REINSTATE'])
    assert.equal(before[name], false, 'se reparó antes de R2: ' + name);
}else{
  for(const name of ['H06_CLEAR_CLAIMANT','H06_CLEAR_DNI','H06_EPOCH','H07_REINSTATE'])
    assert.equal(before[name], true, 'invariante pendiente R2: ' + name);
}
const mutant=[
 ['M01_guard_SQL', 'H01_SQL', x=>({...x,sql:x.sql.replace('or not v_application_submitted then','then')})],
 ['M02_GET', 'H02_POST', x=>({...x,ui:x.ui.replace('method="post"','method="get"')})],
 ['M03_reserva_no_aal2', 'H03_AUTH', x=>({...x,sql:x.sql.replace("begin\n  perform app_private.assert_admin_aal2();\n\n  if p_dni_hmac","begin\n\n  if p_dni_hmac")})],
 ['M04_reserva_no_filtro', 'H03_FILTER', x=>({...x,sql:x.sql.replace('where dni_hmac = p_dni_hmac','where dni_hmac is not null')})],
 ['M05_hash_salida', 'H03_OUTPUT', x=>({...x,sql:x.sql.replace("'courierId', v_courier_id, 'status', v_status)","'courierId', v_courier_id, 'status', v_status, 'dniHmac', p_dni_hmac)")})],
 ['M06_hash_audit', 'H03_AUDIT', x=>({...x,sql:x.sql.replace("coalesce(v_courier_id::text, 'none'),",'p_dni_hmac,')})],
 ['M07_fake_vigente', 'H05_FAKE', x=>({...x,fake:x.fake.replace('some((doc) => doc.courierId === courierId);','some((doc) => doc.courierId === courierId && doc.isCurrent);')})]
];
for(const [name,field,change] of mutant) {
  const after=run(change(d))[field];
  assert.equal(before[field], true, name+' baseline');
  assert.equal(after, false, name+' no detectado');
  console.log(name+' detectado: baseline PASS -> mutante RED');
}
const patchedSql=d.sql.replace('or (v_application_submitted and v_dni_hmac is null) then',
  'or not v_application_submitted or v_dni_hmac is null then');
assert.equal(run({...d,sql:patchedSql}).H07_REINSTATE,true,'inserción de guarda H07 no detectada');
const patchedUI=d.ui
  .replace('onChange={(event) => setLookup(event.target.value)}',
    "onChange={(event) => { setLookup(event.target.value); setCandidates({ kind: 'idle' }); setReservation({ kind: 'idle' }); }}")
  .replace('onChange={(event) => setDni(event.target.value)}',
    "onChange={(event) => { setDni(event.target.value); setReservation({ kind: 'idle' }); setCandidates({ kind: 'idle' }); }}");
assert.equal(run({...d,ui:patchedUI}).H06_CLEAR_CLAIMANT,true,'reset claimant no detectado');
assert.equal(run({...d,ui:patchedUI}).H06_CLEAR_DNI,true,'reset DNI no detectado');
console.log('H06/H07: variantes sintéticas con guarda/reset detectadas. La protección async real requiere Vitest.');
NODE
node /tmp/pr711-r2-static.mjs "$PWD" --r2-red
~~~

**Ejecución independiente equivalente** sobre contenido leído con GitHub, en memoria (sin clon):

~~~text
PASS H01_SQL, H01_UI, H02_POST, H03_AUTH, H03_FILTER, H03_OUTPUT, H03_AUDIT, H05_FAKE
RED H06_CLEAR_CLAIMANT, H06_CLEAR_DNI, H06_EPOCH, H07_REINSTATE
M01..M07: siete mutantes detectados (baseline PASS → mutación RED)
H06: insertar resets en ambos onChange hace que los detectores pasen; todavía faltaría la protección de respuestas fuera de orden
H07: insertar 'or not v_application_submitted' hace pasar el detector estructural
~~~

El detector sobre forma de código es deliberadamente limitado: un arreglo equivalente con sintaxis distinta se reevalúa manualmente, y el estado `arreglado-verificado` requiere pruebas **funcionales independientes**. Para R3 la prueba crítica es Vitest deferred Promise (H06) y pgTAP sobre `admin_reinstate_courier` (H07) con mutación efímera propia.

### Evidencia del bug alternativo H07

- `src/features/admin/components/applicant-detail-view.tsx:801-835`: sólo bloquea decisiones cuando status es `pending`; en `rejected/suspended` ofrece `reconsider/reactivate` independientemente de `applicationSubmitted`.
- `supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql:219-235`: condition `(v_application_submitted and v_dni_hmac is null)` permite pasar con `false,null`; luego UPDATE a approved + INSERT audit.
- `src/domain/testing/rpc-fake.ts:3497-3519`: reproduce exactamente ese caso.
- `supabase/tests/cc034_admin_reinstate_courier.sql:82-105,319-327`: semilla de repartidor rechazado con vehículo, tras migración CC-043 y sin marcar envío; aserción positiva espera `approved`. Test GREEN; por tanto ese conjunto de precondiciones habilita la transición en PostgreSQL. **No se ha probado la prevalencia de tales filas en la base de producción**.
- `supabase/migrations/20261104200000_cc043_courier_application.sql:12,21-25`: `application_submitted` default false y backfill sólo de históricos con `vehicle_type` cargado; el experimento de `cc034` inserta cuentas después de esa migración.

### Controles de R3 a pedir al autor

1. H06: búsqueda A, edición posterior B y respuesta tardía A (no link viejo), resultados dobles no mezclados, pruebas RTL sin sleeps; mutar reset y versionado por separado, mostrar RED/ GREEN.
2. H07: pgTAP `rejected/suspended+vehículo+not submitted+null HMAC` → `INVALID_STATE_TRANSITION`, 0 UPDATE/ audit; positive submitted+DNI. Mutar solo nueva guarda y demostrar fallo de la nueva prueba. Regresión de `cc034` y fake sin eliminar sus positivos originales.
3. Ejecutar checks de TypeScript/ESLint/Vitest completos y jobs CI cuando cambie código; **no repetir CI sólo porque el revisor commitea docs**.
