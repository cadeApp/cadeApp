-- CC-004: defaults authorized by Lautaro073; preserve existing configuration.
insert into public.platform_settings (key, value) values
  ('max_request_publications_per_min', '10'::jsonb),
  ('max_incidents_per_min', '5'::jsonb)
on conflict (key) do nothing;
