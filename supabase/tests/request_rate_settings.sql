begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(2);
select is((select value from public.platform_settings where key = 'max_request_publications_per_min'),
  '10'::jsonb, 'CC-004: publicaciones y republicaciones tienen límite inicial 10/min');
select is((select value from public.platform_settings where key = 'max_incidents_per_min'),
  '5'::jsonb, 'CC-004: incidentes tienen límite inicial separado 5/min');
select * from finish();
rollback;
