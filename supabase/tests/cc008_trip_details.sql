begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(13);

create function pg_temp.merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008b1'::uuid $$;
create function pg_temp.courier_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008c1'::uuid $$;
create function pg_temp.other_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008d1'::uuid $$;
create function pg_temp.zone_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008a1'::uuid $$;
create function pg_temp.zone_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008a2'::uuid $$;
create function pg_temp.request_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008e1'::uuid $$;
create function pg_temp.pre_match_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008e2'::uuid $$;
create function pg_temp.offer_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000008f1'::uuid $$;

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

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc008.m@test.com', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc008.c@test.com', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.other_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc008.o@test.com', 'pwd', '{"role":"merchant"}'::jsonb);

-- handle_new_user ya creó profiles + merchants/couriers al insertar auth.users.
update public.profiles
set display_name = case
      when id = pg_temp.merchant_id() then 'Comercio Perfil'
      when id = pg_temp.courier_id() then 'Cadete Uno'
      else 'Tercero'
    end,
    phone = case
      when id = pg_temp.merchant_id() then '3865222222'
      when id = pg_temp.courier_id() then '3865111111'
      else '3865333333'
    end,
    consent_status = 'active'
where id in (pg_temp.merchant_id(), pg_temp.courier_id(), pg_temp.other_id());

update public.merchants
set business_name = 'Kiosco Centro',
    subscription_status = 'pilot'
where profile_id = pg_temp.merchant_id();

update public.couriers
set status = 'approved',
    available = true,
    vehicle_type = 'moto',
    vehicle_plate = 'AA123BB'
where profile_id = pg_temp.courier_id();

insert into public.zones (id, name, active)
values
  (pg_temp.zone_a(), 'Centro', true),
  (pg_temp.zone_b(), 'Barrio San Martín', true);

insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
  notes, recipient_payment_method, needs_change, cash_change_amount, matched_at
) values (
  pg_temp.request_id(), pg_temp.merchant_id(), 'published', pg_temp.zone_a(), pg_temp.zone_b(),
  'chico', 'Casa con reja negra', 'cash', true, 5000, now()
);

insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (
  pg_temp.request_id(), 'San Martín 450', 'Belgrano 1220', 'Laura Gómez', '3865123456', true
);

insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status, decided_at)
values (pg_temp.offer_id(), pg_temp.request_id(), pg_temp.courier_id(), 1800, 15, 'accepted', now());

update public.delivery_requests
set status = 'matched', accepted_offer_id = pg_temp.offer_id(), matched_at = now()
where id = pg_temp.request_id();

insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method
) values (
  pg_temp.pre_match_id(), pg_temp.merchant_id(), 'published', pg_temp.zone_a(), pg_temp.zone_b(), 'chico', 'cash'
);

select ok(
  has_function_privilege('authenticated', 'public.get_trip_details(uuid)', 'execute'),
  'authenticated can execute get_trip_details'
);

select ok(
  not has_function_privilege('anon', 'public.get_trip_details(uuid)', 'execute'),
  'anon cannot execute get_trip_details'
);

select pg_temp.act_as(pg_temp.merchant_id());
select is(
  public.get_trip_details(pg_temp.request_id())->>'code',
  'REQ-00000000',
  'merchant owner receives derived request code'
);
select is(
  public.get_trip_details(pg_temp.request_id())->>'courierPhone',
  '3865111111',
  'merchant owner receives assigned courier phone'
);

select pg_temp.act_as(pg_temp.courier_id());
select is(
  public.get_trip_details(pg_temp.request_id())->>'merchantPhone',
  '3865222222',
  'assigned courier receives merchant phone'
);
select is(
  (public.get_trip_details(pg_temp.request_id())->>'amountArs')::integer,
  1800,
  'accepted offer amount is projected'
);
select ok(
  not (public.get_trip_details(pg_temp.request_id()) ? 'avatarUrl'),
  'RPC does not expose a storage URL'
);

select pg_temp.act_as(pg_temp.other_id());
select throws_ok(
  $$ select public.get_trip_details(pg_temp.request_id()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'unrelated actor is rejected'
);

select pg_temp.act_as(pg_temp.merchant_id());
select throws_ok(
  $$ select public.get_trip_details(pg_temp.pre_match_id()) $$,
  'P0001',
  'INVALID_STATE_TRANSITION',
  'pre-match request is rejected'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'pending' where id = pg_temp.merchant_id();
select pg_temp.act_as(pg_temp.merchant_id());
select throws_ok(
  $$ select public.get_trip_details(pg_temp.request_id()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'pending merchant cannot bypass consent gate'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.merchant_id();
select pg_temp.act_as(pg_temp.merchant_id());
select throws_ok(
  $$ select public.get_trip_details(pg_temp.request_id()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'reconsent merchant cannot bypass consent gate'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'active' where id = pg_temp.merchant_id();
update public.profiles set consent_status = 'pending' where id = pg_temp.courier_id();
select pg_temp.act_as(pg_temp.courier_id());
select throws_ok(
  $$ select public.get_trip_details(pg_temp.request_id()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'pending courier cannot bypass consent gate'
);

select pg_temp.reset_actor();
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.courier_id();
select pg_temp.act_as(pg_temp.courier_id());
select throws_ok(
  $$ select public.get_trip_details(pg_temp.request_id()) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'reconsent courier cannot bypass consent gate'
);

select * from finish();
rollback;
