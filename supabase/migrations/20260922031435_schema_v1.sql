-- T-004: base schema. Access policies for each actor arrive in T-005.

create type public.profile_role as enum ('merchant', 'courier', 'admin');
create type public.merchant_subscription_status as enum ('pilot', 'active', 'expired', 'cancelled');
create type public.courier_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.vehicle_type as enum ('walk', 'bike', 'moto', 'car');
create type public.document_review_status as enum ('none', 'submitted', 'verified', 'rejected');
create type public.courier_document_kind as enum ('dni_front', 'dni_back', 'selfie', 'avatar', 'license', 'insurance');
create type public.delivery_request_status as enum ('draft', 'published', 'matched', 'in_transit', 'delivered', 'cancelled', 'expired');
create type public.recipient_payment_method as enum ('cash', 'transfer', 'to_agree');
create type public.package_type as enum ('sobre', 'chico', 'mediano', 'grande');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'cancelled');
create type public.consent_document as enum ('tos', 'privacy', 'courier_contract', 'pilot_terms');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null,
  display_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  centroid_lat numeric(9, 6),
  centroid_lng numeric(9, 6),
  active boolean not null default false,
  constraint zones_centroid_pair check ((centroid_lat is null) = (centroid_lng is null)),
  constraint zones_centroid_lat_bounds check (centroid_lat is null or centroid_lat between -27.4550 and -27.4100),
  constraint zones_centroid_lng_bounds check (centroid_lng is null or centroid_lng between -65.6400 and -65.5950),
  constraint zones_active_centroid check (not active or centroid_lat is not null)
);

create table public.merchants (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null default '',
  default_pickup_zone_id uuid references public.zones (id),
  default_pickup_address text,
  default_pickup_lat numeric(9, 6),
  default_pickup_lng numeric(9, 6),
  subscription_status public.merchant_subscription_status not null default 'pilot',
  paid_until date,
  notes text,
  constraint merchants_default_pickup_pair check ((default_pickup_lat is null) = (default_pickup_lng is null)),
  constraint merchants_default_pickup_lat_bounds check (default_pickup_lat is null or default_pickup_lat between -27.4550 and -27.4100),
  constraint merchants_default_pickup_lng_bounds check (default_pickup_lng is null or default_pickup_lng between -65.6400 and -65.5950)
);

create table public.couriers (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  status public.courier_status not null default 'pending',
  vehicle_type public.vehicle_type,
  vehicle_plate text,
  license_status public.document_review_status not null default 'none',
  insurance_status public.document_review_status not null default 'none',
  doc_level integer generated always as (
    (case when license_status = 'verified' then 1 else 0 end) +
    (case when insurance_status = 'verified' then 1 else 0 end)
  ) stored,
  available boolean not null default false,
  dni_hmac text unique,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id),
  deactivated_at timestamptz,
  constraint couriers_doc_level_range check (doc_level between 0 and 2),
  constraint couriers_dni_hmac_format check (dni_hmac is null or dni_hmac ~ '^[0-9a-f]{64}$')
);

create table public.courier_documents (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers (profile_id) on delete cascade,
  kind public.courier_document_kind not null,
  storage_path text not null unique,
  status public.document_review_status not null default 'submitted',
  uploaded_at timestamptz not null default now(),
  purge_after timestamptz,
  purged_at timestamptz,
  constraint courier_documents_status_not_none check (status <> 'none'),
  constraint courier_documents_purge_order check (purged_at is null or purge_after is not null)
);

create table public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (profile_id),
  status public.delivery_request_status not null default 'draft',
  pickup_zone_id uuid not null references public.zones (id),
  dropoff_zone_id uuid not null references public.zones (id),
  package_type public.package_type not null,
  notes text,
  recipient_payment_method public.recipient_payment_method not null,
  needs_change boolean not null default false,
  cash_change_amount integer,
  approx_distance_m integer,
  route_distance_m integer,
  expires_at timestamptz,
  accepted_offer_id uuid,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  matched_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  constraint delivery_requests_cash_change_positive check (cash_change_amount is null or cash_change_amount > 0),
  constraint delivery_requests_approx_distance_nonnegative check (approx_distance_m is null or approx_distance_m >= 0),
  constraint delivery_requests_route_distance_nonnegative check (route_distance_m is null or route_distance_m >= 0)
);

create table public.delivery_request_contacts (
  request_id uuid primary key references public.delivery_requests (id) on delete cascade,
  pickup_address text not null,
  pickup_lat numeric(9, 6),
  pickup_lng numeric(9, 6),
  dropoff_address text not null,
  dropoff_lat numeric(9, 6),
  dropoff_lng numeric(9, 6),
  recipient_name text not null,
  recipient_phone text not null,
  recipient_consent_declared boolean not null default false,
  constraint contacts_pickup_pair check ((pickup_lat is null) = (pickup_lng is null)),
  constraint contacts_dropoff_pair check ((dropoff_lat is null) = (dropoff_lng is null)),
  constraint contacts_pickup_lat_bounds check (pickup_lat is null or pickup_lat between -27.4550 and -27.4100),
  constraint contacts_pickup_lng_bounds check (pickup_lng is null or pickup_lng between -65.6400 and -65.5950),
  constraint contacts_dropoff_lat_bounds check (dropoff_lat is null or dropoff_lat between -27.4550 and -27.4100),
  constraint contacts_dropoff_lng_bounds check (dropoff_lng is null or dropoff_lng between -65.6400 and -65.5950)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.delivery_requests (id),
  courier_id uuid not null references public.couriers (profile_id),
  amount_ars integer not null,
  eta_minutes integer not null,
  message text,
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint offers_amount_ars_positive check (amount_ars >= 1),
  constraint offers_eta_minutes_positive check (eta_minutes > 0)
);

alter table public.delivery_requests
  add constraint delivery_requests_accepted_offer_fk
  foreign key (accepted_offer_id) references public.offers (id);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.delivery_requests (id),
  reporter_id uuid not null references public.profiles (id),
  kind text not null,
  description text not null,
  status text not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incidents_status_valid check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.consents (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  document public.consent_document not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (profile_id, document, version)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null
);

create table public.rate_limits (
  subject text not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (subject, action, window_start),
  constraint rate_limits_count_nonnegative check (count >= 0)
);

create unique index offers_one_accepted_per_request_idx
  on public.offers (request_id) where status = 'accepted';
create unique index offers_one_active_per_courier_request_idx
  on public.offers (request_id, courier_id) where status in ('pending', 'accepted');
create index delivery_requests_published_idx
  on public.delivery_requests (created_at desc) where status = 'published';
create index delivery_requests_merchant_idx on public.delivery_requests (merchant_id, created_at desc);
create index offers_courier_idx on public.offers (courier_id, created_at desc);
create index courier_documents_courier_idx on public.courier_documents (courier_id, uploaded_at desc);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index audit_log_target_idx on public.audit_log (target_type, target_id, created_at desc);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
begin
  if requested_role not in ('merchant', 'courier') or requested_role is null then
    raise exception using errcode = 'P0001', message = 'INVALID_SIGNUP_ROLE';
  end if;

  insert into public.profiles (id, role, display_name, phone)
  values (
    new.id,
    requested_role::public.profile_role,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );

  if requested_role = 'merchant' then
    insert into public.merchants (profile_id) values (new.id);
  else
    insert into public.couriers (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- T-005 replaces these deny policies with the actor matrix. Keeping explicit
-- policies now means new public tables cannot be exposed in this migration.
do $$
declare
  table_name text;
begin
  for table_name in
    select unnest(array[
      'profiles', 'merchants', 'couriers', 'courier_documents', 'zones',
      'delivery_requests', 'delivery_request_contacts', 'offers', 'incidents',
      'push_subscriptions', 'consents', 'audit_log', 'platform_settings', 'rate_limits'
    ])
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name || '_default_deny', table_name
    );
  end loop;
end;
$$;
