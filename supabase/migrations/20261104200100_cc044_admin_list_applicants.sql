-- ============================================================================
-- CC-044 (T-421): admin_list_applicants, cola de postulantes con búsqueda sin tildes
-- ============================================================================
--
-- Lectura admin (`aal2`) de la cola: filtra por estado («Pendientes» = postulaciones enviadas, CC-043), busca por
-- nombre ignorando tildes y mayúsculas con la misma normalización para el nombre y el término, devuelve el total
-- exacto y pagina por keyset (`profiles.created_at desc, profile_id desc`, el orden de T-420) en los dos sentidos.
-- Sin índices nuevos: la cola es de cientos de filas (ver CC-044, «Índices»).

-- 1. Normalización: NFD, sin marcas diacríticas U+0300–U+036F, minúsculas, espacios colapsados y recortados.
create or replace function app_private.search_normalize(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select lower(btrim(regexp_replace(
    regexp_replace(normalize(p_value, NFD), '[̀-ͯ]', '', 'g'),
    '\s+', ' ', 'g'
  )))
$$;

revoke all on function app_private.search_normalize(text) from public, anon, authenticated;

-- 2. RPC
create or replace function public.admin_list_applicants(
  p_status text,
  p_query text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_direction text default 'next',
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
  v_query text := nullif(btrim(p_query), '');
  v_needle text;
  v_items jsonb;
  v_total integer;
  v_first jsonb;
  v_last jsonb;
  v_has_before boolean;
  v_has_after boolean;
begin
  perform app_private.assert_admin_aal2();

  if p_status is null
    or p_status not in ('pending', 'approved', 'rejected', 'suspended')
    or (p_cursor_created_at is null) <> (p_cursor_id is null)
    or p_direction is null
    or p_direction not in ('next', 'prev')
    or (p_direction = 'prev' and p_cursor_created_at is null)
    or v_limit not between 1 and 50
    or char_length(coalesce(v_query, '')) > 80 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_needle := app_private.search_normalize(v_query);

  with base as (
    select
      c.profile_id,
      c.status,
      c.vehicle_type,
      c.dni_hmac is not null as has_dni,
      c.doc_level,
      c.license_status,
      c.insurance_status,
      c.submitted_at,
      p.display_name,
      p.phone,
      p.created_at
    from public.couriers c
    join public.profiles p on p.id = c.profile_id
    where c.status::text = p_status
      and (v_needle is null or strpos(app_private.search_normalize(p.display_name), v_needle) > 0)
  ),
  page as (
    select b.*
    from base b
    where p_cursor_created_at is null
      or (p_direction = 'next' and (b.created_at, b.profile_id) < (p_cursor_created_at, p_cursor_id))
      or (p_direction = 'prev' and (b.created_at, b.profile_id) > (p_cursor_created_at, p_cursor_id))
    -- `prev` toma las filas más cercanas al cursor; después se devuelven en el orden descendente.
    order by
      case when p_direction = 'prev' then b.created_at end asc,
      case when p_direction = 'prev' then b.profile_id end asc,
      b.created_at desc,
      b.profile_id desc
    limit v_limit
  ),
  rendered as (
    select
      page.created_at,
      page.profile_id,
      jsonb_build_object(
        'id', page.profile_id,
        'displayName', page.display_name,
        'phone', page.phone,
        'vehicleType', page.vehicle_type,
        'status', page.status,
        'hasDni', page.has_dni,
        'docLevel', page.doc_level,
        'licenseStatus', page.license_status,
        'insuranceStatus', page.insurance_status,
        'createdAt', to_char(page.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'submittedAt', to_char(page.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'documents', jsonb_build_object(
          'dniFront', coalesce(docs.dni_front, false),
          'dniBack', coalesce(docs.dni_back, false),
          'selfie', coalesce(docs.selfie, false),
          'license', coalesce(docs.license, false),
          'insurance', coalesce(docs.insurance, false)
        )
      ) as item,
      jsonb_build_object(
        'createdAt', to_char(page.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'id', page.profile_id
      ) as cursor
    from page
    left join lateral (
      select
        bool_or(d.kind = 'dni_front') as dni_front,
        bool_or(d.kind = 'dni_back') as dni_back,
        bool_or(d.kind = 'selfie') as selfie,
        bool_or(d.kind = 'license') as license,
        bool_or(d.kind = 'insurance') as insurance
      from public.courier_documents d
      where d.courier_id = page.profile_id
        and coalesce(d.is_current, true) = true
    ) docs on true
  )
  select
    coalesce((select jsonb_agg(r.item order by r.created_at desc, r.profile_id desc) from rendered r), '[]'::jsonb),
    (select count(*)::integer from base),
    (select r.cursor from rendered r order by r.created_at desc, r.profile_id desc limit 1),
    (select r.cursor from rendered r order by r.created_at asc, r.profile_id asc limit 1),
    exists (
      select 1 from base b, rendered r
      where r.profile_id = (select r2.profile_id from rendered r2 order by r2.created_at desc, r2.profile_id desc limit 1)
        and (b.created_at, b.profile_id) > (r.created_at, r.profile_id)
    ),
    exists (
      select 1 from base b, rendered r
      where r.profile_id = (select r2.profile_id from rendered r2 order by r2.created_at asc, r2.profile_id asc limit 1)
        and (b.created_at, b.profile_id) < (r.created_at, r.profile_id)
    )
  into v_items, v_total, v_first, v_last, v_has_before, v_has_after;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'nextCursor', case when v_has_after then v_last else null end,
    'prevCursor', case when v_has_before then v_first else null end
  );
end;
$$;

revoke all on function public.admin_list_applicants(text, text, timestamptz, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_list_applicants(text, text, timestamptz, uuid, text, integer) to authenticated;
