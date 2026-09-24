begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(59);

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

select * from finish();
rollback;
