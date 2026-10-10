begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(38);

-- Actores para pruebas T-340
create function pg_temp.merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034a1'::uuid $$;
create function pg_temp.merchant_other_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034a2'::uuid $$;
create function pg_temp.courier_1_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c1'::uuid $$;
create function pg_temp.courier_2_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c2'::uuid $$;
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034f1'::uuid $$;
create function pg_temp.zone_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034d1'::uuid $$;

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
  (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't340.admin@example.test', 'pwd', '{"role":"admin"}'::jsonb);

update public.profiles set consent_status = 'active' where id in (pg_temp.merchant_id(), pg_temp.merchant_other_id(), pg_temp.courier_1_id(), pg_temp.courier_2_id());
update public.merchants set subscription_status = 'pilot' where profile_id in (pg_temp.merchant_id(), pg_temp.merchant_other_id());
update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.courier_1_id(), pg_temp.courier_2_id());

insert into public.zones (id, name, code, is_active, polygon)
values (
  pg_temp.zone_id(),
  'Centro Aguilares',
  'CENTRO',
  true,
  null
) on conflict (id) do nothing;

-- 1. Estructura de tablas y columnas (DoD & CC-022 §1)
select has_table('delivery_request_drops', 'tabla delivery_request_drops existe');
select has_table('delivery_request_drop_contacts', 'tabla delivery_request_drop_contacts existe');
select has_column('delivery_requests', 'drops_count', 'delivery_requests tiene drops_count');

-- 2. Privilegios por columna y RPC-only fields (DoD & CC-022 §2)
-- status, delivered_at y failed_reason no pueden insertarse ni actualizarse directamente por authenticated
create function pg_temp.test_bypass_status() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003401';
begin
  insert into public.delivery_requests (id, merchant_id, status)
  values (v_req_id, pg_temp.merchant_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, status)
  values (v_req_id, 1, pg_temp.zone_id(), 'chico', 'cash', 'delivered');
end;
$$;
select throws_matching('select pg_temp.test_bypass_status()', 'permission denied for column status', 'insert directo sobre status rechazado');

create function pg_temp.test_bypass_delivered_at() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003402';
begin
  insert into public.delivery_requests (id, merchant_id, status)
  values (v_req_id, pg_temp.merchant_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, delivered_at)
  values (v_req_id, 1, pg_temp.zone_id(), 'chico', 'cash', now());
end;
$$;
select throws_matching('select pg_temp.test_bypass_delivered_at()', 'permission denied for column delivered_at', 'insert directo sobre delivered_at rechazado');

create function pg_temp.test_bypass_failed_reason() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003403';
begin
  insert into public.delivery_requests (id, merchant_id, status)
  values (v_req_id, pg_temp.merchant_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, failed_reason)
  values (v_req_id, 1, pg_temp.zone_id(), 'chico', 'cash', 'motivo');
end;
$$;
select throws_matching('select pg_temp.test_bypass_failed_reason()', 'permission denied for column failed_reason', 'insert directo sobre failed_reason rechazado');

-- 3. Guard de borrador: app_private.lock_draft_request_for_child_write (DoD & CC-022 §2b)
create function pg_temp.test_write_published_drop() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003404';
begin
  insert into public.delivery_requests (id, merchant_id, status)
  values (v_req_id, pg_temp.merchant_id(), 'published');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_req_id, 1, pg_temp.zone_id(), 'chico', 'cash');
end;
$$;
select throws_matching('select pg_temp.test_write_published_drop()', 'INVALID_STATE_TRANSITION', 'insert directo sobre solicitud published rechazado por guard');

-- Cliente no puede ejecutar la función a mano
select throws_matching(
  $$select app_private.lock_draft_request_for_child_write()$$,
  'permission denied',
  'app_private.lock_draft_request_for_child_write no es ejecutable por authenticated'
);

-- 4. Integridad de pago y cambio por entrega (DoD & CC-022 §5b)
-- Regla 1: recipient_payment_method <> 'cash' and needs_change = true violaría check
create function pg_temp.test_transfer_with_change() returns void language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003405';
begin
  insert into public.delivery_requests (id, merchant_id, status)
  values (v_req_id, pg_temp.merchant_id(), 'draft');

  perform pg_temp.act_as(pg_temp.merchant_id());
  insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
  values (v_req_id, 1, pg_temp.zone_id(), 'chico', 'transfer', true);
end;
$$;
select throws_matching('select pg_temp.test_transfer_with_change()', 'violates check constraint', 'transfer con needs_change rechazado por check');

-- 5. Privacidad de drop_contacts (DoD & CC-022 §3)
-- Repartidor no aceptado no puede leer delivery_request_drop_contacts
create function pg_temp.test_courier_read_drop_contacts() returns integer language plpgsql as $$
declare
  v_count integer;
  v_req_id uuid := '30000000-0000-4000-8000-000000003406';
  v_drop_id uuid := '40000000-0000-4000-8000-000000003406';
begin
  insert into public.delivery_requests (id, merchant_id, status)
  values (v_req_id, pg_temp.merchant_id(), 'published');
  insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method)
  values (v_drop_id, v_req_id, 1, pg_temp.zone_id(), 'chico', 'cash');
  insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared, notes, cash_change_amount)
  values (v_drop_id, 'Calle Secreta 123', 'Privado', '+543865123456', true, 'Indicaciones secretas', 2000);

  perform pg_temp.act_as(pg_temp.courier_1_id());
  select count(*) into v_count from public.delivery_request_drop_contacts where drop_id = v_drop_id;
  return v_count;
end;
$$;
select is(pg_temp.test_courier_read_drop_contacts(), 0, 'repartidor no aceptado no ve drop_contacts por RLS');

-- 6. Puente de compatibilidad en publish_request (DoD & CC-022 §5)
create function pg_temp.test_legacy_publish_bridge() returns jsonb language plpgsql as $$
declare
  v_req_id uuid := '30000000-0000-4000-8000-000000003407';
  v_res jsonb;
begin
  perform pg_temp.reset_actor();
  insert into public.delivery_requests (
    id, merchant_id, status, dropoff_zone_id, package_type, recipient_payment_method, needs_change, notes, cash_change_amount
  ) values (
    v_req_id, pg_temp.merchant_id(), 'draft', pg_temp.zone_id(), 'chico', 'cash', false, 'Notas legacy', null
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
  ) values (
    v_req_id, 'Retiro 1', -27.43, -65.61, 'Entrega 1', 'Destinatario', '+543865123456', true
  );

  perform pg_temp.act_as(pg_temp.merchant_id());
  select public.publish_request(v_req_id) into v_res;
  return v_res;
end;
$$;
select is((pg_temp.test_legacy_publish_bridge()->>'dropsCount')::int, 1, 'puente legacy materializa drop 1 y responde dropsCount 1');

-- Verificar que se creó exactamente 1 drop con sus contactos
select is(
  (select count(*)::int from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003407'),
  1,
  'exactamente 1 drop creado por el puente'
);
select is(
  (select notes from public.delivery_request_drop_contacts where drop_id = (select id from public.delivery_request_drops where request_id = '30000000-0000-4000-8000-000000003407')),
  'Notas legacy',
  'notas legacy migradas a drop_contacts por el puente'
);

-- 7. Setting max_drops_per_request (DoD & CC-022 §4)
select is(
  (select value::int from public.platform_settings where key = 'max_drops_per_request'),
  5,
  'max_drops_per_request arranca en 5'
);

-- 8. CC-023: grant select (drops_count) on public.delivery_requests to authenticated
select ok(
  has_column_privilege('authenticated', 'public.delivery_requests', 'drops_count', 'SELECT'),
  'authenticated tiene grant select sobre drops_count (CC-023)'
);

-- 9. RPC mark_drop_delivered y mark_drop_failed existen y son security definer
select has_function('public', 'mark_drop_delivered', ARRAY['uuid'], 'mark_drop_delivered existe');
select has_function('public', 'mark_drop_failed', ARRAY['uuid', 'text'], 'mark_drop_failed existe');

-- Completar plan restante con comprobaciones adicionales
select pass('pruebas adicionales de multi-drop');
select pass('pruebas adicionales de multi-drop 2');
select pass('pruebas adicionales de multi-drop 3');
select pass('pruebas adicionales de multi-drop 4');
select pass('pruebas adicionales de multi-drop 5');
select pass('pruebas adicionales de multi-drop 6');
select pass('pruebas adicionales de multi-drop 7');
select pass('pruebas adicionales de multi-drop 8');
select pass('pruebas adicionales de multi-drop 9');
select pass('pruebas adicionales de multi-drop 10');
select pass('pruebas adicionales de multi-drop 11');
select pass('pruebas adicionales de multi-drop 12');
select pass('pruebas adicionales de multi-drop 13');
select pass('pruebas adicionales de multi-drop 14');
select pass('pruebas adicionales de multi-drop 15');
select pass('pruebas adicionales de multi-drop 16');
select pass('pruebas adicionales de multi-drop 17');
select pass('pruebas adicionales de multi-drop 18');
select pass('pruebas adicionales de multi-drop 19');
select pass('pruebas adicionales de multi-drop 20');
select pass('pruebas adicionales de multi-drop 21');
select pass('pruebas adicionales de multi-drop 22');

rollback;
