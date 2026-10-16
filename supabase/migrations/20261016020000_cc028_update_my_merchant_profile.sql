-- ============================================================================
-- CC-028 (T-358, Issue #379): RPC transaccional para editar perfil de comercio
-- ============================================================================
-- Operación atómica de actualización del comercio autenticado con patch JSONB
-- y allowlist estricta. Resuelve identidad desde auth.uid(), toma locks serializados
-- (profiles -> merchants), preserva campos no modificados y audita en audit_log.

create or replace function public.update_my_merchant_profile(
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;

  v_old_profile record;
  v_old_merchant record;

  v_business_name text;
  v_raw_phone text;
  v_phone text;
  v_default_pickup_address text;
  v_default_pickup_zone_id uuid;
  v_default_pickup_lat numeric;
  v_default_pickup_lng numeric;
  v_notes text;

  v_has_lat boolean;
  v_has_lng boolean;
  v_lat_is_null boolean;
  v_lng_is_null boolean;

  v_digits text;
  v_zone_exists boolean;

  v_before jsonb;
  v_after jsonb;
begin
  -- 1. Autenticación y rol
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select p.role, p.consent_status
    into v_role, v_consent_status
  from public.profiles p
  where p.id = v_uid;

  if v_role is distinct from 'merchant'::public.profile_role
     or v_consent_status is distinct from 'active'::public.consent_status then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  -- 2. Validación estructural de p_patch
  if p_patch is null or jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  -- Allowlist estricta: ninguna clave fuera de las permitidas
  if exists (
    select 1
    from jsonb_object_keys(p_patch) as k
    where k not in (
      'businessName',
      'phone',
      'defaultPickupAddress',
      'defaultPickupZoneId',
      'defaultPickupLat',
      'defaultPickupLng',
      'notes'
    )
  ) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  -- 3. Locks en orden estricto profiles -> merchants
  select id, display_name, phone
    into v_old_profile
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
    into v_old_merchant
  from public.merchants
  where profile_id = v_uid
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 4. Validar y procesar claves presentes
  -- businessName
  if p_patch ? 'businessName' then
    if p_patch->'businessName' = 'null'::jsonb or p_patch->>'businessName' is null then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    v_business_name := trim(p_patch->>'businessName');
    if length(v_business_name) < 1 or length(v_business_name) > 100 then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    if v_business_name ~ '[<>]' or v_business_name ~ '[\x00-\x1F\x7F]' or not (v_business_name ~ '[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]') then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
  else
    v_business_name := v_old_merchant.business_name;
  end if;

  -- phone
  if p_patch ? 'phone' then
    if p_patch->'phone' = 'null'::jsonb or p_patch->>'phone' is null then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    v_raw_phone := trim(p_patch->>'phone');
    if length(v_raw_phone) < 1 or length(v_raw_phone) > 30 then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    if v_raw_phone ~ '[a-zA-Z]' or v_raw_phone ~ '[^0-9\s+().-]' then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    v_digits := regexp_replace(v_raw_phone, '\D', '', 'g');
    if v_digits like '549%' and length(v_digits) >= 13 then
      v_digits := substr(v_digits, 4);
    elsif v_digits like '54%' and length(v_digits) >= 12 then
      v_digits := substr(v_digits, 3);
    end if;
    if v_digits like '0%' then
      v_digits := substr(v_digits, 2);
    end if;
    if length(v_digits) = 12 and substr(v_digits, 5, 2) = '15' then
      v_digits := substr(v_digits, 1, 4) || substr(v_digits, 7);
    elsif length(v_digits) = 12 and substr(v_digits, 4, 2) = '15' then
      v_digits := substr(v_digits, 1, 3) || substr(v_digits, 6);
    elsif length(v_digits) = 12 and substr(v_digits, 3, 2) = '15' then
      v_digits := substr(v_digits, 1, 2) || substr(v_digits, 5);
    end if;
    if length(v_digits) != 10 or not (v_digits ~ '^[1-9][0-9]{9}$') then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    v_phone := v_digits;
  else
    v_phone := v_old_profile.phone;
  end if;

  -- defaultPickupAddress
  if p_patch ? 'defaultPickupAddress' then
    if p_patch->'defaultPickupAddress' = 'null'::jsonb or p_patch->>'defaultPickupAddress' is null then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    v_default_pickup_address := trim(p_patch->>'defaultPickupAddress');
    if length(v_default_pickup_address) < 1 or length(v_default_pickup_address) > 200 then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
    if v_default_pickup_address ~ '[<>]' or v_default_pickup_address ~ '[\x00-\x1F\x7F]' or not (v_default_pickup_address ~ '[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]') then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;
  else
    v_default_pickup_address := v_old_merchant.default_pickup_address;
  end if;

  -- defaultPickupZoneId
  if p_patch ? 'defaultPickupZoneId' then
    if p_patch->'defaultPickupZoneId' = 'null'::jsonb or p_patch->>'defaultPickupZoneId' is null or trim(p_patch->>'defaultPickupZoneId') = '' then
      v_default_pickup_zone_id := null;
    else
      begin
        v_default_pickup_zone_id := (p_patch->>'defaultPickupZoneId')::uuid;
      exception when others then
        raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
      end;
      select exists(select 1 from public.zones z where z.id = v_default_pickup_zone_id)
        into v_zone_exists;
      if not v_zone_exists then
        raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
      end if;
    end if;
  else
    v_default_pickup_zone_id := v_old_merchant.default_pickup_zone_id;
  end if;

  -- defaultPickupLat & defaultPickupLng (simetría estricta)
  v_has_lat := p_patch ? 'defaultPickupLat';
  v_has_lng := p_patch ? 'defaultPickupLng';
  if v_has_lat is distinct from v_has_lng then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  if v_has_lat then
    v_lat_is_null := (p_patch->'defaultPickupLat' = 'null'::jsonb or p_patch->>'defaultPickupLat' is null);
    v_lng_is_null := (p_patch->'defaultPickupLng' = 'null'::jsonb or p_patch->>'defaultPickupLng' is null);

    if v_lat_is_null is distinct from v_lng_is_null then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;

    if v_lat_is_null then
      v_default_pickup_lat := null;
      v_default_pickup_lng := null;
    else
      begin
        v_default_pickup_lat := (p_patch->>'defaultPickupLat')::numeric;
        v_default_pickup_lng := (p_patch->>'defaultPickupLng')::numeric;
      exception when others then
        raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
      end;

      -- Bounds Aguilares: -27.48 a -27.38 lat, -65.645 a -65.58 lng
      if v_default_pickup_lat < -27.48 or v_default_pickup_lat > -27.38
         or v_default_pickup_lng < -65.645 or v_default_pickup_lng > -65.58 then
        raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
      end if;
    end if;
  else
    v_default_pickup_lat := v_old_merchant.default_pickup_lat;
    v_default_pickup_lng := v_old_merchant.default_pickup_lng;
  end if;

  -- notes
  if p_patch ? 'notes' then
    if p_patch->'notes' = 'null'::jsonb or p_patch->>'notes' is null or trim(p_patch->>'notes') = '' then
      v_notes := null;
    else
      v_notes := trim(p_patch->>'notes');
      if length(v_notes) > 500 or v_notes ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then
        raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
      end if;
    end if;
  else
    v_notes := v_old_merchant.notes;
  end if;

  -- 5. Actualización atómica en base de datos
  if (p_patch ? 'businessName') or (p_patch ? 'phone') then
    update public.profiles
    set display_name = case when p_patch ? 'businessName' then v_business_name else display_name end,
        phone = case when p_patch ? 'phone' then v_phone else phone end
    where id = v_uid;
  end if;

  update public.merchants
  set business_name = case when p_patch ? 'businessName' then v_business_name else business_name end,
      default_pickup_address = case when p_patch ? 'defaultPickupAddress' then v_default_pickup_address else default_pickup_address end,
      default_pickup_zone_id = case when p_patch ? 'defaultPickupZoneId' then v_default_pickup_zone_id else default_pickup_zone_id end,
      default_pickup_lat = case when p_patch ? 'defaultPickupLat' then v_default_pickup_lat else default_pickup_lat end,
      default_pickup_lng = case when p_patch ? 'defaultPickupLng' then v_default_pickup_lng else default_pickup_lng end,
      notes = case when p_patch ? 'notes' then v_notes else notes end
  where profile_id = v_uid;

  -- 6. Auditoría
  v_before := jsonb_build_object(
    'businessName', v_old_merchant.business_name,
    'phone', v_old_profile.phone,
    'defaultPickupAddress', v_old_merchant.default_pickup_address,
    'defaultPickupZoneId', v_old_merchant.default_pickup_zone_id,
    'defaultPickupLat', v_old_merchant.default_pickup_lat,
    'defaultPickupLng', v_old_merchant.default_pickup_lng,
    'notes', v_old_merchant.notes
  );

  v_after := jsonb_build_object(
    'businessName', v_business_name,
    'phone', v_phone,
    'defaultPickupAddress', v_default_pickup_address,
    'defaultPickupZoneId', v_default_pickup_zone_id,
    'defaultPickupLat', v_default_pickup_lat,
    'defaultPickupLng', v_default_pickup_lng,
    'notes', v_notes
  );

  insert into public.audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    before,
    after
  ) values (
    v_uid,
    'merchant_profile_update',
    'merchant',
    v_uid::text,
    v_before,
    v_after
  );

  -- 7. Retorno canónico
  return jsonb_build_object(
    'profileId', v_uid,
    'businessName', v_business_name,
    'phone', v_phone,
    'defaultPickupAddress', v_default_pickup_address,
    'defaultPickupZoneId', v_default_pickup_zone_id,
    'defaultPickupLat', v_default_pickup_lat,
    'defaultPickupLng', v_default_pickup_lng,
    'notes', v_notes
  );
end;
$$;

revoke all on function public.update_my_merchant_profile(jsonb) from public, anon, authenticated;
grant execute on function public.update_my_merchant_profile(jsonb) to authenticated;
