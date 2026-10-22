-- ============================================================================
-- CC-016: proyección mínima de los repartidores que ofertaron, para el comercio dueño
-- ============================================================================
-- El comercio no puede leer `couriers` ni `profiles` por RLS (y no se abre esa lectura). Esta función
-- devuelve, solo para la solicitud propia, los cinco datos que la lista de ofertas necesita para mostrar
-- y ordenar. No devuelve teléfono, patente, dni_hmac, estado de aprobación ni campos administrativos.

create or replace function public.get_request_offer_couriers(
  p_request_id uuid
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
  v_couriers jsonb;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_request_id is null then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select p.role
    into v_role
  from public.profiles p
  where p.id = v_uid;

  if v_role is distinct from 'merchant'::public.profile_role
     or not app_private.is_active_operational_actor() then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  -- Solicitud inexistente o ajena: misma respuesta, para no confirmar que el id existe.
  if not exists (
    select 1
    from public.delivery_requests dr
    where dr.id = p_request_id
      and dr.merchant_id = v_uid
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'courierId', c.profile_id,
        'displayName', p.display_name,
        'vehicleType', c.vehicle_type,
        'licenseStatus', c.license_status,
        'insuranceStatus', c.insurance_status,
        'docLevel', c.doc_level
      )
      order by c.profile_id
    ),
    '[]'::jsonb
  )
    into v_couriers
  from public.couriers c
  join public.profiles p on p.id = c.profile_id
  where exists (
    select 1
    from public.offers o
    where o.request_id = p_request_id
      and o.courier_id = c.profile_id
  );

  return jsonb_build_object(
    'requestId', p_request_id,
    'couriers', v_couriers
  );
end;
$$;

revoke all on function public.get_request_offer_couriers(uuid) from public, anon, authenticated;
grant execute on function public.get_request_offer_couriers(uuid) to authenticated;
