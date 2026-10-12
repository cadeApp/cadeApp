begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(90);

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
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', 'aal2')::text,
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
  (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't340.admin@example.test', 'pwd', '{"role":"merchant"}'::jsonb)
on conflict (id) do nothing;

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

-- 3. Guard de borrador: app_private.lock_draft_request_for_child_write (DoD, CC-022 §2b y H06/H08)
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_private' and p.proname = 'lock_draft_request_for_child_write'),
  false,
  'lock_draft_request_for_child_write es SECURITY INVOKER (prosecdef = false)'
);

select is(
  (select position('for update' in lower(prosrc)) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_private' and p.proname = 'lock_draft_request_for_child_write'),
  true,
  'lock_draft_request_for_child_write adquiere delivery_requests FOR UPDATE'
);

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
select throws_matching('select pg_temp.test_write_published_drop()', 'INVALID_STATE_TRANSITION', 'insert directo sobre solicitud published rechazado por guard con INVALID_STATE_TRANSITION');

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

create function pg_temp.test_update_draft_drop_owner() returns text language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003408';
  v_drop_id uuid;
  v_pkg text;
begin
  select id into v_drop_id from public.delivery_request_drops where request_id = v_req_id limit 1;

  perform pg_temp.act_as(pg_temp.merchant_id());
  update public.delivery_request_drops set package_type = 'mediano' where id = v_drop_id;

  perform pg_temp.reset_actor();
  select package_type::text into v_pkg from public.delivery_request_drops where id = v_drop_id;
  return v_pkg;
end;
$$;
select is(pg_temp.test_update_draft_drop_owner(), 'mediano', 'update directo de drop en draft por dueño permitido');

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

create function pg_temp.test_update_contacts_draft() returns text language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003429';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003429';
  v_addr text;
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
  insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared)
  values (v_drop_id, 'Direccion Original', 'Destinatario', '+543865123456', true);

  perform pg_temp.act_as(pg_temp.merchant_id());
  update public.delivery_request_drop_contacts set dropoff_address = 'Direccion Modificada' where drop_id = v_drop_id;

  perform pg_temp.reset_actor();
  select dropoff_address into v_addr from public.delivery_request_drop_contacts where drop_id = v_drop_id;
  return v_addr;
end;
$$;
select is(pg_temp.test_update_contacts_draft(), 'Direccion Modificada', 'update contactos en draft por dueño permitido');

create function pg_temp.test_delete_draft_drop_owner() returns int language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003430';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003430';
  v_cnt int;
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');

  perform pg_temp.act_as(pg_temp.merchant_id());
  delete from public.delivery_request_drops where id = v_drop_id;

  perform pg_temp.reset_actor();
  select count(*)::int into v_cnt from public.delivery_request_drops where id = v_drop_id;
  return v_cnt;
end;
$$;
select is(pg_temp.test_delete_draft_drop_owner(), 0, 'delete drop en draft por dueño permitido');

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
  perform pg_temp.reset_actor();
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
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
  values (v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published');
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values (v_offer_id, v_req_id, pg_temp.courier_1_id(), 1500, 15, 'accepted');
  update public.delivery_requests set status = 'matched', accepted_offer_id = v_offer_id where id = v_req_id;
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico', 'cash');
  insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared)
  values (v_drop_id, 'Av Aconquija 500', 'Destinatario Aceptado', '+543865999999', true);

  perform pg_temp.act_as(pg_temp.courier_1_id());
  select count(*) into v_count from public.delivery_request_drop_contacts where drop_id = v_drop_id;
  perform pg_temp.reset_actor();
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
  perform pg_temp.reset_actor();
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
  perform pg_temp.reset_actor();
  return 'OK';
exception when others then
  perform pg_temp.reset_actor();
  return SQLERRM;
end;
$$;
select is(pg_temp.test_update_setting_zero(), 'INVALID_SETTING_VALUE', 'max_drops_per_request con 0 rechazado con INVALID_SETTING_VALUE');

create function pg_temp.test_update_setting_non_admin() returns text language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.merchant_id());
  perform public.admin_update_setting('max_drops_per_request', '3'::jsonb);
  perform pg_temp.reset_actor();
  return 'OK';
exception when others then
  perform pg_temp.reset_actor();
  return SQLERRM;
end;
$$;
select is(pg_temp.test_update_setting_non_admin(), 'UNAUTHORIZED_ACTOR', 'update de setting por no admin da UNAUTHORIZED_ACTOR');

create function pg_temp.test_update_setting_admin_success() returns int language plpgsql as $$
declare
  v_cnt int;
begin
  perform pg_temp.act_as(pg_temp.admin_id());
  perform public.admin_update_setting('max_drops_per_request', '3'::jsonb);
  perform pg_temp.reset_actor();
  select count(*)::int into v_cnt from public.audit_log where action = 'admin_update_setting' and target_id = 'max_drops_per_request';
  return v_cnt;
end;
$$;
select is(pg_temp.test_update_setting_admin_success(), 1, 'admin_update_setting actualiza y genera registro en audit_log');

-- 8. CC-023: grant select (drops_count) on public.delivery_requests to authenticated
select ok(
  has_column_privilege('authenticated', 'public.delivery_requests', 'drops_count', 'SELECT'),
  'authenticated tiene grant select sobre drops_count (CC-023)'
);

-- 9. RPC mark_drop_delivered y mark_drop_failed funcionales (DoD, CC-022 §6, H13)
select has_function('public', 'mark_drop_delivered', ARRAY['uuid'], 'mark_drop_delivered existe');
select has_function('public', 'mark_drop_failed', ARRAY['uuid', 'text'], 'mark_drop_failed existe');

-- Fixtures para pruebas de transiciones y estados por entrega
-- Solicitud 1: in_transit con 3 drops y oferta aceptada por courier_1_id
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, drops_count
) values (
  '30000000-0000-4000-8000-000000003500', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'in_transit', 3
);

insert into public.offers (
  id, request_id, courier_id, status, amount_ars, eta_minutes
) values (
  '30000000-0000-4000-8000-000000003510', '30000000-0000-4000-8000-000000003500', pg_temp.courier_1_id(), 'accepted', 1500, 20
);

update public.delivery_requests
set accepted_offer_id = '30000000-0000-4000-8000-000000003510'
where id = '30000000-0000-4000-8000-000000003500';

insert into public.delivery_request_drops (
  id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status
) values
  ('30000000-0000-4000-8000-000000003501', '30000000-0000-4000-8000-000000003500', 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending'),
  ('30000000-0000-4000-8000-000000003502', '30000000-0000-4000-8000-000000003500', 2, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending'),
  ('30000000-0000-4000-8000-000000003503', '30000000-0000-4000-8000-000000003500', 3, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending');

insert into public.delivery_request_drop_contacts (
  drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values
  ('30000000-0000-4000-8000-000000003501', 'Calle 1', 'Destinatario 1', '+543865000001', true),
  ('30000000-0000-4000-8000-000000003502', 'Calle 2', 'Destinatario 2', '+543865000002', true),
  ('30000000-0000-4000-8000-000000003503', 'Calle 3', 'Destinatario 3', '+543865000003', true);

-- Solicitud 2: in_transit con 2 drops para probar "todas failed" (CC-022 §6)
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, drops_count
) values (
  '30000000-0000-4000-8000-000000003520', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'in_transit', 2
);

insert into public.offers (
  id, request_id, courier_id, status, amount_ars, eta_minutes
) values (
  '30000000-0000-4000-8000-000000003525', '30000000-0000-4000-8000-000000003520', pg_temp.courier_1_id(), 'accepted', 1500, 20
);

update public.delivery_requests
set accepted_offer_id = '30000000-0000-4000-8000-000000003525'
where id = '30000000-0000-4000-8000-000000003520';

insert into public.delivery_request_drops (
  id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status
) values
  ('30000000-0000-4000-8000-000000003521', '30000000-0000-4000-8000-000000003520', 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending'),
  ('30000000-0000-4000-8000-000000003522', '30000000-0000-4000-8000-000000003520', 2, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending');

insert into public.delivery_request_drop_contacts (
  drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values
  ('30000000-0000-4000-8000-000000003521', 'Calle X', 'Destinatario X', '+543865000010', true),
  ('30000000-0000-4000-8000-000000003522', 'Calle Y', 'Destinatario Y', '+543865000020', true);

-- Solicitud 3: matched (no in_transit) con oferta accepted
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, drops_count
) values (
  '30000000-0000-4000-8000-000000003530', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'matched', 1
);

insert into public.offers (
  id, request_id, courier_id, status, amount_ars, eta_minutes
) values (
  '30000000-0000-4000-8000-000000003535', '30000000-0000-4000-8000-000000003530', pg_temp.courier_1_id(), 'accepted', 1500, 20
);

update public.delivery_requests
set accepted_offer_id = '30000000-0000-4000-8000-000000003535'
where id = '30000000-0000-4000-8000-000000003530';

insert into public.delivery_request_drops (
  id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status
) values
  ('30000000-0000-4000-8000-000000003531', '30000000-0000-4000-8000-000000003530', 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending');

insert into public.delivery_request_drop_contacts (
  drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values
  ('30000000-0000-4000-8000-000000003531', 'Calle Z', 'Destinatario Z', '+543865000030', true);

-- Solicitud 4: in_transit con 2 drops y oferta aceptada para verificar rechazo legacy exclusivo (CC-022 §6, H13)
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, drops_count
) values (
  '30000000-0000-4000-8000-000000003540', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'in_transit', 2
);

insert into public.offers (
  id, request_id, courier_id, status, amount_ars, eta_minutes
) values (
  '30000000-0000-4000-8000-000000003545', '30000000-0000-4000-8000-000000003540', pg_temp.courier_1_id(), 'accepted', 1500, 20
);

update public.delivery_requests
set accepted_offer_id = '30000000-0000-4000-8000-000000003545'
where id = '30000000-0000-4000-8000-000000003540';

insert into public.delivery_request_drops (
  id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status
) values
  ('30000000-0000-4000-8000-000000003541', '30000000-0000-4000-8000-000000003540', 1, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending'),
  ('30000000-0000-4000-8000-000000003542', '30000000-0000-4000-8000-000000003540', 2, pg_temp.dropoff_zone_id(), 'chico', 'cash', false, 'pending');

insert into public.delivery_request_drop_contacts (
  drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values
  ('30000000-0000-4000-8000-000000003541', 'Calle M1', 'Destinatario M1', '+543865000041', true),
  ('30000000-0000-4000-8000-000000003542', 'Calle M2', 'Destinatario M2', '+543865000042', true);

-- Tests de validación y control de acceso (DoD, CC-022 §6, H13)
create function pg_temp.test_rpc_drop_unauthenticated() returns void language plpgsql as $$
begin
  perform pg_temp.reset_actor();
  perform public.mark_drop_delivered('30000000-0000-4000-8000-000000003501');
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_unauthenticated()', 'UNAUTHENTICATED', 'mark_drop_delivered requiere autenticacion');

create function pg_temp.test_rpc_drop_merchant_caller() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.merchant_id());
  perform public.mark_drop_delivered('30000000-0000-4000-8000-000000003501');
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_merchant_caller()', 'UNAUTHORIZED_ACTOR', 'mark_drop_delivered rechaza actor comercio');

create function pg_temp.test_rpc_drop_other_courier() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_2_id());
  perform public.mark_drop_delivered('30000000-0000-4000-8000-000000003501');
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_other_courier()', 'UNAUTHORIZED_ACTOR', 'mark_drop_delivered rechaza repartidor no asignado a la oferta aceptada');

create function pg_temp.test_rpc_drop_delivered_suspended() returns void language plpgsql as $$
begin
  update public.couriers set status = 'suspended' where profile_id = pg_temp.courier_1_id();
  perform pg_temp.act_as(pg_temp.courier_1_id());
  begin
    perform public.mark_drop_delivered('30000000-0000-4000-8000-000000003501');
  exception when others then
    perform pg_temp.reset_actor();
    update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
    raise;
  end;
  perform pg_temp.reset_actor();
  update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_delivered_suspended()', 'COURIER_SUSPENDED', 'mark_drop_delivered rechaza repartidor suspendido');

create function pg_temp.test_rpc_drop_delivered_unapproved() returns void language plpgsql as $$
begin
  update public.couriers set status = 'pending' where profile_id = pg_temp.courier_1_id();
  perform pg_temp.act_as(pg_temp.courier_1_id());
  begin
    perform public.mark_drop_delivered('30000000-0000-4000-8000-000000003501');
  exception when others then
    perform pg_temp.reset_actor();
    update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
    raise;
  end;
  perform pg_temp.reset_actor();
  update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_delivered_unapproved()', 'COURIER_NOT_APPROVED', 'mark_drop_delivered rechaza repartidor no aprobado');

create function pg_temp.test_rpc_drop_failed_unauthenticated() returns void language plpgsql as $$
begin
  perform pg_temp.reset_actor();
  perform public.mark_drop_failed('30000000-0000-4000-8000-000000003501', 'Motivo prueba');
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_failed_unauthenticated()', 'UNAUTHENTICATED', 'mark_drop_failed requiere autenticacion');

create function pg_temp.test_rpc_drop_failed_merchant_caller() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.merchant_id());
  perform public.mark_drop_failed('30000000-0000-4000-8000-000000003501', 'Motivo prueba');
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_failed_merchant_caller()', 'UNAUTHORIZED_ACTOR', 'mark_drop_failed rechaza actor comercio');

create function pg_temp.test_rpc_drop_failed_other_courier() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_2_id());
  perform public.mark_drop_failed('30000000-0000-4000-8000-000000003501', 'Motivo prueba');
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_failed_other_courier()', 'UNAUTHORIZED_ACTOR', 'mark_drop_failed rechaza repartidor no asignado a la oferta aceptada');

create function pg_temp.test_rpc_drop_failed_suspended() returns void language plpgsql as $$
begin
  update public.couriers set status = 'suspended' where profile_id = pg_temp.courier_1_id();
  perform pg_temp.act_as(pg_temp.courier_1_id());
  begin
    perform public.mark_drop_failed('30000000-0000-4000-8000-000000003501', 'Motivo prueba');
  exception when others then
    perform pg_temp.reset_actor();
    update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
    raise;
  end;
  perform pg_temp.reset_actor();
  update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_failed_suspended()', 'COURIER_SUSPENDED', 'mark_drop_failed rechaza repartidor suspendido');

create function pg_temp.test_rpc_drop_failed_unapproved() returns void language plpgsql as $$
begin
  update public.couriers set status = 'pending' where profile_id = pg_temp.courier_1_id();
  perform pg_temp.act_as(pg_temp.courier_1_id());
  begin
    perform public.mark_drop_failed('30000000-0000-4000-8000-000000003501', 'Motivo prueba');
  exception when others then
    perform pg_temp.reset_actor();
    update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
    raise;
  end;
  perform pg_temp.reset_actor();
  update public.couriers set status = 'approved' where profile_id = pg_temp.courier_1_id();
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_failed_unapproved()', 'COURIER_NOT_APPROVED', 'mark_drop_failed rechaza repartidor no aprobado');

select is(
  (select status from public.delivery_request_drops where id = '30000000-0000-4000-8000-000000003501'),
  'pending',
  'drop permanece pending tras rechazos de autorizacion y elegibilidad'
);

create function pg_temp.test_rpc_drop_null_param() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_delivered(null);
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_null_param()', 'VALIDATION_ERROR', 'mark_drop_delivered valida parametro drop_id no nulo');

create function pg_temp.test_rpc_drop_not_found() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_delivered('00000000-0000-0000-0000-000000000000'::uuid);
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_not_found()', 'NOT_FOUND', 'mark_drop_delivered rechaza drop inexistente');

create function pg_temp.test_rpc_drop_not_in_transit() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_delivered('30000000-0000-4000-8000-000000003531');
end;
$$;
select throws_matching('select pg_temp.test_rpc_drop_not_in_transit()', 'INVALID_STATE_TRANSITION', 'mark_drop_delivered rechaza solicitud que no esta in_transit');

-- Tests de mark_drop_delivered
create function pg_temp.test_mark_drop_delivered_first() returns int language plpgsql as $$
declare
  v_res jsonb;
  v_drop_st text;
  v_req_st text;
  v_del_at timestamptz;
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  v_res := public.mark_drop_delivered('30000000-0000-4000-8000-000000003501');
  perform pg_temp.reset_actor();

  select status, delivered_at into v_drop_st, v_del_at from public.delivery_request_drops where id = '30000000-0000-4000-8000-000000003501';
  select status into v_req_st from public.delivery_requests where id = '30000000-0000-4000-8000-000000003500';

  if v_res->>'status' = 'delivered' and (v_res->>'idempotent')::boolean = false
     and v_res->>'requestStatus' = 'in_transit' and v_drop_st = 'delivered'
     and v_del_at is not null and v_req_st = 'in_transit' then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_mark_drop_delivered_first(), 1, 'mark_drop_delivered marca drop delivered y mantiene solicitud in_transit mientras queden pendientes');

create function pg_temp.test_mark_drop_delivered_idempotent() returns int language plpgsql as $$
declare
  v_res jsonb;
  v_del_at1 timestamptz;
  v_del_at2 timestamptz;
begin
  select delivered_at into v_del_at1 from public.delivery_request_drops where id = '30000000-0000-4000-8000-000000003501';
  perform pg_temp.act_as(pg_temp.courier_1_id());
  v_res := public.mark_drop_delivered('30000000-0000-4000-8000-000000003501');
  perform pg_temp.reset_actor();

  select delivered_at into v_del_at2 from public.delivery_request_drops where id = '30000000-0000-4000-8000-000000003501';

  if v_res->>'status' = 'delivered' and (v_res->>'idempotent')::boolean = true and v_del_at1 = v_del_at2 then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_mark_drop_delivered_idempotent(), 1, 'mark_drop_delivered es idempotente en segunda llamada con misma fecha');

-- Tests de mark_drop_failed
create function pg_temp.test_mark_drop_failed_validation_empty() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_failed('30000000-0000-4000-8000-000000003502', '   ');
end;
$$;
select throws_matching('select pg_temp.test_mark_drop_failed_validation_empty()', 'REASON_REQUIRED', 'mark_drop_failed exige motivo no vacio');

create function pg_temp.test_mark_drop_failed_validation_toolong() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_failed('30000000-0000-4000-8000-000000003502', repeat('x', 501));
end;
$$;
select throws_matching('select pg_temp.test_mark_drop_failed_validation_toolong()', 'VALIDATION_ERROR', 'mark_drop_failed rechaza motivo mayor a 500 caracteres');

create function pg_temp.test_mark_drop_failed_first() returns int language plpgsql as $$
declare
  v_res jsonb;
  v_drop_st text;
  v_reason text;
  v_req_st text;
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  v_res := public.mark_drop_failed('30000000-0000-4000-8000-000000003502', 'Cliente ausente');
  perform pg_temp.reset_actor();

  select status, failed_reason into v_drop_st, v_reason from public.delivery_request_drops where id = '30000000-0000-4000-8000-000000003502';
  select status into v_req_st from public.delivery_requests where id = '30000000-0000-4000-8000-000000003500';

  if v_res->>'status' = 'failed' and (v_res->>'idempotent')::boolean = false
     and v_res->>'failedReason' = 'Cliente ausente' and v_res->>'requestStatus' = 'in_transit'
     and v_drop_st = 'failed' and v_reason = 'Cliente ausente' and v_req_st = 'in_transit' then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_mark_drop_failed_first(), 1, 'mark_drop_failed marca drop failed con motivo y mantiene solicitud in_transit');

create function pg_temp.test_mark_drop_failed_idempotent() returns int language plpgsql as $$
declare
  v_res jsonb;
  v_reason text;
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  v_res := public.mark_drop_failed('30000000-0000-4000-8000-000000003502', 'Cliente ausente');
  perform pg_temp.reset_actor();

  select failed_reason into v_reason from public.delivery_request_drops where id = '30000000-0000-4000-8000-000000003502';

  if v_res->>'status' = 'failed' and (v_res->>'idempotent')::boolean = true
     and v_res->>'failedReason' = 'Cliente ausente' and v_reason = 'Cliente ausente' then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_mark_drop_failed_idempotent(), 1, 'mark_drop_failed es idempotente en segunda llamada con mismo motivo');

-- Reversiones no permitidas
create function pg_temp.test_reverse_delivered_to_failed() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_failed('30000000-0000-4000-8000-000000003501', 'Fallo posterior');
end;
$$;
select throws_matching('select pg_temp.test_reverse_delivered_to_failed()', 'INVALID_STATE_TRANSITION', 'no permite cambiar drop delivered a failed');

create function pg_temp.test_reverse_failed_to_delivered() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_delivered('30000000-0000-4000-8000-000000003502');
end;
$$;
select throws_matching('select pg_temp.test_reverse_failed_to_delivered()', 'INVALID_STATE_TRANSITION', 'no permite cambiar drop failed a delivered');

-- Cierre automático de solicitud al completar última entrega pendiente (combinación mixta)
create function pg_temp.test_mark_last_drop_closes_parent() returns int language plpgsql as $$
declare
  v_res jsonb;
  v_req_st text;
  v_del_at timestamptz;
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  v_res := public.mark_drop_delivered('30000000-0000-4000-8000-000000003503');
  perform pg_temp.reset_actor();

  select status, delivered_at into v_req_st, v_del_at from public.delivery_requests where id = '30000000-0000-4000-8000-000000003500';

  if v_res->>'status' = 'delivered' and v_res->>'requestStatus' = 'delivered'
     and v_req_st = 'delivered' and v_del_at is not null then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_mark_last_drop_closes_parent(), 1, 'al completar ultima entrega pendiente la solicitud pasa automaticamente a delivered');

-- Escenario: todas las entregas failed -> solicitud pasa a delivered (CC-022 §6)
create function pg_temp.test_all_drops_failed_closes_parent() returns int language plpgsql as $$
declare
  v_st1 text;
  v_st2 text;
  v_res jsonb;
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_drop_failed('30000000-0000-4000-8000-000000003521', 'Fallo X');
  perform pg_temp.reset_actor();

  select status into v_st1 from public.delivery_requests where id = '30000000-0000-4000-8000-000000003520';

  perform pg_temp.act_as(pg_temp.courier_1_id());
  v_res := public.mark_drop_failed('30000000-0000-4000-8000-000000003522', 'Fallo Y');
  perform pg_temp.reset_actor();

  select status into v_st2 from public.delivery_requests where id = '30000000-0000-4000-8000-000000003520';

  if v_st1 = 'in_transit' and v_st2 = 'delivered' and v_res->>'requestStatus' = 'delivered' then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_all_drops_failed_closes_parent(), 1, 'solicitud cierra en delivered cuando todas las entregas quedan failed (CC-022 §6)');

-- mark_delivered legacy con drops_count > 1 es rechazado sobre solicitud activa in_transit (CC-022 §6, H13)
create function pg_temp.test_legacy_mark_delivered_multi_rejected() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.courier_1_id());
  perform public.mark_delivered('30000000-0000-4000-8000-000000003540'::uuid);
end;
$$;
select throws_matching('select pg_temp.test_legacy_mark_delivered_multi_rejected()', 'INVALID_STATE_TRANSITION', 'mark_delivered legacy es rechazado con drops_count mayor a 1 en solicitud in_transit (CC-022 §6)');

-- 10. Backfill productivo: app_private.t340_backfill_legacy (DoD, CC-022 §5b, H07, H10, H11 y H12)

-- A. Fixture para borrador incompleto: no debe generar drop ni audit_log
insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status)
values ('30000000-0000-4000-8000-000000003421', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'draft');

-- B. Fixture para solicitud historica completa: debe materializar 1 drop y 1 drop_contacts con delivered_at original
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, delivered_at, dropoff_zone_id, package_type, recipient_payment_method, needs_change, notes, cash_change_amount
) values (
  '30000000-0000-4000-8000-000000003422', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'delivered', '2026-10-01 12:00:00+00'::timestamptz, pg_temp.dropoff_zone_id(), 'chico', 'cash', true, 'Notas legacy completas', 1500
);
insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (
  '30000000-0000-4000-8000-000000003422', 'Av Mitre 10', 'San Martin 20', 'Destinatario Real', '+543865123456', true
);

-- C. Fixture para historica transfer con needs_change=true (CC-022 §5b / H10): normaliza a 1 drop con needs_change=false y monto null
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, dropoff_zone_id, package_type, recipient_payment_method, needs_change
) values (
  '30000000-0000-4000-8000-000000003423', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published', pg_temp.dropoff_zone_id(), 'chico', 'transfer', true
);
insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (
  '30000000-0000-4000-8000-000000003423', 'Av Mitre 30', 'San Martin 40', 'Dest Transfer', '+543865222222', true
);

-- D. Fixture para historica cash con cambio pero monto null (CC-022 §5b / H10): 1 drop needs_change=true sin monto, y 1 auditoria
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, dropoff_zone_id, package_type, recipient_payment_method, needs_change, cash_change_amount
) values (
  '30000000-0000-4000-8000-000000003424', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published', pg_temp.dropoff_zone_id(), 'chico', 'cash', true, null
);
insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (
  '30000000-0000-4000-8000-000000003424', 'Av Mitre 50', 'San Martin 60', 'Dest Cash Sin Monto', '+543865333333', true
);

-- E. Fixture para historica incompleta (H11): published con monto 1500 pero sin consentimiento -> 0 drops, 1 auditoria sin filtrar monto
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, dropoff_zone_id, package_type, recipient_payment_method, needs_change, cash_change_amount
) values (
  '30000000-0000-4000-8000-000000003425', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'published', pg_temp.dropoff_zone_id(), 'chico', 'cash', true, 1500
);
insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (
  '30000000-0000-4000-8000-000000003425', 'Av Mitre 70', 'San Martin 80', 'Dest Sin Consentimiento', '+543865444444', false
);

-- F. Fixture para historica delivered sin delivered_at (H12): no debe crearse drop con fecha inventada -> 0 drops, 1 auditoria
insert into public.delivery_requests (
  id, merchant_id, pickup_zone_id, status, delivered_at, dropoff_zone_id, package_type, recipient_payment_method, needs_change
) values (
  '30000000-0000-4000-8000-000000003426', pg_temp.merchant_id(), pg_temp.pickup_zone_id(), 'delivered', null, pg_temp.dropoff_zone_id(), 'chico', 'cash', false
);
insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (
  '30000000-0000-4000-8000-000000003426', 'Av Mitre 90', 'San Martin 100', 'Dest Delivered Sin Fecha', '+543865555555', true
);

-- Ejecución real del helper de backfill productivo sobre los fixtures
create function pg_temp.test_backfill_incomplete_draft() returns int language plpgsql as $$
begin
  perform app_private.t340_backfill_legacy();
  return (select count(*)::int from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003421');
end;
$$;
select is(pg_temp.test_backfill_incomplete_draft(), 0, 'borrador incompleto no genera drop en backfill productivo');

create function pg_temp.test_backfill_inconsistent_nondraft() returns int language plpgsql as $$
declare
  v_drops_transfer int;
  v_pos_transfer int;
  v_nc_transfer boolean;
  v_amt_transfer int;
  v_legacy_nc_transfer boolean;
  v_audit_transfer int;

  v_drops_cash int;
  v_pos_cash int;
  v_nc_cash boolean;
  v_amt_cash int;
  v_legacy_amt_cash int;
  v_audit_cash int;

  v_drops_incomplete int;
  v_audit_incomplete int;
begin
  perform app_private.t340_backfill_legacy();

  -- Escenario 1 (transfer + needs_change=true): materializa 1 drop con needs_change normalizado a false y sin monto
  select count(*)::int into v_drops_transfer from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003423';
  select position, needs_change into v_pos_transfer, v_nc_transfer from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003423';
  select cash_change_amount into v_amt_transfer from public.delivery_request_drop_contacts where drop_id = (select id from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003423');
  select needs_change into v_legacy_nc_transfer from public.delivery_requests where id = '30000000-0000-4000-8000-000000003423';
  select count(*)::int into v_audit_transfer from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003423';

  -- Escenario 2 (cash + needs_change=true + cash_change_amount=null): materializa 1 drop needs_change=true sin monto, y audita anomalia
  select count(*)::int into v_drops_cash from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003424';
  select position, needs_change into v_pos_cash, v_nc_cash from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003424';
  select cash_change_amount into v_amt_cash from public.delivery_request_drop_contacts where drop_id = (select id from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003424');
  select cash_change_amount into v_legacy_amt_cash from public.delivery_requests where id = '30000000-0000-4000-8000-000000003424';
  select count(*)::int into v_audit_cash from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003424';

  -- Escenario 3 (incompleto sin consentimiento): 0 drops y 1 auditoria
  select count(*)::int into v_drops_incomplete from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003425';
  select count(*)::int into v_audit_incomplete from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003425';

  if v_drops_transfer = 1 and v_pos_transfer = 1 and v_nc_transfer is false and v_amt_transfer is null and v_legacy_nc_transfer is true and v_audit_transfer = 0
     and v_drops_cash = 1 and v_pos_cash = 1 and v_nc_cash is true and v_amt_cash is null and v_legacy_amt_cash is null and v_audit_cash = 1
     and v_drops_incomplete = 0 and v_audit_incomplete = 1 then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_backfill_inconsistent_nondraft(), 1, 'solicitudes historicas de pago normalizan drops y audit log senala anomalia/incompletos (H10)');

create function pg_temp.test_backfill_repeated_no_duplicates() returns int language plpgsql as $$
declare
  v_drops_complete int;
  v_drops_transfer int;
  v_drops_cash int;
  v_audit_cash int;
  v_audit_incomplete int;
  v_audit_delivered_null int;
begin
  -- Segunda llamada consecutiva al helper de backfill para verificar idempotencia
  perform app_private.t340_backfill_legacy();

  select count(*)::int into v_drops_complete from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003422';
  select count(*)::int into v_drops_transfer from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003423';
  select count(*)::int into v_drops_cash from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003424';
  select count(*)::int into v_audit_cash from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003424';
  select count(*)::int into v_audit_incomplete from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003425';
  select count(*)::int into v_audit_delivered_null from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003426';

  if v_drops_complete = 1 and v_drops_transfer = 1 and v_drops_cash = 1 and v_audit_cash = 1 and v_audit_incomplete = 1 and v_audit_delivered_null = 1 then
    return 1;
  else
    return 0;
  end if;
end;
$$;
select is(pg_temp.test_backfill_repeated_no_duplicates(), 1, 'ejecucion repetida de app_private.t340_backfill_legacy no genera duplicados');

select is(
  (select count(*)::int from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003422'),
  1,
  'solicitud historica completa materializa exactamente 1 drop'
);

select is(
  (select notes from public.delivery_request_drop_contacts where drop_id = (select id from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003422')),
  'Notas legacy completas',
  'notas legacy migradas a drop_contacts por backfill productivo'
);

select is(
  (select cash_change_amount from public.delivery_request_drop_contacts where drop_id = (select id from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003422')),
  1500,
  'monto de cambio migrado a drop_contacts por backfill productivo'
);

-- H11: audit_log no expone monto privado exacto
select is(
  (select (before ? 'cash_change_amount') from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003425'),
  false,
  'audit_log no almacena clave cash_change_amount con monto privado exacto (H11)'
);

select is(
  (select (before->>'has_cash_change_amount')::boolean from public.audit_log where action = 'legacy_migration_inconsistent' and target_id = '30000000-0000-4000-8000-000000003425'),
  true,
  'audit_log preserva indicador booleano has_cash_change_amount (H11)'
);

-- H12: delivered_at original preservado, no inventado
select is(
  (select delivered_at from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003422'),
  (select delivered_at from public.delivery_requests where id = '30000000-0000-4000-8000-000000003422'),
  'historico delivered copia exactamente delivered_at original (H12)'
);

select is(
  (select count(*)::int from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003426'),
  0,
  'historico delivered sin delivered_at no materializa drop con fecha inventada (H12)'
);

-- ============================================================================
-- Paso 2: Lectores post-match desacoplados de columnas legacy
-- ============================================================================
create function pg_temp.test_readers_post_match() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003600';
  v_offer_id uuid := '30000000-0000-4000-8000-000000003601';
  v_drop_1_id uuid := '30000000-0000-4000-8000-000000003603';
  v_drop_2_id uuid := '30000000-0000-4000-8000-000000003604';
  v_drop_3_id uuid := '30000000-0000-4000-8000-000000003605';
begin
  -- Inserta request matched con columnas legacy en NULL y drops_count = 3
  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, dropoff_zone_id,
    package_type, recipient_payment_method, needs_change,
    cash_change_amount, notes, status, matched_at, accepted_offer_id, drops_count
  ) values (
    v_req_id, pg_temp.merchant_id(), pg_temp.pickup_zone_id(), pg_temp.dropoff_zone_id(),
    'chico', 'cash', true,
    null, null, 'matched', now(), v_offer_id, 3
  );

  insert into public.delivery_request_contacts (
    request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    v_req_id, 'Retiro 123', 'Entrega 456', 'Cliente Uno', '+5493865111111', true
  );

  insert into public.offers (
    id, request_id, courier_id, amount_ars, eta_minutes, status
  ) values (
    v_offer_id, v_req_id, pg_temp.courier_1_id(), 1500, 15, 'accepted'
  );

  -- Insertar en orden DESORDENADO: position 3, luego position 1, luego position 2
  -- Drop 3 (failed)
  insert into public.delivery_request_drops (
    id, request_id, position, dropoff_zone_id, package_type,
    recipient_payment_method, needs_change, status, failed_reason
  ) values (
    v_drop_3_id, v_req_id, 3, pg_temp.dropoff_zone_id(), 'mediano',
    'transfer', false, 'failed', 'No atendió'
  );
  insert into public.delivery_request_drop_contacts (
    drop_id, dropoff_address, recipient_name, recipient_phone,
    recipient_consent_declared, cash_change_amount, notes
  ) values (
    v_drop_3_id, 'Calle Tres 300', 'Cliente Tres', '+5493865333333',
    true, null, 'Nota drop 3'
  );

  -- Drop 1 (delivered)
  insert into public.delivery_request_drops (
    id, request_id, position, dropoff_zone_id, package_type,
    recipient_payment_method, needs_change, status, delivered_at
  ) values (
    v_drop_1_id, v_req_id, 1, pg_temp.dropoff_zone_id(), 'chico',
    'cash', true, 'delivered', now()
  );
  insert into public.delivery_request_drop_contacts (
    drop_id, dropoff_address, recipient_name, recipient_phone,
    recipient_consent_declared, cash_change_amount, notes
  ) values (
    v_drop_1_id, 'Entrega 456', 'Cliente Uno', '+5493865111111',
    true, 3500, 'Tocar timbre verde en drop_contacts'
  );

  -- Drop 2 (pending)
  insert into public.delivery_request_drops (
    id, request_id, position, dropoff_zone_id, package_type,
    recipient_payment_method, needs_change, status
  ) values (
    v_drop_2_id, v_req_id, 2, pg_temp.dropoff_zone_id(), 'chico',
    'cash', false, 'pending'
  );
  insert into public.delivery_request_drop_contacts (
    drop_id, dropoff_address, recipient_name, recipient_phone,
    recipient_consent_declared, cash_change_amount, notes
  ) values (
    v_drop_2_id, 'Calle Dos 200', 'Cliente Dos', '+5493865222222',
    true, null, 'Nota drop 2'
  );
end;
$$;
select pg_temp.test_readers_post_match();

-- 1. Repartidor aceptado llama a get_trip_details y recibe notas y monto desde drop_contacts
select pg_temp.act_as(pg_temp.courier_1_id());
select is(
  (public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->>'deliveryNotes'),
  'Tocar timbre verde en drop_contacts',
  'get_trip_details lee deliveryNotes desde drop_contacts cuando legacy es NULL'
);
select is(
  (public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->>'cashChangeAmount')::int,
  3500,
  'get_trip_details lee cashChangeAmount desde drop_contacts cuando legacy es NULL'
);
select is(
  (public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->>'dropsCount')::int,
  3,
  'get_trip_details devuelve dropsCount = 3'
);
select is(
  jsonb_array_length(public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'),
  3,
  'get_trip_details devuelve exactamente 3 drops en el array drops'
);
select is(
  (public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'->0->>'position')::int,
  1,
  'drops ordenado deterministicamente por position: primero position 1'
);
select is(
  (public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'->1->>'position')::int,
  2,
  'drops ordenado deterministicamente por position: segundo position 2'
);
select is(
  (public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'->2->>'position')::int,
  3,
  'drops ordenado deterministicamente por position: tercero position 3'
);
select is(
  public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'->0->>'status',
  'delivered',
  'drop 1 refleja status delivered'
);
select is(
  public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'->1->>'status',
  'pending',
  'drop 2 refleja status pending'
);
select is(
  public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'->2->>'status',
  'failed',
  'drop 3 refleja status failed'
);
select is(
  public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid)->'drops'->2->>'failedReason',
  'No atendió',
  'drop 3 refleja failedReason no atendió'
);

-- 2. Comercio dueño llama a get_merchant_request_private_fields y recibe notas y monto desde drop_contacts
select pg_temp.act_as(pg_temp.merchant_id());
select is(
  (public.get_merchant_request_private_fields('30000000-0000-4000-8000-000000003600'::uuid)->>'notes'),
  'Tocar timbre verde en drop_contacts',
  'get_merchant_request_private_fields lee notes desde drop_contacts cuando legacy es NULL'
);
select is(
  (public.get_merchant_request_private_fields('30000000-0000-4000-8000-000000003600'::uuid)->>'cashChangeAmount')::int,
  3500,
  'get_merchant_request_private_fields lee cashChangeAmount desde drop_contacts cuando legacy es NULL'
);

-- 3. Repartidor NO aceptado es rechazado por ambas RPCs
select pg_temp.act_as(pg_temp.courier_2_id());
select throws_matching(
  $$ select public.get_trip_details('30000000-0000-4000-8000-000000003600'::uuid) $$,
  'UNAUTHORIZED_ACTOR',
  'repartidor no aceptado es rechazado por get_trip_details'
);
select throws_matching(
  $$ select public.get_merchant_request_private_fields('30000000-0000-4000-8000-000000003600'::uuid) $$,
  'UNAUTHORIZED_ACTOR',
  'repartidor no aceptado es rechazado por get_merchant_request_private_fields'
);

select pg_temp.reset_actor();

rollback;
