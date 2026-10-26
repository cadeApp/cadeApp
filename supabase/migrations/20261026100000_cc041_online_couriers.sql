-- CC-041 (T-415): presencia de repartidores y conteo de conectados para el comercio.
-- «Conectado» = aprobado, con «Disponible» prendido, consentimiento activo y señal de la app dentro de la ventana del
-- parámetro courier_online_window_minutes. La hora de la señal la pone la base: el cliente nunca la manda.

-- ============================================================================
-- Presencia: tabla aparte de couriers (couriers_update_self deja al repartidor escribir columnas no congeladas).
-- ============================================================================

create table public.courier_presence (
  courier_id uuid primary key references public.couriers (profile_id) on delete cascade,
  last_seen_at timestamptz not null
);

create index courier_presence_last_seen_idx on public.courier_presence (last_seen_at desc);

alter table public.courier_presence enable row level security;
create policy courier_presence_no_client_access on public.courier_presence
  as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on table public.courier_presence from public, anon, authenticated;

-- Parámetro nuevo con su valor por defecto.
insert into public.platform_settings (key, value)
values ('courier_online_window_minutes', '10'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- RPC
-- ============================================================================

-- Señal del repartidor aprobado: la app la manda mientras tiene «Disponible» prendido y la pantalla visible.
create function public.courier_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent public.consent_status;
  v_status public.courier_status;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  select role, consent_status into v_role, v_consent from public.profiles where id = v_uid;
  if v_role is distinct from 'courier' or v_consent is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;
  select status into v_status from public.couriers where profile_id = v_uid;
  if v_status is distinct from 'approved' then
    raise exception using errcode = 'P0001', message = 'COURIER_NOT_APPROVED';
  end if;

  insert into public.courier_presence (courier_id, last_seen_at)
  values (v_uid, v_now)
  on conflict (courier_id) do update set last_seen_at = excluded.last_seen_at;

  return jsonb_build_object(
    'lastSeenAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
end;
$$;

-- Conteo agregado para el comercio: nunca devuelve quiénes son.
create function public.get_online_couriers_count()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent public.consent_status;
  v_window integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  select role, consent_status into v_role, v_consent from public.profiles where id = v_uid;
  if v_role is distinct from 'merchant' or v_consent is distinct from 'active'
     then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_window := app_private.publication_setting_int('courier_online_window_minutes', 10);

  select count(*)::integer into v_count
  from public.courier_presence cp
  join public.couriers c on c.profile_id = cp.courier_id
  join public.profiles p on p.id = cp.courier_id
  where cp.last_seen_at > now() - make_interval(mins => v_window)
    and c.status = 'approved'
    and c.available
    and p.consent_status = 'active';

  return jsonb_build_object('count', v_count, 'windowMinutes', v_window);
end;
$$;

revoke all on function public.courier_heartbeat() from public, anon, authenticated;
grant execute on function public.courier_heartbeat() to authenticated;
revoke all on function public.get_online_couriers_count() from public, anon, authenticated;
grant execute on function public.get_online_couriers_count() to authenticated;

-- ============================================================================
-- admin_update_setting: mismo cuerpo que T-369 más la rama de courier_online_window_minutes.
-- ============================================================================

create or replace function public.admin_update_setting(
  p_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_old_value jsonb;
  v_str_val text;
begin
  perform app_private.assert_admin_aal2();

  select value into v_old_value
  from public.platform_settings
  where key = p_key
  for update;

  if p_key = 'min_offer_ars' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'request_ttl_minutes' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'pilot_active' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'pilot_terms_version' then
    v_str_val := btrim(p_value #>> '{}');
    if jsonb_typeof(p_value) <> 'string' or v_str_val is null or length(v_str_val) = 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'subscription_grace_days' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 0 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
    -- T-369 / CC-029 (H03, revisión PR #397): el fin legacy se calcula con la gracia vigente y un plan agendado por 2-A
    -- empieza en ese fin. Cambiar la gracia mientras un comercio tiene derecho legacy todavía relevante (con la gracia
    -- vieja o la nueva) y un período sin terminar lo superpondría o dejaría un hueco: se rechaza. El parámetro ya está
    -- tomado FOR UPDATE; admin_register_plan_period y admin_set_subscription lo toman FOR SHARE después del comercio.
    if v_old_value is distinct from p_value and exists (
      select 1
      from public.merchants as m
      where m.subscription_status in ('pilot', 'active')
        and m.paid_until is not null
        and ((m.paid_until + greatest(coalesce((v_old_value #>> '{}')::integer, 0), (p_value #>> '{}')::integer) + 1)::timestamp
             at time zone 'America/Argentina/Buenos_Aires') > clock_timestamp()
        and exists (
          select 1 from public.merchant_plan_periods as period
          where period.merchant_id = m.profile_id and period.ends_at > clock_timestamp()
        )
    ) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'max_drops_per_request' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  -- T-369 / CC-029
  elsif p_key = 'publication_drops_per_credit' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric > 1000
       or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key in ('carryover_base_pct', 'carryover_step_pct', 'carryover_cap_pct', 'launch_discount_pct') then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 0 or (p_value::text)::numeric > 100
       or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
    if (p_key = 'carryover_base_pct'
        and (p_value::text)::integer > app_private.publication_setting_int('carryover_cap_pct', 35))
       or (p_key = 'carryover_cap_pct'
        and (p_value::text)::integer < app_private.publication_setting_int('carryover_base_pct', 5)) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  elsif p_key = 'loose_credit_reference_price_ars' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 0 or (p_value::text)::numeric > 100000000
       or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  -- CC-041 (T-415): ventana de repartidores conectados, en minutos.
  elsif p_key = 'courier_online_window_minutes' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 2 or (p_value::text)::numeric > 60
       or (p_value::text)::numeric <> trunc((p_value::text)::numeric) then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTING_VALUE';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_SETTING_KEY';
  end if;

  insert into public.platform_settings (key, value)
  values (p_key, p_value)
  on conflict (key) do update
  set value = excluded.value;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_update_setting',
    'platform_setting',
    p_key,
    case when v_old_value is not null then jsonb_build_object('value', v_old_value) else null end,
    jsonb_build_object('value', p_value)
  );

  return jsonb_build_object(
    'key', p_key,
    'value', p_value
  );
end;
$$;
