-- T-369 / CC-029 addendum D01-B (PR #402): listado del catálogo de planes para el admin con AAL2.
-- Reemplaza la lectura de `publication_plans` con service role desde la app. La tabla sigue con RLS deny-all y sin
-- grants para anon/authenticated: el único acceso de lectura de clientes es esta RPC, que verifica rol admin y MFA
-- AAL2 en PostgreSQL antes de leer. Forward-only; no toca la migración 20261017090000.
--
-- Paginación keyset por (sort, id): estable con `sort` repetido. Se piden p_limit + 1 filas para saber si hay más;
-- el cursor sale de la ÚLTIMA fila devuelta, nunca de la extra.

create function public.admin_list_publication_plans(
  p_limit integer default 50,
  p_after_sort integer default null,
  p_after_id uuid default null,
  p_active_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_items jsonb;
  v_count integer;
  v_last_sort integer;
  v_last_id uuid;
begin
  perform app_private.assert_admin_aal2();

  if p_limit is null or p_limit < 1 or p_limit > 50
     or p_active_only is null
     or ((p_after_sort is null) <> (p_after_id is null)) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  with page as (
    select pl.id, pl.code, pl.name, pl.kind, pl.monthly_credits, pl.reference_price_ars, pl.active, pl.sort
    from public.publication_plans pl
    where (not p_active_only or pl.active)
      and (p_after_sort is null or (pl.sort, pl.id) > (p_after_sort, p_after_id))
    order by pl.sort asc, pl.id asc
    limit p_limit + 1
  ),
  numbered as (
    select page.*, row_number() over (order by page.sort asc, page.id asc) as rn
    from page
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id,
      'code', n.code,
      'name', n.name,
      'kind', n.kind,
      'monthlyCredits', n.monthly_credits,
      'referencePriceArs', n.reference_price_ars,
      'active', n.active,
      'sort', n.sort
    ) order by n.rn) filter (where n.rn <= p_limit), '[]'::jsonb),
    count(*)::integer,
    (array_agg(n.sort order by n.rn) filter (where n.rn <= p_limit))[least(count(*)::integer, p_limit)],
    (array_agg(n.id order by n.rn) filter (where n.rn <= p_limit))[least(count(*)::integer, p_limit)]
  into v_items, v_count, v_last_sort, v_last_id
  from numbered n;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', case
      when v_count > p_limit then jsonb_build_object('sort', v_last_sort, 'id', v_last_id)
      else null
    end
  );
end;
$$;

comment on function public.admin_list_publication_plans(integer, integer, uuid, boolean) is
  'CC-029 addendum D01-B: catálogo de planes para admin AAL2, keyset (sort, id), máximo 50 por página.';

revoke all on function public.admin_list_publication_plans(integer, integer, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_list_publication_plans(integer, integer, uuid, boolean)
  to authenticated;
