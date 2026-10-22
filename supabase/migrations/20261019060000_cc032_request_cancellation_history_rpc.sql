-- CC-032 (T-373): historial de cancelaciones de asignación del repartidor, de solo lectura.
-- `request_cancellation_reasons` conserva su RLS admin y sus grants: esta RPC es la única vía de lectura para el
-- comercio dueño y el repartidor que canceló. Proyecta SOLO eventos `courier_cancel_match` (decisión 1-A), clasifica
-- el motivo por coincidencia exacta con las opciones oficiales del formulario (2-A) y oculta el texto libre a todos
-- salvo al admin (3-A). Forward-only y aditiva: no toca tablas, policies ni el ciclo de solicitudes.
--
-- Paginación keyset por (created_at, id) descendente. El filtro de acción y de actor se aplica ANTES de ordenar y
-- paginar; se piden limit + 1 filas para saber si hay más y el cursor sale de la última fila devuelta.

create function public.get_request_cancellation_history(
  p_request_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_is_admin boolean;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_events jsonb;
  v_count integer;
  v_last_created_at timestamptz;
  v_last_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_request_id is null or ((p_before_created_at is null) <> (p_before_id is null)) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select p.role
    into v_role
  from public.profiles p
  where p.id = v_uid;

  v_is_admin := app_private.is_admin();

  if v_role is null or (not v_is_admin and not app_private.is_active_operational_actor()) then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  -- Pertenencia. Pedido ajeno o inexistente, o repartidor sin cancelaciones propias en el pedido: la misma
  -- respuesta, para no confirmar que el id existe.
  if v_is_admin then
    if not exists (select 1 from public.delivery_requests dr where dr.id = p_request_id) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  elsif v_role = 'merchant'::public.profile_role then
    if not exists (
      select 1 from public.delivery_requests dr
      where dr.id = p_request_id and dr.merchant_id = v_uid
    ) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  else
    if not exists (
      select 1 from public.request_cancellation_reasons rcr
      where rcr.request_id = p_request_id
        and rcr.action = 'courier_cancel_match'
        and rcr.actor_id = v_uid
    ) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  with page as (
    select rcr.id, rcr.offer_id, rcr.actor_id, rcr.reason, rcr.created_at
    from public.request_cancellation_reasons rcr
    where rcr.request_id = p_request_id
      and rcr.action = 'courier_cancel_match'
      and (v_is_admin or v_role <> 'courier'::public.profile_role or rcr.actor_id = v_uid)
      and (
        p_before_created_at is null
        or (rcr.created_at, rcr.id) < (p_before_created_at, p_before_id)
      )
    order by rcr.created_at desc, rcr.id desc
    limit v_limit + 1
  ),
  numbered as (
    select page.*, row_number() over (order by page.created_at desc, page.id desc) as rn
    from page
  ),
  classified as (
    select
      n.*,
      -- 2-A: coincidencia exacta (sin subcadenas ni regex) con las etiquetas oficiales o sus códigos, tras trim,
      -- minúsculas y sin tildes. Cualquier otro texto es `other`.
      case translate(lower(btrim(n.reason)), 'áéíóúü', 'aeiouu')
        when 'tuve un imprevisto' then 'unforeseen_issue'
        when 'unforeseen_issue' then 'unforeseen_issue'
        when 'problema con el vehiculo' then 'vehicle_breakdown'
        when 'vehicle_breakdown' then 'vehicle_breakdown'
        when 'no puedo llegar al punto de retiro' then 'pickup_issue'
        when 'pickup_issue' then 'pickup_issue'
        when 'emergencia' then 'personal_emergency'
        when 'personal_emergency' then 'personal_emergency'
        else 'other'
      end as category
    from numbered n
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'action', 'courier_cancel_match',
      'actionLabel', 'Cancelado por el repartidor',
      'category', c.category,
      'categoryLabel', case c.category
        when 'unforeseen_issue' then 'Tuve un imprevisto'
        when 'vehicle_breakdown' then 'Problema con el vehículo'
        when 'pickup_issue' then 'No puedo llegar al punto de retiro'
        when 'personal_emergency' then 'Emergencia'
        else 'Otro motivo'
      end,
      'createdAt', c.created_at,
      'actor', case
        when p.id is null then null
        else jsonb_build_object(
          'id', p.id,
          'role', p.role,
          'displayName', coalesce(nullif(btrim(p.display_name), ''), 'Repartidor')
        )
      end,
      'offerId', c.offer_id,
      -- 3-A / D3: el texto libre solo lo ve el admin.
      'rawReason', case when v_is_admin then c.reason else null end
    ) order by c.rn) filter (where c.rn <= v_limit), '[]'::jsonb),
    count(*)::integer,
    (array_agg(c.created_at order by c.rn) filter (where c.rn <= v_limit))[least(count(*)::integer, v_limit)],
    (array_agg(c.id order by c.rn) filter (where c.rn <= v_limit))[least(count(*)::integer, v_limit)]
  into v_events, v_count, v_last_created_at, v_last_id
  from classified c
  left join public.profiles p on p.id = c.actor_id;

  return jsonb_build_object(
    'version', '1.0',
    'requestId', p_request_id,
    'events', v_events,
    'pagination', jsonb_build_object(
      'limit', v_limit,
      'hasMore', v_count > v_limit,
      'nextCursor', case
        when v_count > v_limit then
          jsonb_build_object('beforeCreatedAt', v_last_created_at, 'beforeId', v_last_id)
        else null
      end
    )
  );
end;
$$;

comment on function public.get_request_cancellation_history(uuid, integer, timestamptz, uuid) is
  'CC-032: cancelaciones de asignación (courier_cancel_match) de un pedido para el comercio dueño, el repartidor que canceló (solo las propias) y el admin; keyset (created_at, id) desc, máximo 100 por página.';

revoke all on function public.get_request_cancellation_history(uuid, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_request_cancellation_history(uuid, integer, timestamptz, uuid)
  to authenticated;

-- Rollback (solo por decisión explícita y nueva migración):
-- drop function public.get_request_cancellation_history(uuid, integer, timestamptz, uuid);
