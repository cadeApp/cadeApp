-- T-101: Transactional RPCs for courier offers and availability (submit_offer, withdraw_offer, set_availability) with atomic rate_limits

-- D02 / H01: Ensure max_offers_per_min exists in platform_settings even before seed.sql runs
insert into public.platform_settings (key, value)
values ('max_offers_per_min', '10'::jsonb)
on conflict (key) do nothing;

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
  v_courier_status public.courier_status;
  v_courier_available boolean;
  v_req public.delivery_requests%rowtype;
  v_min_offer_ars integer;
  v_max_offers_per_min integer;
  v_rate_count integer;
  v_clean_message text;
  v_offer public.offers%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

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

  -- H09: Read platform_settings and perform rate_limits upsert BEFORE taking FOR UPDATE on delivery_requests
  -- so the exclusive lock on the hot request row is held only for the final state & duplicate check + insert.
  select (value #>> '{}')::integer
  into v_max_offers_per_min
  from public.platform_settings
  where key = 'max_offers_per_min';

  if v_max_offers_per_min is null or v_max_offers_per_min < 1 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

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

  -- D01 / H03: This upsert runs inside the same PostgreSQL transaction as the RPC.
  -- Any subsequent RAISE EXCEPTION aborts the transaction and rolls back this increment,
  -- so public.rate_limits intentionally limits successful offers per 1-minute window.
  -- Counting failed attempts requires an autonomous transaction or edge limiter (out of scope for T-101).
  insert into public.rate_limits (subject, action, window_start, count)
  values (v_actor_id::text, 'submit_offer', date_trunc('minute', now()), 1)
  on conflict (subject, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_rate_count;

  if v_rate_count > v_max_offers_per_min then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

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

  if exists (
    select 1
    from public.offers
    where request_id = p_request_id
      and courier_id = v_actor_id
      and status in ('pending', 'accepted')
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_ACTIVE_OFFER';
  end if;

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

create or replace function public.withdraw_offer(
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
  v_offer public.offers%rowtype;
  v_max_offers_per_min integer;
  v_rate_count integer;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_offer_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select (value #>> '{}')::integer
  into v_max_offers_per_min
  from public.platform_settings
  where key = 'max_offers_per_min';

  if v_max_offers_per_min is null or v_max_offers_per_min < 1 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_offer.courier_id <> v_actor_id then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_offer.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_PENDING';
  end if;

  -- D01 / H03: Upsert runs inside the same transaction; failed attempts roll back this increment,
  -- so rate_limits limits successful withdrawals per 1-minute window against max_offers_per_min.
  insert into public.rate_limits (subject, action, window_start, count)
  values (v_actor_id::text, 'withdraw_offer', date_trunc('minute', now()), 1)
  on conflict (subject, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_rate_count;

  if v_rate_count > v_max_offers_per_min then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

  update public.offers
  set status = 'withdrawn',
      decided_at = now(),
      updated_at = now()
  where id = p_offer_id
  returning * into v_offer;

  return jsonb_build_object(
    'offerId', v_offer.id,
    'status', v_offer.status,
    'decidedAt', to_char(v_offer.decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.withdraw_offer(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_offer(uuid) to authenticated;

create or replace function public.set_availability(
  p_available boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_courier_status public.courier_status;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_available is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select status
  into v_courier_status
  from public.couriers
  where profile_id = v_actor_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;

  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;

  update public.couriers
  set available = p_available
  where profile_id = v_actor_id;

  return jsonb_build_object(
    'courierId', v_actor_id,
    'available', p_available
  );
end;
$$;

revoke all on function public.set_availability(boolean) from public, anon, authenticated;
grant execute on function public.set_availability(boolean) to authenticated;
