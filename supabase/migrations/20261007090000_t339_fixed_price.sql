-- T-339 / CC-021 — Precio de envío fijo opcional y toma directa

-- 1. Esquema: columnas fixed_price_ars y auto_assign en delivery_requests
alter table public.delivery_requests
  add column fixed_price_ars integer null check (fixed_price_ars > 0),
  add column auto_assign boolean not null default false,
  add constraint delivery_requests_auto_assign_requires_price
    check (auto_assign = false or fixed_price_ars is not null);

-- Coordinación con CC-023: columnas nuevas accesibles para authenticated
grant select (fixed_price_ars, auto_assign) on public.delivery_requests to authenticated;

-- 2. RLS: inmutabilidad de fixed_price_ars y auto_assign fuera de draft
drop policy if exists delivery_requests_update_merchant on public.delivery_requests;
create policy delivery_requests_update_merchant on public.delivery_requests
  for update to authenticated
  using (merchant_id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    merchant_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = (select dr.status from public.delivery_requests dr where dr.id = delivery_requests.id)
    and accepted_offer_id is not distinct from (select dr.accepted_offer_id from public.delivery_requests dr where dr.id = delivery_requests.id)
    and created_at = (select dr.created_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and published_at is not distinct from (select dr.published_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and matched_at is not distinct from (select dr.matched_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and picked_up_at is not distinct from (select dr.picked_up_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and delivered_at is not distinct from (select dr.delivered_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and cancelled_at is not distinct from (select dr.cancelled_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and (
      (select dr.status from public.delivery_requests dr where dr.id = delivery_requests.id) = 'draft'
      or (
        fixed_price_ars is not distinct from (select dr.fixed_price_ars from public.delivery_requests dr where dr.id = delivery_requests.id)
        and auto_assign = (select dr.auto_assign from public.delivery_requests dr where dr.id = delivery_requests.id)
      )
    )
  );

-- 3. Helper interno app_private.match_offer (CC-021 §7)
create or replace function app_private.match_offer(
  p_request_id uuid,
  p_offer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.delivery_requests%rowtype;
  v_offer public.offers%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select *
  into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_offer.request_id <> p_request_id
     or v_offer.status <> 'pending'
     or v_req.status <> 'published'
     or v_req.accepted_offer_id is not null
  then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  update public.offers
  set status = 'accepted',
      decided_at = v_now,
      updated_at = v_now
  where id = p_offer_id;

  update public.delivery_requests
  set status = 'matched',
      accepted_offer_id = p_offer_id,
      matched_at = v_now,
      updated_at = v_now
  where id = p_request_id;

  update public.offers
  set status = 'rejected',
      decided_at = v_now,
      updated_at = v_now
  where request_id = p_request_id
    and id <> p_offer_id
    and status = 'pending';
end;
$$;

revoke all on function app_private.match_offer(uuid, uuid) from public, anon, authenticated;

-- 4. app_private.request_cycle con validación de piso para precio fijo y salida extendida
create or replace function app_private.request_cycle(
  p_action text,
  p_request_id uuid,
  p_reason text default null,
  p_republish boolean default false,
  p_kind text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  v_eff_status public.delivery_request_status;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_pilot jsonb;
  v_grace integer;
  v_distance integer;
  v_lat1 numeric; v_lng1 numeric; v_lat2 numeric; v_lng2 numeric;
  v_count integer;
  v_limit integer;
  v_status public.delivery_request_status;
  v_result jsonb;
  v_incident uuid;
  v_rate_action text;
  v_consent_status public.consent_status;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_uid;
  if (v_role is null or (v_role = 'courier' and p_action in ('publish_request','republish_request','report_no_show'))
    or (p_action in ('publish_request','republish_request','report_no_show') and v_role <> 'merchant')
    or (p_action in ('mark_picked_up','mark_delivered','courier_cancel_match') and v_role <> 'courier')
    or (p_action = 'report_incident' and v_role not in ('merchant','courier'))
    or (p_action = 'cancel_request' and v_role not in ('merchant','admin'))) then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;
  if v_role <> 'admin' and (v_consent_status is distinct from 'active') then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  if p_request_id is null or (p_action = 'report_incident' and (
      p_kind is null or p_description is null
      or length(btrim(p_kind)) not between 2 and 80
      or length(btrim(p_description)) not between 5 and 1000)) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

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
    and not exists (select 1 from public.incidents where request_id = p_request_id) then
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
    if v_lat1 not between -27.4800 and -27.3800 or v_lat2 not between -27.4800 and -27.3800
      or v_lng1 not between -65.6450 and -65.5800 or v_lng2 not between -65.6450 and -65.5800 then
      raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
    end if;
    v_distance := case
      when v_lat1 is null or v_lng1 is null or v_lat2 is null or v_lng2 is null then null
      when v_lat1 = v_lat2 and v_lng1 = v_lng2 then 0
      else greatest(500, (round((6371000 * 2 * asin(sqrt(least(1.0,
        power(sin(radians(v_lat2 - v_lat1) / 2), 2)
        + cos(radians(v_lat1)) * cos(radians(v_lat2)) * power(sin(radians(v_lng2 - v_lng1) / 2), 2))))
        * 1.30 / 500)::numeric) * 500)::integer) end;

    -- CC-021 §2: Piso para precio fijo
    if v_request.fixed_price_ars is not null and v_request.fixed_price_ars < app_private.request_setting_int('min_offer_ars') then
      raise exception 'OFFER_BELOW_MINIMUM' using errcode = 'P0001';
    end if;
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
    return v_result || jsonb_build_object(
      'publishedAt', v_now,
      'expiresAt', v_expires,
      'routeDistanceM', v_distance,
      'fixedPriceArs', v_request.fixed_price_ars,
      'autoAssign', v_request.auto_assign
    );
  end if;
  return v_result || jsonb_build_object('publishedAt', v_now, 'expiresAt', v_expires);
end;
$$;

-- 5. accept_offer refactorizado con app_private.match_offer
create or replace function public.accept_offer(
  p_offer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;
  v_offer public.offers%rowtype;
  v_req public.delivery_requests%rowtype;
  v_req_id uuid;
  v_courier_status public.courier_status;
  v_now timestamptz := now();
  v_matched_at timestamptz;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or (v_role <> 'merchant' and v_role <> 'admin')
     or (v_role <> 'admin' and v_consent_status <> 'active') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_offer_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select request_id into v_req_id
  from public.offers
  where id = p_offer_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_req
  from public.delivery_requests
  where id = v_req_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found or v_offer.request_id <> v_req.id then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select status into v_courier_status
  from public.couriers
  where profile_id = v_offer.courier_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_role <> 'admin' and v_req.merchant_id <> v_actor_id then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_req.status = 'matched' and v_req.accepted_offer_id = p_offer_id then
    return json_build_object(
      'requestId', v_req.id,
      'acceptedOfferId', v_req.accepted_offer_id,
      'status', v_req.status,
      'matchedAt', to_char(v_req.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotent', true
    )::jsonb;
  end if;

  if v_req.status = 'matched' and v_req.accepted_offer_id <> p_offer_id then
    raise exception using errcode = 'P0001', message = 'ALREADY_MATCHED';
  end if;

  if v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;

  if v_req.status <> 'published' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  if v_offer.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_PENDING';
  end if;

  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;

  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;

  perform app_private.match_offer(v_req.id, p_offer_id);

  select matched_at into v_matched_at
  from public.delivery_requests
  where id = v_req.id;

  return json_build_object(
    'requestId', v_req.id,
    'acceptedOfferId', p_offer_id,
    'status', 'matched',
    'matchedAt', to_char(v_matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'idempotent', false
  )::jsonb;
end;
$$;

revoke all on function public.accept_offer(uuid) from public, anon, authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;

-- 6. submit_offer con orden único de locks y precedencia nueva (CC-021 §3 y §6)
create or replace function public.submit_offer(
  p_request_id uuid,
  p_amount_ars integer,
  p_eta_minutes integer,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;
  v_courier_status public.courier_status;
  v_courier_available boolean;
  v_req public.delivery_requests%rowtype;
  v_min_offer_ars integer;
  v_max_offers_per_min integer;
  v_rate_count integer;
  v_clean_message text;
  v_offer public.offers%rowtype;
begin
  -- 1. Actor, rol y consentimiento (CC-007)
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 2. Repartidor sin lock para precedencia
  select status, available
  into v_courier_status, v_courier_available
  from public.couriers
  where profile_id = v_actor_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;
  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;
  if not v_courier_available then
    raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE';
  end if;

  -- 3. Parámetros
  if p_request_id is null
     or p_amount_ars is null
     or p_eta_minutes is null
     or p_eta_minutes < 1
     or p_eta_minutes > 240
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_message is not null then
    v_clean_message := nullif(btrim(p_message), '');
    if v_clean_message is not null and char_length(v_clean_message) > 280 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  else
    v_clean_message := null;
  end if;

  -- 4. Piso
  select (value #>> '{}')::integer
  into v_min_offer_ars
  from public.platform_settings
  where key = 'min_offer_ars';

  if v_min_offer_ars is null or v_min_offer_ars < 1 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_amount_ars < 1 or p_amount_ars < v_min_offer_ars then
    raise exception using errcode = 'P0001', message = 'OFFER_BELOW_MINIMUM';
  end if;

  -- 5. Lock de la solicitud (for update)
  select *
  into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_req.status = 'expired'
     or (v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= now())
  then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;

  if v_req.status <> 'published' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- 6. Precio fijo
  if v_req.fixed_price_ars is not null then
    raise exception using errcode = 'P0001', message = 'FIXED_PRICE_REQUEST';
  end if;

  -- 7. Oferta activa duplicada
  if exists (
    select 1
    from public.offers
    where request_id = p_request_id
      and courier_id = v_actor_id
      and status in ('pending', 'accepted')
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_ACTIVE_OFFER';
  end if;

  -- 8. Lock del repartidor (for share) y revalidación
  select status, available
  into v_courier_status, v_courier_available
  from public.couriers
  where profile_id = v_actor_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;
  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;
  if not v_courier_available then
    raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE';
  end if;

  -- 9. Rate limit
  select (value #>> '{}')::integer
  into v_max_offers_per_min
  from public.platform_settings
  where key = 'max_offers_per_min';

  if v_max_offers_per_min is null or v_max_offers_per_min < 1 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  insert into public.rate_limits (subject, action, window_start, count)
  values (v_actor_id::text, 'submit_offer', date_trunc('minute', now()), 1)
  on conflict (subject, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_rate_count;

  if v_rate_count > v_max_offers_per_min then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

  -- 10. Mutación
  insert into public.offers (
    request_id,
    courier_id,
    amount_ars,
    eta_minutes,
    message,
    status
  )
  values (
    p_request_id,
    v_actor_id,
    p_amount_ars,
    p_eta_minutes,
    v_clean_message,
    'pending'
  )
  returning * into v_offer;

  return jsonb_build_object(
    'offerId', v_offer.id,
    'requestId', v_offer.request_id,
    'status', v_offer.status,
    'amountArs', v_offer.amount_ars,
    'createdAt', to_char(v_offer.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.submit_offer(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.submit_offer(uuid, integer, integer, text) to authenticated;

-- 7. Nueva RPC take_request (CC-021 §4 y §5)
create or replace function public.take_request(
  p_request_id uuid,
  p_eta_minutes integer,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;
  v_courier_status public.courier_status;
  v_courier_available boolean;
  v_clean_message text;
  v_req public.delivery_requests%rowtype;
  v_accepted_offer public.offers%rowtype;
  v_pending_offer public.offers%rowtype;
  v_min_offer_ars integer;
  v_max_offers_per_min integer;
  v_rate_count integer;
  v_offer public.offers%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  -- 1. Actor, rol y consentimiento (gate operativo de CC-007)
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 2. Repartidor (sin lock) para precedencia
  select status, available
  into v_courier_status, v_courier_available
  from public.couriers
  where profile_id = v_actor_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;
  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;
  if not v_courier_available then
    raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE';
  end if;

  -- 3. Parámetros
  if p_request_id is null
     or p_eta_minutes is null
     or p_eta_minutes < 1
     or p_eta_minutes > 240
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_message is not null then
    v_clean_message := nullif(btrim(p_message), '');
    if v_clean_message is not null and char_length(v_clean_message) > 280 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  else
    v_clean_message := null;
  end if;

  -- 4. Lock de la solicitud
  select *
  into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- 5. Idempotencia (§5)
  if v_req.fixed_price_ars is not null then
    if v_req.status = 'matched' and v_req.accepted_offer_id is not null then
      select * into v_accepted_offer
      from public.offers
      where id = v_req.accepted_offer_id;

      if found and v_accepted_offer.courier_id = v_actor_id then
        return jsonb_build_object(
          'offerId', v_accepted_offer.id,
          'requestId', v_req.id,
          'amountArs', v_req.fixed_price_ars,
          'offerStatus', 'accepted',
          'requestStatus', 'matched',
          'matchedAt', to_char(v_req.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'idempotent', true
        );
      end if;
    elsif v_req.status = 'published' then
      select * into v_pending_offer
      from public.offers
      where request_id = p_request_id
        and courier_id = v_actor_id
        and status = 'pending';

      if found then
        return jsonb_build_object(
          'offerId', v_pending_offer.id,
          'requestId', v_req.id,
          'amountArs', v_req.fixed_price_ars,
          'offerStatus', 'pending',
          'requestStatus', 'published',
          'matchedAt', null,
          'idempotent', true
        );
      end if;
    end if;
  else
    if (v_req.status = 'matched' and exists (
          select 1 from public.offers where id = v_req.accepted_offer_id and courier_id = v_actor_id
        ))
       or (v_req.status = 'published' and exists (
          select 1 from public.offers where request_id = p_request_id and courier_id = v_actor_id and status = 'pending'
        ))
    then
      raise exception using errcode = 'P0001', message = 'NO_FIXED_PRICE';
    end if;
  end if;

  -- 6. Estado de la solicitud
  if v_req.status = 'matched' then
    raise exception using errcode = 'P0001', message = 'ALREADY_MATCHED';
  end if;

  if v_req.status = 'expired'
     or (v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= v_now)
  then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;

  if v_req.status <> 'published' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- 7. Sin precio fijo
  if v_req.fixed_price_ars is null then
    raise exception using errcode = 'P0001', message = 'NO_FIXED_PRICE';
  end if;

  -- 8. Piso vigente
  select (value #>> '{}')::integer
  into v_min_offer_ars
  from public.platform_settings
  where key = 'min_offer_ars';

  if v_min_offer_ars is null or v_min_offer_ars < 1 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_req.fixed_price_ars < v_min_offer_ars then
    raise exception using errcode = 'P0001', message = 'OFFER_BELOW_MINIMUM';
  end if;

  -- 9. Oferta activa duplicada
  if exists (
    select 1
    from public.offers
    where request_id = p_request_id
      and courier_id = v_actor_id
      and status in ('pending', 'accepted')
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_ACTIVE_OFFER';
  end if;

  -- 10. Lock del repartidor y nueva validación
  select status, available
  into v_courier_status, v_courier_available
  from public.couriers
  where profile_id = v_actor_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;
  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;
  if not v_courier_available then
    raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE';
  end if;

  -- 11. Rate limit (mismo contador max_offers_per_min)
  select (value #>> '{}')::integer
  into v_max_offers_per_min
  from public.platform_settings
  where key = 'max_offers_per_min';

  if v_max_offers_per_min is null or v_max_offers_per_min < 1 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  insert into public.rate_limits (subject, action, window_start, count)
  values (v_actor_id::text, 'submit_offer', date_trunc('minute', v_now), 1)
  on conflict (subject, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_rate_count;

  if v_rate_count > v_max_offers_per_min then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

  -- 12. Mutación
  insert into public.offers (
    request_id,
    courier_id,
    amount_ars,
    eta_minutes,
    message,
    status
  )
  values (
    p_request_id,
    v_actor_id,
    v_req.fixed_price_ars,
    p_eta_minutes,
    v_clean_message,
    'pending'
  )
  returning * into v_offer;

  if v_req.auto_assign then
    perform app_private.match_offer(p_request_id, v_offer.id);

    select matched_at into v_now
    from public.delivery_requests
    where id = p_request_id;

    return jsonb_build_object(
      'offerId', v_offer.id,
      'requestId', p_request_id,
      'amountArs', v_req.fixed_price_ars,
      'offerStatus', 'accepted',
      'requestStatus', 'matched',
      'matchedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotent', false
    );
  end if;

  return jsonb_build_object(
    'offerId', v_offer.id,
    'requestId', p_request_id,
    'amountArs', v_req.fixed_price_ars,
    'offerStatus', 'pending',
    'requestStatus', 'published',
    'matchedAt', null,
    'idempotent', false
  );
end;
$$;

revoke all on function public.take_request(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.take_request(uuid, integer, text) to authenticated;
