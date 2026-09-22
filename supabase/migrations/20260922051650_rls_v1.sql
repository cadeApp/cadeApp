-- T-005: RLS v1, actor access policies and secure courier-docs storage

-- 1. Clean up temporary public helper functions if defined
drop function if exists public.is_admin();
drop function if exists public.is_approved_courier();
drop function if exists public.is_request_merchant(uuid, uuid);
drop function if exists public.is_accepted_offer_courier(uuid, uuid);
drop function if exists public.is_courier_assigned_to_request(uuid, uuid);

-- 2. Remove initial default_deny policies from T-004
do $$
declare
  table_name text;
begin
  for table_name in
    select unnest(array[
      'profiles', 'zones', 'merchants', 'couriers', 'courier_documents',
      'delivery_requests', 'delivery_request_contacts', 'offers', 'incidents',
      'push_subscriptions', 'consents', 'audit_log', 'platform_settings', 'rate_limits'
    ])
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_default_deny', table_name);
  end loop;
end;
$$;

-- 3. Private schema for internal security helpers (avoids RLS recursion and public type drift)
create schema if not exists app_private;
grant usage on schema app_private to authenticated, anon;

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
  );
$$;

revoke all on function app_private.is_admin() from public, anon, authenticated;
grant execute on function app_private.is_admin() to authenticated;

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
      and c.status = 'approved'
  );
$$;

revoke all on function app_private.is_approved_courier() from public, anon, authenticated;
grant execute on function app_private.is_approved_courier() to authenticated;

create or replace function app_private.is_request_merchant(req_id uuid, m_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.delivery_requests
    where id = req_id and merchant_id = m_id
  );
$$;

revoke all on function app_private.is_request_merchant(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.is_request_merchant(uuid, uuid) to authenticated;

create or replace function app_private.is_accepted_offer_courier(off_id uuid, c_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.offers
    where id = off_id and courier_id = c_id and status = 'accepted'
  );
$$;

revoke all on function app_private.is_accepted_offer_courier(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.is_accepted_offer_courier(uuid, uuid) to authenticated;

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
    where dr.id = req_id and o.courier_id = c_id and o.status = 'accepted'
  );
$$;

revoke all on function app_private.is_courier_assigned_to_request(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.is_courier_assigned_to_request(uuid, uuid) to authenticated;

create or replace function app_private.is_merchant_visible_to_courier(m_id uuid, c_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.delivery_requests dr
    where dr.merchant_id = m_id
      and (
        (dr.status = 'published' and (dr.expires_at is null or dr.expires_at > now()))
        or (dr.accepted_offer_id is not null and app_private.is_accepted_offer_courier(dr.accepted_offer_id, c_id))
      )
  );
$$;

revoke all on function app_private.is_merchant_visible_to_courier(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.is_merchant_visible_to_courier(uuid, uuid) to authenticated;

create or replace function app_private.is_courier()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'courier'
  );
$$;

revoke all on function app_private.is_courier() from public, anon, authenticated;
grant execute on function app_private.is_courier() to authenticated;

-- 4. Actor RLS policies

-- public.profiles
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated using (app_private.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.zones (H04: split public active read from admin full read to avoid ungranted is_admin() call on anon)
create policy zones_select_public on public.zones
  for select to anon, authenticated
  using (active);

create policy zones_select_admin on public.zones
  for select to authenticated
  using (app_private.is_admin());

create policy zones_write_admin on public.zones
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.merchants
create policy merchants_select_self on public.merchants
  for select to authenticated
  using (profile_id = auth.uid());

create policy merchants_select_admin on public.merchants
  for select to authenticated
  using (app_private.is_admin());

-- H03: Courier approved only sees merchants with an active relationship (published non-expired request or accepted delivery)
create policy merchants_select_courier on public.merchants
  for select to authenticated
  using (
    app_private.is_approved_courier()
    and app_private.is_merchant_visible_to_courier(profile_id, auth.uid())
  );

-- H02: Freeze subscription_status, paid_until and notes against merchant self-tampering
create policy merchants_update_self on public.merchants
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and subscription_status = (select m.subscription_status from public.merchants m where m.profile_id = auth.uid())
    and paid_until is not distinct from (select m.paid_until from public.merchants m where m.profile_id = auth.uid())
    and notes is not distinct from (select m.notes from public.merchants m where m.profile_id = auth.uid())
  );

create policy merchants_update_admin on public.merchants
  for update to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.couriers
create policy couriers_select_self on public.couriers
  for select to authenticated
  using (profile_id = auth.uid());

create policy couriers_select_admin on public.couriers
  for select to authenticated
  using (app_private.is_admin());

-- H01: Freeze status, dni_hmac, license_status, insurance_status, decided_by, decided_at and deactivated_at
create policy couriers_update_self on public.couriers
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and status = (select c.status from public.couriers c where c.profile_id = auth.uid())
    and dni_hmac is not distinct from (select c.dni_hmac from public.couriers c where c.profile_id = auth.uid())
    and license_status = (select c.license_status from public.couriers c where c.profile_id = auth.uid())
    and insurance_status = (select c.insurance_status from public.couriers c where c.profile_id = auth.uid())
    and decided_by is not distinct from (select c.decided_by from public.couriers c where c.profile_id = auth.uid())
    and decided_at is not distinct from (select c.decided_at from public.couriers c where c.profile_id = auth.uid())
    and deactivated_at is not distinct from (select c.deactivated_at from public.couriers c where c.profile_id = auth.uid())
  );

create policy couriers_update_admin on public.couriers
  for update to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.courier_documents
create policy courier_documents_select_self on public.courier_documents
  for select to authenticated
  using (courier_id = auth.uid());

create policy courier_documents_select_admin on public.courier_documents
  for select to authenticated
  using (app_private.is_admin());

create policy courier_documents_insert_self on public.courier_documents
  for insert to authenticated
  with check (courier_id = auth.uid());

create policy courier_documents_write_admin on public.courier_documents
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.delivery_requests
create policy delivery_requests_select_merchant on public.delivery_requests
  for select to authenticated
  using (merchant_id = auth.uid());

create policy delivery_requests_select_courier on public.delivery_requests
  for select to authenticated
  using (
    app_private.is_approved_courier()
    and (
      (status = 'published' and (expires_at is null or expires_at > now()))
      or (accepted_offer_id is not null and app_private.is_accepted_offer_courier(accepted_offer_id, auth.uid()))
    )
  );

create policy delivery_requests_select_admin on public.delivery_requests
  for select to authenticated
  using (app_private.is_admin());

create policy delivery_requests_insert_merchant on public.delivery_requests
  for insert to authenticated
  with check (merchant_id = auth.uid());

create policy delivery_requests_update_merchant on public.delivery_requests
  for update to authenticated
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());

create policy delivery_requests_update_admin on public.delivery_requests
  for update to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.delivery_request_contacts (D3, D15: strict contact disclosure)
create policy contacts_select_merchant on public.delivery_request_contacts
  for select to authenticated
  using (app_private.is_request_merchant(request_id, auth.uid()));

create policy contacts_select_accepted_courier on public.delivery_request_contacts
  for select to authenticated
  using (app_private.is_courier_assigned_to_request(request_id, auth.uid()));

create policy contacts_select_admin on public.delivery_request_contacts
  for select to authenticated
  using (app_private.is_admin());

create policy contacts_insert_merchant on public.delivery_request_contacts
  for insert to authenticated
  with check (app_private.is_request_merchant(request_id, auth.uid()));

create policy contacts_update_merchant on public.delivery_request_contacts
  for update to authenticated
  using (app_private.is_request_merchant(request_id, auth.uid()))
  with check (app_private.is_request_merchant(request_id, auth.uid()));

create policy contacts_write_admin on public.delivery_request_contacts
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.offers
create policy offers_select_merchant on public.offers
  for select to authenticated
  using (app_private.is_request_merchant(request_id, auth.uid()));

create policy offers_select_courier on public.offers
  for select to authenticated
  using (courier_id = auth.uid());

create policy offers_select_admin on public.offers
  for select to authenticated
  using (app_private.is_admin());

create policy offers_insert_courier on public.offers
  for insert to authenticated
  with check (
    courier_id = auth.uid()
    and app_private.is_approved_courier()
  );

create policy offers_update_courier on public.offers
  for update to authenticated
  using (courier_id = auth.uid())
  with check (courier_id = auth.uid());

-- H06: Freeze amount_ars, eta_minutes, message, courier_id and request_id against merchant tampering
create policy offers_update_merchant on public.offers
  for update to authenticated
  using (app_private.is_request_merchant(request_id, auth.uid()))
  with check (
    app_private.is_request_merchant(request_id, auth.uid())
    and courier_id = (select o.courier_id from public.offers o where o.id = offers.id)
    and request_id = (select o.request_id from public.offers o where o.id = offers.id)
    and amount_ars = (select o.amount_ars from public.offers o where o.id = offers.id)
    and eta_minutes = (select o.eta_minutes from public.offers o where o.id = offers.id)
    and message is not distinct from (select o.message from public.offers o where o.id = offers.id)
  );

create policy offers_update_admin on public.offers
  for update to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.incidents
create policy incidents_select_reporter on public.incidents
  for select to authenticated
  using (reporter_id = auth.uid());

create policy incidents_select_admin on public.incidents
  for select to authenticated
  using (app_private.is_admin());

-- H08: Require incident reporter to be request merchant owner, assigned accepted courier, or admin
create policy incidents_insert_authenticated on public.incidents
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and (
      app_private.is_request_merchant(request_id, auth.uid())
      or app_private.is_courier_assigned_to_request(request_id, auth.uid())
      or app_private.is_admin()
    )
  );

create policy incidents_write_admin on public.incidents
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.push_subscriptions
create policy push_subscriptions_all_self on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_subscriptions_admin on public.push_subscriptions
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.consents
create policy consents_select_self on public.consents
  for select to authenticated
  using (profile_id = auth.uid());

create policy consents_insert_self on public.consents
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy consents_admin on public.consents
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.audit_log
create policy audit_log_admin on public.audit_log
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.platform_settings
-- H07: USING (true) is justified because client-side operational flows (such as offer floor calculation,
-- request TTL countdown, pilot terms gate, and subscription grace period checks) require access to
-- system settings without privilege escalation.
create policy platform_settings_select_authenticated on public.platform_settings
  for select to authenticated
  using (true);

create policy platform_settings_write_admin on public.platform_settings
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- public.rate_limits (managed exclusively via security definer RPCs; client direct select denied)
create policy rate_limits_admin on public.rate_limits
  for all to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- 5. Storage courier-docs: bucket and policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'courier-docs',
  'courier-docs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- H09: Restrict courier-docs upload to users having courier role (onboarding before admin approval)
create policy courier_docs_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'courier-docs'
    and app_private.is_courier()
    and (storage.foldername(name))[1] = 'courier'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy courier_docs_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'courier-docs' and app_private.is_admin())
  with check (bucket_id = 'courier-docs' and app_private.is_admin());
