-- T-004: operational defaults. The general Aguilares centroid is the verified
-- locality point (OpenStreetMap node 198437989), not an invented barrio point.
insert into public.zones (name, centroid_lat, centroid_lng, active)
values ('Aguilares', -27.431480, -65.614660, true)
on conflict (name) do update
set centroid_lat = excluded.centroid_lat,
    centroid_lng = excluded.centroid_lng,
    active = excluded.active;

insert into public.platform_settings (key, value)
values
  ('min_offer_ars', '1000'::jsonb),
  ('max_offers_per_min', '10'::jsonb),
  ('request_ttl_minutes', '30'::jsonb),
  ('pilot_active', 'true'::jsonb),
  ('pilot_terms_version', '"v1"'::jsonb),
  ('subscription_grace_days', '0'::jsonb)
on conflict (key) do update set value = excluded.value;
