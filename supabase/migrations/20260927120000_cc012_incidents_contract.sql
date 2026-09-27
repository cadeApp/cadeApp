-- CC-012: contrato de incidentes (T-124 / PR #113, D05-A, D06-A, D07-A).
-- 1. Tipos canónicos de incidente en la tabla.
-- 2. Índice de la bandeja A05 con keyset estable (status, created_at desc, id desc).
-- 3. report_incident propio y endurecido: matriz D05-A, tipo canónico y relato sin datos de contacto.
-- 4. admin_resolve_incident: resolución auditada; preventive_suspension deriva el repartidor en Postgres.
-- 5. admin_list_incidents: lectura paginada por keyset para la bandeja.
-- 6. RLS: sin escrituras directas sobre incidents; solo las RPC SECURITY DEFINER escriben.

-- 1. Tabla: tipos canónicos (misma lista que INCIDENT_KINDS en src/domain/schemas).
update public.incidents
set kind = 'other'
where kind not in ('no_show', 'payment_issue', 'damaged_goods', 'safety', 'other');

alter table public.incidents
  add constraint incidents_kind_valid
  check (kind in ('no_show', 'payment_issue', 'damaged_goods', 'safety', 'other'));

-- 2. Índice de la bandeja A05.
create index incidents_status_created_cursor_idx
  on public.incidents (status, created_at desc, id desc);

-- 3. Detector de datos de contacto en el relato. Mismo criterio que
-- incidentDescriptionHasContact (src/domain/schemas): 7 o más dígitos seguidos, con espacios,
-- puntos, guiones o paréntesis entre medio, o una dirección de correo.
create or replace function app_private.incident_description_has_contact(p_description text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(p_description, '') ~ '\+?[0-9]([[:space:].()-]*[0-9]){6,}'
    or coalesce(p_description, '') ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}';
$$;

-- report_incident deja de pasar por app_private.request_cycle y conserva su precedencia canónica:
-- actor/rol -> parámetros -> existencia -> participación/elegibilidad -> estado -> ventana -> tope.
create or replace function public.report_incident(
  p_request_id uuid,
  p_kind text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;
  v_request public.delivery_requests%rowtype;
  v_offer public.offers%rowtype;
  v_courier public.couriers%rowtype;
  v_now timestamptz := now();
  v_eff_status public.delivery_request_status;
  v_kind text := btrim(p_kind);
  v_description text := btrim(p_description);
  v_limit integer;
  v_count integer;
  v_incident uuid;
begin
  -- Actor y rol: solo el comercio o el repartidor operativos; el admin nunca reporta (D05-A).
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  select role, consent_status into v_role, v_consent_status
  from public.profiles
  where id = v_uid;
  if v_role is null or v_role not in ('merchant', 'courier', 'admin') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;
  if v_consent_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- Parámetros: tipo canónico y relato sin datos de contacto.
  if p_request_id is null or v_kind is null or v_description is null
    or v_kind not in ('no_show', 'payment_issue', 'damaged_goods', 'safety', 'other')
    or length(v_description) not between 5 and 1000
    or app_private.incident_description_has_contact(v_description) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Existencia. Orden de locks compartido con el ciclo: solicitud -> oferta -> repartidor.
  select * into v_request
  from public.delivery_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v_offer
  from public.offers
  where id = v_request.accepted_offer_id and request_id = p_request_id
  for update;

  -- Participación y elegibilidad.
  if v_role = 'merchant' then
    if v_request.merchant_id <> v_uid then
      raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
    end if;
  elsif v_role = 'courier' then
    if v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted' then
      raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
    end if;
    select * into v_courier
    from public.couriers
    where profile_id = v_uid
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_courier.status = 'suspended' then
      raise exception using errcode = 'P0001', message = 'COURIER_SUSPENDED';
    end if;
    if v_courier.status <> 'approved' then
      raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
    end if;
  end if;

  -- Estado efectivo (D05-A): comercio en matched, in_transit y delivered (≤ 24 h);
  -- repartidor solo en matched e in_transit.
  v_eff_status := case
    when v_request.status = 'published' and v_request.expires_at <= v_now
      then 'expired'::public.delivery_request_status
    else v_request.status
  end;
  if not (
    v_eff_status in ('matched', 'in_transit')
    or (v_role = 'merchant' and v_eff_status = 'delivered')
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;
  if v_eff_status = 'delivered'
    and (v_request.delivered_at is null or v_now > v_request.delivered_at + interval '24 hours') then
    raise exception using errcode = 'P0001', message = 'INCIDENT_WINDOW_EXPIRED';
  end if;

  -- Tope por ventana de 1 minuto; un rechazo revierte también el contador.
  v_limit := app_private.request_setting_int('max_incidents_per_min');
  insert into public.rate_limits (subject, action, window_start, count)
  values (v_uid::text, 'report_incident', date_trunc('minute', v_now), 1)
  on conflict (subject, action, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;
  if v_count > v_limit then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

  insert into public.incidents (request_id, reporter_id, kind, description, status)
  values (p_request_id, v_uid, v_kind, v_description, 'open')
  returning id into v_incident;

  return jsonb_build_object(
    'incidentId', v_incident,
    'requestId', p_request_id,
    'status', 'open',
    'createdAt', v_now
  );
end;
$$;

-- 4. admin_resolve_incident. Precedencia: UNAUTHENTICATED -> UNAUTHORIZED_ACTOR -> AAL2_REQUIRED ->
-- VALIDATION_ERROR -> REASON_REQUIRED -> NOT_FOUND -> INVALID_STATE_TRANSITION -> operación.
-- Una sola transacción: cualquier error revierte suspensión, ofertas, incidente y auditoría.
create or replace function public.admin_resolve_incident(
  p_incident_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_incident public.incidents%rowtype;
  v_offer public.offers%rowtype;
  v_courier_id uuid;
  v_courier_status public.courier_status;
  v_reason text := btrim(p_reason);
  v_status text;
  v_withdrawn_count integer := 0;
  v_now timestamptz := now();
begin
  perform app_private.assert_admin_aal2();

  if p_incident_id is null or p_decision is null
    or p_decision not in ('no_action', 'warning', 'preventive_suspension')
    or length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  if v_reason is null or v_reason = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select * into v_incident
  from public.incidents
  where id = p_incident_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_incident.status not in ('open', 'reviewing') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- D06-A: el repartidor afectado es el de la oferta accepted de la solicitud del incidente.
  if p_decision = 'preventive_suspension' then
    select * into v_offer
    from public.offers
    where request_id = v_incident.request_id and status = 'accepted'
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
    end if;
    v_courier_id := v_offer.courier_id;

    select status into v_courier_status
    from public.couriers
    where profile_id = v_courier_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_courier_status = 'suspended' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
    end if;

    -- Mismos efectos que admin_suspend_courier.
    update public.couriers
    set
      status = 'suspended'::public.courier_status,
      available = false,
      deactivated_at = v_now
    where profile_id = v_courier_id;

    update public.offers
    set status = 'withdrawn'::public.offer_status
    where courier_id = v_courier_id
      and status = 'pending';
    get diagnostics v_withdrawn_count = row_count;
  end if;

  v_status := case when p_decision = 'no_action' then 'dismissed' else 'resolved' end;

  update public.incidents
  set status = v_status, resolution = p_decision || ': ' || v_reason
  where id = p_incident_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_resolve_incident',
    'incident',
    p_incident_id::text,
    jsonb_build_object('status', v_incident.status),
    jsonb_build_object(
      'status', v_status,
      'decision', p_decision,
      'reason', v_reason,
      'requestId', v_incident.request_id,
      'courierId', v_courier_id,
      'courierSuspended', v_courier_id is not null,
      'withdrawnOffersCount', v_withdrawn_count
    )
  );

  return jsonb_build_object(
    'incidentId', p_incident_id,
    'status', v_status,
    'decision', p_decision,
    'courierId', v_courier_id,
    'withdrawnOffersCount', v_withdrawn_count
  );
end;
$$;

-- 5. admin_list_incidents: keyset ORDER BY created_at DESC, id DESC. El cursor viaja con
-- microsegundos para que dos incidentes con el mismo created_at no se pierdan ni se dupliquen.
create or replace function public.admin_list_incidents(
  p_statuses text[],
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

  if p_statuses is null
    or cardinality(p_statuses) = 0
    or cardinality(p_statuses) > 4
    or array_position(p_statuses, null) is not null
    or not (p_statuses <@ array['open', 'reviewing', 'resolved', 'dismissed'])
    or (p_cursor_created_at is null) <> (p_cursor_id is null)
    or v_limit not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  with page as (
    select
      i.id,
      i.request_id,
      i.kind,
      i.description,
      i.status,
      i.resolution,
      i.created_at,
      i.reporter_id,
      p.role as reporter_role,
      p.display_name as reporter_name
    from public.incidents i
    join public.profiles p on p.id = i.reporter_id
    where i.status = any (p_statuses)
      and (
        p_cursor_created_at is null
        or i.created_at < p_cursor_created_at
        or (i.created_at = p_cursor_created_at and i.id < p_cursor_id)
      )
    order by i.created_at desc, i.id desc
    limit v_limit + 1
  ),
  numbered as (
    select page.*, row_number() over (order by created_at desc, id desc) as rn
    from page
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'requestId', request_id,
          'kind', kind,
          'description', description,
          'status', status,
          'resolution', resolution,
          'createdAt', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'reporterId', reporter_id,
          'reporterRole', reporter_role,
          'reporterName', reporter_name
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

-- 6. RLS: incidents solo se escribe por RPC (D07-A). Se conservan las lecturas del reportero y del admin.
drop policy if exists incidents_insert_authenticated on public.incidents;
drop policy if exists incidents_write_admin on public.incidents;
revoke insert, update, delete on table public.incidents from anon, authenticated;

-- Grants mínimos explícitos.
revoke all on function app_private.incident_description_has_contact(text) from public, anon, authenticated;
revoke all on function public.report_incident(uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_incident(uuid, text, text) to authenticated;
revoke all on function public.admin_resolve_incident(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_resolve_incident(uuid, text, text) to authenticated;
revoke all on function public.admin_list_incidents(text[], timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_list_incidents(text[], timestamptz, uuid, integer) to authenticated;
