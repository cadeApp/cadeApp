begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Datos sintéticos; todo se revierte al terminar, incluida cada transición.
create function pg_temp.actor(n integer) returns uuid language sql immutable as $$
  select ('10300000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select pg_temp.actor(n), '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 't103-' || n || '@example.test',
  jsonb_build_object('role', case when n in (3, 4) then 'courier' else 'merchant' end)
from generate_series(1, 5) n;
update public.profiles set role = 'admin' where id = pg_temp.actor(5);
update public.couriers set status = 'approved', available = true
where profile_id in (pg_temp.actor(3), pg_temp.actor(4));
insert into public.zones (id, name, centroid_lat, centroid_lng, active) values
  (pg_temp.actor(10), 'T103 Retiro', -27.430000, -65.620000, true),
  (pg_temp.actor(11), 'T103 Entrega', -27.420000, -65.610000, true);

create function pg_temp.fixture(p_status text) returns void language plpgsql as $$
begin
  update public.delivery_requests set accepted_offer_id = null where id = pg_temp.actor(20);
  delete from public.request_cancellation_reasons where request_id = pg_temp.actor(20);
  delete from public.audit_log where target_id = pg_temp.actor(20)::text;
  delete from public.incidents where request_id = pg_temp.actor(20);
  delete from public.offers where request_id = pg_temp.actor(20);
  delete from public.delivery_requests where id = pg_temp.actor(20);
  delete from public.rate_limits where subject in
    (pg_temp.actor(1)::text, pg_temp.actor(3)::text, pg_temp.actor(5)::text);
  update public.merchants set subscription_status = 'pilot', paid_until = null
  where profile_id in (pg_temp.actor(1), pg_temp.actor(2));
  insert into public.couriers (profile_id, status, available)
  values (pg_temp.actor(3), 'approved', true), (pg_temp.actor(4), 'approved', true)
  on conflict (profile_id) do update set status = 'approved', available = true;
  update public.platform_settings set value = 'true'::jsonb where key = 'pilot_active';
  update public.platform_settings set value = '30'::jsonb where key = 'request_ttl_minutes';
  insert into public.delivery_requests (
    id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
    recipient_payment_method, expires_at, published_at, matched_at, picked_up_at, delivered_at
  ) values (
    pg_temp.actor(20), pg_temp.actor(1), p_status::public.delivery_request_status,
    pg_temp.actor(10), pg_temp.actor(11), 'chico', 'cash', now() + interval '30 minutes',
    case when p_status <> 'draft' then now() end,
    case when p_status in ('matched', 'in_transit', 'delivered') then now() end,
    case when p_status in ('in_transit', 'delivered') then now() end,
    case when p_status = 'delivered' then now() end
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address, dropoff_address, recipient_name, recipient_phone,
    recipient_consent_declared
  ) values (pg_temp.actor(20), 'Retiro de prueba', 'Entrega de prueba', 'Persona de prueba',
    '+543865000000', true);
  if p_status in ('matched', 'in_transit', 'delivered') then
    insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
    values (pg_temp.actor(30), pg_temp.actor(20), pg_temp.actor(3), 2500, 15, 'accepted');
    update public.delivery_requests set accepted_offer_id = pg_temp.actor(30)
    where id = pg_temp.actor(20);
  else
    insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
    values (pg_temp.actor(31), pg_temp.actor(20), pg_temp.actor(4), 2500, 15, 'pending');
  end if;
end;
$$;

-- Invoca con el rol real authenticated. Los errores no interrumpen el resto de pgTAP.
create function pg_temp.invoke(p_actor integer, p_sql text) returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    case when p_actor = 0 then '{"role":"authenticated"}'
    else jsonb_build_object('sub', pg_temp.actor(p_actor), 'role', 'authenticated',
      'aal', case when p_actor = 5 then 'aal2' else 'aal1' end)::text end, true);
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

create temporary table rpc_cases (name text, signature text, call_sql text);
insert into rpc_cases values
 ('publish_request', 'uuid', 'select public.publish_request(%L)'),
 ('cancel_request', 'uuid,text', 'select public.cancel_request(%L, ''Motivo de prueba'')'),
 ('mark_picked_up', 'uuid', 'select public.mark_picked_up(%L)'),
 ('mark_delivered', 'uuid', 'select public.mark_delivered(%L)'),
 ('report_no_show', 'uuid,boolean', 'select public.report_no_show(%L, true)'),
 ('courier_cancel_match', 'uuid,text', 'select public.courier_cancel_match(%L, ''Pinchadura'')'),
 ('republish_request', 'uuid,text', 'select public.republish_request(%L, ''Motivo de prueba'')'),
 ('report_incident', 'uuid,text,text', 'select public.report_incident(%L, ''demora'', ''Demora de prueba'')');

select has_function('public', name, string_to_array(signature, ','), name || ': firma') from rpc_cases;
select ok(not has_function_privilege('authenticated',
  'app_private.request_cycle(text,uuid,text,boolean,text,text)', 'EXECUTE'), 'dispatcher privado no invocable');
select ok(not has_function_privilege('authenticated',
  'app_private.request_setting_int(text)', 'EXECUTE'), 'lector de settings no invocable');
select ok(coalesce((select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  and not has_function_privilege('anon', p.oid, 'EXECUTE')
  from pg_proc p where p.oid = to_regprocedure('public.' || c.name || '(' || c.signature || ')')), false),
  name || ': SECURITY DEFINER, search_path y grants') from rpc_cases c;

create temporary table contract_errors (rpc text primary key, codes text[]);
insert into contract_errors values
 ('publish_request', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','NOT_FOUND','SUBSCRIPTION_INACTIVE','MISSING_REQUIRED_FIELDS','OUT_OF_BOUNDS_AGUILARES','INVALID_ZONE','INVALID_STATE_TRANSITION','RATE_LIMITED','VALIDATION_ERROR','INTERNAL_ERROR']),
 ('cancel_request', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','AAL2_REQUIRED','NOT_FOUND','REQUEST_EXPIRED','REASON_REQUIRED','INVALID_STATE_TRANSITION','VALIDATION_ERROR','INTERNAL_ERROR']),
 ('mark_picked_up', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','NOT_FOUND','COURIER_NOT_APPROVED','COURIER_SUSPENDED','INVALID_STATE_TRANSITION','VALIDATION_ERROR','INTERNAL_ERROR']),
 ('mark_delivered', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','NOT_FOUND','COURIER_NOT_APPROVED','COURIER_SUSPENDED','INVALID_STATE_TRANSITION','VALIDATION_ERROR','INTERNAL_ERROR']),
 ('report_no_show', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','NOT_FOUND','SUBSCRIPTION_INACTIVE','INVALID_STATE_TRANSITION','VALIDATION_ERROR','INTERNAL_ERROR']),
 ('courier_cancel_match', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','NOT_FOUND','COURIER_NOT_APPROVED','COURIER_SUSPENDED','REASON_REQUIRED','INVALID_STATE_TRANSITION','VALIDATION_ERROR','INTERNAL_ERROR']),
 ('republish_request', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','NOT_FOUND','SUBSCRIPTION_INACTIVE','REASON_REQUIRED','INVALID_STATE_TRANSITION','RATE_LIMITED','VALIDATION_ERROR','INTERNAL_ERROR']),
 ('report_incident', array['UNAUTHENTICATED','UNAUTHORIZED_ACTOR','NOT_FOUND','COURIER_NOT_APPROVED','COURIER_SUSPENDED','INCIDENT_WINDOW_EXPIRED','INVALID_STATE_TRANSITION','RATE_LIMITED','VALIDATION_ERROR','INTERNAL_ERROR']);

-- Matriz independiente del SQL de producción: actores propios/ajenos/admin/sin sesión x estados.
create temporary table valid_transitions (rpc text, before_status text, actor integer, after_status text);
insert into valid_transitions values
 ('publish_request', 'draft', 1, 'published'),
 ('cancel_request', 'published', 1, 'cancelled'),
 ('cancel_request', 'matched', 1, 'cancelled'),
 ('cancel_request', 'in_transit', 5, 'cancelled'),
 ('mark_picked_up', 'matched', 3, 'in_transit'),
 ('mark_delivered', 'in_transit', 3, 'delivered'),
 ('report_no_show', 'matched', 1, 'published'),
 ('courier_cancel_match', 'matched', 3, 'published'),
 ('republish_request', 'matched', 1, 'published'),
 ('republish_request', 'expired', 1, 'published'),
 ('republish_request', 'cancelled', 1, 'published');
insert into valid_transitions
select 'report_incident', s, a, s
from unnest(array['published','matched','in_transit','delivered']) s
cross join unnest(array[1,5]) a;
insert into valid_transitions
select 'report_incident', s, 3, s from unnest(array['matched','in_transit','delivered']) s;

create function pg_temp.matrix() returns setof text language plpgsql as $$
declare c record; s text; a integer; expected text; result jsonb; label text;
begin
  for c in select * from rpc_cases loop
    foreach s in array array['draft','published','matched','in_transit','delivered','cancelled','expired'] loop
      for a in 0..5 loop
        perform pg_temp.fixture(s);
        select after_status into expected from valid_transitions
        where rpc = c.name and before_status = s and actor = a;
        result := pg_temp.invoke(a, format(c.call_sql, pg_temp.actor(20)));
        label := c.name || ' / ' || s || ' / actor ' || a;
        if expected is null then
          return next ok(result->>'sqlstate' = 'P0001', label || ': rechaza con error de dominio');
          return next ok(result->>'error' = any((select codes from contract_errors where rpc = c.name)::text[]),
            label || ': código real declarado en contrato');
          return next is((select status::text from public.delivery_requests where id = pg_temp.actor(20)),
            s, label || ': no cambia estado al rechazar');
        else
          return next ok(result ? 'data', label || ': acepta');
          return next is((select status::text from public.delivery_requests where id = pg_temp.actor(20)),
            expected, label || ': estado persistido');
          return next is(result->'data'->>'requestId', pg_temp.actor(20)::text, label || ': requestId de contrato');
          return next is(result->'data'->>'status', case when c.name = 'report_incident' then 'open' else expected end,
            label || ': estado de respuesta de contrato');
          return next ok(not (result->'data' ?| array['pickupLat','pickupLng','dropoffLat','dropoffLng',
            'recipientName','recipientPhone','pickupAddress','dropoffAddress']), label || ': respuesta sin datos privados');
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;
select * from pg_temp.matrix();

create function pg_temp.common_errors() returns setof text language plpgsql as $$
declare c record; a integer;
begin
  for c in select * from rpc_cases loop
    a := case when c.name in ('mark_picked_up','mark_delivered','courier_cancel_match') then 3 else 1 end;
    return next is(pg_temp.invoke(0, format(c.call_sql, pg_temp.actor(20)))->>'error',
      'UNAUTHENTICATED', c.name || ': sin sesión');
    return next is(pg_temp.invoke(a, format(c.call_sql, null))->>'error',
      'VALIDATION_ERROR', c.name || ': requestId nulo');
    return next is(pg_temp.invoke(a, format(c.call_sql, pg_temp.actor(999)))->>'error',
      'NOT_FOUND', c.name || ': solicitud inexistente');
  end loop;
end;
$$;
select * from pg_temp.common_errors();

select pg_temp.fixture('draft');
update public.platform_settings set value = 'false'::jsonb where key = 'pilot_active';
update public.merchants set subscription_status = 'expired', paid_until = current_date - 5
where profile_id = pg_temp.actor(1);
select is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
  'SUBSCRIPTION_INACTIVE', 'suscripción vencida bloquea publicar');

select pg_temp.fixture('draft');
delete from public.delivery_request_contacts where request_id = pg_temp.actor(20);
select is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
  'MISSING_REQUIRED_FIELDS', 'sin contacto no publica');

select pg_temp.fixture('published');
update public.delivery_requests set expires_at = now() - interval '1 second' where id = pg_temp.actor(20);
select is(pg_temp.invoke(3, format('select public.submit_offer(%L, 2500, 15, null)', pg_temp.actor(20)))->>'error',
  'REQUEST_EXPIRED', 'expiración perezosa rechaza ofertas sin cron');
select is(pg_temp.invoke(1, format('select public.cancel_request(%L, null)', pg_temp.actor(20)))->>'error',
  'REQUEST_EXPIRED', 'cancelar reconoce expiración perezosa');

select pg_temp.fixture('matched');
select is(pg_temp.invoke(1, format('select public.cancel_request(%L, null)', pg_temp.actor(20)))->>'error',
  'REASON_REQUIRED', 'cancelar matched exige motivo');
select is(pg_temp.invoke(3, format('select public.courier_cancel_match(%L, '''')', pg_temp.actor(20)))->>'error',
  'REASON_REQUIRED', 'courier cancelar exige motivo');
select is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->>'error',
  'REASON_REQUIRED', 'republicar matched exige motivo');
select is(pg_temp.invoke(1, format('select public.report_no_show(%L, false)', pg_temp.actor(20)))->'data'->>'status',
  'cancelled', 'no_show permite cancelar sin republicar');
select is((select status::text from public.offers where id = pg_temp.actor(30)), 'cancelled',
  'no_show cancela oferta aceptada');

select pg_temp.fixture('published');
select is(pg_temp.invoke(1, format('select public.cancel_request(%L, null)', pg_temp.actor(20)))->'data'->>'status',
  'cancelled', 'cancelación publicada sin motivo');
select is((select status::text from public.offers where id = pg_temp.actor(31)), 'expired',
  'cancelación publicada expira ofertas pendientes');

select pg_temp.fixture('in_transit');
update public.couriers set status = 'suspended' where profile_id = pg_temp.actor(3);
select is(pg_temp.invoke(3, format('select public.mark_delivered(%L)', pg_temp.actor(20)))->>'error',
  'COURIER_SUSPENDED', 'suspensión entre retiro y entrega se revalida');
select is(pg_temp.invoke(3, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20)))->>'error',
  'COURIER_SUSPENDED', 'incidente revalida suspensión');
update public.couriers set status = 'rejected' where profile_id = pg_temp.actor(3);
select is(pg_temp.invoke(3, format('select public.mark_delivered(%L)', pg_temp.actor(20)))->>'error',
  'COURIER_NOT_APPROVED', 'entrega rechaza no aprobado');

select pg_temp.fixture('in_transit');
select ok(pg_temp.invoke(3, format('select public.mark_delivered(%L)', pg_temp.actor(20))) ? 'data',
  'entrega persiste delivered_at real');
select is((select delivered_at from public.delivery_requests where id = pg_temp.actor(20)), now(),
  'M02: mark_delivered escribe delivered_at');
select ok(pg_temp.invoke(1, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20))) ? 'data',
  'incidente permitido sobre delivered_at escrito por mark_delivered');
update public.delivery_requests set delivered_at = now() - interval '24 hours' where id = pg_temp.actor(20);
select ok(pg_temp.invoke(1, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20))) ? 'data',
  'incidente permitido exactamente a las 24 horas');
update public.delivery_requests set delivered_at = now() - interval '24 hours 1 second' where id = pg_temp.actor(20);
select is(pg_temp.invoke(1, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20)))->>'error',
  'INCIDENT_WINDOW_EXPIRED', 'incidente rechazado después de 24 horas');

select pg_temp.fixture('draft');
update public.platform_settings set value = '17'::jsonb where key = 'request_ttl_minutes';
select ok(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20))) ? 'data', 'publicación válida');
select is((select expires_at from public.delivery_requests where id = pg_temp.actor(20)),
  now() + interval '17 minutes', 'TTL dinámico');
select is((select published_at from public.delivery_requests where id = pg_temp.actor(20)), now(), 'published_at escrito por RPC');
-- ≈1487 m esféricos x 1.30 = ≈1933 m, redondeo a 500 m => 2000.
select is((select route_distance_m from public.delivery_requests where id = pg_temp.actor(20)), 2000,
  'distancia por centroides sin coordenadas privadas en la respuesta');

-- Los límites se parametrizan a valores pequeños para demostrar que no están hardcodeados.
select pg_temp.fixture('draft');
update public.platform_settings set value = '1'::jsonb where key = 'max_request_publications_per_min';
select ok(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20))) ? 'data',
  'primera publicación dentro del cupo');
select ok(pg_temp.invoke(1, format('select public.cancel_request(%L, null)', pg_temp.actor(20))) ? 'data',
  'cancelar no consume cupo de publicación');
select is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->>'error',
  'RATE_LIMITED', 'publicar y republicar comparten límite');
select is((select count from public.rate_limits where subject = pg_temp.actor(1)::text
  and action = 'publish_request' and window_start = date_trunc('minute', now())), 1,
  'rechazo no consume contador');
select is((select status::text from public.delivery_requests where id = pg_temp.actor(20)),
  'cancelled', 'rechazo por límite conserva solicitud');

select pg_temp.fixture('matched');
update public.platform_settings set value = '1'::jsonb where key = 'max_incidents_per_min';
select ok(pg_temp.invoke(1, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20))) ? 'data',
  'primer incidente dentro del cupo');
select is(pg_temp.invoke(1, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20)))->>'error',
  'RATE_LIMITED', 'segundo incidente excede configuración dinámica');
select is((select count(*)::integer from public.incidents where request_id = pg_temp.actor(20)), 1,
  'incidente rechazado no se persiste');
select ok(pg_temp.invoke(5, format('select public.report_incident(%L, ''demora'', ''Demora de prueba'')', pg_temp.actor(20))) ? 'data',
  'otro actor conserva su propio cupo');

select pg_temp.fixture('draft');
update public.platform_settings set value = 'false'::jsonb where key = 'pilot_active';
update public.platform_settings set value = '2'::jsonb where key = 'subscription_grace_days';
update public.merchants set subscription_status = 'active',
  paid_until = (now() at time zone 'America/Argentina/Buenos_Aires')::date - 2
where profile_id = pg_temp.actor(1);
select ok(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20))) ? 'data',
  'suscripción activa admite último día de gracia de Argentina');

select pg_temp.fixture('draft');
update public.platform_settings set value = 'false'::jsonb where key = 'pilot_active';
update public.merchants set subscription_status = 'active',
  paid_until = (now() at time zone 'America/Argentina/Buenos_Aires')::date - 3
where profile_id = pg_temp.actor(1);
select is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
  'SUBSCRIPTION_INACTIVE', 'pasada la gracia se bloquea publicación');

-- Regresión de contrato: pilot con fecha pagada sigue habilitado fuera del piloto.
select pg_temp.fixture('draft');
update public.platform_settings set value = 'false'::jsonb where key = 'pilot_active';
update public.merchants set paid_until = (now() at time zone 'America/Argentina/Buenos_Aires')::date
where profile_id = pg_temp.actor(1);
select ok(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20))) ? 'data',
  'piloto pagado puede publicar aunque el piloto global haya terminado');

select pg_temp.fixture('matched');
update public.delivery_requests set accepted_offer_id = null where id = pg_temp.actor(20);
select is(pg_temp.invoke(1, format('select public.report_no_show(%L)', pg_temp.actor(20)))->>'error',
  'INVALID_STATE_TRANSITION', 'no_show sin oferta aceptada no devuelve UUID nulo');

select pg_temp.fixture('draft');
update public.zones set active = false where id = pg_temp.actor(10);
select is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
  'INVALID_ZONE', 'zona inactiva no permite publicación');
update public.zones set active = true where id = pg_temp.actor(10);
update public.platform_settings set value = '"invalid"'::jsonb where key = 'request_ttl_minutes';
select is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
  'INTERNAL_ERROR', 'configuración inválida falla cerrada sin filtrar SQL');

select pg_temp.fixture('matched');
update public.delivery_requests set matched_at = now() - interval '10 minutes' where id = pg_temp.actor(20);
select ok(pg_temp.invoke(1, format('select public.cancel_request(%L, ''Cambio de planes'')', pg_temp.actor(20))) ? 'data',
  'cancelación de match permitida');
select is((select matched_at from public.delivery_requests where id = pg_temp.actor(20)),
  now() - interval '10 minutes', 'cancelar preserva el hito histórico de match');

select pg_temp.fixture('in_transit');
update public.delivery_requests
  set matched_at = now() - interval '20 minutes',
      picked_up_at = now() - interval '10 minutes'
  where id = pg_temp.actor(20);
select ok(pg_temp.invoke(5, format('select public.cancel_request(%L, ''Incidente en tránsito'')', pg_temp.actor(20))) ? 'data',
  'cancelación admin en tránsito permitida');
select is((select matched_at from public.delivery_requests where id = pg_temp.actor(20)),
  now() - interval '20 minutes', 'cancelar en tránsito preserva matched_at');
select is((select picked_up_at from public.delivery_requests where id = pg_temp.actor(20)),
  now() - interval '10 minutes', 'cancelar en tránsito preserva picked_up_at');

create function pg_temp.eligibility_errors() returns setof text language plpgsql as $$
declare c record;
begin
  for c in select * from rpc_cases where name in ('mark_picked_up','mark_delivered','courier_cancel_match','report_incident') loop
    perform pg_temp.fixture(case when c.name = 'mark_delivered' then 'in_transit' else 'matched' end);
    update public.couriers set status = 'suspended' where profile_id = pg_temp.actor(3);
    return next is(pg_temp.invoke(3, format(c.call_sql, pg_temp.actor(20)))->>'error',
      'COURIER_SUSPENDED', c.name || ': suspended');
    update public.couriers set status = 'pending' where profile_id = pg_temp.actor(3);
    return next is(pg_temp.invoke(3, format(c.call_sql, pg_temp.actor(20)))->>'error',
      'COURIER_NOT_APPROVED', c.name || ': pending');
  end loop;
  for c in select * from rpc_cases where name in ('publish_request','republish_request','report_no_show') loop
    perform pg_temp.fixture(case when c.name = 'publish_request' then 'draft' else 'matched' end);
    update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.actor(1);
    return next is(pg_temp.invoke(1, format(c.call_sql, pg_temp.actor(20)))->>'error',
      'SUBSCRIPTION_INACTIVE', c.name || ': suscripción expirada');
  end loop;
end;
$$;
select * from pg_temp.eligibility_errors();

select pg_temp.fixture('draft');
insert into public.rate_limits (subject, action, window_start, count)
values (pg_temp.actor(1)::text, 'publish_request', date_trunc('minute', now()), 1);
select is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
  'RATE_LIMITED', 'publicar rechaza contador agotado');
select is((select status::text from public.delivery_requests where id = pg_temp.actor(20)), 'draft',
  'publicar limitado conserva borrador');

-- Transiciones competidoras secuenciales en la misma transacción (H04): cancelar muta solicitud
-- y oferta a 'cancelled', y las llamadas posteriores revalidan estado/autorización y fallan.
select pg_temp.fixture('matched');
select is(pg_temp.invoke(1, format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'Incumplimiento'))->'data'->>'status',
  'cancelled', 'secuencia competidora: cancelar gana sobre solicitud matched');
select is(pg_temp.invoke(3, format('select public.mark_picked_up(%L)', pg_temp.actor(20)))->>'error',
  'UNAUTHORIZED_ACTOR', 'secuencia competidora: retiro posterior ve match revocado tras cancelación y rechaza');
select is(pg_temp.invoke(1, format('select public.report_no_show(%L, true)', pg_temp.actor(20)))->>'error',
  'INVALID_STATE_TRANSITION', 'secuencia competidora: report_no_show posterior revalida estado tras cancelación y rechaza');
select is((select status::text from public.delivery_requests where id = pg_temp.actor(20)),
  'cancelled', 'secuencia competidora: solicitud termina cancelada');
select is((select status::text from public.offers where id = pg_temp.actor(30)),
  'cancelled', 'secuencia competidora: oferta y solicitud permanecen consistentes');

-- H06 / H09 / H03 / D02: efectos laterales persistidos por cada transición (M03..M12)
select pg_temp.fixture('matched');
select is(pg_temp.invoke(3, format('select public.mark_picked_up(%L)', pg_temp.actor(20)))->'data'->>'status',
  'in_transit', 'M03: mark_picked_up pasa a in_transit');
select ok((select picked_up_at is not null from public.delivery_requests where id = pg_temp.actor(20)),
  'M03: mark_picked_up persiste picked_up_at en delivery_requests');

select pg_temp.fixture('matched');
select is(pg_temp.invoke(3, format('select public.courier_cancel_match(%L, %L)', pg_temp.actor(20), 'Pinchadura'))->'data'->>'status',
  'published', 'M04: courier_cancel_match devuelve published');
select is((select status::text from public.offers where id = pg_temp.actor(30)),
  'cancelled', 'M04: courier_cancel_match persiste offers.status = cancelled');
select ok((select expires_at > now() + interval '25 minutes' from public.delivery_requests where id = pg_temp.actor(20)),
  'M06a: courier_cancel_match renueva expires_at al republicar');
select is((select accepted_offer_id from public.delivery_requests where id = pg_temp.actor(20)),
  null::uuid, 'M09a: courier_cancel_match limpia accepted_offer_id');
select is((select cancel_reason from public.delivery_requests where id = pg_temp.actor(20)),
  null::text, 'H03a: courier_cancel_match no expone cancel_reason en delivery_requests publicada');
select is((select reason from public.request_cancellation_reasons where request_id = pg_temp.actor(20) order by created_at desc limit 1),
  'Pinchadura', 'D02a: courier_cancel_match registra motivo en request_cancellation_reasons');

select pg_temp.fixture('matched');
select is(pg_temp.invoke(1, format('select public.republish_request(%L, %L)', pg_temp.actor(20), 'Nuevo intento'))->'data'->>'status',
  'published', 'M05: republish_request devuelve published');
select is((select status::text from public.offers where id = pg_temp.actor(30)),
  'cancelled', 'M05: republish_request persiste offers.status = cancelled');
select ok((select expires_at > now() + interval '25 minutes' from public.delivery_requests where id = pg_temp.actor(20)),
  'M06b: republish_request renueva expires_at al republicar');
select is((select accepted_offer_id from public.delivery_requests where id = pg_temp.actor(20)),
  null::uuid, 'M09b: republish_request limpia accepted_offer_id');
select is((select cancel_reason from public.delivery_requests where id = pg_temp.actor(20)),
  null::text, 'H03b: republish_request no expone cancel_reason en delivery_requests publicada');
select is((select reason from public.request_cancellation_reasons where request_id = pg_temp.actor(20) order by created_at desc limit 1),
  'Nuevo intento', 'D02b: republish_request registra motivo en request_cancellation_reasons');

select pg_temp.fixture('in_transit');
select is(pg_temp.invoke(5, format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'Operativo'))->'data'->>'status',
  'cancelled', 'M07: admin cancel_request en in_transit pasa a cancelled');
select ok((select cancelled_at is not null from public.delivery_requests where id = pg_temp.actor(20)),
  'M07: cancel_request persiste cancelled_at');
select is((select cancel_reason from public.delivery_requests where id = pg_temp.actor(20)),
  'Operativo', 'M08: cancel_request persiste cancel_reason cuando termina en cancelled');
select is((select accepted_offer_id from public.delivery_requests where id = pg_temp.actor(20)),
  null::uuid, 'M09c: cancel_request limpia accepted_offer_id al cancelar');
select is((select count(*)::int from public.audit_log where target_type = 'delivery_request' and target_id = pg_temp.actor(20)::text and action = 'cancel_request'),
  1, 'M11: admin cancel_request en in_transit inserta fila en audit_log');
select is((select array_agg(k order by k) from jsonb_object_keys((select after from public.audit_log where target_type = 'delivery_request' and target_id = pg_temp.actor(20)::text and action = 'cancel_request' limit 1)) as t(k)),
  array['status'], 'M12 / H09: audit_log.after contiene únicamente la clave status sin motivo libre');

-- D03: admin sin AAL2 recibe AAL2_REQUIRED en cancel_request sobre in_transit
select pg_temp.fixture('in_transit');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', pg_temp.actor(5)::text, 'role', 'authenticated', 'aal', 'aal1',
  'app_metadata', json_build_object('role', 'admin')
)::text, true);
select throws_ok(
  format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'Sin MFA'),
  'P0001', 'AAL2_REQUIRED',
  'D03: admin con aal1 recibe AAL2_REQUIRED al cancelar solicitud in_transit'
);
reset role;

-- H07: piso de 500 m en route_distance_m cuando pickup y dropoff difieren pero están a < 500 m
select pg_temp.fixture('draft');
update public.delivery_request_contacts
set pickup_lat = -27.430000, pickup_lng = -65.620000,
    dropoff_lat = -27.430500, dropoff_lng = -65.620000
where request_id = pg_temp.actor(20);
select is((pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->'data'->>'routeDistanceM')::int,
  500, 'H07: publish_request aplica piso de 500 m cuando puntos distintos distan menos de 500 m');

-- D01 / H01 / H02: tabla de doble falla S01..S15 y controles C01..C04 (idéntica a domain.test.ts y ronda-1.md)
create function pg_temp.check_d01() returns setof text language plpgsql as $$
begin
  -- S01: admin cancela published -> INVALID_STATE_TRANSITION
  perform pg_temp.fixture('published');
  return next is(pg_temp.invoke(5, format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'Motivo'))->>'error',
    'INVALID_STATE_TRANSITION', 'S01: admin cancela published -> INVALID_STATE_TRANSITION');

  -- S02: admin cancela matched -> INVALID_STATE_TRANSITION
  perform pg_temp.fixture('matched');
  return next is(pg_temp.invoke(5, format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'Motivo'))->>'error',
    'INVALID_STATE_TRANSITION', 'S02: admin cancela matched -> INVALID_STATE_TRANSITION');

  -- S03: comercio cancela in_transit -> INVALID_STATE_TRANSITION
  perform pg_temp.fixture('in_transit');
  return next is(pg_temp.invoke(1, format('select public.cancel_request(%L, %L)', pg_temp.actor(20), 'Motivo'))->>'error',
    'INVALID_STATE_TRANSITION', 'S03: comercio cancela in_transit -> INVALID_STATE_TRANSITION');

  -- S04: comercio ajeno cancela published vencida -> UNAUTHORIZED_ACTOR (no revela vencimiento)
  perform pg_temp.fixture('published');
  update public.delivery_requests set expires_at = now() - interval '1 minute' where id = pg_temp.actor(20);
  return next is(pg_temp.invoke(2, format('select public.cancel_request(%L, null)', pg_temp.actor(20)))->>'error',
    'UNAUTHORIZED_ACTOR', 'S04: comercio ajeno cancela published vencida -> UNAUTHORIZED_ACTOR');

  -- S05: incidente sobre published vencida -> INVALID_STATE_TRANSITION (expiración perezosa)
  perform pg_temp.fixture('published');
  update public.delivery_requests set expires_at = now() - interval '1 minute' where id = pg_temp.actor(20);
  return next is(pg_temp.invoke(1, format('select public.report_incident(%L, %L, %L)', pg_temp.actor(20), 'demora', 'Demora de prueba'))->>'error',
    'INVALID_STATE_TRANSITION', 'S05: report_incident sobre published vencida -> INVALID_STATE_TRANSITION');

  -- S06 (H01a): courier ajeno y suspendido reporta incidente sobre matched -> UNAUTHORIZED_ACTOR
  perform pg_temp.fixture('matched');
  update public.couriers set status = 'suspended' where profile_id = pg_temp.actor(4);
  return next is(pg_temp.invoke(4, format('select public.report_incident(%L, %L, %L)', pg_temp.actor(20), 'demora', 'Demora de prueba'))->>'error',
    'UNAUTHORIZED_ACTOR', 'S06 / H01a: courier ajeno suspendido en report_incident -> UNAUTHORIZED_ACTOR');

  -- S07: republish_request con suscripción vencida sobre draft -> INVALID_STATE_TRANSITION
  perform pg_temp.fixture('draft');
  update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.actor(1);
  return next is(pg_temp.invoke(1, format('select public.republish_request(%L, %L)', pg_temp.actor(20), 'Motivo'))->>'error',
    'INVALID_STATE_TRANSITION', 'S07: republish_request sobre draft con suscripción vencida -> INVALID_STATE_TRANSITION');

  -- S08: republish_request con suscripción vencida sobre matched sin motivo -> REASON_REQUIRED
  perform pg_temp.fixture('matched');
  update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.actor(1);
  return next is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->>'error',
    'REASON_REQUIRED', 'S08: republish_request sobre matched sin motivo con suscripción vencida -> REASON_REQUIRED');

  -- S09: report_no_show con suscripción vencida sobre published -> INVALID_STATE_TRANSITION
  perform pg_temp.fixture('published');
  update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.actor(1);
  return next is(pg_temp.invoke(1, format('select public.report_no_show(%L, true)', pg_temp.actor(20)))->>'error',
    'INVALID_STATE_TRANSITION', 'S09: report_no_show sobre published con suscripción vencida -> INVALID_STATE_TRANSITION');

  -- S10: report_no_show por comercio ajeno con suscripción vencida sobre matched -> UNAUTHORIZED_ACTOR
  perform pg_temp.fixture('matched');
  update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.actor(2);
  return next is(pg_temp.invoke(2, format('select public.report_no_show(%L, true)', pg_temp.actor(20)))->>'error',
    'UNAUTHORIZED_ACTOR', 'S10: report_no_show por comercio ajeno con suscripción vencida -> UNAUTHORIZED_ACTOR');

  -- S11: courier ajeno marca retirado una published -> UNAUTHORIZED_ACTOR
  perform pg_temp.fixture('published');
  return next is(pg_temp.invoke(4, format('select public.mark_picked_up(%L)', pg_temp.actor(20)))->>'error',
    'UNAUTHORIZED_ACTOR', 'S11: courier ajeno en mark_picked_up sobre published -> UNAUTHORIZED_ACTOR');

  -- S12: courier ajeno marca retirado una draft -> UNAUTHORIZED_ACTOR
  perform pg_temp.fixture('draft');
  return next is(pg_temp.invoke(4, format('select public.mark_picked_up(%L)', pg_temp.actor(20)))->>'error',
    'UNAUTHORIZED_ACTOR', 'S12: courier ajeno en mark_picked_up sobre draft -> UNAUTHORIZED_ACTOR');

  -- S13: publish_request sobre matched -> INVALID_STATE_TRANSITION
  perform pg_temp.fixture('matched');
  return next is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
    'INVALID_STATE_TRANSITION', 'S13: publish_request sobre matched -> INVALID_STATE_TRANSITION');

  -- S14 (H01b): courier ajeno sin registro en couriers reporta incidente sobre matched -> UNAUTHORIZED_ACTOR
  perform pg_temp.fixture('matched');
  delete from public.couriers where profile_id = pg_temp.actor(4);
  return next is(pg_temp.invoke(4, format('select public.report_incident(%L, %L, %L)', pg_temp.actor(20), 'demora', 'Demora de prueba'))->>'error',
    'UNAUTHORIZED_ACTOR', 'S14 / H01b: courier ajeno sin registro en couriers en report_incident -> UNAUTHORIZED_ACTOR');

  -- S15 (H02): republish_request sobre published con expires_at vencido republica sin esperar al cron
  perform pg_temp.fixture('published');
  update public.delivery_requests set expires_at = now() - interval '1 minute' where id = pg_temp.actor(20);
  return next is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->'data'->>'status',
    'published', 'S15 / H02: republish_request sobre published vencida republica sin esperar al cron');

  -- Controles C01..C04
  perform pg_temp.fixture('published');
  return next is(pg_temp.invoke(1, format('select public.cancel_request(%L, null)', pg_temp.actor(20)))->'data'->>'status',
    'cancelled', 'C01: comercio cancela published vigente -> cancelled');

  perform pg_temp.fixture('matched');
  return next is(pg_temp.invoke(3, format('select public.mark_picked_up(%L)', pg_temp.actor(20)))->'data'->>'status',
    'in_transit', 'C02: courier asignado retira matched -> in_transit');

  perform pg_temp.fixture('draft');
  update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.actor(1);
  return next is(pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)))->>'error',
    'SUBSCRIPTION_INACTIVE', 'C03: publish_request sobre draft con suscripción vencida -> SUBSCRIPTION_INACTIVE');

  perform pg_temp.fixture('expired');
  return next is(pg_temp.invoke(1, format('select public.republish_request(%L, null)', pg_temp.actor(20)))->'data'->>'status',
    'published', 'C04: republish_request sobre expired -> published');
end;
$$;
select * from pg_temp.check_d01();

select * from finish();
rollback;
