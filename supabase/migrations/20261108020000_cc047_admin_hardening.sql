-- CC-047 / T-408: acceso admin solo con aal2, sin escrituras directas privilegiadas, audit_log inmutable para clientes,
-- Storage sin acceso directo del admin, accept_offer sin rol admin, nota interna fuera de merchants.notes y RPC
-- auditadas para las correcciones administrativas del repartidor. Contrato: docs/contracts/CC-047.md.

-- 1. app_private.is_admin() exige aal2. Cubre todas las policies de SELECT admin, la vista merchant_public y
--    request_cancellation_history sin recrearlas.
create or replace function app_private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) -- MUTACIÓN M1: sin aal2
  ;
$$;

revoke all on function app_private.is_admin() from public, anon, authenticated;
grant execute on function app_private.is_admin() to authenticated;

-- 2. Sin escrituras directas privilegiadas del admin. Los grants de tabla a authenticated no cambian: los usan las
--    policies de autoservicio (D3=B).
drop policy if exists profiles_update_admin on public.profiles;
-- MUTACIÓN M2: se restaura la policy de UPDATE admin
create policy profiles_update_admin on public.profiles for update to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());
drop policy if exists merchants_update_admin on public.merchants;
drop policy if exists couriers_update_admin on public.couriers;
drop policy if exists delivery_requests_update_admin on public.delivery_requests;
drop policy if exists contacts_write_admin on public.delivery_request_contacts;
drop policy if exists drops_write_admin on public.delivery_request_drops;
drop policy if exists drop_contacts_write_admin on public.delivery_request_drop_contacts;
drop policy if exists platform_settings_write_admin on public.platform_settings;

drop policy if exists zones_write_admin on public.zones;
create policy zones_select_admin on public.zones
  for select to authenticated
  using (app_private.is_admin());

drop policy if exists push_subscriptions_admin on public.push_subscriptions;
create policy push_subscriptions_select_admin on public.push_subscriptions
  for select to authenticated
  using (app_private.is_admin());

-- rate_limits se escribe solo por RPC security definer. Queda una lectura admin aal2 para cumplir el invariante de
-- rls_enabled.sql (toda tabla pública con al menos una policy).
drop policy if exists rate_limits_admin on public.rate_limits;
create policy rate_limits_select_admin on public.rate_limits
  for select to authenticated
  using (app_private.is_admin());

drop policy if exists consents_admin on public.consents;
create policy consents_select_admin on public.consents
  for select to authenticated
  using (app_private.is_admin());

-- 3. audit_log inmutable para clientes.
drop policy if exists audit_log_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (app_private.is_admin());

revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;
-- MUTACIÓN M3: TRUNCATE vuelve a authenticated
grant truncate on public.audit_log to authenticated;

-- security invoker: en un security definer, current_user sería el dueño y la condición no se cumpliría nunca.
-- Rechaza a los clientes aunque vuelvan por error un grant o una policy; no afecta a service role, a las RPC
-- security definer ni a la acción on delete set null de actor_id (corre como dueño de la tabla).
create or replace function app_private.audit_log_reject_client_change()
returns trigger
language plpgsql
security definer -- MUTACIÓN M4
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception using errcode = 'P0001', message = 'AUDIT_LOG_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app_private.audit_log_reject_client_change() from public, anon, authenticated;

drop trigger if exists audit_log_reject_client_change on public.audit_log;
create trigger audit_log_reject_client_change
  before update or delete on public.audit_log
  for each row execute function app_private.audit_log_reject_client_change();

drop trigger if exists audit_log_reject_client_truncate on public.audit_log;
create trigger audit_log_reject_client_truncate
  before truncate on public.audit_log
  for each statement execute function app_private.audit_log_reject_client_change();

-- 4. Storage: el admin ya no lee, pisa ni borra DNI y selfies directo; sigue la URL firmada auditada por service role.
drop policy if exists courier_docs_admin on storage.objects;

-- 5. accept_offer sin rol admin (SEC-10). Base: 20261009200000_t340_multi_drop.sql; solo cambia el actor.
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
  v_req_id uuid;
  v_courier_status public.courier_status;
  v_now timestamptz := now();
  v_matched_at timestamptz;
begin
  if v_actor_id is null then raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_actor_id;
  -- CC-047 / SEC-10: el admin ya no acepta ofertas en nombre del comercio.
  if v_role is null or v_role <> 'merchant' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;
  if v_role = 'merchant' and v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_offer_id is null then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;

  select request_id into v_req_id from public.offers where id = p_offer_id;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;

  select * into v_req from public.delivery_requests where id = v_req_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_offer.request_id <> v_req.id then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;

  select status into v_courier_status from public.couriers where profile_id = v_offer.courier_id for share;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;

  if v_req.merchant_id <> v_actor_id then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_req.status = 'matched' and v_req.accepted_offer_id = p_offer_id then
    return json_build_object(
      'requestId', v_req.id,
      'acceptedOfferId', v_req.accepted_offer_id,
      'status', v_req.status,
      'matchedAt', to_char(v_req.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotent', true,
      'totalAmountArs', v_offer.amount_ars * v_req.drops_count
    )::jsonb;
  end if;

  if v_req.status = 'matched' and v_req.accepted_offer_id <> p_offer_id then
    raise exception using errcode = 'P0001', message = 'ALREADY_MATCHED';
  end if;

  if v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;

  if v_req.status <> 'published' then raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION'; end if;
  if v_offer.status <> 'pending' then raise exception using errcode = 'P0001', message = 'OFFER_NOT_PENDING'; end if;
  if v_courier_status = 'suspended' then raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED'; end if;
  if v_courier_status <> 'approved' then raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED'; end if;

  perform app_private.match_offer(v_req.id, p_offer_id);
  select matched_at into v_matched_at from public.delivery_requests where id = v_req.id;

  return json_build_object(
    'requestId', v_req.id,
    'acceptedOfferId', p_offer_id,
    'status', 'matched',
    'matchedAt', to_char(v_matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'idempotent', false,
    'totalAmountArs', v_offer.amount_ars * v_req.drops_count
  )::jsonb;
end;
$$;

revoke all on function public.accept_offer(uuid) from public, anon, authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;

-- 6. admin_set_subscription sin escribir merchants.notes (SEC-11). Base: 20261017090000_t369_publication_credits.sql.
--    Sin backfill (D2=B): la limpieza de notas viejas la revisa Lautaro073 a mano por ambiente.
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
  v_current_status public.merchant_subscription_status;
  v_current_paid_until date;
  v_target_status public.merchant_subscription_status;
begin
  -- H14: autenticación, rol admin y MFA (aal2) en un solo lugar
  perform app_private.assert_admin_aal2();

  -- H03: Valores reales del enum merchant_subscription_status: pilot, active, expired, cancelled
  if p_subscription_status not in ('pilot', 'active', 'expired', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select subscription_status, paid_until into v_current_status, v_current_paid_until
  from public.merchants
  where profile_id = p_merchant_id
  for no key update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  -- H03 (revisión PR #397): misma gracia durante el control de superposición y el commit (comercio → parámetro).
  perform 1 from public.platform_settings where key = 'subscription_grace_days' for share;

  v_target_status := p_subscription_status::public.merchant_subscription_status;

  -- T-369 / CC-029 (2-A): el abono legacy no puede superponerse con un período de plan vigente o programado.
  if v_target_status in ('pilot', 'active') and p_paid_until is not null and exists (
    select 1
    from public.merchant_plan_periods as period
    where period.merchant_id = p_merchant_id
      and period.ends_at > now()
      and period.starts_at < (
        (p_paid_until + app_private.request_setting_int('subscription_grace_days') + 1)::timestamp
        at time zone 'America/Argentina/Buenos_Aires'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- H12: paid_until se REEMPLAZA siempre, así que omitirlo lo deja en null (p. ej. al pasar a expired/cancelled).
  -- CC-047 / SEC-11: p_notes ya no se escribe en merchants.notes (la «Referencia adicional» del comercio); la nota
  -- interna queda solo en audit_log.after.notes, que lee únicamente un admin aal2.
  update public.merchants
  set
    subscription_status = v_target_status,
    paid_until = p_paid_until,
    notes = case when p_notes is not null then p_notes else notes end -- MUTACIÓN M6
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

revoke all on function public.admin_set_subscription(uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.admin_set_subscription(uuid, text, date, text) to authenticated;

-- 7. Correcciones administrativas del repartidor por RPC auditada (D1=A). Reemplazan el UPDATE directo que permitía
--    profiles_update_admin; toman el mismo lock de fila, así que se conservan las carreras de CC-031.
create or replace function public.admin_correct_courier_display_name(
  p_courier_id uuid,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before text;
begin
  -- MUTACIÓN M5: sin assert_admin_aal2
  

  if p_courier_id is null
    or p_display_name is null
    or p_display_name <> btrim(p_display_name)
    or char_length(p_display_name) not between 1 and 120 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select display_name into v_before
  from public.profiles
  where id = p_courier_id and role = 'courier'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  update public.profiles set display_name = p_display_name where id = p_courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    auth.uid(),
    'admin_correct_courier_display_name',
    'courier',
    p_courier_id::text,
    jsonb_build_object('display_name', v_before),
    jsonb_build_object('display_name', p_display_name)
  );

  return jsonb_build_object('courierId', p_courier_id, 'displayName', p_display_name);
end;
$$;

revoke all on function public.admin_correct_courier_display_name(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_correct_courier_display_name(uuid, text) to authenticated;

create or replace function public.admin_revoke_courier_consent(
  p_courier_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.consent_status;
begin
  perform app_private.assert_admin_aal2();

  if p_courier_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select consent_status into v_before
  from public.profiles
  where id = p_courier_id and role = 'courier'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  update public.profiles set consent_status = 'reconsent_required' where id = p_courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    auth.uid(),
    'admin_revoke_courier_consent',
    'courier',
    p_courier_id::text,
    jsonb_build_object('consent_status', v_before),
    jsonb_build_object('consent_status', 'reconsent_required')
  );

  return jsonb_build_object('courierId', p_courier_id, 'consentStatus', 'reconsent_required');
end;
$$;

revoke all on function public.admin_revoke_courier_consent(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_courier_consent(uuid) to authenticated;
