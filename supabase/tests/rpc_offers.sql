begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(43);

-- IDs de actores para pruebas de T-101
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011a1'::uuid $$;
create function pg_temp.merchant_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011b1'::uuid $$;
create function pg_temp.courier_approved_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011c1'::uuid $$;
create function pg_temp.courier_approved_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011c2'::uuid $$;
create function pg_temp.courier_pending_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011c3'::uuid $$;
create function pg_temp.courier_rejected_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011c4'::uuid $$;
create function pg_temp.courier_suspended_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011c5'::uuid $$;
create function pg_temp.courier_unavailable_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000011c6'::uuid $$;

-- IDs de solicitudes
create function pg_temp.req_pub_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001201'::uuid $$;
create function pg_temp.req_pub_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001202'::uuid $$;
create function pg_temp.req_pub_3_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001203'::uuid $$;
create function pg_temp.req_expired_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001204'::uuid $$;
create function pg_temp.req_draft_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000001205'::uuid $$;

create function pg_temp.find_offer_id(p_req_id uuid, p_courier_id uuid)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select id from public.offers where request_id = p_req_id and courier_id = p_courier_id order by created_at desc limit 1;
$$;

create function pg_temp.act_as(role_name text, actor_id uuid default null)
returns void
language plpgsql
as $$
begin
  if role_name = 'anon' then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

create function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Setup de datos de prueba como superusuario
do $$
declare
  v_zone_id uuid;
begin
  select id into v_zone_id from public.zones where active limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-t101@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm1-t101@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.courier_approved_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c-app1-t101@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_approved_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c-app2-t101@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_pending_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c-pend-t101@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_rejected_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c-rej-t101@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_suspended_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c-susp-t101@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_unavailable_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c-unav-t101@example.test', 'pwd', '{"role": "courier"}');

  update public.profiles set role = 'admin' where id = pg_temp.admin_id();

  update public.couriers set status = 'approved', available = true
  where profile_id in (pg_temp.courier_approved_1_id(), pg_temp.courier_approved_2_id());

  update public.couriers set status = 'pending', available = true
  where profile_id = pg_temp.courier_pending_id();

  update public.couriers set status = 'rejected', available = true
  where profile_id = pg_temp.courier_rejected_id();

  update public.couriers set status = 'suspended', available = true
  where profile_id = pg_temp.courier_suspended_id();

  update public.couriers set status = 'approved', available = false
  where profile_id = pg_temp.courier_unavailable_id();

  -- Asegurar piso inicial en 1000 ARS desde platform_settings
  insert into public.platform_settings (key, value)
  values ('min_offer_ars', '1000'::jsonb)
  on conflict (key) do update set value = '1000'::jsonb;

  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status, expires_at)
  values
    (pg_temp.req_pub_1_id(), pg_temp.merchant_1_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published', now() + interval '30 minutes'),
    (pg_temp.req_pub_2_id(), pg_temp.merchant_1_id(), v_zone_id, v_zone_id, 'mediano', 'transfer', 'published', now() + interval '30 minutes'),
    (pg_temp.req_pub_3_id(), pg_temp.merchant_1_id(), v_zone_id, v_zone_id, 'grande', 'cash', 'published', now() + interval '30 minutes'),
    (pg_temp.req_expired_id(), pg_temp.merchant_1_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published', now() - interval '1 minute'),
    (pg_temp.req_draft_id(), pg_temp.merchant_1_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'draft', null);
end;
$$;

-- 1-3. Existencia de las 3 funciones RPC en el esquema public
select has_function('public', 'submit_offer', array['uuid', 'integer', 'integer', 'text'], 'RPC submit_offer existe con firma canónica');
select has_function('public', 'withdraw_offer', array['uuid'], 'RPC withdraw_offer existe con firma canónica');
select has_function('public', 'set_availability', array['boolean'], 'RPC set_availability existe con firma canónica');

-- 4-6. DoD: Piso dinámico en platform_settings (min_offer_ars = 1000): 999 falla, 1000 pasa, 1001 pasa
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());

select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_1_id(), 999, 15, 'Oferta 999') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'Con min_offer_ars = 1000, monto 999 rechaza con OFFER_BELOW_MINIMUM'
);

select lives_ok(
  $$ select public.submit_offer(pg_temp.req_pub_1_id(), 1000, 15, 'Oferta 1000 exacta') $$,
  'Con min_offer_ars = 1000, monto 1000 es aceptado'
);

select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());

select lives_ok(
  $$ select public.submit_offer(pg_temp.req_pub_1_id(), 1001, 20, 'Oferta 1001') $$,
  'Con min_offer_ars = 1000, monto 1001 es aceptado'
);

-- 7-11. DoD: Piso cambiado a 1500 en platform_settings: 999, 1000 y 1001 ahora fallan con OFFER_BELOW_MINIMUM; 1499 falla; 1500 pasa
select pg_temp.reset_actor();
update public.platform_settings set value = '1500'::jsonb where key = 'min_offer_ars';

select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());

select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 999, 15, 'Oferta 999 con piso 1500') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'Con min_offer_ars cambiado a 1500, monto 999 rechaza con OFFER_BELOW_MINIMUM'
);

select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 1000, 15, 'Oferta 1000 con piso 1500') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'Con min_offer_ars cambiado a 1500, monto 1000 rechaza con OFFER_BELOW_MINIMUM'
);

select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 1001, 15, 'Oferta 1001 con piso 1500') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'Con min_offer_ars cambiado a 1500, monto 1001 rechaza con OFFER_BELOW_MINIMUM'
);

select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 1499, 15, 'Oferta 1499 con piso 1500') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'Con min_offer_ars cambiado a 1500, monto 1499 rechaza con OFFER_BELOW_MINIMUM'
);

select lives_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 1500, 15, 'Oferta 1500 con piso 1500') $$,
  'Con min_offer_ars cambiado a 1500, monto 1500 es aceptado'
);

-- 12. DoD: Oferta activa duplicada (DUPLICATE_ACTIVE_OFFER)
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 1600, 15, 'Intento duplicado') $$,
  'P0001'::char(5),
  'DUPLICATE_ACTIVE_OFFER',
  'Un repartidor con oferta pending en la misma solicitud recibe DUPLICATE_ACTIVE_OFFER'
);

-- 13-16. DoD: Repartidores pending, rejected, suspended y unavailable rechazados en submit_offer
select pg_temp.act_as('authenticated', pg_temp.courier_pending_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_3_id(), 1600, 15, null) $$,
  'P0001'::char(5),
  'COURIER_NOT_APPROVED',
  'Repartidor pending rechazado en submit_offer con COURIER_NOT_APPROVED'
);

select pg_temp.act_as('authenticated', pg_temp.courier_rejected_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_3_id(), 1600, 15, null) $$,
  'P0001'::char(5),
  'COURIER_NOT_APPROVED',
  'Repartidor rejected rechazado en submit_offer con COURIER_NOT_APPROVED'
);

select pg_temp.act_as('authenticated', pg_temp.courier_suspended_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_3_id(), 1600, 15, null) $$,
  'P0001'::char(5),
  'COURIER_SUSPENDED',
  'Repartidor suspended rechazado en submit_offer con COURIER_SUSPENDED'
);

select pg_temp.act_as('authenticated', pg_temp.courier_unavailable_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_3_id(), 1600, 15, null) $$,
  'P0001'::char(5),
  'COURIER_UNAVAILABLE',
  'Repartidor approved con available=false rechazado con COURIER_UNAVAILABLE'
);

-- 17-20. Autorización, expiración perezosa y estado de solicitud en submit_offer
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_3_id(), 1600, 15, null) $$,
  'P0001'::char(5),
  'UNAUTHORIZED_ACTOR',
  'Un comercio no puede invocar submit_offer (UNAUTHORIZED_ACTOR)'
);

select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select throws_ok(
  $$ select public.submit_offer('00000000-0000-0000-0000-000000009999'::uuid, 1600, 15, null) $$,
  'P0001'::char(5),
  'NOT_FOUND',
  'Solicitud inexistente devuelve NOT_FOUND'
);

select throws_ok(
  $$ select public.submit_offer(pg_temp.req_expired_id(), 1600, 15, null) $$,
  'P0001'::char(5),
  'REQUEST_EXPIRED',
  'Solicitud con expires_at < now() devuelve REQUEST_EXPIRED (expiración perezosa)'
);

select throws_ok(
  $$ select public.submit_offer(pg_temp.req_draft_id(), 1600, 15, null) $$,
  'P0001'::char(5),
  'INVALID_STATE_TRANSITION',
  'Solicitud en estado draft devuelve INVALID_STATE_TRANSITION'
);

-- 21-25. withdraw_offer: retiro exitoso, re-oferta posterior permitida, OFFER_NOT_PENDING y UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select throws_ok(
  $$ select public.withdraw_offer(pg_temp.find_offer_id(pg_temp.req_pub_1_id(), pg_temp.courier_approved_1_id())) $$,
  'P0001'::char(5),
  'UNAUTHORIZED_ACTOR',
  'Otro repartidor no puede retirar una oferta ajena (UNAUTHORIZED_ACTOR)'
);

select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select (public.withdraw_offer((select id from public.offers where request_id = pg_temp.req_pub_1_id() and courier_id = pg_temp.courier_approved_1_id()))) ->> 'status'),
  'withdrawn',
  'withdraw_offer cambia el estado a withdrawn y devuelve el contrato JSONB'
);

select ok(
  (select decided_at is not null from public.offers where request_id = pg_temp.req_pub_1_id() and courier_id = pg_temp.courier_approved_1_id() and status = 'withdrawn'),
  'withdraw_offer registra decided_at no nulo en la fila de offers'
);

select throws_ok(
  $$ select public.withdraw_offer((select id from public.offers where request_id = pg_temp.req_pub_1_id() and courier_id = pg_temp.courier_approved_1_id() and status = 'withdrawn')) $$,
  'P0001'::char(5),
  'OFFER_NOT_PENDING',
  'Intentar retirar una oferta ya withdrawn devuelve OFFER_NOT_PENDING'
);

select lives_ok(
  $$ select public.submit_offer(pg_temp.req_pub_1_id(), 1550, 12, 'Nueva oferta tras retirar') $$,
  'Tras retirar la oferta previa, el repartidor puede enviar una nueva oferta a la misma solicitud'
);

-- 26-30. set_availability: caso feliz y rechazo de pending, rejected, suspended y merchant
select pg_temp.act_as('authenticated', pg_temp.courier_unavailable_id());
select is(
  (select ((public.set_availability(true)) ->> 'available')::boolean),
  true,
  'set_availability(true) activa la disponibilidad de un repartidor approved'
);

select lives_ok(
  $$ select public.submit_offer(pg_temp.req_pub_3_id(), 1500, 15, 'Ahora disponible') $$,
  'Luego de set_availability(true), el repartidor puede ofertar en req_pub_3'
);

select pg_temp.act_as('authenticated', pg_temp.courier_pending_id());
select throws_ok(
  $$ select public.set_availability(true) $$,
  'P0001'::char(5),
  'COURIER_NOT_APPROVED',
  'Repartidor pending no puede cambiar disponibilidad (COURIER_NOT_APPROVED)'
);

select pg_temp.act_as('authenticated', pg_temp.courier_suspended_id());
select throws_ok(
  $$ select public.set_availability(false) $$,
  'P0001'::char(5),
  'COURIER_SUSPENDED',
  'Repartidor suspended no puede cambiar disponibilidad (COURIER_SUSPENDED)'
);

select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.set_availability(true) $$,
  'P0001'::char(5),
  'UNAUTHORIZED_ACTOR',
  'Un comercio no puede invocar set_availability (UNAUTHORIZED_ACTOR)'
);

-- 31. DoD (D01, D02, D04, H01, H04): Tope de ventana desde platform_settings.max_offers_per_min y upsert atómico sobre la PK
select pg_temp.reset_actor();
insert into public.rate_limits (subject, action, window_start, count)
values (pg_temp.courier_approved_2_id()::text, 'submit_offer', date_trunc('minute', now()), 10)
on conflict (subject, action, window_start) do update set count = 10;

select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 1600, 15, 'Excede rate limit') $$,
  'P0001'::char(5),
  'RATE_LIMITED',
  'Limita ofertas exitosas por ventana: cuando el contador alcanza platform_settings.max_offers_per_min (10), submit_offer rechaza con RATE_LIMITED'
);

-- 32. D04 / H04: Afirma el valor exacto del contador (3 tras las 3 ofertas exitosas de courier_approved_1_id) con limit 1
select pg_temp.reset_actor();
select is(
  (
    select count
    from public.rate_limits
    where subject = pg_temp.courier_approved_1_id()::text
      and action = 'submit_offer'
    order by window_start desc
    limit 1
  ),
  3,
  'Tope de ventana verificado y upsert atómico sobre la PK: el contador de courier_approved_1_id vale exactamente 3 tras 3 ofertas exitosas y 9 intentos fallidos'
);

-- 33. D02 / H01: Tope dinámico leído de platform_settings.max_offers_per_min (al bajarlo a 3, la 4.ª oferta de courier_approved_1_id recibe RATE_LIMITED)
update public.platform_settings set value = '3'::jsonb where key = 'max_offers_per_min';
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_3_id(), 1600, 15, 'Cuarta oferta con tope 3') $$,
  'P0001'::char(5),
  'RATE_LIMITED',
  'Con platform_settings.max_offers_per_min cambiado a 3, la 4.ª oferta de courier_approved_1_id rechaza con RATE_LIMITED'
);
select pg_temp.reset_actor();
update public.platform_settings set value = '10'::jsonb where key = 'max_offers_per_min';

-- 34-37. D01 / H03: Tras resetear el contador y ejecutar 3 throws_ok con OFFER_BELOW_MINIMUM, el contador vale 0 (el rate limit solo cuenta ofertas exitosas)
delete from public.rate_limits
where subject = pg_temp.courier_approved_1_id()::text
  and action = 'submit_offer';

select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 999, 15, 'Intento fallido 1') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'H03 intento fallido 1 con OFFER_BELOW_MINIMUM'
);
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 999, 15, 'Intento fallido 2') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'H03 intento fallido 2 con OFFER_BELOW_MINIMUM'
);
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_2_id(), 999, 15, 'Intento fallido 3') $$,
  'P0001'::char(5),
  'OFFER_BELOW_MINIMUM',
  'H03 intento fallido 3 con OFFER_BELOW_MINIMUM'
);

select pg_temp.reset_actor();
select is(
  (
    select coalesce(max(count), 0)
    from public.rate_limits
    where subject = pg_temp.courier_approved_1_id()::text
      and action = 'submit_offer'
  ),
  0,
  'D01 / H03: Los 3 intentos fallidos con OFFER_BELOW_MINIMUM revierten su transacción y dejan el contador en 0 (limita ofertas exitosas por ventana)'
);

-- 38-43. H08: Verificación explícita de SECURITY DEFINER (is_definer) y bloqueo de rol anon (42501) en las 3 RPC
select is_definer('public', 'submit_offer', array['uuid', 'integer', 'integer', 'text'], 'submit_offer es SECURITY DEFINER');
select is_definer('public', 'withdraw_offer', array['uuid'], 'withdraw_offer es SECURITY DEFINER');
select is_definer('public', 'set_availability', array['boolean'], 'set_availability es SECURITY DEFINER');

select pg_temp.act_as('anon');
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_pub_1_id(), 1600, 15, null) $$,
  '42501'::char(5),
  null,
  'Rol anon no tiene permiso EXECUTE sobre submit_offer (42501)'
);
select throws_ok(
  $$ select public.withdraw_offer(pg_temp.req_pub_1_id()) $$,
  '42501'::char(5),
  null,
  'Rol anon no tiene permiso EXECUTE sobre withdraw_offer (42501)'
);
select throws_ok(
  $$ select public.set_availability(true) $$,
  '42501'::char(5),
  null,
  'Rol anon no tiene permiso EXECUTE sobre set_availability (42501)'
);

select * from finish();

rollback;
