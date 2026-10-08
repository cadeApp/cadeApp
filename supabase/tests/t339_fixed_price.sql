begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(45);

-- Actores para pruebas T-339
create function pg_temp.merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033a1'::uuid $$;
create function pg_temp.courier_1_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c1'::uuid $$;
create function pg_temp.courier_2_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c2'::uuid $$;
create function pg_temp.courier_pending_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c3'::uuid $$;
create function pg_temp.courier_suspended_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c4'::uuid $$;
create function pg_temp.courier_consent_pending_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c5'::uuid $$;
create function pg_temp.courier_reconsent_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c6'::uuid $$;
create function pg_temp.courier_unavailable_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c7'::uuid $$;

-- Zonas
create function pg_temp.zone_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033d1'::uuid $$;

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
  (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.merchant@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.courier1@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.courier2@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_pending_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.cpending@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_suspended_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.csuspended@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_consent_pending_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.cconsent@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_reconsent_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.creconsent@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_unavailable_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.cunavailable@example.test', 'pwd', '{"role":"courier"}'::jsonb);

-- Configurar perfiles y roles
update public.profiles set consent_status = 'active' where id in (pg_temp.merchant_id(), pg_temp.courier_1_id(), pg_temp.courier_2_id(), pg_temp.courier_pending_id(), pg_temp.courier_suspended_id(), pg_temp.courier_unavailable_id());
update public.profiles set consent_status = 'pending' where id = pg_temp.courier_consent_pending_id();
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.courier_reconsent_id();

update public.merchants set subscription_status = 'pilot' where profile_id = pg_temp.merchant_id();

update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.courier_1_id(), pg_temp.courier_2_id(), pg_temp.courier_consent_pending_id(), pg_temp.courier_reconsent_id());
update public.couriers set status = 'approved', available = false where profile_id = pg_temp.courier_unavailable_id();
update public.couriers set status = 'pending', available = true where profile_id = pg_temp.courier_pending_id();
update public.couriers set status = 'suspended', available = true where profile_id = pg_temp.courier_suspended_id();

-- Zona activa en Aguilares
insert into public.zones (id, name, active, centroid_lat, centroid_lng)
values (pg_temp.zone_id(), 'Centro Aguilares', true, -27.4333, -27.4333);
update public.zones set centroid_lng = -65.6133 where id = pg_temp.zone_id();

-- 1. Constraint: auto_assign sin fixed_price_ars es rechazado
select throws_ok(
  $$
  insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, fixed_price_ars, auto_assign)
  values (pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', null, true);
  $$,
  '23514',
  null,
  'Constraint delivery_requests_auto_assign_requires_price rechaza auto_assign=true sin fixed_price_ars'
);

-- Solicitudes para bordes de piso 999, 1000, 1001
create function pg_temp.req_p999() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033b1'::uuid $$;
create function pg_temp.req_p1000() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033b2'::uuid $$;
create function pg_temp.req_p1001() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033b3'::uuid $$;

insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, fixed_price_ars, auto_assign)
values
  (pg_temp.req_p999(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 999, true),
  (pg_temp.req_p1000(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1000, true),
  (pg_temp.req_p1001(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1001, true);

insert into public.delivery_request_contacts (request_id, recipient_consent_declared, pickup_address, dropoff_address, recipient_name, recipient_phone, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
values
  (pg_temp.req_p999(), true, 'San Martín 100', 'Mitre 200', 'C1', '3865111111', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_p1000(), true, 'San Martín 100', 'Mitre 200', 'C2', '3865111112', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_p1001(), true, 'San Martín 100', 'Mitre 200', 'C3', '3865111113', -27.4333, -65.6133, -27.4333, -65.6133);

-- 2, 3, 4: publish_request bordes con piso base (1000)
select pg_temp.act_as(pg_temp.merchant_id());
select throws_ok(
  $$ select public.publish_request(pg_temp.req_p999()) $$,
  'P0001',
  'OFFER_BELOW_MINIMUM',
  'publish_request con precio 999 < 1000 rechaza con OFFER_BELOW_MINIMUM'
);

select is(
  (public.publish_request(pg_temp.req_p1000()) ->> 'fixedPriceArs')::integer,
  1000,
  'publish_request con precio exacto al piso 1000 es exitoso'
);

select is(
  (public.publish_request(pg_temp.req_p1001()) ->> 'fixedPriceArs')::integer,
  1001,
  'publish_request con precio 1001 > piso 1000 es exitoso'
);

-- Modificar temporalmente min_offer_ars a 1500 y probar bordes 1499, 1500, 1501 (H04)
select pg_temp.reset_actor();
update public.platform_settings set value = '1500'::jsonb where key = 'min_offer_ars';

create function pg_temp.req_p1499() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033b4'::uuid $$;
create function pg_temp.req_p1500() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033b5'::uuid $$;
create function pg_temp.req_p1501() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033b6'::uuid $$;

insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, fixed_price_ars, auto_assign)
values
  (pg_temp.req_p1499(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1499, true),
  (pg_temp.req_p1500(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1500, true),
  (pg_temp.req_p1501(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1501, true);

insert into public.delivery_request_contacts (request_id, recipient_consent_declared, pickup_address, dropoff_address, recipient_name, recipient_phone, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
values
  (pg_temp.req_p1499(), true, 'San Martín 100', 'Mitre 200', 'C4', '3865111114', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_p1500(), true, 'San Martín 100', 'Mitre 200', 'C5', '3865111115', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_p1501(), true, 'San Martín 100', 'Mitre 200', 'C6', '3865111116', -27.4333, -65.6133, -27.4333, -65.6133);

select pg_temp.act_as(pg_temp.merchant_id());
-- 5, 6, 7: publish_request bordes con piso modificado (1500)
select throws_ok(
  $$ select public.publish_request(pg_temp.req_p1499()) $$,
  'P0001',
  'OFFER_BELOW_MINIMUM',
  'publish_request con precio 1499 < piso dinámico 1500 rechaza con OFFER_BELOW_MINIMUM'
);

select is(
  (public.publish_request(pg_temp.req_p1500()) ->> 'fixedPriceArs')::integer,
  1500,
  'publish_request con precio exacto al piso dinámico 1500 es exitoso'
);

select is(
  (public.publish_request(pg_temp.req_p1501()) ->> 'fixedPriceArs')::integer,
  1501,
  'publish_request con precio 1501 > piso dinámico 1500 es exitoso'
);

-- Restaurar piso a 1000
select pg_temp.reset_actor();
update public.platform_settings set value = '1000'::jsonb where key = 'min_offer_ars';

-- Crear solicitudes principales
create function pg_temp.req_fixed_auto() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033e2'::uuid $$;
create function pg_temp.req_fixed_manual() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033e3'::uuid $$;
create function pg_temp.req_open() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033e4'::uuid $$;

insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, fixed_price_ars, auto_assign)
values
  (pg_temp.req_fixed_auto(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1500, true),
  (pg_temp.req_fixed_manual(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1500, false),
  (pg_temp.req_open(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', null, false);

insert into public.delivery_request_contacts (request_id, recipient_consent_declared, pickup_address, dropoff_address, recipient_name, recipient_phone, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
values
  (pg_temp.req_fixed_auto(), true, 'San Martín 100', 'Mitre 200', 'Cliente 2', '3865111112', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_fixed_manual(), true, 'San Martín 100', 'Mitre 200', 'Cliente 3', '3865111113', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_open(), true, 'San Martín 100', 'Mitre 200', 'Cliente 4', '3865111114', -27.4333, -65.6133, -27.4333, -65.6133);

-- 8, 9, 10: publish_request con autoAssign y sin precio
select pg_temp.act_as(pg_temp.merchant_id());
select is(
  (public.publish_request(pg_temp.req_fixed_auto()) ->> 'autoAssign')::boolean,
  true,
  'publish_request devuelve autoAssign true cuando se activó el switch'
);

select is(
  (public.publish_request(pg_temp.req_fixed_manual()) ->> 'autoAssign')::boolean,
  false,
  'publish_request devuelve autoAssign false cuando no se activó el switch'
);

select lives_ok(
  $$ select public.publish_request(pg_temp.req_open()) $$,
  'publish_request sin precio sigue funcionando igual que antes'
);

-- 11, 12: Inmutabilidad de fixed_price_ars y auto_assign por RLS fuera de draft
select throws_ok(
  $$
  update public.delivery_requests
  set fixed_price_ars = 2000
  where id = pg_temp.req_fixed_auto();
  $$,
  '42501',
  null,
  'RLS delivery_requests_update_merchant rechaza modificar fixed_price_ars una vez publicada la solicitud'
);

select throws_ok(
  $$
  update public.delivery_requests
  set auto_assign = false
  where id = pg_temp.req_fixed_auto();
  $$,
  '42501',
  null,
  'RLS delivery_requests_update_merchant rechaza modificar auto_assign una vez publicada la solicitud'
);

-- 13, 14: Incompatibilidad de flujos
select pg_temp.act_as(pg_temp.courier_1_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_fixed_auto(), 1500, 15, 'Oferta sobre precio fijo') $$,
  'P0001',
  'FIXED_PRICE_REQUEST',
  'submit_offer sobre solicitud con precio fijo rechaza con FIXED_PRICE_REQUEST'
);

select throws_ok(
  $$ select public.take_request(pg_temp.req_open(), 15, null) $$,
  'P0001',
  'NO_FIXED_PRICE',
  'take_request sobre solicitud sin precio rechaza con NO_FIXED_PRICE'
);

-- 15, 16: Cross-idempotency protection (H03 en SQL)
-- Courier 1 hace submit_offer sobre solicitud sin precio (req_open)
select lives_ok(
  $$ select public.submit_offer(pg_temp.req_open(), 1200, 15, 'Oferta abierta') $$,
  'Courier 1 envía oferta legítima a solicitud sin precio'
);
-- Con oferta pending, take_request sobre req_open debe fallar con NO_FIXED_PRICE
select throws_ok(
  $$ select public.take_request(pg_temp.req_open(), 15, null) $$,
  'P0001',
  'NO_FIXED_PRICE',
  'take_request sobre solicitud sin precio rechaza NO_FIXED_PRICE aun con oferta propia pending previa'
);

-- Merchant acepta esa oferta de Courier 1 -> solicitud sin precio queda matched
select pg_temp.act_as(pg_temp.merchant_id());
select lives_ok(
  $$ select public.accept_offer((select id from public.offers where request_id = pg_temp.req_open() and courier_id = pg_temp.courier_1_id())) $$,
  'Merchant acepta oferta de req_open'
);

-- Con oferta accepted, take_request sobre req_open debe fallar con NO_FIXED_PRICE
select pg_temp.act_as(pg_temp.courier_1_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_open(), 15, null) $$,
  'P0001',
  'NO_FIXED_PRICE',
  'take_request sobre solicitud sin precio rechaza NO_FIXED_PRICE aun con oferta propia accepted previa'
);

-- 17, 18, 19, 20, 21, 22, 23: Consent gate CC-007 y cero efectos (H05)
select pg_temp.act_as(pg_temp.courier_consent_pending_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_manual(), 15, null) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'take_request con consentimiento pending rechaza con UNAUTHORIZED_ACTOR'
);

select pg_temp.act_as(pg_temp.courier_reconsent_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_manual(), 15, null) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'take_request con consentimiento reconsent_required rechaza con UNAUTHORIZED_ACTOR'
);

select is(
  (select count(*)::integer from public.offers where courier_id = pg_temp.courier_consent_pending_id()),
  0,
  'Fallo de consent pending no genera filas en offers'
);

select is(
  (select count(*)::integer from public.offers where courier_id = pg_temp.courier_reconsent_id()),
  0,
  'Fallo de consent reconsent no genera filas en offers'
);

select is(
  (select status from public.delivery_requests where id = pg_temp.req_fixed_manual()),
  'published'::public.delivery_request_status,
  'Fallo de consent no altera status de la solicitud'
);

select is(
  (select accepted_offer_id from public.delivery_requests where id = pg_temp.req_fixed_manual()),
  null,
  'Fallo de consent no asigna accepted_offer_id'
);

select is(
  (select count(*)::integer from public.rate_limits where subject in (pg_temp.courier_consent_pending_id()::text, pg_temp.courier_reconsent_id()::text)),
  0,
  'Fallo de consent no consume rate_limits'
);

-- 24, 25, 26: Repartidor no elegible (H05)
select pg_temp.act_as(pg_temp.courier_suspended_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_manual(), 15, null) $$,
  'P0001',
  'COURIER_SUSPENDED',
  'take_request con courier suspended rechaza con COURIER_SUSPENDED'
);

select pg_temp.act_as(pg_temp.courier_pending_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_manual(), 15, null) $$,
  'P0001',
  'COURIER_NOT_APPROVED',
  'take_request con courier pending rechaza con COURIER_NOT_APPROVED'
);

select pg_temp.act_as(pg_temp.courier_unavailable_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_manual(), 15, null) $$,
  'P0001',
  'COURIER_UNAVAILABLE',
  'take_request con courier available=false rechaza con COURIER_UNAVAILABLE'
);

-- 27: Piso sube después de publicar y take_request responde OFFER_BELOW_MINIMUM
select pg_temp.reset_actor();
update public.platform_settings set value = '2000'::jsonb where key = 'min_offer_ars';

select pg_temp.act_as(pg_temp.courier_1_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_manual(), 15, null) $$,
  'P0001',
  'OFFER_BELOW_MINIMUM',
  'take_request responde OFFER_BELOW_MINIMUM si el piso subió por encima del precio fijo'
);

select pg_temp.reset_actor();
update public.platform_settings set value = '1000'::jsonb where key = 'min_offer_ars';

-- 28, 29, 30, 31: take_request con auto_assign = false
select pg_temp.act_as(pg_temp.courier_1_id());
select is(
  (public.take_request(pg_temp.req_fixed_manual(), 15, null) ->> 'offerStatus'),
  'pending',
  'take_request con auto_assign=false crea oferta con offerStatus pending'
);

select is(
  (select status from public.delivery_requests where id = pg_temp.req_fixed_manual()),
  'published'::public.delivery_request_status,
  'take_request con auto_assign=false mantiene la solicitud en published'
);

select is(
  (public.take_request(pg_temp.req_fixed_manual(), 15, null) ->> 'idempotent')::boolean,
  true,
  'Reintento de take_request con auto_assign=false devuelve idempotent true'
);

select is(
  (select count(*)::integer from public.offers where request_id = pg_temp.req_fixed_manual() and courier_id = pg_temp.courier_1_id()),
  1,
  'Idempotencia: no se crean ofertas duplicadas en take_request'
);

-- 32, 33, 34, 35: take_request con auto_assign = true
select is(
  (public.take_request(pg_temp.req_fixed_auto(), 20, null) ->> 'offerStatus'),
  'accepted',
  'take_request con auto_assign=true devuelve offerStatus accepted'
);

select is(
  (select status from public.delivery_requests where id = pg_temp.req_fixed_auto()),
  'matched'::public.delivery_request_status,
  'take_request con auto_assign=true pasa la solicitud a matched al instante'
);

select is(
  (public.take_request(pg_temp.req_fixed_auto(), 20, null) ->> 'idempotent')::boolean,
  true,
  'Reintento del ganador devuelve idempotent true'
);

select pg_temp.act_as(pg_temp.courier_2_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_auto(), 15, null) $$,
  'P0001',
  'ALREADY_MATCHED',
  'Otro repartidor intentando tomar una solicitud ya matched recibe ALREADY_MATCHED'
);

-- 36, 37: Seguridad app_private.match_offer
select throws_ok(
  $$ select app_private.match_offer(pg_temp.req_fixed_auto(), (select id from public.offers limit 1)) $$,
  '42501',
  null,
  'authenticated no tiene permiso de ejecución sobre app_private.match_offer'
);

select pg_temp.reset_actor();
set local role anon;
select throws_ok(
  $$ select app_private.match_offer(pg_temp.req_fixed_auto(), (select id from public.offers limit 1)) $$,
  '42501',
  null,
  'anon no tiene permiso de ejecución sobre app_private.match_offer'
);

-- 38, 39, 40, 41: accept_offer público con nuevo orden de locks (H02)
select pg_temp.act_as(pg_temp.merchant_id());
select is(
  (public.accept_offer((select id from public.offers where request_id = pg_temp.req_fixed_manual() and courier_id = pg_temp.courier_1_id())) ->> 'status'),
  'matched',
  'accept_offer público funciona correctamente usando app_private.match_offer'
);

select is(
  (select status from public.delivery_requests where id = pg_temp.req_fixed_manual()),
  'matched'::public.delivery_request_status,
  'Solicitud pasa a matched tras accept_offer'
);

select is(
  (public.accept_offer((select id from public.offers where request_id = pg_temp.req_fixed_manual() and courier_id = pg_temp.courier_1_id())) ->> 'idempotent')::boolean,
  true,
  'Reintento de accept_offer devuelve idempotent true'
);

-- Crear otra oferta en solicitud ya matched para verificar rechazo sin deadlock
create function pg_temp.other_offer_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033f1'::uuid $$;
insert into public.offers (id, request_id, courier_id, amount_ars, status, eta_minutes)
values (pg_temp.other_offer_id(), pg_temp.req_fixed_manual(), pg_temp.courier_2_id(), 1500, 'pending', 15);

select throws_ok(
  $$ select public.accept_offer(pg_temp.other_offer_id()) $$,
  'P0001',
  'ALREADY_MATCHED',
  'accept_offer sobre solicitud ya matched con otra oferta responde ALREADY_MATCHED'
);

-- 42, 43: Carrera / Concurrencia de toma y cero residuales (H05)
create function pg_temp.req_race() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033f2'::uuid $$;
insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, fixed_price_ars, auto_assign)
values (pg_temp.req_race(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1500, true);

insert into public.delivery_request_contacts (request_id, recipient_consent_declared, pickup_address, dropoff_address, recipient_name, recipient_phone, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
values (pg_temp.req_race(), true, 'San Martín 100', 'Mitre 200', 'Cliente Race', '3865111199', -27.4333, -65.6133, -27.4333, -65.6133);

select pg_temp.act_as(pg_temp.merchant_id());
do $$ begin perform public.publish_request(pg_temp.req_race()); end; $$;

-- Courier 1 toma req_race primero
select pg_temp.act_as(pg_temp.courier_1_id());
do $$ begin perform public.take_request(pg_temp.req_race(), 15, null); end; $$;

-- Exactamente una oferta aceptada y cero ofertas pending residuales
select is(
  (select count(*)::integer from public.offers where request_id = pg_temp.req_race() and status = 'accepted'),
  1,
  'Carrera: exactamente una oferta aceptada en la solicitud'
);

select is(
  (select count(*)::integer from public.offers where request_id = pg_temp.req_race() and status = 'pending'),
  0,
  'Carrera: cero ofertas pending residuales tras match atómico'
);

select * from finish();

rollback;
