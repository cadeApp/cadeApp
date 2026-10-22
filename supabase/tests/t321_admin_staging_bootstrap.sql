begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

-- 1-2: min_offer_ars
select is(
  (select value from public.platform_settings where key = 'min_offer_ars'),
  '1000'::jsonb,
  'T-321: min_offer_ars default is 1000'
);
select is(
  (select jsonb_typeof(value) from public.platform_settings where key = 'min_offer_ars'),
  'number',
  'T-321: min_offer_ars type is number'
);

-- 3-4: request_ttl_minutes
select is(
  (select value from public.platform_settings where key = 'request_ttl_minutes'),
  '30'::jsonb,
  'T-321: request_ttl_minutes default is 30'
);
select is(
  (select jsonb_typeof(value) from public.platform_settings where key = 'request_ttl_minutes'),
  'number',
  'T-321: request_ttl_minutes type is number'
);

-- 5-6: pilot_active
select is(
  (select value from public.platform_settings where key = 'pilot_active'),
  'true'::jsonb,
  'T-321: pilot_active default is true'
);
select is(
  (select jsonb_typeof(value) from public.platform_settings where key = 'pilot_active'),
  'boolean',
  'T-321: pilot_active type is boolean'
);

-- 7-8: pilot_terms_version
select is(
  (select value from public.platform_settings where key = 'pilot_terms_version'),
  '"v1"'::jsonb,
  'T-321: pilot_terms_version default is "v1"'
);
select is(
  (select jsonb_typeof(value) from public.platform_settings where key = 'pilot_terms_version'),
  'string',
  'T-321: pilot_terms_version type is string'
);

-- 9-10: subscription_grace_days
select is(
  (select value from public.platform_settings where key = 'subscription_grace_days'),
  '0'::jsonb,
  'T-321: subscription_grace_days default is 0'
);
select is(
  (select jsonb_typeof(value) from public.platform_settings where key = 'subscription_grace_days'),
  'number',
  'T-321: subscription_grace_days type is number'
);

select * from finish();
rollback;
