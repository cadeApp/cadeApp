begin;

select plan(34);

-- Helpers para simular sesión autenticada en pgTAP
create or replace function pg_temp.act_as(p_role text, p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', p_role, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  if p_uid is null then
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{}', true);
  else
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_uid::text, 'role', p_role, 'aal', 'aal1')::text,
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

-- IDs fijos de prueba para T-102
create or replace function pg_temp.merchant_1_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000001'::uuid
$$;
create or replace function pg_temp.merchant_2_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000002'::uuid
$$;
create or replace function pg_temp.courier_id(p_idx integer) returns uuid language sql immutable as $$
  select ('22222222-2222-4222-8222-' || lpad((100 + p_idx)::text, 12, '0'))::uuid
$$;
create or replace function pg_temp.req_race_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000201'::uuid
$$;
create or replace function pg_temp.req_checks_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000202'::uuid
$$;
create or replace function pg_temp.req_expired_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000203'::uuid
$$;
create or replace function pg_temp.req_cancelled_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000204'::uuid
$$;
create or replace function pg_temp.offer_race_id(p_idx integer) returns uuid language sql immutable as $$
  select ('22222222-2222-4222-8222-' || lpad((300 + p_idx)::text, 12, '0'))::uuid
$$;
create or replace function pg_temp.offer_suspended_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000401'::uuid
$$;
create or replace function pg_temp.offer_pending_courier_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000402'::uuid
$$;
create or replace function pg_temp.offer_rejected_courier_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000403'::uuid
$$;
create or replace function pg_temp.offer_withdrawn_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000404'::uuid
$$;
create or replace function pg_temp.offer_expired_req_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000405'::uuid
$$;
create or replace function pg_temp.offer_cancelled_req_id() returns uuid language sql immutable as $$
  select '22222222-2222-4222-8222-000000000406'::uuid
$$;

-- Semilla de usuarios (2 comercios y 14 repartidores) como superusuario
do $$
declare
  v_zone_id uuid;
  i integer;
begin
  select id into v_zone_id from public.zones where active limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.merchant_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm1_t102@test.local', 'pwd', '{"role":"merchant"}'),
    (pg_temp.merchant_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2_t102@test.local', 'pwd', '{"role":"merchant"}');

  for i in 1..14 loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values (
      pg_temp.courier_id(i),
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      format('c%s_t102@test.local', i),
      'pwd',
      '{"role":"courier"}'
    );
  end loop;

  -- Todos los repartidores nacen aprobados y disponibles para poder ofertar
  update public.couriers
  set status = 'approved',
      available = true
  where profile_id in (select pg_temp.courier_id(g) from generate_series(1, 14) as g);

  -- Solicitudes de prueba
  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status, published_at, expires_at
  )
  values
    (
      pg_temp.req_race_id(),
      pg_temp.merchant_1_id(),
      v_zone_id,
      v_zone_id,
      'chico',
      'cash',
      'published',
      now() - interval '5 minutes',
      now() + interval '25 minutes'
    ),
    (
      pg_temp.req_checks_id(),
      pg_temp.merchant_1_id(),
      v_zone_id,
      v_zone_id,
      'mediano',
      'transfer',
      'published',
      now() - interval '5 minutes',
      now() + interval '25 minutes'
    ),
    (
      pg_temp.req_expired_id(),
      pg_temp.merchant_1_id(),
      v_zone_id,
      v_zone_id,
      'chico',
      'cash',
      'published',
      now() - interval '35 minutes',
      now() - interval '5 minutes'
    ),
    (
      pg_temp.req_cancelled_id(),
      pg_temp.merchant_1_id(),
      v_zone_id,
      v_zone_id,
      'chico',
      'cash',
      'cancelled',
      now() - interval '15 minutes',
      now() + interval '15 minutes'
    );

  -- 10 ofertas pendientes en req_race_id (de los repartidores 1..10)
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  select
    pg_temp.offer_race_id(g),
    pg_temp.req_race_id(),
    pg_temp.courier_id(g),
    1400 + (g * 50),
    15,
    'pending'::public.offer_status
  from generate_series(1, 10) as g;

  -- Ofertas en req_checks_id, req_expired_id y req_cancelled_id
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values
    (pg_temp.offer_suspended_id(), pg_temp.req_checks_id(), pg_temp.courier_id(11), 1600, 15, 'pending'),
    (pg_temp.offer_pending_courier_id(), pg_temp.req_checks_id(), pg_temp.courier_id(12), 1650, 15, 'pending'),
    (pg_temp.offer_rejected_courier_id(), pg_temp.req_checks_id(), pg_temp.courier_id(13), 1700, 15, 'pending'),
    (pg_temp.offer_withdrawn_id(), pg_temp.req_checks_id(), pg_temp.courier_id(14), 1750, 15, 'withdrawn'),
    (pg_temp.offer_expired_req_id(), pg_temp.req_expired_id(), pg_temp.courier_id(1), 1600, 15, 'pending'),
    (pg_temp.offer_cancelled_req_id(), pg_temp.req_cancelled_id(), pg_temp.courier_id(1), 1600, 15, 'pending');

  -- Entre la creación de la oferta y la aceptación, cambian los estados de los repartidores 11, 12 y 13
  update public.couriers set status = 'suspended', available = false where profile_id = pg_temp.courier_id(11);
  update public.couriers set status = 'pending', available = false where profile_id = pg_temp.courier_id(12);
  update public.couriers set status = 'rejected', available = false where profile_id = pg_temp.courier_id(13);
end;
$$;

-- 1. Seguridad de definición (SECURITY DEFINER)
select is_definer(
  'public',
  'accept_offer',
  ARRAY['uuid'],
  'public.accept_offer debe ser SECURITY DEFINER'
);

-- 2. PR56-H21: offers_update_merchant bloquea con 42501 incluso la modificación de created_at por el comercio
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ update public.offers set created_at = now() - interval '1 day' where id = pg_temp.offer_race_id(1) $$,
  '42501'::char(5),
  null,
  'PR56-H21: el comercio no puede alterar created_at ni ninguna otra columna de public.offers (42501)'
);

-- 3. Privilegios: el rol anon tiene revocada la ejecución (42501)
select pg_temp.act_as('anon', null);
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_race_id(1)) $$,
  '42501'::char(5),
  null,
  'El rol anon no tiene permiso EXECUTE sobre public.accept_offer (42501)'
);

-- 4. Actor autenticado sin sub (UNAUTHENTICATED)
select pg_temp.act_as('authenticated', null);
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_race_id(1)) $$,
  'P0001'::char(5),
  'UNAUTHENTICATED',
  'accept_offer sin auth.uid() lanza UNAUTHENTICATED'
);

-- 5. Rol incorrecto: un repartidor no puede aceptar una oferta (UNAUTHORIZED_ACTOR)
select pg_temp.act_as('authenticated', pg_temp.courier_id(1));
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_race_id(1)) $$,
  'P0001'::char(5),
  'UNAUTHORIZED_ACTOR',
  'Un repartidor no puede invocar accept_offer (UNAUTHORIZED_ACTOR)'
);

-- 6. Parámetro inválido: p_offer_id nulo (VALIDATION_ERROR)
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.accept_offer(null) $$,
  'P0001'::char(5),
  'VALIDATION_ERROR',
  'accept_offer con p_offer_id nulo lanza VALIDATION_ERROR'
);

-- 7. Oferta inexistente (NOT_FOUND)
select throws_ok(
  $$ select public.accept_offer('99999999-9999-4999-8999-999999999999'::uuid) $$,
  'P0001'::char(5),
  'NOT_FOUND',
  'accept_offer con offer_id inexistente lanza NOT_FOUND'
);

-- 8. Otro comercio intenta aceptar la oferta de una solicitud ajena (UNAUTHORIZED_ACTOR)
select pg_temp.act_as('authenticated', pg_temp.merchant_2_id());
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_race_id(1)) $$,
  'P0001'::char(5),
  'UNAUTHORIZED_ACTOR',
  'Un comercio ajeno no puede aceptar la oferta de otro comercio (UNAUTHORIZED_ACTOR)'
);

-- 9. DoD: Repartidor suspendido entre la oferta y la aceptación (COURIER_SUSPENDED)
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_suspended_id()) $$,
  'P0001'::char(5),
  'COURIER_SUSPENDED',
  'Si el repartidor fue suspendido entre la oferta y la aceptación, accept_offer lanza COURIER_SUSPENDED'
);

-- 10. Repartidor en pending entre la oferta y la aceptación (COURIER_NOT_APPROVED)
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_pending_courier_id()) $$,
  'P0001'::char(5),
  'COURIER_NOT_APPROVED',
  'Si el repartidor pasó a pending, accept_offer lanza COURIER_NOT_APPROVED'
);

-- 11. Repartidor en rejected entre la oferta y la aceptación (COURIER_NOT_APPROVED)
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_rejected_courier_id()) $$,
  'P0001'::char(5),
  'COURIER_NOT_APPROVED',
  'Si el repartidor pasó a rejected, accept_offer lanza COURIER_NOT_APPROVED'
);

-- 12. Oferta retirada antes de la aceptación (OFFER_NOT_PENDING)
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_withdrawn_id()) $$,
  'P0001'::char(5),
  'OFFER_NOT_PENDING',
  'Una oferta en estado withdrawn lanza OFFER_NOT_PENDING'
);

-- 13. Solicitud vencida al momento de aceptar (REQUEST_EXPIRED)
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_expired_req_id()) $$,
  'P0001'::char(5),
  'REQUEST_EXPIRED',
  'Una solicitud con expires_at <= now() lanza REQUEST_EXPIRED'
);

-- 14. Solicitud en estado distinto de published/matched (INVALID_STATE_TRANSITION)
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_cancelled_req_id()) $$,
  'P0001'::char(5),
  'INVALID_STATE_TRANSITION',
  'Una solicitud en estado cancelled lanza INVALID_STATE_TRANSITION'
);

-- 15-24. DoD: 10 llamadas competidoras sobre las 10 ofertas de la misma solicitud → una sola ganadora y 9 ALREADY_MATCHED
create temp table t102_race_results (
  idx integer primary key,
  outcome text not null,
  payload jsonb
);

do $$
declare
  i integer;
  v_res jsonb;
begin
  for i in 1..10 loop
    begin
      v_res := public.accept_offer(pg_temp.offer_race_id(i));
      insert into t102_race_results (idx, outcome, payload)
      values (i, 'WON', v_res);
    exception
      when sqlstate 'P0001' then
        insert into t102_race_results (idx, outcome, payload)
        values (i, sqlerrm, null);
    end;
  end loop;
end;
$$;

-- 15. Exactamente 1 llamada ganadora entre las 10
select is(
  (select count(*)::integer from t102_race_results where outcome = 'WON'),
  1,
  'De 10 llamadas de accept_offer sobre las 10 ofertas de la solicitud, exactamente 1 gana'
);

-- 16. Las otras 9 llamadas reciben ALREADY_MATCHED
select is(
  (select count(*)::integer from t102_race_results where outcome = 'ALREADY_MATCHED'),
  9,
  'Las otras 9 llamadas reciben exactamente ALREADY_MATCHED'
);

-- 17. La llamada ganadora devolvió status = matched e idempotent = false
select is(
  (select (payload ->> 'status') || ':' || (payload ->> 'idempotent') from t102_race_results where outcome = 'WON'),
  'matched:false',
  'La primera llamada ganadora devuelve status=matched e idempotent=false'
);

-- 18. La llamada ganadora corresponde a offer_race_id(1)
select is(
  (select (payload ->> 'acceptedOfferId')::uuid from t102_race_results where outcome = 'WON'),
  pg_temp.offer_race_id(1),
  'acceptedOfferId en la salida coincide con la oferta ganadora'
);

-- 19. En public.offers hay exactamente 1 oferta en estado accepted
select is(
  (select count(*)::integer from public.offers where request_id = pg_temp.req_race_id() and status = 'accepted'),
  1,
  'Exactamente 1 oferta queda en estado accepted en public.offers'
);

-- 20. En public.offers las otras 9 ofertas pendientes quedaron automáticamente en rejected con decided_at no nulo
select is(
  (
    select count(*)::integer
    from public.offers
    where request_id = pg_temp.req_race_id()
      and status = 'rejected'
      and decided_at is not null
  ),
  9,
  'Las 9 ofertas competidoras restantes quedan en estado rejected con decided_at poblado'
);

-- 21. En public.delivery_requests la solicitud quedó en estado matched con accepted_offer_id y matched_at poblados
select is(
  (
    select status::text || ':' || (accepted_offer_id = pg_temp.offer_race_id(1))::text || ':' || (matched_at is not null)::text
    from public.delivery_requests
    where id = pg_temp.req_race_id()
  ),
  'matched:true:true',
  'delivery_requests queda en status=matched con accepted_offer_id=offer_1 y matched_at no nulo'
);

-- 22. El helper RLS app_private.is_courier_assigned_to_request autoriza al repartidor ganador (courier 1)
select is(
  app_private.is_courier_assigned_to_request(pg_temp.req_race_id(), pg_temp.courier_id(1)),
  true,
  'app_private.is_courier_assigned_to_request devuelve true para el repartidor de la oferta aceptada'
);

-- 23. El helper RLS app_private.is_courier_assigned_to_request rechaza a los repartidores no ganadores (courier 2)
select is(
  app_private.is_courier_assigned_to_request(pg_temp.req_race_id(), pg_temp.courier_id(2)),
  false,
  'app_private.is_courier_assigned_to_request devuelve false para un repartidor cuya oferta fue rechazada'
);

-- 24-27. DoD: Idempotencia — volver a llamar accept_offer con la misma oferta ya aceptada devuelve ok con idempotent = true y preserva matchedAt
create temp table t102_idempotent_check as
select public.accept_offer(pg_temp.offer_race_id(1)) as res;

-- 24. La re-ejecución idempotente devuelve idempotent = true
select is(
  (select (res ->> 'idempotent')::boolean from t102_idempotent_check),
  true,
  'Volver a invocar accept_offer con la misma oferta ganadora devuelve idempotent=true'
);

-- 25. La re-ejecución idempotente devuelve status = matched y el mismo acceptedOfferId
select is(
  (select (res ->> 'status') || ':' || (res ->> 'acceptedOfferId') from t102_idempotent_check),
  'matched:' || pg_temp.offer_race_id(1)::text,
  'La llamada idempotente devuelve status=matched y el mismo acceptedOfferId'
);

-- 26. La re-ejecución idempotente preserva exactamente el mismo matchedAt que la primera llamada
select is(
  (select res ->> 'matchedAt' from t102_idempotent_check),
  (select payload ->> 'matchedAt' from t102_race_results where outcome = 'WON'),
  'La llamada idempotente preserva el timestamp matchedAt original de la primera aceptación'
);

-- 27. Aun si el repartidor ganador fuera suspendido DESPUÉS del match, la lectura idempotente de accept_offer sobre la misma oferta ya aceptada sigue devolviendo idempotent = true (paso 5 precede al paso 8)
select pg_temp.reset_actor();
update public.couriers set status = 'suspended', available = false where profile_id = pg_temp.courier_id(1);
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select is(
  (public.accept_offer(pg_temp.offer_race_id(1)) ->> 'idempotent')::boolean,
  true,
  'La idempotencia (paso 5) precede al chequeo de estado del repartidor (paso 8)'
);

-- 28-34. Precedencia canónica ante fallos simultáneos en SQL (CC-002)
-- 28. Actor no autenticado + oferta inexistente -> UNAUTHENTICATED (paso 1 precede a paso 3)
select pg_temp.act_as('authenticated', null);
select throws_ok(
  $$ select public.accept_offer('99999999-9999-4999-8999-999999999999'::uuid) $$,
  'P0001'::char(5),
  'UNAUTHENTICATED',
  'Precedencia: Actor no autenticado + oferta inexistente -> UNAUTHENTICATED'
);

-- 29. Rol repartidor + parámetro nulo -> UNAUTHORIZED_ACTOR (paso 1 precede a paso 2)
select pg_temp.act_as('authenticated', pg_temp.courier_id(2));
select throws_ok(
  $$ select public.accept_offer(null) $$,
  'P0001'::char(5),
  'UNAUTHORIZED_ACTOR',
  'Precedencia: Rol courier + p_offer_id nulo -> UNAUTHORIZED_ACTOR'
);

-- 30. Comercio ajeno + solicitud ya emparejada -> UNAUTHORIZED_ACTOR (paso 4 precede a paso 5 ALREADY_MATCHED)
select pg_temp.act_as('authenticated', pg_temp.merchant_2_id());
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_race_id(2)) $$,
  'P0001'::char(5),
  'UNAUTHORIZED_ACTOR',
  'Precedencia: Comercio ajeno + solicitud matched -> UNAUTHORIZED_ACTOR'
);

-- 31. Solicitud ya emparejada (otra oferta) + oferta rechazada -> ALREADY_MATCHED (paso 5 precede a paso 7 OFFER_NOT_PENDING)
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_race_id(2)) $$,
  'P0001'::char(5),
  'ALREADY_MATCHED',
  'Precedencia: Solicitud matched con otra oferta + oferta en estado rejected -> ALREADY_MATCHED'
);

-- 32. Solicitud vencida + repartidor suspendido -> REQUEST_EXPIRED (paso 6 precede a paso 8)
select pg_temp.reset_actor();
update public.couriers set status = 'suspended' where profile_id = pg_temp.courier_id(2);
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
values ('22222222-2222-4222-8222-000000000499'::uuid, pg_temp.req_expired_id(), pg_temp.courier_id(2), 1500, 15, 'pending');
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.accept_offer('22222222-2222-4222-8222-000000000499'::uuid) $$,
  'P0001'::char(5),
  'REQUEST_EXPIRED',
  'Precedencia: Solicitud vencida + repartidor suspendido -> REQUEST_EXPIRED'
);

-- 33. Solicitud cancelada + oferta retirada -> INVALID_STATE_TRANSITION (paso 6 precede a paso 7)
select pg_temp.reset_actor();
update public.offers set status = 'withdrawn' where id = pg_temp.offer_cancelled_req_id();
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_cancelled_req_id()) $$,
  'P0001'::char(5),
  'INVALID_STATE_TRANSITION',
  'Precedencia: Solicitud cancelada + oferta withdrawn -> INVALID_STATE_TRANSITION'
);

-- 34. Oferta retirada + repartidor suspendido en solicitud publicada -> OFFER_NOT_PENDING (paso 7 precede a paso 8)
select pg_temp.reset_actor();
update public.couriers set status = 'suspended' where profile_id = pg_temp.courier_id(14);
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  $$ select public.accept_offer(pg_temp.offer_withdrawn_id()) $$,
  'P0001'::char(5),
  'OFFER_NOT_PENDING',
  'Precedencia: Oferta withdrawn + repartidor suspendido -> OFFER_NOT_PENDING'
);

select * from finish();
rollback;
