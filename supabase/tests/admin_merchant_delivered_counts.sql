begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(28);

-- #336: conteo admin de solicitudes entregadas por comercio sin ampliar los grants de CC-023.
create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000336a1'::uuid $$;
create function pg_temp.merchant_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000336b1'::uuid $$;
create function pg_temp.merchant_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000336b2'::uuid $$;
create function pg_temp.merchant_c() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000336b3'::uuid $$;
create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000336c1'::uuid $$;
create function pg_temp.zone_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000336d1'::uuid $$;

create function pg_temp.act_as(actor_id uuid, aal text default 'aal2')
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', aal)::text,
    true
  );
end;
$$;

create function pg_temp.act_as_authenticated_without_subject()
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal2')::text, true);
end;
$$;

create function pg_temp.act_as_anon()
returns void language plpgsql as $$
begin
  set local role anon;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
end;
$$;

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Cantidad de solicitudes entregadas que la RPC informa para un comercio (null si no lo devuelve).
create function pg_temp.count_for(p_result jsonb, p_merchant_id uuid)
returns integer language sql as $$
  select (e->>'delivered_count')::integer
  from jsonb_array_elements(p_result) e
  where e->>'merchant_id' = p_merchant_id::text
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc336.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc336.ma@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc336.mb@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_c(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc336.mc@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc336.ca@example.test', 'pwd', '{"role":"courier"}'::jsonb);

-- handle_new_user ya creó profiles + merchants/couriers al insertar auth.users.
update public.profiles
set consent_status = 'active'
where id in (pg_temp.admin_a(), pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.merchant_c(), pg_temp.courier_a());

update public.profiles set role = 'admin' where id = pg_temp.admin_a();

update public.couriers
set status = 'approved', available = true, vehicle_type = 'moto', vehicle_plate = 'CC336AA'
where profile_id = pg_temp.courier_a();

insert into public.zones (id, name, centroid_lat, centroid_lng, active)
values (pg_temp.zone_a(), 'CC336 Zona A', -27.430000, -65.620000, true);

-- Comercio A: 2 entregadas y una de cada otro estado. Comercio B: 1 entregada y 1 publicada.
-- Comercio C: ninguna entregada. Las notas y el cambio son datos privados que nunca deben salir.
insert into public.delivery_requests (
  merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method,
  needs_change, cash_change_amount, notes, published_at, delivered_at
) values
  (pg_temp.merchant_a(), 'delivered', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', true, 3360, 'Indicaciones CC336 A1', now(), now()),
  (pg_temp.merchant_a(), 'delivered', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, 'Indicaciones CC336 A2', now(), now()),
  (pg_temp.merchant_a(), 'published', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null, now(), null),
  (pg_temp.merchant_a(), 'matched', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null, now(), null),
  (pg_temp.merchant_a(), 'in_transit', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null, now(), null),
  (pg_temp.merchant_a(), 'cancelled', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null, now(), null),
  (pg_temp.merchant_a(), 'expired', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null, now(), null),
  (pg_temp.merchant_a(), 'draft', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null, null, null),
  (pg_temp.merchant_b(), 'delivered', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'transfer', false, null, 'Indicaciones CC336 B1', now(), now()),
  (pg_temp.merchant_b(), 'published', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'transfer', false, null, null, now(), null),
  (pg_temp.merchant_c(), 'published', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null, now(), null);

-- 1. Definición de la función y permisos de ejecución
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.admin_merchant_delivered_counts(uuid[])'::regprocedure),
  'admin_merchant_delivered_counts is security definer'
);

select ok(
  (
    select p.proconfig @> array['search_path=public, pg_temp']
    from pg_proc p
    where p.oid = 'public.admin_merchant_delivered_counts(uuid[])'::regprocedure
  ),
  'admin_merchant_delivered_counts pins search_path to public, pg_temp'
);

select ok(
  has_function_privilege('authenticated', 'public.admin_merchant_delivered_counts(uuid[])', 'execute'),
  'authenticated can execute admin_merchant_delivered_counts'
);

select ok(
  not has_function_privilege('anon', 'public.admin_merchant_delivered_counts(uuid[])', 'execute'),
  'anon cannot execute admin_merchant_delivered_counts'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.admin_merchant_delivered_counts(uuid[])'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE on admin_merchant_delivered_counts'
);

-- 2. Admin con AAL2: conteos exactos solo de solicitudes entregadas, por comercio
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');

select is(
  pg_temp.count_for(
    public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.merchant_c()]),
    pg_temp.merchant_a()
  ),
  2,
  'admin AAL2 gets merchant A delivered count (2 of 8 requests, other states excluded)'
);

select is(
  pg_temp.count_for(
    public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.merchant_c()]),
    pg_temp.merchant_b()
  ),
  1,
  'admin AAL2 gets merchant B delivered count (1 of 2 requests)'
);

select is(
  pg_temp.count_for(
    public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.merchant_c()]),
    pg_temp.merchant_c()
  ),
  0,
  'admin AAL2 gets 0 for a merchant without delivered requests'
);

select is(
  jsonb_array_length(
    public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.merchant_c()])
  ),
  3,
  'one row per requested merchant'
);

select is(
  jsonb_array_length(
    public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_a(), pg_temp.merchant_b()])
  ),
  2,
  'duplicated ids return one row per distinct merchant'
);

select is(
  pg_temp.count_for(public.admin_merchant_delivered_counts(array[pg_temp.merchant_b()]), pg_temp.merchant_a()),
  null::integer,
  'only requested merchants are returned'
);

select is(
  public.admin_merchant_delivered_counts(array[]::uuid[]),
  '[]'::jsonb,
  'an empty page returns an empty array'
);

-- 3. La salida solo trae id y cantidad: ni columnas ni valores privados
select is(
  (
    select count(*)
    from jsonb_array_elements(
      public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.merchant_c()])
    ) e
    where (select array_agg(k order by k) from jsonb_object_keys(e) k) <> array['delivered_count', 'merchant_id']
  ),
  0::bigint,
  'every row has exactly merchant_id and delivered_count'
);

select ok(
  public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_b()])::text
    not like '%Indicaciones CC336%'
  and public.admin_merchant_delivered_counts(array[pg_temp.merchant_a(), pg_temp.merchant_b()])::text
    not like '%3360%',
  'the result never carries notes or the exact cash change amount'
);

-- 4. Entrada acotada a una página (máximo 50 ids, sin null)
select lives_ok(
  format(
    'select public.admin_merchant_delivered_counts(%L::uuid[])',
    (select array_agg(gen_random_uuid()) from generate_series(1, 50))
  ),
  '50 ids (one full page) are accepted'
);

select throws_ok(
  format(
    'select public.admin_merchant_delivered_counts(%L::uuid[])',
    (select array_agg(gen_random_uuid()) from generate_series(1, 51))
  ),
  'P0001'::char(5), 'VALIDATION_ERROR'::text,
  '51 ids are rejected'
);

select throws_ok(
  'select public.admin_merchant_delivered_counts(null)',
  'P0001'::char(5), 'VALIDATION_ERROR'::text,
  'a null array is rejected'
);

select throws_ok(
  format('select public.admin_merchant_delivered_counts(array[%L::uuid, null])', pg_temp.merchant_a()),
  'P0001'::char(5), 'VALIDATION_ERROR'::text,
  'an array with a null id is rejected'
);

-- 5. Actores no autorizados: la guarda corre antes de cualquier consulta
select pg_temp.act_as(pg_temp.admin_a(), 'aal1');
select throws_ok(
  format('select public.admin_merchant_delivered_counts(array[%L::uuid])', pg_temp.merchant_a()),
  'P0001'::char(5), 'AAL2_REQUIRED'::text,
  'admin with AAL1 is rejected'
);

select pg_temp.act_as(pg_temp.merchant_a(), 'aal2');
select throws_ok(
  format('select public.admin_merchant_delivered_counts(array[%L::uuid])', pg_temp.merchant_a()),
  'P0001'::char(5), 'UNAUTHORIZED_ACTOR'::text,
  'merchant is rejected even for its own id'
);

select pg_temp.act_as(pg_temp.courier_a(), 'aal2');
select throws_ok(
  format('select public.admin_merchant_delivered_counts(array[%L::uuid])', pg_temp.merchant_a()),
  'P0001'::char(5), 'UNAUTHORIZED_ACTOR'::text,
  'courier is rejected'
);

select pg_temp.act_as_authenticated_without_subject();
select throws_ok(
  format('select public.admin_merchant_delivered_counts(array[%L::uuid])', pg_temp.merchant_a()),
  'P0001'::char(5), 'UNAUTHENTICATED'::text,
  'authenticated role without a subject is rejected'
);

select pg_temp.act_as_anon();
select throws_ok(
  format('select public.admin_merchant_delivered_counts(array[%L::uuid])', pg_temp.merchant_a()),
  '42501'::char(5), null::text,
  'anon cannot call the function'
);

-- 6. Los grants de CC-023 siguen intactos
select pg_temp.reset_actor();

select ok(
  not has_table_privilege('authenticated', 'public.delivery_requests', 'SELECT'),
  'authenticated still has no table-level SELECT on delivery_requests'
);

select ok(
  not has_column_privilege('authenticated', 'public.delivery_requests', 'notes', 'SELECT'),
  'authenticated still cannot SELECT delivery_requests.notes'
);

select ok(
  not has_column_privilege('authenticated', 'public.delivery_requests', 'cash_change_amount', 'SELECT'),
  'authenticated still cannot SELECT delivery_requests.cash_change_amount'
);

-- Ni el admin lee los datos privados por tabla: el conteo sale de la RPC, no de un grant nuevo.
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select throws_ok(
  format('select notes from public.delivery_requests where merchant_id = %L', pg_temp.merchant_a()),
  '42501'::char(5), null::text,
  'admin still cannot select notes directly'
);

select throws_ok(
  format('select cash_change_amount from public.delivery_requests where merchant_id = %L', pg_temp.merchant_a()),
  '42501'::char(5), null::text,
  'admin still cannot select cash_change_amount directly'
);

select * from finish();
rollback;
