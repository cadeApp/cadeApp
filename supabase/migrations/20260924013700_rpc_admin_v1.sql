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

  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  v_target_status := p_decision::public.courier_status;

  update public.couriers
  set
    status = v_target_status,
    decided_at = v_decided_at,
    decided_by = v_actor_id
  where profile_id = p_courier_id;

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

  -- Withdraw all pending offers for this courier
  update public.offers
  set
    status = 'withdrawn'::public.offer_status,
    withdrawn_at = v_deactivated_at
  where courier_id = p_courier_id
    and status = 'pending';

  get diagnostics v_withdrawn_count = row_count;

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

  select courier_id, kind, status into v_courier_id, v_kind, v_doc_status
  from public.courier_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  v_target_status := p_decision::public.document_review_status;

  update public.courier_documents
  set status = v_target_status
  where id = p_document_id;

  if v_kind = 'driver_license' then
    update public.couriers
    set license_status = v_target_status
    where profile_id = v_courier_id;
  elsif v_kind = 'vehicle_insurance' then
    update public.couriers
    set insurance_status = v_target_status
    where profile_id = v_courier_id;
  end if;

  select doc_level into v_doc_level
  from public.couriers
  where profile_id = v_courier_id;

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

  if p_subscription_status not in ('pilot', 'active', 'past_due', 'canceled') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select subscription_status into v_current_status
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
    if jsonb_typeof(p_value) <> 'string' or length(trim(both '"' from p_value::text)) = 0 then
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

  return jsonb_build_object(
    'key', p_key,
    'value', p_value
  );
end;
$$;
