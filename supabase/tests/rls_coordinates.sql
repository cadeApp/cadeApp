begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(21);

-- IDs de prueba para actores
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000061a1'::uuid $$;
create function pg_temp.merchant_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000061b1'::uuid $$;
create function pg_temp.merchant_idle_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000061b2'::uuid $$;
create function pg_temp.courier_approved_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000061c1'::uuid $$;
create function pg_temp.courier_approved_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000061c2'::uuid $$;

-- IDs de solicitudes y ofertas
create function pg_temp.req_pub_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000006201'::uuid $$;
create function pg_temp.req_matched_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000006202'::uuid $$;
create function pg_temp.offer_accepted_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000006301'::uuid $$;

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

-- Setup del fixture
do $$
declare
  v_zone_id uuid;
begin
  select id into v_zone_id from public.zones where active limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-coord@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm1-coord@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_idle_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'midle-coord@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.courier_approved_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-coord@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_approved_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2-coord@example.test', 'pwd', '{"role": "courier"}');

  update public.profiles set role = 'admin', consent_status = 'active' where id = pg_temp.admin_id();
  update public.profiles set role = 'merchant', consent_status = 'active', display_name = 'Comercio Activo', phone = '3815551111' where id = pg_temp.merchant_1_id();
  update public.profiles set role = 'merchant', consent_status = 'active', display_name = 'Comercio Ocioso', phone = '3815552222' where id = pg_temp.merchant_idle_id();
  update public.profiles set role = 'courier', consent_status = 'active', display_name = 'Repartidor 1', phone = '3815553333' where id = pg_temp.courier_approved_1_id();
  update public.profiles set role = 'courier', consent_status = 'active', display_name = 'Repartidor 2', phone = '3815554444' where id = pg_temp.courier_approved_2_id();

  update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.courier_approved_1_id(), pg_temp.courier_approved_2_id());

  update public.merchants set
    business_name = 'Empanadas Aguilares',
    default_pickup_address = 'Alberdi 123',
    default_pickup_lat = -27.433000,
    default_pickup_lng = -65.616000,
    subscription_status = 'active',
    paid_until = '2099-12-31',
    notes = 'Nota confidencial comercial y privada'
  where profile_id = pg_temp.merchant_1_id();

  update public.merchants set
    business_name = 'Kiosco Ocioso',
    default_pickup_address = 'Mitre 456',
    default_pickup_lat = -27.425000,
    default_pickup_lng = -65.608000,
    subscription_status = 'pilot',
    paid_until = null,
    notes = 'Kiosco sin actividad'
  where profile_id = pg_temp.merchant_idle_id();

  -- Solicitud 1: publicada y abierta (sin repartidor asignado)
  insert into public.delivery_requests (
    id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
    recipient_payment_method, expires_at, created_at, published_at
  ) values (
    pg_temp.req_pub_id(), pg_temp.merchant_1_id(), 'published', v_zone_id, v_zone_id,
    'chico', 'cash', now() + interval '1 hour', now(), now()
  );

  insert into public.delivery_request_contacts (
    request_id, pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    pg_temp.req_pub_id(), 'Alberdi 123', -27.433000, -65.616000,
    'Sarmiento 789', -27.425000, -65.608000,
    'Juan Destinatario', '3815559999', true
  );

  -- Solicitud 2: asignada a courier_approved_1
  insert into public.delivery_requests (
    id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
    recipient_payment_method, expires_at, created_at, published_at, matched_at
  ) values (
    pg_temp.req_matched_id(), pg_temp.merchant_1_id(), 'matched', v_zone_id, v_zone_id,
    'chico', 'cash', now() + interval '1 hour', now(), now(), now()
  );

  insert into public.delivery_request_contacts (
    request_id, pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    pg_temp.req_matched_id(), 'Alberdi 123', -27.433000, -65.616000,
    'Gorriti 555', -27.428000, -65.612000,
    'Maria Destinataria', '3815558888', true
  );

  insert into public.offers (
    id, request_id, courier_id, amount_ars, eta_minutes, status, decided_at
  ) values (
    pg_temp.offer_accepted_id(), pg_temp.req_matched_id(), pg_temp.courier_approved_1_id(),
    1500, 20, 'accepted', now()
  );

  update public.delivery_requests
  set accepted_offer_id = pg_temp.offer_accepted_id()
  where id = pg_temp.req_matched_id();
end;
$$;

-- 1. Repartidor no aceptado (courier 2) recibe NULL al leer coordenadas de contacts directamente
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select is(
  (select pickup_lat from public.delivery_request_contacts where request_id = pg_temp.req_pub_id()),
  null,
  'unaccepted courier receives NULL reading pickup_lat from delivery_request_contacts'
);

-- 2. Repartidor no aceptado recibe NULL para pickup_lng
select is(
  (select pickup_lng from public.delivery_request_contacts where request_id = pg_temp.req_pub_id()),
  null,
  'unaccepted courier receives NULL reading pickup_lng from delivery_request_contacts'
);

-- 3. Repartidor no aceptado recibe NULL para dropoff_lat
select is(
  (select dropoff_lat from public.delivery_request_contacts where request_id = pg_temp.req_pub_id()),
  null,
  'unaccepted courier receives NULL reading dropoff_lat from delivery_request_contacts'
);

-- 4. Repartidor no aceptado recibe NULL para dropoff_lng
select is(
  (select dropoff_lng from public.delivery_request_contacts where request_id = pg_temp.req_pub_id()),
  null,
  'unaccepted courier receives NULL reading dropoff_lng from delivery_request_contacts'
);

-- 5. Repartidor no aceptado que hace LEFT JOIN ve coordenadas en NULL
select is(
  (
    select c.pickup_lat
    from public.delivery_requests r
    left join public.delivery_request_contacts c on c.request_id = r.id
    where r.id = pg_temp.req_pub_id()
  ),
  null,
  'unaccepted courier sees NULL coordinates in left join between requests and contacts'
);

-- 6. Repartidor aceptado (courier 1) sí lee coordenadas exactas de la solicitud matched
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select pickup_lat from public.delivery_request_contacts where request_id = pg_temp.req_matched_id()),
  -27.433000::numeric,
  'accepted courier reads exact pickup_lat for assigned request'
);

select is(
  (select dropoff_lat from public.delivery_request_contacts where request_id = pg_temp.req_matched_id()),
  -27.428000::numeric,
  'accepted courier reads exact dropoff_lat for assigned request'
);

-- 7. Repartidor aceptado en matched NO lee contactos de otra solicitud donde no fue aceptado
select is(
  (select pickup_lat from public.delivery_request_contacts where request_id = pg_temp.req_pub_id()),
  null,
  'accepted courier on request B receives NULL on published request A where it is not accepted'
);

-- 8. Comercio dueño sí lee coordenadas de sus propias solicitudes
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select is(
  (select pickup_lat from public.delivery_request_contacts where request_id = pg_temp.req_pub_id()),
  -27.433000::numeric,
  'owner merchant reads exact pickup_lat for its own request'
);

-- 9. Admin lee coordenadas de contactos
select pg_temp.act_as('authenticated', pg_temp.admin_id());
select is(
  (select pickup_lat from public.delivery_request_contacts where request_id = pg_temp.req_pub_id()),
  -27.433000::numeric,
  'admin reads pickup_lat from any delivery_request_contacts'
);

-- 10. Vista merchant_public existe en public
select ok(
  to_regclass('public.merchant_public') is not null,
  'public.merchant_public view exists'
);

-- 11. PR56-H13: merchant_public no contiene columnas sensibles (notes, paid_until, subscription_status)
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'merchant_public'
      and column_name in ('notes', 'paid_until', 'subscription_status')
  ),
  'PR56-H13: merchant_public does not expose notes, paid_until or subscription_status'
);

-- 12. merchant_public no contiene coordenadas exactas del comercio (default_pickup_lat/lng)
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'merchant_public'
      and column_name in ('default_pickup_lat', 'default_pickup_lng')
  ),
  'merchant_public does not expose default_pickup_lat/lng'
);

-- 13. merchant_public expone únicamente los campos canónicos seguros del comercio
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'merchant_public'
      and column_name = expected_col
  ),
  format('merchant_public exposes safe column %s', expected_col)
)
from (values
  ('profile_id'),
  ('business_name'),
  ('default_pickup_zone_id'),
  ('default_pickup_address')
) as expected(expected_col);

-- 14. Repartidor aprobado ve comercio activo a través de merchant_public
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select ok(
  exists (select 1 from public.merchant_public where profile_id = pg_temp.merchant_1_id()),
  'approved courier sees active merchant with published requests in merchant_public'
);

-- 15. Repartidor aprobado NO ve comercio ocioso a través de merchant_public
select ok(
  not exists (select 1 from public.merchant_public where profile_id = pg_temp.merchant_idle_id()),
  'approved courier does NOT see idle merchant in merchant_public'
);

-- 16. PR56-H22: profiles_update_self congela created_at contra reescritura
select throws_ok(
  format('update public.profiles set created_at = ''2020-01-01T00:00:00Z'' where id = ''%s''', pg_temp.courier_approved_1_id()),
  '42501',
  null,
  'PR56-H22: profiles_update_self forbids altering created_at timestamp'
);

-- 17. Modificación legítima de display_name y phone en profiles respetando created_at
select lives_ok(
  format(
    'update public.profiles set display_name = ''Repartidor Uno Actualizado'', phone = ''3815559999'' where id = ''%s''',
    pg_temp.courier_approved_1_id()
  ),
  'profiles_update_self allows legitimate display_name and phone update'
);

select * from finish();
rollback;
