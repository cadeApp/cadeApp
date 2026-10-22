begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(110);

-- IDs fijos válidos (hexadecimal estricto) para pruebas de T-105
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
create or replace function pg_temp.doc_purged_submitted_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000d4'::uuid
$$;
create or replace function pg_temp.req_1_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000e1'::uuid
$$;
create or replace function pg_temp.req_2_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000e2'::uuid
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
  elsif p_uid is null then
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', p_role, 'aal', p_aal)::text,
      true
    );
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
  insert into public.courier_documents (id, courier_id, kind, storage_path, status, purge_after, purged_at)
  values
    (pg_temp.doc_license_id(), pg_temp.courier_pending_1_id(), 'license', 'courier-docs/license.pdf', 'submitted', null, null),
    (pg_temp.doc_insurance_id(), pg_temp.courier_pending_1_id(), 'insurance', 'courier-docs/insurance.pdf', 'submitted', null, null),
    (pg_temp.doc_already_verified_id(), pg_temp.courier_approved_id(), 'license', 'courier-docs/old_license.pdf', 'verified', null, null),
    (pg_temp.doc_purged_submitted_id(), pg_temp.courier_pending_2_id(), 'license', 'courier-docs/purged.pdf', 'submitted', now() - interval '1 day', now());

  -- Solicitudes de prueba en solicitudes separadas para no violar offers_one_active_per_courier_request_idx
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status)
  values
    (pg_temp.req_1_id(), pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published'),
    (pg_temp.req_2_id(), pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published');

  -- Ofertas de prueba para courier_approved_id (1 pending en req_1, 1 accepted en req_2)
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values
    (pg_temp.offer_pending_id(), pg_temp.req_1_id(), pg_temp.courier_approved_id(), 1500, 20, 'pending'),
    (pg_temp.offer_accepted_id(), pg_temp.req_2_id(), pg_temp.courier_approved_id(), 1600, 25, 'accepted');
end;
$$;

-- 1. admin_decide_courier
-- 1.1 REVOKE/GRANT: anon sin permiso de ejecución -> 42501
select pg_temp.act_as('anon');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$,
  '42501'
);

-- 1.2 UNAUTHENTICATED (authenticated sin sub)
select pg_temp.act_as('authenticated', null, 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$,
  'UNAUTHENTICATED'
);

-- 1.3 UNAUTHORIZED_ACTOR (merchant no autorizado)
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 1.4 AAL2_REQUIRED (admin con aal1)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$,
  'AAL2_REQUIRED'
);

-- 1.5 REASON_REQUIRED (rechazo sin motivo)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'rejected', null) $$,
  'REASON_REQUIRED'
);

-- 1.6 NOT_FOUND
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier('00000000-0000-4000-8000-999999999999'::uuid, 'approved', null) $$,
  'NOT_FOUND'
);

-- 1.7 INVALID_STATE_TRANSITION (D03: intentar decidir sobre repartidor que está suspended)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_suspended_id(), 'approved', null) $$,
  'INVALID_STATE_TRANSITION'
);

-- 1.8 INVALID_STATE_TRANSITION (D03 mutación catch: intentar decidir sobre repartidor que está approved)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_approved_id(), 'rejected', 'Razón') $$,
  'INVALID_STATE_TRANSITION'
);

-- 1.9 Camino feliz Aprobación
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_1_id(), 'approved', null) $$
);

-- 1.10 Verificación DB status 'approved'
select results_eq(
  $$ select status::text from public.couriers where profile_id = pg_temp.courier_pending_1_id() $$,
  $$ values ('approved') $$
);

-- 1.11 Verificación audit_log action
select results_eq(
  $$ select action from public.audit_log where target_id = pg_temp.courier_pending_1_id()::text order by created_at desc limit 1 $$,
  $$ values ('admin_decide_courier') $$
);

-- 1.12 Camino feliz Rechazo
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_decide_courier(pg_temp.courier_pending_2_id(), 'rejected', 'Documentos ilegibles') $$
);

-- 1.13 Verificación DB status 'rejected'
select results_eq(
  $$ select status::text from public.couriers where profile_id = pg_temp.courier_pending_2_id() $$,
  $$ values ('rejected') $$
);

-- 1.14 Verificación audit_log reason guardado en after (mutación catch reason)
select results_eq(
  $$ select after->>'reason' from public.audit_log where target_id = pg_temp.courier_pending_2_id()::text order by created_at desc limit 1 $$,
  $$ values ('Documentos ilegibles') $$
);

-- 2. admin_suspend_courier
-- 2.1 anon -> 42501
select pg_temp.act_as('anon');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_approved_id(), 'Sanción') $$,
  '42501'
);

-- 2.2 UNAUTHENTICATED
select pg_temp.act_as('authenticated', null, 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_approved_id(), 'Sanción') $$,
  'UNAUTHENTICATED'
);

-- 2.3 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_approved_id(), 'Sanción') $$,
  'UNAUTHORIZED_ACTOR'
);

-- 2.4 AAL2_REQUIRED (mutación catch aal1 en suspend)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_approved_id(), 'Sanción') $$,
  'AAL2_REQUIRED'
);

-- 2.5 REASON_REQUIRED
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_approved_id(), '') $$,
  'REASON_REQUIRED'
);

-- 2.6 INVALID_STATE_TRANSITION (repartidor ya suspendido)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_suspended_id(), 'Otra sanción') $$,
  'INVALID_STATE_TRANSITION'
);

-- 2.7 Camino feliz Suspensión + retiro exclusivo de ofertas pending
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select results_eq(
  $$ select (public.admin_suspend_courier(pg_temp.courier_approved_id(), 'Incumplimiento grave')->>'withdrawnOffersCount')::integer $$,
  $$ values (1) $$
);

-- 2.8 DB status = suspended
select results_eq(
  $$ select status::text from public.couriers where profile_id = pg_temp.courier_approved_id() $$,
  $$ values ('suspended') $$
);

-- 2.9 DB offer_pending_id = withdrawn
select results_eq(
  $$ select status::text from public.offers where id = pg_temp.offer_pending_id() $$,
  $$ values ('withdrawn') $$
);

-- 2.10 DB offer_accepted_id = accepted (intacta)
select results_eq(
  $$ select status::text from public.offers where id = pg_temp.offer_accepted_id() $$,
  $$ values ('accepted') $$
);

-- 2.11 audit_log registrado para suspend (mutación catch audit)
select results_eq(
  $$ select action from public.audit_log where target_id = pg_temp.courier_approved_id()::text order by created_at desc limit 1 $$,
  $$ values ('admin_suspend_courier') $$
);

-- 2.12 audit_log reason para suspend
select results_eq(
  $$ select after->>'reason' from public.audit_log where target_id = pg_temp.courier_approved_id()::text order by created_at desc limit 1 $$,
  $$ values ('Incumplimiento grave') $$
);

-- 3. admin_verify_document
-- 3.1 anon -> 42501
select pg_temp.act_as('anon');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_license_id(), 'verified', null) $$,
  '42501'
);

-- 3.2 UNAUTHENTICATED
select pg_temp.act_as('authenticated', null, 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_license_id(), 'verified', null) $$,
  'UNAUTHENTICATED'
);

-- 3.3 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_license_id(), 'verified', null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 3.4 AAL2_REQUIRED (mutación catch aal1 en verify)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_license_id(), 'verified', null) $$,
  'AAL2_REQUIRED'
);

-- 3.5 REASON_REQUIRED al rechazar
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_license_id(), 'rejected', null) $$,
  'REASON_REQUIRED'
);

-- 3.6 INVALID_STATE_TRANSITION (documento no en submitted)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_already_verified_id(), 'verified', null) $$,
  'INVALID_STATE_TRANSITION'
);

-- 3.7 INVALID_STATE_TRANSITION (D04 mutación catch: documento en submitted pero purgado)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_verify_document(pg_temp.doc_purged_submitted_id(), 'verified', null) $$,
  'INVALID_STATE_TRANSITION'
);

-- 3.8 Camino feliz Verificación de Licencia (docLevel = 1)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select results_eq(
  $$ select (public.admin_verify_document(pg_temp.doc_license_id(), 'verified', null)->>'docLevel')::integer $$,
  $$ values (1) $$
);

-- 3.9 DB license_status = verified
select results_eq(
  $$ select license_status::text from public.couriers where profile_id = pg_temp.courier_pending_1_id() $$,
  $$ values ('verified') $$
);

-- 3.10 Camino feliz Verificación de Seguro (eleva docLevel a 2)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select results_eq(
  $$ select (public.admin_verify_document(pg_temp.doc_insurance_id(), 'verified', null)->>'docLevel')::integer $$,
  $$ values (2) $$
);

-- 3.11 audit_log registrado para verify (mutación catch audit)
select results_eq(
  $$ select action from public.audit_log where target_id = pg_temp.doc_insurance_id()::text order by created_at desc limit 1 $$,
  $$ values ('admin_verify_document') $$
);

-- 4. admin_set_subscription
-- 4.1 anon -> 42501
select pg_temp.act_as('anon');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'active', null, null) $$,
  '42501'
);

-- 4.2 UNAUTHENTICATED
select pg_temp.act_as('authenticated', null, 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'active', null, null) $$,
  'UNAUTHENTICATED'
);

-- 4.3 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.courier_approved_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'active', null, null) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 4.4 AAL2_REQUIRED (mutación catch aal1 en set_subscription)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'active', null, null) $$,
  'AAL2_REQUIRED'
);

-- 4.5 VALIDATION_ERROR (estado inválido)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'invalid_status', null, null) $$,
  'VALIDATION_ERROR'
);

-- 4.6 NOT_FOUND
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_set_subscription('00000000-0000-4000-8000-999999999999'::uuid, 'active', null, null) $$,
  'NOT_FOUND'
);

-- 4.7 Camino feliz set subscription
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'active', '2026-12-31'::date, 'Pago al día') $$
);

-- 4.8 DB merchant subscription_status = active
select results_eq(
  $$ select subscription_status::text from public.merchants where profile_id = pg_temp.merchant_id() $$,
  $$ values ('active') $$
);

-- 4.9 DB merchant paid_until
select results_eq(
  $$ select paid_until::text from public.merchants where profile_id = pg_temp.merchant_id() $$,
  $$ values ('2026-12-31') $$
);

-- 4.10 audit_log registrado para set_subscription (mutación catch audit)
select results_eq(
  $$ select action from public.audit_log where target_id = pg_temp.merchant_id()::text order by created_at desc limit 1 $$,
  $$ values ('admin_set_subscription') $$
);

-- 4.11 H12: sin paid_until se borra la vigencia y notes se conserva (semántica escrita en la RPC)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_set_subscription(pg_temp.merchant_id(), 'expired', null, null) $$
);
select results_eq(
  $$ select paid_until is null, notes from public.merchants where profile_id = pg_temp.merchant_id() $$,
  $$ values (true, 'Pago al día'::text) $$
);

-- 5. admin_update_setting
-- 5.1 anon -> 42501
select pg_temp.act_as('anon');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$,
  '42501'
);

-- 5.2 UNAUTHENTICATED
select pg_temp.act_as('authenticated', null, 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$,
  'UNAUTHENTICATED'
);

-- 5.3 UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$,
  'UNAUTHORIZED_ACTOR'
);

-- 5.4 AAL2_REQUIRED (mutación catch aal1 en update_setting)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$,
  'AAL2_REQUIRED'
);

-- 5.5 INVALID_SETTING_KEY
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('key_inexistente', '100'::jsonb) $$,
  'INVALID_SETTING_KEY'
);

-- 5.6 INVALID_SETTING_VALUE (número negativo)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('min_offer_ars', '-50'::jsonb) $$,
  'INVALID_SETTING_VALUE'
);

-- 5.7 INVALID_SETTING_VALUE (string de sólo espacios)
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_update_setting('pilot_terms_version', '"   "'::jsonb) $$,
  'INVALID_SETTING_VALUE'
);

-- 5.8 Camino feliz update setting
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select lives_ok(
  $$ select public.admin_update_setting('min_offer_ars', '1500'::jsonb) $$
);

-- 5.9 DB setting value = 1500
select results_eq(
  $$ select (value)::integer from public.platform_settings where key = 'min_offer_ars' $$,
  $$ values (1500) $$
);

-- 5.10 audit_log registrado para update_setting (mutación catch audit)
select results_eq(
  $$ select action from public.audit_log where target_id = 'min_offer_ars' order by created_at desc limit 1 $$,
  $$ values ('admin_update_setting') $$
);

-- 6. CC-012: admin_resolve_incident y admin_list_incidents
set local role postgres;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

create or replace function pg_temp.courier_a_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000c5'::uuid
$$;
create or replace function pg_temp.courier_b_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-0000000000c6'::uuid
$$;
create or replace function pg_temp.inc(p_suffix text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-000000000' || p_suffix)::uuid
$$;

do $$
declare
  v_zone_id uuid;
begin
  select id into v_zone_id from public.zones where active limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.courier_a_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc012-a@example.test', 'pwd', '{"role":"courier"}'),
    (pg_temp.courier_b_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc012-b@example.test', 'pwd', '{"role":"courier"}');
  update public.couriers set status = 'approved', available = true, deactivated_at = null
  where profile_id in (pg_temp.courier_a_id(), pg_temp.courier_b_id());

  -- e3: viaje matched con la oferta accepted de A y una oferta no aceptada de B (control M3).
  -- e4/e5: publicadas con ofertas pending de A (a retirar); B tiene una pending en e4 que no se toca.
  -- e6: publicada sin oferta accepted.
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status)
  values
    ('00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'matched'),
    ('00000000-0000-4000-8000-0000000000e4', pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published'),
    ('00000000-0000-4000-8000-0000000000e5', pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published'),
    ('00000000-0000-4000-8000-0000000000e6', pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published');
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values
    ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000e3', pg_temp.courier_a_id(), 1500, 15, 'accepted'),
    ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000e3', pg_temp.courier_b_id(), 1400, 20, 'rejected'),
    ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000e4', pg_temp.courier_a_id(), 1500, 15, 'pending'),
    ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-0000000000e5', pg_temp.courier_a_id(), 1500, 15, 'pending'),
    ('00000000-0000-4000-8000-0000000000f7', '00000000-0000-4000-8000-0000000000e4', pg_temp.courier_b_id(), 1600, 25, 'pending');
  update public.delivery_requests set accepted_offer_id = '00000000-0000-4000-8000-0000000000f3'
  where id = '00000000-0000-4000-8000-0000000000e3';

  insert into public.incidents (id, request_id, reporter_id, kind, description, status, resolution)
  values
    (pg_temp.inc('a01'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'other', 'Demora en el retiro', 'open', null),
    (pg_temp.inc('a02'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'no_show', 'No apareció a tiempo', 'open', null),
    (pg_temp.inc('a03'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'safety', 'Maltrato al comercio', 'open', null),
    (pg_temp.inc('a04'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'other', 'Ya resuelto', 'resolved', 'warning: listo'),
    (pg_temp.inc('a05'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'other', 'Ya desestimado', 'dismissed', 'no_action: listo'),
    (pg_temp.inc('a06'), '00000000-0000-4000-8000-0000000000e6', pg_temp.merchant_id(), 'other', 'Sin repartidor asignado', 'open', null),
    (pg_temp.inc('a07'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'safety', 'Segundo reclamo', 'open', null);

  -- Keyset: dos incidentes con EXACTAMENTE el mismo created_at y uno anterior (estado aislado 'reviewing').
  insert into public.incidents (id, request_id, reporter_id, kind, description, status, created_at)
  values
    (pg_temp.inc('b00'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'other', 'Anterior', 'reviewing', '2026-09-27 11:00:00+00'),
    (pg_temp.inc('b01'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'other', 'Empate bajo', 'reviewing', '2026-09-27 12:00:00.123456+00'),
    (pg_temp.inc('b02'), '00000000-0000-4000-8000-0000000000e3', pg_temp.merchant_id(), 'other', 'Empate alto', 'reviewing', '2026-09-27 12:00:00.123456+00');
end;
$$;

-- 6.1 Firmas, SECURITY DEFINER, search_path y grants mínimos
select has_function('public', 'admin_resolve_incident', array['uuid', 'text', 'text']);
select ok(coalesce((select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  and not has_function_privilege('anon', p.oid, 'EXECUTE')
  from pg_proc p where p.oid = to_regprocedure('public.admin_resolve_incident(uuid,text,text)')), false),
  'CC-012: admin_resolve_incident es SECURITY DEFINER con grants mínimos');
select has_function('public', 'admin_list_incidents', array['text[]', 'timestamp with time zone', 'uuid', 'integer']);
select ok(coalesce((select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  and not has_function_privilege('anon', p.oid, 'EXECUTE')
  from pg_proc p where p.oid = to_regprocedure('public.admin_list_incidents(text[],timestamptz,uuid,integer)')), false),
  'CC-012: admin_list_incidents es SECURITY DEFINER con grants mínimos');
select ok(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'incidents_status_created_cursor_idx')
    like '%(status, created_at DESC, id DESC)',
  'CC-012: índice de la bandeja (status, created_at DESC, id DESC)'
);

-- 6.2 Precedencia de admin_resolve_incident
select pg_temp.act_as('anon');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', 'Motivo') $$, '42501');
select pg_temp.act_as('authenticated', null, 'aal2');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', 'Motivo') $$, 'UNAUTHENTICATED');
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', 'Motivo') $$, 'UNAUTHORIZED_ACTOR');
select pg_temp.act_as('authenticated', pg_temp.courier_a_id(), 'aal2');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', 'Motivo') $$, 'UNAUTHORIZED_ACTOR');
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', 'Motivo') $$, 'AAL2_REQUIRED');
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok($$ select public.admin_resolve_incident(null, 'no_action', 'Motivo') $$, 'VALIDATION_ERROR');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'ban_forever', 'Motivo') $$, 'VALIDATION_ERROR');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', '   ') $$, 'REASON_REQUIRED');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', repeat('x', 501)) $$, 'VALIDATION_ERROR');
select throws_ok($$ select public.admin_resolve_incident('00000000-0000-4000-8000-999999999999'::uuid, 'no_action', 'Motivo') $$, 'NOT_FOUND');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a04'), 'warning', 'Motivo') $$, 'INVALID_STATE_TRANSITION');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a05'), 'warning', 'Motivo') $$, 'INVALID_STATE_TRANSITION');
select throws_ok($$ select public.admin_resolve_incident(pg_temp.inc('a06'), 'preventive_suspension', 'Motivo') $$, 'INVALID_STATE_TRANSITION');

-- 6.3 no_action -> dismissed; warning -> resolved
select results_eq(
  $$ select r->>'status', r->>'decision', r->>'courierId', (r->>'withdrawnOffersCount')::integer
     from (select public.admin_resolve_incident(pg_temp.inc('a01'), 'no_action', 'Se habló con las partes') as r) x $$,
  $$ values ('dismissed'::text, 'no_action'::text, null::text, 0) $$,
  'CC-012: no_action resuelve como dismissed sin repartidor'
);
select results_eq(
  $$ select r->>'status', r->>'decision' from (select public.admin_resolve_incident(pg_temp.inc('a02'), 'warning', 'Primera advertencia') as r) x $$,
  $$ values ('resolved'::text, 'warning'::text) $$,
  'CC-012: warning resuelve como resolved'
);
set local role postgres;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select status, resolution from public.incidents where id = pg_temp.inc('a01') $$,
  $$ values ('dismissed'::text, 'no_action: Se habló con las partes'::text) $$,
  'CC-012: no_action persiste estado y resolución'
);
select results_eq(
  $$ select status, resolution from public.incidents where id = pg_temp.inc('a02') $$,
  $$ values ('resolved'::text, 'warning: Primera advertencia'::text) $$,
  'CC-012: warning persiste estado y resolución'
);
select results_eq(
  $$ select actor_id, target_type, after->>'decision' from public.audit_log
     where action = 'admin_resolve_incident' and target_id = pg_temp.inc('a01')::text $$,
  $$ values (pg_temp.admin_id(), 'incident'::text, 'no_action'::text) $$,
  'CC-012: la resolución queda auditada con actor, target y decisión'
);

-- 6.4 Atomicidad: si la auditoría falla, no queda suspensión, ni ofertas retiradas, ni incidente resuelto.
create function public.cc012_test_fail_resolve_audit() returns trigger language plpgsql as $fn$
begin
  if new.action = 'admin_resolve_incident' then
    raise exception using errcode = 'P0001', message = 'CC012_FORCED_AUDIT_FAILURE';
  end if;
  return new;
end;
$fn$;
create trigger cc012_test_fail_resolve_audit before insert on public.audit_log
  for each row execute function public.cc012_test_fail_resolve_audit();
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_resolve_incident(pg_temp.inc('a03'), 'preventive_suspension', 'Reclamo grave') $$,
  'CC012_FORCED_AUDIT_FAILURE'
);
set local role postgres;
select set_config('request.jwt.claims', '', true);
drop trigger cc012_test_fail_resolve_audit on public.audit_log;
drop function public.cc012_test_fail_resolve_audit();
select results_eq(
  $$ select status::text, available from public.couriers where profile_id = pg_temp.courier_a_id() $$,
  $$ values ('approved'::text, true) $$,
  'CC-012 atomicidad: el repartidor sigue approved y disponible'
);
select results_eq(
  $$ select count(*)::integer from public.offers where courier_id = pg_temp.courier_a_id() and status = 'pending' $$,
  $$ values (2) $$,
  'CC-012 atomicidad: las ofertas pending no se retiraron'
);
select results_eq(
  $$ select status from public.incidents where id = pg_temp.inc('a03') $$,
  $$ values ('open'::text) $$,
  'CC-012 atomicidad: el incidente sigue abierto'
);
select results_eq(
  $$ select count(*)::integer from public.audit_log where target_id = pg_temp.inc('a03')::text $$,
  $$ values (0) $$,
  'CC-012 atomicidad: no quedó auditoría parcial'
);

-- 6.5 preventive_suspension: deriva el repartidor de la oferta accepted y aplica los efectos completos.
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select results_eq(
  $$ select r->>'status', r->>'decision', r->>'courierId', (r->>'withdrawnOffersCount')::integer
     from (select public.admin_resolve_incident(pg_temp.inc('a03'), 'preventive_suspension', 'Reclamo grave') as r) x $$,
  $$ values ('resolved'::text, 'preventive_suspension'::text, pg_temp.courier_a_id()::text, 2) $$,
  'CC-012: preventive_suspension devuelve el repartidor derivado y la cuenta exacta de ofertas retiradas'
);
set local role postgres;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select status::text, available, deactivated_at is not null from public.couriers where profile_id = pg_temp.courier_a_id() $$,
  $$ values ('suspended'::text, false, true) $$,
  'CC-012 M4: el repartidor queda suspended, no disponible y con deactivated_at'
);
select results_eq(
  $$ select id::text, status::text from public.offers where courier_id = pg_temp.courier_a_id() order by id $$,
  $$ values ('00000000-0000-4000-8000-0000000000f3'::text, 'accepted'::text),
            ('00000000-0000-4000-8000-0000000000f5'::text, 'withdrawn'::text),
            ('00000000-0000-4000-8000-0000000000f6'::text, 'withdrawn'::text) $$,
  'CC-012 M4: sus ofertas pending quedan withdrawn y la accepted no se toca'
);
select results_eq(
  $$ select status::text, available from public.couriers where profile_id = pg_temp.courier_b_id() $$,
  $$ values ('approved'::text, true) $$,
  'CC-012 M3: el repartidor de una oferta no aceptada no se suspende'
);
select results_eq(
  $$ select id::text, status::text from public.offers where courier_id = pg_temp.courier_b_id() order by id $$,
  $$ values ('00000000-0000-4000-8000-0000000000f4'::text, 'rejected'::text),
            ('00000000-0000-4000-8000-0000000000f7'::text, 'pending'::text) $$,
  'CC-012 M3: las ofertas del otro repartidor no cambian'
);
select results_eq(
  $$ select status, resolution from public.incidents where id = pg_temp.inc('a03') $$,
  $$ values ('resolved'::text, 'preventive_suspension: Reclamo grave'::text) $$,
  'CC-012: el incidente queda resolved con la decisión y el motivo'
);
select results_eq(
  $$ select after->>'courierId', (after->>'courierSuspended')::boolean, (after->>'withdrawnOffersCount')::integer,
       before->>'status', after->>'status'
     from public.audit_log where action = 'admin_resolve_incident' and target_id = pg_temp.inc('a03')::text $$,
  $$ values (pg_temp.courier_a_id()::text, true, 2, 'open'::text, 'resolved'::text) $$,
  'CC-012: la auditoría prueba la suspensión y la cantidad de ofertas retiradas'
);
select ok(
  not exists (
    select 1 from public.audit_log
    where action = 'admin_resolve_incident'
      and (after ?| array['recipientName', 'recipientPhone', 'dropoffAddress', 'pickupAddress'])
  ),
  'CC-012: la auditoría no guarda datos del destinatario'
);
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok(
  $$ select public.admin_resolve_incident(pg_temp.inc('a07'), 'preventive_suspension', 'Segundo reclamo') $$,
  'INVALID_STATE_TRANSITION'
);

-- 6.6 admin_list_incidents: precedencia y validación
select pg_temp.act_as('anon');
select throws_ok($$ select public.admin_list_incidents(array['open']) $$, '42501');
select pg_temp.act_as('authenticated', pg_temp.merchant_id(), 'aal2');
select throws_ok($$ select public.admin_list_incidents(array['open']) $$, 'UNAUTHORIZED_ACTOR');
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal1');
select throws_ok($$ select public.admin_list_incidents(array['open']) $$, 'AAL2_REQUIRED');
select pg_temp.act_as('authenticated', pg_temp.admin_id(), 'aal2');
select throws_ok($$ select public.admin_list_incidents(array['closed']) $$, 'VALIDATION_ERROR');
select throws_ok($$ select public.admin_list_incidents(array['open'], now(), null) $$, 'VALIDATION_ERROR');
select throws_ok($$ select public.admin_list_incidents(array['open'], null, null, 51) $$, 'VALIDATION_ERROR');

-- 6.7 Keyset estable con empate exacto de created_at: no se pierde ni se duplica ninguno y el orden es determinista.
select results_eq(
  $$ select x->>'id' from jsonb_array_elements(public.admin_list_incidents(array['reviewing'], null, null, 3)->'items') with ordinality t(x, n) order by n $$,
  $$ values ('00000000-0000-4000-8000-000000000b02'::text), ('00000000-0000-4000-8000-000000000b01'::text), ('00000000-0000-4000-8000-000000000b00'::text) $$,
  'CC-012 M5: orden created_at DESC, id DESC'
);
select results_eq(
  $$ select x->>'id' from jsonb_array_elements(public.admin_list_incidents(array['reviewing'], null, null, 1)->'items') x $$,
  $$ values ('00000000-0000-4000-8000-000000000b02'::text) $$,
  'CC-012 M5: página 1'
);
select is(
  public.admin_list_incidents(array['reviewing'], null, null, 1)->'nextCursor'->>'createdAt',
  '2026-09-27T12:00:00.123456Z',
  'CC-012 M5: el cursor conserva microsegundos'
);
select results_eq(
  $$ with p1 as (select public.admin_list_incidents(array['reviewing'], null, null, 1) as r)
     select x->>'id' from p1, jsonb_array_elements(public.admin_list_incidents(array['reviewing'],
       (p1.r->'nextCursor'->>'createdAt')::timestamptz, (p1.r->'nextCursor'->>'id')::uuid, 1)->'items') x $$,
  $$ values ('00000000-0000-4000-8000-000000000b01'::text) $$,
  'CC-012 M5: página 2 trae el otro incidente del empate'
);
select results_eq(
  $$ with p1 as (select public.admin_list_incidents(array['reviewing'], null, null, 1) as r),
          p2 as (select public.admin_list_incidents(array['reviewing'],
            (p1.r->'nextCursor'->>'createdAt')::timestamptz, (p1.r->'nextCursor'->>'id')::uuid, 1) as r from p1)
     select x->>'id' from p2, jsonb_array_elements(public.admin_list_incidents(array['reviewing'],
       (p2.r->'nextCursor'->>'createdAt')::timestamptz, (p2.r->'nextCursor'->>'id')::uuid, 1)->'items') x $$,
  $$ values ('00000000-0000-4000-8000-000000000b00'::text) $$,
  'CC-012 M5: página 3 trae el anterior'
);
select ok(
  (with p1 as (select public.admin_list_incidents(array['reviewing'], null, null, 1) as r),
        p2 as (select public.admin_list_incidents(array['reviewing'],
          (p1.r->'nextCursor'->>'createdAt')::timestamptz, (p1.r->'nextCursor'->>'id')::uuid, 1) as r from p1),
        p3 as (select public.admin_list_incidents(array['reviewing'],
          (p2.r->'nextCursor'->>'createdAt')::timestamptz, (p2.r->'nextCursor'->>'id')::uuid, 1) as r from p2)
   select p3.r->'nextCursor' = 'null'::jsonb from p3),
  'CC-012 M5: la última página no tiene nextCursor'
);
select results_eq(
  $$ select count(distinct x->>'id')::integer from (
       select public.admin_list_incidents(array['reviewing'], null, null, 2) as r) p1,
       lateral (
         select x from jsonb_array_elements(p1.r->'items') x
         union all
         select x from jsonb_array_elements(public.admin_list_incidents(array['reviewing'],
           (p1.r->'nextCursor'->>'createdAt')::timestamptz, (p1.r->'nextCursor'->>'id')::uuid, 2)->'items') x
       ) pages $$,
  $$ values (3) $$,
  'CC-012 M5: con páginas de 2 se ven los tres, sin duplicados'
);
select results_eq(
  $$ select x->>'reporterRole', x->>'kind', x->>'status'
     from jsonb_array_elements(public.admin_list_incidents(array['reviewing'], null, null, 1)->'items') x $$,
  $$ values ('merchant'::text, 'other'::text, 'reviewing'::text) $$,
  'CC-012: cada item trae rol del reportero, tipo y estado'
);

select * from finish();
rollback;
