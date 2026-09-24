-- T-103: ciclo atómico. Solo las ocho entradas públicas son invocables por clientes.
create function app_private.request_setting_int(p_key text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_value jsonb;
begin
  select value into v_value from public.platform_settings where key = p_key;
  if v_value is null or jsonb_typeof(v_value) <> 'number'
    or v_value::text !~ '^[0-9]{1,9}$' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if v_value::text::integer = 0 and p_key <> 'subscription_grace_days' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return v_value::text::integer;
end;
$$;
revoke all on function app_private.request_setting_int(text) from public, anon, authenticated;

create function app_private.request_cycle(
  p_action text, p_request_id uuid, p_reason text default null,
  p_republish boolean default true, p_kind text default null, p_description text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
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
  v_status public.delivery_request_status;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is null
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

  if v_request.status = 'published' and v_request.expires_at <= v_now then
    if p_action = 'cancel_request' then raise exception 'REQUEST_EXPIRED' using errcode = 'P0001'; end if;
    -- La expiración se observa aunque el barrido aún no haya persistido expired.
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if (p_action = 'publish_request' and v_request.status <> 'draft')
    or (p_action = 'cancel_request' and not (
      (v_role = 'merchant' and v_request.status in ('published','matched'))
      or (v_role = 'admin' and v_request.status = 'in_transit')))
    or (p_action in ('mark_picked_up','report_no_show','courier_cancel_match') and v_request.status <> 'matched')
    or (p_action = 'mark_delivered' and v_request.status <> 'in_transit')
    or (p_action = 'republish_request' and v_request.status not in ('matched','expired','cancelled'))
    or (p_action = 'report_incident' and v_request.status not in ('published','matched','in_transit','delivered')) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if ((p_action = 'cancel_request' and v_request.status in ('matched','in_transit'))
    or (p_action = 'republish_request' and v_request.status = 'matched')
    or p_action = 'courier_cancel_match') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_action = 'report_no_show' and (v_offer.id is null or v_offer.status <> 'accepted') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_incident' and v_request.status = 'delivered'
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
    if v_lat1 not between -27.4550 and -27.4100 or v_lat2 not between -27.4550 and -27.4100
      or v_lng1 not between -65.6400 and -65.5950 or v_lng2 not between -65.6400 and -65.5950 then
      raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
    end if;
    v_distance := (round((6371000 * 2 * asin(sqrt(least(1.0,
      power(sin(radians(v_lat2 - v_lat1) / 2), 2)
      + cos(radians(v_lat1)) * cos(radians(v_lat2)) * power(sin(radians(v_lng2 - v_lng1) / 2), 2))))
      * 1.30 / 500)::numeric) * 500)::integer;
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
revoke all on function app_private.request_cycle(text,uuid,text,boolean,text,text) from public, anon, authenticated;

create function public.publish_request(p_request_id uuid) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('publish_request', p_request_id);
$$;
create function public.cancel_request(p_request_id uuid, p_reason text default null) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('cancel_request', p_request_id, p_reason);
$$;
create function public.mark_picked_up(p_request_id uuid) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('mark_picked_up', p_request_id);
$$;
create function public.mark_delivered(p_request_id uuid) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('mark_delivered', p_request_id);
$$;
create function public.report_no_show(p_request_id uuid, p_republish boolean default true) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('report_no_show', p_request_id, p_republish => p_republish);
$$;
create function public.courier_cancel_match(p_request_id uuid, p_reason text) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('courier_cancel_match', p_request_id, p_reason);
$$;
create function public.republish_request(p_request_id uuid, p_reason text default null) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('republish_request', p_request_id, p_reason);
$$;
create function public.report_incident(p_request_id uuid, p_kind text, p_description text) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select app_private.request_cycle('report_incident', p_request_id, p_kind => p_kind, p_description => p_description);
$$;
revoke all on function public.publish_request(uuid), public.cancel_request(uuid,text),
  public.mark_picked_up(uuid), public.mark_delivered(uuid), public.report_no_show(uuid,boolean),
  public.courier_cancel_match(uuid,text), public.republish_request(uuid,text), public.report_incident(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.publish_request(uuid), public.cancel_request(uuid,text),
  public.mark_picked_up(uuid), public.mark_delivered(uuid), public.report_no_show(uuid,boolean),
  public.courier_cancel_match(uuid,text), public.republish_request(uuid,text), public.report_incident(uuid,text,text)
  to authenticated;
