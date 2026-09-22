-- T-005: RLS v1, actor access policies and secure courier-docs storage

-- 1. Remove initial default_deny policies from T-004
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

-- 2. Security helper functions to avoid recursion and evaluate roles securely
create or replace function public.is_admin()
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

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_approved_courier()
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

revoke all on function public.is_approved_courier() from public, anon, authenticated;
grant execute on function public.is_approved_courier() to authenticated;

-- 3. Actor RLS policies

-- public.profiles
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin());

create policy profiles_select_counterpart on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.delivery_requests dr
      where (dr.merchant_id = auth.uid() and dr.accepted_offer_id in (select o.id from public.offers o where o.courier_id = profiles.id))
         or (dr.merchant_id = profiles.id and dr.accepted_offer_id in (select o.id from public.offers o where o.courier_id = auth.uid()))
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.zones
create policy zones_select_active on public.zones
  for select to anon, authenticated
  using (active or public.is_admin());

create policy zones_write_admin on public.zones
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.merchants
create policy merchants_select_self on public.merchants
  for select to authenticated
  using (profile_id = auth.uid());

create policy merchants_select_admin on public.merchants
  for select to authenticated
  using (public.is_admin());

create policy merchants_select_courier on public.merchants
  for select to authenticated
  using (public.is_approved_courier());

create policy merchants_update_self on public.merchants
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy merchants_update_admin on public.merchants
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.couriers
create policy couriers_select_self on public.couriers
  for select to authenticated
  using (profile_id = auth.uid());

create policy couriers_select_admin on public.couriers
  for select to authenticated
  using (public.is_admin());

create policy couriers_select_merchant on public.couriers
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_requests dr
      join public.offers o on o.id = dr.accepted_offer_id
      where dr.merchant_id = auth.uid() and o.courier_id = couriers.profile_id
    )
  );

create policy couriers_update_self on public.couriers
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and status = (select c.status from public.couriers c where c.profile_id = auth.uid())
    and dni_hmac is not distinct from (select c.dni_hmac from public.couriers c where c.profile_id = auth.uid())
  );

create policy couriers_update_admin on public.couriers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.courier_documents
create policy courier_documents_select_self on public.courier_documents
  for select to authenticated
  using (courier_id = auth.uid());

create policy courier_documents_select_admin on public.courier_documents
  for select to authenticated
  using (public.is_admin());

create policy courier_documents_insert_self on public.courier_documents
  for insert to authenticated
  with check (courier_id = auth.uid());

create policy courier_documents_write_admin on public.courier_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.delivery_requests
create policy delivery_requests_select_merchant on public.delivery_requests
  for select to authenticated
  using (merchant_id = auth.uid());

create policy delivery_requests_select_courier on public.delivery_requests
  for select to authenticated
  using (
    public.is_approved_courier()
    and (
      (status = 'published' and (expires_at is null or expires_at > now()))
      or (accepted_offer_id in (select o.id from public.offers o where o.courier_id = auth.uid()))
    )
  );

create policy delivery_requests_select_admin on public.delivery_requests
  for select to authenticated
  using (public.is_admin());

create policy delivery_requests_insert_merchant on public.delivery_requests
  for insert to authenticated
  with check (merchant_id = auth.uid());

create policy delivery_requests_update_merchant on public.delivery_requests
  for update to authenticated
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());

create policy delivery_requests_update_admin on public.delivery_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.delivery_request_contacts (D3, D15: strict contact disclosure)
create policy contacts_select_merchant on public.delivery_request_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_requests dr
      where dr.id = delivery_request_contacts.request_id
        and dr.merchant_id = auth.uid()
    )
  );

create policy contacts_select_accepted_courier on public.delivery_request_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_requests dr
      join public.offers o on o.id = dr.accepted_offer_id
      where dr.id = delivery_request_contacts.request_id
        and o.courier_id = auth.uid()
        and o.status = 'accepted'
    )
  );

create policy contacts_select_admin on public.delivery_request_contacts
  for select to authenticated
  using (public.is_admin());

create policy contacts_insert_merchant on public.delivery_request_contacts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.delivery_requests dr
      where dr.id = delivery_request_contacts.request_id
        and dr.merchant_id = auth.uid()
    )
  );

create policy contacts_update_merchant on public.delivery_request_contacts
  for update to authenticated
  using (
    exists (
      select 1 from public.delivery_requests dr
      where dr.id = delivery_request_contacts.request_id
        and dr.merchant_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.delivery_requests dr
      where dr.id = delivery_request_contacts.request_id
        and dr.merchant_id = auth.uid()
    )
  );

create policy contacts_write_admin on public.delivery_request_contacts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.offers
create policy offers_select_merchant on public.offers
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_requests dr
      where dr.id = offers.request_id
        and dr.merchant_id = auth.uid()
    )
  );

create policy offers_select_courier on public.offers
  for select to authenticated
  using (courier_id = auth.uid());

create policy offers_select_admin on public.offers
  for select to authenticated
  using (public.is_admin());

create policy offers_insert_courier on public.offers
  for insert to authenticated
  with check (
    courier_id = auth.uid()
    and public.is_approved_courier()
    and exists (
      select 1 from public.delivery_requests dr
      where dr.id = offers.request_id
        and dr.status = 'published'
        and (dr.expires_at is null or dr.expires_at > now())
    )
  );

create policy offers_update_courier on public.offers
  for update to authenticated
  using (courier_id = auth.uid())
  with check (courier_id = auth.uid());

create policy offers_update_merchant on public.offers
  for update to authenticated
  using (
    exists (
      select 1 from public.delivery_requests dr
      where dr.id = offers.request_id
        and dr.merchant_id = auth.uid()
    )
  );

create policy offers_update_admin on public.offers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.incidents
create policy incidents_select_reporter on public.incidents
  for select to authenticated
  using (reporter_id = auth.uid());

create policy incidents_select_participants on public.incidents
  for select to authenticated
  using (
    exists (
      select 1 from public.delivery_requests dr
      where dr.id = incidents.request_id
        and (
          dr.merchant_id = auth.uid()
          or dr.accepted_offer_id in (select o.id from public.offers o where o.courier_id = auth.uid())
        )
    )
  );

create policy incidents_select_admin on public.incidents
  for select to authenticated
  using (public.is_admin());

create policy incidents_insert_authenticated on public.incidents
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy incidents_write_admin on public.incidents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.push_subscriptions
create policy push_subscriptions_all_self on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_subscriptions_admin on public.push_subscriptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.consents
create policy consents_select_self on public.consents
  for select to authenticated
  using (profile_id = auth.uid());

create policy consents_insert_self on public.consents
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy consents_admin on public.consents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.audit_log
create policy audit_log_admin on public.audit_log
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.platform_settings
create policy platform_settings_select_authenticated on public.platform_settings
  for select to authenticated
  using (true);

create policy platform_settings_write_admin on public.platform_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- public.rate_limits (managed exclusively via security definer RPCs; client direct select denied)
create policy rate_limits_admin on public.rate_limits
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Storage courier-docs: bucket and policies
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

create policy courier_docs_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'courier-docs'
    and (storage.foldername(name))[1] = 'courier'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy courier_docs_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'courier-docs' and public.is_admin())
  with check (bucket_id = 'courier-docs' and public.is_admin());
