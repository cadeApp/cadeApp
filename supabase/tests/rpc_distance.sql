begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(20);

-- IDs de prueba
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000051a1'::uuid $$;
create function pg_temp.merchant_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000051b1'::uuid $$;
create function pg_temp.courier_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000051c1'::uuid $$;
create function pg_temp.zone_a_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000052a1'::uuid $$;
create function pg_temp.zone_b_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000052b1'::uuid $$;

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

-- Setup inicial
do $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-dist@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'merch-dist@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.courier_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cour-dist@example.test', 'pwd', '{"role": "courier"}');

  update public.profiles set role = 'admin', consent_status = 'active' where id = pg_temp.admin_id();
  update public.profiles set role = 'merchant', consent_status = 'active' where id = pg_temp.merchant_id();
  update public.profiles set role = 'courier', consent_status = 'active' where id = pg_temp.courier_id();
  update public.couriers set status = 'approved', available = true where profile_id = pg_temp.courier_id();

  insert into public.zones (id, name, centroid_lat, centroid_lng, active)
  values
    (pg_temp.zone_a_id(), 'Zona Centro T106', -27.433000, -65.616000, true),
    (pg_temp.zone_b_id(), 'Zona Norte T106', -27.425000, -65.608000, true)
  on conflict (name) do update
  set centroid_lat = excluded.centroid_lat,
      centroid_lng = excluded.centroid_lng,
      active = excluded.active;
end;
$$;

-- 1. Verificación de existencia de RPC calculate_route_distance
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'calculate_route_distance'
  ),
  'calculate_route_distance RPC function exists in public schema'
);

-- 2. SECURITY DEFINER y search_path fijo
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'calculate_route_distance'
      and p.prosecdef = true
      and p.proconfig::text ilike '%search_path=public, pg_temp%'
  ),
  'calculate_route_distance is SECURITY DEFINER with fixed search_path'
);

-- 3. UNAUTHENTICATED cuando no hay sesión
select pg_temp.act_as('anon');
select throws_ok(
  $$select public.calculate_route_distance(-27.432000, -65.615000, -27.425000, -65.608000)$$,
  'P0001',
  'UNAUTHENTICATED',
  'calculate_route_distance rejects unauthenticated calls'
);

-- 4. OUT_OF_BOUNDS_AGUILARES ante latitud fuera de Aguilares (-27.4550 a -27.4100)
select pg_temp.act_as('authenticated', pg_temp.merchant_id());
select throws_ok(
  $$select public.calculate_route_distance(-26.800000, -65.615000, -27.425000, -65.608000)$$,
  'P0001',
  'OUT_OF_BOUNDS_AGUILARES',
  'calculate_route_distance rejects origin latitude outside Aguilares bounding box'
);

-- 5. OUT_OF_BOUNDS_AGUILARES ante longitud fuera de Aguilares (-65.6400 a -65.5950)
select throws_ok(
  $$select public.calculate_route_distance(-27.432000, -65.200000, -27.425000, -65.608000)$$,
  'P0001',
  'OUT_OF_BOUNDS_AGUILARES',
  'calculate_route_distance rejects origin longitude outside Aguilares bounding box'
);

-- 6. OUT_OF_BOUNDS_AGUILARES en coordenadas de destino
select throws_ok(
  $$select public.calculate_route_distance(-27.432000, -65.615000, -27.460000, -65.608000)$$,
  'P0001',
  'OUT_OF_BOUNDS_AGUILARES',
  'calculate_route_distance rejects destination coordinates outside Aguilares bounding box'
);

-- 7. VALIDATION_ERROR si origen tiene latitud pero no longitud
select throws_ok(
  $$select public.calculate_route_distance(-27.432000, null, -27.425000, -65.608000)$$,
  'P0001',
  'VALIDATION_ERROR',
  'calculate_route_distance rejects incomplete origin coordinate pair'
);

-- 8. VALIDATION_ERROR si destino tiene longitud pero no latitud
select throws_ok(
  $$select public.calculate_route_distance(-27.432000, -65.615000, null, -65.608000)$$,
  'P0001',
  'VALIDATION_ERROR',
  'calculate_route_distance rejects incomplete destination coordinate pair'
);

-- 9. Puntos idénticos devuelven 0 m
select is(
  (public.calculate_route_distance(-27.432000, -65.615000, -27.432000, -65.615000)->>'routeDistanceM')::integer,
  0,
  'calculate_route_distance returns 0 m for identical points'
);

-- 10. Cálculo exacto con factor 1.30 y redondeo a 500 m (~1353m raw -> 1500m)
select is(
  (public.calculate_route_distance(-27.432000, -65.615000, -27.425000, -65.608000)->>'routeDistanceM')::integer,
  1500,
  'calculate_route_distance calculates Haversine x 1.30 rounded to nearest 500m'
);

-- 11. Distancia corta no idéntica respeta piso mínimo de 500 m (~158m raw -> 500m)
select is(
  (public.calculate_route_distance(-27.420000, -65.610000, -27.421000, -65.610500)->>'routeDistanceM')::integer,
  500,
  'calculate_route_distance clamps short non-zero distance to 500m minimum'
);

-- 12. Fallback a centroides de zones cuando las coordenadas son nulas (por zone_id)
select is(
  (public.calculate_route_distance(
    null, null, null, null,
    pg_temp.zone_a_id(), pg_temp.zone_b_id(),
    'Zona Centro T106', 'Zona Norte T106'
  )->>'routeDistanceM')::integer,
  1500,
  'calculate_route_distance falls back to zone centroids when coordinates are null'
);

-- 13. Fallback incluye displayLabel con formato "De barrio X a barrio Y"
select is(
  (public.calculate_route_distance(
    null, null, null, null,
    pg_temp.zone_a_id(), pg_temp.zone_b_id(),
    'Zona Centro T106', 'Zona Norte T106'
  )->>'displayLabel')::text,
  'De barrio Zona Centro T106 a barrio Zona Norte T106',
  'calculate_route_distance formats displayLabel correctly in zone fallback'
);

-- 14. Fallback por nombres de zona cuando zone_id no se especifica
select is(
  (public.calculate_route_distance(
    null, null, null, null,
    null, null,
    'Zona Centro T106', 'Zona Norte T106'
  )->>'routeDistanceM')::integer,
  1500,
  'calculate_route_distance falls back to zone centroids resolved by zone name'
);

-- 15. INVALID_ZONE si la zona de retiro no existe en fallback
select throws_ok(
  $$select public.calculate_route_distance(
    null, null, null, null,
    '00000000-0000-0000-0000-000000009999'::uuid, pg_temp.zone_b_id(),
    'Inexistente', 'Zona Norte T106'
  )$$,
  'P0001',
  'INVALID_ZONE',
  'calculate_route_distance rejects invalid pickup zone in fallback'
);

-- 16. INVALID_ZONE si la zona de entrega no existe en fallback
select throws_ok(
  $$select public.calculate_route_distance(
    null, null, null, null,
    pg_temp.zone_a_id(), '00000000-0000-0000-0000-000000009999'::uuid,
    'Zona Centro T106', 'Inexistente'
  )$$,
  'P0001',
  'INVALID_ZONE',
  'calculate_route_distance rejects invalid dropoff zone in fallback'
);

-- 17. Modo con coordenadas y nombres de zona devuelve ambos (distancia y displayLabel)
select ok(
  (public.calculate_route_distance(
    -27.432000, -65.615000, -27.425000, -65.608000,
    pg_temp.zone_a_id(), pg_temp.zone_b_id(),
    'Zona Centro T106', 'Zona Norte T106'
  ) ? 'routeDistanceM')
  and (public.calculate_route_distance(
    -27.432000, -65.615000, -27.425000, -65.608000,
    pg_temp.zone_a_id(), pg_temp.zone_b_id(),
    'Zona Centro T106', 'Zona Norte T106'
  ) ? 'displayLabel'),
  'calculate_route_distance returns both routeDistanceM and displayLabel when coords and zones provided'
);

-- 18. Repartidor aprobado puede invocar calculate_route_distance
select pg_temp.act_as('authenticated', pg_temp.courier_id());
select is(
  (public.calculate_route_distance(-27.432000, -65.615000, -27.425000, -65.608000)->>'routeDistanceM')::integer,
  1500,
  'approved courier can execute calculate_route_distance'
);

-- 19. Administrador puede invocar calculate_route_distance
select pg_temp.act_as('authenticated', pg_temp.admin_id());
select is(
  (public.calculate_route_distance(-27.432000, -65.615000, -27.425000, -65.608000)->>'routeDistanceM')::integer,
  1500,
  'admin can execute calculate_route_distance'
);

-- 20. Grants mínimos: ejecución revocada de public y anon
select ok(
  not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'calculate_route_distance'
      and grantee in ('PUBLIC', 'anon')
  ),
  'calculate_route_distance execution is revoked from public and anon'
);

select * from finish();
rollback;
