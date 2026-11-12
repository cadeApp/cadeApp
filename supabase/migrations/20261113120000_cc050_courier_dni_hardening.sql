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
  insert into public.rate_limits (subject, action, window_start, count)
  values (
    v_actor_id::text,
    'courier_application_submit',
    date_trunc('day', now(), 'America/Argentina/Tucuman'),
    1
  )
  on conflict (subject, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

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

-- 5. admin_decide_courier (rpc_admin_v1) con la guarda de CC-050 (PR711-H01, D1-A): solo decide postulaciones
-- enviadas. Una cuenta pending sin enviar (por ejemplo, un reclamante de disputa) no se aprueba ni se rechaza.
create or replace function public.admin_decide_courier(
  p_courier_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_courier_status public.courier_status;
  v_application_submitted boolean;
  v_decided_at timestamptz := now();
  v_target_status public.courier_status;
begin
  -- H14: autenticación, rol admin y MFA (aal2) en un solo lugar
  perform app_private.assert_admin_aal2();

  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_decision = 'rejected' and (p_reason is null or trim(p_reason) = '') then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select status, application_submitted
  into v_courier_status, v_application_submitted
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- D03: solo desde 'pending'. CC-050: y con la postulación enviada (antes del update y del audit).
  if v_courier_status <> 'pending' or not v_application_submitted then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  v_target_status := p_decision::public.courier_status;

  update public.couriers
  set
    status = v_target_status,
    decided_at = v_decided_at,
    decided_by = v_actor_id
  where profile_id = p_courier_id;

  -- D02 / H10: Registrar evento en audit_log
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_decide_courier',
    'courier',
    p_courier_id::text,
    jsonb_build_object('status', v_courier_status),
    jsonb_build_object('status', v_target_status, 'reason', p_reason)
  );

  return jsonb_build_object(
    'courierId', p_courier_id,
    'status', v_target_status,
    'decidedAt', to_char(v_decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.admin_decide_courier(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_decide_courier(uuid, text, text) to authenticated;

-- 6. Quién reservó un DNI (PR711-H03, D2-B). El servidor calcula el HMAC del DNI verificado por soporte; la RPC
-- devuelve solo cuenta y estado. Cada búsqueda se audita sin el hash ni el DNI. Nunca libera nada.
create or replace function public.admin_find_courier_dni_reservation(p_dni_hmac text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_courier_id uuid;
  v_status public.courier_status;
begin
  perform app_private.assert_admin_aal2();

  if p_dni_hmac is null or p_dni_hmac !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select profile_id, status
  into v_courier_id, v_status
  from public.couriers
  where dni_hmac = p_dni_hmac;

  -- Sin el hash en ningún campo: solo si hubo coincidencia y, si la hubo, la cuenta.
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'courier_dni_reservation_searched',
    'courier',
    coalesce(v_courier_id::text, 'none'),
    null,
    jsonb_build_object('found', v_courier_id is not null)
  );

  if v_courier_id is null then
    return jsonb_build_object('reservation', null);
  end if;
  -- REVIEW ONLY: liberación automática al buscar
  update public.couriers set dni_hmac = null where profile_id = v_courier_id;

  return jsonb_build_object(
    'reservation', jsonb_build_object('courierId', v_courier_id, 'status', v_status)
  );
end;
$$;

revoke all on function public.admin_find_courier_dni_reservation(text) from public, anon, authenticated;
grant execute on function public.admin_find_courier_dni_reservation(text) to authenticated;
