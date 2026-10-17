-- T-369 (paso 1/3, CC-029): créditos de publicación y planes post-piloto.
-- Con platform_settings.pilot_active = true no se crea ningún cargo: el piloto queda intacto.
-- Las siete tablas nuevas no tienen acceso directo de clientes: RLS con una policy restrictiva de denegación total
-- (rls_enabled exige al menos una policy por tabla) y sin grants para anon ni authenticated. Todo pasa por RPC.

-- 1. Catálogo de planes (D2)
create table public.publication_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null,
  monthly_credits integer,
  reference_price_ars integer,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_plans_code_format check (code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  constraint publication_plans_name_length check (length(btrim(name)) between 2 and 80),
  constraint publication_plans_kind check (kind in ('quota', 'unlimited')),
  constraint publication_plans_credits_by_kind check (
    (kind = 'quota' and monthly_credits is not null and monthly_credits > 0)
    or (kind = 'unlimited' and monthly_credits is null)
  ),
  constraint publication_plans_reference_price check (reference_price_ars is null or reference_price_ars >= 0)
);

-- 2. Períodos de plan por comercio (D1, D-C5, D-C6, 1-A, 2-A). Tipo, cupo y precio quedan congelados por período.
create table public.merchant_plan_periods (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (profile_id) on delete cascade,
  plan_id uuid not null references public.publication_plans (id),
  plan_kind text not null,
  monthly_credits integer,
  reference_price_ars integer,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  streak integer not null,
  carryover_pct integer not null default 0,
  previous_period_id uuid references public.merchant_plan_periods (id),
  carryover_materialized_at timestamptz,
  operation_key uuid not null unique,
  is_purchase boolean not null,
  launch_discount_pct integer,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint merchant_plan_periods_kind check (plan_kind in ('quota', 'unlimited')),
  constraint merchant_plan_periods_credits_by_kind check ((plan_kind = 'quota') = (monthly_credits is not null)),
  constraint merchant_plan_periods_range check (ends_at > starts_at),
  constraint merchant_plan_periods_streak check (streak >= 1),
  constraint merchant_plan_periods_carryover_pct check (carryover_pct between 0 and 100),
  constraint merchant_plan_periods_discount_pct check (launch_discount_pct is null or launch_discount_pct between 1 and 100),
  constraint merchant_plan_periods_note_length check (note is null or length(note) <= 500)
);
create index merchant_plan_periods_merchant_starts_idx on public.merchant_plan_periods (merchant_id, starts_at);

-- 3. Lotes de créditos. Saldo disponible derivado: granted − Σ cargos reserved/consumed (ver helpers).
create table public.publication_credit_lots (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (profile_id) on delete cascade,
  kind text not null,
  period_id uuid references public.merchant_plan_periods (id) on delete cascade,
  granted integer not null,
  expires_at timestamptz,
  source text not null,
  operation_key uuid unique,
  note text,
  actor_id uuid,
  refund_charge_id uuid,
  refund_source_lot_id uuid references public.publication_credit_lots (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint publication_credit_lots_kind check (kind in ('loose', 'plan', 'carryover')),
  constraint publication_credit_lots_granted check (granted > 0),
  constraint publication_credit_lots_source check (
    (kind = 'loose' and source in ('purchase', 'adjustment', 'refund_conversion'))
    or (kind = 'plan' and source = 'plan')
    or (kind = 'carryover' and source = 'carryover')
  ),
  constraint publication_credit_lots_loose_never_expires check ((kind = 'loose') = (expires_at is null)),
  constraint publication_credit_lots_period_by_kind check ((kind = 'loose') = (period_id is null)),
  constraint publication_credit_lots_refund_refs check (
    (source = 'refund_conversion') = (refund_charge_id is not null and refund_source_lot_id is not null)
  ),
  constraint publication_credit_lots_note_length check (note is null or length(note) <= 500),
  constraint publication_credit_lots_refund_unique unique (refund_charge_id, refund_source_lot_id)
);
create index publication_credit_lots_merchant_idx on public.publication_credit_lots (merchant_id, kind, expires_at);
create unique index publication_credit_lots_one_plan_per_period
  on public.publication_credit_lots (period_id) where kind = 'plan';
create unique index publication_credit_lots_one_carryover_per_period
  on public.publication_credit_lots (period_id) where kind = 'carryover';

-- 4. Cargos por solicitud. Un único cargo corriente por solicitud (índice parcial where is_current); los consumos
--    históricos quedan con is_current = false (D-C2a).
create table public.publication_charges (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.delivery_requests (id) on delete cascade,
  merchant_id uuid not null references public.merchants (profile_id) on delete cascade,
  mode text not null,
  cost integer not null,
  state text not null,
  is_current boolean not null default true,
  period_id uuid references public.merchant_plan_periods (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_charges_mode check (mode in ('credits', 'unlimited', 'legacy_paid')),
  constraint publication_charges_state check (state in ('reserved', 'consumed', 'released')),
  constraint publication_charges_cost_by_mode check ((mode = 'credits') = (cost > 0) and cost >= 0),
  constraint publication_charges_released_not_current check (state <> 'released' or not is_current)
);
create unique index publication_charges_one_current_per_request
  on public.publication_charges (request_id) where is_current;
create index publication_charges_merchant_idx on public.publication_charges (merchant_id, state);

alter table public.publication_credit_lots
  add constraint publication_credit_lots_refund_charge_id_fkey
  foreign key (refund_charge_id) references public.publication_charges (id) on delete cascade;

-- 5. Reparto de cada cargo entre lotes (Σ amount = cost en cargos credits)
create table public.publication_charge_lots (
  charge_id uuid not null references public.publication_charges (id) on delete cascade,
  lot_id uuid not null references public.publication_credit_lots (id) on delete cascade,
  amount integer not null,
  primary key (charge_id, lot_id),
  constraint publication_charge_lots_amount check (amount > 0)
);
create index publication_charge_lots_lot_idx on public.publication_charge_lots (lot_id);

-- 6. Libro de movimientos inmutable (append-only)
create table public.publication_credit_movements (
  id bigint generated always as identity primary key,
  merchant_id uuid not null references public.merchants (profile_id) on delete cascade,
  lot_id uuid references public.publication_credit_lots (id) on delete cascade,
  charge_id uuid references public.publication_charges (id) on delete cascade,
  request_id uuid references public.delivery_requests (id) on delete cascade,
  kind text not null,
  amount integer not null,
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  constraint publication_credit_movements_kind check (kind in ('grant', 'reserve', 'consume', 'unconsume', 'release', 'convert')),
  constraint publication_credit_movements_amount check (amount >= 0),
  constraint publication_credit_movements_reason_length check (reason is null or length(reason) <= 500)
);
create index publication_credit_movements_merchant_idx on public.publication_credit_movements (merchant_id, id desc);
create index publication_credit_movements_lot_idx on public.publication_credit_movements (lot_id, created_at);

-- El libro no se actualiza nunca; solo la limpieza administrativa (postgres / service_role) puede borrar filas,
-- por ejemplo al eliminar fixtures E2E en cascada. Trigger como invoker: current_user es el rol que ejecuta.
create function app_private.publication_movements_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and current_user in ('postgres', 'supabase_admin', 'service_role') then
    return old;
  end if;
  raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
end;
$$;
revoke all on function app_private.publication_movements_immutable() from public, anon, authenticated;

create trigger publication_credit_movements_immutable
  before update or delete on public.publication_credit_movements
  for each row execute function app_private.publication_movements_immutable();

-- 7. Descuento de lanzamiento: una sola vez por comercio (D6)
create table public.merchant_launch_discounts (
  merchant_id uuid primary key references public.merchants (profile_id) on delete cascade,
  pct integer not null,
  period_id uuid references public.merchant_plan_periods (id) on delete cascade,
  lot_id uuid references public.publication_credit_lots (id) on delete cascade,
  applied_at timestamptz not null default now(),
  constraint merchant_launch_discounts_pct check (pct between 1 and 100),
  constraint merchant_launch_discounts_one_target check ((period_id is null) <> (lot_id is null))
);

-- 8. Sin acceso directo de clientes
alter table public.publication_plans enable row level security;
alter table public.merchant_plan_periods enable row level security;
alter table public.publication_credit_lots enable row level security;
alter table public.publication_charges enable row level security;
alter table public.publication_charge_lots enable row level security;
alter table public.publication_credit_movements enable row level security;
alter table public.merchant_launch_discounts enable row level security;

create policy publication_plans_no_client_access on public.publication_plans
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy merchant_plan_periods_no_client_access on public.merchant_plan_periods
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy publication_credit_lots_no_client_access on public.publication_credit_lots
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy publication_charges_no_client_access on public.publication_charges
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy publication_charge_lots_no_client_access on public.publication_charge_lots
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy publication_credit_movements_no_client_access on public.publication_credit_movements
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy merchant_launch_discounts_no_client_access on public.merchant_launch_discounts
  as restrictive for all to anon, authenticated using (false) with check (false);

revoke all on table public.publication_plans from public, anon, authenticated;
revoke all on table public.merchant_plan_periods from public, anon, authenticated;
revoke all on table public.publication_credit_lots from public, anon, authenticated;
revoke all on table public.publication_charges from public, anon, authenticated;
revoke all on table public.publication_charge_lots from public, anon, authenticated;
revoke all on table public.publication_credit_movements from public, anon, authenticated;
revoke all on table public.merchant_launch_discounts from public, anon, authenticated;
revoke all on sequence public.publication_credit_movements_id_seq from public, anon, authenticated;

-- 9. Parámetros nuevos (D1, D3, D6). loose_credit_reference_price_ars queda sin valor hasta que el admin lo cargue.
insert into public.platform_settings (key, value)
values
  ('publication_drops_per_credit', '2'::jsonb),
  ('carryover_base_pct', '5'::jsonb),
  ('carryover_step_pct', '5'::jsonb),
  ('carryover_cap_pct', '35'::jsonb),
  ('launch_discount_pct', '0'::jsonb)
on conflict (key) do nothing;


-- ============================================================================
-- Helpers internos (CC-029 §Seguridad): security definer, search_path fijo, sin execute para clientes.
-- ============================================================================

-- Entero de platform_settings que admite 0 y un valor por defecto si la clave no existe.
create function app_private.publication_setting_int(p_key text, p_default integer)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_value jsonb;
begin
  select value into v_value from public.platform_settings where key = p_key;
  if v_value is null then
    return p_default;
  end if;
  if jsonb_typeof(v_value) <> 'number' or v_value::text !~ '^[0-9]{1,9}$' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return v_value::text::integer;
end;
$$;
revoke all on function app_private.publication_setting_int(text, integer) from public, anon, authenticated;

-- Instante ISO-8601 en UTC con milisegundos, como el resto de las RPC.
create function app_private.publication_iso(p_ts timestamptz)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case when p_ts is null then null
    else to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end;
$$;
revoke all on function app_private.publication_iso(timestamptz) from public, anon, authenticated;

-- Costo híbrido (D3): 1 + max(0, entregas − N), con N = publication_drops_per_credit (≥ 1).
create function app_private.publication_cost(p_drops integer)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := app_private.publication_setting_int('publication_drops_per_credit', 2);
begin
  if v_n is null or v_n < 1 or p_drops is null or p_drops < 1 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return 1 + greatest(0, p_drops - v_n);
end;
$$;
revoke all on function app_private.publication_cost(integer) from public, anon, authenticated;

-- Fin efectivo del derecho legacy (paid_until + gracia, hasta las 23:59:59.999 de Argentina): primer instante posterior.
-- legacy_paid = paid_until vigente con estado pilot o active, igual que el control anterior a T-369 (incluye el piloto
-- extendido por el admin); expired y cancelled no tienen derecho legacy.
create function app_private.publication_legacy_end(p_merchant_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_merchant public.merchants%rowtype;
  v_grace integer := app_private.request_setting_int('subscription_grace_days');
begin
  select * into v_merchant from public.merchants where profile_id = p_merchant_id;
  if not found or v_merchant.subscription_status not in ('pilot', 'active') or v_merchant.paid_until is null then
    return null;
  end if;
  return ((v_merchant.paid_until + v_grace + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires');
end;
$$;
revoke all on function app_private.publication_legacy_end(uuid) from public, anon, authenticated;

-- Lo retenido de un lote por cargos reserved o consumed (incluidos los históricos).
create function app_private.publication_lot_used(p_lot_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(cl.amount), 0)::integer
  from public.publication_charge_lots cl
  join public.publication_charges c on c.id = cl.charge_id
  where cl.lot_id = p_lot_id
    and c.state in ('reserved', 'consumed');
$$;
revoke all on function app_private.publication_lot_used(uuid) from public, anon, authenticated;

-- Sin usar de un lote al instante p_cutoff, reconstruido desde el libro (reserve − release previos al corte).
-- Las liberaciones posteriores al corte no cambian el resultado (arrastre al corte de origen, revisión H04).
create function app_private.publication_lot_unused_as_of(p_lot_id uuid, p_cutoff timestamptz)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(
    0,
    l.granted - coalesce((
      select sum(case m.kind when 'reserve' then m.amount when 'release' then -m.amount else 0 end)
      from public.publication_credit_movements m
      where m.lot_id = l.id
        and m.kind in ('reserve', 'release')
        and m.created_at < p_cutoff
    ), 0)
  )::integer
  from public.publication_credit_lots l
  where l.id = p_lot_id;
$$;
revoke all on function app_private.publication_lot_unused_as_of(uuid, timestamptz) from public, anon, authenticated;

-- Lotes que pueden financiar una reserva ahora, en orden de prioridad (D5): primero plan/arrastre que vence antes,
-- después sueltos más viejos. Un lote de un período futuro (starts_at > now) no financia (revisión H01).
create function app_private.publication_usable_lots(p_merchant_id uuid, p_now timestamptz)
returns table (lot_id uuid, kind text, available integer, expires_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id, l.kind, (l.granted - app_private.publication_lot_used(l.id))::integer, l.expires_at
  from public.publication_credit_lots l
  left join public.merchant_plan_periods p on p.id = l.period_id
  where l.merchant_id = p_merchant_id
    and (l.expires_at is null or l.expires_at > p_now)
    and (l.kind = 'loose' or p.starts_at <= p_now)
    and l.granted - app_private.publication_lot_used(l.id) > 0
  order by case when l.kind = 'loose' then 1 else 0 end, l.expires_at asc nulls last, l.created_at asc, l.id asc;
$$;
revoke all on function app_private.publication_usable_lots(uuid, timestamptz) from public, anon, authenticated;

-- Arrastre perezoso (D1): una sola vez por período, en la primera lectura o reserva posterior a starts_at, sin cron.
create function app_private.materialize_carryover(p_merchant_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.merchant_plan_periods%rowtype;
  v_previous public.merchant_plan_periods%rowtype;
  v_previous_lot_id uuid;
  v_carry integer;
  v_lot_id uuid;
begin
  for v_period in
    select * from public.merchant_plan_periods
    where merchant_id = p_merchant_id
      and starts_at <= p_now
      and carryover_materialized_at is null
    order by starts_at asc
  loop
    v_carry := 0;
    v_lot_id := null;
    if v_period.previous_period_id is not null and v_period.carryover_pct > 0 then
      select * into v_previous from public.merchant_plan_periods where id = v_period.previous_period_id;
      if found and v_previous.plan_kind = 'quota' then
        select id into v_previous_lot_id
        from public.publication_credit_lots
        where period_id = v_previous.id and kind = 'plan';
        if v_previous_lot_id is not null then
          v_carry := least(
            app_private.publication_lot_unused_as_of(v_previous_lot_id, v_previous.ends_at),
            floor(v_period.carryover_pct * v_previous.monthly_credits / 100.0)::integer
          );
        end if;
      end if;
    end if;

    if v_carry > 0 then
      insert into public.publication_credit_lots (merchant_id, kind, period_id, granted, expires_at, source)
      values (p_merchant_id, 'carryover', v_period.id, v_carry, v_period.ends_at, 'carryover')
      on conflict (period_id) where kind = 'carryover' do nothing
      returning id into v_lot_id;
      if v_lot_id is not null then
        insert into public.publication_credit_movements (merchant_id, lot_id, kind, amount, reason)
        values (p_merchant_id, v_lot_id, 'grant', v_carry, 'carryover');
      end if;
    end if;

    update public.merchant_plan_periods
    set carryover_materialized_at = p_now
    where id = v_period.id and carryover_materialized_at is null;
  end loop;
end;
$$;
revoke all on function app_private.materialize_carryover(uuid, timestamptz) from public, anon, authenticated;

-- Reserva al publicar (D3/D5). Requiere que el llamador tenga el lock de la solicitud y del comercio, y que el piloto
-- esté apagado. Orden de elegibilidad: legacy_paid → ilimitado vigente → créditos.
create function app_private.reserve_publication(
  p_request_id uuid,
  p_merchant_id uuid,
  p_drops integer,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_merchant public.merchants%rowtype;
  v_current public.publication_charges%rowtype;
  v_period public.merchant_plan_periods%rowtype;
  v_grace integer;
  v_cost integer;
  v_total integer;
  v_remaining integer;
  v_take integer;
  v_charge_id uuid;
  v_lot record;
begin
  select * into v_merchant from public.merchants where profile_id = p_merchant_id;
  if not found or not exists (
    select 1 from public.delivery_requests where id = p_request_id and merchant_id = p_merchant_id
  ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select * into v_current from public.publication_charges
  where request_id = p_request_id and is_current
  for update;
  if found then
    -- Una republicación con reserva existente no exige crédito ni plan nuevo (CC-029 §Transiciones).
    if v_current.state = 'reserved' then
      return;
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  v_grace := app_private.request_setting_int('subscription_grace_days');

  if v_merchant.subscription_status in ('pilot', 'active') and v_merchant.paid_until is not null
    and v_merchant.paid_until + v_grace >= (p_now at time zone 'America/Argentina/Buenos_Aires')::date then
    insert into public.publication_charges (request_id, merchant_id, mode, cost, state)
    values (p_request_id, p_merchant_id, 'legacy_paid', 0, 'reserved')
    returning id into v_charge_id;
    insert into public.publication_credit_movements (merchant_id, charge_id, request_id, kind, amount, reason)
    values (p_merchant_id, v_charge_id, p_request_id, 'reserve', 0, 'legacy_paid');
    return;
  end if;

  select * into v_period from public.merchant_plan_periods
  where merchant_id = p_merchant_id
    and plan_kind = 'unlimited'
    and starts_at <= p_now
    and p_now < ends_at
  order by starts_at desc
  limit 1;
  if found then
    insert into public.publication_charges (request_id, merchant_id, mode, cost, state, period_id)
    values (p_request_id, p_merchant_id, 'unlimited', 0, 'reserved', v_period.id)
    returning id into v_charge_id;
    insert into public.publication_credit_movements (merchant_id, charge_id, request_id, kind, amount, reason)
    values (p_merchant_id, v_charge_id, p_request_id, 'reserve', 0, 'unlimited');
    return;
  end if;

  perform app_private.materialize_carryover(p_merchant_id, p_now);
  v_cost := app_private.publication_cost(p_drops);

  perform 1 from public.publication_credit_lots where merchant_id = p_merchant_id for no key update;

  select coalesce(sum(u.available), 0) into v_total
  from app_private.publication_usable_lots(p_merchant_id, p_now) as u;
  if false then -- MUT4
    raise exception 'PUBLICATION_CREDITS_EXHAUSTED' using errcode = 'P0001';
  end if;

  insert into public.publication_charges (request_id, merchant_id, mode, cost, state)
  values (p_request_id, p_merchant_id, 'credits', v_cost, 'reserved')
  returning id into v_charge_id;

  v_remaining := v_cost;
  for v_lot in select * from app_private.publication_usable_lots(p_merchant_id, p_now) loop
    exit when v_remaining = 0;
    v_take := least(v_remaining, v_lot.available);
    insert into public.publication_charge_lots (charge_id, lot_id, amount)
    values (v_charge_id, v_lot.lot_id, v_take);
    insert into public.publication_credit_movements (merchant_id, lot_id, charge_id, request_id, kind, amount, reason)
    values (p_merchant_id, v_lot.lot_id, v_charge_id, p_request_id, 'reserve', v_take, 'publish');
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining <> 0 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function app_private.reserve_publication(uuid, uuid, integer, timestamptz) from public, anon, authenticated;

-- Match: reserved → consumed sobre el cargo corriente. Sin cargo (piloto) o ya consumido: no hace nada.
create function app_private.consume_publication(p_request_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.publication_charges%rowtype;
begin
  select * into v_charge from public.publication_charges
  where request_id = p_request_id and is_current
  for update;
  if not found or v_charge.state = 'consumed' then
    return;
  end if;
  if v_charge.state <> 'reserved' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  update public.publication_charges set state = 'consumed', updated_at = now() where id = v_charge.id;
  insert into public.publication_credit_movements (merchant_id, charge_id, request_id, kind, amount, actor_id, reason)
  values (v_charge.merchant_id, v_charge.id, p_request_id, 'consume', 0, p_actor_id, 'match');
end;
$$;
revoke all on function app_private.consume_publication(uuid, uuid) from public, anon, authenticated;

-- no_show con republicación y cancelación del repartidor: consumed → reserved sobre el mismo cargo corriente.
create function app_private.unconsume_publication(p_request_id uuid, p_actor_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.publication_charges%rowtype;
begin
  select * into v_charge from public.publication_charges
  where request_id = p_request_id and is_current
  for update;
  if not found or v_charge.state = 'reserved' then
    return;
  end if;
  if v_charge.state <> 'consumed' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  update public.publication_charges set state = 'reserved', updated_at = now() where id = v_charge.id;
  insert into public.publication_credit_movements (merchant_id, charge_id, request_id, kind, amount, actor_id, reason)
  values (v_charge.merchant_id, v_charge.id, p_request_id, 'unconsume', 0, p_actor_id, p_reason);
end;
$$;
revoke all on function app_private.unconsume_publication(uuid, uuid, text) from public, anon, authenticated;

-- Liberación al saldo (vencer sin match, cancelar antes del match, no_show sin republicar). La parte tomada de un lote
-- ya vencido vuelve como lote suelto nuevo, exactamente una vez por (cargo, lote de origen) (D-C7, revisión H09).
create function app_private.release_publication(p_request_id uuid, p_actor_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.publication_charges%rowtype;
  v_part record;
  v_new_lot_id uuid;
  v_now timestamptz := now();
begin
  select * into v_charge from public.publication_charges
  where request_id = p_request_id and is_current
  for update;
  if not found then
    return;
  end if;
  if v_charge.state not in ('reserved', 'consumed') then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  for v_part in
    select cl.lot_id, cl.amount, l.expires_at
    from public.publication_charge_lots cl
    join public.publication_credit_lots l on l.id = cl.lot_id
    where cl.charge_id = v_charge.id
    order by cl.lot_id
  loop
    insert into public.publication_credit_movements (merchant_id, lot_id, charge_id, request_id, kind, amount, actor_id, reason)
    values (v_charge.merchant_id, v_part.lot_id, v_charge.id, p_request_id, 'release', v_part.amount, p_actor_id, p_reason);

    if v_part.expires_at is not null and v_part.expires_at <= v_now then
      v_new_lot_id := null;
      insert into public.publication_credit_lots (
        merchant_id, kind, granted, source, actor_id, refund_charge_id, refund_source_lot_id
      ) values (
        v_charge.merchant_id, 'loose', v_part.amount, 'refund_conversion', p_actor_id, v_charge.id, v_part.lot_id
      )
      on conflict (refund_charge_id, refund_source_lot_id) do nothing
      returning id into v_new_lot_id;
      if v_new_lot_id is not null then
        insert into public.publication_credit_movements (merchant_id, lot_id, charge_id, request_id, kind, amount, actor_id, reason)
        values (v_charge.merchant_id, v_new_lot_id, v_charge.id, p_request_id, 'convert', v_part.amount, p_actor_id, p_reason);
      end if;
    end if;
  end loop;

  if v_charge.mode <> 'credits' then
    insert into public.publication_credit_movements (merchant_id, charge_id, request_id, kind, amount, actor_id, reason)
    values (v_charge.merchant_id, v_charge.id, p_request_id, 'release', 0, p_actor_id, p_reason);
  end if;

  update public.publication_charges
  set state = 'released', is_current = false, updated_at = v_now
  where id = v_charge.id;
end;
$$;
revoke all on function app_private.release_publication(uuid, uuid, text) from public, anon, authenticated;

-- republish_request: un cargo corriente consumido queda como histórico (D-C2a, sin reintegro); uno reservado de una
-- solicitud vencida se libera como al vencer, antes de la reserva nueva (D-C1).
create function app_private.retire_publication_charge(p_request_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.publication_charges%rowtype;
begin
  select * into v_charge from public.publication_charges
  where request_id = p_request_id and is_current
  for update;
  if not found then
    return;
  end if;
  if v_charge.state = 'consumed' then
    update public.publication_charges set is_current = false, updated_at = now() where id = v_charge.id;
  elsif v_charge.state = 'reserved' then
    perform app_private.release_publication(p_request_id, p_actor_id, 'republish');
  else
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function app_private.retire_publication_charge(uuid, uuid) from public, anon, authenticated;

-- Resumen de saldo y plan de un comercio (lectura del comercio y del admin). Materializa el arrastre pendiente.
create function app_private.publication_balance(p_merchant_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_merchant public.merchants%rowtype;
  v_pilot jsonb;
  v_grace integer := app_private.request_setting_int('subscription_grace_days');
  v_legacy boolean;
  v_unlimited boolean;
  v_available integer;
  v_reserved integer;
  v_scheduled integer;
  v_mode text;
  v_can_publish boolean;
  v_current jsonb;
  v_next jsonb;
  v_lots jsonb;
begin
  select * into v_merchant from public.merchants where profile_id = p_merchant_id;
  if not found then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  select value into v_pilot from public.platform_settings where key = 'pilot_active';

  perform app_private.materialize_carryover(p_merchant_id, p_now);

  v_legacy := v_merchant.subscription_status in ('pilot', 'active') and v_merchant.paid_until is not null
    and v_merchant.paid_until + v_grace >= (p_now at time zone 'America/Argentina/Buenos_Aires')::date;
  v_unlimited := exists (
    select 1 from public.merchant_plan_periods
    where merchant_id = p_merchant_id and plan_kind = 'unlimited' and starts_at <= p_now and p_now < ends_at
  );
  select coalesce(sum(u.available), 0) into v_available from app_private.publication_usable_lots(p_merchant_id, p_now) as u;
  select coalesce(sum(cl.amount), 0) into v_reserved
  from public.publication_charge_lots cl
  join public.publication_charges c on c.id = cl.charge_id
  where c.merchant_id = p_merchant_id and c.state = 'reserved';
  select coalesce(sum(l.granted), 0) into v_scheduled
  from public.publication_credit_lots l
  join public.merchant_plan_periods p on p.id = l.period_id
  where l.merchant_id = p_merchant_id and p.starts_at > p_now;

  if v_pilot = 'true'::jsonb then
    v_mode := case when v_merchant.subscription_status = 'pilot' then 'pilot'
      when v_legacy then 'legacy_paid' else 'credits' end;
    v_can_publish := v_merchant.subscription_status not in ('expired', 'cancelled')
      and (v_merchant.subscription_status = 'pilot' or v_legacy);
  else
    v_mode := case when v_legacy then 'legacy_paid' when v_unlimited then 'unlimited' else 'credits' end;
    v_can_publish := v_merchant.subscription_status <> 'cancelled'
      and (v_legacy or v_unlimited or v_available >= 1);
  end if;

  select jsonb_build_object(
    'periodId', p.id, 'planId', p.plan_id, 'planName', pl.name, 'planKind', p.plan_kind,
    'monthlyCredits', p.monthly_credits, 'startsAt', app_private.publication_iso(p.starts_at),
    'endsAt', app_private.publication_iso(p.ends_at), 'streak', p.streak, 'carryoverPct', p.carryover_pct
  ) into v_current
  from public.merchant_plan_periods p
  join public.publication_plans pl on pl.id = p.plan_id
  where p.merchant_id = p_merchant_id and p.starts_at <= p_now and p_now < p.ends_at
  order by p.starts_at desc
  limit 1;

  select jsonb_build_object(
    'periodId', p.id, 'planId', p.plan_id, 'planName', pl.name, 'planKind', p.plan_kind,
    'monthlyCredits', p.monthly_credits, 'startsAt', app_private.publication_iso(p.starts_at),
    'endsAt', app_private.publication_iso(p.ends_at), 'streak', p.streak, 'carryoverPct', p.carryover_pct
  ) into v_next
  from public.merchant_plan_periods p
  join public.publication_plans pl on pl.id = p.plan_id
  where p.merchant_id = p_merchant_id and p.starts_at > p_now
  order by p.starts_at asc
  limit 1;

  select coalesce(jsonb_agg(item order by item_order), '[]'::jsonb) into v_lots
  from (
    select
      jsonb_build_object(
        'lotId', l.id, 'kind', l.kind, 'source', l.source, 'granted', l.granted,
        'available', l.granted - app_private.publication_lot_used(l.id),
        'startsAt', app_private.publication_iso(p.starts_at),
        'expiresAt', app_private.publication_iso(l.expires_at),
        'usable', (l.kind = 'loose' or p.starts_at <= p_now)
      ) as item,
      row_number() over (
        order by case when l.kind = 'loose' then 1 else 0 end, l.expires_at asc nulls last, l.created_at asc, l.id asc
      ) as item_order
    from public.publication_credit_lots l
    left join public.merchant_plan_periods p on p.id = l.period_id
    where l.merchant_id = p_merchant_id
      and (l.expires_at is null or l.expires_at > p_now)
      and l.granted - app_private.publication_lot_used(l.id) > 0
  ) as lots;

  return jsonb_build_object(
    'merchantId', p_merchant_id,
    'mode', v_mode,
    'canPublish', v_can_publish,
    'subscriptionStatus', v_merchant.subscription_status,
    'legacyPaidUntil', case when v_merchant.paid_until is null then null else to_char(v_merchant.paid_until, 'YYYY-MM-DD') end,
    'available', v_available,
    'reserved', v_reserved,
    'scheduled', v_scheduled,
    'currentPeriod', v_current,
    'nextPeriod', v_next,
    'lots', v_lots
  );
end;
$$;
revoke all on function app_private.publication_balance(uuid, timestamptz) from public, anon, authenticated;


-- ============================================================================
-- Redefiniciones (copias textuales de la última versión con los ganchos de T-369 marcados «T-369 / CC-029»)
-- ============================================================================

-- request_cycle: base 20261013140000_t340_clean_legacy.sql
create or replace function app_private.request_cycle(
  p_action text,
  p_request_id uuid,
  p_reason text default null,
  p_republish boolean default false,
  p_kind text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_request public.delivery_requests%rowtype;
  v_offer public.offers%rowtype;
  v_courier public.couriers%rowtype;
  v_merchant public.merchants%rowtype;
  v_contacts public.delivery_request_contacts%rowtype;
  v_pickup public.zones%rowtype;
  v_eff_status public.delivery_request_status;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_pilot jsonb;
  v_grace integer;
  v_distance integer;
  v_lat1 numeric; v_lng1 numeric; v_lat2 numeric; v_lng2 numeric;
  v_count integer;
  v_limit integer;
  v_status public.delivery_request_status;
  v_result jsonb;
  v_incident uuid;
  v_rate_action text;
  v_consent_status public.consent_status;
  -- Variables de multi-drop
  v_drops_count integer := 0;
  v_max_drops integer;
  v_new_drop_id uuid;
  v_drop_row record;
  v_can_calc_total boolean;
  v_total_distance integer;
  v_seg_distance integer;
  v_drop1_id uuid;
  v_drop1_payment text;
  v_drop1_needs_change boolean;
  v_drop1_notes text;
  v_drop1_cash_change integer;
  -- T-369 / CC-029
  v_pilot_on boolean;
  v_credit_drops integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_uid;
  if (v_role is null or (v_role = 'courier' and p_action in ('publish_request','republish_request','report_no_show'))
    or (p_action in ('publish_request','republish_request','report_no_show') and v_role <> 'merchant')
    or (p_action in ('mark_picked_up','mark_delivered','courier_cancel_match') and v_role <> 'courier')
    or (p_action = 'report_incident' and v_role not in ('merchant','courier'))
    or (p_action = 'cancel_request' and v_role not in ('merchant','admin'))) then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;
  if v_role <> 'admin' and (v_consent_status is distinct from 'active') then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  if p_request_id is null or (p_action = 'report_incident' and (
      p_kind is null or p_description is null
      or length(btrim(p_kind)) not between 2 and 80
      or length(btrim(p_description)) not between 5 and 1000)) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select * into v_request from public.delivery_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_offer from public.offers
    where id = v_request.accepted_offer_id and request_id = p_request_id for update;
  if v_role = 'courier' then
    if p_action = 'report_incident' and (v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted') then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
    select * into v_courier from public.couriers where profile_id = v_uid for share;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_courier.status = 'suspended' then raise exception 'COURIER_SUSPENDED' using errcode = 'P0001'; end if;
    if v_courier.status <> 'approved' then raise exception 'COURIER_NOT_APPROVED' using errcode = 'P0001'; end if;
    if v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted' then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
  elsif v_role = 'merchant' and v_request.merchant_id <> v_uid then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  v_eff_status := case when v_request.status = 'published' and v_request.expires_at <= v_now
    then 'expired'::public.delivery_request_status else v_request.status end;
  if p_action = 'cancel_request' and v_request.status = 'published' and v_request.expires_at <= v_now then
    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;
  if (p_action = 'publish_request' and v_eff_status <> 'draft')
    or (p_action = 'cancel_request' and not (
      (v_role = 'merchant' and v_eff_status in ('published','matched'))
      or (v_role = 'admin' and v_eff_status = 'in_transit')))
    or (p_action in ('mark_picked_up','report_no_show','courier_cancel_match') and v_eff_status <> 'matched')
    or (p_action = 'mark_delivered' and v_eff_status <> 'in_transit')
    or (p_action = 'republish_request' and v_eff_status not in ('matched','expired','cancelled'))
    or (p_action = 'report_incident' and v_eff_status not in ('published','matched','in_transit','delivered')) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  -- CC-022 §6: mark_delivered sólo se admite si drops_count = 1
  if p_action = 'mark_delivered' and v_request.drops_count > 1 then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  if p_action = 'cancel_request' and v_role = 'admin'
    and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'AAL2_REQUIRED' using errcode = 'P0001';
  end if;
  if ((p_action = 'cancel_request' and v_eff_status in ('matched','in_transit'))
    or (p_action = 'republish_request' and v_eff_status = 'matched')
    or p_action = 'courier_cancel_match') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_action = 'cancel_request' and v_role = 'admin' and v_eff_status = 'in_transit'
    and not exists (select 1 from public.incidents where request_id = p_request_id) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_no_show' and (v_offer.id is null or v_offer.status <> 'accepted') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_incident' and v_eff_status = 'delivered'
    and (v_request.delivered_at is null or v_now > v_request.delivered_at + interval '24 hours') then
    raise exception 'INCIDENT_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;

  if p_action in ('publish_request','republish_request') or (p_action = 'report_no_show' and p_republish) then
    select value into v_pilot from public.platform_settings where key = 'pilot_active';
    if v_pilot is null or jsonb_typeof(v_pilot) <> 'boolean' then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    v_pilot_on := v_pilot = 'true'::jsonb;
    -- T-369 / CC-029: con el piloto apagado, las vencidas del comercio se reconcilian ANTES de tomar su lock
    -- (solicitud → comercio), con skip locked: nunca se espera el lock de otra solicitud desde el del comercio.
    if not v_pilot_on and p_action in ('publish_request','republish_request') then
      perform app_private.reconcile_expired_requests(v_request.merchant_id, 200, v_now);
    end if;
    -- CC-029: for update (antes for share) para serializar las reservas del mismo comercio.
    select * into v_merchant from public.merchants where profile_id = v_request.merchant_id for update;
    v_grace := app_private.request_setting_int('subscription_grace_days');
    if v_pilot_on then
      -- Piloto encendido: control de elegibilidad exactamente igual que antes de T-369 y sin cargos.
      if v_merchant.profile_id is null or v_merchant.subscription_status in ('expired','cancelled')
        or not coalesce((v_merchant.subscription_status = 'pilot' and v_pilot = 'true'::jsonb)
          or (v_merchant.paid_until + v_grace >=
            (v_now at time zone 'America/Argentina/Buenos_Aires')::date), false) then
        raise exception 'SUBSCRIPTION_INACTIVE' using errcode = 'P0001';
      end if;
    elsif v_merchant.profile_id is null or v_merchant.subscription_status = 'cancelled' then
      -- Piloto apagado: solo cancelled bloquea por suscripción; el resto depende del derecho (reserve_publication).
      raise exception 'SUBSCRIPTION_INACTIVE' using errcode = 'P0001';
    end if;
  end if;
  if p_action in ('publish_request','republish_request','courier_cancel_match')
    or (p_action = 'report_no_show' and p_republish) then
    v_expires := v_now + make_interval(mins => app_private.request_setting_int('request_ttl_minutes'));
  end if;

  if p_action = 'publish_request' then
    -- 1. Puente legacy si la solicitud tiene CERO drops (CC-022 §5, §10 Paso 3)
    select count(*) into v_drops_count from public.delivery_request_drops where request_id = p_request_id;
    if v_drops_count = 0 then
      select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for update;
      if not found or not v_contacts.recipient_consent_declared
         or btrim(coalesce(v_contacts.dropoff_address, '')) = ''
         or btrim(coalesce(v_contacts.recipient_name, '')) = ''
         or btrim(coalesce(v_contacts.recipient_phone, '')) = ''
         or v_request.dropoff_zone_id is null
         or v_request.package_type is null
         or v_request.recipient_payment_method is null then
        raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
      end if;

      if v_request.recipient_payment_method = 'cash' and v_request.needs_change then
        if v_request.cash_change_amount is null or v_request.cash_change_amount <= 0 then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      end if;

      insert into public.delivery_request_drops (
        request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status
      ) values (
        p_request_id,
        1,
        v_request.dropoff_zone_id,
        v_request.package_type,
        v_request.recipient_payment_method,
        case when v_request.recipient_payment_method = 'cash' then v_request.needs_change else false end,
        'pending'
      ) returning id into v_new_drop_id;

      insert into public.delivery_request_drop_contacts (
        drop_id, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared, cash_change_amount, notes
      ) values (
        v_new_drop_id,
        v_contacts.dropoff_address,
        v_contacts.dropoff_lat,
        v_contacts.dropoff_lng,
        v_contacts.recipient_name,
        v_contacts.recipient_phone,
        v_contacts.recipient_consent_declared,
        case when v_request.recipient_payment_method = 'cash' and v_request.needs_change then v_request.cash_change_amount else null end,
        v_request.notes
      );

      -- Paso 3 (CC-022 §10): Limpieza de valores legacy en la misma transacción tras copiarlos a drop_contacts
      update public.delivery_requests
      set notes = null,
          cash_change_amount = null
      where id = p_request_id;

      v_drops_count := 1;
    else
      -- PR326-H02: Puente con drops preexistentes
      -- Bajo el lock existente (v_request ya está bloqueado FOR UPDATE):
      -- si hay datos legacy, comprobar drop 1, sincronizar dato faltante sin conflicto,
      -- verificar igualdad por valor y limpiar solo después. Ante discrepancia, abortar.
      if v_request.notes is not null or v_request.cash_change_amount is not null then
        select d.id, d.recipient_payment_method, d.needs_change,
               dc.notes, dc.cash_change_amount
        into v_drop1_id, v_drop1_payment, v_drop1_needs_change,
             v_drop1_notes, v_drop1_cash_change
        from public.delivery_request_drops d
        left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
        where d.request_id = p_request_id and d.position = 1
        for update of d;

        if v_drop1_id is null then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;

        -- Comprobar discrepancia antes de mutar
        if v_request.notes is not null and v_drop1_notes is not null and v_drop1_notes is distinct from v_request.notes then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;

        if v_request.cash_change_amount is not null then
          if v_drop1_payment <> 'cash' or not coalesce(v_drop1_needs_change, false) then
            raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
          end if;
          if v_drop1_cash_change is not null and v_drop1_cash_change is distinct from v_request.cash_change_amount then
            raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
          end if;
        end if;

        -- Sincronizar únicamente el dato faltante de position=1 cuando no hay conflicto
        if (v_request.notes is not null and v_drop1_notes is null)
           or (v_request.cash_change_amount is not null and v_drop1_payment = 'cash' and v_drop1_needs_change and v_drop1_cash_change is null) then
          update public.delivery_request_drop_contacts
          set notes = coalesce(notes, v_request.notes),
              cash_change_amount = coalesce(
                cash_change_amount,
                case when v_drop1_payment = 'cash' and v_drop1_needs_change then v_request.cash_change_amount else null end
              )
          where drop_id = v_drop1_id;
        end if;

        -- Comprobar igualdad por valor
        select dc.notes, dc.cash_change_amount
        into v_drop1_notes, v_drop1_cash_change
        from public.delivery_request_drop_contacts dc
        where dc.drop_id = v_drop1_id;

        if (v_request.notes is not null and v_drop1_notes is distinct from v_request.notes)
           or (v_request.cash_change_amount is not null and (
                v_drop1_payment <> 'cash'
                or not coalesce(v_drop1_needs_change, false)
                or v_drop1_cash_change is distinct from v_request.cash_change_amount
              )) then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;

        -- Limpiar solo tras verificar igualdad
        update public.delivery_requests
        set notes = null,
            cash_change_amount = null
        where id = p_request_id;
      end if;
    end if;

    select count(*) into v_drops_count from public.delivery_request_drops where request_id = p_request_id;
    if v_drops_count = 0 then
      raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
    end if;

    v_max_drops := app_private.request_setting_int('max_drops_per_request');
    if v_drops_count > v_max_drops then
      raise exception 'DROP_LIMIT_EXCEEDED' using errcode = 'P0001';
    end if;

    -- Posiciones consecutivas desde 1
    if exists (
      select 1
      from generate_series(1, v_drops_count) as expected_pos
      where not exists (
        select 1 from public.delivery_request_drops d
        where d.request_id = p_request_id and d.position = expected_pos
      )
    ) then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;

    select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for share;
    if not found or btrim(coalesce(v_contacts.pickup_address, '')) = '' then
      raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
    end if;

    select * into v_pickup from public.zones where id = v_request.pickup_zone_id for share;
    if v_pickup.id is null or not v_pickup.active then
      raise exception 'INVALID_ZONE' using errcode = 'P0001';
    end if;

    v_lat1 := coalesce(v_contacts.pickup_lat, v_pickup.centroid_lat);
    v_lng1 := coalesce(v_contacts.pickup_lng, v_pickup.centroid_lng);
    if v_lat1 is not null and (v_lat1 not between -27.4800 and -27.3800 or v_lng1 not between -65.6450 and -65.5800) then
      raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
    end if;

    v_can_calc_total := (v_lat1 is not null and v_lng1 is not null);
    v_total_distance := 0;

    for v_drop_row in
      select d.id, d.position, d.dropoff_zone_id, d.recipient_payment_method, d.needs_change,
             dc.drop_id, dc.dropoff_address, dc.dropoff_lat, dc.dropoff_lng, dc.recipient_name, dc.recipient_phone,
             dc.recipient_consent_declared, dc.cash_change_amount,
             z.active as zone_active, z.centroid_lat, z.centroid_lng
      from public.delivery_request_drops d
      left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
      left join public.zones z on z.id = d.dropoff_zone_id
      where d.request_id = p_request_id
      order by d.position
    loop
      if v_drop_row.drop_id is null
         or not coalesce(v_drop_row.recipient_consent_declared, false)
         or btrim(coalesce(v_drop_row.dropoff_address, '')) = ''
         or btrim(coalesce(v_drop_row.recipient_name, '')) = ''
         or btrim(coalesce(v_drop_row.recipient_phone, '')) = '' then
        raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
      end if;

      if v_drop_row.dropoff_zone_id is null or not coalesce(v_drop_row.zone_active, false) then
        raise exception 'INVALID_ZONE' using errcode = 'P0001';
      end if;

      v_lat2 := coalesce(v_drop_row.dropoff_lat, v_drop_row.centroid_lat);
      v_lng2 := coalesce(v_drop_row.dropoff_lng, v_drop_row.centroid_lng);
      if v_lat2 is not null and (v_lat2 not between -27.4800 and -27.3800 or v_lng2 not between -65.6450 and -65.5800) then
        raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
      end if;

      if v_drop_row.recipient_payment_method <> 'cash' and v_drop_row.needs_change then
        raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
      end if;
      if v_drop_row.recipient_payment_method = 'cash' and v_drop_row.needs_change then
        if v_drop_row.cash_change_amount is null or v_drop_row.cash_change_amount <= 0 then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      else
        if v_drop_row.cash_change_amount is not null then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      end if;

      if v_can_calc_total and v_lat1 is not null and v_lng1 is not null and v_lat2 is not null and v_lng2 is not null then
        v_seg_distance := app_private.route_segment_distance(v_lat1, v_lng1, v_lat2, v_lng2);
        update public.delivery_request_drops set approx_distance_m = v_seg_distance where id = v_drop_row.id;
        v_total_distance := v_total_distance + v_seg_distance;
        v_lat1 := v_lat2;
        v_lng1 := v_lng2;
      else
        v_can_calc_total := false;
        update public.delivery_request_drops set approx_distance_m = null where id = v_drop_row.id;
      end if;
    end loop;

    v_distance := case when v_can_calc_total then v_total_distance else null end;
    update public.delivery_requests
    set drops_count = v_drops_count
    where id = p_request_id;

    if v_request.fixed_price_ars is not null and v_request.fixed_price_ars < app_private.request_setting_int('min_offer_ars') then
      raise exception 'OFFER_BELOW_MINIMUM' using errcode = 'P0001';
    end if;
  end if;

  -- T-369 / CC-029: cargo de publicación. republish_request retira el cargo corriente (consumido → histórico;
  -- reservado de una vencida → liberado) y, con el piloto apagado, reserva uno nuevo en la misma transacción.
  if p_action = 'republish_request' then
    perform app_private.retire_publication_charge(p_request_id, v_uid);
  end if;
  if p_action in ('publish_request','republish_request') and not v_pilot_on then
    select count(*) into v_credit_drops from public.delivery_request_drops where request_id = p_request_id;
    perform app_private.reserve_publication(p_request_id, v_request.merchant_id, v_credit_drops, v_now);
  end if;

  if p_action in ('publish_request','republish_request','report_incident') then
    v_rate_action := case when p_action = 'report_incident' then 'report_incident' else 'publish_request' end;
    v_limit := app_private.request_setting_int(case when p_action = 'report_incident'
      then 'max_incidents_per_min' else 'max_request_publications_per_min' end);
    insert into public.rate_limits (subject, action, window_start, count)
      values (v_uid::text, v_rate_action, date_trunc('minute', v_now), 1)
      on conflict (subject, action, window_start) do update set count = public.rate_limits.count + 1
      returning count into v_count;
    if v_count > v_limit then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;
  end if;

  if p_action = 'report_incident' then
    insert into public.incidents (request_id, reporter_id, kind, description, status)
      values (p_request_id, v_uid, btrim(p_kind), btrim(p_description), 'open') returning id into v_incident;
    return jsonb_build_object('incidentId', v_incident, 'requestId', p_request_id, 'status', 'open', 'createdAt', v_now);
  elsif p_action = 'mark_picked_up' then
    update public.delivery_requests set status = 'in_transit', picked_up_at = v_now where id = p_request_id;
    return jsonb_build_object('requestId', p_request_id, 'status', 'in_transit', 'pickedUpAt', v_now);
  elsif p_action = 'mark_delivered' then
    update public.delivery_requests set status = 'delivered', delivered_at = v_now where id = p_request_id;
    update public.delivery_request_drops set status = 'delivered', delivered_at = v_now where request_id = p_request_id and position = 1;
    return jsonb_build_object('requestId', p_request_id, 'status', 'delivered', 'deliveredAt', v_now);
  end if;

  v_status := case when p_action = 'cancel_request' or (p_action = 'report_no_show' and not p_republish)
    then 'cancelled'::public.delivery_request_status else 'published'::public.delivery_request_status end;
  update public.offers set status = 'cancelled', decided_at = v_now
    where id = v_request.accepted_offer_id and request_id = p_request_id and status = 'accepted';
  update public.offers set status = 'expired', decided_at = v_now
    where request_id = p_request_id and status = 'pending';
  if p_action = 'report_no_show' or nullif(btrim(p_reason), '') is not null then
    insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason)
      values (p_request_id, v_request.accepted_offer_id, v_uid, p_action,
        case when p_action = 'report_no_show' then 'no_show' else btrim(p_reason) end);
  end if;
  update public.delivery_requests set status = v_status, accepted_offer_id = null,
    published_at = case when v_status = 'published' then v_now else published_at end,
    expires_at = v_expires,
    matched_at = case when v_status = 'published' then null else matched_at end,
    picked_up_at = case when v_status = 'published' then null else picked_up_at end,
    delivered_at = null,
    cancelled_at = case when v_status = 'cancelled' then v_now end,
    cancel_reason = case when p_action = 'report_no_show' then 'no_show' else nullif(btrim(p_reason), '') end,
    route_distance_m = case when p_action = 'publish_request' then v_distance else route_distance_m end
    where id = p_request_id;
  if v_status = 'published' then
    update public.delivery_requests set cancel_reason = null where id = p_request_id;
  end if;
  -- T-369 / CC-029: transiciones del cargo corriente (D4, D-C3).
  if p_action = 'cancel_request' and v_eff_status = 'published' then
    perform app_private.release_publication(p_request_id, v_uid, 'cancel_request');
  elsif p_action = 'report_no_show' and not p_republish then
    perform app_private.release_publication(p_request_id, v_uid, 'report_no_show');
  elsif p_action in ('report_no_show','courier_cancel_match') then
    perform app_private.unconsume_publication(p_request_id, v_uid, p_action);
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
    values (v_uid, p_action, 'delivery_request', p_request_id,
      jsonb_build_object('status', v_request.status, 'offerId', v_request.accepted_offer_id),
      jsonb_build_object('status', v_status));
  v_result := jsonb_build_object('requestId', p_request_id, 'status', v_status);
  if p_action = 'cancel_request' then
    return v_result || jsonb_build_object('cancelledAt', v_now);
  elsif p_action in ('report_no_show','courier_cancel_match') then
    return v_result || jsonb_build_object('cancelledOfferId', v_request.accepted_offer_id, 'expiresAt', v_expires);
  elsif p_action = 'publish_request' then
    return v_result || jsonb_build_object(
      'publishedAt', v_now,
      'expiresAt', v_expires,
      'routeDistanceM', v_distance,
      'fixedPriceArs', v_request.fixed_price_ars,
      'autoAssign', v_request.auto_assign,
      'dropsCount', v_drops_count
    );
  end if;
  return v_result || jsonb_build_object('publishedAt', v_now, 'expiresAt', v_expires);
end;
$$;

revoke all on function app_private.request_cycle(text,uuid,text,boolean,text,text) from public, anon, authenticated;


-- match_offer: base 20261007090000_t339_fixed_price.sql
create or replace function app_private.match_offer(
  p_request_id uuid,
  p_offer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.delivery_requests%rowtype;
  v_offer public.offers%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select *
  into v_req
  from public.delivery_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_offer.request_id <> p_request_id
     or v_offer.status <> 'pending'
     or v_req.status <> 'published'
     or v_req.accepted_offer_id is not null
  then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  update public.offers
  set status = 'accepted',
      decided_at = v_now,
      updated_at = v_now
  where id = p_offer_id;

  update public.delivery_requests
  set status = 'matched',
      accepted_offer_id = p_offer_id,
      matched_at = v_now,
      updated_at = v_now
  where id = p_request_id;

  update public.offers
  set status = 'rejected',
      decided_at = v_now,
      updated_at = v_now
  where request_id = p_request_id
    and id <> p_offer_id
    and status = 'pending';

  -- T-369 / CC-029: el match consume la reserva del cargo corriente (accept_offer y take_request con auto_assign).
  -- MUT1 perform app_private.consume_publication(p_request_id, auth.uid());
end;
$$;

revoke all on function app_private.match_offer(uuid, uuid) from public, anon, authenticated;


-- reconcile_expired_requests: base 20261015084902_cc026_reconcile_expired_requests.sql
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

  -- T-369 / CC-029: vencer sin match (aunque haya ofertas pendientes) libera la reserva al saldo.
  if v_expired_count > 0 then
    -- MUT2 perform app_private.release_publication(expired.id::uuid, auth.uid(), 'expired')
    -- from jsonb_array_elements_text(v_expired_request_ids) as expired(id);
  end if;

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


-- admin_update_setting: base 20261009200000_t340_multi_drop.sql
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

revoke all on function public.admin_update_setting(text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;


-- admin_set_subscription: base 20260924013700_rpc_admin_v1.sql
create or replace function public.admin_set_subscription(
  p_merchant_id uuid,
  p_subscription_status text,
  p_paid_until date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_status public.merchant_subscription_status;
  v_current_paid_until date;
  v_target_status public.merchant_subscription_status;
begin
  -- H14: autenticación, rol admin y MFA (aal2) en un solo lugar
  perform app_private.assert_admin_aal2();

  -- H03: Valores reales del enum merchant_subscription_status: pilot, active, expired, cancelled
  if p_subscription_status not in ('pilot', 'active', 'expired', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select subscription_status, paid_until into v_current_status, v_current_paid_until
  from public.merchants
  where profile_id = p_merchant_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  v_target_status := p_subscription_status::public.merchant_subscription_status;

  -- T-369 / CC-029 (2-A): el abono legacy no puede superponerse con un período de plan vigente o programado.
  if v_target_status in ('pilot', 'active') and p_paid_until is not null and exists (
    select 1
    from public.merchant_plan_periods as period
    where period.merchant_id = p_merchant_id
      and period.ends_at > now()
      and period.starts_at < (
        (p_paid_until + app_private.request_setting_int('subscription_grace_days') + 1)::timestamp
        at time zone 'America/Argentina/Buenos_Aires'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- H12: semántica elegida (igual que el fake de dominio): paid_until se REEMPLAZA
  -- siempre, así que omitirlo lo deja en null (p. ej. al pasar a expired/cancelled);
  -- notes solo se reemplaza si viene, para no perder el historial de notas.
  update public.merchants
  set
    subscription_status = v_target_status,
    paid_until = p_paid_until,
    notes = case when p_notes is not null then p_notes else notes end
  where profile_id = p_merchant_id;

  -- D02 / H10: Registrar evento en audit_log
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_set_subscription',
    'merchant',
    p_merchant_id::text,
    jsonb_build_object('subscription_status', v_current_status, 'paid_until', v_current_paid_until),
    jsonb_build_object('subscription_status', v_target_status, 'paid_until', p_paid_until, 'notes', p_notes)
  );

  return jsonb_build_object(
    'merchantId', p_merchant_id,
    'subscriptionStatus', v_target_status,
    'paidUntil', case when p_paid_until is not null then to_char(p_paid_until, 'YYYY-MM-DD') else null end
  );
end;
$$;

revoke all on function public.admin_set_subscription(uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.admin_set_subscription(uuid, text, date, text) to authenticated;


-- ============================================================================
-- RPC nuevas (CC-029 §RPC). Las de admin exigen app_private.assert_admin_aal2() primero.
-- ============================================================================

-- Catálogo de planes (D2). kind y monthly_credits no cambian si el plan ya tiene períodos.
create function public.admin_upsert_publication_plan(
  p_plan_id uuid,
  p_code text,
  p_name text,
  p_kind text,
  p_monthly_credits integer,
  p_reference_price_ars integer,
  p_active boolean,
  p_sort integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_plan public.publication_plans%rowtype;
  v_before jsonb;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
begin
  perform app_private.assert_admin_aal2();

  if v_code !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
     or length(v_name) not between 2 and 80
     or p_kind is null or p_kind not in ('quota', 'unlimited')
     or (p_kind = 'quota' and (p_monthly_credits is null or p_monthly_credits < 1 or p_monthly_credits > 100000))
     or (p_kind = 'unlimited' and p_monthly_credits is not null)
     or (p_reference_price_ars is not null and (p_reference_price_ars < 0 or p_reference_price_ars > 100000000))
     or p_active is null
     or p_sort is null or p_sort < 0 or p_sort > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_plan_id is null then
    if exists (select 1 from public.publication_plans where code = v_code) then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    insert into public.publication_plans (code, name, kind, monthly_credits, reference_price_ars, active, sort)
    values (v_code, v_name, p_kind, p_monthly_credits, p_reference_price_ars, p_active, p_sort)
    returning * into v_plan;
  else
    select * into v_plan from public.publication_plans where id = p_plan_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if exists (select 1 from public.publication_plans where code = v_code and id <> p_plan_id) then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    if (v_plan.kind <> p_kind or v_plan.monthly_credits is distinct from p_monthly_credits)
       and exists (select 1 from public.merchant_plan_periods where plan_id = p_plan_id) then
      raise exception using errcode = 'P0001', message = 'PLAN_IN_USE';
    end if;
    v_before := to_jsonb(v_plan) - 'created_at' - 'updated_at';
    update public.publication_plans
    set code = v_code, name = v_name, kind = p_kind, monthly_credits = p_monthly_credits,
        reference_price_ars = p_reference_price_ars, active = p_active, sort = p_sort, updated_at = now()
    where id = p_plan_id
    returning * into v_plan;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id, 'admin_upsert_publication_plan', 'publication_plan', v_plan.id::text,
    v_before, to_jsonb(v_plan) - 'created_at' - 'updated_at'
  );

  return jsonb_build_object(
    'planId', v_plan.id, 'code', v_plan.code, 'name', v_plan.name, 'kind', v_plan.kind,
    'monthlyCredits', v_plan.monthly_credits, 'referencePriceArs', v_plan.reference_price_ars,
    'active', v_plan.active, 'sort', v_plan.sort
  );
end;
$$;

-- Créditos sueltos (no vencen). source = purchase (compra confirmada fuera de la app) o adjustment (ajuste/cortesía).
create function public.admin_grant_publication_credits(
  p_merchant_id uuid,
  p_credits integer,
  p_source text,
  p_operation_key uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_lot public.publication_credit_lots%rowtype;
  v_pct integer;
  v_discount integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  -- MUT3 perform app_private.assert_admin_aal2();

  if p_merchant_id is null or p_operation_key is null
     or p_credits is null or p_credits < 1 or p_credits > 10000
     or p_source is null or p_source not in ('purchase', 'adjustment')
     or (v_note is not null and length(v_note) > 500) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  perform 1 from public.merchants where profile_id = p_merchant_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_lot from public.publication_credit_lots where operation_key = p_operation_key;
  if found then
    if v_lot.merchant_id <> p_merchant_id or v_lot.granted <> p_credits or v_lot.source <> p_source then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select pct into v_discount from public.merchant_launch_discounts where lot_id = v_lot.id;
    return jsonb_build_object(
      'lotId', v_lot.id, 'merchantId', v_lot.merchant_id, 'credits', v_lot.granted, 'source', v_lot.source,
      'launchDiscountPct', v_discount, 'idempotent', true
    );
  end if;

  insert into public.publication_credit_lots (merchant_id, kind, granted, source, operation_key, note, actor_id)
  values (p_merchant_id, 'loose', p_credits, p_source, p_operation_key, v_note, v_actor_id)
  returning * into v_lot;
  insert into public.publication_credit_movements (merchant_id, lot_id, kind, amount, actor_id, reason)
  values (p_merchant_id, v_lot.id, 'grant', p_credits, v_actor_id, p_source);

  -- D6: primera compra con descuento de lanzamiento vigente (> 0); un ajuste no consume el beneficio.
  v_discount := null;
  if p_source = 'purchase' then
    v_pct := app_private.publication_setting_int('launch_discount_pct', 0);
    if v_pct > 100 then
      raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
    end if;
    if v_pct > 0 then
      insert into public.merchant_launch_discounts (merchant_id, pct, lot_id)
      values (p_merchant_id, v_pct, v_lot.id)
      on conflict (merchant_id) do nothing;
      if found then
        v_discount := v_pct;
      end if;
    end if;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id, 'admin_grant_publication_credits', 'merchant', p_merchant_id::text, null,
    jsonb_build_object('lotId', v_lot.id, 'credits', p_credits, 'source', p_source, 'launchDiscountPct', v_discount)
  );

  return jsonb_build_object(
    'lotId', v_lot.id, 'merchantId', p_merchant_id, 'credits', p_credits, 'source', p_source,
    'launchDiscountPct', v_discount, 'idempotent', false
  );
end;
$$;

-- Período de plan (alta o renovación). Bloquea el comercio antes de calcular fechas, racha y derechos legacy.
create function public.admin_register_plan_period(
  p_merchant_id uuid,
  p_plan_id uuid,
  p_is_purchase boolean,
  p_operation_key uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := now();
  v_plan public.publication_plans%rowtype;
  v_period public.merchant_plan_periods%rowtype;
  v_last public.merchant_plan_periods%rowtype;
  v_grace integer;
  v_legacy_end timestamptz;
  v_starts timestamptz;
  v_streak integer;
  v_previous uuid;
  v_carry_pct integer := 0;
  v_base integer;
  v_step integer;
  v_cap integer;
  v_pct integer;
  v_discount integer;
  v_lot_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform app_private.assert_admin_aal2();

  if p_merchant_id is null or p_plan_id is null or p_is_purchase is null or p_operation_key is null
     or (v_note is not null and length(v_note) > 500) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  perform 1 from public.merchants where profile_id = p_merchant_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select * into v_period from public.merchant_plan_periods where operation_key = p_operation_key;
  if found then
    if v_period.merchant_id <> p_merchant_id or v_period.plan_id <> p_plan_id or v_period.is_purchase <> p_is_purchase then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'periodId', v_period.id, 'merchantId', v_period.merchant_id, 'planId', v_period.plan_id,
      'startsAt', app_private.publication_iso(v_period.starts_at), 'endsAt', app_private.publication_iso(v_period.ends_at),
      'streak', v_period.streak, 'carryoverPct', v_period.carryover_pct,
      'launchDiscountPct', v_period.launch_discount_pct, 'idempotent', true
    );
  end if;

  select * into v_plan from public.publication_plans where id = p_plan_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if not v_plan.active then
    raise exception using errcode = 'P0001', message = 'PLAN_INACTIVE';
  end if;

  v_grace := app_private.request_setting_int('subscription_grace_days');
  select * into v_last from public.merchant_plan_periods
  where merchant_id = p_merchant_id
  order by ends_at desc
  limit 1;

  if found and v_last.ends_at > v_now then
    -- Renovación anticipada: empieza al terminar el período vigente o programado (D-C6).
    v_starts := v_last.ends_at;
    v_streak := v_last.streak + 1;
    v_previous := v_last.id;
  elsif found and v_now <= v_last.ends_at + make_interval(days => v_grace) then
    -- 1-A: renovación tardía dentro de la gracia conserva la racha pero empieza al registrarse.
    v_starts := v_now;
    v_streak := v_last.streak + 1;
    v_previous := v_last.id;
  else
    -- Primer plan o corte: racha 1. 2-A: con abono legacy vigente, empieza después de su fin efectivo.
    v_legacy_end := app_private.publication_legacy_end(p_merchant_id);
    v_starts := greatest(v_now, coalesce(v_legacy_end, v_now));
    v_streak := 1;
    v_previous := null;
  end if;

  if v_streak >= 2 then
    v_base := app_private.publication_setting_int('carryover_base_pct', 5);
    v_step := app_private.publication_setting_int('carryover_step_pct', 5);
    v_cap := app_private.publication_setting_int('carryover_cap_pct', 35);
    if v_base > 100 or v_step > 100 or v_cap > 100 then
      raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
    end if;
    v_carry_pct := least(v_base + v_step * (v_streak - 2), v_cap);
  end if;

  insert into public.merchant_plan_periods (
    merchant_id, plan_id, plan_kind, monthly_credits, reference_price_ars, starts_at, ends_at, streak,
    carryover_pct, previous_period_id, operation_key, is_purchase, note, actor_id
  ) values (
    p_merchant_id, v_plan.id, v_plan.kind, v_plan.monthly_credits, v_plan.reference_price_ars, v_starts,
    ((v_starts at time zone 'America/Argentina/Buenos_Aires') + interval '1 month') at time zone 'America/Argentina/Buenos_Aires',
    v_streak, v_carry_pct, v_previous, p_operation_key, p_is_purchase, v_note, v_actor_id
  )
  returning * into v_period;

  if v_plan.kind = 'quota' then
    insert into public.publication_credit_lots (merchant_id, kind, period_id, granted, expires_at, source, actor_id)
    values (p_merchant_id, 'plan', v_period.id, v_plan.monthly_credits, v_period.ends_at, 'plan', v_actor_id)
    returning id into v_lot_id;
    insert into public.publication_credit_movements (merchant_id, lot_id, kind, amount, actor_id, reason)
    values (p_merchant_id, v_lot_id, 'grant', v_plan.monthly_credits, v_actor_id, 'plan');
  end if;

  v_discount := null;
  if p_is_purchase then
    v_pct := app_private.publication_setting_int('launch_discount_pct', 0);
    if v_pct > 100 then
      raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
    end if;
    if v_pct > 0 then
      insert into public.merchant_launch_discounts (merchant_id, pct, period_id)
      values (p_merchant_id, v_pct, v_period.id)
      on conflict (merchant_id) do nothing;
      if found then
        v_discount := v_pct;
        update public.merchant_plan_periods set launch_discount_pct = v_pct where id = v_period.id;
      end if;
    end if;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id, 'admin_register_plan_period', 'merchant', p_merchant_id::text, null,
    jsonb_build_object(
      'periodId', v_period.id, 'planId', v_plan.id, 'startsAt', v_period.starts_at, 'endsAt', v_period.ends_at,
      'streak', v_streak, 'carryoverPct', v_carry_pct, 'isPurchase', p_is_purchase, 'launchDiscountPct', v_discount
    )
  );

  return jsonb_build_object(
    'periodId', v_period.id, 'merchantId', p_merchant_id, 'planId', v_plan.id,
    'startsAt', app_private.publication_iso(v_period.starts_at), 'endsAt', app_private.publication_iso(v_period.ends_at),
    'streak', v_streak, 'carryoverPct', v_carry_pct, 'launchDiscountPct', v_discount, 'idempotent', false
  );
end;
$$;

-- Lectura admin: saldo, plan y libro paginado (máximo 50 por página, cursor por id descendente).
create function public.admin_get_merchant_publication_credits(
  p_merchant_id uuid,
  p_limit integer default 50,
  p_before_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movements jsonb;
  v_count integer;
  v_last_id bigint;
begin
  perform app_private.assert_admin_aal2();

  if p_merchant_id is null or p_limit is null or p_limit < 1 or p_limit > 50
     or (p_before_id is not null and p_before_id < 1) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  if not exists (select 1 from public.merchants where profile_id = p_merchant_id) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  perform app_private.reconcile_expired_requests(p_merchant_id, 200, now());

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'kind', m.kind, 'amount', m.amount, 'lotId', m.lot_id, 'chargeId', m.charge_id,
      'requestId', m.request_id, 'actorId', m.actor_id, 'reason', m.reason,
      'createdAt', app_private.publication_iso(m.created_at)
    ) order by m.id desc), '[]'::jsonb),
    count(*)::integer,
    min(m.id)
  into v_movements, v_count, v_last_id
  from (
    select * from public.publication_credit_movements
    where merchant_id = p_merchant_id and (p_before_id is null or id < p_before_id)
    order by id desc
    limit p_limit
  ) as m;

  return jsonb_build_object(
    'balance', app_private.publication_balance(p_merchant_id, now()),
    'movements', v_movements,
    'nextCursor', case when v_count = p_limit then v_last_id else null end
  );
end;
$$;

-- Lectura del comercio dueño (consentimiento activo). Reconcilia antes sus vencidas (CC-026).
create function public.get_my_publication_balance()
returns jsonb
language plpgsql
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
  if v_role is distinct from 'merchant' or v_consent is distinct from 'active'
     or not exists (select 1 from public.merchants where profile_id = v_uid) then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  perform app_private.reconcile_expired_requests(v_uid, 200, now());
  return app_private.publication_balance(v_uid, now());
end;
$$;

revoke all on function public.admin_upsert_publication_plan(uuid, text, text, text, integer, integer, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.admin_upsert_publication_plan(uuid, text, text, text, integer, integer, boolean, integer)
  to authenticated;
revoke all on function public.admin_grant_publication_credits(uuid, integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_grant_publication_credits(uuid, integer, text, uuid, text) to authenticated;
revoke all on function public.admin_register_plan_period(uuid, uuid, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_register_plan_period(uuid, uuid, boolean, uuid, text) to authenticated;
revoke all on function public.admin_get_merchant_publication_credits(uuid, integer, bigint) from public, anon, authenticated;
grant execute on function public.admin_get_merchant_publication_credits(uuid, integer, bigint) to authenticated;
revoke all on function public.get_my_publication_balance() from public, anon, authenticated;
grant execute on function public.get_my_publication_balance() to authenticated;
