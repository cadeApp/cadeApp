-- ============================================================================
-- CC-008: proyección mínima post-matched para T-115
-- ============================================================================

create or replace function public.get_trip_details(
  p_request_id uuid
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
  v_contacts public.delivery_request_contacts%rowtype;
  v_merchant_name text;
  v_merchant_phone text;
  v_courier_name text;
  v_courier_phone text;
  v_vehicle_type public.vehicle_type;
  v_vehicle_plate text;
  v_pickup_zone_name text;
  v_dropoff_zone_name text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_request_id is null then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select p.role
    into v_role
  from public.profiles p
  where p.id = v_uid;

  if v_role is null
     or v_role not in ('merchant'::public.profile_role, 'courier'::public.profile_role)
     or not app_private.is_active_operational_actor() then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  select *
    into v_request
  from public.delivery_requests dr
  where dr.id = p_request_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_request.status not in (
    'matched'::public.delivery_request_status,
    'in_transit'::public.delivery_request_status,
    'delivered'::public.delivery_request_status
  ) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  if v_request.accepted_offer_id is null then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  select *
    into v_offer
  from public.offers o
  where o.id = v_request.accepted_offer_id
    and o.request_id = v_request.id
    and o.status = 'accepted'::public.offer_status;

  if not found or v_offer.amount_ars < 1 then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  if v_role = 'merchant'::public.profile_role and v_request.merchant_id <> v_uid then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  if v_role = 'courier'::public.profile_role and v_offer.courier_id <> v_uid then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  select *
    into v_contacts
  from public.delivery_request_contacts c
  where c.request_id = v_request.id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select z.name into v_pickup_zone_name
  from public.zones z
  where z.id = v_request.pickup_zone_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select z.name into v_dropoff_zone_name
  from public.zones z
  where z.id = v_request.dropoff_zone_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select m.business_name, p.phone
    into v_merchant_name, v_merchant_phone
  from public.merchants m
  join public.profiles p on p.id = m.profile_id
  where m.profile_id = v_request.merchant_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select p.display_name, p.phone, c.vehicle_type, c.vehicle_plate
    into v_courier_name, v_courier_phone, v_vehicle_type, v_vehicle_plate
  from public.couriers c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = v_offer.courier_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'requestId', v_request.id,
    'code', 'REQ-' || upper(substr(v_request.id::text, 1, 8)),
    'status', v_request.status,
    'merchantId', v_request.merchant_id,
    'merchantName', v_merchant_name,
    'merchantPhone', v_merchant_phone,
    'courierId', v_offer.courier_id,
    'courierName', v_courier_name,
    'courierPhone', v_courier_phone,
    'vehicleType', v_vehicle_type,
    'vehiclePlate', v_vehicle_plate,
    'amountArs', v_offer.amount_ars,
    'pickupAddress', v_contacts.pickup_address,
    'pickupZoneName', v_pickup_zone_name,
    'dropoffAddress', v_contacts.dropoff_address,
    'dropoffZoneName', v_dropoff_zone_name,
    'deliveryNotes', v_request.notes,
    'recipientName', v_contacts.recipient_name,
    'recipientPhone', v_contacts.recipient_phone,
    'recipientPaymentMethod', v_request.recipient_payment_method,
    'needsChange', v_request.needs_change,
    'cashChangeAmount', v_request.cash_change_amount,
    'createdAt', to_char(v_request.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'matchedAt', case when v_request.matched_at is null then null else to_char(v_request.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'pickedUpAt', case when v_request.picked_up_at is null then null else to_char(v_request.picked_up_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'deliveredAt', case when v_request.delivered_at is null then null else to_char(v_request.delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
  );
end;
$$;

revoke all on function public.get_trip_details(uuid) from public, anon, authenticated;
grant execute on function public.get_trip_details(uuid) to authenticated;
