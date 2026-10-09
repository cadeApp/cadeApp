begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(42);

create function pg_temp.merchant_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023a1'::uuid $$;
create function pg_temp.merchant_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023a2'::uuid $$;
create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023c1'::uuid $$;
create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023f1'::uuid $$;
create function pg_temp.zone_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023d1'::uuid $$;
create function pg_temp.zone_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023d2'::uuid $$;
create function pg_temp.request_cash() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e1'::uuid $$;
create function pg_temp.request_plain() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e2'::uuid $$;
create function pg_temp.request_other() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e3'::uuid $$;
create function pg_temp.courier_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023c2'::uuid $$;
create function pg_temp.request_matched() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e4'::uuid $$;
create function pg_temp.request_inserted() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e5'::uuid $$;
create function pg_temp.offer_matched() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023b1'::uuid $$;
create function pg_temp.missing_request() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023ef'::uuid $$;

create function pg_temp.act_as(actor_id uuid)
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create function pg_temp.act_as_authenticated_without_subject()
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc023.ma@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc023.mb@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc023.ca@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc023.cb@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.admin_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc023.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb);

-- handle_new_user ya creó profiles + merchants/couriers al insertar auth.users.
update public.profiles
set consent_status = 'active'
where id in (pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.courier_a(), pg_temp.courier_b(), pg_temp.admin_a());

update public.profiles
set display_name = case when id = pg_temp.merchant_a() then 'Comercio CC023' else 'Cadete CC023' end,
    phone = case when id = pg_temp.merchant_a() then '3865222323' else '3865111323' end
where id in (pg_temp.merchant_a(), pg_temp.courier_a(), pg_temp.courier_b());

update public.merchants
set business_name = 'Kiosco CC023',
    subscription_status = 'pilot'
where profile_id = pg_temp.merchant_a();

-- Promover el usuario admin en public.profiles
update public.profiles set role = 'admin' where id = pg_temp.admin_a();

update public.couriers
set status = 'approved',
    available = true,
    vehicle_type = 'moto',
    vehicle_plate = 'CC023AA'
where profile_id in (pg_temp.courier_a(), pg_temp.courier_b());

insert into public.zones (id, name, centroid_lat, centroid_lng, active)
values
  (pg_temp.zone_a(), 'CC023 Zona A', -27.430000, -65.620000, true),
  (pg_temp.zone_b(), 'CC023 Zona B', -27.435000, -65.615000, true);

insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method,
  needs_change, cash_change_amount, notes
) values
  (pg_temp.request_cash(), pg_temp.merchant_a(), 'published', pg_temp.zone_a(), pg_temp.zone_b(), 'chico', 'cash',
   true, 5000, 'Tocar timbre 2B'),
  (pg_temp.request_plain(), pg_temp.merchant_a(), 'draft', pg_temp.zone_a(), pg_temp.zone_b(), 'chico', 'transfer',
   false, null, null),
  (pg_temp.request_other(), pg_temp.merchant_b(), 'published', pg_temp.zone_a(), pg_temp.zone_b(), 'chico', 'cash',
   true, 2000, 'Indicaciones ajenas');

-- Solicitud con match: el repartidor A es el aceptado; el B no.
insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method,
  needs_change, cash_change_amount, notes
) values
  (pg_temp.request_matched(), pg_temp.merchant_a(), 'published', pg_temp.zone_a(), pg_temp.zone_b(), 'chico', 'cash',
   true, 8000, 'Portón verde');

insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (
  pg_temp.request_matched(), 'San Martín 450', 'Belgrano 1220', 'Laura Gómez', '3865123456', true
);

insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status, decided_at)
values (pg_temp.offer_matched(), pg_temp.request_matched(), pg_temp.courier_a(), 1800, 15, 'accepted', now());

update public.delivery_requests
set status = 'matched', accepted_offer_id = pg_temp.offer_matched(), matched_at = now()
where id = pg_temp.request_matched();

-- 1. RPC get_merchant_request_private_fields: grants y endurecimiento
select ok(
  has_function_privilege('authenticated', 'public.get_merchant_request_private_fields(uuid)', 'execute'),
  'authenticated can execute get_merchant_request_private_fields'
);

select ok(
  not has_function_privilege('anon', 'public.get_merchant_request_private_fields(uuid)', 'execute'),
  'anon cannot execute get_merchant_request_private_fields'
);

select ok(
  (
    select p.proacl is not null
      and not exists (
        select 1
        from aclexplode(p.proacl) as acl
        where acl.privilege_type = 'EXECUTE'
          and acl.grantee = 0
      )
    from pg_proc p
    where p.oid = 'public.get_merchant_request_private_fields(uuid)'::regprocedure
  ),
  'PUBLIC has no EXECUTE on get_merchant_request_private_fields'
);

select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.get_merchant_request_private_fields(uuid)'::regprocedure),
  'get_merchant_request_private_fields is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
    from pg_proc p, unnest(p.proconfig) as cfg
    where p.oid = 'public.get_merchant_request_private_fields(uuid)'::regprocedure
      and cfg ~ '^search_path=public,\s*pg_temp$'
  ),
  'get_merchant_request_private_fields pins search_path to public, pg_temp'
);

select is(
  (select p.provolatile from pg_proc p where p.oid = 'public.get_merchant_request_private_fields(uuid)'::regprocedure),
  's'::"char",
  'get_merchant_request_private_fields is STABLE (read only)'
);

-- 2. Comercio dueño: recibe los dos campos, en cualquier estado de su solicitud
select pg_temp.act_as(pg_temp.merchant_a());

select is(
  public.get_merchant_request_private_fields(pg_temp.request_cash()),
  jsonb_build_object(
    'requestId', pg_temp.request_cash(),
    'notes', 'Tocar timbre 2B',
    'cashChangeAmount', 5000
  ),
  'owner merchant receives requestId, notes and cashChangeAmount'
);

select is(
  public.get_merchant_request_private_fields(pg_temp.request_plain()),
  jsonb_build_object(
    'requestId', pg_temp.request_plain(),
    'notes', null,
    'cashChangeAmount', null
  ),
  'owner merchant receives explicit nulls for a draft without private fields'
);

-- 3. Otro comercio o id inexistente: misma respuesta
select throws_ok(
  $$ select public.get_merchant_request_private_fields(pg_temp.request_other()) $$,
  'P0001',
  'NOT_FOUND',
  'a merchant cannot read the private fields of another merchant request'
);

select throws_ok(
  $$ select public.get_merchant_request_private_fields(pg_temp.missing_request()) $$,
  'P0001',
  'NOT_FOUND',
  'a missing request answers the same as a foreign one'
);

select throws_ok(
  $$ select public.get_merchant_request_private_fields(null) $$,
  'P0001',
  'VALIDATION_ERROR',
  'a null request id is rejected'
);

-- 4. Actores no autorizados
select pg_temp.act_as(pg_temp.courier_a());
select throws_ok(
  $$ select public.get_merchant_request_private_fields(pg_temp.request_cash()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'an approved courier cannot read the private fields through the RPC'
);

select pg_temp.act_as(pg_temp.admin_a());
select throws_ok(
  $$ select public.get_merchant_request_private_fields(pg_temp.request_cash()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'an admin with a session cannot read the private fields through the RPC'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'pending' where id = pg_temp.merchant_a();
select pg_temp.act_as(pg_temp.merchant_a());
select throws_ok(
  $$ select public.get_merchant_request_private_fields(pg_temp.request_cash()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'owner merchant without active consent cannot bypass the consent gate'
);

select pg_temp.act_as_authenticated_without_subject();
select throws_ok(
  $$ select public.get_merchant_request_private_fields(pg_temp.request_cash()) $$,
  'P0001',
  'UNAUTHENTICATED',
  'a call without auth.uid() is rejected'
);

-- 5. Grants por columna en public.delivery_requests (catálogo)
select pg_temp.reset_actor();

select ok(
  not has_table_privilege('authenticated', 'public.delivery_requests', 'SELECT'),
  'authenticated has no table-level SELECT on delivery_requests'
);

select ok(
  not has_column_privilege('authenticated', 'public.delivery_requests', 'notes', 'SELECT'),
  'authenticated cannot SELECT delivery_requests.notes'
);

select ok(
  not has_column_privilege('authenticated', 'public.delivery_requests', 'cash_change_amount', 'SELECT'),
  'authenticated cannot SELECT delivery_requests.cash_change_amount'
);

select is(
  (
    select array_agg(c.column_name::text order by c.column_name)
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'delivery_requests'
      and not has_column_privilege('authenticated', 'public.delivery_requests', c.column_name, 'SELECT')
  ),
  array['cash_change_amount', 'notes'],
  'every other delivery_requests column stays selectable for authenticated'
);

select ok(
  not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'delivery_requests'
      and has_column_privilege('anon', 'public.delivery_requests', c.column_name, 'SELECT')
  ),
  'anon cannot SELECT any delivery_requests column'
);

-- 6. Bypass directo por actor: notes, cash_change_amount y * → 42501; las columnas públicas siguen legibles
select pg_temp.act_as(pg_temp.courier_a());

select throws_ok(
  format('select notes from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'approved courier before the match cannot select notes'
);
select throws_ok(
  format('select cash_change_amount from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'approved courier before the match cannot select cash_change_amount'
);
select throws_ok(
  format('select * from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'approved courier before the match cannot select *'
);
select is(
  (select dr.status::text from public.delivery_requests dr where dr.id = pg_temp.request_cash()),
  'published',
  'approved courier still reads public columns of a published request'
);

select throws_ok(
  format('select notes from public.delivery_requests where id = %L', pg_temp.request_matched()),
  '42501'::char(5), null::text,
  'accepted courier after the match cannot select notes'
);
select throws_ok(
  format('select cash_change_amount from public.delivery_requests where id = %L', pg_temp.request_matched()),
  '42501'::char(5), null::text,
  'accepted courier after the match cannot select cash_change_amount'
);
select throws_ok(
  format('select * from public.delivery_requests where id = %L', pg_temp.request_matched()),
  '42501'::char(5), null::text,
  'accepted courier after the match cannot select *'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'active' where id = pg_temp.merchant_a();
select pg_temp.act_as(pg_temp.merchant_a());

select throws_ok(
  format('select notes from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'owner merchant cannot select notes'
);
select throws_ok(
  format('select cash_change_amount from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'owner merchant cannot select cash_change_amount'
);
select throws_ok(
  format('select * from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'owner merchant cannot select *'
);
select is(
  (select dr.needs_change from public.delivery_requests dr where dr.id = pg_temp.request_cash()),
  true,
  'owner merchant still reads public columns of its request'
);

select pg_temp.act_as(pg_temp.admin_a());

select throws_ok(
  format('select notes from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'admin with a session cannot select notes'
);
select throws_ok(
  format('select cash_change_amount from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'admin with a session cannot select cash_change_amount'
);
select throws_ok(
  format('select * from public.delivery_requests where id = %L', pg_temp.request_cash()),
  '42501'::char(5), null::text,
  'admin with a session cannot select *'
);

-- 7. El insert del comercio con los dos campos sigue funcionando (insert ... returning id, como la app)
select pg_temp.act_as(pg_temp.merchant_a());

select lives_ok(
  format(
    'insert into public.delivery_requests ('
    'id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, '
    'needs_change, cash_change_amount, notes'
    ') values (%L, %L, ''draft'', %L, %L, ''chico'', ''cash'', true, 4000, ''Timbre 3'') returning id',
    pg_temp.request_inserted(), pg_temp.merchant_a(), pg_temp.zone_a(), pg_temp.zone_b()
  ),
  'owner merchant still inserts notes and cash_change_amount'
);

select pg_temp.reset_actor();
select is(
  (
    select jsonb_build_object('notes', dr.notes, 'cash', dr.cash_change_amount)
    from public.delivery_requests dr
    where dr.id = pg_temp.request_inserted()
  ),
  jsonb_build_object('notes', 'Timbre 3', 'cash', 4000),
  'the inserted private fields are stored'
);

-- 8. get_trip_details sigue devolviendo los dos datos después del match
select pg_temp.act_as(pg_temp.courier_a());
select is(
  public.get_trip_details(pg_temp.request_matched()) ->> 'deliveryNotes',
  'Portón verde',
  'accepted courier still receives deliveryNotes from get_trip_details'
);
select is(
  (public.get_trip_details(pg_temp.request_matched()) ->> 'cashChangeAmount')::integer,
  8000,
  'accepted courier still receives cashChangeAmount from get_trip_details'
);

select pg_temp.act_as(pg_temp.merchant_a());
select is(
  public.get_trip_details(pg_temp.request_matched()) ->> 'deliveryNotes',
  'Portón verde',
  'owner merchant still receives deliveryNotes from get_trip_details'
);
select is(
  (public.get_trip_details(pg_temp.request_matched()) ->> 'cashChangeAmount')::integer,
  8000,
  'owner merchant still receives cashChangeAmount from get_trip_details'
);

select pg_temp.act_as(pg_temp.courier_b());
select throws_ok(
  $$ select public.get_trip_details(pg_temp.request_matched()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'a courier that was not accepted is still rejected by get_trip_details'
);

select pg_temp.reset_actor();
set local role anon;
select throws_ok(
  $$ select public.get_merchant_request_private_fields('00000000-0000-4000-8000-0000000023e1'::uuid) $$,
  '42501'::char(5),
  null::text,
  'anon is denied EXECUTE on get_merchant_request_private_fields'
);
reset role;

select * from finish();
rollback;
