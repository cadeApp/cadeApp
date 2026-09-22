begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(15);

-- IDs para los actores de la matriz
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000a1'::uuid $$;
create function pg_temp.merchant_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000m1'::uuid $$;
create function pg_temp.merchant_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000m2'::uuid $$;
create function pg_temp.courier_pending_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c1'::uuid $$;
create function pg_temp.courier_approved_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c2'::uuid $$;
create function pg_temp.courier_approved_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c3'::uuid $$;
create function pg_temp.courier_suspended_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c4'::uuid $$;

-- IDs de solicitudes y ofertas
create function pg_temp.req_m1_pub_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000101'::uuid $$;
create function pg_temp.req_m1_matched_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000102'::uuid $$;
create function pg_temp.req_m2_pub_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000103'::uuid $$;
create function pg_temp.offer_c1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000201'::uuid $$;
create function pg_temp.offer_c2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000202'::uuid $$;

-- Helper para cambiar contexto de autenticación como en Supabase
create function pg_temp.act_as(role_name text, actor_id uuid default null)
returns void
language plpgsql
as $$
begin
  if role_name = 'anon' then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

create function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Setup fixture data como superusuario
do $$
declare
  zone_id uuid;
begin
  select id into zone_id from public.zones where active limit 1;

  -- Usuarios en auth.users
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm1@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.courier_pending_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_approved_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_approved_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_suspended_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c4@example.test', 'pwd', '{"role": "courier"}');

  -- Promover admin vía bootstrap oficial
  update public.profiles set role = 'admin' where id = pg_temp.admin_id();

  -- Ajustar estados de couriers
  update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.courier_approved_1_id(), pg_temp.courier_approved_2_id());
  update public.couriers set status = 'suspended' where profile_id = pg_temp.courier_suspended_id();

  -- Solicitudes
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status, expires_at)
  values
    (pg_temp.req_m1_pub_id(), pg_temp.merchant_1_id(), zone_id, zone_id, 'chico', 'cash', 'published', now() + interval '1 hour'),
    (pg_temp.req_m1_matched_id(), pg_temp.merchant_1_id(), zone_id, zone_id, 'chico', 'cash', 'matched', now() + interval '1 hour'),
    (pg_temp.req_m2_pub_id(), pg_temp.merchant_2_id(), zone_id, zone_id, 'mediano', 'transfer', 'published', now() + interval '1 hour');

  -- Contactos
  insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone)
  values
    (pg_temp.req_m1_pub_id(), 'San Martin 100', 'Alberdi 200', 'Destinatario M1 Pub', '3865111111'),
    (pg_temp.req_m1_matched_id(), 'San Martin 100', 'Belgrano 300', 'Destinatario M1 Matched', '3865222222'),
    (pg_temp.req_m2_pub_id(), 'Mitre 500', 'Avellaneda 600', 'Destinatario M2 Pub', '3865333333');

  -- Ofertas
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values
    (pg_temp.offer_c1_id(), pg_temp.req_m1_matched_id(), pg_temp.courier_approved_1_id(), 1500, 15, 'accepted'),
    (pg_temp.offer_c2_id(), pg_temp.req_m1_pub_id(), pg_temp.courier_approved_2_id(), 1600, 20, 'pending');

  -- Vincular oferta aceptada
  update public.delivery_requests set accepted_offer_id = pg_temp.offer_c1_id() where id = pg_temp.req_m1_matched_id();
end;
$$;

-- 1. anon no ve delivery_requests
select pg_temp.act_as('anon');
select is(
  (select count(*) from public.delivery_requests),
  0::bigint,
  'anon sees 0 delivery_requests'
);

-- 2. anon no ve delivery_request_contacts
select is(
  (select count(*) from public.delivery_request_contacts),
  0::bigint,
  'anon sees 0 delivery_request_contacts'
);

-- 3. merchant_1 ve sus solicitudes, no las de merchant_2
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select is(
  (select count(*) from public.delivery_requests),
  2::bigint,
  'merchant_1 sees only its own 2 delivery_requests'
);

-- 4. merchant_1 ve los contactos de sus solicitudes
select is(
  (select count(*) from public.delivery_request_contacts),
  2::bigint,
  'merchant_1 sees contacts for its own 2 requests'
);

-- 5. courier pending ve 0 delivery_requests
select pg_temp.act_as('authenticated', pg_temp.courier_pending_id());
select is(
  (select count(*) from public.delivery_requests),
  0::bigint,
  'courier pending sees 0 delivery_requests'
);

-- 6. courier suspended ve 0 delivery_requests
select pg_temp.act_as('authenticated', pg_temp.courier_suspended_id());
select is(
  (select count(*) from public.delivery_requests),
  0::bigint,
  'courier suspended sees 0 delivery_requests'
);

-- 7. courier approved ve solicitudes published
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select count(*) from public.delivery_requests where status = 'published'),
  2::bigint,
  'courier approved sees 2 published delivery_requests'
);

-- 8. INVARIANTE CLAVE: courier approved_1 ve SOLO contactos de la solicitud donde es el asignado
select is(
  (select array_agg(request_id order by request_id) from public.delivery_request_contacts),
  array[pg_temp.req_m1_matched_id()],
  'courier approved sees contacts ONLY for matched request where it is the accepted courier'
);

-- 9. courier approved_2 NO ve contactos de req_m1_matched
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select is(
  (select count(*) from public.delivery_request_contacts),
  0::bigint,
  'courier approved_2 sees 0 contacts because it was not accepted on any request'
);

-- 10. merchant ve ofertas de sus solicitudes
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select is(
  (select count(*) from public.offers),
  2::bigint,
  'merchant_1 sees the 2 offers made to its requests'
);

-- 11. courier approved ve solo sus propias ofertas
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select count(*) from public.offers),
  1::bigint,
  'courier approved_1 sees only its 1 own offer'
);

-- 12. Storage courier-docs: bucket existe y es privado
select pg_temp.reset_actor();
select ok(
  exists (select 1 from storage.buckets where id = 'courier-docs' and not public),
  'bucket courier-docs exists and is private'
);

-- 13. Storage courier-docs: select denegado a courier autenticado
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select count(*) from storage.objects where bucket_id = 'courier-docs'),
  0::bigint,
  'direct select on storage courier-docs is denied to authenticated couriers'
);

-- 14. admin ve todas las solicitudes y contactos
select pg_temp.act_as('authenticated', pg_temp.admin_id());
select is(
  (select count(*) from public.delivery_requests),
  3::bigint,
  'admin sees all 3 delivery_requests'
);

-- 15. H07: merchant puede hacer update y dispara set_updated_at sin error de permisos
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select lives_ok(
  'update public.delivery_requests set notes = ''updated by merchant'' where id = pg_temp.req_m1_pub_id()',
  'merchant can update its own request and trigger set_updated_at executes without privilege error'
);

select * from finish();
rollback;
