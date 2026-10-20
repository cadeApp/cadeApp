-- CC-035 (T-386): registrar la suscripción push reasignando el endpoint a la cuenta logueada.
-- RPC nueva y aditiva: la RLS de push_subscriptions no cambia; esta RPC es la única vía que cambia el dueño.
create or replace function public.register_push_subscription(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_endpoint text;
  v_p256dh text;
  v_auth_key text;
  v_platform text;
  v_subscription_id uuid;
  v_owner_id uuid;
  v_attempt integer;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  -- Misma condición que la policy push_subscriptions_all_self (admin, o consentimiento activo).
  if not app_private.is_active_operational_actor() then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_endpoint := p_payload->>'endpoint';
  v_p256dh := p_payload->>'p256dh';
  v_auth_key := p_payload->>'auth';
  v_platform := p_payload->>'platform';

  if v_endpoint is null
     or v_endpoint !~ '^https://\S+$'
     or char_length(v_endpoint) > 2048
     or v_p256dh is null
     or v_p256dh !~ '^[A-Za-z0-9_-]+$'
     or char_length(v_p256dh) > 256
     or v_auth_key is null
     or v_auth_key !~ '^[A-Za-z0-9_-]+$'
     or char_length(v_auth_key) > 256
     or (v_platform is not null and v_platform <> 'web') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Dos intentos: si otra sesión inserta el mismo endpoint entre la lectura y el insert (unique_violation), el
  -- segundo intento toma la fila ya confirmada por el camino de la fila existente.
  for v_attempt in 1..2 loop
    select id, user_id
    into v_subscription_id, v_owner_id
    from public.push_subscriptions
    where endpoint = v_endpoint
    for update;

    if found then
      if v_owner_id = v_actor_id then
        update public.push_subscriptions
        set p256dh = v_p256dh, auth = v_auth_key, platform = v_platform, last_seen_at = now()
        where id = v_subscription_id;

        return jsonb_build_object('subscriptionId', v_subscription_id, 'created', false, 'reassigned', false);
      end if;

      -- El navegador pertenece a la cuenta logueada: el endpoint pasa a ella y la anterior deja de recibir push acá.
      update public.push_subscriptions
      set user_id = v_actor_id, p256dh = v_p256dh, auth = v_auth_key, platform = v_platform, last_seen_at = now()
      where id = v_subscription_id;

      insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
      values (
        v_actor_id,
        'push_subscription_reassigned',
        'push_subscription',
        v_subscription_id::text,
        jsonb_build_object('user_id', v_owner_id),
        jsonb_build_object('user_id', v_actor_id)
      );

      return jsonb_build_object('subscriptionId', v_subscription_id, 'created', false, 'reassigned', true);
    end if;

    begin
      insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, platform, last_seen_at)
      values (v_actor_id, v_endpoint, v_p256dh, v_auth_key, v_platform, now())
      returning id into v_subscription_id;

      return jsonb_build_object('subscriptionId', v_subscription_id, 'created', true, 'reassigned', false);
    exception when unique_violation then
      -- Otra sesión confirmó el mismo endpoint: se reintenta una vez por el camino de la fila existente.
      if v_attempt = 2 then
        raise;
      end if;
    end;
  end loop;

  -- Inalcanzable: cada intento retorna o, en el segundo, relanza la violación (el wrapper la mapea a INTERNAL_ERROR).
  raise exception 'register_push_subscription no convergió';
end;
$$;

revoke all on function public.register_push_subscription(jsonb) from public, anon, authenticated;
grant execute on function public.register_push_subscription(jsonb) to authenticated;
