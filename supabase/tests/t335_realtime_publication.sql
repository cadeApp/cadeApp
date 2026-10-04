begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

-- 1: La publicación supabase_realtime existe
select ok(
  exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ),
  'T-335: publicación supabase_realtime existe'
);

-- 2: public.offers está incluida en supabase_realtime
select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'offers'
  ),
  'T-335: public.offers está incluida en supabase_realtime'
);

-- 3: public.delivery_requests está incluida en supabase_realtime
select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_requests'
  ),
  'T-335: public.delivery_requests está incluida en supabase_realtime'
);

-- 4: Conjunto exacto de pertenencia para las tablas requeridas por T-204 / T-307
select set_eq(
  $$
    select schemaname::text, tablename::text
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('offers', 'delivery_requests')
  $$,
  $$
    values
      ('public', 'delivery_requests'),
      ('public', 'offers')
  $$,
  'T-335: public.offers y public.delivery_requests pertenecen a supabase_realtime'
);

select * from finish();
rollback;
