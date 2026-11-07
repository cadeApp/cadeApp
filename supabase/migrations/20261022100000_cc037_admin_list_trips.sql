-- ============================================================================
-- CC-037 (T-410): admin_list_trips, lista paginada de viajes con sus problemas
-- ============================================================================
--
-- Lectura de solo lectura para la sección «Viajes» del admin. Filtra «Con problemas» y pagina por keyset en la base
-- (`created_at desc, id desc`, cursor `{ createdAt, id }`), con el mismo patrón que `admin_list_incidents` (CC-012).
-- Nunca lee las tablas de contactos del destinatario.

-- 1. Índices de soporte
create index if not exists delivery_requests_admin_cursor_idx
  on public.delivery_requests (created_at desc, id desc)
  where status <> 'draft';

create index if not exists request_cancellation_reasons_request_idx
  on public.request_cancellation_reasons (request_id, action);

create index if not exists incidents_request_idx
  on public.incidents (request_id);

-- 2. RPC
create or replace function public.admin_list_trips(
  p_filter text,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := coalesce(p_limit, 20);
  v_items jsonb;
  v_total integer;
  v_last jsonb;
begin
  perform app_private.assert_admin_aal2();

  if p_filter is null
    or p_filter not in ('problems', 'all')
    or (p_cursor_created_at is null) <> (p_cursor_id is null)
    or v_limit not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  with candidates as (
    select
      r.id,
      r.status,
      r.created_at,
      r.published_at,
      r.delivered_at,
      r.cancelled_at,
      r.merchant_id,
      r.accepted_offer_id,
      d.drops_count,
      d.delivered_drops,
      d.failed_drops,
      coalesce(cr.courier_releases, 0) as courier_releases,
      coalesce(cr.no_show_reports, 0) as no_show_reports,
      coalesce(inc.incidents, 0) as incidents,
      coalesce(inc.open_incidents, 0) as open_incidents
    from public.delivery_requests r
    left join lateral (
      select
        count(*)::integer as drops_count,
        (count(*) filter (where dr.status = 'delivered'))::integer as delivered_drops,
        (count(*) filter (where dr.status = 'failed'))::integer as failed_drops
      from public.delivery_request_drops dr
      where dr.request_id = r.id
    ) d on true
    left join lateral (
      select
        (count(*) filter (where c.action = 'courier_cancel_match'))::integer as courier_releases,
        (count(*) filter (where c.action = 'report_no_show'))::integer as no_show_reports
      from public.request_cancellation_reasons c
      where c.request_id = r.id
        and c.action in ('courier_cancel_match', 'report_no_show')
    ) cr on true
    left join lateral (
      select
        count(*)::integer as incidents,
        (count(*) filter (where i.status in ('open', 'reviewing')))::integer as open_incidents
      from public.incidents i
      where i.request_id = r.id
    ) inc on true
    where r.status <> 'draft'
      and (
        p_cursor_created_at is null
        or r.created_at < p_cursor_created_at
        or (r.created_at = p_cursor_created_at and r.id < p_cursor_id)
      )
  ),
  page as (
    select c.*
    from candidates c
    where p_filter = 'all'
      or c.failed_drops > 0
      or c.courier_releases > 0
      or c.no_show_reports > 0
      or c.status = 'cancelled'
      or c.incidents > 0
    order by c.created_at desc, c.id desc
    limit v_limit + 1
  ),
  numbered as (
    select
      page.*,
      row_number() over (order by page.created_at desc, page.id desc) as rn,
      coalesce(nullif(btrim(m.business_name), ''), mp.display_name) as merchant_name,
      o.courier_id,
      cp.display_name as courier_name
    from page
    left join public.merchants m on m.profile_id = page.merchant_id
    left join public.profiles mp on mp.id = page.merchant_id
    left join public.offers o on o.id = page.accepted_offer_id and o.status = 'accepted'
    left join public.profiles cp on cp.id = o.courier_id
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'code', 'REQ-' || upper(substr(id::text, 1, 8)),
          'status', status,
          'createdAt', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'publishedAt', to_char(published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'deliveredAt', to_char(delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'cancelledAt', to_char(cancelled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'merchantId', merchant_id,
          'merchantName', coalesce(merchant_name, ''),
          'courierId', courier_id,
          'courierName', courier_name,
          -- Legacy sin drops: una sola entrega que toma el estado de la solicitud.
          'dropsCount', case when drops_count = 0 then 1 else drops_count end,
          'deliveredDrops', case
            when drops_count = 0 then (case when status = 'delivered' then 1 else 0 end)
            else delivered_drops
          end,
          'failedDrops', failed_drops,
          'courierReleases', courier_releases,
          'noShowReports', no_show_reports,
          'cancelled', status = 'cancelled',
          'incidents', incidents,
          'openIncidents', open_incidents
        )
        order by rn
      ) filter (where rn <= v_limit),
      '[]'::jsonb
    ),
    count(*)::integer,
    (array_agg(
      jsonb_build_object(
        'createdAt', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'id', id
      )
      order by rn
    ) filter (where rn = v_limit))[1]
  into v_items, v_total, v_last
  from numbered;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', case when v_total > v_limit then v_last else null end
  );
end;
$$;

revoke all on function public.admin_list_trips(text, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_list_trips(text, timestamptz, uuid, integer) to authenticated;
