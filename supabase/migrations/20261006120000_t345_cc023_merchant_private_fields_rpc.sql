-- ============================================================================
-- CC-023 (T-345, PR 1): lectura de indicaciones y monto exacto de cambio para el comercio dueño
-- ============================================================================
-- Paso de compatibilidad del rollout de CC-023: crea la RPC que el detalle del comercio va a usar cuando
-- `notes` y `cash_change_amount` dejen de ser legibles por tabla (PR 3). Esta migración NO revoca columnas.

create or replace function public.get_merchant_request_private_fields(
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
  v_notes text;
  v_cash_change_amount integer;
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

  select dr.notes, dr.cash_change_amount
    into v_notes, v_cash_change_amount
  from public.delivery_requests dr
  where dr.id = p_request_id
    and dr.merchant_id = v_uid;

  -- Solicitud inexistente o ajena: misma respuesta, para no confirmar que el id existe.
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'requestId', p_request_id,
    'notes', v_notes,
    'cashChangeAmount', v_cash_change_amount
  );
end;
$$;

revoke all on function public.get_merchant_request_private_fields(uuid) from public, anon, authenticated;
grant execute on function public.get_merchant_request_private_fields(uuid) to authenticated;
