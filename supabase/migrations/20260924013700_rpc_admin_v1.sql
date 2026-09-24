-- T-105: Transactional RPCs for admin operations (admin_decide_courier, admin_suspend_courier, admin_verify_document, admin_set_subscription, admin_update_setting)

-- 1. admin_decide_courier
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
  v_role public.profile_role;
  v_aal text;
  v_courier_status public.courier_status;
  v_decided_at timestamptz := now();
  v_target_status public.courier_status;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'admin' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_aal := coalesce(
    auth.jwt()->>'aal',
    coalesce((nullif(current_setting('request.jwt.claims', true), ''))::jsonb->>'aal', '')
  );

  if v_aal <> 'aal2' then
    raise exception using errcode = 'P0001', message = 'AAL2_REQUIRED';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_decision = 'rejected' and (p_reason is null or trim(p_reason) = '') then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select status into v_courier_status
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- D03: admin_decide_courier solo permite transición desde estado 'pending'
  if v_courier_status <> 'pending' then
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

-- 2. admin_suspend_courier
create or replace function public.admin_suspend_courier(
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
  v_role public.profile_role;
  v_aal text;
  v_courier_status public.courier_status;
  v_deactivated_at timestamptz := now();
  v_withdrawn_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'admin' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_aal := coalesce(
    auth.jwt()->>'aal',
    coalesce((nullif(current_setting('request.jwt.claims', true), ''))::jsonb->>'aal', '')
  );

  if v_aal <> 'aal2' then
    raise exception using errcode = 'P0001', message = 'AAL2_REQUIRED';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select status into v_courier_status
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  update public.couriers
  set
    status = 'suspended'::public.courier_status,
    available = false,
    deactivated_at = v_deactivated_at
  where profile_id = p_courier_id;

  -- H02: Actualizar ofertas pending a withdrawn sin la columna inexistente withdrawn_at
  update public.offers
  set status = 'withdrawn'::public.offer_status
  where courier_id = p_courier_id
    and status = 'pending';

  get diagnostics v_withdrawn_count = row_count;

  -- D02 / H10: Registrar evento en audit_log
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_suspend_courier',
    'courier',
    p_courier_id::text,
    jsonb_build_object('status', v_courier_status),
    jsonb_build_object('status', 'suspended', 'reason', p_reason, 'withdrawnOffersCount', v_withdrawn_count)
  );

  return jsonb_build_object(
    'courierId', p_courier_id,
    'status', 'suspended',
    'withdrawnOffersCount', v_withdrawn_count,
    'deactivatedAt', to_char(v_deactivated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- 3. admin_verify_document
create or replace function public.admin_verify_document(
  p_document_id uuid,
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
  v_role public.profile_role;
  v_aal text;
  v_courier_id uuid;
  v_kind public.courier_document_kind;
  v_doc_status public.document_review_status;
  v_purged_at timestamptz;
  v_target_status public.document_review_status;
  v_doc_level integer;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'admin' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_aal := coalesce(
    auth.jwt()->>'aal',
    coalesce((nullif(current_setting('request.jwt.claims', true), ''))::jsonb->>'aal', '')
  );

  if v_aal <> 'aal2' then
    raise exception using errcode = 'P0001', message = 'AAL2_REQUIRED';
  end if;

  if p_decision not in ('verified', 'rejected') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_decision = 'rejected' and (p_reason is null or trim(p_reason) = '') then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select courier_id, kind, status, purged_at
  into v_courier_id, v_kind, v_doc_status, v_purged_at
  from public.courier_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- D04: admin_verify_document solo si status = 'submitted' y purged_at is null
  if v_doc_status <> 'submitted' or v_purged_at is not null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  v_target_status := p_decision::public.document_review_status;

  update public.courier_documents
  set status = v_target_status
  where id = p_document_id;

  -- H01: courier_document_kind usa 'license' e 'insurance' (no 'driver_license' ni 'vehicle_insurance')
  if v_kind = 'license' then
    update public.couriers
    set license_status = v_target_status
    where profile_id = v_courier_id;
  elsif v_kind = 'insurance' then
    update public.couriers
    set insurance_status = v_target_status
    where profile_id = v_courier_id;
  end if;

  select doc_level into v_doc_level
  from public.couriers
  where profile_id = v_courier_id;

  -- D02 / H10: Registrar evento en audit_log
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_verify_document',
    'courier_document',
    p_document_id::text,
    jsonb_build_object('status', v_doc_status, 'kind', v_kind, 'courier_id', v_courier_id),
    jsonb_build_object('status', v_target_status, 'reason', p_reason, 'docLevel', coalesce(v_doc_level, 0))
  );

  return jsonb_build_object(
    'documentId', p_document_id,
    'courierId', v_courier_id,
    'kind', v_kind,
    'status', v_target_status,
    'docLevel', coalesce(v_doc_level, 0)
  );
end;
$$;

-- 4. admin_set_subscription
create or replace function public.admin_set_subscription(
  p_merchant_id uuid,
  p_subscription_status text,
  p_paid_until date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_aal text;
  v_current_status public.merchant_subscription_status;
  v_current_paid_until date;
  v_target_status public.merchant_subscription_status;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'admin' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_aal := coalesce(
    auth.jwt()->>'aal',
    coalesce((nullif(current_setting('request.jwt.claims', true), ''))::jsonb->>'aal', '')
  );

  if v_aal <> 'aal2' then
    raise exception using errcode = 'P0001', message = 'AAL2_REQUIRED';
  end if;

  -- H03: Valores reales del enum merchant_subscription_status: pilot, active, expired, cancelled
  if p_subscription_status not in ('pilot', 'active', 'expired', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select subscription_status, paid_until into v_current_status, v_current_paid_until
  from public.merchants
  where profile_id = p_merchant_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  v_target_status := p_subscription_status::public.merchant_subscription_status;

  update public.merchants
  set
    subscription_status = v_target_status,
    paid_until = p_paid_until,
    notes = case when p_notes is not null then p_notes else notes end
  where profile_id = p_merchant_id;

  -- D02 / H10: Registrar evento en audit_log
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_set_subscription',
    'merchant',
    p_merchant_id::text,
    jsonb_build_object('subscription_status', v_current_status, 'paid_until', v_current_paid_until),
    jsonb_build_object('subscription_status', v_target_status, 'paid_until', p_paid_until, 'notes', p_notes)
  );

  return jsonb_build_object(
    'merchantId', p_merchant_id,
    'subscriptionStatus', v_target_status,
    'paidUntil', case when p_paid_until is not null then to_char(p_paid_until, 'YYYY-MM-DD') else null end
  );
end;
$$;

-- 5. admin_update_setting
create or replace function public.admin_update_setting(
  p_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_aal text;
  v_old_value jsonb;
  v_str_val text;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_role
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'admin' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_aal := coalesce(
    auth.jwt()->>'aal',
    coalesce((nullif(current_setting('request.jwt.claims', true), ''))::jsonb->>'aal', '')
  );

  if v_aal <> 'aal2' then
    raise exception using errcode = 'P0001', message = 'AAL2_REQUIRED';
  end if;

  select value into v_old_value
  from public.platform_settings
  where key = p_key;

  if p_key = 'min_offer_ars' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'request_ttl_minutes' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'pilot_active' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'pilot_terms_version' then
    -- H13: btrim de la versión para rechazar cadenas vacías o compuestas de solo espacios
    v_str_val := btrim(p_value #>> '{}');
    if jsonb_typeof(p_value) <> 'string' or v_str_val is null or length(v_str_val) = 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'subscription_grace_days' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 0 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_SETTING_KEY';
  end if;

  insert into public.platform_settings (key, value)
  values (p_key, p_value)
  on conflict (key) do update
  set value = excluded.value;

  -- D02 / H10: Registrar evento en audit_log
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_update_setting',
    'platform_setting',
    p_key,
    case when v_old_value is not null then jsonb_build_object('value', v_old_value) else null end,
    jsonb_build_object('value', p_value)
  );

  return jsonb_build_object(
    'key', p_key,
    'value', p_value
  );
end;
$$;

-- H07: Permisos mínimos explícitos en las funciones RPC
revoke all on function public.admin_decide_courier(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_decide_courier(uuid, text, text) to authenticated;

revoke all on function public.admin_suspend_courier(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_suspend_courier(uuid, text) to authenticated;

revoke all on function public.admin_verify_document(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_verify_document(uuid, text, text) to authenticated;

revoke all on function public.admin_set_subscription(uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.admin_set_subscription(uuid, text, date, text) to authenticated;

revoke all on function public.admin_update_setting(text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;
