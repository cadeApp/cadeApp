begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

-- Tabla de demostración para la fase roja del DoD:
-- "rls_enabled.sql falla con una tabla sin RLS (demostrado)"
create table public._table_without_rls (id int);

select plan(2);

-- Test 1: Todas las tablas públicas deben tener RLS habilitada (relrowsecurity = true)
select ok(
  not exists (
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  'all public tables have RLS enabled'
);

-- Test 2: Todas las tablas públicas deben tener al menos una política RLS en pg_policy
select ok(
  not exists (
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_policy p where p.polrelid = c.oid
      )
  ),
  'all public tables have at least one RLS policy'
);

select * from finish();
rollback;
