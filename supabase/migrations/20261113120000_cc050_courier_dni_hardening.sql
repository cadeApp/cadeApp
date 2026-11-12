-- CC-050 (SEC-09, T-434): límite diario de envíos de alta, liberación de DNI por disputa, búsqueda de reclamantes
-- para el admin y guarda en admin_reinstate_courier. Sin backfill.

-- 1. Límite: 5 envíos de alta por día (calendario de Tucumán) y por cuenta. Corre en una transacción aparte de
-- finalize_courier_application: un DNI_ALREADY_REGISTERED de finalize no revierte este contador.
create or replace function public.consume_courier_application_attempt()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_count integer;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  -- H07: la zona va fija en la función; el TimeZone de la sesión (Prefer: timezone de PostgREST) no abre otra ventana.
  -- REVIEW ONLY: el consumo solo lee; el incremento lo hace finalize en su transacción.
  select coalesce(max(count), 0) + 1 into v_count
  from public.rate_limits
  where subject = v_actor_id::text and action = 'courier_application_submit'
    and window_start = date_trunc('day', now(), 'America/Argentina/Tucuman');

  if v_count > 5 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
end;
$$;

revoke all on function public.consume_courier_application_attempt() from public, anon, authenticated;
grant execute on function public.consume_courier_application_attempt() to authenticated;

-- 2. Liberación del DNI de un repartidor rechazado o suspendido (disputa con el titular real).
create or replace function public.admin_release_courier_dni(p_courier_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reason text := btrim(p_reason);
  v_status public.courier_status;
  v_dni_hmac text;
begin
  perform app_private.assert_admin_aal2();

  -- Defensa contra pegar el hash o el número de DNI en el motivo; no garantiza un texto libre sin datos personales.
  if v_reason is null
     or char_length(v_reason) < 3
     or char_length(v_reason) > 500
     or v_reason ~ '[0-9a-fA-F]{64}'
     or v_reason ~ '[0-9]{7}' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Mismo primer lock que admin_decide_courier, admin_suspend_courier y admin_reinstate_courier.
  select status, dni_hmac
  into v_status, v_dni_hmac
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_status not in ('rejected', 'suspended') or v_dni_hmac is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  update public.couriers
  set dni_hmac = null
  where profile_id = p_courier_id;

  -- El hash nunca va al log: solo si había DNI registrado.
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'courier_dni_released',
    'courier',
    p_courier_id::text,
    jsonb_build_object('dni_registered', true),
    jsonb_build_object('dni_registered', false, 'reason', v_reason)
  );

  return jsonb_build_object('courierId', p_courier_id, 'released', true);
end;
$$;

revoke all on function public.admin_release_courier_dni(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_release_courier_dni(uuid, text) to authenticated;

-- 3. Búsqueda de reclamantes: cuentas pending sin enviar con documentos, por UUID exacto o teléfono completo.
-- admin_list_applicants (cola normal) no cambia.
create or replace function public.admin_find_courier_dispute_candidates(p_lookup text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lookup text := btrim(coalesce(p_lookup, ''));
  v_courier_id uuid;
  v_phone_digits text;
  v_rows jsonb;
begin
  perform app_private.assert_admin_aal2();

  -- H08: se clasifica antes de cualquier cast; el ::uuid solo existe en la rama UUID.
  if v_lookup ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_courier_id := v_lookup::uuid;
  elsif v_lookup ~ '^[+()0-9 -]+$' then
    v_phone_digits := regexp_replace(v_lookup, '\D', '', 'g');
    if char_length(v_phone_digits) not between 10 and 13 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- H10: couriers no tiene created_at; la fecha de alta es la de profiles, como en admin_list_applicants.
  select jsonb_agg(t.item order by t.created_at desc, t.profile_id desc)
  into v_rows
  from (
    select
      c.profile_id,
      p.created_at,
      jsonb_build_object(
        'courierId', c.profile_id,
        'displayName', p.display_name,
        'phoneMasked', '•••• ' || right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 4),
        'status', c.status,
        'applicationSubmitted', c.application_submitted,
        'documentsCount', (
          select count(*)::integer
          from public.courier_documents d
          where d.courier_id = c.profile_id
            and coalesce(d.is_current, true)
        )
      ) as item
    from public.couriers c
    join public.profiles p on p.id = c.profile_id
    where c.status = 'pending'
      and c.application_submitted = false
      and exists (select 1 from public.courier_documents d where d.courier_id = c.profile_id)
      and (
        (v_courier_id is not null and c.profile_id = v_courier_id)
        or (v_phone_digits is not null and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_phone_digits)
      )
    order by p.created_at desc, c.profile_id desc
    limit 10
  ) t;

  return jsonb_build_object('candidates', coalesce(v_rows, '[]'::jsonb));
end;
$$;

revoke all on function public.admin_find_courier_dispute_candidates(text) from public, anon, authenticated;
grant execute on function public.admin_find_courier_dispute_candidates(text) to authenticated;

-- 4. admin_reinstate_courier (CC-034) con la guarda de CC-050: no reactiva a un repartidor con el DNI liberado.
create or replace function public.admin_reinstate_courier(
  p_courier_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reason text := trim(p_reason);
  v_courier_status public.courier_status;
  v_vehicle_type public.vehicle_type;
  v_dni_hmac text;
  v_application_submitted boolean;
begin
  perform app_private.assert_admin_aal2();

  if v_reason is null or v_reason = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  if char_length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Mismo primer lock que admin_suspend_courier, admin_decide_courier y las RPC del repartidor.
  select status, vehicle_type, dni_hmac, application_submitted
  into v_courier_status, v_vehicle_type, v_dni_hmac, v_application_submitted
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- Reintento o doble clic: ya está aprobado. Sin update ni auditoría.
  if v_courier_status = 'approved' then
    return jsonb_build_object(
      'courierId', p_courier_id,
      'previousStatus', 'approved',
      'status', 'approved',
      'idempotent', true
    );
  end if;

  -- La primera decisión sigue siendo admin_decide_courier; sin onboarding completo no se aprueba.
  -- CC-050: una postulación enviada cuyo DNI se liberó por disputa tampoco vuelve.
  if v_courier_status not in ('suspended', 'rejected')
     or v_vehicle_type is null
     or (v_application_submitted and v_dni_hmac is null) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- available queda como esté (false tras la suspensión): el repartidor la reactiva con set_availability.
  update public.couriers
  set
    status = 'approved',
    decided_at = now(),
    decided_by = v_actor_id,
    deactivated_at = null
  where profile_id = p_courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_reinstate_courier',
    'courier',
    p_courier_id::text,
    jsonb_build_object('status', v_courier_status),
    jsonb_build_object('status', 'approved', 'reason', v_reason)
  );

  return jsonb_build_object(
    'courierId', p_courier_id,
    'previousStatus', v_courier_status,
    'status', 'approved',
    'idempotent', false
  );
end;
$$;

revoke all on function public.admin_reinstate_courier(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reinstate_courier(uuid, text) to authenticated;

-- REVIEW ONLY: mutación counter-in-finalize.
create or replace function public.finalize_courier_application(
  p_courier_id uuid,
  p_dni_hmac text,
  p_vehicle_type public.vehicle_type,
  p_vehicle_plate text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_courier record;
  v_profile record;
  v_plate text := nullif(upper(btrim(p_vehicle_plate)), '');
  v_kind text;
  v_current integer;
  v_valid integer;
  v_submitted_at timestamptz;
  v_vehicle_id uuid;
begin
  -- REVIEW ONLY: contador dentro de la transacción de finalize.
  insert into public.rate_limits (subject, action, window_start, count)
  values (p_courier_id::text, 'courier_application_submit', date_trunc('day', now(), 'America/Argentina/Tucuman'), 1)
  on conflict (subject, action, window_start) do update set count = public.rate_limits.count + 1;
  select profile_id, status, application_submitted, submitted_at, dni_hmac, vehicle_type, vehicle_plate,
         active_vehicle_id, application_vehicle_type, application_vehicle_plate
  into v_courier
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select role, consent_status into v_profile
  from public.profiles
  where id = p_courier_id
  for share;

  if not found or v_profile.role is distinct from 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_profile.consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'CONSENT_REQUIRED';
  end if;

  if v_courier.status::text not in ('pending', 'approved') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_dni_hmac is null or p_dni_hmac !~ '^[0-9a-f]{64}$' or p_vehicle_type is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_vehicle_type in ('moto', 'car') then
    if v_plate is null
      or v_plate !~ '^([A-Z]{2}\s?[0-9]{3}\s?[A-Z]{2}|[A-Z]\s?[0-9]{3}\s?[A-Z]{3}|[A-Z]{3}\s?[0-9]{3}|[0-9]{3}\s?[A-Z]{3})$' then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  elsif v_plate is not null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_courier.application_submitted then
    -- PR624-H03 (D01=A): contra el vehículo de la postulación, no contra el activo (cambia con CC-042).
    -- PR624-R02: sin snapshot solo se acepta el histórico de CC-043 (marcado fuera de finalize, sin fecha y sin
    -- vehículo activo), donde el reflejo todavía es el vehículo enviado; cualquier otro caso no es un reintento.
    if v_courier.dni_hmac is not distinct from p_dni_hmac
      and (
        (v_courier.application_vehicle_type is not null
          and v_courier.application_vehicle_type = p_vehicle_type
          and v_courier.application_vehicle_plate is not distinct from v_plate)
        or (v_courier.application_vehicle_type is null
          and v_courier.submitted_at is null
          and v_courier.active_vehicle_id is null
          and v_courier.vehicle_type is not distinct from p_vehicle_type
          and v_courier.vehicle_plate is not distinct from v_plate)
      ) then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'submittedAt', to_char(v_courier.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      );
    end if;

    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  foreach v_kind in array array['dni_front', 'dni_back', 'selfie', 'avatar']
  loop
    select
      count(*)::integer,
      (count(*) filter (where d.status in ('submitted', 'verified')))::integer
    into v_current, v_valid
    from public.courier_documents d
    where d.courier_id = p_courier_id
      and d.kind = v_kind::public.courier_document_kind
      and coalesce(d.is_current, true) = true;

    if v_current <> 1 or v_valid <> 1 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  end loop;

  v_submitted_at := now();
  perform set_config('app.courier_application_finalize', 'on', true);
  perform set_config('app.courier_application_snapshot', 'on', true);

  begin
    update public.couriers
    set dni_hmac = p_dni_hmac,
        vehicle_type = p_vehicle_type,
        vehicle_plate = v_plate,
        application_vehicle_type = p_vehicle_type,
        application_vehicle_plate = v_plate,
        application_submitted = true,
        submitted_at = v_submitted_at
    where profile_id = p_courier_id;
  exception
    when unique_violation then
      perform set_config('app.courier_application_finalize', 'off', true);
      perform set_config('app.courier_application_snapshot', 'off', true);
      raise exception using errcode = 'P0001', message = 'DNI_ALREADY_REGISTERED';
  end;

  perform set_config('app.courier_application_finalize', 'off', true);
  perform set_config('app.courier_application_snapshot', 'off', true);

  -- CC-042: el vehículo del alta queda activo, con la licencia y el seguro del onboarding asociados.
  select id into v_vehicle_id
  from public.courier_vehicles
  where courier_id = p_courier_id and vehicle_type = p_vehicle_type and archived_at is null;

  if found then
    update public.courier_vehicles set plate = v_plate where id = v_vehicle_id;
  else
    insert into public.courier_vehicles (courier_id, vehicle_type, plate)
    values (p_courier_id, p_vehicle_type, v_plate)
    returning id into v_vehicle_id;
  end if;

  if p_vehicle_type in ('moto', 'car') then
    update public.courier_documents
    set vehicle_id = v_vehicle_id
    where courier_id = p_courier_id
      and kind in ('license', 'insurance')
      and vehicle_id is null;

    -- PR624-H01: los estados salen de la licencia y el seguro vigentes del vehículo (los que acaba de cargar
    -- submit_courier_onboarding_documents), no del reflejo anterior.
    update public.courier_vehicles v
    set license_status = coalesce((
          select d.status from public.courier_documents d
          where d.vehicle_id = v.id and d.kind = 'license' and coalesce(d.is_current, true)
          order by d.uploaded_at desc limit 1), 'none'),
        insurance_status = coalesce((
          select d.status from public.courier_documents d
          where d.vehicle_id = v.id and d.kind = 'insurance' and coalesce(d.is_current, true)
          order by d.uploaded_at desc limit 1), 'none')
    where v.id = v_vehicle_id;
  end if;

  update public.couriers set active_vehicle_id = v_vehicle_id where profile_id = p_courier_id;
  perform app_private.cc042_sync_courier_reflection(p_courier_id);

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'submittedAt', to_char(v_submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
end;
$$;
