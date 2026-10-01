-- T-321: Operational defaults required by A04. Preserves any existing configuration set by operations.
insert into public.platform_settings (key, value) values
  ('min_offer_ars', '1000'::jsonb),
  ('request_ttl_minutes', '30'::jsonb),
  ('pilot_active', 'true'::jsonb),
  ('pilot_terms_version', '"v1"'::jsonb),
  ('subscription_grace_days', '0'::jsonb)
on conflict (key) do nothing;
