-- #336: conteo de solicitudes entregadas por comercio para el listado admin A03 (/admin/merchants).
-- CC-023 revocó el SELECT de tabla de public.delivery_requests y dejó grants por columna, así que el embed
-- `delivery_requests ( count )` de PostgREST falla con «permission denied for table delivery_requests».
-- Esta lectura agregada lo reemplaza sin ampliar permisos de la tabla: corre como dueño, exige admin con
-- AAL2 antes de consultar y solo devuelve merchant_id y la cantidad de solicitudes en estado delivered.
create or replace function public.admin_merchant_delivered_counts(p_merchant_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_counts jsonb;
begin
  perform app_private.assert_admin_aal2();

  -- Una página del listado A03 tiene como máximo 50 comercios.
  if p_merchant_ids is null
    or cardinality(p_merchant_ids) > 50
    or array_position(p_merchant_ids, null) is not null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Una fila por comercio pedido (sin duplicados), con 0 si no tiene solicitudes entregadas.
  select coalesce(
    jsonb_agg(
      jsonb_build_object('merchant_id', requested.merchant_id, 'delivered_count', coalesce(delivered.n, 0))
      order by requested.merchant_id
    ),
    '[]'::jsonb
  )
  into v_counts
  from (select distinct unnest(p_merchant_ids) as merchant_id) as requested
  left join (
    select dr.merchant_id, count(*)::integer as n
    from public.delivery_requests dr
    where dr.merchant_id = any (p_merchant_ids)
    group by dr.merchant_id
  ) as delivered on delivered.merchant_id = requested.merchant_id;

  return v_counts;
end;
$$;

revoke all on function public.admin_merchant_delivered_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_merchant_delivered_counts(uuid[]) to authenticated;
