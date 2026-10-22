-- T-335: Incluir public.offers y public.delivery_requests en la publicación supabase_realtime
-- Idempotente: comprueba existencia de la publicación y pertenencia de cada tabla individualmente.

do $$
begin
  -- 1. Asegurar la existencia de la publicación supabase_realtime
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  -- 2. Agregar public.offers si no pertenece a la publicación
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'offers'
  ) then
    alter publication supabase_realtime add table public.offers;
  end if;

  -- 3. Agregar public.delivery_requests si no pertenece a la publicación
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_requests'
  ) then
    alter publication supabase_realtime add table public.delivery_requests;
  end if;
end $$;
