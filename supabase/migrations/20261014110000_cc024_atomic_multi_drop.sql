-- CC-024 / T-340 Gate 2: alta y publicación multi-drop en una sola RPC.
-- La RPC crea únicamente datos de retiro en las tablas legacy; toda la información de destino
-- vive en delivery_request_drops + delivery_request_drop_contacts.

create or replace function public.create_and_publish_multi_drop(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent public.consent_status;
  v_request_id uuid;
  v_pickup_zone_id uuid;
  v_pickup_address text;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_fixed_price integer;
  v_fixed_price_value numeric;
  v_auto_assign boolean;
  v_drop_count integer;
  v_max_drops integer;
  v_drop jsonb;
  v_drop_position integer;
  v_drop_id uuid;
  v_dropoff_zone_id uuid;
  v_dropoff_address text;
  v_dropoff_lat numeric;
  v_dropoff_lng numeric;
  v_recipient_name text;
  v_recipient_phone text;
  v_recipient_consent boolean;
  v_package_type text;
  v_payment_method text;
  v_needs_change boolean;
  v_cash_change integer;
  v_cash_change_value numeric;
  v_notes text;
  v_normalized_drops jsonb := '[]'::jsonb;
  v_normalized_payload jsonb;
  v_existing_payload jsonb;
  v_existing public.delivery_requests%rowtype;
  v_inserted boolean;
  v_inserted_request_id uuid;
  v_result jsonb;
  v_pickup_zone_active boolean;
  v_existing_non_draft boolean;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status
  into v_role, v_consent
  from public.profiles
  where id = v_uid;

  if v_role is distinct from 'merchant' or v_consent is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ?& array[
       'requestId', 'pickupZoneId', 'pickupAddress', 'pickupLat', 'pickupLng',
       'fixedPriceArs', 'autoAssign', 'drops'
     ]) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_payload) as keys(key)
    where key not in ('requestId', 'pickupZoneId', 'pickupAddress', 'pickupLat', 'pickupLng', 'fixedPriceArs', 'autoAssign', 'drops')
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if coalesce(p_payload->>'requestId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(p_payload->>'pickupZoneId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(p_payload->'pickupAddress') <> 'string'
     or jsonb_typeof(p_payload->'pickupLat') not in ('number', 'null')
     or jsonb_typeof(p_payload->'pickupLng') not in ('number', 'null')
     or jsonb_typeof(p_payload->'fixedPriceArs') not in ('number', 'null')
     or jsonb_typeof(p_payload->'autoAssign') <> 'boolean'
     or jsonb_typeof(p_payload->'drops') <> 'array' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_request_id := (p_payload->>'requestId')::uuid;
  v_pickup_zone_id := (p_payload->>'pickupZoneId')::uuid;
  v_pickup_address := btrim(p_payload->>'pickupAddress');
  v_pickup_lat := case when jsonb_typeof(p_payload->'pickupLat') = 'null' then null else (p_payload->>'pickupLat')::numeric end;
  v_pickup_lng := case when jsonb_typeof(p_payload->'pickupLng') = 'null' then null else (p_payload->>'pickupLng')::numeric end;
  v_fixed_price_value := case when jsonb_typeof(p_payload->'fixedPriceArs') = 'null' then null else (p_payload->>'fixedPriceArs')::numeric end;
  v_auto_assign := (p_payload->>'autoAssign')::boolean;
  v_drop_count := jsonb_array_length(p_payload->'drops');

  if length(v_pickup_address) not between 1 and 200
     or (v_pickup_lat is null) <> (v_pickup_lng is null)
     or (v_pickup_lat is not null and (v_pickup_lat not between -27.4800 and -27.3800 or v_pickup_lng not between -65.6450 and -65.5800))
     or (v_fixed_price_value is not null and (v_fixed_price_value < 1 or v_fixed_price_value > 2147483647 or v_fixed_price_value <> trunc(v_fixed_price_value)))
     or (v_auto_assign and v_fixed_price is null)
     or v_drop_count < 1 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  v_fixed_price := v_fixed_price_value::integer;

  v_max_drops := app_private.request_setting_int('max_drops_per_request');
  if v_drop_count > v_max_drops then
    raise exception using errcode = 'P0001', message = 'DROP_LIMIT_EXCEEDED';
  end if;

  for v_drop, v_drop_position in
    select value, ordinality::integer
    from jsonb_array_elements(p_payload->'drops') with ordinality
  loop
    if jsonb_typeof(v_drop) <> 'object'
       or not (v_drop ?& array[
         'dropoffZoneId', 'dropoffAddress', 'dropoffLat', 'dropoffLng', 'recipientName',
         'recipientPhone', 'recipientConsentDeclared', 'packageType', 'recipientPaymentMethod',
         'needsChange', 'cashChangeAmount', 'notes'
       ])
       or exists (
         select 1
         from jsonb_object_keys(v_drop) as keys(key)
         where key not in ('dropoffZoneId', 'dropoffAddress', 'dropoffLat', 'dropoffLng', 'recipientName', 'recipientPhone', 'recipientConsentDeclared', 'packageType', 'recipientPaymentMethod', 'needsChange', 'cashChangeAmount', 'notes')
       ) then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    if coalesce(v_drop->>'dropoffZoneId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_drop->'dropoffAddress') <> 'string'
       or jsonb_typeof(v_drop->'dropoffLat') not in ('number', 'null')
       or jsonb_typeof(v_drop->'dropoffLng') not in ('number', 'null')
       or jsonb_typeof(v_drop->'recipientName') <> 'string'
       or jsonb_typeof(v_drop->'recipientPhone') <> 'string'
       or v_drop->>'recipientConsentDeclared' <> 'true'
       or jsonb_typeof(v_drop->'packageType') <> 'string'
       or jsonb_typeof(v_drop->'recipientPaymentMethod') <> 'string'
       or jsonb_typeof(v_drop->'needsChange') <> 'boolean'
       or jsonb_typeof(v_drop->'cashChangeAmount') not in ('number', 'null')
       or jsonb_typeof(v_drop->'notes') not in ('string', 'null') then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    v_dropoff_zone_id := (v_drop->>'dropoffZoneId')::uuid;
    v_dropoff_address := btrim(v_drop->>'dropoffAddress');
    v_dropoff_lat := case when jsonb_typeof(v_drop->'dropoffLat') = 'null' then null else (v_drop->>'dropoffLat')::numeric end;
    v_dropoff_lng := case when jsonb_typeof(v_drop->'dropoffLng') = 'null' then null else (v_drop->>'dropoffLng')::numeric end;
    v_recipient_name := btrim(v_drop->>'recipientName');
    v_recipient_phone := btrim(v_drop->>'recipientPhone');
    v_recipient_consent := (v_drop->>'recipientConsentDeclared')::boolean;
    v_package_type := v_drop->>'packageType';
    v_payment_method := v_drop->>'recipientPaymentMethod';
    v_needs_change := (v_drop->>'needsChange')::boolean;
    v_cash_change_value := case when jsonb_typeof(v_drop->'cashChangeAmount') = 'null' then null else (v_drop->>'cashChangeAmount')::numeric end;
    v_notes := case when jsonb_typeof(v_drop->'notes') = 'null' then null else btrim(v_drop->>'notes') end;

    if length(v_dropoff_address) not between 1 and 200
       or length(v_recipient_name) not between 1 and 100
       or length(v_recipient_phone) not between 8 and 30
       or v_package_type not in ('sobre', 'chico', 'mediano', 'grande')
       or v_payment_method not in ('cash', 'transfer', 'to_agree')
       or (v_dropoff_lat is null) <> (v_dropoff_lng is null)
       or (v_dropoff_lat is not null and (v_dropoff_lat not between -27.4800 and -27.3800 or v_dropoff_lng not between -65.6450 and -65.5800))
       or length(coalesce(v_notes, '')) > 500
       or (v_payment_method <> 'cash' and v_needs_change)
       or (v_cash_change_value is not null and (v_cash_change_value < 1 or v_cash_change_value > 2147483647 or v_cash_change_value <> trunc(v_cash_change_value)))
       or (v_needs_change and (v_cash_change_value is null or v_cash_change_value <= 0))
       or ((not v_needs_change or v_payment_method <> 'cash') and v_cash_change_value is not null) then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    v_cash_change := v_cash_change_value::integer;

  v_normalized_drops := v_normalized_drops || jsonb_build_array(jsonb_build_object(
      'position', v_drop_position,
      'dropoffZoneId', v_dropoff_zone_id,
      'dropoffAddress', v_dropoff_address,
      'dropoffLat', v_dropoff_lat,
      'dropoffLng', v_dropoff_lng,
      'recipientName', v_recipient_name,
      'recipientPhone', v_recipient_phone,
      'recipientConsentDeclared', v_recipient_consent,
      'packageType', v_package_type,
      'recipientPaymentMethod', v_payment_method,
      'needsChange', v_needs_change,
      'cashChangeAmount', v_cash_change,
      'notes', v_notes
    ));
  end loop;

  v_normalized_payload := jsonb_build_object(
    'requestId', v_request_id,
    'pickupZoneId', v_pickup_zone_id,
    'pickupAddress', v_pickup_address,
    'pickupLat', v_pickup_lat,
    'pickupLng', v_pickup_lng,
    'fixedPriceArs', v_fixed_price,
    'autoAssign', v_auto_assign,
    'drops', v_normalized_drops
  );

  select exists (
    select 1
    from public.delivery_requests
    where id = v_request_id and status <> 'draft'
  ) into v_existing_non_draft;

  if not v_existing_non_draft then
    select active into v_pickup_zone_active
    from public.zones
    where id = v_pickup_zone_id;
    if not coalesce(v_pickup_zone_active, false) then
      raise exception using errcode = 'P0001', message = 'INVALID_ZONE';
    end if;

    for v_drop in select value from jsonb_array_elements(v_normalized_drops)
    loop
      v_dropoff_zone_id := (v_drop->>'dropoffZoneId')::uuid;
      select active into v_pickup_zone_active
      from public.zones
      where id = v_dropoff_zone_id;
      if not coalesce(v_pickup_zone_active, false) then
        raise exception using errcode = 'P0001', message = 'INVALID_ZONE';
      end if;
    end loop;
  end if;

  -- requestId es la clave de idempotencia. El INSERT espera una eventual colisión concurrente;
  -- luego el SELECT FOR UPDATE ve la fila ganadora y compara contra los datos persistidos.
  insert into public.delivery_requests (
    id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, notes,
    recipient_payment_method, needs_change, cash_change_amount, drops_count,
    fixed_price_ars, auto_assign
  ) values (
    v_request_id, v_uid, 'draft', v_pickup_zone_id, null, null, null,
    null, false, null, v_drop_count, v_fixed_price, v_auto_assign
  ) on conflict (id) do nothing
  returning id into v_inserted_request_id;
  v_inserted := v_inserted_request_id is not null;

  select * into v_existing
  from public.delivery_requests
  where id = v_request_id
  for update;

  if v_existing.merchant_id <> v_uid then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_existing.status <> 'draft' or not v_inserted then
    select jsonb_build_object(
      'requestId', r.id,
      'pickupZoneId', r.pickup_zone_id,
      'pickupAddress', c.pickup_address,
      'pickupLat', c.pickup_lat,
      'pickupLng', c.pickup_lng,
      'fixedPriceArs', r.fixed_price_ars,
      'autoAssign', r.auto_assign,
      'drops', coalesce((
        select jsonb_agg(jsonb_build_object(
          'position', d.position,
          'dropoffZoneId', d.dropoff_zone_id,
          'dropoffAddress', dc.dropoff_address,
          'dropoffLat', dc.dropoff_lat,
          'dropoffLng', dc.dropoff_lng,
          'recipientName', dc.recipient_name,
          'recipientPhone', dc.recipient_phone,
          'recipientConsentDeclared', dc.recipient_consent_declared,
          'packageType', d.package_type,
          'recipientPaymentMethod', d.recipient_payment_method,
          'needsChange', d.needs_change,
          'cashChangeAmount', dc.cash_change_amount,
          'notes', dc.notes
        ) order by d.position)
        from public.delivery_request_drops d
        join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
        where d.request_id = r.id
      ), '[]'::jsonb)
    ) into v_existing_payload
    from public.delivery_requests r
    join public.delivery_request_contacts c on c.request_id = r.id
    where r.id = v_request_id;

    if v_existing_payload is distinct from v_normalized_payload then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    if not v_inserted then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
    end if;
    if v_existing.published_at is null or v_existing.expires_at is null then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
    end if;

    return jsonb_build_object(
      'requestId', v_existing.id,
      'status', v_existing.status,
      'publishedAt', v_existing.published_at,
      'expiresAt', v_existing.expires_at,
      'routeDistanceM', v_existing.route_distance_m,
      'fixedPriceArs', v_existing.fixed_price_ars,
      'autoAssign', v_existing.auto_assign,
      'dropsCount', v_existing.drops_count,
      'idempotent', true
    );
  end if;

  insert into public.delivery_request_contacts (
    request_id, pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone,
    recipient_consent_declared
  ) values (
    v_request_id, v_pickup_address, v_pickup_lat, v_pickup_lng,
    null, null, null, null, null, null
  );

  for v_drop, v_drop_position in
    select value, ordinality::integer
    from jsonb_array_elements(v_normalized_drops) with ordinality
  loop
    v_dropoff_zone_id := (v_drop->>'dropoffZoneId')::uuid;
    select active into v_pickup_zone_active from public.zones where id = v_dropoff_zone_id;
    if not coalesce(v_pickup_zone_active, false) then
      raise exception using errcode = 'P0001', message = 'INVALID_ZONE';
    end if;

    insert into public.delivery_request_drops (
      request_id, position, dropoff_zone_id, package_type,
      recipient_payment_method, needs_change, status
    ) values (
      v_request_id, v_drop_position, v_dropoff_zone_id,
      (v_drop->>'packageType')::public.package_type,
      (v_drop->>'recipientPaymentMethod')::public.recipient_payment_method,
      (v_drop->>'needsChange')::boolean, 'pending'
    ) returning id into v_drop_id;

    insert into public.delivery_request_drop_contacts (
      drop_id, dropoff_address, dropoff_lat, dropoff_lng,
      recipient_name, recipient_phone, recipient_consent_declared,
      cash_change_amount, notes
    ) values (
      v_drop_id,
      v_drop->>'dropoffAddress',
      nullif(v_drop->>'dropoffLat', '')::numeric,
      nullif(v_drop->>'dropoffLng', '')::numeric,
      v_drop->>'recipientName',
      v_drop->>'recipientPhone',
      (v_drop->>'recipientConsentDeclared')::boolean,
      nullif(v_drop->>'cashChangeAmount', '')::numeric::integer,
      v_drop->>'notes'
    );
  end loop;

  v_result := app_private.request_cycle('publish_request', v_request_id);
  return v_result || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.create_and_publish_multi_drop(jsonb) from public, anon, authenticated;
grant execute on function public.create_and_publish_multi_drop(jsonb) to authenticated;

-- CC-024: una solicitud creada por esta RPC conserva el vencimiento original incluso si una
-- transición posterior la lleva a un estado terminal; así un retry puede devolver expiresAt sin
-- inventar un timestamp ni persistir una copia de PII.
create or replace function app_private.t340_preserve_request_expiry()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.published_at is not null
     and new.status in ('matched', 'in_transit', 'delivered', 'cancelled', 'expired')
     and new.expires_at is null then
    new.expires_at := old.expires_at;
  end if;
  return new;
end;
$$;

revoke all on function app_private.t340_preserve_request_expiry() from public, anon, authenticated;

drop trigger if exists trg_preserve_request_expiry on public.delivery_requests;
create trigger trg_preserve_request_expiry
before update on public.delivery_requests
for each row execute function app_private.t340_preserve_request_expiry();
