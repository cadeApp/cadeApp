-- ============================================================================
-- T-102: RPC accept_offer atómica e idempotente + limpieza PR56-H21
-- ============================================================================
-- Todas las funciones críticas usan SECURITY DEFINER y search_path fijo
-- (public, pg_temp) porque las policies RLS de T-005 congelan offers.status,
-- offers.decided_at, delivery_requests.status, accepted_offer_id y matched_at
-- para escrituras directas del cliente (PR56-H06, PR56-H15..H19).
-- ============================================================================

-- PR56-H21: Con status y decided_at congelados por RLS desde T-005, la policy
-- offers_update_merchant ya no cumple ninguna función legítima para el comercio
-- (que acepta exclusivamente vía public.accept_offer).
drop policy if exists offers_update_merchant on public.offers;

-- ----------------------------------------------------------------------------
-- 1. public.accept_offer
-- ----------------------------------------------------------------------------
create or replace function public.accept_offer(
  p_offer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_offer_request_id uuid;
  v_offer_courier_id uuid;
  v_request public.delivery_requests%rowtype;
  v_offer public.offers%rowtype;
  v_courier public.couriers%rowtype;
  v_now timestamptz := now();
begin
  -- 1. Autenticación y rol (precedencia paso 1: UNAUTHENTICATED -> UNAUTHORIZED_ACTOR)
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_uid;

  if v_role is null or v_role <> 'merchant' then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  -- 2. Validación de parámetros de entrada (precedencia paso 2: VALIDATION_ERROR)
  if p_offer_id is null then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  -- 3. Lectura inicial de claves y adquisición de locks en orden jerárquico
  -- (delivery_requests FOR UPDATE -> offers FOR UPDATE -> couriers FOR SHARE)
  -- para serializar llamadas concurrentes sobre la misma solicitud sin deadlocks.
  select o.request_id, o.courier_id
    into v_offer_request_id, v_offer_courier_id
  from public.offers o
  where o.id = p_offer_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
    into v_request
  from public.delivery_requests dr
  where dr.id = v_offer_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
    into v_offer
  from public.offers o
  where o.id = p_offer_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
    into v_courier
  from public.couriers c
  where c.profile_id = v_offer_courier_id
  for share;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 4. Titularidad del comercio sobre la solicitud (precedencia paso 4: UNAUTHORIZED_ACTOR)
  if v_request.merchant_id <> v_uid then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  -- 5. Idempotencia y competencia por la solicitud (precedencia paso 5: idempotent: true -> ALREADY_MATCHED)
  if v_request.status = 'matched' and v_request.accepted_offer_id = p_offer_id then
    return jsonb_build_object(
      'requestId', v_request.id,
      'acceptedOfferId', p_offer_id,
      'status', 'matched',
      'matchedAt', to_char(coalesce(v_request.matched_at, v_now) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotent', true
    );
  end if;

  if v_request.status = 'matched' then
    raise exception 'ALREADY_MATCHED' using errcode = 'P0001';
  end if;

  -- 6. Expiración perezosa y estado de la solicitud (precedencia paso 6: REQUEST_EXPIRED -> INVALID_STATE_TRANSITION)
  if v_request.status = 'published' and v_request.expires_at is not null and v_request.expires_at <= v_now then
    update public.delivery_requests
    set status = 'expired'
    where id = v_request.id;

    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;

  if v_request.status <> 'published' then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  -- 7. Estado de la oferta (precedencia paso 7: OFFER_NOT_PENDING)
  if v_offer.status <> 'pending' then
    raise exception 'OFFER_NOT_PENDING' using errcode = 'P0001';
  end if;

  -- 8. Elegibilidad del repartidor al momento de la aceptación (precedencia paso 8: COURIER_SUSPENDED -> COURIER_NOT_APPROVED)
  if v_courier.status = 'suspended' then
    raise exception 'COURIER_SUSPENDED' using errcode = 'P0001';
  end if;

  if v_courier.status <> 'approved' then
    raise exception 'COURIER_NOT_APPROVED' using errcode = 'P0001';
  end if;

  -- 9. Transición atómica: aceptar oferta ganadora, rechazar ofertas hermanas pendientes y emparejar solicitud
  begin
    update public.offers
    set status = 'accepted',
        decided_at = v_now
    where id = p_offer_id;

    update public.offers
    set status = 'rejected',
        decided_at = v_now
    where request_id = v_request.id
      and id <> p_offer_id
      and status = 'pending';

    update public.delivery_requests
    set status = 'matched',
        accepted_offer_id = p_offer_id,
        matched_at = v_now
    where id = v_request.id;
  exception
    when unique_violation then
      raise exception 'ALREADY_MATCHED' using errcode = 'P0001';
  end;

  return jsonb_build_object(
    'requestId', v_request.id,
    'acceptedOfferId', p_offer_id,
    'status', 'matched',
    'matchedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'idempotent', false
  );
end;
$$;

-- Endurecimiento de privilegios de ejecución
revoke all on function public.accept_offer(uuid) from public, anon, authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
