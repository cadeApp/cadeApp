begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(44);

-- CC-037 (T-410): admin_list_trips. Autorización, privilegios, filtro «Con problemas», conteos, keyset y privacidad.
create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000370a1'::uuid $$;
create function pg_temp.merchant_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000370b1'::uuid $$;
create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000370c1'::uuid $$;
create function pg_temp.zone_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000370d1'::uuid $$;

-- Solicitudes: r(1) entregada completa, r(2) entrega parcial, r(3) repartidor soltó el viaje, r(4) cancelada sin
-- motivo, r(5) no-show, r(6) legacy entregada con incidente abierto, r(7) vencida sin ofertas, r(8) borrador.
-- r(3) y r(4) comparten created_at para probar el desempate del keyset.
create function pg_temp.r(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-00000037' || lpad(n::text, 4, '0'))::uuid
$$;
create function pg_temp.offer(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-00000038' || lpad(n::text, 4, '0'))::uuid
$$;
create function pg_temp.base_time() returns timestamptz language sql as $$ select '2026-10-22 03:00:00+00'::timestamptz $$;

create function pg_temp.act_as(actor_id uuid, aal text default 'aal2')
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', aal)::text,
    true
  );
end;
$$;

create function pg_temp.act_as_authenticated_without_subject()
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal2')::text, true);
end;
$$;

create function pg_temp.act_as_anon()
returns void language plpgsql as $$
begin
  set local role anon;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
end;
$$;

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Ids de una página en orden.
create function pg_temp.ids(p_result jsonb)
returns uuid[] language sql as $$
  select coalesce(array_agg((e->>'id')::uuid order by ord), '{}')
  from jsonb_array_elements(p_result->'items') with ordinality as t(e, ord)
$$;

-- Ítem de una solicitud dentro de una página.
create function pg_temp.item(p_result jsonb, p_id uuid)
returns jsonb language sql as $$
  select e from jsonb_array_elements(p_result->'items') e where e->>'id' = p_id::text
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc037.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc037.ma@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc037.ca@example.test', 'pwd', '{"role":"courier"}'::jsonb);

update public.profiles
set consent_status = 'active'
where id in (pg_temp.admin_a(), pg_temp.merchant_a(), pg_temp.courier_a());
update public.profiles set role = 'admin' where id = pg_temp.admin_a();
update public.profiles set display_name = 'Repartidor CC037' where id = pg_temp.courier_a();
update public.merchants set business_name = 'Comercio CC037' where profile_id = pg_temp.merchant_a();
update public.couriers
set status = 'approved', available = true, vehicle_type = 'moto', vehicle_plate = 'CC037AA'
where profile_id = pg_temp.courier_a();

insert into public.zones (id, name, centroid_lat, centroid_lng, active)
values (pg_temp.zone_a(), 'CC037 Zona A', -27.430000, -65.620000, true);

insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method,
  needs_change, cash_change_amount, notes, created_at, published_at, expires_at, delivered_at, cancelled_at
) values
  (pg_temp.r(1), pg_temp.merchant_a(), 'delivered', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null,
    pg_temp.base_time() - interval '1 hour', pg_temp.base_time() - interval '1 hour', null, pg_temp.base_time(), null),
  (pg_temp.r(2), pg_temp.merchant_a(), 'delivered', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', true, 9137, 'Indicaciones privadas CC037',
    pg_temp.base_time() - interval '2 hours', pg_temp.base_time() - interval '2 hours', null, pg_temp.base_time(), null),
  (pg_temp.r(3), pg_temp.merchant_a(), 'published', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null,
    pg_temp.base_time() - interval '3 hours', pg_temp.base_time() - interval '3 hours', pg_temp.base_time() + interval '1 hour', null, null),
  (pg_temp.r(4), pg_temp.merchant_a(), 'cancelled', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null,
    pg_temp.base_time() - interval '3 hours', pg_temp.base_time() - interval '3 hours', null, null, pg_temp.base_time()),
  (pg_temp.r(5), pg_temp.merchant_a(), 'published', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null,
    pg_temp.base_time() - interval '5 hours', pg_temp.base_time() - interval '5 hours', pg_temp.base_time() + interval '1 hour', null, null),
  (pg_temp.r(6), pg_temp.merchant_a(), 'delivered', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'transfer', false, null, null,
    pg_temp.base_time() - interval '6 hours', pg_temp.base_time() - interval '6 hours', null, pg_temp.base_time(), null),
  (pg_temp.r(7), pg_temp.merchant_a(), 'expired', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null,
    pg_temp.base_time() - interval '7 hours', pg_temp.base_time() - interval '7 hours', pg_temp.base_time() - interval '6 hours', null, null),
  (pg_temp.r(8), pg_temp.merchant_a(), 'draft', pg_temp.zone_a(), pg_temp.zone_a(), 'chico', 'cash', false, null, null,
    pg_temp.base_time() - interval '30 minutes', null, null, null, null);

-- Ofertas aceptadas de r(1) y r(2).
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status, decided_at)
values
  (pg_temp.offer(1), pg_temp.r(1), pg_temp.courier_a(), 1500, 15, 'accepted', pg_temp.base_time()),
  (pg_temp.offer(2), pg_temp.r(2), pg_temp.courier_a(), 1500, 15, 'accepted', pg_temp.base_time());
update public.delivery_requests set accepted_offer_id = pg_temp.offer(1) where id = pg_temp.r(1);
update public.delivery_requests set accepted_offer_id = pg_temp.offer(2) where id = pg_temp.r(2);

-- Entregas: r(1) 2 de 2; r(2) 1 de 2 con una no entregada. r(6) es legacy sin entregas.
insert into public.delivery_request_drops (
  request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status, delivered_at, failed_reason
) values
  (pg_temp.r(1), 1, pg_temp.zone_a(), 'chico', 'cash', false, 'delivered', pg_temp.base_time(), null),
  (pg_temp.r(1), 2, pg_temp.zone_a(), 'chico', 'cash', false, 'delivered', pg_temp.base_time(), null),
  (pg_temp.r(2), 1, pg_temp.zone_a(), 'chico', 'cash', false, 'delivered', pg_temp.base_time(), null),
  (pg_temp.r(2), 2, pg_temp.zone_a(), 'chico', 'cash', false, 'failed', null, 'El destinatario no responde');

insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason, created_at)
values
  (pg_temp.r(3), null, pg_temp.courier_a(), 'courier_cancel_match', 'Se me rompió la moto', pg_temp.base_time()),
  (pg_temp.r(5), null, pg_temp.merchant_a(), 'report_no_show', 'no_show', pg_temp.base_time());

insert into public.incidents (request_id, reporter_id, kind, description, status)
values (pg_temp.r(6), pg_temp.merchant_a(), 'damaged_goods', 'El paquete llegó roto', 'open');

-- 1-6. Definición, privilegios e índices
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.admin_list_trips(text, timestamptz, uuid, integer)'::regprocedure),
  'admin_list_trips es security definer'
);
select ok(
  (select p.proconfig @> array['search_path=public, pg_temp'] from pg_proc p
   where p.oid = 'public.admin_list_trips(text, timestamptz, uuid, integer)'::regprocedure),
  'admin_list_trips fija search_path = public, pg_temp'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_list_trips(text, timestamptz, uuid, integer)', 'execute'),
  'authenticated puede ejecutar admin_list_trips'
);
select ok(
  not has_function_privilege('anon', 'public.admin_list_trips(text, timestamptz, uuid, integer)', 'execute'),
  'anon no puede ejecutar admin_list_trips'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.admin_list_trips(text, timestamptz, uuid, integer)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC no tiene EXECUTE sobre admin_list_trips'
);
select ok(
  to_regclass('public.delivery_requests_admin_cursor_idx') is not null
    and to_regclass('public.request_cancellation_reasons_request_idx') is not null
    and to_regclass('public.incidents_request_idx') is not null,
  'existen los tres índices de soporte de CC-037'
);

-- 7-11. Autorización
select pg_temp.act_as_anon();
select throws_ok(
  $$ select public.admin_list_trips('all') $$,
  '42501', null,
  'anon no puede llamar a la RPC'
);
select pg_temp.reset_actor();

select pg_temp.act_as_authenticated_without_subject();
select throws_ok($$ select public.admin_list_trips('all') $$, 'P0001', 'UNAUTHENTICATED', 'sin sesión: UNAUTHENTICATED');
select pg_temp.reset_actor();

select pg_temp.act_as(pg_temp.merchant_a(), 'aal2');
select throws_ok($$ select public.admin_list_trips('all') $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'comercio: UNAUTHORIZED_ACTOR');
select pg_temp.reset_actor();

select pg_temp.act_as(pg_temp.courier_a(), 'aal2');
select throws_ok($$ select public.admin_list_trips('all') $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'repartidor: UNAUTHORIZED_ACTOR');
select pg_temp.reset_actor();

select pg_temp.act_as(pg_temp.admin_a(), 'aal1');
select throws_ok($$ select public.admin_list_trips('all') $$, 'P0001', 'AAL2_REQUIRED', 'admin aal1: AAL2_REQUIRED');
select pg_temp.reset_actor();

-- 12-15. Validación
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select throws_ok($$ select public.admin_list_trips('otro') $$, 'P0001', 'VALIDATION_ERROR', 'filtro inválido');
select throws_ok(
  $$ select public.admin_list_trips('all', now(), null) $$,
  'P0001', 'VALIDATION_ERROR', 'cursor incompleto'
);
select throws_ok($$ select public.admin_list_trips('all', null, null, 0) $$, 'P0001', 'VALIDATION_ERROR', 'límite 0');
select throws_ok($$ select public.admin_list_trips('all', null, null, 51) $$, 'P0001', 'VALIDATION_ERROR', 'límite 51');

-- 16-18. Filtro «Con problemas» y «Todos»
select is(
  pg_temp.ids(public.admin_list_trips('problems', null, null, 50)),
  array[
    pg_temp.r(2),
    greatest(pg_temp.r(3), pg_temp.r(4)),
    least(pg_temp.r(3), pg_temp.r(4)),
    pg_temp.r(5),
    pg_temp.r(6)
  ],
  'problems: entrega no realizada, repartidor que soltó, cancelada, no-show e incidente, en orden created_at desc, id desc'
);
select is(
  pg_temp.ids(public.admin_list_trips('all', null, null, 50)),
  array[
    pg_temp.r(1),
    pg_temp.r(2),
    greatest(pg_temp.r(3), pg_temp.r(4)),
    least(pg_temp.r(3), pg_temp.r(4)),
    pg_temp.r(5),
    pg_temp.r(6),
    pg_temp.r(7)
  ],
  'all: todas menos el borrador, incluidas la entregada completa y la vencida'
);
select ok(
  not (pg_temp.r(8) = any (pg_temp.ids(public.admin_list_trips('all', null, null, 50))))
    and not (pg_temp.r(8) = any (pg_temp.ids(public.admin_list_trips('problems', null, null, 50)))),
  'el borrador no aparece en ningún filtro'
);

-- 19-33. Conteos y datos de cada ítem
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(2)) -> 'dropsCount', '2'::jsonb,
  'r2: dropsCount 2'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(2)) -> 'deliveredDrops', '1'::jsonb,
  'r2: deliveredDrops 1'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(2)) -> 'failedDrops', '1'::jsonb,
  'r2: failedDrops 1'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(1)) -> 'failedDrops', '0'::jsonb,
  'r1: failedDrops 0'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(3)) -> 'courierReleases', '1'::jsonb,
  'r3: courierReleases 1'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(5)) -> 'noShowReports', '1'::jsonb,
  'r5: noShowReports 1'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(4)) -> 'cancelled', 'true'::jsonb,
  'r4: cancelled true'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(1)) -> 'cancelled', 'false'::jsonb,
  'r1: cancelled false'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(6)) -> 'incidents', '1'::jsonb,
  'r6: incidents 1'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(6)) -> 'openIncidents', '1'::jsonb,
  'r6: openIncidents 1'
);
select is(
  (pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(6)) -> 'dropsCount')::text
    || '/' || (pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(6)) -> 'deliveredDrops')::text,
  '1/1',
  'r6 legacy sin entregas: una entrega, entregada por el estado de la solicitud'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(1)) ->> 'courierName',
  'Repartidor CC037',
  'r1: courierName del repartidor de la oferta aceptada'
);
select ok(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(3)) -> 'courierName' = 'null'::jsonb,
  'r3 sin oferta aceptada: courierName null'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(1)) ->> 'merchantName',
  'Comercio CC037',
  'merchantName sale de business_name'
);
select is(
  pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(1)) ->> 'code',
  'REQ-' || upper(substr(pg_temp.r(1)::text, 1, 8)),
  'code con la fórmula de get_trip_details'
);

-- 34-40. Keyset: páginas de 2 sobre «Con problemas», cruzando el empate de created_at
select is(
  pg_temp.ids(public.admin_list_trips('problems', null, null, 2)),
  array[pg_temp.r(2), greatest(pg_temp.r(3), pg_temp.r(4))],
  'página 1 de problems'
);
select ok(
  public.admin_list_trips('problems', null, null, 2) -> 'nextCursor' <> 'null'::jsonb,
  'página 1 tiene nextCursor'
);
select is(
  pg_temp.ids(public.admin_list_trips(
    'problems',
    (public.admin_list_trips('problems', null, null, 2) -> 'nextCursor' ->> 'createdAt')::timestamptz,
    (public.admin_list_trips('problems', null, null, 2) -> 'nextCursor' ->> 'id')::uuid,
    2
  )),
  array[least(pg_temp.r(3), pg_temp.r(4)), pg_temp.r(5)],
  'página 2 de problems continúa en el empate sin repetir ni saltear'
);
select is(
  pg_temp.ids(public.admin_list_trips('problems', pg_temp.base_time() - interval '5 hours', pg_temp.r(5), 2)),
  array[pg_temp.r(6)],
  'última página de problems'
);
select ok(
  public.admin_list_trips('problems', pg_temp.base_time() - interval '5 hours', pg_temp.r(5), 2) -> 'nextCursor' = 'null'::jsonb,
  'la última página no tiene nextCursor'
);
select is(
  jsonb_array_length(public.admin_list_trips('all') -> 'items'),
  7,
  'sin límite usa 20 por defecto y devuelve las 7'
);
select ok(
  public.admin_list_trips('all') -> 'nextCursor' = 'null'::jsonb,
  'con menos de 20 no hay nextCursor'
);

-- 41-43. Privacidad: claves exactas, sin datos del destinatario
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.item(public.admin_list_trips('all', null, null, 50), pg_temp.r(2))) k),
  array[
    'cancelled', 'cancelledAt', 'code', 'courierId', 'courierName', 'courierReleases', 'createdAt', 'deliveredAt',
    'deliveredDrops', 'dropsCount', 'failedDrops', 'id', 'incidents', 'merchantId', 'merchantName', 'noShowReports',
    'openIncidents', 'publishedAt', 'status'
  ],
  'cada ítem tiene exactamente las claves del contrato'
);
select ok(
  public.admin_list_trips('all', null, null, 50)::text !~* '(recipient|dropoff_address|pin|phone|cash_change|notes|Indicaciones privadas|9137)',
  'la salida no tiene datos privados del destinatario ni de la solicitud'
);
select ok(
  public.admin_list_trips('all', null, null, 50)::text !~ 'El destinatario no responde|Se me rompió la moto',
  'la lista no devuelve motivos (los lee el detalle por RLS)'
);

select pg_temp.reset_actor();

-- 44. Solo lectura: la RPC es stable
select is(
  (select p.provolatile from pg_proc p where p.oid = 'public.admin_list_trips(text, timestamptz, uuid, integer)'::regprocedure),
  's'::"char",
  'admin_list_trips es stable'
);

select * from finish();
rollback;
