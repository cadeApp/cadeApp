begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select no_plan();

-- CC-019: área de servicio de Aguilares lat -27.4800..-27.3800, lng -65.6450..-65.5800.
-- Datos sintéticos; todo se revierte al terminar.
create function pg_temp.actor(n integer) returns uuid language sql immutable as $$
  select ('10190000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values (pg_temp.actor(1), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'cc019-merchant@example.test', '{"role": "merchant"}'::jsonb);
update public.profiles set consent_status = 'active' where id = pg_temp.actor(1);
update public.merchants set subscription_status = 'pilot', paid_until = null where profile_id = pg_temp.actor(1);
update public.platform_settings set value = 'true'::jsonb where key = 'pilot_active';

insert into public.zones (id, name, centroid_lat, centroid_lng, active) values
  (pg_temp.actor(10), 'CC019 Retiro', -27.432000, -65.615000, true),
  (pg_temp.actor(11), 'CC019 Entrega', -27.425000, -65.608000, true),
  (pg_temp.actor(12), 'CC019 Sonda', null, null, true);

-- Referencias aprobadas por Lautaro073 (docs/contracts/CC-019.md, tabla «Problema»).
create temporary table cc019_inside (name text primary key, lat numeric(9, 6), lng numeric(9, 6)) on commit drop;
insert into cc019_inside values
  ('17 San Lorenzo', -27.456010, -65.613950),
  ('19 Gambarte', -27.456143, -65.603636),
  ('20 Terán', -27.456337, -65.602134),
  ('67 Virgen de la Merced', -27.455233, -65.602138),
  ('65 Santa Rosa', -27.466365, -65.619503),
  ('65 Santa Rosa extremo sur', -27.467156, -65.619651),
  ('55 San Miguel', -27.428441, -65.589211),
  ('56 San Antonio', -27.427272, -65.595871),
  ('25 El Ceibal', -27.396438, -65.635938),
  ('26 Santa Emilia', -27.401873, -65.618133),
  ('Monte Rico caserío', -27.383486, -65.627223),
  ('esquina sudoeste exacta', -27.480000, -65.645000),
  ('esquina noreste exacta', -27.380000, -65.580000);

create temporary table cc019_outside (edge text primary key, lat numeric(9, 6), lng numeric(9, 6)) on commit drop;
insert into cc019_outside values
  ('sur', -27.480100, -65.615000),
  ('norte', -27.379900, -65.615000),
  ('oeste', -27.432000, -65.645100),
  ('este', -27.432000, -65.579900);

select is((select count(*)::integer from cc019_inside), 13, 'CC-019: 11 referencias aprobadas + 2 esquinas exactas');

-- Ejecuta SQL como un actor authenticated; los errores no interrumpen el resto de pgTAP.
create function pg_temp.invoke(p_actor integer, p_sql text) returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.actor(p_actor), 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

-- Ejecuta DML como postgres y devuelve el SQLSTATE o 'ok'.
create function pg_temp.try_dml(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

-- Solicitud en borrador con retiro en (lat, lng) y entrega en el centro; luego publish_request.
create function pg_temp.publish_from(p_lat numeric, p_lng numeric) returns jsonb language plpgsql as $$
begin
  delete from public.rate_limits where subject = pg_temp.actor(1)::text;
  delete from public.audit_log where target_id = pg_temp.actor(20)::text;
  delete from public.delivery_requests where id = pg_temp.actor(20);
  insert into public.delivery_requests (
    id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
    recipient_payment_method, expires_at
  ) values (
    pg_temp.actor(20), pg_temp.actor(1), 'draft', pg_temp.actor(10), pg_temp.actor(11), 'chico', 'cash',
    now() + interval '30 minutes'
  );
  insert into public.delivery_request_contacts (
    request_id, pickup_address, dropoff_address, recipient_name, recipient_phone,
    recipient_consent_declared, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng
  ) values (pg_temp.actor(20), 'Retiro de prueba', 'Entrega de prueba', 'Persona de prueba',
    '+543865000000', true, p_lat, p_lng, -27.432000, -65.615000);
  return pg_temp.invoke(1, format('select public.publish_request(%L)', pg_temp.actor(20)));
exception when others then
  -- Un CHECK de delivery_request_contacts rechazó el pin: se informa como error, sin abortar pgTAP.
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

-- 1. Los 8 CHECK conservan su nombre.
select is(
  (select count(*)::integer from pg_constraint
   where conname in (
     'zones_centroid_lat_bounds', 'zones_centroid_lng_bounds',
     'merchants_default_pickup_lat_bounds', 'merchants_default_pickup_lng_bounds',
     'contacts_pickup_lat_bounds', 'contacts_pickup_lng_bounds',
     'contacts_dropoff_lat_bounds', 'contacts_dropoff_lng_bounds')),
  8,
  'CC-019: los 8 CHECK de bounds existen con su nombre'
);

-- 2. Dentro del área: los CHECK aceptan cada punto.
select is(
  pg_temp.try_dml(format('update public.zones set centroid_lat = %s, centroid_lng = %s where id = %L',
    lat, lng, pg_temp.actor(12))),
  'ok', 'CC-019 zones acepta ' || name) from cc019_inside;

select is(
  pg_temp.try_dml(format(
    'update public.merchants set default_pickup_lat = %s, default_pickup_lng = %s where profile_id = %L',
    lat, lng, pg_temp.actor(1))),
  'ok', 'CC-019 merchants acepta ' || name) from cc019_inside;

-- 3. Dentro del área: calculate_route_distance y publish_request aceptan cada punto.
select ok(
  (pg_temp.invoke(1, format('select public.calculate_route_distance(%s, %s, -27.432000, -65.615000)', lat, lng))
    -> 'data' ->> 'routeDistanceM') is not null,
  'CC-019 calculate_route_distance acepta ' || name) from cc019_inside;

select is(
  pg_temp.publish_from(lat, lng) -> 'data' ->> 'status',
  'published', 'CC-019 delivery_request_contacts y publish_request aceptan retiro en ' || name) from cc019_inside;

-- La publicación va en su propia sentencia: una subconsulta en la misma sentencia vería la foto previa.
select pg_temp.publish_from(-27.383486, -65.627223) -> 'data' ->> 'status' as cc019_last_publish;
select is(
  (select array[pickup_lat, pickup_lng] from public.delivery_request_contacts where request_id = pg_temp.actor(20)),
  array[-27.383486, -65.627223]::numeric[],
  'CC-019 delivery_request_contacts conserva el pin periférico tal cual'
);

-- 4. Fuera del área: los CHECK rechazan (23514).
select is(
  pg_temp.try_dml(format('update public.zones set centroid_lat = %s, centroid_lng = %s where id = %L',
    lat, lng, pg_temp.actor(12))),
  '23514', 'CC-019 zones rechaza apenas fuera del borde ' || edge) from cc019_outside;

select is(
  pg_temp.try_dml(format(
    'update public.merchants set default_pickup_lat = %s, default_pickup_lng = %s where profile_id = %L',
    lat, lng, pg_temp.actor(1))),
  '23514', 'CC-019 merchants rechaza apenas fuera del borde ' || edge) from cc019_outside;

select is(
  pg_temp.try_dml(format(
    'update public.delivery_request_contacts set dropoff_lat = %s, dropoff_lng = %s where request_id = %L',
    lat, lng, pg_temp.actor(20))),
  '23514', 'CC-019 delivery_request_contacts rechaza apenas fuera del borde ' || edge) from cc019_outside;

-- 5. Fuera del área: calculate_route_distance rechaza con OUT_OF_BOUNDS_AGUILARES.
select is(
  pg_temp.invoke(1, format('select public.calculate_route_distance(%s, %s, -27.432000, -65.615000)', lat, lng))
    ->> 'error',
  'OUT_OF_BOUNDS_AGUILARES', 'CC-019 calculate_route_distance rechaza apenas fuera del borde ' || edge)
from cc019_outside;

-- 6. Fuera del área: el guard propio de publish_request rechaza. Los CHECK ya impiden guardar estos pins; se
-- quitan solo dentro de esta transacción (rollback final) para probar la RPC por sí misma.
alter table public.delivery_request_contacts
  drop constraint contacts_pickup_lat_bounds, drop constraint contacts_pickup_lng_bounds;

select is(
  pg_temp.publish_from(lat, lng) ->> 'error',
  'OUT_OF_BOUNDS_AGUILARES', 'CC-019 publish_request rechaza retiro apenas fuera del borde ' || edge)
from cc019_outside;

-- 7. Las RPC conservan SECURITY DEFINER, search_path y grants.
select ok(
  coalesce((select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    where p.oid = to_regprocedure('public.calculate_route_distance(numeric,numeric,numeric,numeric,uuid,uuid,text,text)')), false),
  'CC-019 calculate_route_distance: SECURITY DEFINER, search_path y grants'
);

select ok(
  coalesce((select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    from pg_proc p
    where p.oid = to_regprocedure('app_private.request_cycle(text,uuid,text,boolean,text,text)')), false),
  'CC-019 request_cycle: SECURITY DEFINER, search_path y sin EXECUTE para authenticated'
);

select * from finish();
rollback;
