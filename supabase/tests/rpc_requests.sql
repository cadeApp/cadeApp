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
  delete from public.incidents where request_id = pg_temp.actor(20);
  delete from public.offers where request_id = pg_temp.actor(20);
  delete from public.delivery_requests where id = pg_temp.actor(20);
  delete from public.rate_limits where subject in
    (pg_temp.actor(1)::text, pg_temp.actor(3)::text, pg_temp.actor(5)::text);
  update public.merchants set subscription_status = 'pilot', paid_until = null
  where profile_id = pg_temp.actor(1);
  update public.couriers set status = 'approved', available = true
  where profile_id = pg_temp.actor(3);
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
    else jsonb_build_object('sub', pg_temp.actor(p_actor), 'role', 'authenticated')::text end, true);
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
select ok(coalesce((select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  and not has_function_privilege('anon', p.oid, 'EXECUTE')
  from pg_proc p where p.oid = to_regprocedure('public.' || c.name || '(' || c.signature || ')')), false),
  name || ': SECURITY DEFINER, search_path y grants') from rpc_cases c;

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
          return next is((select status::text from public.delivery_requests where id = pg_temp.actor(20)),
            s, label || ': no cambia estado al rechazar');
        else
          return next ok(result ? 'data', label || ': acepta');
          return next is((select status::text from public.delivery_requests where id = pg_temp.actor(20)),
            expected, label || ': estado persistido');
          return next is(result->'data'->>'requestId', pg_temp.actor(20)::text, label || ': requestId de contrato');
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;
select * from pg_temp.matrix();

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

select pg_temp.fixture('delivered');
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

select * from finish();
rollback;
