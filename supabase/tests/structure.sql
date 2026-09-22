begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(37);

select ok(
  to_regclass(format('public.%I', table_name)) is not null,
  format('public.%s exists', table_name)
)
from (values
  ('profiles'),
  ('merchants'),
  ('couriers'),
  ('courier_documents'),
  ('zones'),
  ('delivery_requests'),
  ('delivery_request_contacts'),
  ('offers'),
  ('incidents'),
  ('push_subscriptions'),
  ('consents'),
  ('audit_log'),
  ('platform_settings'),
  ('rate_limits')
) as expected(table_name);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'delivery_requests'
      and column_name in (
        'recipient_name', 'recipient_phone', 'pickup_address', 'dropoff_address',
        'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng'
      )
  ),
  'delivery_requests exposes no private contact or exact location fields'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'delivery_request_contacts'
      and column_name = contact_column
  ),
  format('delivery_request_contacts has %s', contact_column)
)
from (values
  ('pickup_address'),
  ('dropoff_address'),
  ('recipient_name'),
  ('recipient_phone')
) as expected(contact_column);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offers'
      and column_name = 'amount_ars'
      and data_type = 'integer'
  ),
  'offer amounts are integer ARS'
);

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class index_class on index_class.oid = i.indexrelid
    where i.indrelid = to_regclass('public.offers')
      and index_class.relname = 'offers_one_accepted_per_request_idx'
      and i.indisunique
      and i.indpred is not null
      and pg_get_indexdef(i.indexrelid) like '%(request_id)%'
      and pg_get_expr(i.indpred, i.indrelid) like '%accepted%'
  ),
  'one accepted offer per request has a partial unique index'
);

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class index_class on index_class.oid = i.indexrelid
    where i.indrelid = to_regclass('public.offers')
      and index_class.relname = 'offers_one_active_per_courier_request_idx'
      and i.indisunique
      and i.indpred is not null
      and pg_get_indexdef(i.indexrelid) like '%(request_id, courier_id)%'
      and pg_get_expr(i.indpred, i.indrelid) like '%pending%'
      and pg_get_expr(i.indpred, i.indrelid) like '%accepted%'
  ),
  'one active offer per courier and request has a partial unique index'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.offers')
      and conname = 'offers_amount_ars_positive'
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%amount_ars >= 1%'
  ),
  'offer amount has a positive check'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.offers')
      and conname = 'offers_eta_minutes_positive'
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%eta_minutes > 0%'
  ),
  'offer ETA has a positive check'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.couriers')
      and conname = 'couriers_doc_level_range'
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%doc_level%'
  ),
  'courier document level has a range check'
);

create function pg_temp.signup_role(test_id uuid, requested_role text)
returns text
language plpgsql
as $$
declare
  actual_role text;
  error_message text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data
  ) values (
    test_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    coalesce(requested_role, 'missing') || '-' || test_id || '@example.test',
    'not-a-real-password',
    jsonb_build_object('role', requested_role)
  );
  execute 'select role::text from public.profiles where id = $1'
    into actual_role using test_id;
  return coalesce(actual_role, 'NO_PROFILE');
exception when others then
  get stacked diagnostics error_message = message_text;
  return 'ERROR:' || sqlstate || ':' || error_message;
end;
$$;

create function pg_temp.profile_count(test_id uuid)
returns bigint
language plpgsql
as $$
declare
  result bigint;
begin
  execute 'select count(*) from public.profiles where id = $1'
    into result using test_id;
  return result;
exception when undefined_table then
  return 0;
end;
$$;

select is(
  pg_temp.signup_role('00000000-0000-0000-0000-000000000101', 'merchant'),
  'merchant',
  'merchant signup creates a merchant profile'
);

select is(
  pg_temp.signup_role('00000000-0000-0000-0000-000000000102', 'courier'),
  'courier',
  'courier signup creates a courier profile'
);

select is(
  pg_temp.signup_role('00000000-0000-0000-0000-000000000103', 'admin'),
  'ERROR:P0001:INVALID_SIGNUP_ROLE',
  'admin signup is rejected by the profile trigger'
);

select is(
  pg_temp.signup_role('00000000-0000-0000-0000-000000000104', 'visitor'),
  'ERROR:P0001:INVALID_SIGNUP_ROLE',
  'unknown signup role is rejected'
);

select is(
  pg_temp.signup_role('00000000-0000-0000-0000-000000000105', null),
  'ERROR:P0001:INVALID_SIGNUP_ROLE',
  'missing signup role is rejected'
);

select is(
  pg_temp.profile_count('00000000-0000-0000-0000-000000000103'),
  0::bigint,
  'admin registration creates no profile'
);

create function pg_temp.setting_value(setting_key text)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  execute 'select value from public.platform_settings where key = $1'
    into result using setting_key;
  return result;
exception when undefined_table then
  return null;
end;
$$;

select is(pg_temp.setting_value('min_offer_ars'), '1000'::jsonb, 'offer floor is seeded');
select is(pg_temp.setting_value('request_ttl_minutes'), '30'::jsonb, 'request TTL is seeded');
select is(pg_temp.setting_value('pilot_active'), 'true'::jsonb, 'pilot status is seeded');
select ok(pg_temp.setting_value('pilot_terms_version') is not null, 'pilot terms version is seeded');
select is(pg_temp.setting_value('subscription_grace_days'), '0'::jsonb, 'grace days are seeded');

create function pg_temp.active_zone_count()
returns bigint
language plpgsql
as $$
declare
  result bigint;
begin
  execute 'select count(*) from public.zones where active'
    into result;
  return result;
exception when undefined_table then
  return 0;
end;
$$;

select ok(pg_temp.active_zone_count() > 0, 'at least one active Aguilares zone is seeded');

select * from finish();
rollback;
