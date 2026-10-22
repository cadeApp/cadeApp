begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(53);

-- CC-032: historial de cancelaciones de asignación del repartidor. Datos sintéticos; todo se revierte al terminar.
-- Actores: 1 comercio dueño, 2 comercio ajeno, 3 cadete A, 4 cadete B, 5 cadete que nunca participó, 6 admin,
-- 7 comercio con consentimiento pendiente, 8 cadete con reconsentimiento pendiente.
create function pg_temp.actor(n integer) returns uuid language sql immutable as $$
  select ('10320000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select pg_temp.actor(n), '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'cc032-' || n || '@example.test',
  jsonb_build_object('role', case when n in (3, 4, 5, 8) then 'courier' else 'merchant' end)
from generate_series(1, 8) n;

update public.profiles set role = 'admin' where id = pg_temp.actor(6);
update public.profiles set consent_status = 'active' where id in (
  pg_temp.actor(1), pg_temp.actor(2), pg_temp.actor(3), pg_temp.actor(4), pg_temp.actor(5), pg_temp.actor(6)
);
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.actor(8);
update public.profiles set display_name = 'Juan P.' where id = pg_temp.actor(3);
update public.profiles set display_name = '   ' where id = pg_temp.actor(4);
update public.profiles set display_name = 'Cadete ajeno' where id = pg_temp.actor(5);
update public.couriers set status = 'approved', available = true
where profile_id in (pg_temp.actor(3), pg_temp.actor(4), pg_temp.actor(5), pg_temp.actor(8));

update public.platform_settings set value = 'true'::jsonb where key = 'pilot_active';

insert into public.zones (id, name, centroid_lat, centroid_lng, active) values
  (pg_temp.actor(10), 'CC032 Retiro', -27.430000, -65.620000, true),
  (pg_temp.actor(11), 'CC032 Entrega', -27.420000, -65.610000, true);

-- 20: pedido del comercio 1 asignado al cadete A (camino real). 21: pedido del comercio 2.
-- 22: paginación y nulos (filas sembradas). 23: clasificación (filas sembradas).
insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method,
  expires_at, published_at, matched_at
) values
  (pg_temp.actor(20), pg_temp.actor(1), 'matched', pg_temp.actor(10), pg_temp.actor(11), 'chico', 'cash',
    now() + interval '30 minutes', now(), now()),
  (pg_temp.actor(21), pg_temp.actor(2), 'published', pg_temp.actor(10), pg_temp.actor(11), 'chico', 'cash',
    now() + interval '30 minutes', now(), null),
  (pg_temp.actor(22), pg_temp.actor(1), 'published', pg_temp.actor(10), pg_temp.actor(11), 'chico', 'cash',
    now() + interval '30 minutes', now(), null),
  (pg_temp.actor(23), pg_temp.actor(1), 'published', pg_temp.actor(10), pg_temp.actor(11), 'chico', 'cash',
    now() + interval '30 minutes', now(), null);

insert into public.delivery_request_contacts (
  request_id, pickup_address, dropoff_address, recipient_name, recipient_phone, recipient_consent_declared
) values (pg_temp.actor(20), 'Retiro CC032', 'Entrega CC032', 'Persona CC032', '+543865000032', true);

insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
values (pg_temp.actor(30), pg_temp.actor(20), pg_temp.actor(3), 2500, 15, 'accepted');
update public.delivery_requests set accepted_offer_id = pg_temp.actor(30) where id = pg_temp.actor(20);

-- Invoca con el rol real authenticated (actor 0: autenticado sin sub). Devuelve {data} o {error, sqlstate}.
create function pg_temp.invoke(p_actor integer, p_sql text) returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    case when p_actor = 0 then '{"role":"authenticated"}'
    else jsonb_build_object('sub', pg_temp.actor(p_actor), 'role', 'authenticated')::text end, true);
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

create function pg_temp.history(
  p_actor integer,
  p_request integer,
  p_limit integer default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
) returns jsonb language sql as $$
  select pg_temp.invoke(p_actor, format(
    'select public.get_request_cancellation_history(%L::uuid, %s, %L::timestamptz, %L::uuid)',
    pg_temp.actor(p_request), coalesce(p_limit::text, 'null'), p_before_created_at, p_before_id
  ));
$$;

create function pg_temp.event_ids(p_result jsonb) returns uuid[] language sql as $$
  select coalesce(array_agg((e->>'id')::uuid order by ord), '{}')
  from jsonb_array_elements(p_result->'data'->'events') with ordinality as t(e, ord);
$$;

-- 1. Grants y endurecimiento de la función
select ok(
  has_function_privilege('authenticated',
    'public.get_request_cancellation_history(uuid, integer, timestamptz, uuid)', 'execute'),
  'authenticated puede ejecutar get_request_cancellation_history'
);
select ok(
  not has_function_privilege('anon',
    'public.get_request_cancellation_history(uuid, integer, timestamptz, uuid)', 'execute'),
  'anon no puede ejecutar get_request_cancellation_history'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(p.proacl) acl
    where p.oid = 'public.get_request_cancellation_history(uuid, integer, timestamptz, uuid)'::regprocedure
      and acl.grantee = 0
  ),
  'PUBLIC no tiene EXECUTE sobre get_request_cancellation_history'
);
select ok(
  (select p.prosecdef and p.provolatile = 's'
     and p.proconfig @> array['search_path=public, pg_temp']
   from pg_proc p
   where p.oid = 'public.get_request_cancellation_history(uuid, integer, timestamptz, uuid)'::regprocedure),
  'la función es security definer, stable y fija search_path = public, pg_temp'
);
select ok(
  (select count(*) = 1 from pg_policies
   where schemaname = 'public' and tablename = 'request_cancellation_reasons'),
  'request_cancellation_reasons conserva una única policy (la de admin)'
);

-- 14. Camino real: el cadete A cancela la asignación y el pedido vuelve a published, no a cancelled.
select is(
  pg_temp.invoke(3, format('select public.courier_cancel_match(%L, %L)', pg_temp.actor(20), 'Problema con el vehículo'))
    ->'data'->>'status',
  'published',
  'Invariante: courier_cancel_match devuelve published'
);
select ok(
  (select status = 'published' and cancel_reason is null and accepted_offer_id is null
   from public.delivery_requests where id = pg_temp.actor(20)),
  'Invariante: el pedido republicado queda published, sin cancel_reason ni oferta aceptada'
);
select is(
  pg_temp.event_ids(pg_temp.history(1, 20)),
  array(select id from public.request_cancellation_reasons
        where request_id = pg_temp.actor(20) and action = 'courier_cancel_match'),
  'Invariante: la RPC devuelve el evento histórico persistido por courier_cancel_match'
);

-- El segundo evento ocurre después: se separa el primero en el tiempo dentro de la transacción.
update public.request_cancellation_reasons set created_at = now() - interval '10 minutes'
where request_id = pg_temp.actor(20) and actor_id = pg_temp.actor(3);

-- 9. Rematch con el cadete B y segunda cancelación con texto libre.
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
values (pg_temp.actor(31), pg_temp.actor(20), pg_temp.actor(4), 2600, 15, 'accepted');
update public.delivery_requests
set status = 'matched', accepted_offer_id = pg_temp.actor(31), matched_at = now()
where id = pg_temp.actor(20);
select is(
  pg_temp.invoke(4, format('select public.courier_cancel_match(%L, %L)', pg_temp.actor(20), 'Se me pinchó la rueda en la ruta'))
    ->'data'->>'status',
  'published',
  'Rematch: el cadete B también cancela y el pedido vuelve a published'
);

-- Otras acciones del pedido que la proyección NO incluye (1-A).
insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason, created_at)
values
  (pg_temp.actor(20), null, pg_temp.actor(1), 'report_no_show', 'no_show', now() - interval '5 minutes'),
  (pg_temp.actor(20), null, pg_temp.actor(1), 'cancel_request', 'Ya no hace falta', now() - interval '4 minutes');

create temporary table ev on commit drop as
select
  (select id from public.request_cancellation_reasons
   where request_id = pg_temp.actor(20) and action = 'courier_cancel_match' and actor_id = pg_temp.actor(3)) as e1,
  (select id from public.request_cancellation_reasons
   where request_id = pg_temp.actor(20) and action = 'courier_cancel_match' and actor_id = pg_temp.actor(4)) as e2;

create temporary table r_merchant on commit drop as select pg_temp.history(1, 20) as r;

-- 1. Lectura legítima del comercio dueño
select is((select r->'data'->>'version' from r_merchant), '1.0', 'Comercio dueño: version 1.0');
select is((select r->'data'->>'requestId' from r_merchant), pg_temp.actor(20)::text, 'Comercio dueño: requestId del pedido');
select is(
  (select pg_temp.event_ids(r) from r_merchant),
  (select array[e2, e1] from ev),
  'Eventos múltiples: el comercio ve ambas cancelaciones en orden created_at desc, id desc, sin no_show ni cancel_request'
);
select ok(
  (select bool_and(e->>'action' = 'courier_cancel_match' and e->>'actionLabel' = 'Cancelado por el repartidor')
   from r_merchant, jsonb_array_elements(r->'data'->'events') e),
  'Comercio dueño: todos los eventos son courier_cancel_match con la etiqueta oficial'
);
select is(
  (select jsonb_build_array(e->>'category', e->>'categoryLabel', e->'actor'->>'displayName', e->>'offerId')
   from r_merchant, jsonb_array_elements(r->'data'->'events') e where (e->>'id')::uuid = (select e1 from ev)),
  jsonb_build_array('vehicle_breakdown', 'Problema con el vehículo', 'Juan P.', pg_temp.actor(30)::text),
  'Comercio dueño: el motivo oficial se clasifica exacto, con el nombre público del cadete y la oferta cancelada'
);
select is(
  (select jsonb_build_array(e->>'category', e->>'categoryLabel', e->'actor'->>'displayName', e->'actor'->>'role')
   from r_merchant, jsonb_array_elements(r->'data'->'events') e where (e->>'id')::uuid = (select e2 from ev)),
  jsonb_build_array('other', 'Otro motivo', 'Repartidor', 'courier'),
  'Comercio dueño: el texto libre se clasifica other y un nombre vacío usa el fallback Repartidor'
);
select ok(
  (select bool_and(e->'rawReason' = 'null'::jsonb) from r_merchant, jsonb_array_elements(r->'data'->'events') e),
  'Comercio dueño: rawReason es null en todos los eventos (D3)'
);
select is(
  (select r->'data'->'pagination' from r_merchant),
  '{"limit": 50, "hasMore": false, "nextCursor": null}'::jsonb,
  'Comercio dueño: paginación por defecto sin más páginas'
);

-- 2 y 3. Repartidor participante: solo sus propios eventos
select is(pg_temp.event_ids(pg_temp.history(3, 20)), (select array[e1] from ev),
  'Cadete A ve únicamente su propia cancelación');
select is(pg_temp.event_ids(pg_temp.history(4, 20)), (select array[e2] from ev),
  'Aislamiento: el cadete B ve únicamente la suya, no la del cadete A');
select ok(
  (select bool_and(e->'rawReason' = 'null'::jsonb and e->'actor'->>'id' = pg_temp.actor(3)::text)
   from jsonb_array_elements(pg_temp.history(3, 20)->'data'->'events') e),
  'Cadete A: su evento llega con su identidad y rawReason null'
);

-- 4. Repartidor ajeno denegado
select is(pg_temp.history(5, 20)->>'error', 'NOT_FOUND', 'Cadete que nunca participó recibe NOT_FOUND');
select is(pg_temp.history(5, 20)->>'sqlstate', 'P0001', 'Cadete ajeno: NOT_FOUND con SQLSTATE P0001');

-- 5. Comercio ajeno denegado
select is(pg_temp.history(2, 20)->>'error', 'NOT_FOUND', 'Comercio ajeno recibe NOT_FOUND');
select is(
  pg_temp.invoke(1, format('select public.get_request_cancellation_history(%L::uuid)', '10320000-0000-4000-8000-0000000009ff'))->>'error',
  'NOT_FOUND',
  'Comercio: un pedido inexistente da el mismo NOT_FOUND que uno ajeno'
);

-- 6. Denegación anónima
select is(pg_temp.history(0, 20)->>'error', 'UNAUTHENTICATED', 'Autenticado sin sub: UNAUTHENTICATED');
select is(pg_temp.history(0, 20)->>'sqlstate', 'P0001', 'Autenticado sin sub: SQLSTATE P0001');

-- 7. Guardia de consentimiento operacional
select is(pg_temp.history(7, 20)->>'error', 'UNAUTHORIZED_ACTOR', 'Comercio con consentimiento pending: UNAUTHORIZED_ACTOR');
select is(pg_temp.history(8, 20)->>'error', 'UNAUTHORIZED_ACTOR', 'Cadete con reconsent_required: UNAUTHORIZED_ACTOR');

-- 8. Lectura administrativa completa
select is(pg_temp.event_ids(pg_temp.history(6, 20)), (select array[e2, e1] from ev), 'Admin ve todas las cancelaciones del pedido');
select is(
  (select array_agg(e->>'rawReason' order by ord)
   from jsonb_array_elements(pg_temp.history(6, 20)->'data'->'events') with ordinality t(e, ord)),
  array['Se me pinchó la rueda en la ruta', 'Problema con el vehículo'],
  'Admin recibe rawReason con el texto original'
);
select is(
  pg_temp.invoke(6, format('select public.get_request_cancellation_history(%L::uuid)', '10320000-0000-4000-8000-0000000009ff'))->>'error',
  'NOT_FOUND',
  'Admin: NOT_FOUND solo si el pedido no existe'
);

-- 10. Paginación keyset del repartidor con eventos intercalados, desempate y cursor incompleto
insert into public.request_cancellation_reasons (id, request_id, offer_id, actor_id, action, reason, created_at) values
  ('10320000-0000-4000-8000-0000000000a1', pg_temp.actor(22), null, pg_temp.actor(3), 'courier_cancel_match', 'Emergencia', '2026-10-18 20:01:00.123456+00'),
  ('10320000-0000-4000-8000-0000000000b2', pg_temp.actor(22), null, pg_temp.actor(4), 'courier_cancel_match', 'Emergencia', '2026-10-18 20:02:00.123456+00'),
  ('10320000-0000-4000-8000-0000000000a3', pg_temp.actor(22), null, pg_temp.actor(3), 'courier_cancel_match', 'Emergencia', '2026-10-18 20:03:00.123456+00'),
  ('10320000-0000-4000-8000-0000000000c1', pg_temp.actor(22), null, null,            'courier_cancel_match', 'Emergencia', '2026-10-18 20:04:00.123456+00'),
  ('10320000-0000-4000-8000-0000000000c2', pg_temp.actor(22), null, pg_temp.actor(4), 'courier_cancel_match', 'Emergencia', '2026-10-18 20:04:00.123456+00');

create temporary table p1 on commit drop as select pg_temp.history(3, 22, 1) as r;
select is(pg_temp.event_ids((select r from p1)), array['10320000-0000-4000-8000-0000000000a3'::uuid],
  'Keyset: página 1 del cadete A (limit 1) trae su evento T3');
select is(
  (select r->'data'->'pagination' from p1),
  jsonb_build_object('limit', 1, 'hasMore', true, 'nextCursor', jsonb_build_object(
    'beforeCreatedAt', '2026-10-18 20:03:00.123456+00'::timestamptz,
    'beforeId', '10320000-0000-4000-8000-0000000000a3')),
  'Keyset: página 1 con hasMore y cursor de la última fila devuelta, con microsegundos'
);
create temporary table p2 on commit drop as
select pg_temp.history(3, 22, 1,
  ((select r from p1)->'data'->'pagination'->'nextCursor'->>'beforeCreatedAt')::timestamptz,
  ((select r from p1)->'data'->'pagination'->'nextCursor'->>'beforeId')::uuid) as r;
select is(pg_temp.event_ids((select r from p2)), array['10320000-0000-4000-8000-0000000000a1'::uuid],
  'Keyset: página 2 trae T1; el T2 del cadete B nunca entra al conjunto');
select is((select r->'data'->'pagination' from p2), '{"limit": 1, "hasMore": false, "nextCursor": null}'::jsonb,
  'Keyset: página 2 sin hasMore ni nextCursor');
select is(
  pg_temp.history(3, 22, 2)->'data'->'pagination'->'hasMore',
  'false'::jsonb,
  'Keyset: hasMore se calcula después del filtro por actor (2 propios con limit 2 no tienen más)'
);
select is(
  pg_temp.event_ids(pg_temp.history(1, 22)),
  array['10320000-0000-4000-8000-0000000000c2', '10320000-0000-4000-8000-0000000000c1',
        '10320000-0000-4000-8000-0000000000a3', '10320000-0000-4000-8000-0000000000b2',
        '10320000-0000-4000-8000-0000000000a1']::uuid[],
  'Keyset: un empate exacto en created_at desempata por id desc'
);
select is(
  pg_temp.event_ids(pg_temp.history(1, 22, 10, '2026-10-18 20:04:00.123456+00', '10320000-0000-4000-8000-0000000000c2')),
  array['10320000-0000-4000-8000-0000000000c1', '10320000-0000-4000-8000-0000000000a3',
        '10320000-0000-4000-8000-0000000000b2', '10320000-0000-4000-8000-0000000000a1']::uuid[],
  'Keyset: el cursor en un empate continúa con el id menor del mismo instante'
);
select is(pg_temp.history(1, 22, 10, '2026-10-18 20:04:00+00', null)->>'error', 'VALIDATION_ERROR',
  'Cursor incompleto (solo beforeCreatedAt): VALIDATION_ERROR');
select is(pg_temp.history(1, 22, 10, null, '10320000-0000-4000-8000-0000000000c2')->>'error', 'VALIDATION_ERROR',
  'Cursor incompleto (solo beforeId): VALIDATION_ERROR');
select is(pg_temp.history(5, 22, 10, null, '10320000-0000-4000-8000-0000000000c2')->>'error', 'VALIDATION_ERROR',
  'El cursor se valida antes de la pertenencia: un tercero no obtiene NOT_FOUND con un cursor incompleto');
select is(pg_temp.history(1, 22, 0)->'data'->'pagination'->'limit', '1'::jsonb, 'El límite se acota a 1 como mínimo');
select is(pg_temp.history(1, 22, 1000)->'data'->'pagination'->'limit', '100'::jsonb, 'El límite se acota a 100 como máximo');

-- 11. Nulos: perfil borrado (actor_id null) y oferta desvinculada (offer_id null)
select is(
  (select jsonb_build_array(e->'actor', e->'offerId')
   from jsonb_array_elements(pg_temp.history(1, 22)->'data'->'events') e
   where e->>'id' = '10320000-0000-4000-8000-0000000000c1'),
  '[null, null]'::jsonb,
  'Nulos: actor y offerId en null sin fabricar identidades'
);

-- Clasificación exacta (2-A): etiquetas oficiales, mayúsculas, tildes, códigos y texto libre
insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason, created_at)
select pg_temp.actor(23), null, pg_temp.actor(3), 'courier_cancel_match', reason,
  '2026-10-18 21:00:00+00'::timestamptz + (ord || ' minutes')::interval
from unnest(array[
  '  TUVE UN IMPREVISTO ', 'problema con el vehiculo', 'No puedo llegar al punto de retiro', 'pickup_issue',
  'Emergencia', 'personal_emergency', 'Otro', 'Emergencia médica en casa', 'moto rota'
]) with ordinality as t(reason, ord);
select is(
  (select array_agg(e->>'category' order by ord desc)
   from jsonb_array_elements(pg_temp.history(1, 23)->'data'->'events') with ordinality t(e, ord)),
  array['unforeseen_issue', 'vehicle_breakdown', 'pickup_issue', 'pickup_issue',
        'personal_emergency', 'personal_emergency', 'other', 'other', 'other'],
  'Clasificación por coincidencia exacta normalizada, sin subcadenas: lo no reconocido es other'
);
select is(
  (select array_agg(distinct e->>'categoryLabel' order by e->>'categoryLabel')
   from jsonb_array_elements(pg_temp.history(1, 23)->'data'->'events') e),
  array['Emergencia', 'No puedo llegar al punto de retiro', 'Otro motivo', 'Problema con el vehículo', 'Tuve un imprevisto'],
  'Las etiquetas salen de la allowlist en es-AR'
);

-- 12. Bypass de tabla directa (RLS)
select is(
  pg_temp.invoke(1, 'select to_jsonb(count(*)) from public.request_cancellation_reasons')->'data',
  '0'::jsonb,
  'RLS: el comercio dueño no lee request_cancellation_reasons por tabla'
);
select is(
  pg_temp.invoke(3, 'select to_jsonb(count(*)) from public.request_cancellation_reasons')->'data',
  '0'::jsonb,
  'RLS: el cadete participante no lee request_cancellation_reasons por tabla'
);

-- 13. Bypass de escritura directa
select is(
  pg_temp.invoke(3, format(
    'insert into public.request_cancellation_reasons (request_id, actor_id, action, reason) values (%L, %L, ''courier_cancel_match'', ''falso'') returning null::jsonb',
    pg_temp.actor(20), pg_temp.actor(3)))->>'sqlstate',
  '42501',
  'Escritura directa: INSERT rechazado por permisos'
);
select is(
  pg_temp.invoke(1, 'update public.request_cancellation_reasons set reason = ''x'' returning null::jsonb')->>'sqlstate',
  '42501',
  'Escritura directa: UPDATE rechazado por permisos'
);
select is(
  pg_temp.invoke(1, 'delete from public.request_cancellation_reasons returning null::jsonb')->>'sqlstate',
  '42501',
  'Escritura directa: DELETE rechazado por permisos'
);

-- Validación del id
select is(
  pg_temp.invoke(1, 'select public.get_request_cancellation_history(null::uuid)')->>'error',
  'VALIDATION_ERROR',
  'Un request id null da VALIDATION_ERROR'
);

-- 6.1. Rol anon sin EXECUTE
set local role anon;
select throws_ok(
  $$ select public.get_request_cancellation_history('10320000-0000-4000-8000-000000000020'::uuid) $$,
  '42501'::char(5),
  null::text,
  'anon: permission denied antes de ejecutar el cuerpo de la función'
);
reset role;

select * from finish();
rollback;
