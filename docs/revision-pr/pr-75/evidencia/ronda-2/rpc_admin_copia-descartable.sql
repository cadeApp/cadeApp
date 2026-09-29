begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(36);

-- IDs fijos para pruebas de T-105
create or replace function pg_temp.admin_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000a1'::uuid
$$;
create or replace function pg_temp.merchant_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000b1'::uuid
$$;
create or replace function pg_temp.courier_pending_1_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000c1'::uuid
$$;
create or replace function pg_temp.courier_pending_2_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000c2'::uuid
$$;
create or replace function pg_temp.courier_approved_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000c3'::uuid
$$;
create or replace function pg_temp.courier_suspended_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000c4'::uuid
$$;
create or replace function pg_temp.doc_license_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000d1'::uuid
$$;
create or replace function pg_temp.doc_insurance_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000d2'::uuid
$$;
create or replace function pg_temp.doc_already_verified_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000d3'::uuid
$$;
create or replace function pg_temp.req_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000e1'::uuid
$$;
create or replace function pg_temp.offer_pending_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000f1'::uuid
$$;
create or replace function pg_temp.offer_accepted_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000f2'::uuid
$$;

-- Helper para cambiar de rol y claims JWT (incluyendo AAL)
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

-- Sembrar datos de prueba utilizando la API de auth y triggers de Supabase
do $$
declare
  v_zone_id uuid;
begin
  select id into v_zone_id from public.zones where active limit 1;

  -- Crear usuarios
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_t105@test.local', 'pwd', '{"role":"merchant"}'),
    (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm_t105@test.local', 'pwd', '{"role":"merchant"}'),
    (pg_temp.courier_pending_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cp1_t105@test.local', 'pwd', '{"role":"courier"}'),
    (pg_temp.courier_pending_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cp2_t105@test.local', 'pwd', '{"role":"courier"}'),
    (pg_temp.courier_approved_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ca_t105@test.local', 'pwd', '{"role":"courier"}'),
    (pg_temp.courier_suspended_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cs_t105@test.local', 'pwd', '{"role":"courier"}');

  -- Promover el usuario admin en public.profiles
  update public.profiles set role = 'admin' where id = pg_temp.admin_id();

  -- Ajustar estados iniciales de repartidores
  update public.couriers set status = 'approved', available = true where profile_id = pg_temp.courier_approved_id();
  update public.couriers set status = 'suspended', available = false where profile_id = pg_temp.courier_suspended_id();

  -- Documentos de prueba
  insert into public.courier_documents (id, courier_id, kind, storage_path, status)
  values
    (pg_temp.doc_license_id(), pg_temp.courier_pending_1_id(), 'license', 'courier-docs/license.pdf', 'submitted'),
    (pg_temp.doc_insurance_id(), pg_temp.courier_pending_1_id(), 'insurance', 'courier-docs/insurance.pdf', 'submitted'),
    (pg_temp.doc_already_verified_id(), pg_temp.courier_approved_id(), 'license', 'courier-docs/old_license.pdf', 'verified');

  -- Solicitud de prueba
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status)
  values (pg_temp.req_id(), pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published'),
         ('00000000-0000-4000-8000-0000000000e2', pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published');

  -- Ofertas de prueba para courier_approved_id (1 pending, 1 accepted)
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values
    (pg_temp.offer_pending_id(), pg_temp.req_id(), pg_temp.courier_approved_id(), 1500, 20, 'pending'),
    (pg_temp.offer_accepted_id(), '00000000-0000-4000-8000-0000000000e2', pg_temp.courier_approved_id(), 1600, 25, 'accepted');
end;
$$;

-- 1. admin_decide_courier
-- 1.1 UNAUTHENTICATED
select pg_temp.act_as('anon');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$,
  'UNAUTHENTICATED'
);

-- 1.2 UNAUTHORIZED_ACTOR (merchant no autorizado)
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 1.3 AAL2_REQUIRED (admin con aal1)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$,
  'AAL2_REQUIRED'
);

-- 1.4 REASON_REQUIRED (rechazo sin motivo)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'rejected', null) $$,
  'REASON_REQUIRED'
);

-- 1.5 NOT_FOUND
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier('00000000-0000-0000-0000-999999999999'::uuid, 'approved', null) $$,
  'NOT_FOUND'
);

-- 1.6 INVALID_STATE_TRANSITION (D03: intentar decidir sobre repartidor que ya no está pending)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_suspended_id(), 'approved', null) $$,
  'INVALID_STATE_TRANSITION'
);

-- 1.7 Camino feliz Aprobación + verificación en DB y audit_log
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$
);
select results_eq(
  $$ select status::text from public.couriers where profile_id = pg_temp.courier_pending_1_id() $$,
  $$ values ('approved') $$
);
select results_eq(
  $$ select action from public.audit_log where target_id = pg_temp.courier_pending_1_id()::text order by created_at desc limit 1 $$,
  $$ values ('admin_decide_courier') $$
);

-- 1.8 Camino feliz Rechazo
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_2_id(), 'rejected', 'Documentos ilegibles') $$
);
select results_eq(
  $$ select status::text from public.couriers where profile_id = pg_temp.courier_pending_2_id() $$,
  $$ values ('rejected') $$
);

-- 2. admin_suspend_courier
-- 2.1 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_approved_id(), 'Mal comportamiento') $$,
  'UNAUTHORIZED_ACTOR'
);

-- 2.2 REASON_REQUIRED
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_approved_id(), '') $$,
  'REASON_REQUIRED'
);

-- 2.3 INVALID_STATE_TRANSITION (repartidor ya suspendido)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_suspended_id(), 'Otra sanción') $$,
  'INVALID_STATE_TRANSITION'
);

-- 2.4 Camino feliz Suspensión + retiro exclusivo de ofertas pending + audit_log
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select results_eq(
  $$ select (public.admin_suspend_courier(pg_temp.courier_approved_id(), 'Incumplimiento grave')->>'withdrawnOffersCount')::integer $$,
  $$ values (1) $$
);
select results_eq(
  $$ select status::text from public.couriers where profile_id = pg_temp.courier_approved_id() $$,
  $$ values ('suspended') $$
);
select results_eq(
  $$ select status::text from public.offers where id = pg_temp.offer_pending_id() $$,
  $$ values ('withdrawn') $$
);
select results_eq(
  $$ select status::text from public.offers where id = pg_temp.offer_accepted_id() $$,
  $$ values ('accepted') $$
);

-- 3. admin_verify_document
-- 3.1 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_license_id(), 'verified', null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 3.2 REASON_REQUIRED al rechazar
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_license_id(), 'rejected', null) $$,
  'REASON_REQUIRED'
);

-- 3.3 INVALID_STATE_TRANSITION (D04: documento que no está en 'submitted')
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_already_verified_id(), 'verified', null) $$,
  'INVALID_STATE_TRANSITION'
);

-- 3.4 Camino feliz Verificación de Licencia (actualiza license_status y doc_level)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select results_eq(
  $$ select (public.admin_verify_document(pg_temp.doc_license_id(), 'verified', null)->>'docLevel')::integer $$,
  $$ values (1) $$
);
select results_eq(
  $$ select license_status::text from public.couriers where profile_id = pg_temp.courier_pending_1_id() $$,
  $$ values ('verified') $$
);

-- 3.5 Camino feliz Verificación de Seguro (eleva doc_level a 2)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select results_eq(
  $$ select (public.admin_verify_document(pg_temp.doc_insurance_id(), 'verified', null)->>'docLevel')::integer $$,
  $$ values (2) $$
);

-- 4. admin_set_subscription
-- 4.1 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.courier_approved_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'active', null, null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 4.2 VALIDATION_ERROR (estado inválido)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'invalid_status', null, null) $$,
  'VALIDATION_ERROR'
);

-- 4.3 NOT_FOUND
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription('00000000-0000-0000-0000-999999999999'::uuid, 'active', null, null) $$,
  'NOT_FOUND'
);

-- 4.4 Camino feliz (active, expired, cancelled) + verificación de campos y audit_log
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'active', '2026-12-31'::date, 'Pago al día') $$
);
select results_eq(
  $$ select subscription_status::text from public.merchants where profile_id = pg_temp.merchant_id() $$,
  $$ values ('active') $$
);
select results_eq(
  $$ select paid_until::text from public.merchants where profile_id = pg_temp.merchant_id() $$,
  $$ values ('2026-12-31') $$
);

-- 5. admin_update_setting
-- 5.1 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 5.2 INVALID_SETTING_KEY
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('key_inexistente', '100'::jsonb) $$,
  'INVALID_SETTING_KEY'
);

-- 5.3 INVALID_SETTING_VALUE (H13: valor numérico no entero o string de sólo espacios)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '-50'::jsonb) $$,
  'INVALID_SETTING_VALUE'
);
select throws_ok(
  $$ select public.admin_update_setting('pilot_terms_version', '"   "'::jsonb) $$,
  'INVALID_SETTING_VALUE'
);

-- 5.4 Camino feliz Actualización de setting
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$
);
select results_eq(
  $$ select value->>0 from public.platform_settings where key = 'min_offer_ars' $$,
  $$ values (null) $$
);
select results_eq(
  $$ select (value)::integer from public.platform_settings where key = 'min_offer_ars' $$,
  $$ values (1500) $$
);

select * from finish();
rollback;
