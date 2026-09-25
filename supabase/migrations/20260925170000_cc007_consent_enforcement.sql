-- CC-007: Invariante de consentimiento legal obligatorio: autorizacion y activacion de identidades Auth
-- Decisiones D06 (arquitectura doble barrera), D07 (roles y backfill determinista) y D08 (estados y reconsentimiento material)

-- 1. Tipo enum para estado de consentimiento en profiles
create type public.consent_status as enum ('pending', 'active', 'reconsent_required');

-- 2. Columna consent_status en profiles (default 'pending')
alter table public.profiles
  add column consent_status public.consent_status not null default 'pending';

-- 3. Backfill determinista de perfiles existentes:
--    - admin: active (exento)
--    - merchant/courier: active solo si existen TOS + Privacy en public.consents; de lo contrario pending
update public.profiles p
set consent_status = case
  when p.role = 'admin' then 'active'::public.consent_status
  when exists (
    select 1 from public.consents c1
    where c1.profile_id = p.id and c1.document = 'tos'
  ) and exists (
    select 1 from public.consents c2
    where c2.profile_id = p.id and c2.document = 'privacy'
  ) then 'active'::public.consent_status
  else 'pending'::public.consent_status
end;

-- 4. Actualizacion del trigger handle_new_user: nuevos merchant/courier nacen en 'pending'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  initial_consent_status public.consent_status := 'pending';
begin
  if requested_role not in ('merchant', 'courier') or requested_role is null then
    raise exception using errcode = 'P0001', message = 'INVALID_SIGNUP_ROLE';
  end if;

  insert into public.profiles (id, role, display_name, phone, consent_status)
  values (
    new.id,
    requested_role::public.profile_role,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    new.raw_user_meta_data ->> 'phone',
    initial_consent_status
  );

  if requested_role = 'merchant' then
    insert into public.merchants (profile_id) values (new.id);
  else
    insert into public.couriers (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 5. Helpers de seguridad en app_private para gate operativo
create or replace function app_private.is_active_operational_actor()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or consent_status = 'active'
      )
  );
$$;

revoke all on function app_private.is_active_operational_actor() from public, anon, authenticated;
grant execute on function app_private.is_active_operational_actor() to authenticated;

create or replace function app_private.is_approved_courier()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.couriers c
    join public.profiles p on p.id = c.profile_id
    where c.profile_id = auth.uid()
      and p.role = 'courier'
      and p.consent_status = 'active'
      and c.status = 'approved'
  );
$$;

revoke all on function app_private.is_approved_courier() from public, anon, authenticated;
grant execute on function app_private.is_approved_courier() to authenticated;

create or replace function app_private.is_courier()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'courier'
      and consent_status = 'active'
  );
$$;

revoke all on function app_private.is_courier() from public, anon, authenticated;
grant execute on function app_private.is_courier() to authenticated;

create or replace function app_private.is_request_merchant(req_id uuid, m_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.delivery_requests dr
    join public.profiles p on p.id = dr.merchant_id
    where dr.id = req_id
      and dr.merchant_id = m_id
      and (p.role = 'admin' or p.consent_status = 'active')
  );
$$;

revoke all on function app_private.is_request_merchant(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.is_request_merchant(uuid, uuid) to authenticated;

create or replace function app_private.is_courier_assigned_to_request(req_id uuid, c_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.delivery_requests dr
    join public.offers o on o.id = dr.accepted_offer_id
    join public.profiles p on p.id = o.courier_id
    where dr.id = req_id
      and o.courier_id = c_id
      and o.status = 'accepted'
      and (p.role = 'admin' or p.consent_status = 'active')
  );
$$;

revoke all on function app_private.is_courier_assigned_to_request(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.is_courier_assigned_to_request(uuid, uuid) to authenticated;

-- 6. Actualizacion de politicas RLS operativas (gate en profiles_update_self, merchants, couriers, etc.)

-- profiles_update_self: freeze de consent_status y exigencia de app_private.is_active_operational_actor
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    id = auth.uid()
    and app_private.is_active_operational_actor()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and consent_status = (select p.consent_status from public.profiles p where p.id = auth.uid())
  );

-- merchants
drop policy if exists merchants_select_self on public.merchants;
create policy merchants_select_self on public.merchants
  for select to authenticated
  using (profile_id = auth.uid() and app_private.is_active_operational_actor());

drop policy if exists merchants_update_self on public.merchants;
create policy merchants_update_self on public.merchants
  for update to authenticated
  using (profile_id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    profile_id = auth.uid()
    and app_private.is_active_operational_actor()
    and subscription_status = (select m.subscription_status from public.merchants m where m.profile_id = auth.uid())
    and paid_until is not distinct from (select m.paid_until from public.merchants m where m.profile_id = auth.uid())
    and notes is not distinct from (select m.notes from public.merchants m where m.profile_id = auth.uid())
  );

-- couriers
drop policy if exists couriers_select_self on public.couriers;
create policy couriers_select_self on public.couriers
  for select to authenticated
  using (profile_id = auth.uid() and app_private.is_active_operational_actor());

drop policy if exists couriers_update_self on public.couriers;
create policy couriers_update_self on public.couriers
  for update to authenticated
  using (profile_id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    profile_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = (select c.status from public.couriers c where c.profile_id = auth.uid())
    and dni_hmac is not distinct from (select c.dni_hmac from public.couriers c where c.profile_id = auth.uid())
    and license_status = (select c.license_status from public.couriers c where c.profile_id = auth.uid())
    and insurance_status = (select c.insurance_status from public.couriers c where c.profile_id = auth.uid())
    and decided_by is not distinct from (select c.decided_by from public.couriers c where c.profile_id = auth.uid())
    and decided_at is not distinct from (select c.decided_at from public.couriers c where c.profile_id = auth.uid())
    and deactivated_at is not distinct from (select c.deactivated_at from public.couriers c where c.profile_id = auth.uid())
  );

-- courier_documents
drop policy if exists courier_documents_select_self on public.courier_documents;
create policy courier_documents_select_self on public.courier_documents
  for select to authenticated
  using (courier_id = auth.uid() and app_private.is_active_operational_actor());

drop policy if exists courier_documents_insert_self on public.courier_documents;
create policy courier_documents_insert_self on public.courier_documents
  for insert to authenticated
  with check (
    courier_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = 'submitted'
    and purge_after is null
    and purged_at is null
  );

-- delivery_requests
drop policy if exists delivery_requests_select_merchant on public.delivery_requests;
create policy delivery_requests_select_merchant on public.delivery_requests
  for select to authenticated
  using (merchant_id = auth.uid() and app_private.is_active_operational_actor());

drop policy if exists delivery_requests_insert_merchant on public.delivery_requests;
create policy delivery_requests_insert_merchant on public.delivery_requests
  for insert to authenticated
  with check (
    merchant_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = 'draft'
    and created_at = now()
    and published_at is null
    and matched_at is null
    and picked_up_at is null
    and delivered_at is null
    and cancelled_at is null
  );

drop policy if exists delivery_requests_update_merchant on public.delivery_requests;
create policy delivery_requests_update_merchant on public.delivery_requests
  for update to authenticated
  using (merchant_id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    merchant_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = (select dr.status from public.delivery_requests dr where dr.id = delivery_requests.id)
    and accepted_offer_id is not distinct from (select dr.accepted_offer_id from public.delivery_requests dr where dr.id = delivery_requests.id)
    and created_at = (select dr.created_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and published_at is not distinct from (select dr.published_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and matched_at is not distinct from (select dr.matched_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and picked_up_at is not distinct from (select dr.picked_up_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and delivered_at is not distinct from (select dr.delivered_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and cancelled_at is not distinct from (select dr.cancelled_at from public.delivery_requests dr where dr.id = delivery_requests.id)
  );

-- offers
drop policy if exists offers_select_courier on public.offers;
create policy offers_select_courier on public.offers
  for select to authenticated
  using (courier_id = auth.uid() and app_private.is_active_operational_actor());

drop policy if exists offers_update_courier on public.offers;
create policy offers_update_courier on public.offers
  for update to authenticated
  using (courier_id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    courier_id = auth.uid()
    and app_private.is_active_operational_actor()
    and request_id = (select o.request_id from public.offers o where o.id = offers.id)
    and status = (select o.status from public.offers o where o.id = offers.id)
    and (select o.status from public.offers o where o.id = offers.id) = 'pending'
  );

-- incidents
drop policy if exists incidents_select_reporter on public.incidents;
create policy incidents_select_reporter on public.incidents
  for select to authenticated
  using (reporter_id = auth.uid() and app_private.is_active_operational_actor());

drop policy if exists incidents_insert_authenticated on public.incidents;
create policy incidents_insert_authenticated on public.incidents
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = 'open'
    and resolution is null
    and (
      app_private.is_request_merchant(request_id, auth.uid())
      or app_private.is_courier_assigned_to_request(request_id, auth.uid())
      or app_private.is_admin()
    )
  );

-- push_subscriptions
drop policy if exists push_subscriptions_all_self on public.push_subscriptions;
create policy push_subscriptions_all_self on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and app_private.is_active_operational_actor())
  with check (user_id = auth.uid() and app_private.is_active_operational_actor());

-- 7. RPC de activacion atomica de consentimientos (service-role only)
create or replace function public.activate_account_consents(
  p_user_id uuid,
  p_tos_version text,
  p_privacy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.profile_role;
  v_current_status public.consent_status;
begin
  -- 1. Validar parametros
  if p_user_id is null or p_tos_version is null or p_privacy_version is null
     or trim(p_tos_version) = '' or trim(p_privacy_version) = '' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- 2. Validar perfil y bloquear fila
  select role, consent_status into v_role, v_current_status
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_role = 'admin' then
    raise exception using errcode = 'P0001', message = 'ADMIN_EXEMPT';
  end if;

  -- 3. Insercion atomica de ambos consentimientos obligatorios
  insert into public.consents (profile_id, document, version, accepted_at)
  values
    (p_user_id, 'tos'::public.consent_document, p_tos_version, now()),
    (p_user_id, 'privacy'::public.consent_document, p_privacy_version, now())
  on conflict (profile_id, document, version) do update
    set accepted_at = excluded.accepted_at;

  -- 4. Activacion del perfil
  update public.profiles
  set consent_status = 'active'::public.consent_status
  where id = p_user_id;

  return json_build_object(
    'success', true,
    'userId', p_user_id,
    'consentStatus', 'active'
  )::jsonb;
end;
$$;

-- Restriccion estricta: nunca invocable por clientes authenticated o anon
revoke all on function public.activate_account_consents(uuid, text, text) from public, anon, authenticated;

-- 8. Actualizacion de RPCs operativas para validar consent_status = 'active' (salvo admin)

-- submit_offer
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
  v_consent_status public.consent_status;
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

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
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

-- withdraw_offer
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
  v_consent_status public.consent_status;
  v_offer public.offers%rowtype;
  v_max_offers_per_min integer;
  v_rate_count integer;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
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

-- set_availability
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
  v_consent_status public.consent_status;
  v_courier_status public.courier_status;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
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

-- publish_request
create or replace function public.publish_request(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or (v_role <> 'merchant' and v_role <> 'admin')
     or (v_role <> 'admin' and v_consent_status <> 'active') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  return app_private.request_cycle('publish_request', p_request_id);
end;
$$;

revoke all on function public.publish_request(uuid) from public, anon, authenticated;
grant execute on function public.publish_request(uuid) to authenticated;

-- accept_offer
create or replace function public.accept_offer(
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
  v_consent_status public.consent_status;
  v_offer public.offers%rowtype;
  v_req public.delivery_requests%rowtype;
  v_courier_status public.courier_status;
  v_now timestamptz := now();
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or (v_role <> 'merchant' and v_role <> 'admin')
     or (v_role <> 'admin' and v_consent_status <> 'active') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_offer_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_req
  from public.delivery_requests
  where id = v_offer.request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select status into v_courier_status
  from public.couriers
  where profile_id = v_offer.courier_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_role <> 'admin' and v_req.merchant_id <> v_actor_id then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_req.status = 'matched' and v_req.accepted_offer_id = p_offer_id then
    return json_build_object(
      'requestId', v_req.id,
      'acceptedOfferId', v_req.accepted_offer_id,
      'status', v_req.status,
      'matchedAt', to_char(v_req.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotent', true
    )::jsonb;
  end if;

  if v_req.status = 'matched' and v_req.accepted_offer_id <> p_offer_id then
    raise exception using errcode = 'P0001', message = 'ALREADY_MATCHED';
  end if;

  if v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;

  if v_req.status <> 'published' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  if v_offer.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_PENDING';
  end if;

  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;

  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;

  update public.offers
  set status = 'accepted',
      decided_at = v_now,
      updated_at = v_now
  where id = p_offer_id;

  update public.delivery_requests
  set status = 'matched',
      accepted_offer_id = p_offer_id,
      matched_at = v_now,
      updated_at = v_now
  where id = v_req.id
  returning * into v_req;

  update public.offers
  set status = 'rejected',
      decided_at = v_now,
      updated_at = v_now
  where request_id = v_req.id
    and id <> p_offer_id
    and status = 'pending';

  return json_build_object(
    'requestId', v_req.id,
    'acceptedOfferId', v_req.accepted_offer_id,
    'status', v_req.status,
    'matchedAt', to_char(v_req.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'idempotent', false
  )::jsonb;
end;
$$;

revoke all on function public.accept_offer(uuid) from public, anon, authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
