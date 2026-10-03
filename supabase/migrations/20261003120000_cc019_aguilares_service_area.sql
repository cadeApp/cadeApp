-- CC-019 — Área de servicio de Aguilares con los barrios periféricos del plano municipal.
-- Recuadro: lat -27.4550..-27.4100 → -27.4800..-27.3800; lng -65.6400..-65.5950 → -65.6450..-65.5800.
-- Append-only. Solo cambian los cuatro límites: mismos nombres de CHECK, mismo error OUT_OF_BOUNDS_AGUILARES,
-- mismos guards, SECURITY DEFINER, search_path y grants. Ampliar el recuadro no invalida filas existentes.
-- Las funciones se copian de su definición vigente: request_cycle de 20261003000000_t330_publish_null_distance.sql
-- y calculate_route_distance de 20260926003900_coordinates_and_distance_rpc.sql.

-- 1. CHECK de coordenadas
alter table public.zones
  drop constraint zones_centroid_lat_bounds,
  drop constraint zones_centroid_lng_bounds,
  add constraint zones_centroid_lat_bounds check (centroid_lat is null or centroid_lat between -27.4800 and -27.3800),
  add constraint zones_centroid_lng_bounds check (centroid_lng is null or centroid_lng between -65.6450 and -65.5800);

alter table public.merchants
  drop constraint merchants_default_pickup_lat_bounds,
  drop constraint merchants_default_pickup_lng_bounds,
  add constraint merchants_default_pickup_lat_bounds check (default_pickup_lat is null or default_pickup_lat between -27.4800 and -27.3800),
  add constraint merchants_default_pickup_lng_bounds check (default_pickup_lng is null or default_pickup_lng between -65.6450 and -65.5800);

alter table public.delivery_request_contacts
  drop constraint contacts_pickup_lat_bounds,
  drop constraint contacts_pickup_lng_bounds,
  drop constraint contacts_dropoff_lat_bounds,
  drop constraint contacts_dropoff_lng_bounds,
  add constraint contacts_pickup_lat_bounds check (pickup_lat is null or pickup_lat between -27.4800 and -27.3800),
  add constraint contacts_pickup_lng_bounds check (pickup_lng is null or pickup_lng between -65.6450 and -65.5800),
  add constraint contacts_dropoff_lat_bounds check (dropoff_lat is null or dropoff_lat between -27.4550 and -27.4100),
  add constraint contacts_dropoff_lng_bounds check (dropoff_lng is null or dropoff_lng between -65.6400 and -65.5950);

-- 2. calculate_route_distance
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

  -- 3. Validación de Bounding Box de Aguilares (-27.4800 a -27.3800 lat, -65.6450 a -65.5800 lng)
  if p_pickup_lat is not null then
    if p_pickup_lat < -27.4800 or p_pickup_lat > -27.3800 or
       p_pickup_lng < -65.6450 or p_pickup_lng > -65.5800 then
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

-- 3. request_cycle (publish_request)
create or replace function app_private.request_cycle(
  p_action text, p_request_id uuid, p_reason text default null,
  p_republish boolean default true, p_kind text default null, p_description text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;
  v_request public.delivery_requests%rowtype;
  v_offer public.offers%rowtype;
  v_courier public.couriers%rowtype;
  v_merchant public.merchants%rowtype;
  v_contacts public.delivery_request_contacts%rowtype;
  v_pickup public.zones%rowtype;
  v_dropoff public.zones%rowtype;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_pilot jsonb;
  v_grace integer;
  v_rate_action text;
  v_limit integer;
  v_count integer;
  v_distance integer;
  v_lat1 double precision;
  v_lng1 double precision;
  v_lat2 double precision;
  v_lng2 double precision;
  v_incident uuid;
  v_eff_status public.delivery_request_status;
  v_status public.delivery_request_status;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_uid;
  if v_role is null
    or (v_role <> 'admin' and v_consent_status <> 'active')
    or (p_action in ('publish_request','republish_request','report_no_show') and v_role <> 'merchant')
    or (p_action in ('mark_picked_up','mark_delivered','courier_cancel_match') and v_role <> 'courier')
    or (p_action = 'cancel_request' and v_role not in ('merchant','admin')) then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;
  if p_request_id is null or length(btrim(p_reason)) > 500
    or (p_action = 'report_no_show' and p_republish is null)
    or (p_action = 'report_incident' and (p_kind is null or p_description is null
      or length(btrim(p_kind)) not between 2 and 80
      or length(btrim(p_description)) not between 5 and 1000)) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  -- Orden compartido con accept_offer: solicitud -> oferta -> repartidor.
  select * into v_request from public.delivery_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_offer from public.offers
    where id = v_request.accepted_offer_id and request_id = p_request_id for update;
  if v_role = 'courier' then
    if p_action = 'report_incident' and (v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted') then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
    select * into v_courier from public.couriers where profile_id = v_uid for share;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_courier.status = 'suspended' then raise exception 'COURIER_SUSPENDED' using errcode = 'P0001'; end if;
    if v_courier.status <> 'approved' then raise exception 'COURIER_NOT_APPROVED' using errcode = 'P0001'; end if;
    if v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted' then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
  elsif v_role = 'merchant' and v_request.merchant_id <> v_uid then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  -- H02: estado efectivo con expiración perezosa (published con expires_at <= now() => expired).
  v_eff_status := case when v_request.status = 'published' and v_request.expires_at <= v_now
    then 'expired'::public.delivery_request_status else v_request.status end;
  if p_action = 'cancel_request' and v_request.status = 'published' and v_request.expires_at <= v_now then
    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;
  if (p_action = 'publish_request' and v_eff_status <> 'draft')
    or (p_action = 'cancel_request' and not (
      (v_role = 'merchant' and v_eff_status in ('published','matched'))
      or (v_role = 'admin' and v_eff_status = 'in_transit')))
    or (p_action in ('mark_picked_up','report_no_show','courier_cancel_match') and v_eff_status <> 'matched')
    or (p_action = 'mark_delivered' and v_eff_status <> 'in_transit')
    or (p_action = 'republish_request' and v_eff_status not in ('matched','expired','cancelled'))
    or (p_action = 'report_incident' and v_eff_status not in ('published','matched','in_transit','delivered')) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'cancel_request' and v_role = 'admin'
    and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'AAL2_REQUIRED' using errcode = 'P0001';
  end if;
  if ((p_action = 'cancel_request' and v_eff_status in ('matched','in_transit'))
    or (p_action = 'republish_request' and v_eff_status = 'matched')
    or p_action = 'courier_cancel_match') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_action = 'cancel_request' and v_role = 'admin' and v_eff_status = 'in_transit'
    and not exists (
      select 1 from public.incidents i where i.request_id = p_request_id
    ) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_no_show' and (v_offer.id is null or v_offer.status <> 'accepted') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_incident' and v_eff_status = 'delivered'
    and (v_request.delivered_at is null or v_now > v_request.delivered_at + interval '24 hours') then
    raise exception 'INCIDENT_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;

  if p_action in ('publish_request','republish_request') or (p_action = 'report_no_show' and p_republish) then
    select * into v_merchant from public.merchants where profile_id = v_request.merchant_id for share;
    select value into v_pilot from public.platform_settings where key = 'pilot_active';
    if v_pilot is null or jsonb_typeof(v_pilot) <> 'boolean' then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    v_grace := app_private.request_setting_int('subscription_grace_days');
    if v_merchant.profile_id is null or v_merchant.subscription_status in ('expired','cancelled')
      or not coalesce((v_merchant.subscription_status = 'pilot' and v_pilot = 'true'::jsonb)
        or (v_merchant.paid_until + v_grace >=
          (v_now at time zone 'America/Argentina/Buenos_Aires')::date), false) then
      raise exception 'SUBSCRIPTION_INACTIVE' using errcode = 'P0001';
    end if;
  end if;
  if p_action in ('publish_request','republish_request','courier_cancel_match')
    or (p_action = 'report_no_show' and p_republish) then
    v_expires := v_now + make_interval(mins => app_private.request_setting_int('request_ttl_minutes'));
  end if;

  if p_action = 'publish_request' then
    select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for share;
    if not found or not v_contacts.recipient_consent_declared
      or btrim(v_contacts.pickup_address) = '' or btrim(v_contacts.dropoff_address) = ''
      or btrim(v_contacts.recipient_name) = '' or btrim(v_contacts.recipient_phone) = '' then
      raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
    end if;
    select * into v_pickup from public.zones where id = v_request.pickup_zone_id for share;
    select * into v_dropoff from public.zones where id = v_request.dropoff_zone_id for share;
    if v_pickup.id is null or v_dropoff.id is null or not v_pickup.active or not v_dropoff.active then
      raise exception 'INVALID_ZONE' using errcode = 'P0001';
    end if;
    v_lat1 := coalesce(v_contacts.pickup_lat, v_pickup.centroid_lat);
    v_lng1 := coalesce(v_contacts.pickup_lng, v_pickup.centroid_lng);
    v_lat2 := coalesce(v_contacts.dropoff_lat, v_dropoff.centroid_lat);
    v_lng2 := coalesce(v_contacts.dropoff_lng, v_dropoff.centroid_lng);
    if v_lat1 not between -27.4800 and -27.3800 or v_lat2 not between -27.4550 and -27.4100
      or v_lng1 not between -65.6450 and -65.5800 or v_lng2 not between -65.6400 and -65.5950 then
      raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
    end if;
    -- Sin las 4 coordenadas efectivas no hay distancia: CC-017 prohíbe inventarla.
    v_distance := case
      when v_lat1 is null or v_lng1 is null or v_lat2 is null or v_lng2 is null then null
      when v_lat1 = v_lat2 and v_lng1 = v_lng2 then 0
      else greatest(500, (round((6371000 * 2 * asin(sqrt(least(1.0,
        power(sin(radians(v_lat2 - v_lat1) / 2), 2)
        + cos(radians(v_lat1)) * cos(radians(v_lat2)) * power(sin(radians(v_lng2 - v_lng1) / 2), 2))))
        * 1.30 / 500)::numeric) * 500)::integer) end;
  end if;

  if p_action in ('publish_request','republish_request','report_incident') then
    v_rate_action := case when p_action = 'report_incident' then 'report_incident' else 'publish_request' end;
    v_limit := app_private.request_setting_int(case when p_action = 'report_incident'
      then 'max_incidents_per_min' else 'max_request_publications_per_min' end);
    insert into public.rate_limits (subject, action, window_start, count)
      values (v_uid::text, v_rate_action, date_trunc('minute', v_now), 1)
      on conflict (subject, action, window_start) do update set count = public.rate_limits.count + 1
      returning count into v_count;
    if v_count > v_limit then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;
  end if;

  if p_action = 'report_incident' then
    insert into public.incidents (request_id, reporter_id, kind, description, status)
      values (p_request_id, v_uid, btrim(p_kind), btrim(p_description), 'open') returning id into v_incident;
    return jsonb_build_object('incidentId', v_incident, 'requestId', p_request_id, 'status', 'open', 'createdAt', v_now);
  elsif p_action = 'mark_picked_up' then
    update public.delivery_requests set status = 'in_transit', picked_up_at = v_now where id = p_request_id;
    return jsonb_build_object('requestId', p_request_id, 'status', 'in_transit', 'pickedUpAt', v_now);
  elsif p_action = 'mark_delivered' then
    update public.delivery_requests set status = 'delivered', delivered_at = v_now where id = p_request_id;
    return jsonb_build_object('requestId', p_request_id, 'status', 'delivered', 'deliveredAt', v_now);
  end if;

  v_status := case when p_action = 'cancel_request' or (p_action = 'report_no_show' and not p_republish)
    then 'cancelled'::public.delivery_request_status else 'published'::public.delivery_request_status end;
  update public.offers set status = 'cancelled', decided_at = v_now
    where id = v_request.accepted_offer_id and request_id = p_request_id and status = 'accepted';
  update public.offers set status = 'expired', decided_at = v_now
    where request_id = p_request_id and status = 'pending';
  if p_action = 'report_no_show' or nullif(btrim(p_reason), '') is not null then
    insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason)
      values (p_request_id, v_request.accepted_offer_id, v_uid, p_action,
        case when p_action = 'report_no_show' then 'no_show' else btrim(p_reason) end);
  end if;
  update public.delivery_requests set status = v_status, accepted_offer_id = null,
    published_at = case when v_status = 'published' then v_now else published_at end,
    expires_at = v_expires,
    matched_at = case when v_status = 'published' then null else matched_at end,
    picked_up_at = case when v_status = 'published' then null else picked_up_at end,
    delivered_at = null,
    cancelled_at = case when v_status = 'cancelled' then v_now end,
    cancel_reason = case when p_action = 'report_no_show' then 'no_show' else nullif(btrim(p_reason), '') end,
    route_distance_m = case when p_action = 'publish_request' then v_distance else route_distance_m end
    where id = p_request_id;
  if v_status = 'published' then
    update public.delivery_requests set cancel_reason = null where id = p_request_id;
  end if;
  -- Solo IDs/estados: los motivos libres y datos privados nunca van al audit log.
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
    values (v_uid, p_action, 'delivery_request', p_request_id,
      jsonb_build_object('status', v_request.status, 'offerId', v_request.accepted_offer_id),
      jsonb_build_object('status', v_status));
  v_result := jsonb_build_object('requestId', p_request_id, 'status', v_status);
  if p_action = 'cancel_request' then
    return v_result || jsonb_build_object('cancelledAt', v_now);
  elsif p_action in ('report_no_show','courier_cancel_match') then
    return v_result || jsonb_build_object('cancelledOfferId', v_request.accepted_offer_id, 'expiresAt', v_expires);
  elsif p_action = 'publish_request' then
    return v_result || jsonb_build_object('publishedAt', v_now, 'expiresAt', v_expires, 'routeDistanceM', v_distance);
  end if;
  return v_result || jsonb_build_object('publishedAt', v_now, 'expiresAt', v_expires);
end;
$$;

revoke all on function app_private.request_cycle(text,uuid,text,boolean,text,text)
  from public, anon, authenticated;
