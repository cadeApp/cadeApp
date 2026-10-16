begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Helpers de IDs predecibles
create function pg_temp.cc028_id(p_suffix text) returns uuid language sql immutable as $$
  select ('40000000-0000-4000-8000-' || lpad(p_suffix, 12, '0'))::uuid;
$$;

create function pg_temp.merchant_id() returns uuid language sql immutable as $$
  select pg_temp.cc028_id('281');
$$;

create function pg_temp.other_merchant_id() returns uuid language sql immutable as $$
  select pg_temp.cc028_id('282');
$$;

create function pg_temp.courier_id() returns uuid language sql immutable as $$
  select pg_temp.cc028_id('283');
$$;

create function pg_temp.admin_id() returns uuid language sql immutable as $$
  select pg_temp.cc028_id('284');
$$;

create function pg_temp.zone_id() returns uuid language sql immutable as $$
  select pg_temp.cc028_id('285');
$$;

-- Helpers de ejecución como actor autenticado / anónimo
create function pg_temp.as_authenticated(p_actor uuid, p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

create function pg_temp.as_unauthenticated(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

-- Seed de prueba
insert into public.zones (id, name, centroid_lat, centroid_lng, active)
values (pg_temp.zone_id(), 'Aguilares - Test Zone CC028', -27.432, -65.616, true)
on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc028.m1@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.other_merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc028.m2@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc028.c1@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc028.a1@example.test', 'pwd', '{"role":"merchant"}'::jsonb)
on conflict (id) do nothing;

update public.profiles
set consent_status = 'active'
where id in (pg_temp.merchant_id(), pg_temp.other_merchant_id(), pg_temp.courier_id(), pg_temp.admin_id());

update public.profiles
set display_name = 'Comercio Original', phone = '3865000001', role = 'merchant'
where id = pg_temp.merchant_id();

update public.profiles
set display_name = 'Otro Comercio', phone = '3865000002', role = 'merchant'
where id = pg_temp.other_merchant_id();

update public.profiles
set display_name = 'Cadete Test', phone = '3865000003', role = 'courier'
where id = pg_temp.courier_id();

update public.profiles
set display_name = 'Admin Test', phone = '3865000004', role = 'admin'
where id = pg_temp.admin_id();

insert into public.merchants (
  profile_id,
  business_name,
  default_pickup_address,
  default_pickup_zone_id,
  default_pickup_lat,
  default_pickup_lng,
  notes,
  subscription_status
)
values (
  pg_temp.merchant_id(),
  'Comercio Original',
  'Av. Sarmiento 123',
  pg_temp.zone_id(),
  -27.432,
  -65.616,
  'Nota previa',
  'pilot'
)
on conflict (profile_id) do update set
  business_name = 'Comercio Original',
  default_pickup_address = 'Av. Sarmiento 123',
  default_pickup_zone_id = pg_temp.zone_id(),
  default_pickup_lat = -27.432,
  default_pickup_lng = -65.616,
  notes = 'Nota previa',
  subscription_status = 'pilot';

-- 1. Test: Actor no autenticado -> UNAUTHENTICATED
select is(
  (pg_temp.as_unauthenticated('select public.update_my_merchant_profile(''{"businessName":"X"}''::jsonb)'))->>'error',
  'UNAUTHENTICATED',
  'CC-028 / H03: Llamada sin sesión arroja UNAUTHENTICATED'
);

-- 2. Test: Actor courier -> UNAUTHORIZED_ACTOR
select is(
  (pg_temp.as_authenticated(pg_temp.courier_id(), 'select public.update_my_merchant_profile(''{"businessName":"X"}''::jsonb)'))->>'error',
  'UNAUTHORIZED_ACTOR',
  'CC-028 / H03: Actor courier no puede invocar update_my_merchant_profile'
);

-- 3. Test: Actor admin -> UNAUTHORIZED_ACTOR
select is(
  (pg_temp.as_authenticated(pg_temp.admin_id(), 'select public.update_my_merchant_profile(''{"businessName":"X"}''::jsonb)'))->>'error',
  'UNAUTHORIZED_ACTOR',
  'CC-028 / H03: Actor admin no puede invocar update_my_merchant_profile'
);

-- 4. Test: Payload vacío {} -> VALIDATION_ERROR
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{}''::jsonb)'))->>'error',
  'VALIDATION_ERROR',
  'CC-028 / H02: Payload vacío es rechazado con VALIDATION_ERROR'
);

-- 5. Test: Clave desconocida -> VALIDATION_ERROR
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"unknownKey":"hack"}''::jsonb)'))->>'error',
  'VALIDATION_ERROR',
  'CC-028 / H02: Claves desconocidas son rechazadas con VALIDATION_ERROR'
);

-- 6. Test: Coordenadas asimétricas (lat sin lng) -> VALIDATION_ERROR
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"defaultPickupLat":-27.432}''::jsonb)'))->>'error',
  'VALIDATION_ERROR',
  'CC-028 / H02: Coordenadas asimétricas (solo lat) son rechazadas con VALIDATION_ERROR'
);

-- 7. Test: Coordenadas asimétricas (lat null y lng con número) -> VALIDATION_ERROR
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"defaultPickupLat":null,"defaultPickupLng":-65.616}''::jsonb)'))->>'error',
  'VALIDATION_ERROR',
  'CC-028 / H02: Coordenadas asimétricas (lat null con lng numérico) son rechazadas'
);

-- 8. Test: Coordenadas fuera de Aguilares -> OUT_OF_BOUNDS_AGUILARES
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"defaultPickupLat":-34.6037,"defaultPickupLng":-58.3816}''::jsonb)'))->>'error',
  'OUT_OF_BOUNDS_AGUILARES',
  'CC-028 / H02: Coordenadas fuera de Aguilares arrojan OUT_OF_BOUNDS_AGUILARES'
);

-- 9. Test: Teléfono inválido con letras -> VALIDATION_ERROR
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"phone":"3865abc123"}''::jsonb)'))->>'error',
  'VALIDATION_ERROR',
  'CC-028 / H02: Teléfono con letras es rechazado con VALIDATION_ERROR'
);

-- 10. Test: Zona inexistente -> VALIDATION_ERROR
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"defaultPickupZoneId":"00000000-0000-0000-0000-000000000999"}''::jsonb)'))->>'error',
  'VALIDATION_ERROR',
  'CC-028 / H02: Zona inexistente es rechazada con VALIDATION_ERROR'
);

-- 11. Test: Actualización exitosa parcial de solo phone -> preserva demás columnas
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"phone":"+54 9 3865 11-2233"}''::jsonb)'))->'data'->>'phone',
  '3865112233',
  'CC-028 / H02: Actualización parcial de teléfono lo normaliza a 10 dígitos'
);

select is(
  (select p.phone from public.profiles p where p.id = pg_temp.merchant_id()),
  '3865112233',
  'CC-028 / H02: profiles.phone actualizado en base'
);

select is(
  (select m.business_name from public.merchants m where m.profile_id = pg_temp.merchant_id()),
  'Comercio Original',
  'CC-028 / H02: business_name no modificado se preserva intacto'
);

-- 12. Test: Actualización de businessName -> atómica en profiles.display_name y merchants.business_name
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"businessName":"Pizzería Don Yisus"}''::jsonb)'))->'data'->>'businessName',
  'Pizzería Don Yisus',
  'CC-028 / H02: Retorna businessName actualizado'
);

select is(
  (select p.display_name from public.profiles p where p.id = pg_temp.merchant_id()),
  'Pizzería Don Yisus',
  'CC-028 / H02: profiles.display_name actualizado atómicamente'
);

select is(
  (select m.business_name from public.merchants m where m.profile_id = pg_temp.merchant_id()),
  'Pizzería Don Yisus',
  'CC-028 / H02: merchants.business_name actualizado atómicamente'
);

-- 13. Test: Borrado explícito de pin (coordenadas null/null)
select is(
  (pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.update_my_merchant_profile(''{"defaultPickupLat":null,"defaultPickupLng":null}''::jsonb)'))->'data'->>'defaultPickupLat',
  null,
  'CC-028 / H01: defaultPickupLat borrado explícitamente'
);

select is(
  (select m.default_pickup_lat from public.merchants m where m.profile_id = pg_temp.merchant_id()),
  null,
  'CC-028 / H01: default_pickup_lat persistido como null en base'
);

select is(
  (select m.default_pickup_lng from public.merchants m where m.profile_id = pg_temp.merchant_id()),
  null,
  'CC-028 / H01: default_pickup_lng persistido como null en base'
);

-- 14. Test: Auditoría registrada en public.audit_log
select is(
  (select count(*)::integer from public.audit_log a where a.actor_id = pg_temp.merchant_id() and a.action = 'merchant_profile_update'),
  3,
  'CC-028 / H04: Cada actualización exitosa genera una entrada en audit_log'
);

-- 15. Test: Barrera RLS de UPDATE directo contra columnas protegidas (subscription_status)
select throws_matching(
  'update public.merchants set subscription_status = ''active'' where profile_id = pg_temp.merchant_id()',
  'new row violates row-level security policy',
  'CC-028 / H03: UPDATE directo a subscription_status es bloqueado por RLS merchants_update_self'
);

select * from finish();
rollback;
