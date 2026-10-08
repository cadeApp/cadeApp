begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(28);

-- Actores para pruebas T-339
create function pg_temp.merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033a1'::uuid $$;
create function pg_temp.courier_1_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c1'::uuid $$;
create function pg_temp.courier_2_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c2'::uuid $$;
create function pg_temp.courier_pending_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c3'::uuid $$;
create function pg_temp.courier_suspended_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c4'::uuid $$;
create function pg_temp.courier_consent_pending_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c5'::uuid $$;
create function pg_temp.courier_reconsent_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c6'::uuid $$;

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
  (pg_temp.courier_reconsent_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't339.creconsent@example.test', 'pwd', '{"role":"courier"}'::jsonb);

-- Configurar perfiles y roles
update public.profiles set consent_status = 'active' where id in (pg_temp.merchant_id(), pg_temp.courier_1_id(), pg_temp.courier_2_id(), pg_temp.courier_pending_id(), pg_temp.courier_suspended_id());
update public.profiles set consent_status = 'pending' where id = pg_temp.courier_consent_pending_id();
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.courier_reconsent_id();

update public.merchants set subscription_status = 'pilot' where profile_id = pg_temp.merchant_id();

update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.courier_1_id(), pg_temp.courier_2_id(), pg_temp.courier_consent_pending_id(), pg_temp.courier_reconsent_id());
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

-- Crear solicitudes para pruebas
create function pg_temp.req_low_price() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033e1'::uuid $$;
create function pg_temp.req_fixed_auto() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033e2'::uuid $$;
create function pg_temp.req_fixed_manual() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033e3'::uuid $$;
create function pg_temp.req_open() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033e4'::uuid $$;

insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, fixed_price_ars, auto_assign)
values
  (pg_temp.req_low_price(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 999, true),
  (pg_temp.req_fixed_auto(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1500, true),
  (pg_temp.req_fixed_manual(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', 1500, false),
  (pg_temp.req_open(), pg_temp.merchant_id(), pg_temp.zone_id(), pg_temp.zone_id(), 'chico', 'cash', null, false);

insert into public.delivery_request_contacts (request_id, recipient_consent_declared, pickup_address, dropoff_address, recipient_name, recipient_phone, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
values
  (pg_temp.req_low_price(), true, 'San Martín 100', 'Mitre 200', 'Cliente 1', '3865111111', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_fixed_auto(), true, 'San Martín 100', 'Mitre 200', 'Cliente 2', '3865111112', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_fixed_manual(), true, 'San Martín 100', 'Mitre 200', 'Cliente 3', '3865111113', -27.4333, -65.6133, -27.4333, -65.6133),
  (pg_temp.req_open(), true, 'San Martín 100', 'Mitre 200', 'Cliente 4', '3865111114', -27.4333, -65.6133, -27.4333, -65.6133);

-- 2. publish_request con precio menor a min_offer_ars (1000) falla con OFFER_BELOW_MINIMUM
select pg_temp.act_as(pg_temp.merchant_id());
select throws_ok(
  $$ select public.publish_request(pg_temp.req_low_price()) $$,
  'P0001',
  'OFFER_BELOW_MINIMUM',
  'publish_request con fixed_price_ars < min_offer_ars devuelve OFFER_BELOW_MINIMUM'
);

-- 3. publish_request exitoso devuelve fixedPriceArs y autoAssign en el JSON
select is(
  (public.publish_request(pg_temp.req_fixed_auto()) ->> 'fixedPriceArs')::integer,
  1500,
  'publish_request devuelve fixedPriceArs en el JSON de salida'
);

select is(
  (select public.publish_request(pg_temp.req_fixed_manual()) ->> 'autoAssign')::boolean,
  false,
  'publish_request devuelve autoAssign false cuando no se activó el switch'
);

select lives_ok(
  $$ select public.publish_request(pg_temp.req_open()) $$,
  'publish_request sin precio sigue funcionando igual que antes'
);

-- 4. RLS: fixed_price_ars y auto_assign inmutables fuera de draft
select pg_temp.act_as(pg_temp.merchant_id());
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

-- 5. submit_offer sobre solicitud con precio fijo rechaza con FIXED_PRICE_REQUEST
select pg_temp.act_as(pg_temp.courier_1_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_fixed_auto(), 1500, 15, 'Oferta sobre precio fijo') $$,
  'P0001',
  'FIXED_PRICE_REQUEST',
  'submit_offer sobre solicitud con precio fijo rechaza con FIXED_PRICE_REQUEST'
);

-- 6. take_request sobre solicitud sin precio rechaza con NO_FIXED_PRICE
select throws_ok(
  $$ select public.take_request(pg_temp.req_open(), 15, null) $$,
  'P0001',
  'NO_FIXED_PRICE',
  'take_request sobre solicitud sin precio rechaza con NO_FIXED_PRICE'
);

-- 7. CC-007 Consent gate en take_request: pending y reconsent_required rechazan con UNAUTHORIZED_ACTOR
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

-- Cero efectos parciales tras fallo de consent gate
select is(
  (select count(*)::integer from public.offers where courier_id = pg_temp.courier_consent_pending_id()),
  0,
  'Fallo de consent gate no genera filas en offers'
);

-- 8. Repartidor no elegible: suspended o pending rechazan
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

-- 9. Piso sube después de publicar y take_request responde OFFER_BELOW_MINIMUM
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

-- 10. take_request con auto_assign = false: crea oferta pending, solicitud sigue published
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

-- 11. Idempotencia con auto_assign = false: reintento devuelve oferta propia con idempotent: true
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

-- 12. take_request con auto_assign = true: match atómico instantáneo
select pg_temp.act_as(pg_temp.courier_1_id());
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

-- 13. Idempotencia del ganador (auto_assign = true): reintento devuelve idempotent: true
select is(
  (public.take_request(pg_temp.req_fixed_auto(), 20, null) ->> 'idempotent')::boolean,
  true,
  'Reintento del ganador devuelve idempotent true'
);

-- 14. Otro repartidor intenta tomar la solicitud matched: responde ALREADY_MATCHED
select pg_temp.act_as(pg_temp.courier_2_id());
select throws_ok(
  $$ select public.take_request(pg_temp.req_fixed_auto(), 15, null) $$,
  'P0001',
  'ALREADY_MATCHED',
  'Otro repartidor intentando tomar una solicitud ya matched recibe ALREADY_MATCHED'
);

-- 15. Seguridad: app_private.match_offer no es ejecutable directamente por anon ni authenticated
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

-- 16. accept_offer sigue funcionando a través de su RPC pública sobre app_private.match_offer
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

select * from finish();

rollback;
