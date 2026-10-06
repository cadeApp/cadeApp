begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(16);

create function pg_temp.merchant_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023a1'::uuid $$;
create function pg_temp.merchant_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023a2'::uuid $$;
create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023c1'::uuid $$;
create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023f1'::uuid $$;
create function pg_temp.zone_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023d1'::uuid $$;
create function pg_temp.zone_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023d2'::uuid $$;
create function pg_temp.request_cash() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e1'::uuid $$;
create function pg_temp.request_plain() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e2'::uuid $$;
create function pg_temp.request_other() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000023e3'::uuid $$;
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
  (pg_temp.admin_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc023.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb);

-- handle_new_user ya creó profiles + merchants/couriers al insertar auth.users.
update public.profiles
set consent_status = 'active'
where id in (pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.courier_a(), pg_temp.admin_a());

-- Promover el usuario admin en public.profiles
update public.profiles set role = 'admin' where id = pg_temp.admin_a();

update public.couriers
set status = 'approved',
    available = true
where profile_id = pg_temp.courier_a();

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
