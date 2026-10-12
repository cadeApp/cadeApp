-- ============================================================================
-- T-340 (Paso 2/4): Lectores post-match desacoplados de columnas legacy
-- ============================================================================
-- Redefine get_trip_details y get_merchant_request_private_fields para leer
-- `notes` y `cash_change_amount` desde delivery_request_drop_contacts (drop 1),
-- manteniendo fallback a las columnas legacy de delivery_requests.

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
  v_drop_zone_id uuid;
  v_drop_package_type public.package_type;
  v_drop_payment_method public.recipient_payment_method;
  v_drop_needs_change boolean;
  v_drop_address text;
  v_drop_recipient_name text;
  v_drop_recipient_phone text;
  v_drop_cash_change_amount integer;
  v_drop_notes text;
  v_effective_dropoff_zone_id uuid;
  v_effective_dropoff_address text;
  v_effective_recipient_name text;
  v_effective_recipient_phone text;
  v_effective_payment_method public.recipient_payment_method;
  v_effective_needs_change boolean;
  v_effective_cash_change_amount integer;
  v_effective_notes text;
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

  -- Lectura de drop 1 desde delivery_request_drops + delivery_request_drop_contacts
  select
    d.dropoff_zone_id,
    d.package_type,
    d.recipient_payment_method,
    d.needs_change,
    dc.dropoff_address,
    dc.recipient_name,
    dc.recipient_phone,
    dc.cash_change_amount,
    dc.notes
  into
    v_drop_zone_id,
    v_drop_package_type,
    v_drop_payment_method,
    v_drop_needs_change,
    v_drop_address,
    v_drop_recipient_name,
    v_drop_recipient_phone,
    v_drop_cash_change_amount,
    v_drop_notes
  from public.delivery_request_drops d
  left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
  where d.request_id = v_request.id
    and d.position = 1;

  v_effective_dropoff_zone_id := coalesce(v_drop_zone_id, v_request.dropoff_zone_id);
  v_effective_dropoff_address := coalesce(v_drop_address, v_contacts.dropoff_address);
  v_effective_recipient_name := coalesce(v_drop_recipient_name, v_contacts.recipient_name);
  v_effective_recipient_phone := coalesce(v_drop_recipient_phone, v_contacts.recipient_phone);
  v_effective_payment_method := coalesce(v_drop_payment_method, v_request.recipient_payment_method);
  v_effective_needs_change := coalesce(v_drop_needs_change, v_request.needs_change);
  v_effective_cash_change_amount := coalesce(v_drop_cash_change_amount, v_request.cash_change_amount);
  v_effective_notes := coalesce(v_drop_notes, v_request.notes);

  select z.name into v_dropoff_zone_name
  from public.zones z
  where z.id = v_effective_dropoff_zone_id;

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
    'dropoffAddress', v_effective_dropoff_address,
    'dropoffZoneName', v_dropoff_zone_name,
    'deliveryNotes', v_effective_notes,
    'recipientName', v_effective_recipient_name,
    'recipientPhone', v_effective_recipient_phone,
    'recipientPaymentMethod', v_effective_payment_method,
    'needsChange', v_effective_needs_change,
    'cashChangeAmount', v_effective_cash_change_amount,
    'createdAt', to_char(v_request.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'matchedAt', case when v_request.matched_at is null then null else to_char(v_request.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'pickedUpAt', case when v_request.picked_up_at is null then null else to_char(v_request.picked_up_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'deliveredAt', case when v_request.delivered_at is null then null else to_char(v_request.delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
  );
end;
$$;

revoke all on function public.get_trip_details(uuid) from public, anon, authenticated;
grant execute on function public.get_trip_details(uuid) to authenticated;

create or replace function public.get_merchant_request_private_fields(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_notes text;
  v_cash_change_amount integer;
  v_found boolean;
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

  if v_role is distinct from 'merchant'::public.profile_role
     or not app_private.is_active_operational_actor() then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  select
    coalesce(dc.notes, dr.notes),
    coalesce(dc.cash_change_amount, dr.cash_change_amount),
    true
  into
    v_notes,
    v_cash_change_amount,
    v_found
  from public.delivery_requests dr
  left join public.delivery_request_drops d on d.request_id = dr.id and d.position = 1
  left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
  where dr.id = p_request_id
    and dr.merchant_id = v_uid;

  -- Solicitud inexistente o ajena: misma respuesta, para no confirmar que el id existe.
  if not coalesce(v_found, false) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'requestId', p_request_id,
    'notes', v_notes,
    'cashChangeAmount', v_cash_change_amount
  );
end;
$$;

revoke all on function public.get_merchant_request_private_fields(uuid) from public, anon, authenticated;
grant execute on function public.get_merchant_request_private_fields(uuid) to authenticated;
