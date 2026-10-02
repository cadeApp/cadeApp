begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(24);

create function pg_temp.merchant_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016a1'::uuid $$;
create function pg_temp.merchant_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016a2'::uuid $$;
create function pg_temp.courier_doc2() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016c2'::uuid $$;
create function pg_temp.courier_doc1() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016c1'::uuid $$;
create function pg_temp.courier_doc0() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016c0'::uuid $$;
create function pg_temp.courier_other() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016c9'::uuid $$;
create function pg_temp.zone_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016d1'::uuid $$;
create function pg_temp.zone_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016d2'::uuid $$;
create function pg_temp.request_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016e1'::uuid $$;
create function pg_temp.request_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016e2'::uuid $$;
create function pg_temp.missing_request() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016ef'::uuid $$;
create function pg_temp.secret_hmac() returns text language sql as $$ select repeat('ab', 32) $$;

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
  (pg_temp.merchant_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc016.ma@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc016.mb@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_doc2(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc016.c2@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_doc1(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc016.c1@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_doc0(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc016.c0@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_other(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc016.c9@example.test', 'pwd', '{"role":"courier"}'::jsonb);

-- handle_new_user ya creó profiles + merchants/couriers al insertar auth.users.
update public.profiles
set display_name = case
      when id = pg_temp.merchant_a() then 'Comercio A'
      when id = pg_temp.merchant_b() then 'Comercio B'
      when id = pg_temp.courier_doc2() then 'Cadete Doc2'
      when id = pg_temp.courier_doc1() then 'Cadete Doc1'
      when id = pg_temp.courier_doc0() then 'Cadete Doc0'
      else 'Cadete Ajeno'
    end,
    phone = case
      when id = pg_temp.courier_doc2() then '3865000002'
      when id = pg_temp.courier_doc1() then '3865000001'
      when id = pg_temp.courier_doc0() then '3865000000'
      when id = pg_temp.courier_other() then '3865000009'
      else '3865222222'
    end,
    consent_status = 'active'
where id in (
  pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.courier_doc2(),
  pg_temp.courier_doc1(), pg_temp.courier_doc0(), pg_temp.courier_other()
);

update public.couriers
set status = 'approved',
    available = true,
    vehicle_type = 'moto',
    vehicle_plate = 'PLACA16',
    license_status = 'verified',
    insurance_status = 'verified',
    dni_hmac = pg_temp.secret_hmac()
where profile_id = pg_temp.courier_doc2();

update public.couriers
set status = 'approved',
    available = true,
    vehicle_type = 'bike',
    license_status = 'verified',
    insurance_status = 'submitted'
where profile_id = pg_temp.courier_doc1();

update public.couriers
set status = 'approved',
    available = true
where profile_id in (pg_temp.courier_doc0(), pg_temp.courier_other());

insert into public.zones (id, name, centroid_lat, centroid_lng, active)
values
  (pg_temp.zone_a(), 'CC016 Zona A', -27.430000, -65.620000, true),
  (pg_temp.zone_b(), 'CC016 Zona B', -27.435000, -65.615000, true);

insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method
) values
  (pg_temp.request_a(), pg_temp.merchant_a(), 'published', pg_temp.zone_a(), pg_temp.zone_b(), 'chico', 'cash'),
  (pg_temp.request_b(), pg_temp.merchant_b(), 'published', pg_temp.zone_a(), pg_temp.zone_b(), 'chico', 'cash');

insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, status)
values
  (pg_temp.request_a(), pg_temp.courier_doc2(), 2000, 15, 'pending'),
  (pg_temp.request_a(), pg_temp.courier_doc1(), 1800, 15, 'pending'),
  (pg_temp.request_a(), pg_temp.courier_doc0(), 1500, 15, 'pending'),
  (pg_temp.request_b(), pg_temp.courier_other(), 1700, 15, 'pending');

create function pg_temp.courier_of(p_result jsonb, p_courier_id uuid)
returns jsonb language sql as $$
  select c
  from jsonb_array_elements(p_result->'couriers') as c
  where (c->>'courierId')::uuid = p_courier_id
$$;

-- 1. Grants y endurecimiento de la función
select ok(
  has_function_privilege('authenticated', 'public.get_request_offer_couriers(uuid)', 'execute'),
  'authenticated can execute get_request_offer_couriers'
);

select ok(
  not has_function_privilege('anon', 'public.get_request_offer_couriers(uuid)', 'execute'),
  'anon cannot execute get_request_offer_couriers'
);

select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.get_request_offer_couriers(uuid)'::regprocedure),
  'get_request_offer_couriers is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
    from pg_proc p, unnest(p.proconfig) as cfg
    where p.oid = 'public.get_request_offer_couriers(uuid)'::regprocedure
      and cfg ~ '^search_path=public,\s*pg_temp$'
  ),
  'get_request_offer_couriers pins search_path to public, pg_temp'
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
    where p.oid = 'public.get_request_offer_couriers(uuid)'::regprocedure
  ),
  'PUBLIC has no EXECUTE on get_request_offer_couriers'
);

-- 2. Comercio dueño: ve exactamente a quienes ofertaron en su solicitud
select pg_temp.act_as(pg_temp.merchant_a());

select is(
  jsonb_array_length(public.get_request_offer_couriers(pg_temp.request_a())->'couriers'),
  3,
  'owner merchant receives the three couriers that offered on its request'
);

select is(
  pg_temp.courier_of(public.get_request_offer_couriers(pg_temp.request_a()), pg_temp.courier_doc2()),
  jsonb_build_object(
    'courierId', pg_temp.courier_doc2(),
    'displayName', 'Cadete Doc2',
    'vehicleType', 'moto',
    'licenseStatus', 'verified',
    'insuranceStatus', 'verified',
    'docLevel', 2
  ),
  'license + insurance verified projects docLevel 2 with exactly the six allowed fields'
);

select is(
  (pg_temp.courier_of(public.get_request_offer_couriers(pg_temp.request_a()), pg_temp.courier_doc1())->>'docLevel')::integer,
  1,
  'only license verified projects docLevel 1'
);

select is(
  pg_temp.courier_of(public.get_request_offer_couriers(pg_temp.request_a()), pg_temp.courier_doc0()),
  jsonb_build_object(
    'courierId', pg_temp.courier_doc0(),
    'displayName', 'Cadete Doc0',
    'vehicleType', null,
    'licenseStatus', 'none',
    'insuranceStatus', 'none',
    'docLevel', 0
  ),
  'no verified documents projects docLevel 0'
);

select ok(
  pg_temp.courier_of(public.get_request_offer_couriers(pg_temp.request_a()), pg_temp.courier_other()) is null,
  'a courier that only offered on another merchant request is not projected'
);

-- 3. Solo las columnas permitidas
select is(
  (
    select array_agg(distinct k order by k)
    from jsonb_array_elements(public.get_request_offer_couriers(pg_temp.request_a())->'couriers') as c,
         jsonb_object_keys(c) as k
  ),
  array['courierId', 'displayName', 'docLevel', 'insuranceStatus', 'licenseStatus', 'vehicleType'],
  'every projected courier exposes only the six allowed keys'
);

select is(
  (
    select array_agg(k order by k)
    from jsonb_object_keys(public.get_request_offer_couriers(pg_temp.request_a())) as k
  ),
  array['couriers', 'requestId'],
  'the envelope exposes only requestId and couriers'
);

select ok(
  public.get_request_offer_couriers(pg_temp.request_a())::text
    !~ ('3865000002|3865000001|3865000000|PLACA16|approved|' || pg_temp.secret_hmac()),
  'phone, plate, approval status and dni_hmac never appear in the projection'
);

-- 4. Los datos devueltos permiten los dos órdenes de la lista de ofertas
select is(
  (
    select array_agg(c->>'displayName' order by (c->>'docLevel')::integer desc)
    from jsonb_array_elements(public.get_request_offer_couriers(pg_temp.request_a())->'couriers') as c
  ),
  array['Cadete Doc2', 'Cadete Doc1', 'Cadete Doc0'],
  'ordering by documentation puts docLevel 2 before 1 before 0'
);

select is(
  (
    select array_agg(c->>'displayName' order by o.amount_ars)
    from public.offers o
    join jsonb_array_elements(public.get_request_offer_couriers(pg_temp.request_a())->'couriers') as c
      on (c->>'courierId')::uuid = o.courier_id
    where o.request_id = pg_temp.request_a()
  ),
  array['Cadete Doc0', 'Cadete Doc1', 'Cadete Doc2'],
  'ordering by price puts 1500 before 1800 before 2000'
);

-- 5. La lectura directa de couriers/profiles sigue cerrada para el comercio
select is(
  (select count(*) from public.couriers)::integer,
  0,
  'merchant still cannot read public.couriers directly'
);

select is(
  (select count(*) from public.profiles where id <> pg_temp.merchant_a())::integer,
  0,
  'merchant still cannot read other profiles directly'
);

-- 6. Otro comercio
select pg_temp.act_as(pg_temp.merchant_b());

select throws_ok(
  $$ select public.get_request_offer_couriers(pg_temp.request_a()) $$,
  'P0001',
  'NOT_FOUND',
  'another merchant cannot read the couriers of a request it does not own'
);

select is(
  (
    select array_agg(c->>'displayName')
    from jsonb_array_elements(public.get_request_offer_couriers(pg_temp.request_b())->'couriers') as c
  ),
  array['Cadete Ajeno'],
  'another merchant only receives the couriers of its own request'
);

select throws_ok(
  $$ select public.get_request_offer_couriers(pg_temp.missing_request()) $$,
  'P0001',
  'NOT_FOUND',
  'a missing request answers the same as a foreign one'
);

-- 7. Actores no autorizados
select pg_temp.act_as(pg_temp.courier_doc2());
select throws_ok(
  $$ select public.get_request_offer_couriers(pg_temp.request_a()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'a courier that offered on the request cannot read the projection'
);

select pg_temp.act_as_authenticated_without_subject();
select throws_ok(
  $$ select public.get_request_offer_couriers(pg_temp.request_a()) $$,
  'P0001',
  'UNAUTHENTICATED',
  'a call without auth.uid() is rejected'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'pending' where id = pg_temp.merchant_a();
select pg_temp.act_as(pg_temp.merchant_a());
select throws_ok(
  $$ select public.get_request_offer_couriers(pg_temp.request_a()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'owner merchant with pending consent cannot bypass the consent gate'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'active' where id = pg_temp.merchant_a();
select pg_temp.act_as(pg_temp.merchant_a());
select throws_ok(
  $$ select public.get_request_offer_couriers(null) $$,
  'P0001',
  'VALIDATION_ERROR',
  'a null request id is rejected'
);

select * from finish();
rollback;
