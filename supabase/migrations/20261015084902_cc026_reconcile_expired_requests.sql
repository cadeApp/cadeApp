-- CC-026 — Núcleo transaccional único para materializar solicitudes vencidas.
-- La RPC del comercio deriva el scope de auth.uid(); el cron usa el mismo helper con service_role.

create or replace function app_private.reconcile_expired_requests(
  p_merchant_id uuid,
  p_limit integer,
  p_cutoff timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired_request_ids jsonb;
  v_expired_offer_couriers_by_request jsonb;
  v_expired_count integer;
  v_has_more boolean;
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 or p_cutoff is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_merchant_id is null and auth.role() is distinct from 'service_role' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  with candidates as materialized (
    select request.id
    from public.delivery_requests as request
    where request.status = 'published'
      and request.accepted_offer_id is null
      and request.expires_at is not null
      and request.expires_at <= p_cutoff
      and (p_merchant_id is null or request.merchant_id = p_merchant_id)
    order by request.expires_at asc, request.id asc
    for update skip locked
    limit p_limit
  ),
  eligible as materialized (
    select request.id, request.expires_at
    from public.delivery_requests as request
    join candidates on candidates.id = request.id
    where request.status = 'published'
      and request.accepted_offer_id is null
      and request.expires_at is not null
      and request.expires_at <= p_cutoff
      and (p_merchant_id is null or request.merchant_id = p_merchant_id)
  ),
  changed as materialized (
    update public.delivery_requests as request
    set status = 'expired'
    from eligible
    where request.id = eligible.id
    returning request.id, eligible.expires_at
  ),
  expired_offers as materialized (
    update public.offers as offer
    set status = 'expired', decided_at = p_cutoff
    from changed
    where offer.request_id = changed.id
      and offer.status = 'pending'
    returning offer.request_id, offer.courier_id
  ),
  audited as (
    insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
    select
      auth.uid(),
      'expired',
      'delivery_request',
      changed.id::text,
      jsonb_build_object('status', 'published'),
      jsonb_build_object('status', 'expired')
    from changed
    where (select count(*) from expired_offers) >= 0
    returning id
  )
  select
    coalesce(jsonb_agg(changed.id order by changed.expires_at asc, changed.id asc), '[]'::jsonb),
    coalesce((
      select jsonb_object_agg(couriers.request_id, couriers.courier_ids)
      from (
        select
          expired_offers.request_id,
          jsonb_agg(distinct expired_offers.courier_id order by expired_offers.courier_id) as courier_ids
        from expired_offers
        group by expired_offers.request_id
      ) as couriers
    ), '{}'::jsonb),
    count(*)::integer,
    exists (
      select 1
      from public.delivery_requests as remaining
      where remaining.status = 'published'
        and remaining.accepted_offer_id is null
        and remaining.expires_at is not null
        and remaining.expires_at <= p_cutoff
        and (p_merchant_id is null or remaining.merchant_id = p_merchant_id)
        and not exists (select 1 from changed where changed.id = remaining.id)
    )
  into v_expired_request_ids, v_expired_offer_couriers_by_request, v_expired_count, v_has_more
  from changed;

  return jsonb_build_object(
    'expiredRequestIds', v_expired_request_ids,
    'expiredOfferCourierIdsByRequest', v_expired_offer_couriers_by_request,
    'expiredCount', v_expired_count,
    'hasMore', v_has_more
  );
end;
$$;

revoke all on function app_private.reconcile_expired_requests(uuid, integer, timestamptz)
  from public, anon, authenticated;

create or replace function public.reconcile_expired_requests()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.profile_role;
  v_consent_status public.consent_status;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select profile.role, profile.consent_status
  into v_role, v_consent_status
  from public.profiles as profile
  where profile.id = v_actor_id;

  if v_role is distinct from 'merchant' or v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_result := app_private.reconcile_expired_requests(v_actor_id, 50, now());
  return jsonb_build_object(
    'expiredRequestIds', v_result->'expiredRequestIds',
    'expiredCount', v_result->'expiredCount',
    'hasMore', v_result->'hasMore'
  );
end;
$$;

revoke all on function public.reconcile_expired_requests() from public, anon, authenticated;
grant execute on function public.reconcile_expired_requests() to authenticated;

create or replace function public.reconcile_expired_requests_cron(
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  return app_private.reconcile_expired_requests(null, p_limit, now());
end;
$$;

revoke all on function public.reconcile_expired_requests_cron(integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_expired_requests_cron(integer) to service_role;

-- La policy RLS no puede comparar de forma segura una fila NEW con la fila previa
-- cuando la subconsulta vuelve a ver la actualización. Los permisos de columna hacen
-- inmutables las columnas operativas para clientes; las RPC SECURITY DEFINER siguen
-- ejecutándose como el owner de la función.
revoke update on public.delivery_requests from authenticated;
grant update (
  pickup_zone_id,
  dropoff_zone_id,
  package_type,
  notes,
  recipient_payment_method,
  needs_change,
  cash_change_amount,
  approx_distance_m,
  route_distance_m,
  cancel_reason,
  fixed_price_ars,
  auto_assign
) on public.delivery_requests to authenticated;

revoke update on public.offers from authenticated;
grant update (amount_ars, eta_minutes, message) on public.offers to authenticated;
