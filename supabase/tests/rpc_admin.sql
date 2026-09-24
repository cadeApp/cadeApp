begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(25);

-- Helper functions for acting as users with specific roles and AAL levels
create or replace function pg_temp.act_as(p_role text, p_uid uuid default null, p_aal text default 'aal2')
returns void
language plpgsql
as $$
begin
  if p_role = 'anon' then
    set local role anon;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{}', true);
  else
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_uid::text, 'role', p_role, 'aal', p_aal)::text,
      true
    );
  end if;
end;
$$;

create or replace function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Test IDs
create or replace function pg_temp.admin_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-000000000001'::uuid
$$;
create or replace function pg_temp.merchant_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-000000000002'::uuid
$$;
create or replace function pg_temp.courier_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-000000000003'::uuid
$$;
create or replace function pg_temp.doc_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-000000000004'::uuid
$$;

-- Seed data for testing
insert into auth.users (id, email)
values
  (pg_temp.admin_id(), 'admin@test.com'),
  (pg_temp.merchant_id(), 'merchant@test.com'),
  (pg_temp.courier_id(), 'courier@test.com');

insert into public.profiles (id, role, full_name, phone)
values
  (pg_temp.admin_id(), 'admin', 'Admin User', '+543865000001'),
  (pg_temp.merchant_id(), 'merchant', 'Merchant User', '+543865000002'),
  (pg_temp.courier_id(), 'courier', 'Courier User', '+543865000003');

insert into public.merchants (id, merchant_name, phone, address_text, latitude, longitude, subscription_status)
values
  (pg_temp.merchant_id(), 'Test Merchant', '+543865000002', 'Alberdi 100', -27.4300, -65.6100, 'active');

insert into public.couriers (id, vehicle_type, license_status, insurance_status, is_available)
values
  (pg_temp.courier_id(), 'motorcycle', 'pending', 'pending', false);

insert into public.courier_documents (id, courier_id, kind, file_path, status)
values
  (pg_temp.doc_id(), pg_temp.courier_id(), 'driver_license', 'courier-docs/doc1.pdf', 'submitted');

-- 1. admin_decide_courier
-- 1.1 UNAUTHENTICATED
perform pg_temp.act_as('anon');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_id(), 'approved', null) $$,
  'UNAUTHENTICATED'
);

-- 1.2 UNAUTHORIZED_ACTOR (merchant attempting admin RPC)
perform pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_id(), 'approved', null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 1.3 AAL2_REQUIRED (admin with aal1)
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_id(), 'approved', null) $$,
  'AAL2_REQUIRED'
);

-- 1.4 REASON_REQUIRED (rejected without reason)
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_id(), 'rejected', null) $$,
  'REASON_REQUIRED'
);

-- 1.5 NOT_FOUND
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier('00000000-0000-0000-0000-999999999999'::uuid, 'approved', null) $$,
  'NOT_FOUND'
);

-- 1.6 Happy path approve
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_id(), 'approved', null) $$
);

-- 2. admin_suspend_courier
-- 2.1 UNAUTHORIZED_ACTOR
perform pg_temp.act_as('authenticated', pg_temp.courier_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_id(), 'Rule violation') $$,
  'UNAUTHORIZED_ACTOR'
);

-- 2.2 REASON_REQUIRED
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_id(), '') $$,
  'REASON_REQUIRED'
);

-- 2.3 Happy path suspend and withdraw pending offers
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_id(), 'Violated policy') $$
);

-- 3. admin_verify_document
-- 3.1 UNAUTHORIZED_ACTOR
perform pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_id(), 'verified', null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 3.2 REASON_REQUIRED when rejected
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_id(), 'rejected', null) $$,
  'REASON_REQUIRED'
);

-- 3.3 Happy path verify document
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_verify_document(pg_temp.doc_id(), 'verified', null) $$
);

-- 4. admin_set_subscription
-- 4.1 UNAUTHORIZED_ACTOR
perform pg_temp.act_as('authenticated', pg_temp.courier_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'suspended', null, null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 4.2 NOT_FOUND
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription('00000000-0000-0000-0000-999999999999'::uuid, 'active', null, null) $$,
  'NOT_FOUND'
);

-- 4.3 Happy path set subscription
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'past_due', '2026-10-01'::date, 'Payment issue') $$
);

-- 5. admin_update_setting
-- 5.1 UNAUTHORIZED_ACTOR
perform pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 5.2 INVALID_SETTING_KEY
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('invalid_key', '123'::jsonb) $$,
  'INVALID_SETTING_KEY'
);

-- 5.3 Happy path update setting
perform pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$
);

select * from finish();
rollback;
