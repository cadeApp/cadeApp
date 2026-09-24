# Evidencia · PR #63 · T-103 · ronda 1

Revisión sobre `9f2e42e` (head de la PR, igual al de la ronda que empezó el otro chat). Esta sesión corre en
Linux, con checkout LF y **con Docker**: todo lo que el borrador estático decía «leído en el SQL» se corrió acá
contra la base local. CI **no se consultó**: la ronda tiene bloqueantes.

> Todas las sondas y mutaciones corren dentro de una transacción que termina en `rollback`, o sobre copias en
> memoria. Ninguna toca el repositorio salvo la batería estática de Vitest, que restaura los bytes originales
> desde memoria en un `finally` (AG-53) y se verificó con `git status --porcelain` limpio al terminar.

## Preparación

```bash
git fetch origin
git rev-parse origin/feat/T-103-request-lifecycle     # 9f2e42ed… = head de la PR
git merge-base origin/develop origin/feat/T-103-request-lifecycle   # b6b5f39 = origin/develop
git show origin/develop:docs/tasks/T-103.md           # ficha leída desde develop
git diff origin/develop...origin/feat/T-103-request-lifecycle -- docs/tasks/T-103.md
```

La PR modifica la ficha: solo agrega dos anotaciones entre paréntesis a entradas que **ya estaban** en «Archivos
permitidos» y tilda el DoD. Comparada línea a línea contra develop, **no amplía nada**.

Alcance: 7 archivos, los 7 dentro de «Archivos permitidos». Comentarios en la PR: ninguno.
Bitácora: última entrada 22:45, no cubre `9f2e42e` (ver H05). Nada mencionado en la bitácora falta en la rama.

## La receta del job `db-tests`, local

```bash
sudo dockerd &                       # el daemon no arranca solo en este contenedor
pnpm install --frozen-lockfile
pnpm supabase start
pnpm supabase test db                # Files=7, Tests=1330, Result: PASS
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -X -q -f supabase/tests/rpc_requests.sql \
  | grep -cE '^\s*ok [0-9]'           # 1153 ok · 0 not ok · plan 1..1153
pnpm db:types --local && git diff --exit-code -- src/types/database.types.ts   # sin diff
```

El «sin diff» de los tipos se verificó por otra vía (AG-60): el generador informó que escribió el archivo y su
`mtime` quedó 4 s antes del `date` siguiente. O sea que las 8 firmas escritas a mano que menciona la bitácora son
**idénticas** a la salida del generador.

## Checks locales

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | `✔ No ESLint warnings or errors`, exit 0 |
| `pnpm test` | `Test Files 1 failed | 31 passed (32)` · `Tests 1 failed | 294 passed (295)` |
| `vitest run src/server/supabase/clients.test.ts` en un worktree limpio de `9f2e42e` | `Tests 10 passed (10)` |

La única falla es el barrido de secretos de T-002 (`clients.test.ts`, «no hay claves reales en el repo»), que
encontró un JWT en `supabase/.temp/start-secrets/…`, un archivo que **generó el `supabase start` de esta sesión**,
ignorado por git (`.gitignore:48`). No lo abrí. En un worktree limpio del mismo SHA el archivo pasa 10/10: no es
de la PR. Como Vitest falló, `pnpm test` no corrió los pasos de workflows y ADR.

## Sondas en rojo (H01, H02, H03, H04, H07)

Se corren con el bloque de preparación de `supabase/tests/rpc_requests.sql` (líneas 1–91) delante, y
`select * from finish(); rollback;` detrás:

```bash
sed -n 1,91p supabase/tests/rpc_requests.sql > run.sql
cat sondas.sql >> run.sql
printf "select * from finish();\nrollback;\n" >> run.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -X -q -f run.sql
```

`sondas.sql`: cada aserción afirma el comportamiento **correcto**, así que hoy tiene que dar `not ok`. Las
marcadas «debe dar ok» son controles que prueban que la sonda no está sesgada.

```sql
-- Sondas de la revisión PR #63. Cada aserción afirma el comportamiento CORRECTO; hoy tienen que dar not ok.
-- H01: courier ajeno + suspendido reporta incidente en matched. CC-002 §4: participación antes de elegibilidad.
select pg_temp.fixture('matched');
update public.couriers set status = 'suspended' where profile_id = pg_temp.actor(4);
select is(pg_temp.invoke(4, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20)))->>'error',
  'UNAUTHORIZED_ACTOR', 'H01a: courier ajeno y suspendido -> UNAUTHORIZED_ACTOR (CC-002 §4)');
update public.couriers set status = 'approved' where profile_id = pg_temp.actor(4);
select is(pg_temp.invoke(4, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20)))->>'error',
  'UNAUTHORIZED_ACTOR', 'H01-control: courier ajeno aprobado -> UNAUTHORIZED_ACTOR (debe dar ok)');

-- H02: republicar una publicada vencida que el barrido todavía no persistió.
select pg_temp.fixture('published');
update public.delivery_requests set expires_at = now() - interval '1 second' where id = pg_temp.actor(20);
select is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->'data'->>'status',
  'published', 'H02: republicar publicada vencida sin cron');
select pg_temp.fixture('published');
update public.delivery_requests set status = 'expired', expires_at = now() - interval '1 second' where id = pg_temp.actor(20);
select is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->'data'->>'status',
  'published', 'H02-control: la misma, ya persistida expired, se republica (debe dar ok)');

-- H03: el motivo libre queda legible por un repartidor sin relación.
create function pg_temp.read_as(p_actor integer, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.actor(p_actor), 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute p_sql into v;
  set local role postgres;
  return v;
end $$;
select pg_temp.fixture('matched');
select ok(pg_temp.invoke(3, format('select public.courier_cancel_match(%L, %L)', pg_temp.actor(20), 'no atendia, porton verde')) ? 'data',
  'H03-pre: courier_cancel_match acepta (debe dar ok)');
select is(pg_temp.read_as(4, format('select status::text from public.delivery_requests where id = %L', pg_temp.actor(20))),
  'published', 'H03-pre: el repartidor 4 ve la solicitud publicada (debe dar ok)');
select is(pg_temp.read_as(4, format('select cancel_reason from public.delivery_requests where id = %L', pg_temp.actor(20))),
  null, 'H03a: repartidor sin relación NO lee el motivo libre de courier_cancel_match');
select pg_temp.fixture('matched');
select ok(pg_temp.invoke(1, format('select public.republish_request(%L, %L)', pg_temp.actor(20), 'la señora no estaba')) ? 'data',
  'H03-pre: republish desde matched acepta (debe dar ok)');
select is(pg_temp.read_as(4, format('select cancel_reason from public.delivery_requests where id = %L', pg_temp.actor(20))),
  null, 'H03b: repartidor sin relación NO lee el motivo libre de republish_request');

-- H04: la aserción de pg_locks pasa SIN llamar a ninguna RPC: la fixture ya tomó RowExclusiveLock.
select pg_temp.fixture('matched');
select ok(not (
  exists (select 1 from pg_locks where pid = pg_backend_pid() and relation = 'public.delivery_requests'::regclass and mode = 'RowExclusiveLock' and granted)
  and exists (select 1 from pg_locks where pid = pg_backend_pid() and relation = 'public.offers'::regclass and mode = 'RowExclusiveLock' and granted)),
  'H04: sin llamar a cancel_request la aserción de pg_locks NO debería cumplirse');

-- H07: distancia de puntos cercanos distintos (~111 m en latitud).
select pg_temp.fixture('draft');
update public.delivery_request_contacts set pickup_lat = -27.4300, pickup_lng = -65.6200,
  dropoff_lat = -27.4310, dropoff_lng = -65.6200 where request_id = pg_temp.actor(20);
select ok(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20))) ? 'data', 'H07-pre: publica (debe dar ok)');
select is((select route_distance_m from public.delivery_requests where id = pg_temp.actor(20)), 500,
  'H07: dos puntos distintos a ~111 m -> 500 como el dominio');

-- H01b al final: borrar al repartidor 4 rompe la fixture de estados publicados.
select pg_temp.fixture('matched');
delete from public.couriers where profile_id = pg_temp.actor(4);
select is(pg_temp.invoke(4, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20)))->>'error',
  'UNAUTHORIZED_ACTOR', 'H01b: courier ajeno sin registro de repartidor -> UNAUTHORIZED_ACTOR');
```

Salida en `9f2e42e`:

```text
not ok 1 - H01a: courier ajeno y suspendido -> UNAUTHORIZED_ACTOR (CC-002 §4)     have: COURIER_SUSPENDED
ok 2 - H01-control: courier ajeno aprobado -> UNAUTHORIZED_ACTOR (debe dar ok)
not ok 3 - H02: republicar publicada vencida sin cron                             have: NULL (error INVALID_STATE_TRANSITION)
ok 4 - H02-control: la misma, ya persistida expired, se republica (debe dar ok)
ok 5 - H03-pre: courier_cancel_match acepta (debe dar ok)
ok 6 - H03-pre: el repartidor 4 ve la solicitud publicada (debe dar ok)
not ok 7 - H03a: repartidor sin relación NO lee el motivo libre ...              have: no atendia, porton verde
ok 8 - H03-pre: republish desde matched acepta (debe dar ok)
not ok 9 - H03b: repartidor sin relación NO lee el motivo libre ...              have: la señora no estaba
not ok 10 - H04: sin llamar a cancel_request la aserción de pg_locks NO debería cumplirse
ok 11 - H07-pre: publica (debe dar ok)
not ok 12 - H07: dos puntos distintos a ~111 m -> 500 como el dominio              have: 0
not ok 13 - H01b: courier ajeno sin registro de repartidor -> UNAUTHORIZED_ACTOR   have: NOT_FOUND
# Looks like you failed 7 tests of 13
```

Dos datos complementarios, en transacciones aparte:

```text
H02 respuesta: {"error": "INVALID_STATE_TRANSITION", "sqlstate": "P0001"}
H04 modo con solo `select … for update`: RowShareLock        -- no RowExclusiveLock, como dice el comentario de :365
```

**Tropiezo del instrumento, anotado por AG-60:** en la primera corrida, H01b (que borra al repartidor 4) iba en el
medio y rompió la fixture de las sondas siguientes por la FK `offers_courier_id_fkey`: todas salieron con
`current transaction is aborted`. Lo moví al final. No se reportó nada de esa corrida.

## D01 · la misma tabla de doble falla, corrida de los dos lados

Actores: 1 = comercio dueño, 2 = comercio ajeno, 3 = repartidor asignado, 4 = repartidor ajeno, 5 = admin.

**RPC** (pgTAP local; preparación 1–91 delante):

```sql
create temporary table d01 (id text, out text);
create function pg_temp.c(p_id text, p_status text, p_actor integer, p_sql text, p_expired boolean default false,
  p_sub_expired boolean default false, p_c4 text default 'approved') returns void language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.fixture(p_status);
  if p_expired then update public.delivery_requests set expires_at = now() - interval '1 second' where id = pg_temp.actor(20); end if;
  if p_sub_expired then
    update public.platform_settings set value = 'false'::jsonb where key = 'pilot_active';
    update public.merchants set subscription_status = 'expired' where profile_id in (pg_temp.actor(1), pg_temp.actor(2));
  else
    update public.merchants set subscription_status = 'pilot' where profile_id = pg_temp.actor(2);
  end if;
  if p_c4 = 'none' then delete from public.couriers where profile_id = pg_temp.actor(4);
  else update public.couriers set status = p_c4::public.courier_status where profile_id = pg_temp.actor(4); end if;
  r := pg_temp.invoke(p_actor, format(p_sql, pg_temp.actor(20)));
  insert into d01 values (p_id, coalesce(r->>'error', case when r ? 'data' then 'ok' end));
end $$;
select pg_temp.c('S01','published',5,'select public.cancel_request(%L, ''Motivo'')');
select pg_temp.c('S02','matched',5,'select public.cancel_request(%L, ''Motivo'')');
select pg_temp.c('S03','in_transit',1,'select public.cancel_request(%L, ''Motivo'')');
select pg_temp.c('S04','published',2,'select public.cancel_request(%L, null)', true);
select pg_temp.c('S05','published',1,'select public.report_incident(%L, ''demora'', ''Demora de prueba'')', true);
select pg_temp.c('S06','matched',4,'select public.report_incident(%L, ''demora'', ''Demora de prueba'')', p_c4 => 'suspended');
select pg_temp.c('S07','draft',1,'select public.republish_request(%L, ''Motivo'')', p_sub_expired => true);
select pg_temp.c('S08','matched',1,'select public.republish_request(%L, null)', p_sub_expired => true);
select pg_temp.c('S09','published',1,'select public.report_no_show(%L, true)', p_sub_expired => true);
select pg_temp.c('S10','matched',2,'select public.report_no_show(%L, true)', p_sub_expired => true);
select pg_temp.c('S11','published',4,'select public.mark_picked_up(%L)');
select pg_temp.c('S12','draft',4,'select public.mark_picked_up(%L)');
select pg_temp.c('S13','matched',1,'select public.publish_request(%L)');
select pg_temp.c('C01','published',1,'select public.cancel_request(%L, null)');
select pg_temp.c('C02','matched',3,'select public.mark_picked_up(%L)');
select pg_temp.c('C03','draft',1,'select public.publish_request(%L)', p_sub_expired => true);
select pg_temp.c('C04','expired',1,'select public.republish_request(%L, null)');
select pg_temp.c('S15','published',1,'select public.republish_request(%L, null)', true);
select pg_temp.c('S14','matched',4,'select public.report_incident(%L, ''demora'', ''Demora de prueba'')', p_c4 => 'none');
select 'SONDA_RPC ' || string_agg(id || '=' || out, ' ' order by id) from d01;
rollback;
```

```text
SONDA_RPC C01=ok C02=ok C03=SUBSCRIPTION_INACTIVE C04=ok S01=INVALID_STATE_TRANSITION S02=INVALID_STATE_TRANSITION
S03=INVALID_STATE_TRANSITION S04=UNAUTHORIZED_ACTOR S05=INVALID_STATE_TRANSITION S06=COURIER_SUSPENDED
S07=INVALID_STATE_TRANSITION S08=REASON_REQUIRED S09=INVALID_STATE_TRANSITION S10=UNAUTHORIZED_ACTOR
S11=UNAUTHORIZED_ACTOR S12=UNAUTHORIZED_ACTOR S13=INVALID_STATE_TRANSITION S14=NOT_FOUND S15=INVALID_STATE_TRANSITION
```

**Fake** (archivo descartable copiado a `src/domain/__sonda63.test.ts`, corrido y borrado; `git status` limpio
después):

```ts
// Sonda descartable de la revisión PR #63: NO se commitea. Imprime qué código elige el fake.
import { it } from 'vitest';
import { type FakePlatformSettings, createFakeRpcClient } from './testing/rpc-fake';

const SETTINGS: FakePlatformSettings = {
  minOfferArs: 1200, maxOffersPerMin: 10, maxRequestPublicationsPerMin: 10, maxIncidentsPerMin: 5,
  requestTtlMinutes: 25, pilotActive: true, pilotTermsVersion: 'v1.0', subscriptionGraceDays: 3,
};
const M1 = '10000000-0000-4000-8000-000000000001';
const M2 = '10000000-0000-4000-8000-000000000002';
const C1 = '20000000-0000-4000-8000-000000000001';
const C2 = '20000000-0000-4000-8000-000000000002';
const A1 = '90000000-0000-4000-8000-000000000001';
const R = '30000000-0000-4000-8000-000000000001';
const O = '50000000-0000-4000-8000-000000000001';
const now = new Date('2026-09-23T15:00:00.000Z');
const past = new Date(now.getTime() - 1000).toISOString();
const future = new Date(now.getTime() + 30 * 60_000).toISOString();

type St = 'draft' | 'published' | 'matched' | 'in_transit' | 'delivered' | 'cancelled' | 'expired';
function mk(status: St, actor: { userId: string; role: 'merchant' | 'courier' | 'admin' }, opts: {
  expiresAt?: string; subExpired?: boolean; c2Status?: 'approved' | 'suspended'; noC2?: boolean;
} = {}) {
  const assigned = ['matched', 'in_transit', 'delivered'].includes(status);
  return createFakeRpcClient({
    settings: { ...SETTINGS, pilotActive: !opts.subExpired },
    now: () => now,
    initialActor: actor,
    initialRequests: [{ requestId: R, merchantId: M1, status, expiresAt: opts.expiresAt ?? future,
      acceptedOfferId: assigned ? O : null, assignedCourierId: assigned ? C1 : null,
      deliveredAt: status === 'delivered' ? now.toISOString() : null }],
    initialOffers: assigned ? [{ offerId: O, requestId: R, courierId: C1, amountArs: 2500, status: 'accepted' }] : [],
    initialCouriers: [{ courierId: C1, status: 'approved', available: true },
      ...(opts.noC2 ? [] : [{ courierId: C2, status: opts.c2Status ?? 'approved', available: true } as const])],
    initialMerchants: [{ merchantId: M1, subscriptionStatus: opts.subExpired ? 'expired' : 'pilot' },
      { merchantId: M2, subscriptionStatus: opts.subExpired ? 'expired' : 'pilot' }],
  });
}
const merch = { userId: M1, role: 'merchant' } as const;
const merch2 = { userId: M2, role: 'merchant' } as const;
const cour2 = { userId: C2, role: 'courier' } as const;
const cour1 = { userId: C1, role: 'courier' } as const;
const admin = { userId: A1, role: 'admin' } as const;
const inc = { requestId: R, kind: 'demora', description: 'Demora de prueba' };
const code = (r: { ok: boolean; error?: unknown; code?: unknown }) =>
  r.ok ? 'ok' : String((r as { error?: { code?: string } }).error?.code ?? (r as { code?: string }).code ?? JSON.stringify(r));

it('sonda', async () => {
  const rows: [string, string][] = [];
  const run = async (id: string, p: Promise<unknown>) => rows.push([id, code((await p) as never)]);
  await run('S01', mk('published', admin).cancel_request({ requestId: R, reason: 'Motivo' }));
  await run('S02', mk('matched', admin).cancel_request({ requestId: R, reason: 'Motivo' }));
  await run('S03', mk('in_transit', merch).cancel_request({ requestId: R, reason: 'Motivo' }));
  await run('S04', mk('published', merch2, { expiresAt: past }).cancel_request({ requestId: R }));
  await run('S05', mk('published', merch, { expiresAt: past }).report_incident(inc));
  await run('S06', mk('matched', cour2, { c2Status: 'suspended' }).report_incident(inc));
  await run('S07', mk('draft', merch, { subExpired: true }).republish_request({ requestId: R, reason: 'Motivo' }));
  await run('S08', mk('matched', merch, { subExpired: true }).republish_request({ requestId: R }));
  await run('S09', mk('published', merch, { subExpired: true }).report_no_show({ requestId: R, republish: true }));
  await run('S10', mk('matched', merch2, { subExpired: true }).report_no_show({ requestId: R, republish: true }));
  await run('S11', mk('published', cour2).mark_picked_up({ requestId: R }));
  await run('S12', mk('draft', cour2).mark_picked_up({ requestId: R }));
  await run('S13', mk('matched', merch).publish_request({ requestId: R }));
  await run('S14', mk('matched', cour2, { noC2: true }).report_incident(inc));
  await run('S15', mk('published', merch, { expiresAt: past }).republish_request({ requestId: R }));
  await run('C01', mk('published', merch).cancel_request({ requestId: R }));
  await run('C02', mk('matched', cour1).mark_picked_up({ requestId: R }));
  await run('C03', mk('draft', merch, { subExpired: true }).publish_request({ requestId: R }));
  await run('C04', mk('expired', merch).republish_request({ requestId: R }));
  console.log('SONDA_FAKE ' + JSON.stringify(rows));
});
```

```text
SONDA_FAKE S01=UNAUTHORIZED_ACTOR S02=UNAUTHORIZED_ACTOR S03=UNAUTHORIZED_ACTOR S04=REQUEST_EXPIRED S05=ok
S06=UNAUTHORIZED_ACTOR S07=SUBSCRIPTION_INACTIVE S08=SUBSCRIPTION_INACTIVE S09=SUBSCRIPTION_INACTIVE
S10=SUBSCRIPTION_INACTIVE S11=INVALID_STATE_TRANSITION S12=INVALID_STATE_TRANSITION S13=REASON_REQUIRED
S14=UNAUTHORIZED_ACTOR S15=INVALID_STATE_TRANSITION C01=ok C02=ok C03=SUBSCRIPTION_INACTIVE C04=ok
```

Resultado: **14 de 15 divergen**; coincide S15 (los dos dan `INVALID_STATE_TRANSITION`, y los dos están mal por
H02); coinciden los 4 controles. El borrador del otro chat decía 13 de 15 con otro S14 y la RPC solo leída; este
conteo es el que vale.

## H06 y H09 · batería de mutación sobre `request_cycle`, contra las 1.153 aserciones

`mutar.py` toma la función de `git cat-file` (no del checkout), aplica la mutación exigiendo **exactamente una**
coincidencia (si no, sale con «SIN OBJETIVO», AG-55), la convierte en `create or replace` y la antepone al
resto de `rpc_requests.sql`, dentro de su misma transacción. No toca ningún archivo.

```python
import subprocess, sys, re
mig = subprocess.run(['git','cat-file','-p','9f2e42e:supabase/migrations/20260924010124_rpc_requests_v1.sql'],capture_output=True,text=True,check=True).stdout
test = subprocess.run(['git','cat-file','-p','9f2e42e:supabase/tests/rpc_requests.sql'],capture_output=True,text=True,check=True).stdout
start = mig.index('create function app_private.request_cycle(')
end = mig.index('$$;', start) + 3
fn = mig[start:end].replace('create function', 'create or replace function', 1)
assert test.startswith('begin;\n')
M = {
 'M00-control-sin-mutar': [],
 'M01-positivo-picked_up-no-cambia-estado': [("set status = 'in_transit', picked_up_at = v_now", "set picked_up_at = v_now")],
 'M02-sin-delivered_at': [(", delivered_at = v_now where", " where")],
 'M03-sin-picked_up_at': [(", picked_up_at = v_now where", " where")],
 'M04-courier_cancel-no-cancela-oferta': [("and status = 'accepted';", "and status = 'accepted' and p_action <> 'courier_cancel_match';")],
 'M05-republish-no-cancela-oferta': [("and status = 'accepted';", "and status = 'accepted' and p_action <> 'republish_request';")],
 'M06-expires_at-solo-en-publish': [("expires_at = v_expires,", "expires_at = case when p_action = 'publish_request' then v_expires else expires_at end,")],
 'M07-sin-cancelled_at': [("cancelled_at = case when v_status = 'cancelled' then v_now end,", "cancelled_at = null,")],
 'M08-sin-cancel_reason': [("cancel_reason = case when p_action = 'report_no_show' then 'no_show' else nullif(btrim(p_reason), '') end,", "cancel_reason = null,")],
 'M09-no-limpia-accepted_offer_id': [("set status = v_status, accepted_offer_id = null,", "set status = v_status,")],
 'M10-cancel-no-expira-pending': [("where request_id = p_request_id and status = 'pending';", "where request_id = p_request_id and status = 'pending' and p_action <> 'cancel_request';")],
 'M11-sin-audit_log': [("insert into public.audit_log (actor_id, action, target_type, target_id, before, after)\n    values (", "perform (")],
 'M12-motivo-libre-al-audit_log': [("jsonb_build_object('status', v_status));", "jsonb_build_object('status', v_status, 'reason', p_reason));")],
}
name = sys.argv[1]
f = fn
for old, new in M[name]:
    n = f.count(old)
    if n != 1:
        print(f'SIN OBJETIVO: {old!r} aparece {n} veces'); sys.exit(2)
    f = f.replace(old, new)
pre = ''
if False:
    pre = 'create table pg_temp.audit_sink (like public.audit_log including defaults);\n'
    f = f.replace('insert into pg_temp.audit_sink (actor_id', 'insert into pg_temp.audit_sink (actor_id')
sys.stdout.write('begin;\n' + pre + f + '\n' + test[len('begin;\n'):])
```

```bash
for m in M00-control-sin-mutar M01-positivo-picked_up-no-cambia-estado M02-sin-delivered_at …; do
  python3 mutar.py $m > $m.sql
  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -X -q -f $m.sql > $m.out 2>&1
  echo "$m ok=$(grep -cE '^\s*ok [0-9]' $m.out) not_ok=$(grep -cE '^\s*not ok' $m.out) errores=$(grep -c ERROR $m.out)"
done
```

| Mutación | ok | not ok | Lectura |
|---|---|---|---|
| M00 control sin mutar | 1153 | 0 | el arnés no rompe nada |
| M01 **positivo**: `mark_picked_up` no cambia el estado | 1152 | **1** | el arnés aplica la mutación |
| M02 sin `delivered_at = v_now` (`:174`) | 1153 | 0 | **ciega** |
| M03 sin `picked_up_at = v_now` (`:171`) | 1153 | 0 | **ciega** |
| M04 `courier_cancel_match` no cancela la oferta aceptada (`:180-181`) | 1153 | 0 | **ciega** |
| M05 `republish_request` no cancela la oferta aceptada | 1153 | 0 | **ciega** |
| M06 `expires_at` nuevo solo en `publish` | 1153 | 0 | **ciega** |
| M07 `cancelled_at = null` | 1153 | 0 | **ciega** |
| M08 `cancel_reason = null` | 1153 | 0 | **ciega** |
| M09 no limpia `accepted_offer_id` | 1153 | 0 | **ciega** |
| M10 `cancel` no expira las `pending` | 1152 | 1 | cubierta (`:220`) |
| M11 sin `insert into public.audit_log` | 1153 | 0 | **ciega** |
| M12 `p_reason` agregado al `after` del `audit_log` | 1153 | 0 | **ciega** (H09) |

**Tropiezo del instrumento (AG-55/AG-60):** la primera versión de M11 redirigía el `insert` a una tabla
temporal y dio **66 rojas**. Antes de creerle miré los `have:`: eran `NULL` donde debía haber datos, o sea que la
RPC entera fallaba por la tabla sumidero, no por el control. La rehice reemplazando el `insert … values (` por
`perform (` y dio 1153/0. La escritura existe: una sonda aparte cuenta `audit filas cancel: 1` después de un
`cancel_request`.

## H08 · batería sobre el control estático de Vitest

Muta la migración o el test **en disco**, corre `requests.test.ts` y restaura los bytes originales desde memoria
en un `finally`. Exige una sola coincidencia por mutación.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const MIG = 'supabase/migrations/20260924010124_rpc_requests_v1.sql';
const TST = 'supabase/tests/rpc_requests.sql';
const muts = {
  'V00-control-sin-mutar': [],
  'V01-positivo-sin-lock-solicitud': [[MIG, 'where id = p_request_id for update;', 'where id = p_request_id;']],
  'V02-positivo-offers-antes-que-solicitud': [[MIG, '  select * into v_request from public.delivery_requests where id = p_request_id for update;\n',
     '  perform 1 from public.offers where request_id = p_request_id for update;\n  select * into v_request from public.delivery_requests where id = p_request_id for update;\n']],
  'V03-couriers-for-update-antes-de-solicitud': [[MIG, '  select * into v_request from public.delivery_requests where id = p_request_id for update;\n',
     '  perform 1 from public.couriers where profile_id = v_uid for update;\n  select * into v_request from public.delivery_requests where id = p_request_id for update;\n']],
  'V04-matriz-ok-true-or': [[TST, "return next ok(result->>'error' = any(", "return next ok(true or result->>'error' = any("]],
};
const name = process.argv[2];
const originals = new Map();
for (const f of [MIG, TST]) originals.set(f, readFileSync(f));
try {
  for (const [file, oldS, newS] of muts[name]) {
    const text = readFileSync(file, 'utf8');
    const n = text.split(oldS).length - 1;
    if (n !== 1) { console.log(`${name}: SIN OBJETIVO (${n}) en ${file}`); process.exit(2); }
    writeFileSync(file, text.replace(oldS, newS));
  }
  let out = '';
  try { out = execSync('pnpm exec vitest run src/server/rpc/requests.test.ts --reporter=dot 2>&1', { encoding: 'utf8' }); }
  catch (e) { out = e.stdout ?? String(e); }
  const line = out.split('\n').find((l) => /Tests\s+/.test(l)) ?? '(sin línea Tests)';
  console.log(`${name}: ${line.trim()}`);
} finally {
  for (const [f, buf] of originals) writeFileSync(f, buf);
}
```

```text
V00-control-sin-mutar: Tests  35 passed (35)
V01-positivo-sin-lock-solicitud: Failed Tests 1
V02-positivo-offers-antes-que-solicitud: Failed Tests 1
V03-couriers-for-update-antes-de-solicitud: Tests  35 passed (35)      <- ciega
V04-matriz-ok-true-or: Tests  35 passed (35)                           <- ciega
$ git status --porcelain
?? supabase/.branches/          (lo crea supabase start; no es de la PR ni se commitea)
```

V03 y V04 son las M06 y M14 del borrador del otro chat: reproducidas. El resto de su batería de 14 no quedó
escrito en ningún lado, así que no la cito como corrida; los dos positivos de arriba prueban que el control
detecta lo que dice en lock faltante y en orden invertido de `offers`.


---

# Ronda 2 sobre `37014bd`

Head de la PR al abrir la ronda: `37014bd` (seis commits del agente sobre `05748c9`). Merge-base con develop:
`b6b5f39`, así que la rama sigue al día. Comentarios nuevos en la PR: ninguno aparte del de la ronda 1. El agente
no tocó `docs/revision-pr/pr-63/` (`git diff --stat 05748c9 37014bd -- docs/revision-pr/` vacío).

## Alcance

```bash
git diff --stat origin/develop...37014bd          # 10 archivos
git diff origin/develop 37014bd -- docs/tasks/T-103.md
```

La ficha de la rama suma a «Archivos permitidos» `src/domain/rpc-contracts.ts`, `src/domain/testing/rpc-fake.ts`,
`src/domain/domain.test.ts` y `docs/contracts/CC-005.md`. Comparada con develop, **amplía el alcance**, y la de
develop dice «los cambios de `src/domain/**` … no se autorizan dentro de T-103». Preguntado a Lautaro073 antes de
escribir el informe: **aceptado adentro** (`PR63-A01`). No hay otra rama con `docs/contracts/CC-005.md` (barrido
de `git ls-tree` sobre todas las ramas remotas).

## Receta de `db-tests` y checks

El contenedor se recicló entre rondas: hubo que relanzar `dockerd` y hacer `supabase stop --no-backup` +
`supabase start` (quedaban contenedores a medio arrancar).

| Comando | Resultado en `37014bd` |
|---|---|
| `pnpm supabase test db` | `Files=7, Tests=1373, Result: PASS` |
| `psql … -f supabase/tests/rpc_requests.sql` | `1..1196`, 1196 ok, 0 not ok |
| `pnpm db:types --local` + `git diff --exit-code` | sin diff; `mtime` del archivo igual al `date` siguiente |
| `pnpm typecheck` (worktree limpio de `37014bd`) | exit 0 |
| `pnpm lint` (ídem) | `✔ No ESLint warnings or errors`, exit 0 |
| `pnpm test` (ídem) | `Test Files 32 passed (32)` · `Tests 296 passed (296)` · workflows `pass 19 fail 0` · ADR `pass 6 fail 0` |

Esta vez corrí `pnpm test` en un worktree limpio desde el principio, para que `supabase/.temp/` de mi
`supabase start` no volviera a disparar el barrido de secretos de T-002.

## Sondas de la ronda 1, sobre el código nuevo

Mismo `sondas.sql`, con la preparación nueva (`sed -n 1,95p`, porque la fixture creció):

```text
ok 1 - H01a · ok 2 - H01-control · ok 3 - H02 · ok 4 - H02-control · ok 5..6 - H03-pre
ok 7 - H03a · ok 8 - H03-pre · ok 9 - H03b · not ok 10 - H04 · ok 11 - H07-pre · ok 12 - H07 · ok 13 - H01b
```

`H04` sigue en rojo porque mide la fixture, no el código: el arreglo fue **borrar** la aserción de `pg_locks`
(`grep -c pg_locks supabase/tests/rpc_requests.sql` → `0`).

## Batería de mutación de la ronda 2 (contra las 1.196 aserciones)

Mismo arnés que la ronda 1 (`mutar2.py`, SHA fijado en `37014bd`, exige una sola coincidencia por mutación),
más una mutación por cada arreglo y una sobre la policy de la tabla nueva, que se aplica como prefijo dentro de la
misma transacción:

```python
POLICY_OPEN = ("drop policy request_cancellation_reasons_admin on public.request_cancellation_reasons;\n"
               "create policy request_cancellation_reasons_admin on public.request_cancellation_reasons for all to authenticated using (true) with check (true);\n")
 'M13-motivo-libre-al-audit_log-before': [("jsonb_build_object('status', v_request.status, 'offerId', v_request.accepted_offer_id),", "jsonb_build_object('status', v_request.status, 'offerId', v_request.accepted_offer_id, 'reason', p_reason),")],
 'M14-revierte-H01': [("    if p_action = 'report_incident' and (v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted') then\n      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';\n    end if;\n", "")],
 'M15-revierte-H02-republish': [("or (p_action = 'republish_request' and v_eff_status not in", "or (p_action = 'republish_request' and v_request.status not in")],
 'M16-revierte-H03-sin-null': [("  if v_status = 'published' then\n    update public.delivery_requests set cancel_reason = null where id = p_request_id;\n  end if;\n", "")],
 'M17-sin-tabla-de-motivos': [("    insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason)\n      values (", "    perform (")],
 'M18-sin-aal2': [("and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then", "and false then")],
 'M19-sin-piso-500': [("else greatest(500, (round(", "else (0 + (round(")],
 'M20-republish-no-expira-pending': [("where request_id = p_request_id and status = 'pending';", "where request_id = p_request_id and status = 'pending' and p_action <> 'republish_request';")],
 'M21-policy-motivos-abierta': [],
```

| Mutación | ok | not ok | Lectura |
|---|---|---|---|
| M00 control sin mutar | 1196 | 0 | el arnés no rompe nada |
| M01 positivo (`mark_picked_up` no cambia estado) | 1195 | 1 | el arnés aplica |
| M02 sin `delivered_at` | 1194 | 2 | **cubierta** (era ciega) |
| M03 sin `picked_up_at` | 1195 | 1 | **cubierta** |
| M04 `courier_cancel_match` no cancela oferta | 1195 | 1 | **cubierta** |
| M05 `republish` no cancela oferta | 1195 | 1 | **cubierta** |
| M06 `expires_at` nuevo solo en `publish` | 1196 | 0 | **ciega** → `H10` |
| M07 `cancelled_at = null` | 1195 | 1 | **cubierta** |
| M08 `cancel_reason = null` | 1195 | 1 | **cubierta** |
| M09 no limpia `accepted_offer_id` | 1193 | 3 | **cubierta** |
| M10 `cancel` no expira `pending` | 1195 | 1 | cubierta |
| M11 sin `audit_log` | 1194 | 2 | **cubierta** |
| M12 `p_reason` en el `after` del log | 1195 | 1 | **cubierta** |
| M13 `p_reason` en el `before` del log | 1196 | 0 | **ciega** → `H09` parcial |
| M14 revierte `H01` | 1194 | 2 | cubierta (S06, S14) |
| M15 revierte `H02` en `republish` | 1195 | 1 | cubierta (S15) |
| M16 revierte `H03` (no anula `cancel_reason`) | 1194 | 2 | cubierta (H03a, H03b) |
| M17 sin `insert` en la tabla de motivos | 1194 | 2 | cubierta (D02a, D02b) |
| M18 sin chequeo de `aal2` | 1195 | 1 | cubierta (D03) |
| M19 sin piso de 500 m | 1195 | 1 | cubierta (H07) |
| M20 `republish` no expira las `pending` | 1196 | 0 | **ciega** → `H12` |
| M21 policy de motivos `using (true)` | 1196 | 0 | **ciega** → `H11` |

## Sondas nuevas de la ronda 2

```sql
create function pg_temp.read_as(p_actor integer, p_sql text, p_aal text default 'aal1') returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.actor(p_actor), 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
  execute p_sql into v;
  set local role postgres;
  return v;
exception when others then
  set local role postgres;
  return 'ERR ' || sqlstate;
end $$;
-- R2-P1: RLS de request_cancellation_reasons, lectura y escritura por actor.
select pg_temp.fixture('matched');
select ok(pg_temp.invoke(3, format('select public.courier_cancel_match(%L, %L)', pg_temp.actor(20), 'no atendia')) ? 'data', 'P1-pre: cancel acepta');
select is(pg_temp.read_as(4, format('select count(*)::text from public.request_cancellation_reasons where request_id = %L', pg_temp.actor(20))), '0', 'P1a: courier ajeno lee 0 motivos');
select is(pg_temp.read_as(3, format('select count(*)::text from public.request_cancellation_reasons where request_id = %L', pg_temp.actor(20))), '0', 'P1b: courier que canceló lee 0 motivos');
select is(pg_temp.read_as(1, format('select count(*)::text from public.request_cancellation_reasons where request_id = %L', pg_temp.actor(20))), '0', 'P1c: comercio dueño lee 0 motivos');
select is(pg_temp.read_as(5, format('select count(*)::text from public.request_cancellation_reasons where request_id = %L', pg_temp.actor(20)), 'aal2'), '1', 'P1d: admin lee 1 motivo (positivo, AG-34)');
select is(pg_temp.read_as(1, format('insert into public.request_cancellation_reasons (request_id, action, reason) values (%L, ''x'', ''y'') returning id::text', pg_temp.actor(20))), 'ERR 42501', 'P1e: comercio no inserta');
select is(pg_temp.read_as(5, format('insert into public.request_cancellation_reasons (request_id, action, reason) values (%L, ''x'', ''y'') returning id::text', pg_temp.actor(20)), 'aal2'), 'ERR 42501', 'P1f: admin tampoco inserta directo (solo select concedido)');
-- R2-P2: efectos de republicar una published vencida (la transición nueva de H02).
select pg_temp.fixture('published');
update public.delivery_requests set expires_at = now() - interval '1 minute' where id = pg_temp.actor(20);
select is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->'data'->>'status', 'published', 'P2-pre: republica');
select is((select status::text from public.offers where id = pg_temp.actor(31)), 'expired', 'P2a: la oferta pending previa queda expired');
select ok((select expires_at > now() from public.delivery_requests where id = pg_temp.actor(20)), 'P2b: expires_at renovado');
-- R2-P3: por qué M06a/M06b no pueden fallar.
select pg_temp.fixture('matched');
select is((select expires_at from public.delivery_requests where id = pg_temp.actor(20)), now() + interval '30 minutes', 'P3a: la fixture ya siembra expires_at = now()+30 min');
select is((select value::text from public.platform_settings where key = 'request_ttl_minutes'), '30', 'P3b: y el TTL de la fixture es 30: el valor renovado es idéntico al sembrado');
-- R2-P4: variantes de D03.
select pg_temp.fixture('in_transit');
select is(pg_temp.read_as(5, format('select public.cancel_request(%L, %L)::text', pg_temp.actor(20), 'x'), 'none'), 'ERR P0001', 'P4a-pre: admin con aal ausente falla');
create function pg_temp.err_as(p_claims jsonb, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', p_claims::text, true);
  set local role authenticated;
  execute p_sql;
  set local role postgres;
  return 'ok';
exception when others then
  set local role postgres;
  return sqlerrm;
end $$;
select pg_temp.fixture('in_transit');
select is(pg_temp.err_as(jsonb_build_object('sub', pg_temp.actor(5), 'role', 'authenticated'), format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'x')), 'AAL2_REQUIRED', 'P4a: admin sin claim aal -> AAL2_REQUIRED');
select pg_temp.fixture('published');
update public.delivery_requests set expires_at = now() - interval '1 minute' where id = pg_temp.actor(20);
select is(pg_temp.err_as(jsonb_build_object('sub', pg_temp.actor(5), 'role', 'authenticated', 'aal', 'aal1'), format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'x')), 'REQUEST_EXPIRED', 'P4b: admin aal1 cancela publicada vencida -> REQUEST_EXPIRED (según precedencia)');
```

```text
ok 1 - P1-pre: cancel acepta
ok 2 - P1a: courier ajeno lee 0 motivos
ok 3 - P1b: courier que canceló lee 0 motivos
ok 4 - P1c: comercio dueño lee 0 motivos
ok 5 - P1d: admin lee 1 motivo (positivo, AG-34)
ok 6 - P1e: comercio no inserta                                   (42501)
ok 7 - P1f: admin tampoco inserta directo (solo select concedido)  (42501)
ok 8 - P2-pre: republica
ok 9 - P2a: la oferta pending previa queda expired
ok 10 - P2b: expires_at renovado
ok 11 - P3a: la fixture ya siembra expires_at = now()+30 min
ok 12 - P3b: y el TTL de la fixture es 30: el valor renovado es idéntico al sembrado
ok 13 - P4a-pre · ok 14 - P4a: admin sin claim aal -> AAL2_REQUIRED
ok 15 - P4b: admin aal1 cancela publicada vencida -> REQUEST_EXPIRED (según precedencia)
```

Lectura: el **código** hace lo correcto en P1 y P2; lo que falta es que alguna aserción lo fije (M20, M21). P3
explica por qué M06 es ciega: dentro de una transacción `now()` es constante, y la fixture siembra el mismo
`expires_at` que produce la renovación.

## D01 de los dos lados, con ocho combinaciones nuevas

Las 19 de la ronda 1 más ocho que salen del reordenamiento (`AG-59`: reordenar mueve la precedencia). Del lado
RPC, se suman a `d01.sql`:

```sql
create function pg_temp.c_claims(p_id text, p_status text, p_claims jsonb, p_sql text, p_expired boolean default false) returns void language plpgsql as $$
declare r text;
begin
  perform pg_temp.fixture(p_status);
  if p_expired then update public.delivery_requests set expires_at = now() - interval '1 second' where id = pg_temp.actor(20); end if;
  begin
    perform set_config('request.jwt.claims', p_claims::text, true);
    set local role authenticated;
    execute format(p_sql, pg_temp.actor(20));
    set local role postgres;
    r := 'ok';
  exception when others then
    set local role postgres;
    r := sqlerrm;
  end;
  insert into d01 values (p_id, r);
end $$;
select pg_temp.c_claims('T01','in_transit', jsonb_build_object('sub', pg_temp.actor(5), 'role','authenticated','aal','aal1'), 'select public.cancel_request(%L, null)');
select pg_temp.c_claims('T02','published', jsonb_build_object('sub', pg_temp.actor(5), 'role','authenticated','aal','aal1'), 'select public.cancel_request(%L, ''x'')', true);
select pg_temp.c_claims('T03','published', jsonb_build_object('sub', pg_temp.actor(5), 'role','authenticated','aal','aal1'), 'select public.cancel_request(%L, ''x'')');
select pg_temp.c('T04','published',1,'select public.republish_request(%L, null)', true, true);
select pg_temp.c('T05','published',1,'select public.report_no_show(%L, true)', true);
select pg_temp.c('T06','published',2,'select public.republish_request(%L, null)', true);
select pg_temp.c('T07','published',5,'select public.report_incident(%L, ''demora'', ''Demora de prueba'')', true);
select pg_temp.c('T08','matched',4,'select public.mark_picked_up(%L)', p_c4 => 'suspended');
```

Del lado fake, las mismas ocho con `mk(...)` y actores admin con `aal` explícito (archivo descartable
`src/domain/__sonda63.test.ts`, corrido y borrado; `git status` limpio).

```text
C01..C04  iguales       S01..S15  iguales (S15 = ok en los dos)
T01 AAL2_REQUIRED       T02 REQUEST_EXPIRED     T03 INVALID_STATE_TRANSITION   T04 SUBSCRIPTION_INACTIVE
T05 INVALID_STATE_TRANSITION   T06 UNAUTHORIZED_ACTOR   T07 INVALID_STATE_TRANSITION   T08 COURIER_SUSPENDED
total 27 · divergen 0
```

## Control estático (H08), sobre `37014bd`

```text
V00-control-sin-mutar: Tests 35 passed (35)
V01-positivo-sin-lock-solicitud: Failed Tests 1
V02-positivo-offers-antes-que-solicitud: Failed Tests 1
V03-couriers-for-update-antes-de-solicitud: Failed Tests 1   -> expected 2140 to be less than 2056 (la aserción nueva de orden)
V04-matriz-ok-true-or: Failed Tests 1                          -> falla strictContractErrorAssertRegex, la aserción nueva
```

Comprobé con el reporter por defecto que V03 y V04 caen por la aserción que dice cuidarlas, no por otra (AG-60).

## Cuerpo y bitácora contra el código (`R01`)

```bash
ls src/domain/requests.ts                                    # No such file or directory
grep -rn 'export function calculate.*Distance' src/domain    # schemas/index.ts:137 calculateHaversineRouteDistanceM
grep -rn REQUEST_NOT_FOUND src supabase                      # sin resultados
grep -n 'v_eff_status :=' -A2 supabase/migrations/20260924010124_rpc_requests_v1.sql   # solo published + expires_at
grep -n 'auth.jwt()' supabase/migrations/20260924010124_rpc_requests_v1.sql            # sin resultados
```


---

# Ronda 3 sobre `93cc3c5`

Head al abrir la ronda: `93cc3c5` (dos commits del agente sobre `4806a25`: `508f331` y `93cc3c5`). Merge-base
`b6b5f39`. El agente no tocó `docs/revision-pr/pr-63/`. Cambios desde `37014bd`: la policy de la tabla de
motivos, `rpc_requests.sql` y la bitácora. `git diff 37014bd 93cc3c5 --stat -- supabase/migrations src` muestra
solo 5 líneas de la migración, todas de la policy: `request_cycle`, el fake y `requests.test.ts` no cambiaron.

Docker se había vuelto a caer: relancé `dockerd` y `supabase stop --no-backup && supabase start`.

| Comando | Resultado en `93cc3c5` |
|---|---|
| `pnpm supabase test db` | `Files=7, Tests=1385, Result: PASS` |
| `psql … -f supabase/tests/rpc_requests.sql` | `1..1208`, 1208 ok, 0 not ok |
| `pnpm db:types --local` + `git diff --exit-code` | sin diff; `mtime` = `date` siguiente |
| `pnpm typecheck` · `lint` · `test` (worktree limpio) | exit 0 · `✔ No ESLint warnings or errors` · `Tests 296 passed (296)`, workflows `pass 19 fail 0`, ADR `pass 6 fail 0` |

## Batería de mutación (`mutar3.py` = `mutar2.py` con `SHA = '93cc3c5'` y una mutación más)

```python
'M22-aal2-antes-que-expirado': [("  if p_action = 'cancel_request' and v_request.status = 'published' and v_request.expires_at <= v_now then\n",
   "  if p_action = 'cancel_request' and v_role = 'admin' and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then raise exception 'AAL2_REQUIRED' using errcode = 'P0001'; end if;\n  if p_action = 'cancel_request' and v_request.status = 'published' and v_request.expires_at <= v_now then\n")],
```

| Mutación | ok | not ok | Lectura |
|---|---|---|---|
| M00 control | 1208 | 0 | verde, como debe |
| M01–M05 | — | 1, 2, 1, 1, 1 | rojas |
| **M06** `expires_at` solo en `publish` | 1205 | **3** | **roja** (era ciega) → `H10` cerrado |
| M07–M12 | — | 1, 1, 3, 1, 3, 1 | rojas |
| **M13** motivo en el `before` | 1207 | **1** | **roja** (era ciega) → `H09` cerrado |
| M14–M19 | — | 2, 3, 2, 3, 2, 1 | rojas |
| **M20** `republish` no expira `pending` | 1207 | **1** | **roja** (era ciega) → `H12` cerrado |
| **M21** policy `using (true)` | 1205 | **3** | **roja** (era ciega) → `H11` cerrado |
| **M22** `aal2` antes que el vencimiento | 1208 | 0 | **ciega** → `H14` |

Qué falla con M21:

```text
not ok 1178 - H11 / P1a: courier ajeno lee 0 motivos en request_cancellation_reasons
not ok 1179 - H11 / P1b: courier que canceló lee 0 motivos en request_cancellation_reasons
not ok 1180 - H11 / P1c: comercio dueño lee 0 motivos en request_cancellation_reasons
```

La bitácora (`docs/tasks/log/T-103.md:89`) declara para M21 «`P1a`, `P1b`, `P1c`, `P1e` y `P1f` (RED: `5`
fallos)». `P1e` y `P1f` son `insert` y los bloquea la falta de `grant`: M21 solo cambia la policy, así que no
pueden fallar. → `R01`.

## Citas del cuerpo y de la bitácora contra el código

```bash
sed -n '62p;97p' src/domain/rpc-contracts.ts          # requestId: uuidSchema (x2)
grep -n 'Precedencia canónica del ciclo' src/domain/rpc-contracts.ts   # 299
grep -n "'AAL2_REQUIRED'" src/domain/rpc-contracts.ts                 # 344 (cancel_request), más los admin_*
M=supabase/migrations/20260924010124_rpc_requests_v1.sql
grep -n 'create table public.request_cancellation_reasons' $M        # 2
grep -n 'greatest(500' $M                                            # 178
grep -n "if p_action = 'report_incident' and (v_offer.courier_id" $M  # 91
grep -n 'v_eff_status :=' $M                                         # 106
grep -n "raise exception 'AAL2_REQUIRED'" $M                      # 123 (el if empieza en 121)
grep -n 'P4b' supabase/tests/rpc_requests.sql                        # 598, 602
```
