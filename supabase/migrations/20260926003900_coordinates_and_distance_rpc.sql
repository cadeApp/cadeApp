-- T-106: Migración, RLS de coordenadas, vista merchant_public (PR56-H13), freeze created_at (PR56-H22)
-- y RPC calculate_route_distance(lat1, lng1, lat2, lng2) con Haversine x 1.30, redondeo a 500m y fallback a zones

-- 1. Cerrar acceso directo de couriers sobre public.merchants y definir merchant_public (PR56-H13 / PR105-H01)
drop policy if exists merchants_select_courier on public.merchants;

create or replace view public.merchant_public
with (security_barrier = true)
as
select
  m.profile_id,
  m.business_name,
  m.default_pickup_zone_id,
  m.default_pickup_address
from public.merchants m
where
  m.profile_id = auth.uid()
  or app_private.is_admin()
  or (
    app_private.is_approved_courier()
    and app_private.is_merchant_visible_to_courier(m.profile_id, auth.uid())
  );

revoke all on public.merchant_public from public, anon;
grant select on public.merchant_public to authenticated;

-- 2. Freeze created_at en profiles_update_self (PR56-H22)
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    id = auth.uid()
    and app_private.is_active_operational_actor()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and consent_status = (select p.consent_status from public.profiles p where p.id = auth.uid())
    and created_at = (select p.created_at from public.profiles p where p.id = auth.uid())
  );

-- 3. RPC calculate_route_distance
create or replace function public.calculate_route_distance(
  p_pickup_lat numeric default null,
  p_pickup_lng numeric default null,
  p_dropoff_lat numeric default null,
  p_dropoff_lng numeric default null,
  p_pickup_zone_id uuid default null,
  p_dropoff_zone_id uuid default null,
  p_pickup_zone_name text default null,
  p_dropoff_zone_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role public.profile_role;
  v_lat1 numeric;
  v_lng1 numeric;
  v_lat2 numeric;
  v_lng2 numeric;
  v_pickup_zone_name text := nullif(trim(p_pickup_zone_name), '');
  v_dropoff_zone_name text := nullif(trim(p_dropoff_zone_name), '');
  v_pickup_lookup_name text;
  v_dropoff_lookup_name text;
  v_pickup_centroid_lat numeric;
  v_pickup_centroid_lng numeric;
  v_dropoff_centroid_lat numeric;
  v_dropoff_centroid_lng numeric;
  v_dlat double precision;
  v_dlng double precision;
  v_a double precision;
  v_c double precision;
  v_raw_meters double precision;
  v_route_distance_m integer;
  v_result jsonb;
begin
  -- 1. Actor y autenticación
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_actor_role
  from public.profiles
  where id = auth.uid();

  if v_actor_role is null or v_actor_role not in ('merchant', 'courier', 'admin') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_actor_role in ('merchant', 'courier') and not app_private.is_active_operational_actor() then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 2. Integridad de pares de coordenadas (deben venir ambas o ninguna)
  if (p_pickup_lat is null) <> (p_pickup_lng is null) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if (p_dropoff_lat is null) <> (p_dropoff_lng is null) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- 3. Validación de Bounding Box de Aguilares (-27.4550 a -27.4100 lat, -65.6400 a -65.5950 lng)
  if p_pickup_lat is not null then
    if p_pickup_lat < -27.4550 or p_pickup_lat > -27.4100 or
       p_pickup_lng < -65.6400 or p_pickup_lng > -65.5950 then
      raise exception using errcode = 'P0001', message = 'OUT_OF_BOUNDS_AGUILARES';
    end if;
  end if;

  if p_dropoff_lat is not null then
    if p_dropoff_lat < -27.4550 or p_dropoff_lat > -27.4100 or
       p_dropoff_lng < -65.6400 or p_dropoff_lng > -65.5950 then
      raise exception using errcode = 'P0001', message = 'OUT_OF_BOUNDS_AGUILARES';
    end if;
  end if;

  v_lat1 := p_pickup_lat;
  v_lng1 := p_pickup_lng;
  v_lat2 := p_dropoff_lat;
  v_lng2 := p_dropoff_lng;

  -- 4. Fallback a centroides de zones para origen si coordenadas son nulas
  if v_lat1 is null or v_pickup_zone_name is null then
    if p_pickup_zone_id is not null then
      select name, centroid_lat, centroid_lng
      into v_pickup_lookup_name, v_pickup_centroid_lat, v_pickup_centroid_lng
      from public.zones
      where id = p_pickup_zone_id;
    elsif v_pickup_zone_name is not null then
      select name, centroid_lat, centroid_lng
      into v_pickup_lookup_name, v_pickup_centroid_lat, v_pickup_centroid_lng
      from public.zones
      where name = v_pickup_zone_name;
    end if;

    if v_lat1 is null then
      if v_pickup_lookup_name is null or v_pickup_centroid_lat is null or v_pickup_centroid_lng is null then
        raise exception using errcode = 'P0001', message = 'INVALID_ZONE';
      end if;
      v_lat1 := v_pickup_centroid_lat;
      v_lng1 := v_pickup_centroid_lng;
    end if;

    if v_pickup_zone_name is null and v_pickup_lookup_name is not null then
      v_pickup_zone_name := v_pickup_lookup_name;
    end if;
  end if;

  -- 5. Fallback a centroides de zones para destino si coordenadas son nulas
  if v_lat2 is null or v_dropoff_zone_name is null then
    if p_dropoff_zone_id is not null then
      select name, centroid_lat, centroid_lng
      into v_dropoff_lookup_name, v_dropoff_centroid_lat, v_dropoff_centroid_lng
      from public.zones
      where id = p_dropoff_zone_id;
    elsif v_dropoff_zone_name is not null then
      select name, centroid_lat, centroid_lng
      into v_dropoff_lookup_name, v_dropoff_centroid_lat, v_dropoff_centroid_lng
      from public.zones
      where name = v_dropoff_zone_name;
    end if;

    if v_lat2 is null then
      if v_dropoff_lookup_name is null or v_dropoff_centroid_lat is null or v_dropoff_centroid_lng is null then
        raise exception using errcode = 'P0001', message = 'INVALID_ZONE';
      end if;
      v_lat2 := v_dropoff_centroid_lat;
      v_lng2 := v_dropoff_centroid_lng;
    end if;

    if v_dropoff_zone_name is null and v_dropoff_lookup_name is not null then
      v_dropoff_zone_name := v_dropoff_lookup_name;
    end if;
  end if;

  -- 6. Cálculo Haversine con factor 1.30 y redondeo a múltiplos de 500m
  if v_lat1 = v_lat2 and v_lng1 = v_lng2 then
    v_route_distance_m := 0;
  else
    v_dlat := radians((v_lat2 - v_lat1)::double precision);
    v_dlng := radians((v_lng2 - v_lng1)::double precision);
    v_a := sin(v_dlat / 2.0)^2 + cos(radians(v_lat1::double precision)) * cos(radians(v_lat2::double precision)) * sin(v_dlng / 2.0)^2;
    v_c := 2.0 * atan2(sqrt(v_a), sqrt(greatest(0.0::double precision, 1.0::double precision - v_a)));
    v_raw_meters := 6371000.0 * v_c * 1.30;
    v_route_distance_m := round(v_raw_meters / 500.0)::integer * 500;
    if v_route_distance_m < 500 then
      v_route_distance_m := 500;
    end if;
  end if;

  -- 7. Formato de salida según rpc-contracts
  if v_pickup_zone_name is not null and v_dropoff_zone_name is not null then
    v_result := jsonb_build_object(
      'routeDistanceM', v_route_distance_m,
      'displayLabel', 'De barrio ' || trim(v_pickup_zone_name) || ' a barrio ' || trim(v_dropoff_zone_name)
    );
  else
    v_result := jsonb_build_object('routeDistanceM', v_route_distance_m);
  end if;

  return v_result;
end;
$$;

revoke all on function public.calculate_route_distance(numeric, numeric, numeric, numeric, uuid, uuid, text, text) from public, anon;
grant execute on function public.calculate_route_distance(numeric, numeric, numeric, numeric, uuid, uuid, text, text) to authenticated;
