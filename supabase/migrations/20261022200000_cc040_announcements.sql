-- CC-040 (T-414): novedades y promociones del admin. Push a quien aceptó novedades al activar las notificaciones y
-- banner en las home de comercio y repartidor, con cierre por cuenta y baja de promociones (Ley 25.326, art. 27).

-- ============================================================================
-- Tablas: sin acceso directo para clientes; todo pasa por las RPC.
-- ============================================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null,
  title text not null,
  body text not null,
  cta text not null default 'none',
  visible_until timestamptz not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  push_targets integer,
  push_sent integer,
  push_failed integer,
  push_recorded_at timestamptz,
  constraint announcements_audience check (audience in ('merchants', 'couriers', 'all')),
  constraint announcements_title check (char_length(title) between 1 and 60),
  constraint announcements_body check (char_length(body) between 1 and 140),
  constraint announcements_cta check (cta in ('none', 'merchant_plan', 'merchant_new_request', 'courier_feed')),
  -- La acción tiene que existir para todo el público: con «ambos», sin botón.
  constraint announcements_cta_audience check (
    (audience = 'merchants' and cta in ('none', 'merchant_plan', 'merchant_new_request'))
    or (audience = 'couriers' and cta in ('none', 'courier_feed'))
    or (audience = 'all' and cta = 'none')
  ),
  constraint announcements_push_counts check (
    (push_recorded_at is null and push_targets is null and push_sent is null and push_failed is null)
    or (push_recorded_at is not null and push_targets >= 0 and push_sent >= 0 and push_failed >= 0
        and push_sent + push_failed <= push_targets)
  )
);

create index announcements_visible_idx on public.announcements (visible_until desc, created_at desc);
create index announcements_created_idx on public.announcements (created_at desc, id desc);

create table public.announcement_dismissals (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

create table public.promotion_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  push_promotions boolean not null,
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;
alter table public.promotion_preferences enable row level security;

-- Sin acceso directo para clientes (mismo patrón que las tablas de CC-029): todo pasa por las RPC.
create policy announcements_no_client_access on public.announcements
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy announcement_dismissals_no_client_access on public.announcement_dismissals
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy promotion_preferences_no_client_access on public.promotion_preferences
  as restrictive for all to anon, authenticated using (false) with check (false);

revoke all on table public.announcements from public, anon, authenticated;
revoke all on table public.announcement_dismissals from public, anon, authenticated;
revoke all on table public.promotion_preferences from public, anon, authenticated;

-- ============================================================================
-- Helpers internos
-- ============================================================================

-- Perfiles del público: consentimiento activo; comercios con alta y repartidores aprobados.
create function app_private.announcement_audience(p_audience text)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.consent_status = 'active'
    and (
      (p_audience in ('merchants', 'all') and p.role = 'merchant'
        and exists (select 1 from public.merchants m where m.profile_id = p.id))
      or (p_audience in ('couriers', 'all') and p.role = 'courier'
        and exists (select 1 from public.couriers c where c.profile_id = p.id and c.status = 'approved'))
    )
$$;

revoke all on function app_private.announcement_audience(text) from public, anon, authenticated;

-- Actor de las RPC del usuario: comercio o repartidor con consentimiento activo. Devuelve su rol.
create function app_private.announcement_actor()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent public.consent_status;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  select role, consent_status into v_role, v_consent from public.profiles where id = v_uid;
  if v_consent is distinct from 'active' or v_role is null or v_role not in ('merchant', 'courier') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;
  return v_role::text;
end;
$$;

revoke all on function app_private.announcement_actor() from public, anon, authenticated;

-- ¿El perfil pertenece al público de la novedad? Mismas reglas que announcement_audience, por clave primaria.
create function app_private.announcement_is_for(p_audience text, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.consent_status = 'active'
      and (
        (p_audience in ('merchants', 'all') and p.role = 'merchant'
          and exists (select 1 from public.merchants m where m.profile_id = p.id))
        or (p_audience in ('couriers', 'all') and p.role = 'courier'
          and exists (select 1 from public.couriers c where c.profile_id = p.id and c.status = 'approved'))
      )
  )
$$;

revoke all on function app_private.announcement_is_for(text, uuid) from public, anon, authenticated;

-- ============================================================================
-- RPC del admin (aal2)
-- ============================================================================

create function public.admin_count_announcement_audience(p_audience text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipients integer;
  v_push integer;
begin
  perform app_private.assert_admin_aal2();
  if p_audience is null or p_audience not in ('merchants', 'couriers', 'all') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select
    (count(*) filter (where pp.push_promotions is distinct from false))::integer,
    (count(*) filter (
      where pp.push_promotions = true
        and exists (select 1 from public.push_subscriptions s where s.user_id = a.profile_id)
    ))::integer
  into v_recipients, v_push
  from app_private.announcement_audience(p_audience) a
  left join public.promotion_preferences pp on pp.profile_id = a.profile_id;

  return jsonb_build_object('recipients', v_recipients, 'pushRecipients', v_push);
end;
$$;

create function public.admin_create_announcement(
  p_audience text,
  p_title text,
  p_body text,
  p_cta text,
  p_visible_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_row public.announcements%rowtype;
begin
  perform app_private.assert_admin_aal2();

  if p_audience is null or p_audience not in ('merchants', 'couriers', 'all')
     or char_length(v_title) not between 1 and 60
     or char_length(v_body) not between 1 and 140
     or p_cta is null
     or not (
       (p_audience = 'merchants' and p_cta in ('none', 'merchant_plan', 'merchant_new_request'))
       or (p_audience = 'couriers' and p_cta in ('none', 'courier_feed'))
       or (p_audience = 'all' and p_cta = 'none')
     )
     or p_visible_days is null or p_visible_days not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Tope de 5 envíos en 24 h, evaluado bajo lock para que dos altas simultáneas no lo pasen.
  perform pg_advisory_xact_lock(hashtext('cc040:announcements'));
  if (select count(*) from public.announcements where created_at > now() - interval '24 hours') >= 5 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

  insert into public.announcements (audience, title, body, cta, visible_until, created_by)
  values (p_audience, v_title, v_body, p_cta, now() + make_interval(days => p_visible_days), v_actor_id)
  returning * into v_row;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id, 'admin_create_announcement', 'announcement', v_row.id::text, null,
    jsonb_build_object(
      'audience', v_row.audience, 'title', v_row.title, 'body', v_row.body, 'cta', v_row.cta,
      'visibleUntil', v_row.visible_until
    )
  );

  return jsonb_build_object(
    'announcementId', v_row.id,
    'visibleUntil', to_char(v_row.visible_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
end;
$$;

create function public.admin_record_announcement_push(
  p_announcement_id uuid,
  p_targets integer,
  p_sent integer,
  p_failed integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.announcements%rowtype;
begin
  perform app_private.assert_admin_aal2();

  if p_announcement_id is null
     or p_targets is null or p_sent is null or p_failed is null
     or p_targets < 0 or p_sent < 0 or p_failed < 0 or p_sent + p_failed > p_targets then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select * into v_row from public.announcements where id = p_announcement_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_row.push_recorded_at is not null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  update public.announcements
  set push_targets = p_targets, push_sent = p_sent, push_failed = p_failed, push_recorded_at = now()
  where id = p_announcement_id;

  return jsonb_build_object('announcementId', p_announcement_id);
end;
$$;

create function public.admin_list_announcements(
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

  if v_limit < 1 or v_limit > 50 or (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  with page as (
    select a.*
    from public.announcements a
    where p_cursor_created_at is null
      or a.created_at < p_cursor_created_at
      or (a.created_at = p_cursor_created_at and a.id < p_cursor_id)
    order by a.created_at desc, a.id desc
    limit v_limit + 1
  ),
  numbered as (
    select page.*, row_number() over (order by page.created_at desc, page.id desc) as rn, p.display_name
    from page
    left join public.profiles p on p.id = page.created_by
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'audience', audience,
          'title', title,
          'body', body,
          'cta', cta,
          'visibleUntil', to_char(visible_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'createdAt', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'createdByName', coalesce(nullif(btrim(display_name), ''), ''),
          'pushTargets', push_targets,
          'pushSent', push_sent,
          'pushFailed', push_failed
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

-- ============================================================================
-- RPC del comercio y del repartidor
-- ============================================================================

-- La novedad vigente más reciente de su público, sin cerrar y salvo baja de promociones.
create function public.get_my_announcement()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_member_merchants boolean;
  v_member_couriers boolean;
  v_row public.announcements%rowtype;
begin
  v_role := app_private.announcement_actor();

  if exists (select 1 from public.promotion_preferences where profile_id = v_uid and push_promotions = false) then
    return jsonb_build_object('announcement', null);
  end if;

  v_member_merchants := v_role = 'merchant' and app_private.announcement_is_for('merchants', v_uid);
  v_member_couriers := v_role = 'courier' and app_private.announcement_is_for('couriers', v_uid);

  select a.* into v_row
  from public.announcements a
  where a.visible_until > now()
    and (
      (a.audience in ('merchants', 'all') and v_member_merchants)
      or (a.audience in ('couriers', 'all') and v_member_couriers)
    )
    and not exists (
      select 1 from public.announcement_dismissals d where d.announcement_id = a.id and d.profile_id = v_uid
    )
  order by a.created_at desc, a.id desc
  limit 1;

  if not found then
    return jsonb_build_object('announcement', null);
  end if;

  return jsonb_build_object(
    'announcement',
    jsonb_build_object('id', v_row.id, 'title', v_row.title, 'body', v_row.body, 'cta', v_row.cta)
  );
end;
$$;

create function public.dismiss_announcement(p_announcement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_audience text;
begin
  perform app_private.announcement_actor();
  if p_announcement_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select audience into v_audience from public.announcements where id = p_announcement_id;
  if not found or not app_private.announcement_is_for(v_audience, v_uid) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  insert into public.announcement_dismissals (announcement_id, profile_id)
  values (p_announcement_id, v_uid)
  on conflict (announcement_id, profile_id) do nothing;

  return jsonb_build_object('dismissed', true);
end;
$$;

create function public.set_promotions_opt_in(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform app_private.announcement_actor();
  if p_enabled is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  insert into public.promotion_preferences (profile_id, push_promotions, updated_at)
  values (v_uid, p_enabled, now())
  on conflict (profile_id) do update set push_promotions = excluded.push_promotions, updated_at = now();

  return jsonb_build_object('enabled', p_enabled);
end;
$$;

-- ============================================================================
-- Destinatarios del push: solo el servidor (service_role).
-- ============================================================================

create function public.announcement_push_recipients(p_announcement_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.profile_id
  from public.announcements n
  cross join lateral app_private.announcement_audience(n.audience) a
  join public.promotion_preferences pp on pp.profile_id = a.profile_id and pp.push_promotions = true
  where n.id = p_announcement_id
  -- Orden estable: el servidor pagina el resultado de a 1000 (límite de PostgREST).
  order by a.profile_id
$$;

-- ============================================================================
-- Grants
-- ============================================================================

revoke all on function public.admin_count_announcement_audience(text) from public, anon, authenticated;
grant execute on function public.admin_count_announcement_audience(text) to authenticated;
revoke all on function public.admin_create_announcement(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.admin_create_announcement(text, text, text, text, integer) to authenticated;
revoke all on function public.admin_record_announcement_push(uuid, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_record_announcement_push(uuid, integer, integer, integer) to authenticated;
revoke all on function public.admin_list_announcements(timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_list_announcements(timestamptz, uuid, integer) to authenticated;
revoke all on function public.get_my_announcement() from public, anon, authenticated;
grant execute on function public.get_my_announcement() to authenticated;
revoke all on function public.dismiss_announcement(uuid) from public, anon, authenticated;
grant execute on function public.dismiss_announcement(uuid) to authenticated;
revoke all on function public.set_promotions_opt_in(boolean) from public, anon, authenticated;
grant execute on function public.set_promotions_opt_in(boolean) to authenticated;
revoke all on function public.announcement_push_recipients(uuid) from public, anon, authenticated;
grant execute on function public.announcement_push_recipients(uuid) to service_role;
