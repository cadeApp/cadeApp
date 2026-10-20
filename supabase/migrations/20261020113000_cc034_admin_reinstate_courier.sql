-- CC-034 (T-385): reactivar un repartidor suspendido o reconsiderar uno rechazado.
-- RPC nueva y aditiva: admin_decide_courier sigue decidiendo solo desde 'pending' (D03).
create or replace function public.admin_reinstate_courier(
  p_courier_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reason text := trim(p_reason);
  v_courier_status public.courier_status;
  v_vehicle_type public.vehicle_type;
begin
  perform app_private.assert_admin_aal2();

  if v_reason is null or v_reason = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  if char_length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Mismo primer lock que admin_suspend_courier, admin_decide_courier y las RPC del repartidor.
  select status, vehicle_type
  into v_courier_status, v_vehicle_type
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- Reintento o doble clic: ya está aprobado. Sin update ni auditoría.
  if v_courier_status = 'approved' then
    -- REVIEW ONLY / NEVER MERGE: mutación PR455-H02 (update físico inocuo en la ruta idempotente).
    update public.couriers set available = available where profile_id = p_courier_id;
    return jsonb_build_object(
      'courierId', p_courier_id,
      'previousStatus', 'approved',
      'status', 'approved',
      'idempotent', true
    );
  end if;

  -- La primera decisión sigue siendo admin_decide_courier; sin onboarding completo no se aprueba.
  if v_courier_status not in ('suspended', 'rejected') or v_vehicle_type is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- available queda como esté (false tras la suspensión): el repartidor la reactiva con set_availability.
  update public.couriers
  set
    status = 'approved',
    decided_at = now(),
    decided_by = v_actor_id,
    deactivated_at = null
  where profile_id = p_courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_reinstate_courier',
    'courier',
    p_courier_id::text,
    jsonb_build_object('status', v_courier_status),
    jsonb_build_object('status', 'approved', 'reason', v_reason)
  );

  return jsonb_build_object(
    'courierId', p_courier_id,
    'previousStatus', v_courier_status,
    'status', 'approved',
    'idempotent', false
  );
end;
$$;

revoke all on function public.admin_reinstate_courier(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reinstate_courier(uuid, text) to authenticated;
