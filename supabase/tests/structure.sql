begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(41);

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

select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'authenticated cannot execute security definer trigger function handle_new_user'
);

select ok(
  not has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  'anon cannot execute security definer trigger function handle_new_user'
);

create function pg_temp.test_actor_delete_sets_null()
returns boolean
language plpgsql
as $$
declare
  admin_id uuid := '00000000-0000-0000-0000-000000000106';
  courier_id uuid := '00000000-0000-0000-0000-000000000102';
  audit_id bigint;
  courier_decided_by uuid;
  audit_actor_id uuid;
begin
  perform pg_temp.signup_role(admin_id, 'merchant');
  update public.profiles set role = 'admin' where id = admin_id;

  update public.couriers
  set decided_by = admin_id, decided_at = now()
  where profile_id = courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (admin_id, 'approve_courier', 'courier', courier_id::text)
  returning id into audit_id;

  delete from auth.users where id = admin_id;

  select decided_by into courier_decided_by
  from public.couriers where profile_id = courier_id;

  select actor_id into audit_actor_id
  from public.audit_log where id = audit_id;

  return exists (select 1 from public.couriers where profile_id = courier_id)
    and courier_decided_by is null
    and exists (select 1 from public.audit_log where id = audit_id)
    and audit_actor_id is null;
end;
$$;

select ok(
  pg_temp.test_actor_delete_sets_null(),
  'deleting an actor account preserves couriers and audit_log rows with null references'
);

create function pg_temp.test_updated_at_and_composite_offer_fk()
returns text
language plpgsql
as $$
declare
  zone_id uuid;
  merchant_id uuid := '00000000-0000-0000-0000-000000000101';
  courier_id uuid := '00000000-0000-0000-0000-000000000102';
  req_a uuid := '00000000-0000-0000-0000-000000000201';
  req_b uuid := '00000000-0000-0000-0000-000000000202';
  offer_a uuid := '00000000-0000-0000-0000-000000000301';
  incident_a uuid := '00000000-0000-0000-0000-000000000401';
  old_ts timestamptz := '2020-01-01T00:00:00Z'::timestamptz;
  req_ts timestamptz;
  offer_ts timestamptz;
  incident_ts timestamptz;
  cross_fk_result text := 'DID_NOT_FAIL';
begin
  select id into zone_id from public.zones where active limit 1;

  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, updated_at
  ) values
    (req_a, merchant_id, zone_id, zone_id, 'chico', 'cash', old_ts),
    (req_b, merchant_id, zone_id, zone_id, 'chico', 'cash', old_ts);

  insert into public.offers (
    id, request_id, courier_id, amount_ars, eta_minutes, updated_at
  ) values (
    offer_a, req_a, courier_id, 1500, 15, old_ts
  );

  insert into public.incidents (
    id, request_id, reporter_id, kind, description, updated_at
  ) values (
    incident_a, req_a, merchant_id, 'delay', 'initial report', old_ts
  );

  update public.delivery_requests set notes = 'updated' where id = req_a returning updated_at into req_ts;
  update public.offers set message = 'updated' where id = offer_a returning updated_at into offer_ts;
  update public.incidents set description = 'updated' where id = incident_a returning updated_at into incident_ts;

  if not (req_ts > old_ts and offer_ts > old_ts and incident_ts > old_ts) then
    return 'UPDATED_AT_NOT_REFRESHED';
  end if;

  begin
    update public.delivery_requests set accepted_offer_id = offer_a where id = req_b;
  exception when foreign_key_violation then
    cross_fk_result := 'REJECTED_CROSS_OFFER';
  end;

  if cross_fk_result <> 'REJECTED_CROSS_OFFER' then
    return cross_fk_result;
  end if;

  update public.delivery_requests set accepted_offer_id = offer_a where id = req_a;

  return 'OK';
end;
$$;

select is(
  pg_temp.test_updated_at_and_composite_offer_fk(),
  'OK',
  'set_updated_at triggers refresh updated_at and composite FK ties accepted_offer_id to the same request'
);

select * from finish();
rollback;
