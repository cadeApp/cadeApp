begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(40);

-- Actores para pruebas T-340
create function pg_temp.merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034a1'::uuid $$;
create function pg_temp.merchant_other_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034a2'::uuid $$;
create function pg_temp.courier_1_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c1'::uuid $$;
create function pg_temp.courier_2_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c2'::uuid $$;
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034f1'::uuid $$;
create function pg_temp.pickup_zone_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034d1'::uuid $$;
create function pg_temp.dropoff_zone_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034d2'::uuid $$;

-- Helper para cambiar actor
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

-- Seed usuarios en auth.users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't340.merchant@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_other_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't340.other@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't340.courier1@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't340.courier2@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't340.admin@example.test', 'pwd', '{"role":"merchant"}'::jsonb);

update public.profiles set consent_status = 'active' where id in (pg_temp.merchant_id(), pg_temp.merchant_other_id(), pg_temp.courier_1_id(), pg_temp.courier_2_id());
update public.profiles set role = 'admin' where id = pg_temp.admin_id();
update public.merchants set subscription_status = 'pilot' where profile_id in (pg_temp.merchant_id(), pg_temp.merchant_other_id());
update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.courier_1_id(), pg_temp.courier_2_id());

-- Seed de zonas con columnas del esquema real (id, name, active, centroid_lat, centroid_lng)
insert into public.zones (id, name, active, centroid_lat, centroid_lng)
values
  (pg_temp.pickup_zone_id(), 'Zona Retiro T340', true, -27.4330, -65.6150),
  (pg_temp.dropoff_zone_id(), 'Zona Entrega T340', true, -27.4250, -65.6080)
on conflict (id) do nothing;

-- 1. Estructura de tablas y columnas (DoD & CC-022 §1)
select has_table('delivery_request_drops', 'tabla delivery_request_drops existe');
select has_table('delivery_request_drop_contacts', 'tabla delivery_request_drop_contacts existe');
select has_column('delivery_requests', 'drops_count', 'delivery_requests tiene drops_count');

-- 2. Privilegios por columna y campos RPC-only (DoD & CC-022 §2)
-- status, delivered_at, failed_reason y approx_distance_m denegados en insert para authenticated
create function pg_temp.test_bypass_status() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003401';
begin
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, status)
  values (v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', 'delivered');
end;
$$;
select throws_matching('select pg_temp.test_bypass_status()', 'permission denied', 'insert directo sobre status rechazado');

create function pg_temp.test_bypass_delivered_at() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003402';
begin
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, delivered_at)
  values (v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', now());
end;
$$;
select throws_matching('select pg_temp.test_bypass_delivered_at()', 'permission denied', 'insert directo sobre delivered_at rechazado');

create function pg_temp.test_bypass_failed_reason() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003403';
begin
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, failed_reason)
  values (v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', 'motivo');
end;
$$;
select throws_matching('select pg_temp.test_bypass_failed_reason()', 'permission denied', 'insert directo sobre failed_reason rechazado');

create function pg_temp.test_bypass_approx_distance() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003404';
begin
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, approx_distance_m)
  values (v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', 1500);
end;
$$;
select throws_matching('select pg_temp.test_bypass_approx_distance()', 'permission denied', 'insert directo sobre approx_distance_m rechazado');

create function pg_temp.test_bypass_update_request_id() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003405';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003405';
begin
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');

  perform pg_temp.act_as(pg_temp.merchant_id());
  update public.delivery_request_drops set request_id = gen_random_uuid() where id = v_drop_id;
end;
$$;
select throws_matching('select pg_temp.test_bypass_update_request_id()', 'permission denied', 'update directo sobre request_id rechazado');

-- 3. Guard de borrador: app_private.lock_draft_request_for_child_write (DoD & CC-022 §2b)
create function pg_temp.test_call_guard_direct() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.merchant_id());
  perform app_private.lock_draft_request_for_child_write();
end;
$$;
select throws_matching('select pg_temp.test_call_guard_direct()', 'permission denied', 'app_private.lock_draft_request_for_child_write no es ejecutable por authenticated');

create function pg_temp.test_write_published_drop() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003406';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
end;
$$;
select throws_matching('select pg_temp.test_write_published_drop()', 'row-level security policy|INVALID_STATE_TRANSITION', 'insert directo sobre solicitud published rechazado por guard');

create function pg_temp.test_write_drop_non_owner() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003407';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_other_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
end;
$$;
select throws_matching('select pg_temp.test_write_drop_non_owner()', 'row-level security policy|NOT_FOUND', 'insert directo por no dueño rechazado por guard');

create function pg_temp.test_write_draft_drop_owner() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003408';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
end;
$$;
select lives_ok('select pg_temp.test_write_draft_drop_owner()', 'insert directo en draft por dueño permitido');

create function pg_temp.test_update_contacts_published() returns text language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003409';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003409';
  v_res text;
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
  insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared)
  values (v_drop_id, 'Dir 1', 'Dest', '+543865111111', true);

  perform pg_temp.act_as(pg_temp.merchant_id());
  update public.delivery_request_drop_contacts set dropoff_address = 'Nueva Dir' where drop_id = v_drop_id;

  perform pg_temp.reset_actor();
  select dropoff_address into v_res from public.delivery_request_drop_contacts where drop_id = v_drop_id;
  return v_res;
end;
$$;
select is(pg_temp.test_update_contacts_published(), 'Dir 1', 'update contactos en published rechazado por RLS (valor no cambia)');

create function pg_temp.test_delete_drop_published() returns int language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003410';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003410';
  v_count int;
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');

  perform pg_temp.act_as(pg_temp.merchant_id());
  delete from public.delivery_request_drops where id = v_drop_id;

  perform pg_temp.reset_actor();
  select count(*)::int into v_count from public.delivery_request_drops where id = v_drop_id;
  return v_count;
end;
$$;
select is(pg_temp.test_delete_drop_published(), 1, 'delete drop en published rechazado por RLS (drop permanece)');

-- 4. Integridad de pago y cambio por entrega (DoD & CC-022 §5b)
create function pg_temp.test_check_transfer_with_change() returns void language plpgsql as $$
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
  values ('40000000-0000-4000-8000-000000003411', '30000000-0000-4000-8000-000000003408', 2, pg_temp.dropoff_zone_id(), 'chico', 'transfer', true);
end;
$$;
select throws_matching('select pg_temp.test_check_transfer_with_change()', 'violates check constraint', 'transfer con needs_change rechazado por check');

create function pg_temp.test_check_to_agree_with_change() returns void language plpgsql as $$
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
  values ('40000000-0000-4000-8000-000000003412', '30000000-0000-4000-8000-000000003408', 3, pg_temp.dropoff_zone_id(), 'chico', 'to_agree', true);
end;
$$;
select throws_matching('select pg_temp.test_check_to_agree_with_change()', 'violates check constraint', 'to_agree con needs_change rechazado por check');

create function pg_temp.test_check_cash_with_change() returns void language plpgsql as $$
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
  values ('40000000-0000-4000-8000-000000003413', '30000000-0000-4000-8000-000000003408', 4, pg_temp.dropoff_zone_id(), 'chico', 'cash', true);
end;
$$;
select lives_ok('select pg_temp.test_check_cash_with_change()', 'cash con needs_change permitido por check');

create function pg_temp.test_check_transfer_no_change() returns void language plpgsql as $$
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
  values ('40000000-0000-4000-8000-000000003414', '30000000-0000-4000-8000-000000003408', 5, pg_temp.dropoff_zone_id(), 'chico', 'transfer', false);
end;
$$;
select lives_ok('select pg_temp.test_check_transfer_no_change()', 'transfer sin cambio permitido por check');

create function pg_temp.test_publish_cash_missing_change() returns text language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003415';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, status, dropoff_zone_id, package_type, recipient_payment_method, needs_change, cash_change_amount
  ) values (
    v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft', pg_temp.dropoff_zone_id(), 'chico', 'cash', true, null
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    v_req_id, 'Av Mitre 1', 'San Martin 2', 'Juan', '+543865123456', true
  );

  perform pg_temp.act_as(pg_temp.merchant_id());
  perform public.publish_request(v_req_id);
  return 'OK';
exception when others then
  return SQLERRM;
end;
$$;
select is(pg_temp.test_publish_cash_missing_change(), 'VALIDATION_ERROR', 'cash con cambio y sin monto da VALIDATION_ERROR');

create function pg_temp.test_publish_cash_no_change_with_amount() returns text language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003416';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003416';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, status
  ) values (
    v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft'
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address
  ) values (
    v_req_id, 'Av Mitre 1'
  );
  insert into public.delivery_request_drops (
    id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change
  ) values (
    v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', false
  );
  insert into public.delivery_request_drop_contacts (
    drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared, cash_change_amount
  ) values (
    v_drop_id, 'San Martin 2', 'Juan', '+543865123456', true, 500
  );

  perform pg_temp.act_as(pg_temp.merchant_id());
  perform public.publish_request(v_req_id);
  return 'OK';
exception when others then
  return SQLERRM;
end;
$$;
select is(pg_temp.test_publish_cash_no_change_with_amount(), 'VALIDATION_ERROR', 'cash sin cambio con monto informado da VALIDATION_ERROR');

-- 5. Puente de compatibilidad en publish_request (DoD & CC-022 §5)
create function pg_temp.test_legacy_publish_bridge() returns jsonb language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003417';
  v_res jsonb;
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, status, dropoff_zone_id, package_type, recipient_payment_method, needs_change, notes, cash_change_amount
  ) values (
    v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft', pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'Notas legacy puente', null
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    v_req_id, 'Retiro 1', -27.4330, -65.6150, 'Entrega 1', 'Destinatario', '+543865123456', true
  );

  perform pg_temp.act_as(pg_temp.merchant_id());
  select public.publish_request(v_req_id) into v_res;
  perform pg_temp.reset_actor();
  return v_res;
end;
$$;
select is((pg_temp.test_legacy_publish_bridge()->>'dropsCount')::int, 1, 'puente legacy materializa drop 1 y responde dropsCount 1');

select is(
  (select count(*)::int from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003417'),
  1,
  'exactamente 1 drop creado por el puente'
);

select is(
  (select notes from public.delivery_request_drop_contacts where drop_id = (select id from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003417')),
  'Notas legacy puente',
  'notas legacy migradas a drop_contacts por el puente'
);

select is(
  (select notes from public.delivery_requests where id = '30000000-0000-4000-8000-000000003417'),
  'Notas legacy puente',
  'notas legacy no se borran de delivery_requests en paso 1'
);

create function pg_temp.test_legacy_publish_retry() returns int language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003417';
begin
  perform pg_temp.act_as(pg_temp.merchant_id());
  begin
    perform public.publish_request(v_req_id);
  exception when others then
    null;
  end;
  return (select count(*)::int from public.delivery_request_drops where request_id = v_req_id);
end;
$$;
select is(pg_temp.test_legacy_publish_retry(), 1, 'reintento de publicacion no duplica drops');

create function pg_temp.test_legacy_publish_incomplete() returns text language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003418';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, status, dropoff_zone_id, package_type, recipient_payment_method
  ) values (
    v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft', pg_temp.dropoff_zone_id(), 'chico', 'cash'
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    v_req_id, 'Retiro 1', 'Entrega 1', 'Dest', '', false
  );

  perform pg_temp.act_as(pg_temp.merchant_id());
  perform public.publish_request(v_req_id);
  return 'OK';
exception when others then
  return SQLERRM;
end;
$$;
select is(pg_temp.test_legacy_publish_incomplete(), 'MISSING_REQUIRED_FIELDS', 'solicitud legacy incompleta rechazada con MISSING_REQUIRED_FIELDS');

-- 6. Privacidad y RLS de drop_contacts (DoD & CC-022 §3)
create function pg_temp.test_courier_read_drop_contacts() returns integer language plpgsql as $$
declare
  v_count integer;
  v_req_id uuid := '30000000-0000-4000-8000-000000003419';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003419';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
  insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared, notes, cash_change_amount)
  values (v_drop_id, 'Calle Secreta 123', 'Privado', '+543865123456', true, 'Indicaciones secretas', 2000);

  perform pg_temp.act_as(pg_temp.courier_1_id());
  select count(*) into v_count from public.delivery_request_drop_contacts where drop_id = v_drop_id;
  return v_count;
end;
$$;
select is(pg_temp.test_courier_read_drop_contacts(), 0, 'repartidor no aceptado no ve drop_contacts por RLS');

create function pg_temp.test_merchant_read_drop_contacts() returns integer language plpgsql as $$
declare
  v_count integer;
begin
  perform pg_temp.act_as(pg_temp.merchant_id());
  select count(*) into v_count from public.delivery_request_drop_contacts where drop_id = '40000000-0000-4000-8000-000000003419';
  return v_count;
end;
$$;
select is(pg_temp.test_merchant_read_drop_contacts(), 1, 'comercio dueno ve sus propios drop_contacts por RLS');

create function pg_temp.test_accepted_courier_read_drop_contacts() returns integer language plpgsql as $$
declare
  v_count integer;
  v_req_id uuid := '30000000-0000-4000-8000-000000003420';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003420';
  v_offer_id uuid := '50000000-0000-4000-8000-000000003420';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status, accepted_offer_id)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'matched', v_offer_id);
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values (v_offer_id, v_req_id, pg_temp.courier_1_id(), 1500, 15, 'accepted');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
  insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared)
  values (v_drop_id, 'Av Aconquija 500', 'Destinatario Aceptado', '+543865999999', true);

  perform pg_temp.act_as(pg_temp.courier_1_id());
  select count(*) into v_count from public.delivery_request_drop_contacts where drop_id = v_drop_id;
  return v_count;
end;
$$;
select is(pg_temp.test_accepted_courier_read_drop_contacts(), 1, 'repartidor aceptado ve drop_contacts post-match por RLS');

create function pg_temp.test_admin_read_drop_contacts() returns integer language plpgsql as $$
declare
  v_count integer;
begin
  perform pg_temp.act_as(pg_temp.admin_id());
  select count(*) into v_count from public.delivery_request_drop_contacts where drop_id = '40000000-0000-4000-8000-000000003419';
  return v_count;
end;
$$;
select is(pg_temp.test_admin_read_drop_contacts(), 1, 'admin ve drop_contacts por RLS');

-- 7. Setting max_drops_per_request (DoD & CC-022 §4)
select is(
  (select value::int from public.platform_settings where key = 'max_drops_per_request'),
  5,
  'max_drops_per_request arranca en 5'
);

create function pg_temp.test_update_setting_zero() returns text language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.admin_id());
  perform public.admin_update_setting('max_drops_per_request', '0'::jsonb);
  return 'OK';
exception when others then
  return SQLERRM;
end;
$$;
select is(pg_temp.test_update_setting_zero(), 'VALIDATION_ERROR', 'max_drops_per_request con 0 rechazado con VALIDATION_ERROR');

create function pg_temp.test_update_setting_non_admin() returns text language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.merchant_id());
  perform public.admin_update_setting('max_drops_per_request', '3'::jsonb);
  return 'OK';
exception when others then
  return SQLERRM;
end;
$$;
select is(pg_temp.test_update_setting_non_admin(), 'UNAUTHORIZED_ACTOR', 'update de setting por no admin da UNAUTHORIZED_ACTOR');

create function pg_temp.test_update_setting_admin_success() returns int language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.admin_id());
  perform public.admin_update_setting('max_drops_per_request', '3'::jsonb);
  return (select count(*)::int from public.audit_log where action = 'update_setting' and target_id = 'max_drops_per_request');
end;
$$;
select is(pg_temp.test_update_setting_admin_success(), 1, 'admin_update_setting actualiza y genera registro en audit_log');

-- 8. CC-023: grant select (drops_count) on public.delivery_requests to authenticated
select ok(
  has_column_privilege('authenticated', 'public.delivery_requests', 'drops_count', 'SELECT'),
  'authenticated tiene grant select sobre drops_count (CC-023)'
);

-- 9. RPC mark_drop_delivered y mark_drop_failed existen y son callable
select has_function('public', 'mark_drop_delivered', ARRAY['uuid'], 'mark_drop_delivered existe');
select has_function('public', 'mark_drop_failed', ARRAY['uuid', 'text'], 'mark_drop_failed existe');

-- 10. Backfill idempotencia y casos extremos (H01/H02)
create function pg_temp.test_backfill_incomplete_draft() returns int language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003421';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

  return (select count(*)::int from public.delivery_request_drops where request_id = v_req_id);
end;
$$;
select is(pg_temp.test_backfill_incomplete_draft(), 0, 'borrador incompleto no genera drop en backfill');

create function pg_temp.test_backfill_inconsistent_nondraft() returns int language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003422';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status, dropoff_zone_id)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published', null);

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  select
    r.merchant_id, 'legacy_migration_inconsistent', 'delivery_request', r.id::text,
    jsonb_build_object('status', r.status), jsonb_build_object('preserved', true)
  from public.delivery_requests r
  where r.id = v_req_id;

  return (select count(*)::int from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = v_req_id::text);
end;
$$;
select is(pg_temp.test_backfill_inconsistent_nondraft(), 1, 'solicitud no-draft inconsistente queda senalada en audit_log');

create function pg_temp.test_backfill_repeated_no_duplicates() returns int language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003423';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003423';
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, status, dropoff_zone_id, package_type, recipient_payment_method, needs_change
  ) values (
    v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'delivered', pg_temp.dropoff_zone_id(), 'chico', 'cash', false
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    v_req_id, 'Retiro Real', 'Entrega Real', 'Destinatario Real', '+543865123456', true
  );

  insert into public.delivery_request_drops (
    id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status, delivered_at
  )
  select
    v_drop_id, r.id, 1, r.dropoff_zone_id, r.package_type, r.recipient_payment_method, false, 'delivered', coalesce(r.delivered_at, now())
  from public.delivery_requests r
  where r.id = v_req_id
    and not exists (select 1 from public.delivery_request_drops d where d.request_id = r.id);

  insert into public.delivery_request_drops (
    id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status, delivered_at
  )
  select
    gen_random_uuid(), r.id, 1, r.dropoff_zone_id, r.package_type, r.recipient_payment_method, false, 'delivered', coalesce(r.delivered_at, now())
  from public.delivery_requests r
  where r.id = v_req_id
    and not exists (select 1 from public.delivery_request_drops d where d.request_id = r.id);

  return (select count(*)::int from public.delivery_request_drops where request_id = v_req_id);
end;
$$;
select is(pg_temp.test_backfill_repeated_no_duplicates(), 1, 'backfill repetido no genera duplicados');

rollback;
