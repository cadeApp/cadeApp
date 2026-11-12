-- CC-049 (SEC-07, T-432): suscripciones push solo por RPC, allowlist de servicios push en la RPC.
-- No borra filas históricas (D5-C): las que estén fuera de la lista se conservan y el emisor no les envía.

-- 1. Policies: sin insert ni update de clientes; select y delete propios.
drop policy if exists push_subscriptions_all_self on public.push_subscriptions;
drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
create policy push_subscriptions_select_self on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid() and app_private.is_active_operational_actor());
drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid() and app_private.is_active_operational_actor());

-- 2. Grants.
revoke all on public.push_subscriptions from anon;
revoke insert, update, truncate, references, trigger on public.push_subscriptions from authenticated;

-- 3. Allowlist: https, host sin userinfo/escapes/IPv6, puerto ausente o :443 y `/` después; host exacto de FCM,
-- Mozilla o Apple, o un subdominio de una etiqueta de notify.windows.com (WNS).
create or replace function app_private.is_allowed_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((
    select lower(m[1]) in ('fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com')
      or lower(m[1]) ~ '^[a-z0-9-]+\.notify\.windows\.com$'
    from regexp_match(p_endpoint, '^https://([^/:@\\%\[\]\s]+)(?::443)?/') as m
  ), false)
$$;

revoke all on function app_private.is_allowed_push_endpoint(text) from public, anon, authenticated;

-- 4. RPC: la misma de CC-035 con la allowlist.
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

  -- Misma condición que las policies push_subscriptions_*_self (admin, o consentimiento activo).
  if not app_private.is_active_operational_actor() then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Tipos JSON antes de `->>`: un booleano o un número pasarían la regex como texto (PR457-H01).
  if jsonb_typeof(p_payload->'endpoint') is distinct from 'string'
     or jsonb_typeof(p_payload->'p256dh') is distinct from 'string'
     or jsonb_typeof(p_payload->'auth') is distinct from 'string'
     or (p_payload ? 'platform' and jsonb_typeof(p_payload->'platform') not in ('null', 'string')) then
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
     or (v_platform is not null and v_platform <> 'web')
     -- CC-049: solo servicios push de los navegadores.
     or not app_private.is_allowed_push_endpoint(v_endpoint) then
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

-- REVIEW ONLY: mutación RED-TIMESTAMP.
update public.push_subscriptions set last_seen_at = now();
