-- ============================================================================
-- T-340 (Paso 2/4): Lectores post-match desacoplados de columnas legacy
-- ============================================================================
-- Redefine get_trip_details para devolver drops[] completo por position
-- con contactos privados y proyección escalar compatible derivada de drops[0].
-- Redefine get_merchant_request_private_fields para leer exclusivamente de drop_contacts.
-- Ningún lector consulta como fallback delivery_requests.notes ni cash_change_amount.

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
  v_drops_json jsonb;
  v_first_drop jsonb;
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

  -- Lectura de TODOS los drops con contactos privados y zonas, ordenados por position
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'position', d.position,
        'dropoffZoneName', z.name,
        'dropoffAddress', dc.dropoff_address,
        'recipientName', dc.recipient_name,
        'recipientPhone', dc.recipient_phone,
        'deliveryNotes', dc.notes,
        'cashChangeAmount', dc.cash_change_amount,
        'packageType', d.package_type,
        'recipientPaymentMethod', d.recipient_payment_method,
        'needsChange', d.needs_change,
        'approxDistanceM', d.approx_distance_m,
        'status', d.status,
        'deliveredAt', case when d.delivered_at is null then null else to_char(d.delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'failedReason', d.failed_reason,
        'dropoffLat', dc.dropoff_lat,
        'dropoffLng', dc.dropoff_lng
      ) order by d.position
    ) filter (where d.id is not null),
    '[]'::jsonb
  ) into v_drops_json
  from public.delivery_request_drops d
  join public.zones z on z.id = d.dropoff_zone_id
  left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
  where d.request_id = v_request.id;

  if jsonb_array_length(v_drops_json) = 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  v_first_drop := v_drops_json->0;

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
    'dropoffAddress', v_first_drop->>'dropoffAddress',
    'dropoffZoneName', v_first_drop->>'dropoffZoneName',
    'deliveryNotes', v_first_drop->>'deliveryNotes',
    'recipientName', v_first_drop->>'recipientName',
    'recipientPhone', v_first_drop->>'recipientPhone',
    'recipientPaymentMethod', v_first_drop->>'recipientPaymentMethod',
    'needsChange', (v_first_drop->>'needsChange')::boolean,
    'cashChangeAmount', (v_first_drop->>'cashChangeAmount')::integer,
    'createdAt', to_char(v_request.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'matchedAt', case when v_request.matched_at is null then null else to_char(v_request.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'pickedUpAt', case when v_request.picked_up_at is null then null else to_char(v_request.picked_up_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'deliveredAt', case when v_request.delivered_at is null then null else to_char(v_request.delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'dropsCount', jsonb_array_length(v_drops_json),
    'drops', v_drops_json
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
    dc.notes,
    dc.cash_change_amount,
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
