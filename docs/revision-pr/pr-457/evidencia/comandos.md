# Evidencia y comandos — PR #457 / T-386, ronda 1

**HEAD:** `ebffc06f72b1fd7a9cd24a78fd6cfcd3b600535d`

Los comandos propios de PostgreSQL **no se ejecutaron**: no hay Docker, base ni clon local en esta sesión. Solo se leyó CI de GitHub. No ejecutar las sondas contra Supabase remoto. Se preparan para una base efímera en CI.

## CI verificado en logs

[Run #39393534439](https://github.com/cadeApp/cadeApp/actions/runs/39393534439), SHA coincidente:
- `unit`: 151 archivos / 2920 tests PASS; workflow 79 y ADR 6 PASS.
- `db-tests`: `Files=33, Tests=2956`, `Result: PASS`; pgTAP `cc035_register_push_subscription.sql ... ok`.
- `cc035_concurrency.mjs` GREEN en alta/alta y reasignar/reasignar; mutación del retry RED y restauración GREEN (prueba **del autor**).
- `db:types --local` y `git diff --exit-code -- src/types/database.types.ts` PASS.

## H01 — Sondas pgTAP independientes a introducir

Ejecutar dentro del mismo fixture de `supabase/tests/cc035_register_push_subscription.sql`, después de `pg_temp.act_as(pg_temp.merchant_a())` y **antes del alta válida**, incrementando `plan()`. No alterar el SQL de producción para conseguir GREEN.

```sql
select throws_matching(
  $$ select public.register_push_subscription(
    jsonb_build_object('endpoint', pg_temp.endpoint(), 'p256dh', true, 'auth', 'AuthKey', 'platform', 'web')
  ) $$, 'VALIDATION_ERROR', 'p256dh booleano rechazado');
select throws_matching(
  $$ select public.register_push_subscription(
    jsonb_build_object('endpoint', pg_temp.endpoint(), 'p256dh', 'BKey', 'auth', 12345, 'platform', 'web')
  ) $$, 'VALIDATION_ERROR', 'auth numérico rechazado');
select throws_matching(
  $$ select public.register_push_subscription(
    jsonb_build_object('endpoint', pg_temp.endpoint(), 'p256dh', 'BKey', 'auth', 'AuthKey', 'platform', jsonb_build_object('x', 1))
  ) $$, 'VALIDATION_ERROR', 'platform objeto rechazado');
```

**RED esperado actual:** las llamadas con p256dh booleano/auth numérico devuelven éxito en lugar de VALIDATION_ERROR. **GREEN esperado:** todos rechazos y cero filas. No se presenta como resultado ya observado.

## H02 — Harness independiente para ORÁCULO y mutación de lock

Crear exactamente `/tmp/pr457-lock-oracle.mjs` copiando todo el siguiente script y usar un `DB_CONTAINER` efímero del runner de CI. No edita archivos tracked; instala temporalmente el cuerpo SQL mutado **solo en Docker local**, lo restaura siempre y exige un error de auditoría específico.

```js
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const container = process.env.DB_CONTAINER;
assert.ok(container, 'DB_CONTAINER requerido (DB local aislada)');
const sql = readFileSync(resolve('supabase/migrations/20261020123000_cc035_register_push_subscription.sql'), 'utf8');
const script = readFileSync(resolve('supabase/tests/integration/cc035_concurrency.mjs'), 'utf8');
const sqlNeedle = 'where endpoint = v_endpoint\n    for update;';
const testNeedle = '    const after = snapshot(endpoint);\n';
assert.ok(sql.includes(sqlNeedle), 'Falta el lock a mutar');
assert.ok(script.includes(testNeedle), 'Falta punto de inserción para auditoría');

const oracle = [
  "    const chain = JSON.parse(runSql(",
  "      \x60select coalesce(jsonb_agg(jsonb_build_object('from', before->>'user_id', 'to', after->>'user_id') order by id), '[]'::jsonb)::text",
  "       from public.audit_log where action = 'push_subscription_reassigned'",
  "       and target_id in (select id::text from public.push_subscriptions where endpoint = '${endpoint}');\x60",
  "    ));",
  "    assert.deepEqual(chain, [{from: userC, to: userA}, {from: userA, to: userB}], 'PR457 audit chain C→A→B');",
  ""
].join('\n');
const dir = mkdtempSync(join(tmpdir(), 'pr457-'));
const copy = join(dir, 'oracle.mjs');
writeFileSync(copy, script.replace(testNeedle, testNeedle + oracle));

function install(source) {
  const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
    {input: source, encoding: 'utf8'});
  assert.equal(r.status, 0, 'Error al instalar SQL local: ' + r.stderr);
}
function run() {
  return spawnSync(process.execPath, [copy], {cwd: process.cwd(), env: process.env, encoding: 'utf8', maxBuffer: 8000000});
}
try {
  const baseline = run();
  assert.equal(baseline.status, 0, 'Baseline no verde: ' + baseline.stdout + baseline.stderr);
  install(sql.replace(sqlNeedle, 'where endpoint = v_endpoint;'));
  const mutant = run();
  assert.notEqual(mutant.status, 0, 'ERROR: mutante sin FOR UPDATE siguió verde');
  assert.match(mutant.stdout + mutant.stderr, /PR457 audit chain C→A→B/, 'RED no fue por historia de auditoría');
  console.log('RED por before/after: confirmado');
} finally {
  install(sql);
  rmSync(dir, {recursive: true, force: true});
}
console.log('SQL original restaurado');
```

**Invocación (CI local solamente):** `DB_CONTAINER="$DB_CONTAINER" node /tmp/pr457-lock-oracle.mjs`.

**Limitación:** harness escrito para ejecutar al disponer de DB aislada. No fue copiado ni probado en /tmp de un clon, no se afirma que su RED haya ocurrido. El autor debe incorporar esta observación al suite permitido y demostrar RED→GREEN en CI; una falla por timeout o contenedor NO cuenta.

## Comandos finales permitidos (tras arreglos)

```bash
git fetch origin
git pull --ff-only
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin feat/T-386-cc035-push-subscription
```

El `db-tests` oficial reemplaza la base local; no iniciar Supabase ni Docker en la máquina de revisión, no disparar workflows manuales ni debilitar tests para obtener verde.

## Ronda 2 — 2026-10-20 (HEAD adae6466d2e9ca8fd80c31134617a4347da3fbbe)

La ejecución de **PostgreSQL** no es propia: se confrontaron directamente los logs RED del run `39397626046` (SHA `e72ae94e`) y GREEN del run `39398396861` (SHA de código `d1b903a6`). H01: `Failed test 16/17/19/20` → `cc035_register_push_subscription.sql ... ok` (`41` aserciones); `Files=33, Tests=2959, Result: PASS`. H02: mutante del lock registra `[C→A, C→B]`, restauración `C→A→B`; también se preserva el RED→GREEN del retry. H03: comentario sobre su RPC.

### Harness completo de sondas independientes (ESTÁTICAS)

Script autocontenido para copiar a `/tmp/pr457-r2-static.mjs` **desde un checkout** de `adae6466` y ejecutar con Node. Lee SQL/pgTAP/JS reales y prueba que las comprobaciones de fuente se vuelven rojas al mutar los **textos**. **No representa una segunda reproducción de las carreras en PostgreSQL.**

```js
// Guardar en /tmp/pr457-r2-static.mjs y ejecutar desde el checkout de la PR:
// node /tmp/pr457-r2-static.mjs
// Comprobaciones de estructura/fuente; NO ejecuta SQL ni reemplaza pgTAP.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const sql=read('supabase/migrations/20261020123000_cc035_register_push_subscription.sql');
const tap=read('supabase/tests/cc035_register_push_subscription.sql');
const race=read('supabase/tests/integration/cc035_concurrency.mjs');
const contract=read('src/domain/rpc-contracts.ts');
const ci=read('.github/workflows/ci.yml');
const has=(s,needle)=>s.includes(needle);
const scenario2 = s => s.slice(s.indexOf('async function scenario2('),s.indexOf('async function mutationCheck('));
const h03=s=>{const a=s.indexOf('register_push_subscription: {');const b=s.indexOf('get_request_offer_couriers: {',a);
 return a>=0 && b>a && /CC-016:[\s\S]*\*\/\s*$/.test(s.slice(b-250,b));};
const checks=[
 ['H01 endpoint',sql,s=>has(s,"jsonb_typeof(p_payload->'endpoint') is distinct from 'string'"),s=>s.replace("jsonb_typeof(p_payload->'endpoint')","jsonb_typeof(p_payload->'otro')")],
 ['H01 p256dh',sql,s=>has(s,"jsonb_typeof(p_payload->'p256dh') is distinct from 'string'"),s=>s.replace("jsonb_typeof(p_payload->'p256dh')","jsonb_typeof(p_payload->'otro')")],
 ['H01 auth',sql,s=>has(s,"jsonb_typeof(p_payload->'auth') is distinct from 'string'"),s=>s.replace("jsonb_typeof(p_payload->'auth')","jsonb_typeof(p_payload->'otro')")],
 ['H01 platform',sql,s=>has(s,"jsonb_typeof(p_payload->'platform') not in ('null', 'string')"),s=>s.replace("jsonb_typeof(p_payload->'platform')","jsonb_typeof(p_payload->'otro')")],
 ['H02 before/after',race,s=>has(s,"jsonb_build_object('from', before->>'user_id', 'to', after->>'user_id')"),s=>s.replace("before->>'user_id'","'constante'")],
 ['H02 C→A→B',race,s=>has(scenario2(s),'{ from: userA, to: userB }'),s=>s.replace('{ from: userA, to: userB },','{ from: userC, to: userB },')],
 ['H02 quitar lock',race,s=>has(s,"originalSql.replace(lockClause, ';')"),s=>s.replace("originalSql.replace(lockClause, ';')","originalSql")],
 ['H03 comentario',contract,h03,s=>s.replace("get_request_offer_couriers: {","otro_nombre: {")],
];
for(const [name,source,check,mutate] of checks){
 assert.ok(check(source),name+' BASE no cumple');
 const mutant=mutate(source);assert.notEqual(mutant,source,name+' mutación no aplicada');
 assert.equal(check(mutant),false,name+' mutante siguió verde (sonda ineficaz)');
 console.log(name+': GREEN fuente → RED estático del mutante');
}
assert.ok(has(tap,'p256dh booleano: VALIDATION_ERROR'));
assert.ok(has(tap,'auth numérico: VALIDATION_ERROR'));
assert.ok(has(tap,'los rechazos no crearon filas'));
assert.ok(has(race,"auditChain(endpoint), [{ from: userA, to: userB }]"));
assert.ok(has(race,"runSql(originalSql)"));
assert.ok(has(ci,'cc035_concurrency.mjs --mutation-lock-check'));
assert.ok(has(ci,'cc035_concurrency.mjs --mutation-check'));
console.log('8/8 baseline y mutantes estáticos detectados; coherencia pgTAP/CI PASS. Sin ejecución DB.');

```

**Resultado de las sondas propias contra blobs del HEAD vía GitHub:** guardas JSONB de endpoint/p256dh/auth/platform presentes, pgTAP negativo presente, comparaciones de la cadena presentes, modo de mutación conectado a CI; las seis mutaciones estáticas dirigidas de H01/H02 resultaron detectables. La comprobación específica de H03 se ajustó para usar el símbolo siguiente, dio baseline GREEN y detectó la alteración del identificador. Estas sondas se ejecutaron en memoria mediante la conexión GitHub; el script Node adjunto se entrega para reproducción pero **no se ejecutó en un checkout local** en esta sesión (sin clon). No se ejecutó `node --check` sobre archivos del repositorio ni DB local.
