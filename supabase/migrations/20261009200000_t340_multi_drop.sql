-- ============================================================================
-- T-340 / CC-022: Multi-drop (varias entregas por solicitud)
-- ============================================================================

-- 1. Tablas nuevas
create table if not exists public.delivery_request_drops (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.delivery_requests(id) on delete cascade,
  position smallint not null check (position >= 1),
  dropoff_zone_id uuid not null references public.zones(id),
  package_type public.package_type not null,
  recipient_payment_method public.recipient_payment_method not null,
  needs_change boolean not null default false,
  approx_distance_m integer null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz null,
  failed_reason text null,
  unique (request_id, position),
  check ((status = 'delivered') = (delivered_at is not null)),
  check ((status = 'failed') = (failed_reason is not null)),
  check (recipient_payment_method = 'cash' or needs_change = false)
);

create table if not exists public.delivery_request_drop_contacts (
  drop_id uuid primary key references public.delivery_request_drops(id) on delete cascade,
  dropoff_address text not null,
  dropoff_lat double precision null,
  dropoff_lng double precision null,
  recipient_name text not null,
  recipient_phone text not null,
  recipient_consent_declared boolean not null,
  cash_change_amount integer null check (cash_change_amount > 0),
  notes text null
);

-- 2. Alter a tablas existentes
alter table public.delivery_requests
  add column if not exists drops_count smallint not null default 1 check (drops_count >= 1);

alter table public.delivery_requests
  alter column dropoff_zone_id drop not null,
  alter column package_type drop not null,
  alter column recipient_payment_method drop not null;

alter table public.delivery_request_contacts
  alter column dropoff_address drop not null,
  alter column recipient_name drop not null,
  alter column recipient_phone drop not null,
  alter column recipient_consent_declared drop not null;

-- 3. Grants por columna para authenticated
revoke all on public.delivery_request_drops from public, anon, authenticated;
grant select on public.delivery_request_drops to authenticated;
grant insert (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
  on public.delivery_request_drops to authenticated;
grant update (position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
  on public.delivery_request_drops to authenticated;
grant delete on public.delivery_request_drops to authenticated;

revoke all on public.delivery_request_drop_contacts from public, anon, authenticated;
grant select on public.delivery_request_drop_contacts to authenticated;
grant insert on public.delivery_request_drop_contacts to authenticated;
grant update (dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared, cash_change_amount, notes)
  on public.delivery_request_drop_contacts to authenticated;
grant delete on public.delivery_request_drop_contacts to authenticated;

-- CC-023: grant select sobre drops_count a authenticated
grant select (drops_count) on public.delivery_requests to authenticated;

-- 4. Helper y trigger de serialización del borrador (CC-022 §2b)
create or replace function app_private.lock_draft_request_for_child_write()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_req_id uuid;
  v_req_status public.delivery_request_status;
  v_req_merchant_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
    if TG_TABLE_NAME = 'delivery_request_drops' then
      v_req_id := coalesce(NEW.request_id, OLD.request_id);
    elsif TG_TABLE_NAME = 'delivery_request_drop_contacts' then
      if TG_OP = 'DELETE' then
        select request_id into v_req_id
        from public.delivery_request_drops
        where id = OLD.drop_id;
        if v_req_id is null then
          return coalesce(NEW, OLD);
        end if;
      else
        select request_id into v_req_id
        from public.delivery_request_drops
        where id = NEW.drop_id;
      end if;
    end if;

    if v_req_id is null then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;

    select status, merchant_id into v_req_status, v_req_merchant_id
    from public.delivery_requests
    where id = v_req_id
    for update;

    if not found or v_req_merchant_id <> auth.uid() then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;

    if v_req_status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
    end if;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

revoke all on function app_private.lock_draft_request_for_child_write() from public, anon, authenticated;

drop trigger if exists trg_lock_draft_drops on public.delivery_request_drops;
create trigger trg_lock_draft_drops
  before insert or update or delete on public.delivery_request_drops
  for each row execute function app_private.lock_draft_request_for_child_write();

drop trigger if exists trg_lock_draft_drop_contacts on public.delivery_request_drop_contacts;
create trigger trg_lock_draft_drop_contacts
  before insert or update or delete on public.delivery_request_drop_contacts
  for each row execute function app_private.lock_draft_request_for_child_write();

-- 5. RLS y policies
alter table public.delivery_request_drops enable row level security;
alter table public.delivery_request_drop_contacts enable row level security;

-- delivery_request_drops policies
drop policy if exists drops_select_merchant on public.delivery_request_drops;
create policy drops_select_merchant on public.delivery_request_drops
  for select to authenticated
  using (app_private.is_request_merchant(request_id, auth.uid()));

drop policy if exists drops_select_courier on public.delivery_request_drops;
create policy drops_select_courier on public.delivery_request_drops
  for select to authenticated
  using (
    app_private.is_approved_courier()
    and exists (
      select 1 from public.delivery_requests dr
      where dr.id = delivery_request_drops.request_id
        and (
          (dr.status = 'published' and (dr.expires_at is null or dr.expires_at > now()))
          or (dr.accepted_offer_id is not null and app_private.is_accepted_offer_courier(dr.accepted_offer_id, auth.uid()))
        )
    )
  );

drop policy if exists drops_select_admin on public.delivery_request_drops;
create policy drops_select_admin on public.delivery_request_drops
  for select to authenticated
  using (app_private.is_admin());

drop policy if exists drops_insert_merchant on public.delivery_request_drops;
create policy drops_insert_merchant on public.delivery_request_drops
  for insert to authenticated
  with check (
    app_private.is_request_merchant(request_id, auth.uid())
    and (select dr.status from public.delivery_requests dr where dr.id = delivery_request_drops.request_id) = 'draft'
    and status = 'pending'
    and delivered_at is null
    and failed_reason is null
  );

drop policy if exists drops_update_merchant on public.delivery_request_drops;
create policy drops_update_merchant on public.delivery_request_drops
  for update to authenticated
  using (
    app_private.is_request_merchant(request_id, auth.uid())
    and (select dr.status from public.delivery_requests dr where dr.id = delivery_request_drops.request_id) = 'draft'
  )
  with check (
    app_private.is_request_merchant(request_id, auth.uid())
    and (select dr.status from public.delivery_requests dr where dr.id = delivery_request_drops.request_id) = 'draft'
    and status = 'pending'
    and delivered_at is null
    and failed_reason is null
  );

drop policy if exists drops_delete_merchant on public.delivery_request_drops;
create policy drops_delete_merchant on public.delivery_request_drops
  for delete to authenticated
  using (
    app_private.is_request_merchant(request_id, auth.uid())
    and (select dr.status from public.delivery_requests dr where dr.id = delivery_request_drops.request_id) = 'draft'
  );

drop policy if exists drops_write_admin on public.delivery_request_drops;
create policy drops_write_admin on public.delivery_request_drops
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- delivery_request_drop_contacts policies
drop policy if exists drop_contacts_select_merchant on public.delivery_request_drop_contacts;
create policy drop_contacts_select_merchant on public.delivery_request_drop_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_request_drops d
      where d.id = delivery_request_drop_contacts.drop_id
        and app_private.is_request_merchant(d.request_id, auth.uid())
    )
  );

drop policy if exists drop_contacts_select_accepted_courier on public.delivery_request_drop_contacts;
create policy drop_contacts_select_accepted_courier on public.delivery_request_drop_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_request_drops d
      where d.id = delivery_request_drop_contacts.drop_id
        and app_private.is_courier_assigned_to_request(d.request_id, auth.uid())
    )
  );

drop policy if exists drop_contacts_select_admin on public.delivery_request_drop_contacts;
create policy drop_contacts_select_admin on public.delivery_request_drop_contacts
  for select to authenticated
  using (app_private.is_admin());

drop policy if exists drop_contacts_insert_merchant on public.delivery_request_drop_contacts;
create policy drop_contacts_insert_merchant on public.delivery_request_drop_contacts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.delivery_request_drops d
      join public.delivery_requests r on r.id = d.request_id
      where d.id = delivery_request_drop_contacts.drop_id
        and r.merchant_id = auth.uid()
        and r.status = 'draft'
    )
  );

drop policy if exists drop_contacts_update_merchant on public.delivery_request_drop_contacts;
create policy drop_contacts_update_merchant on public.delivery_request_drop_contacts
  for update to authenticated
  using (
    exists (
      select 1 from public.delivery_request_drops d
      join public.delivery_requests r on r.id = d.request_id
      where d.id = delivery_request_drop_contacts.drop_id
        and r.merchant_id = auth.uid()
        and r.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.delivery_request_drops d
      join public.delivery_requests r on r.id = d.request_id
      where d.id = delivery_request_drop_contacts.drop_id
        and r.merchant_id = auth.uid()
        and r.status = 'draft'
    )
  );

drop policy if exists drop_contacts_delete_merchant on public.delivery_request_drop_contacts;
create policy drop_contacts_delete_merchant on public.delivery_request_drop_contacts
  for delete to authenticated
  using (
    exists (
      select 1 from public.delivery_request_drops d
      join public.delivery_requests r on r.id = d.request_id
      where d.id = delivery_request_drop_contacts.drop_id
        and r.merchant_id = auth.uid()
        and r.status = 'draft'
    )
  );

drop policy if exists drop_contacts_write_admin on public.delivery_request_drop_contacts;
create policy drop_contacts_write_admin on public.delivery_request_drop_contacts
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- Actualizar delivery_requests_update_merchant para congelar drops_count
drop policy if exists delivery_requests_update_merchant on public.delivery_requests;
create policy delivery_requests_update_merchant on public.delivery_requests
  for update to authenticated
  using (merchant_id = auth.uid())
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
    and drops_count = (select dr.drops_count from public.delivery_requests dr where dr.id = delivery_requests.id)
    and (
      (select dr.status from public.delivery_requests dr where dr.id = delivery_requests.id) = 'draft'
      or (
        fixed_price_ars is not distinct from (select dr.fixed_price_ars from public.delivery_requests dr where dr.id = delivery_requests.id)
        and auto_assign = (select dr.auto_assign from public.delivery_requests dr where dr.id = delivery_requests.id)
      )
    )
  );

-- 6. Helper privado para distancia por segmento (CC-022 §7)
create or replace function app_private.route_segment_distance(
  p_lat1 numeric,
  p_lng1 numeric,
  p_lat2 numeric,
  p_lng2 numeric
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dlat double precision;
  v_dlng double precision;
  v_a double precision;
  v_c double precision;
  v_raw_meters double precision;
  v_dist integer;
begin
  if p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then
    return null;
  end if;

  if p_lat1 = p_lat2 and p_lng1 = p_lng2 then
    return 0;
  end if;

  v_dlat := radians((p_lat2 - p_lat1)::double precision);
  v_dlng := radians((p_lng2 - p_lng1)::double precision);
  v_a := sin(v_dlat / 2.0)^2 + cos(radians(p_lat1::double precision)) * cos(radians(p_lat2::double precision)) * sin(v_dlng / 2.0)^2;
  v_c := 2.0 * atan2(sqrt(v_a), sqrt(greatest(0.0::double precision, 1.0::double precision - v_a)));
  v_raw_meters := 6371000.0 * v_c * 1.30;
  v_dist := round(v_raw_meters / 500.0)::integer * 500;
  if v_dist < 500 then
    v_dist := 500;
  end if;
  return v_dist;
end;
$$;

revoke all on function app_private.route_segment_distance(numeric, numeric, numeric, numeric) from public, anon, authenticated;

-- 7. calculate_route_distance pública usando el helper privado
create or replace function public.calculate_route_distance(
  p_pickup_lat numeric default null,
  p_pickup_lng numeric default null,
  p_dropoff_lat numeric default null,
  p_dropoff_lng numeric default null,
  p_pickup_zone_id uuid default null,
  p_dropoff_zone_id uuid default null,
  p_pickup_zone_name text default null,
  p_dropoff_zone_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role public.profile_role;
  v_lat1 numeric := p_pickup_lat;
  v_lng1 numeric := p_pickup_lng;
  v_lat2 numeric := p_dropoff_lat;
  v_lng2 numeric := p_dropoff_lng;
  v_pickup_zone_name text := nullif(trim(p_pickup_zone_name), '');
  v_dropoff_zone_name text := nullif(trim(p_dropoff_zone_name), '');
  v_pickup_lookup_name text;
  v_dropoff_lookup_name text;
  v_pickup_centroid_lat numeric;
  v_pickup_centroid_lng numeric;
  v_dropoff_centroid_lat numeric;
  v_dropoff_centroid_lng numeric;
  v_route_distance_m integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_actor_role
  from public.profiles
  where id = auth.uid();

  if v_actor_role is null or v_actor_role not in ('merchant', 'courier', 'admin') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_actor_role in ('merchant', 'courier') and not app_private.is_active_operational_actor() then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if (p_pickup_lat is null) <> (p_pickup_lng is null) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if (p_dropoff_lat is null) <> (p_dropoff_lng is null) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_pickup_lat is not null then
    if p_pickup_lat < -27.4800 or p_pickup_lat > -27.3800 or
       p_pickup_lng < -65.6450 or p_pickup_lng > -65.5800 then
      raise exception using errcode = 'P0001', message = 'OUT_OF_BOUNDS_AGUILARES';
    end if;
  end if;

  if p_dropoff_lat is not null then
    if p_dropoff_lat < -27.4800 or p_dropoff_lat > -27.3800 or
       p_dropoff_lng < -65.6450 or p_dropoff_lng > -65.5800 then
      raise exception using errcode = 'P0001', message = 'OUT_OF_BOUNDS_AGUILARES';
    end if;
  end if;

  if v_lat1 is null or v_pickup_zone_name is null then
    if p_pickup_zone_id is not null then
      select name, centroid_lat, centroid_lng
      into v_pickup_lookup_name, v_pickup_centroid_lat, v_pickup_centroid_lng
      from public.zones
      where id = p_pickup_zone_id;
    elsif v_pickup_zone_name is not null then
      select name, centroid_lat, centroid_lng
      into v_pickup_lookup_name, v_pickup_centroid_lat, v_pickup_centroid_lng
      from public.zones
      where name = v_pickup_zone_name;
    end if;

    if v_lat1 is null then
      if v_pickup_lookup_name is null or v_pickup_centroid_lat is null or v_pickup_centroid_lng is null then
        raise exception using errcode = 'P0001', message = 'INVALID_ZONE';
      end if;
      v_lat1 := v_pickup_centroid_lat;
      v_lng1 := v_pickup_centroid_lng;
    end if;

    if v_pickup_zone_name is null and v_pickup_lookup_name is not null then
      v_pickup_zone_name := v_pickup_lookup_name;
    end if;
  end if;

  if v_lat2 is null or v_dropoff_zone_name is null then
    if p_dropoff_zone_id is not null then
      select name, centroid_lat, centroid_lng
      into v_dropoff_lookup_name, v_dropoff_centroid_lat, v_dropoff_centroid_lng
      from public.zones
      where id = p_dropoff_zone_id;
    elsif v_dropoff_zone_name is not null then
      select name, centroid_lat, centroid_lng
      into v_dropoff_lookup_name, v_dropoff_centroid_lat, v_dropoff_centroid_lng
      from public.zones
      where name = v_dropoff_zone_name;
    end if;

    if v_lat2 is null then
      if v_dropoff_lookup_name is null or v_dropoff_centroid_lat is null or v_dropoff_centroid_lng is null then
        raise exception using errcode = 'P0001', message = 'INVALID_ZONE';
      end if;
      v_lat2 := v_dropoff_centroid_lat;
      v_lng2 := v_dropoff_centroid_lng;
    end if;

    if v_dropoff_zone_name is null and v_dropoff_lookup_name is not null then
      v_dropoff_zone_name := v_dropoff_lookup_name;
    end if;
  end if;

  v_route_distance_m := app_private.route_segment_distance(v_lat1, v_lng1, v_lat2, v_lng2);

  v_result := jsonb_build_object('routeDistanceM', v_route_distance_m);

  if v_pickup_zone_name is not null and v_dropoff_zone_name is not null then
    v_result := v_result || jsonb_build_object(
      'displayLabel',
      'De barrio ' || trim(v_pickup_zone_name) || ' a barrio ' || trim(v_dropoff_zone_name)
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.calculate_route_distance(numeric, numeric, numeric, numeric, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.calculate_route_distance(numeric, numeric, numeric, numeric, uuid, uuid, text, text) to authenticated;

-- 8. Setting configurable max_drops_per_request (CC-022 §4)
insert into public.platform_settings (key, value)
values ('max_drops_per_request', '5'::jsonb)
on conflict (key) do nothing;

-- 9. admin_update_setting actualizado
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
  v_old_value jsonb;
  v_str_val text;
begin
  perform app_private.assert_admin_aal2();

  select value into v_old_value
  from public.platform_settings
  where key = p_key
  for update;

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
    v_str_val := btrim(p_value #>> '{}');
    if jsonb_typeof(p_value) <> 'string' or v_str_val is null or length(v_str_val) = 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'subscription_grace_days' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 0 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'max_drops_per_request' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_SETTING_KEY';
  end if;

  insert into public.platform_settings (key, value)
  values (p_key, p_value)
  on conflict (key) do update
  set value = excluded.value;

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

revoke all on function public.admin_update_setting(text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;

-- 10. Actualización de app_private.request_cycle para multi-drop
create or replace function app_private.request_cycle(
  p_action text,
  p_request_id uuid,
  p_reason text default null,
  p_republish boolean default false,
  p_kind text default null,
  p_description text default null
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
  v_courier public.couriers%rowtype;
  v_merchant public.merchants%rowtype;
  v_contacts public.delivery_request_contacts%rowtype;
  v_pickup public.zones%rowtype;
  v_eff_status public.delivery_request_status;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_pilot jsonb;
  v_grace integer;
  v_distance integer;
  v_lat1 numeric; v_lng1 numeric; v_lat2 numeric; v_lng2 numeric;
  v_count integer;
  v_limit integer;
  v_status public.delivery_request_status;
  v_result jsonb;
  v_incident uuid;
  v_rate_action text;
  v_consent_status public.consent_status;
  -- Variables de multi-drop
  v_drops_count integer := 0;
  v_max_drops integer;
  v_new_drop_id uuid;
  v_drop_row record;
  v_can_calc_total boolean;
  v_total_distance integer;
  v_seg_distance integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_uid;
  if (v_role is null or (v_role = 'courier' and p_action in ('publish_request','republish_request','report_no_show'))
    or (p_action in ('publish_request','republish_request','report_no_show') and v_role <> 'merchant')
    or (p_action in ('mark_picked_up','mark_delivered','courier_cancel_match') and v_role <> 'courier')
    or (p_action = 'report_incident' and v_role not in ('merchant','courier'))
    or (p_action = 'cancel_request' and v_role not in ('merchant','admin'))) then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;
  if v_role <> 'admin' and (v_consent_status is distinct from 'active') then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  if p_request_id is null or (p_action = 'report_incident' and (
      p_kind is null or p_description is null
      or length(btrim(p_kind)) not between 2 and 80
      or length(btrim(p_description)) not between 5 and 1000)) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select * into v_request from public.delivery_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_offer from public.offers
    where id = v_request.accepted_offer_id and request_id = p_request_id for update;
  if v_role = 'courier' then
    if p_action = 'report_incident' and (v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted') then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
    select * into v_courier from public.couriers where profile_id = v_uid for share;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_courier.status = 'suspended' then raise exception 'COURIER_SUSPENDED' using errcode = 'P0001'; end if;
    if v_courier.status <> 'approved' then raise exception 'COURIER_NOT_APPROVED' using errcode = 'P0001'; end if;
    if v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted' then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
  elsif v_role = 'merchant' and v_request.merchant_id <> v_uid then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  v_eff_status := case when v_request.status = 'published' and v_request.expires_at <= v_now
    then 'expired'::public.delivery_request_status else v_request.status end;
  if p_action = 'cancel_request' and v_request.status = 'published' and v_request.expires_at <= v_now then
    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;
  if (p_action = 'publish_request' and v_eff_status <> 'draft')
    or (p_action = 'cancel_request' and not (
      (v_role = 'merchant' and v_eff_status in ('published','matched'))
      or (v_role = 'admin' and v_eff_status = 'in_transit')))
    or (p_action in ('mark_picked_up','report_no_show','courier_cancel_match') and v_eff_status <> 'matched')
    or (p_action = 'mark_delivered' and v_eff_status <> 'in_transit')
    or (p_action = 'republish_request' and v_eff_status not in ('matched','expired','cancelled'))
    or (p_action = 'report_incident' and v_eff_status not in ('published','matched','in_transit','delivered')) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  -- CC-022 §6: mark_delivered sólo se admite si drops_count = 1
  if p_action = 'mark_delivered' and v_request.drops_count > 1 then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  if p_action = 'cancel_request' and v_role = 'admin'
    and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'AAL2_REQUIRED' using errcode = 'P0001';
  end if;
  if ((p_action = 'cancel_request' and v_eff_status in ('matched','in_transit'))
    or (p_action = 'republish_request' and v_eff_status = 'matched')
    or p_action = 'courier_cancel_match') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_action = 'cancel_request' and v_role = 'admin' and v_eff_status = 'in_transit'
    and not exists (select 1 from public.incidents where request_id = p_request_id) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_no_show' and (v_offer.id is null or v_offer.status <> 'accepted') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_incident' and v_eff_status = 'delivered'
    and (v_request.delivered_at is null or v_now > v_request.delivered_at + interval '24 hours') then
    raise exception 'INCIDENT_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;

  if p_action in ('publish_request','republish_request') or (p_action = 'report_no_show' and p_republish) then
    select * into v_merchant from public.merchants where profile_id = v_request.merchant_id for share;
    select value into v_pilot from public.platform_settings where key = 'pilot_active';
    if v_pilot is null or jsonb_typeof(v_pilot) <> 'boolean' then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    v_grace := app_private.request_setting_int('subscription_grace_days');
    if v_merchant.profile_id is null or v_merchant.subscription_status in ('expired','cancelled')
      or not coalesce((v_merchant.subscription_status = 'pilot' and v_pilot = 'true'::jsonb)
        or (v_merchant.paid_until + v_grace >=
          (v_now at time zone 'America/Argentina/Buenos_Aires')::date), false) then
      raise exception 'SUBSCRIPTION_INACTIVE' using errcode = 'P0001';
    end if;
  end if;
  if p_action in ('publish_request','republish_request','courier_cancel_match')
    or (p_action = 'report_no_show' and p_republish) then
    v_expires := v_now + make_interval(mins => app_private.request_setting_int('request_ttl_minutes'));
  end if;

  if p_action = 'publish_request' then
    -- 1. Puente legacy si la solicitud tiene CERO drops (CC-022 §5)
    select count(*) into v_drops_count from public.delivery_request_drops where request_id = p_request_id;
    if v_drops_count = 0 then
      select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for update;
      if not found or not v_contacts.recipient_consent_declared
         or btrim(coalesce(v_contacts.dropoff_address, '')) = ''
         or btrim(coalesce(v_contacts.recipient_name, '')) = ''
         or btrim(coalesce(v_contacts.recipient_phone, '')) = ''
         or v_request.dropoff_zone_id is null
         or v_request.package_type is null
         or v_request.recipient_payment_method is null then
        raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
      end if;

      if v_request.recipient_payment_method = 'cash' and v_request.needs_change then
        if v_request.cash_change_amount is null or v_request.cash_change_amount <= 0 then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      end if;

      insert into public.delivery_request_drops (
        request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status
      ) values (
        p_request_id,
        1,
        v_request.dropoff_zone_id,
        v_request.package_type,
        v_request.recipient_payment_method,
        case when v_request.recipient_payment_method = 'cash' then v_request.needs_change else false end,
        'pending'
      ) returning id into v_new_drop_id;

      insert into public.delivery_request_drop_contacts (
        drop_id, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared, cash_change_amount, notes
      ) values (
        v_new_drop_id,
        v_contacts.dropoff_address,
        v_contacts.dropoff_lat,
        v_contacts.dropoff_lng,
        v_contacts.recipient_name,
        v_contacts.recipient_phone,
        v_contacts.recipient_consent_declared,
        case when v_request.recipient_payment_method = 'cash' and v_request.needs_change then v_request.cash_change_amount else null end,
        v_request.notes
      );
      v_drops_count := 1;
    end if;

    select count(*) into v_drops_count from public.delivery_request_drops where request_id = p_request_id;
    if v_drops_count = 0 then
      raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
    end if;

    v_max_drops := app_private.request_setting_int('max_drops_per_request');
    if v_drops_count > v_max_drops then
      raise exception 'DROP_LIMIT_EXCEEDED' using errcode = 'P0001';
    end if;

    -- Posiciones consecutivas desde 1
    if exists (
      select 1
      from generate_series(1, v_drops_count) as expected_pos
      where not exists (
        select 1 from public.delivery_request_drops d
        where d.request_id = p_request_id and d.position = expected_pos
      )
    ) then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;

    select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for share;
    if not found or btrim(coalesce(v_contacts.pickup_address, '')) = '' then
      raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
    end if;

    select * into v_pickup from public.zones where id = v_request.pickup_zone_id for share;
    if v_pickup.id is null or not v_pickup.active then
      raise exception 'INVALID_ZONE' using errcode = 'P0001';
    end if;

    v_lat1 := coalesce(v_contacts.pickup_lat, v_pickup.centroid_lat);
    v_lng1 := coalesce(v_contacts.pickup_lng, v_pickup.centroid_lng);
    if v_lat1 is not null and (v_lat1 not between -27.4800 and -27.3800 or v_lng1 not between -65.6450 and -65.5800) then
      raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
    end if;

    v_can_calc_total := (v_lat1 is not null and v_lng1 is not null);
    v_total_distance := 0;

    for v_drop_row in
      select d.id, d.position, d.dropoff_zone_id, d.recipient_payment_method, d.needs_change,
             dc.drop_id, dc.dropoff_address, dc.dropoff_lat, dc.dropoff_lng, dc.recipient_name, dc.recipient_phone,
             dc.recipient_consent_declared, dc.cash_change_amount,
             z.active as zone_active, z.centroid_lat, z.centroid_lng
      from public.delivery_request_drops d
      left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
      left join public.zones z on z.id = d.dropoff_zone_id
      where d.request_id = p_request_id
      order by d.position
    loop
      if v_drop_row.drop_id is null
         or not coalesce(v_drop_row.recipient_consent_declared, false)
         or btrim(coalesce(v_drop_row.dropoff_address, '')) = ''
         or btrim(coalesce(v_drop_row.recipient_name, '')) = ''
         or btrim(coalesce(v_drop_row.recipient_phone, '')) = '' then
        raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
      end if;

      if v_drop_row.dropoff_zone_id is null or not coalesce(v_drop_row.zone_active, false) then
        raise exception 'INVALID_ZONE' using errcode = 'P0001';
      end if;

      v_lat2 := coalesce(v_drop_row.dropoff_lat, v_drop_row.centroid_lat);
      v_lng2 := coalesce(v_drop_row.dropoff_lng, v_drop_row.centroid_lng);
      if v_lat2 is not null and (v_lat2 not between -27.4800 and -27.3800 or v_lng2 not between -65.6450 and -65.5800) then
        raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
      end if;

      if v_drop_row.recipient_payment_method <> 'cash' and v_drop_row.needs_change then
        raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
      end if;
      if v_drop_row.recipient_payment_method = 'cash' and v_drop_row.needs_change then
        if v_drop_row.cash_change_amount is null or v_drop_row.cash_change_amount <= 0 then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      else
        if v_drop_row.cash_change_amount is not null then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      end if;

      if v_can_calc_total and v_lat1 is not null and v_lng1 is not null and v_lat2 is not null and v_lng2 is not null then
        v_seg_distance := app_private.route_segment_distance(v_lat1, v_lng1, v_lat2, v_lng2);
        update public.delivery_request_drops set approx_distance_m = v_seg_distance where id = v_drop_row.id;
        v_total_distance := v_total_distance + v_seg_distance;
        v_lat1 := v_lat2;
        v_lng1 := v_lng2;
      else
        v_can_calc_total := false;
        update public.delivery_request_drops set approx_distance_m = null where id = v_drop_row.id;
      end if;
    end loop;

    v_distance := case when v_can_calc_total then v_total_distance else null end;
    update public.delivery_requests set drops_count = v_drops_count where id = p_request_id;

    if v_request.fixed_price_ars is not null and v_request.fixed_price_ars < app_private.request_setting_int('min_offer_ars') then
      raise exception 'OFFER_BELOW_MINIMUM' using errcode = 'P0001';
    end if;
  end if;

  if p_action in ('publish_request','republish_request','report_incident') then
    v_rate_action := case when p_action = 'report_incident' then 'report_incident' else 'publish_request' end;
    v_limit := app_private.request_setting_int(case when p_action = 'report_incident'
      then 'max_incidents_per_min' else 'max_request_publications_per_min' end);
    insert into public.rate_limits (subject, action, window_start, count)
      values (v_uid::text, v_rate_action, date_trunc('minute', v_now), 1)
      on conflict (subject, action, window_start) do update set count = public.rate_limits.count + 1
      returning count into v_count;
    if v_count > v_limit then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;
  end if;

  if p_action = 'report_incident' then
    insert into public.incidents (request_id, reporter_id, kind, description, status)
      values (p_request_id, v_uid, btrim(p_kind), btrim(p_description), 'open') returning id into v_incident;
    return jsonb_build_object('incidentId', v_incident, 'requestId', p_request_id, 'status', 'open', 'createdAt', v_now);
  elsif p_action = 'mark_picked_up' then
    update public.delivery_requests set status = 'in_transit', picked_up_at = v_now where id = p_request_id;
    return jsonb_build_object('requestId', p_request_id, 'status', 'in_transit', 'pickedUpAt', v_now);
  elsif p_action = 'mark_delivered' then
    update public.delivery_requests set status = 'delivered', delivered_at = v_now where id = p_request_id;
    update public.delivery_request_drops set status = 'delivered', delivered_at = v_now where request_id = p_request_id and position = 1;
    return jsonb_build_object('requestId', p_request_id, 'status', 'delivered', 'deliveredAt', v_now);
  end if;

  v_status := case when p_action = 'cancel_request' or (p_action = 'report_no_show' and not p_republish)
    then 'cancelled'::public.delivery_request_status else 'published'::public.delivery_request_status end;
  update public.offers set status = 'cancelled', decided_at = v_now
    where id = v_request.accepted_offer_id and request_id = p_request_id and status = 'accepted';
  update public.offers set status = 'expired', decided_at = v_now
    where request_id = p_request_id and status = 'pending';
  if p_action = 'report_no_show' or nullif(btrim(p_reason), '') is not null then
    insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason)
      values (p_request_id, v_request.accepted_offer_id, v_uid, p_action,
        case when p_action = 'report_no_show' then 'no_show' else btrim(p_reason) end);
  end if;
  update public.delivery_requests set status = v_status, accepted_offer_id = null,
    published_at = case when v_status = 'published' then v_now else published_at end,
    expires_at = v_expires,
    matched_at = case when v_status = 'published' then null else matched_at end,
    picked_up_at = case when v_status = 'published' then null else picked_up_at end,
    delivered_at = null,
    cancelled_at = case when v_status = 'cancelled' then v_now end,
    cancel_reason = case when p_action = 'report_no_show' then 'no_show' else nullif(btrim(p_reason), '') end,
    route_distance_m = case when p_action = 'publish_request' then v_distance else route_distance_m end
    where id = p_request_id;
  if v_status = 'published' then
    update public.delivery_requests set cancel_reason = null where id = p_request_id;
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
    values (v_uid, p_action, 'delivery_request', p_request_id,
      jsonb_build_object('status', v_request.status, 'offerId', v_request.accepted_offer_id),
      jsonb_build_object('status', v_status));
  v_result := jsonb_build_object('requestId', p_request_id, 'status', v_status);
  if p_action = 'cancel_request' then
    return v_result || jsonb_build_object('cancelledAt', v_now);
  elsif p_action in ('report_no_show','courier_cancel_match') then
    return v_result || jsonb_build_object('cancelledOfferId', v_request.accepted_offer_id, 'expiresAt', v_expires);
  elsif p_action = 'publish_request' then
    return v_result || jsonb_build_object(
      'publishedAt', v_now,
      'expiresAt', v_expires,
      'routeDistanceM', v_distance,
      'fixedPriceArs', v_request.fixed_price_ars,
      'autoAssign', v_request.auto_assign,
      'dropsCount', v_drops_count
    );
  end if;
  return v_result || jsonb_build_object('publishedAt', v_now, 'expiresAt', v_expires);
end;
$$;

revoke all on function app_private.request_cycle(text,uuid,text,boolean,text,text) from public, anon, authenticated;

-- 11. RPC mark_drop_delivered y mark_drop_failed
create or replace function public.mark_drop_delivered(
  p_drop_id uuid
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
  v_req_id uuid;
  v_request public.delivery_requests%rowtype;
  v_drop public.delivery_request_drops%rowtype;
  v_offer public.offers%rowtype;
  v_now timestamptz := now();
  v_has_pending boolean;
  v_req_status public.delivery_request_status;
begin
  -- 1. Actor y rol
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 2. Elegibilidad del repartidor
  select status into v_courier_status
  from public.couriers
  where profile_id = v_actor_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;
  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;

  -- 3. Parámetros
  if p_drop_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- 4. Locks: primero solicitud, luego drop
  select request_id into v_req_id
  from public.delivery_request_drops
  where id = p_drop_id;

  if not found or v_req_id is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_request
  from public.delivery_requests
  where id = v_req_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_drop
  from public.delivery_request_drops
  where id = p_drop_id
  for update;

  -- 5. Pertenencia a la oferta accepted
  select * into v_offer
  from public.offers
  where id = v_request.accepted_offer_id;

  if not found or v_offer.courier_id is distinct from v_actor_id or v_offer.status is distinct from 'accepted' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 6. Idempotencia
  if v_drop.status = 'delivered' then
    return jsonb_build_object(
      'dropId', p_drop_id,
      'requestId', v_req_id,
      'status', 'delivered',
      'deliveredAt', to_char(v_drop.delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'requestStatus', v_request.status,
      'idempotent', true
    );
  end if;

  -- 7. Estado
  if v_drop.status = 'failed' or v_request.status <> 'in_transit' or v_drop.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- 8. Mutación
  update public.delivery_request_drops
  set status = 'delivered', delivered_at = v_now
  where id = p_drop_id;

  select exists (
    select 1 from public.delivery_request_drops
    where request_id = v_req_id and status = 'pending'
  ) into v_has_pending;

  if not v_has_pending then
    update public.delivery_requests
    set status = 'delivered', delivered_at = v_now
    where id = v_req_id;
    v_req_status := 'delivered';
  else
    v_req_status := v_request.status;
  end if;

  return jsonb_build_object(
    'dropId', p_drop_id,
    'requestId', v_req_id,
    'status', 'delivered',
    'deliveredAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'requestStatus', v_req_status,
    'idempotent', false
  );
end;
$$;

revoke all on function public.mark_drop_delivered(uuid) from public, anon, authenticated;
grant execute on function public.mark_drop_delivered(uuid) to authenticated;

create or replace function public.mark_drop_failed(
  p_drop_id uuid,
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
  v_consent_status public.consent_status;
  v_courier_status public.courier_status;
  v_req_id uuid;
  v_request public.delivery_requests%rowtype;
  v_drop public.delivery_request_drops%rowtype;
  v_offer public.offers%rowtype;
  v_now timestamptz := now();
  v_has_pending boolean;
  v_req_status public.delivery_request_status;
  v_clean_reason text;
begin
  -- 1. Actor y rol
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 2. Elegibilidad del repartidor
  select status into v_courier_status
  from public.couriers
  where profile_id = v_actor_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_courier_status = 'suspended' then
    raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
  end if;
  if v_courier_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;

  -- 3. Parámetros
  if p_drop_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_clean_reason := btrim(p_reason);
  if v_clean_reason is null or length(v_clean_reason) = 0 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  if length(v_clean_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- 4. Locks: primero solicitud, luego drop
  select request_id into v_req_id
  from public.delivery_request_drops
  where id = p_drop_id;

  if not found or v_req_id is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_request
  from public.delivery_requests
  where id = v_req_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_drop
  from public.delivery_request_drops
  where id = p_drop_id
  for update;

  -- 5. Pertenencia a la oferta accepted
  select * into v_offer
  from public.offers
  where id = v_request.accepted_offer_id;

  if not found or v_offer.courier_id is distinct from v_actor_id or v_offer.status is distinct from 'accepted' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 6. Idempotencia
  if v_drop.status = 'failed' then
    return jsonb_build_object(
      'dropId', p_drop_id,
      'requestId', v_req_id,
      'status', 'failed',
      'failedReason', v_drop.failed_reason,
      'requestStatus', v_request.status,
      'idempotent', true
    );
  end if;

  -- 7. Estado
  if v_drop.status = 'delivered' or v_request.status <> 'in_transit' or v_drop.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- 8. Mutación
  update public.delivery_request_drops
  set status = 'failed', failed_reason = v_clean_reason
  where id = p_drop_id;

  select exists (
    select 1 from public.delivery_request_drops
    where request_id = v_req_id and status = 'pending'
  ) into v_has_pending;

  -- CC-022 §6: solicitud cierra en delivered aunque todas hayan quedado failed
  if not v_has_pending then
    update public.delivery_requests
    set status = 'delivered', delivered_at = v_now
    where id = v_req_id;
    v_req_status := 'delivered';
  else
    v_req_status := v_request.status;
  end if;

  return jsonb_build_object(
    'dropId', p_drop_id,
    'requestId', v_req_id,
    'status', 'failed',
    'failedReason', v_clean_reason,
    'requestStatus', v_req_status,
    'idempotent', false
  );
end;
$$;

revoke all on function public.mark_drop_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_drop_failed(uuid, text) to authenticated;

-- 12. Actualización de submit_offer, take_request y accept_offer con totalAmountArs
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
  if v_actor_id is null then raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_actor_id;
  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  select status, available into v_courier_status, v_courier_available from public.couriers where profile_id = v_actor_id;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
  if v_courier_status = 'suspended' then raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED'; end if;
  if v_courier_status <> 'approved' then raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED'; end if;
  if not v_courier_available then raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE'; end if;

  if p_request_id is null or p_amount_ars is null or p_eta_minutes is null
     or p_amount_ars < 1 or p_eta_minutes < 1
     or (p_message is not null and length(btrim(p_message)) > 500)
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  v_clean_message := nullif(btrim(p_message), '');

  select (value #>> '{}')::integer into v_min_offer_ars from public.platform_settings where key = 'min_offer_ars';
  if v_min_offer_ars is null or v_min_offer_ars < 1 then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;
  if p_amount_ars < v_min_offer_ars then raise exception using errcode = 'P0001', message = 'OFFER_BELOW_MINIMUM'; end if;

  select * into v_req from public.delivery_requests where id = p_request_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;

  if v_req.status = 'expired' or (v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= now()) then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;
  if v_req.status <> 'published' then raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION'; end if;
  if v_req.fixed_price_ars is not null then raise exception using errcode = 'P0001', message = 'FIXED_PRICE_REQUEST'; end if;

  if exists (select 1 from public.offers where request_id = p_request_id and courier_id = v_actor_id and status in ('pending', 'accepted')) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_ACTIVE_OFFER';
  end if;

  select status, available into v_courier_status, v_courier_available from public.couriers where profile_id = v_actor_id for share;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
  if v_courier_status = 'suspended' then raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED'; end if;
  if v_courier_status <> 'approved' then raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED'; end if;
  if not v_courier_available then raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE'; end if;

  select (value #>> '{}')::integer into v_max_offers_per_min from public.platform_settings where key = 'max_offers_per_min';
  if v_max_offers_per_min is null or v_max_offers_per_min < 1 then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;

  insert into public.rate_limits (subject, action, window_start, count)
  values (v_actor_id::text, 'submit_offer', date_trunc('minute', now()), 1)
  on conflict (subject, action, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_rate_count;
  if v_rate_count > v_max_offers_per_min then raise exception using errcode = 'P0001', message = 'RATE_LIMITED'; end if;

  insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, message, status)
  values (p_request_id, v_actor_id, p_amount_ars, p_eta_minutes, v_clean_message, 'pending')
  returning * into v_offer;

  return jsonb_build_object(
    'offerId', v_offer.id,
    'requestId', v_offer.request_id,
    'status', v_offer.status,
    'amountArs', v_offer.amount_ars,
    'totalAmountArs', v_offer.amount_ars * v_req.drops_count,
    'createdAt', to_char(v_offer.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.submit_offer(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.submit_offer(uuid, integer, integer, text) to authenticated;

create or replace function public.take_request(
  p_request_id uuid,
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
  v_clean_message text;
  v_req public.delivery_requests%rowtype;
  v_accepted_offer public.offers%rowtype;
  v_pending_offer public.offers%rowtype;
  v_min_offer_ars integer;
  v_max_offers_per_min integer;
  v_rate_count integer;
  v_offer public.offers%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor_id is null then raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_actor_id;
  if v_role is null or v_role <> 'courier' or v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  select status, available into v_courier_status, v_courier_available from public.couriers where profile_id = v_actor_id;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
  if v_courier_status = 'suspended' then raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED'; end if;
  if v_courier_status <> 'approved' then raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED'; end if;
  if not v_courier_available then raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE'; end if;

  if p_request_id is null or p_eta_minutes is null or p_eta_minutes < 1 or (p_message is not null and length(btrim(p_message)) > 500) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  v_clean_message := nullif(btrim(p_message), '');

  select * into v_req from public.delivery_requests where id = p_request_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;

  if v_req.fixed_price_ars is not null then
    if v_req.status = 'matched' then
      select * into v_accepted_offer from public.offers where id = v_req.accepted_offer_id and courier_id = v_actor_id;
      if found then
        return jsonb_build_object(
          'offerId', v_accepted_offer.id,
          'requestId', v_req.id,
          'amountArs', v_req.fixed_price_ars,
          'totalAmountArs', v_req.fixed_price_ars * v_req.drops_count,
          'offerStatus', 'accepted',
          'requestStatus', 'matched',
          'matchedAt', to_char(v_req.matched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'idempotent', true
        );
      end if;
    elsif v_req.status = 'published' then
      select * into v_pending_offer from public.offers where request_id = p_request_id and courier_id = v_actor_id and status = 'pending';
      if found then
        return jsonb_build_object(
          'offerId', v_pending_offer.id,
          'requestId', v_req.id,
          'amountArs', v_req.fixed_price_ars,
          'totalAmountArs', v_req.fixed_price_ars * v_req.drops_count,
          'offerStatus', 'pending',
          'requestStatus', 'published',
          'matchedAt', null,
          'idempotent', true
        );
      end if;
    end if;
  else
    if (v_req.status = 'matched' and exists (select 1 from public.offers where id = v_req.accepted_offer_id and courier_id = v_actor_id))
       or (v_req.status = 'published' and exists (select 1 from public.offers where request_id = p_request_id and courier_id = v_actor_id and status = 'pending'))
    then
      raise exception using errcode = 'P0001', message = 'NO_FIXED_PRICE';
    end if;
  end if;

  if v_req.status = 'matched' then raise exception using errcode = 'P0001', message = 'ALREADY_MATCHED'; end if;
  if v_req.status = 'expired' or (v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= v_now) then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;
  if v_req.status <> 'published' then raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION'; end if;
  if v_req.fixed_price_ars is null then raise exception using errcode = 'P0001', message = 'NO_FIXED_PRICE'; end if;

  select (value #>> '{}')::integer into v_min_offer_ars from public.platform_settings where key = 'min_offer_ars';
  if v_min_offer_ars is null or v_min_offer_ars < 1 then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;
  if v_req.fixed_price_ars < v_min_offer_ars then raise exception using errcode = 'P0001', message = 'OFFER_BELOW_MINIMUM'; end if;

  if exists (select 1 from public.offers where request_id = p_request_id and courier_id = v_actor_id and status in ('pending', 'accepted')) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_ACTIVE_OFFER';
  end if;

  select status, available into v_courier_status, v_courier_available from public.couriers where profile_id = v_actor_id for share;
  if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
  if v_courier_status = 'suspended' then raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED'; end if;
  if v_courier_status <> 'approved' then raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED'; end if;
  if not v_courier_available then raise exception using errcode = 'P0001', message = 'COURIER_UNAVAILABLE'; end if;

  select (value #>> '{}')::integer into v_max_offers_per_min from public.platform_settings where key = 'max_offers_per_min';
  if v_max_offers_per_min is null or v_max_offers_per_min < 1 then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;

  insert into public.rate_limits (subject, action, window_start, count)
  values (v_actor_id::text, 'submit_offer', date_trunc('minute', v_now), 1)
  on conflict (subject, action, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_rate_count;
  if v_rate_count > v_max_offers_per_min then raise exception using errcode = 'P0001', message = 'RATE_LIMITED'; end if;

  insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, message, status)
  values (p_request_id, v_actor_id, v_req.fixed_price_ars, p_eta_minutes, v_clean_message, 'pending')
  returning * into v_offer;

  if v_req.auto_assign then
    perform app_private.match_offer(p_request_id, v_offer.id);
    select matched_at into v_now from public.delivery_requests where id = p_request_id;
    return jsonb_build_object(
      'offerId', v_offer.id,
      'requestId', p_request_id,
      'amountArs', v_req.fixed_price_ars,
      'totalAmountArs', v_req.fixed_price_ars * v_req.drops_count,
      'offerStatus', 'accepted',
      'requestStatus', 'matched',
      'matchedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotent', false
    );
  end if;

  return jsonb_build_object(
    'offerId', v_offer.id,
    'requestId', p_request_id,
    'amountArs', v_req.fixed_price_ars,
    'totalAmountArs', v_req.fixed_price_ars * v_req.drops_count,
    'offerStatus', 'pending',
    'requestStatus', 'published',
    'matchedAt', null,
    'idempotent', false
  );
end;
$$;

revoke all on function public.take_request(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.take_request(uuid, integer, text) to authenticated;

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
  if v_role is null or (v_role <> 'merchant' and v_role <> 'admin') then
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

  if v_role <> 'admin' and v_req.merchant_id <> v_actor_id then
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

-- 13. Backfill idempotente (CC-022 §5b, §10, H07 y H09)
create or replace function app_private.t340_backfill_legacy()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 1. Materializamos drops SOLO para solicitudes con datos legacy reales y consistentes.
  -- Los borradores incompletos permanecen sin drops y son validados por publish_request.
  insert into public.delivery_request_drops (
    id,
    request_id,
    position,
    dropoff_zone_id,
    package_type,
    recipient_payment_method,
    needs_change,
    approx_distance_m,
    status,
    delivered_at,
    failed_reason
  )
  select
    gen_random_uuid(),
    r.id,
    1,
    r.dropoff_zone_id,
    r.package_type,
    r.recipient_payment_method,
    case when r.recipient_payment_method = 'cash' then r.needs_change else false end,
    r.approx_distance_m,
    case when r.status = 'delivered' then 'delivered' else 'pending' end,
    case when r.status = 'delivered' then coalesce(r.delivered_at, r.updated_at, r.created_at) else null end,
    null
  from public.delivery_requests r
  join public.delivery_request_contacts c on c.request_id = r.id
  join public.zones z on z.id = r.dropoff_zone_id
  where not exists (
    select 1 from public.delivery_request_drops d where d.request_id = r.id
  )
    and r.dropoff_zone_id is not null
    and r.package_type is not null
    and r.recipient_payment_method is not null
    and c.dropoff_address is not null and btrim(c.dropoff_address) <> ''
    and c.recipient_name is not null and btrim(c.recipient_name) <> ''
    and c.recipient_phone is not null and btrim(c.recipient_phone) <> ''
    and c.recipient_consent_declared is true
    and (r.recipient_payment_method = 'cash' or r.needs_change = false)
    and (
      r.recipient_payment_method <> 'cash'
      or not r.needs_change
      or (r.cash_change_amount is not null and r.cash_change_amount > 0)
    );

  -- 2. Contactos privados por entrega correspondientes al drop creado, preservando notes y cash_change_amount
  insert into public.delivery_request_drop_contacts (
    drop_id,
    dropoff_address,
    dropoff_lat,
    dropoff_lng,
    recipient_name,
    recipient_phone,
    recipient_consent_declared,
    cash_change_amount,
    notes
  )
  select
    d.id,
    c.dropoff_address,
    c.dropoff_lat,
    c.dropoff_lng,
    c.recipient_name,
    c.recipient_phone,
    c.recipient_consent_declared,
    case when d.recipient_payment_method = 'cash' and d.needs_change then r.cash_change_amount else null end,
    r.notes
  from public.delivery_request_drops d
  join public.delivery_requests r on r.id = d.request_id
  join public.delivery_request_contacts c on c.request_id = r.id
  where d.position = 1
    and not exists (
      select 1 from public.delivery_request_drop_contacts dc where dc.drop_id = d.id
    );

  -- 3. drops_count se actualiza en base a las entregas materializadas
  update public.delivery_requests r
  set drops_count = (
    select count(*)::smallint
    from public.delivery_request_drops d
    where d.request_id = r.id
  )
  where exists (
    select 1 from public.delivery_request_drops d where d.request_id = r.id
  );

  -- 4. Auditar solicitudes históricas no-draft que continúan sin drops (H09)
  -- Detecta todas las condiciones que impidieron crear drop (campos incompletos, consentimiento false/null,
  -- medio transfer/to_agree con needs_change=true, o cash con needs_change=true y monto null) sin duplicar auditorias.
  insert into public.audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    before,
    after
  )
  select
    r.merchant_id,
    'legacy_migration_inconsistent',
    'delivery_request',
    r.id::text,
    jsonb_build_object(
      'status', r.status,
      'dropoff_zone_id', r.dropoff_zone_id,
      'package_type', r.package_type,
      'recipient_payment_method', r.recipient_payment_method,
      'needs_change', r.needs_change,
      'cash_change_amount', r.cash_change_amount,
      'has_contact', (c.request_id is not null),
      'consent', c.recipient_consent_declared
    ),
    jsonb_build_object('preserved', true, 'drops_created', 0)
  from public.delivery_requests r
  left join public.delivery_request_contacts c on c.request_id = r.id
  where r.status <> 'draft'
    and not exists (
      select 1 from public.delivery_request_drops d where d.request_id = r.id
    )
    and not exists (
      select 1
      from public.audit_log a
      where a.action = 'legacy_migration_inconsistent' and a.target_id = r.id::text
    );
end;
$$;

revoke all on function app_private.t340_backfill_legacy() from public, anon, authenticated;

-- Ejecución productiva del backfill durante la migración
select app_private.t340_backfill_legacy();

