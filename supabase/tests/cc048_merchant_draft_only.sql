-- CC-048 / T-430 (SEC-06): el comercio solo edita su solicitud y sus contactos en borrador; sin delete/truncate.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(111);

create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000048' || lpad(n::text, 2, '0'))::uuid
$$;
-- 1 comercio · 2 otro comercio · 3 repartidor aprobado
create function pg_temp.merchant() returns uuid language sql immutable as $$ select pg_temp.id(1) $$;
create function pg_temp.merchant_b() returns uuid language sql immutable as $$ select pg_temp.id(2) $$;
create function pg_temp.courier() returns uuid language sql immutable as $$ select pg_temp.id(3) $$;
-- Solicitudes del comercio: borrador, publicada y aceptada con contacto; las mismas sin contacto; borrador ajeno.
create function pg_temp.req_draft() returns uuid language sql immutable as $$ select pg_temp.id(10) $$;
create function pg_temp.req_published() returns uuid language sql immutable as $$ select pg_temp.id(11) $$;
create function pg_temp.req_matched() returns uuid language sql immutable as $$ select pg_temp.id(12) $$;
create function pg_temp.req_draft_nc() returns uuid language sql immutable as $$ select pg_temp.id(13) $$;
create function pg_temp.req_published_nc() returns uuid language sql immutable as $$ select pg_temp.id(14) $$;
create function pg_temp.req_matched_nc() returns uuid language sql immutable as $$ select pg_temp.id(15) $$;
create function pg_temp.req_foreign_draft() returns uuid language sql immutable as $$ select pg_temp.id(16) $$;
create function pg_temp.offer_matched() returns uuid language sql immutable as $$ select pg_temp.id(20) $$;
create function pg_temp.offer_matched_nc() returns uuid language sql immutable as $$ select pg_temp.id(21) $$;

-- Ejecuta una sentencia como `authenticated` con el sub dado; devuelve código, filas y mensaje.
create function pg_temp.run(p_uid uuid, p_sql text)
returns jsonb language plpgsql as $$
declare affected bigint;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  execute p_sql;
  get diagnostics affected = row_count;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('code', '00000', 'rows', affected);
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('code', sqlstate, 'message', sqlerrm);
end;
$$;

-- Fixture como superusuario.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc048.m@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.merchant_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc048.mb@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.courier(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc048.c@example.test', 'pwd', '{"role":"courier"}');
update public.profiles set consent_status = 'active'
where id in (pg_temp.merchant(), pg_temp.merchant_b(), pg_temp.courier());
update public.couriers set status = 'approved', available = true where profile_id = pg_temp.courier();

create temporary table cc048_zones on commit drop as
select (array_agg(id order by id))[1] as zone_a, (array_agg(id order by id))[2] as zone_b
from public.zones where active;

insert into public.delivery_requests (id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
  recipient_payment_method, needs_change, fixed_price_ars, auto_assign, published_at, matched_at, expires_at)
select r.id, r.merchant_id, r.status::public.delivery_request_status, z.zone_a, z.zone_a, 'chico', 'transfer', false,
  1500, false,
  case when r.status <> 'draft' then now() end,
  case when r.status = 'matched' then now() end,
  now() + interval '1 hour'
from cc048_zones z,
  (values
    (pg_temp.req_draft(), pg_temp.merchant(), 'draft'),
    (pg_temp.req_published(), pg_temp.merchant(), 'published'),
    (pg_temp.req_matched(), pg_temp.merchant(), 'matched'),
    (pg_temp.req_draft_nc(), pg_temp.merchant(), 'draft'),
    (pg_temp.req_published_nc(), pg_temp.merchant(), 'published'),
    (pg_temp.req_matched_nc(), pg_temp.merchant(), 'matched'),
    (pg_temp.req_foreign_draft(), pg_temp.merchant_b(), 'draft')
  ) as r(id, merchant_id, status);

insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
values
  (pg_temp.offer_matched(), pg_temp.req_matched(), pg_temp.courier(), 2500, 15, 'accepted'),
  (pg_temp.offer_matched_nc(), pg_temp.req_matched_nc(), pg_temp.courier(), 2500, 15, 'accepted');
update public.delivery_requests set accepted_offer_id = pg_temp.offer_matched() where id = pg_temp.req_matched();
update public.delivery_requests set accepted_offer_id = pg_temp.offer_matched_nc() where id = pg_temp.req_matched_nc();

insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name,
  recipient_phone, recipient_consent_declared)
select id, 'San Martín 48', 'Belgrano 48', 'Destinatario 48', '3865480048', true
from (values (pg_temp.req_draft()), (pg_temp.req_published()), (pg_temp.req_matched())) as r(id);

-- Columnas con grant de update (CC-026) y un valor nuevo válido para cada una.
create temporary table cc048_cols (ord integer primary key, col text not null, val text not null) on commit drop;
insert into cc048_cols (ord, col, val)
select v.ord, v.col, v.val
from cc048_zones z, lateral (values
  (1, 'pickup_zone_id', quote_literal(z.zone_b)),
  (2, 'dropoff_zone_id', quote_literal(z.zone_b)),
  (3, 'package_type', quote_literal('grande')),
  (4, 'notes', quote_literal('SEC-06')),
  (5, 'recipient_payment_method', quote_literal('cash')),
  (6, 'needs_change', 'true'),
  (7, 'cash_change_amount', '5000'),
  (8, 'approx_distance_m', '4321'),
  (9, 'route_distance_m', '4321'),
  (10, 'cancel_reason', quote_literal('SEC-06')),
  (11, 'fixed_price_ars', '2500'),
  (12, 'auto_assign', 'true')
) as v(ord, col, val);

create temporary table cc048_reqs (label text primary key, id uuid not null) on commit drop;
insert into cc048_reqs values ('published', pg_temp.req_published()), ('matched', pg_temp.req_matched());

create temporary table cc048_snapshot on commit drop as
select id, to_jsonb(r) as row from public.delivery_requests r
where id in (pg_temp.req_published(), pg_temp.req_matched());

-- 1-24. Bypass por columna: fuera de draft, el update directo del comercio dueño cambia 0 filas.
create temporary table cc048_bypass on commit drop as
select c.ord, c.col, q.label, q.id,
  pg_temp.run(pg_temp.merchant(),
    format('update public.delivery_requests set %I = %s where id = %L', c.col, c.val, q.id)) as res
from cc048_cols c cross join cc048_reqs q;

select is(res, jsonb_build_object('code', '00000', 'rows', 0),
  format('CC-048: update directo de %s sobre una solicitud %s cambia 0 filas', col, label))
from cc048_bypass order by label, ord;

-- 25-48. El valor queda igual al anterior.
select is(to_jsonb(r) -> b.col, s.row -> b.col,
  format('CC-048: %s de la solicitud %s conserva su valor', b.col, b.label))
from cc048_bypass b
join public.delivery_requests r on r.id = b.id
join cc048_snapshot s on s.id = b.id
order by b.label, b.ord;

-- 49-60. En draft el mismo update cambia la fila (en orden: needs_change va después de pasar a efectivo).
create temporary table cc048_draft (ord integer primary key, col text, res jsonb, persisted boolean) on commit drop;
do $$
declare c record; v_res jsonb; v_ok boolean;
begin
  for c in select * from cc048_cols order by ord loop
    v_res := pg_temp.run(pg_temp.merchant(),
      format('update public.delivery_requests set %I = %s where id = %L', c.col, c.val, pg_temp.req_draft()));
    execute format('select (%I = %s) from public.delivery_requests where id = %L', c.col, c.val, pg_temp.req_draft())
      into v_ok;
    insert into cc048_draft values (c.ord, c.col, v_res, v_ok);
  end loop;
end;
$$;

select ok(res = jsonb_build_object('code', '00000', 'rows', 1) and persisted,
  format('CC-048: en draft el comercio actualiza %s (1 fila, valor nuevo persistido)', col))
from cc048_draft order by ord;

-- 61-63. Contactos: insert fuera de draft da excepción y no deja fila.
select is(pg_temp.run(pg_temp.merchant(), format(
  'insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared) values (%L, %L, %L, %L, %L, true)',
  pg_temp.req_published_nc(), 'San Martín 1', 'Belgrano 1', 'Intruso', '3865000001')) ->> 'message',
  'INVALID_STATE_TRANSITION', 'CC-048: insert de contacto sobre una solicitud published da INVALID_STATE_TRANSITION');
select is(pg_temp.run(pg_temp.merchant(), format(
  'insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared) values (%L, %L, %L, %L, %L, true)',
  pg_temp.req_matched_nc(), 'San Martín 1', 'Belgrano 1', 'Intruso', '3865000001')) ->> 'message',
  'INVALID_STATE_TRANSITION', 'CC-048: insert de contacto sobre una solicitud matched da INVALID_STATE_TRANSITION');
select is((select count(*)::integer from public.delivery_request_contacts
  where request_id in (pg_temp.req_published_nc(), pg_temp.req_matched_nc())),
  0, 'CC-048: el insert rechazado no deja contacto');

-- 64-66. Contactos: update fuera de draft cambia 0 filas sin excepción y conserva el valor.
select is(pg_temp.run(pg_temp.merchant(), format(
  'update public.delivery_request_contacts set recipient_name = %L, dropoff_address = %L where request_id = %L',
  'Hack', 'Otra calle', pg_temp.req_published())),
  jsonb_build_object('code', '00000', 'rows', 0), 'CC-048: update de contacto sobre una solicitud published cambia 0 filas');
select is(pg_temp.run(pg_temp.merchant(), format(
  'update public.delivery_request_contacts set recipient_name = %L, dropoff_address = %L where request_id = %L',
  'Hack', 'Otra calle', pg_temp.req_matched())),
  jsonb_build_object('code', '00000', 'rows', 0), 'CC-048: update de contacto sobre una solicitud matched cambia 0 filas');
select ok((select bool_and(recipient_name = 'Destinatario 48' and dropoff_address = 'Belgrano 48')
  from public.delivery_request_contacts where request_id in (pg_temp.req_published(), pg_temp.req_matched())),
  'CC-048: los contactos fuera de draft conservan su valor');

-- 67-69. Contactos en draft: insert y update funcionan.
select is(pg_temp.run(pg_temp.merchant(), format(
  'insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared) values (%L, %L, %L, %L, %L, true)',
  pg_temp.req_draft_nc(), 'San Martín 2', 'Belgrano 2', 'Destinatario nuevo', '3865000002')),
  jsonb_build_object('code', '00000', 'rows', 1), 'CC-048: insert de contacto en draft funciona');
select is(pg_temp.run(pg_temp.merchant(), format(
  'update public.delivery_request_contacts set recipient_name = %L where request_id = %L',
  'Destinatario editado', pg_temp.req_draft())),
  jsonb_build_object('code', '00000', 'rows', 1), 'CC-048: update de contacto en draft funciona');
select is((select recipient_name from public.delivery_request_contacts where request_id = pg_temp.req_draft()),
  'Destinatario editado', 'CC-048: el update de contacto en draft persiste');

-- 70. Un contacto no se puede mover a otra solicitud.
select is(pg_temp.run(pg_temp.merchant(), format(
  'update public.delivery_request_contacts set request_id = %L where request_id = %L',
  pg_temp.req_draft_nc(), pg_temp.req_draft())) ->> 'code',
  '42501', 'CC-048: update de request_id del contacto da 42501');

-- 71-74. Helper de serialización: códigos de error de contactos y drops.
select is(pg_temp.run(pg_temp.merchant(), format(
  'insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared) values (%L, %L, %L, %L, %L, true)',
  pg_temp.req_foreign_draft(), 'San Martín 3', 'Belgrano 3', 'Intruso', '3865000003')) ->> 'message',
  'NOT_FOUND', 'CC-048: insert de contacto sobre un borrador ajeno da NOT_FOUND');
select is(pg_temp.run(pg_temp.merchant(), format(
  'insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared) values (%L, %L, %L, %L, %L, true)',
  pg_temp.id(99), 'San Martín 4', 'Belgrano 4', 'Intruso', '3865000004')) ->> 'message',
  'NOT_FOUND', 'CC-048: insert de contacto sobre una solicitud inexistente da NOT_FOUND');
select is(pg_temp.run(pg_temp.merchant(), format(
  'insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method) values (%L, 1, %L, %L, %L)',
  pg_temp.req_published_nc(), (select zone_a from cc048_zones), 'chico', 'cash')) ->> 'message',
  'INVALID_STATE_TRANSITION', 'CC-048: el helper conserva INVALID_STATE_TRANSITION para drops sobre una solicitud published');
select is(pg_temp.run(pg_temp.merchant(), format(
  'insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method) values (%L, 1, %L, %L, %L)',
  pg_temp.req_foreign_draft(), (select zone_a from cc048_zones), 'chico', 'cash')) ->> 'message',
  'NOT_FOUND', 'CC-048: drops sobre un borrador ajeno da NOT_FOUND');

-- 75-77. Sin delete ni truncate para clientes.
select is(pg_temp.run(pg_temp.merchant(), format(
  'delete from public.delivery_request_contacts where request_id = %L', pg_temp.req_draft())) ->> 'code',
  '42501', 'CC-048: el comercio no puede borrar contactos');
select is(pg_temp.run(pg_temp.merchant(), 'truncate public.delivery_request_contacts') ->> 'code',
  '42501', 'CC-048: el comercio no puede truncar delivery_request_contacts');
select is(pg_temp.run(pg_temp.merchant(), 'truncate public.delivery_requests') ->> 'code',
  '42501', 'CC-048: el comercio no puede truncar delivery_requests');

-- 78-93. Privilegios de tabla de anon y authenticated.
select ok(not has_table_privilege(r.role_name, t.tbl, p.priv),
  format('CC-048: %s sin %s en %s', r.role_name, p.priv, t.tbl))
from (values ('anon'), ('authenticated')) as r(role_name)
cross join (values ('public.delivery_requests'), ('public.delivery_request_contacts')) as t(tbl)
cross join (values ('TRUNCATE'), ('DELETE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
order by r.role_name, t.tbl, p.priv;

-- 94-97. Insert y update en contactos.
select ok(has_table_privilege('authenticated', 'public.delivery_request_contacts', 'INSERT'),
  'CC-048: authenticated conserva insert en delivery_request_contacts');
select ok(not has_table_privilege('anon', 'public.delivery_request_contacts', 'INSERT'),
  'CC-048: anon sin insert en delivery_request_contacts');
select ok(not has_table_privilege('anon', 'public.delivery_request_contacts', 'UPDATE'),
  'CC-048: anon sin update en delivery_request_contacts');
select ok(not has_column_privilege('authenticated', 'public.delivery_request_contacts', 'request_id', 'UPDATE'),
  'CC-048: authenticated sin update de request_id en delivery_request_contacts');

-- 98-106. Update por columna para authenticated.
select ok(has_column_privilege('authenticated', 'public.delivery_request_contacts', c, 'UPDATE'),
  format('CC-048: authenticated con update de %s en delivery_request_contacts', c))
from unnest(array['pickup_address', 'pickup_lat', 'pickup_lng', 'dropoff_address', 'dropoff_lat', 'dropoff_lng',
  'recipient_name', 'recipient_phone', 'recipient_consent_declared']) as c;

-- 107. El trigger de contactos es solo de insert (un BEFORE UPDATE invertiría el orden de locks, H03).
select is(
  (select array_agg(tgname::text order by tgname) from pg_trigger
   where tgrelid = 'public.delivery_request_contacts'::regclass and not tgisinternal
     and tgfoid = 'app_private.lock_draft_request_for_child_write()'::regprocedure
     and (tgtype::integer & 4) <> 0 and (tgtype::integer & (8 | 16)) = 0),
  array['trg_lock_draft_contacts'],
  'CC-048: trg_lock_draft_contacts existe sobre delivery_request_contacts y es solo before insert'
);

-- 108-111. La policy de insert rechaza sola, sin el trigger (PR689-H01 / D02-A). El probe corre en una
-- subtransacción que se revierte (deshace el disable trigger); los resultados quedan en variables y las aserciones
-- van afuera, para no revertir el contador de pgTAP.
create temporary table cc048_policy_probe (label text primary key, code text) on commit drop;
do $$
declare
  v_insert constant text := 'insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared) values (%L, %L, %L, %L, %L, true)';
  v_published text;
  v_matched text;
  v_foreign text;
begin
  begin
    alter table public.delivery_request_contacts disable trigger trg_lock_draft_contacts;
    v_published := pg_temp.run(pg_temp.merchant(), format(v_insert, pg_temp.req_published_nc(), 'San Martín 5', 'Belgrano 5', 'Intruso', '3865000005')) ->> 'code';
    v_matched := pg_temp.run(pg_temp.merchant(), format(v_insert, pg_temp.req_matched_nc(), 'San Martín 6', 'Belgrano 6', 'Intruso', '3865000006')) ->> 'code';
    v_foreign := pg_temp.run(pg_temp.merchant(), format(v_insert, pg_temp.req_foreign_draft(), 'San Martín 7', 'Belgrano 7', 'Intruso', '3865000007')) ->> 'code';
    raise exception using errcode = 'U0048', message = 'cc048 policy probe rollback';
  exception when sqlstate 'U0048' then
    null;
  end;
  insert into cc048_policy_probe values ('published', v_published), ('matched', v_matched), ('foreign', v_foreign);
end;
$$;

select is((select code from cc048_policy_probe where label = 'published'), '42501',
  'CC-048: sin el trigger, contacts_insert_merchant rechaza el primer contacto sobre una solicitud published');
select is((select code from cc048_policy_probe where label = 'matched'), '42501',
  'CC-048: sin el trigger, contacts_insert_merchant rechaza el primer contacto sobre una solicitud matched');
select is((select code from cc048_policy_probe where label = 'foreign'), '42501',
  'CC-048: sin el trigger, contacts_insert_merchant rechaza el insert sobre un borrador ajeno');
select is(
  (select tgenabled::text from pg_trigger
   where tgrelid = 'public.delivery_request_contacts'::regclass and tgname = 'trg_lock_draft_contacts'),
  'O', 'CC-048: el rollback del probe deja trg_lock_draft_contacts habilitado');

select * from finish();
rollback;
