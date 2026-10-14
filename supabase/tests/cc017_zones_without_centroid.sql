begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(15);

create function pg_temp.has_zone_constraint(p_name text)
returns boolean language sql as $$
  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.zones'::regclass
      and c.conname = p_name
  )
$$;

-- 1. Solo se eliminó `zones_active_centroid`
select ok(
  not pg_temp.has_zone_constraint('zones_active_centroid'),
  'zones_active_centroid no longer exists'
);
select ok(pg_temp.has_zone_constraint('zones_centroid_pair'), 'zones_centroid_pair is preserved');
select ok(pg_temp.has_zone_constraint('zones_centroid_lat_bounds'), 'zones_centroid_lat_bounds is preserved');
select ok(pg_temp.has_zone_constraint('zones_centroid_lng_bounds'), 'zones_centroid_lng_bounds is preserved');
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.zones'::regclass),
  'RLS stays enabled on public.zones'
);

-- 2. Zona activa sin centroide: válida
select lives_ok(
  $$ insert into public.zones (name, centroid_lat, centroid_lng, active)
     values ('CC017 Sin Centroide', null, null, true) $$,
  'active zone with both centroid coordinates null is accepted'
);

select is(
  (
    select count(*)::integer
    from public.zones
    where name = 'CC017 Sin Centroide'
      and active
      and centroid_lat is null
      and centroid_lng is null
  ),
  1,
  'the active zone is stored with no centroid, nothing is filled in'
);

-- 3. Una sola coordenada: inválida
select throws_ok(
  $$ insert into public.zones (name, centroid_lat, centroid_lng, active)
     values ('CC017 Solo Lat', -27.430000, null, true) $$,
  '23514',
  null::text,
  'latitude without longitude is rejected by zones_centroid_pair'
);

select throws_ok(
  $$ insert into public.zones (name, centroid_lat, centroid_lng, active)
     values ('CC017 Solo Lng', null, -65.620000, true) $$,
  '23514',
  null::text,
  'longitude without latitude is rejected by zones_centroid_pair'
);

select throws_ok(
  $$ update public.zones set centroid_lat = -27.430000 where name = 'CC017 Sin Centroide' $$,
  '23514',
  null::text,
  'an existing zone without centroid cannot be updated to a single coordinate'
);

-- 4. Pareja completa fuera de bounds: inválida
select throws_ok(
  $$ insert into public.zones (name, centroid_lat, centroid_lng, active)
     values ('CC017 Lat Fuera', -27.500000, -65.620000, true) $$,
  '23514',
  null::text,
  'latitude out of the Aguilares bounding box is rejected'
);

select throws_ok(
  $$ insert into public.zones (name, centroid_lat, centroid_lng, active)
     values ('CC017 Lng Fuera', -27.430000, -65.700000, true) $$,
  '23514',
  null::text,
  'longitude out of the Aguilares bounding box is rejected'
);

-- 5. Zona activa con centroide válido: sigue funcionando
select lives_ok(
  $$ insert into public.zones (name, centroid_lat, centroid_lng, active)
     values ('CC017 Con Centroide', -27.430000, -65.620000, true) $$,
  'active zone with a valid centroid is still accepted'
);

select is(
  (
    select array[centroid_lat, centroid_lng]
    from public.zones
    where name = 'CC017 Con Centroide' and active
  ),
  array[-27.430000, -65.620000]::numeric[],
  'the valid centroid is stored unchanged'
);

-- 6. Unicidad de name
select throws_ok(
  $$ insert into public.zones (name, centroid_lat, centroid_lng, active)
     values ('CC017 Sin Centroide', null, null, true) $$,
  '23505',
  null::text,
  'zone names stay unique'
);

select * from finish();
rollback;
