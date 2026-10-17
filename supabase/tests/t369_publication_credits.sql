begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- ============================================================================
-- T-369 / CC-029 — créditos de publicación y planes post-piloto
-- ============================================================================

create function pg_temp.id(p_suffix text) returns uuid language sql immutable as $$
  select ('36900000-0000-4000-8000-' || lpad(p_suffix, 12, '0'))::uuid;
$$;

-- Comercios por escenario (aislados entre sí)
create function pg_temp.m_block() returns uuid language sql immutable as $$ select pg_temp.id('101') $$;   -- sin saldo
create function pg_temp.m_cost() returns uuid language sql immutable as $$ select pg_temp.id('102') $$;    -- costo híbrido
create function pg_temp.m_flow() returns uuid language sql immutable as $$ select pg_temp.id('103') $$;    -- transiciones
create function pg_temp.m_prio() returns uuid language sql immutable as $$ select pg_temp.id('104') $$;    -- prioridad
create function pg_temp.m_unl() returns uuid language sql immutable as $$ select pg_temp.id('105') $$;     -- ilimitado
create function pg_temp.m_legacy() returns uuid language sql immutable as $$ select pg_temp.id('106') $$;  -- legacy_paid
create function pg_temp.m_cancel() returns uuid language sql immutable as $$ select pg_temp.id('107') $$;  -- cancelled
create function pg_temp.m_fidel() returns uuid language sql immutable as $$ select pg_temp.id('108') $$;   -- fidelidad
create function pg_temp.m_break() returns uuid language sql immutable as $$ select pg_temp.id('109') $$;   -- corte de racha
create function pg_temp.m_pilot() returns uuid language sql immutable as $$ select pg_temp.id('110') $$;   -- piloto
create function pg_temp.m_disc() returns uuid language sql immutable as $$ select pg_temp.id('111') $$;    -- descuento
create function pg_temp.m_seq() returns uuid language sql immutable as $$ select pg_temp.id('112') $$;     -- secuencia sin saldo
create function pg_temp.courier1() returns uuid language sql immutable as $$ select pg_temp.id('201') $$;
create function pg_temp.courier2() returns uuid language sql immutable as $$ select pg_temp.id('202') $$;
create function pg_temp.admin() returns uuid language sql immutable as $$ select pg_temp.id('301') $$;
create function pg_temp.zone() returns uuid language sql immutable as $$ select pg_temp.id('401') $$;

-- Ejecuta p_sql como authenticated con el actor y AAL dados. Devuelve {data} o {error, sqlstate}.
create function pg_temp.rpc(p_actor uuid, p_aal text, p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  if p_actor is null then
    perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  else
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', p_aal)::text,
      true
    );
  end if;
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

create function pg_temp.err(p_result jsonb) returns text language sql immutable as $$
  select p_result->>'error';
$$;

-- Payload del writer atómico con N entregas
create function pg_temp.payload(p_request_id uuid, p_drops integer, p_fixed integer default null, p_auto boolean default false)
returns jsonb language sql as $$
  select jsonb_build_object(
    'requestId', p_request_id,
    'pickupZoneId', pg_temp.zone(),
    'pickupAddress', 'Av Mitre 369',
    'pickupLat', -27.4330,
    'pickupLng', -65.6150,
    'fixedPriceArs', p_fixed,
    'autoAssign', p_auto,
    'drops', (
      select jsonb_agg(jsonb_build_object(
        'dropoffZoneId', pg_temp.zone(),
        'dropoffAddress', 'Alberdi ' || position,
        'dropoffLat', -27.4250,
        'dropoffLng', -65.6080,
        'recipientName', 'Destinatario ' || position,
        'recipientPhone', '3865369' || lpad(position::text, 3, '0'),
        'recipientConsentDeclared', true,
        'packageType', 'chico',
        'recipientPaymentMethod', 'transfer',
        'needsChange', false,
        'cashChangeAmount', null,
        'notes', null
      ) order by position)
      from generate_series(1, p_drops) as positions(position)
    )
  );
$$;

create function pg_temp.publish(p_merchant uuid, p_request_id uuid, p_drops integer, p_fixed integer default null, p_auto boolean default false)
returns jsonb language sql as $$
  select pg_temp.rpc(
    p_merchant, 'aal1',
    format('select public.create_and_publish_multi_drop(%L::jsonb)', pg_temp.payload(p_request_id, p_drops, p_fixed, p_auto))
  );
$$;

create function pg_temp.offer(p_courier uuid, p_request_id uuid) returns uuid language plpgsql as $$
declare
  v_result jsonb;
begin
  v_result := pg_temp.rpc(
    p_courier, 'aal1',
    format('select public.submit_offer(%L::uuid, 1500, 15, null)', p_request_id)
  );
  if v_result ? 'error' then
    raise exception 'offer failed: %', v_result->>'error';
  end if;
  return (v_result->'data'->>'offerId')::uuid;
end;
$$;

create function pg_temp.accept(p_merchant uuid, p_offer_id uuid) returns jsonb language sql as $$
  select pg_temp.rpc(p_merchant, 'aal1', format('select public.accept_offer(%L::uuid)::jsonb', p_offer_id));
$$;

create function pg_temp.match(p_merchant uuid, p_courier uuid, p_request_id uuid) returns jsonb language sql as $$
  select pg_temp.accept(p_merchant, pg_temp.offer(p_courier, p_request_id));
$$;

create function pg_temp.grant_loose(p_merchant uuid, p_credits integer, p_source text, p_key uuid) returns jsonb language sql as $$
  select pg_temp.rpc(
    pg_temp.admin(), 'aal2',
    format('select public.admin_grant_publication_credits(%L::uuid, %s, %L, %L::uuid, null)', p_merchant, p_credits, p_source, p_key)
  );
$$;

create function pg_temp.register(p_merchant uuid, p_plan uuid, p_purchase boolean, p_key uuid) returns jsonb language sql as $$
  select pg_temp.rpc(
    pg_temp.admin(), 'aal2',
    format('select public.admin_register_plan_period(%L::uuid, %L::uuid, %L::boolean, %L::uuid, null)', p_merchant, p_plan, p_purchase, p_key)
  );
$$;

create function pg_temp.available(p_merchant uuid) returns integer language sql as $$
  select coalesce(sum(u.available), 0)::integer from app_private.publication_usable_lots(p_merchant, now()) as u;
$$;

create function pg_temp.current_charge(p_request_id uuid) returns public.publication_charges language sql as $$
  select * from public.publication_charges where request_id = p_request_id and is_current;
$$;

create function pg_temp.charge_count(p_request_id uuid) returns integer language sql as $$
  select count(*)::integer from public.publication_charges where request_id = p_request_id;
$$;

-- Invariante del libro (CC-029 prueba 11): por lote, lo retenido derivado de los cargos coincide con el reconstruido
-- desde los movimientos (reserve − release), y nunca supera lo acreditado.
create function pg_temp.ledger_consistent() returns boolean language sql as $$
  select not exists (
    select 1
    from public.publication_credit_lots l
    where l.merchant_id::text like '36900000-%'
      and (
        app_private.publication_lot_used(l.id) <> coalesce((
          select sum(case m.kind when 'reserve' then m.amount when 'release' then -m.amount else 0 end)
          from public.publication_credit_movements m
          where m.lot_id = l.id
        ), 0)
        or app_private.publication_lot_used(l.id) > l.granted
        or l.granted <> coalesce((
          select sum(m.amount) from public.publication_credit_movements m
          where m.lot_id = l.id and m.kind in ('grant', 'convert')
        ), 0)
      )
  );
$$;

-- Corre el tiempo hacia atrás para un comercio (períodos, lotes y movimientos). Solo fixture de prueba: deshabilita
-- el trigger de inmutabilidad dentro de esta transacción, que se revierte al final.
create function pg_temp.shift_back(p_merchant uuid, p_interval interval) returns void language plpgsql as $$
begin
  alter table public.publication_credit_movements disable trigger publication_credit_movements_immutable;
  update public.merchant_plan_periods
  set starts_at = starts_at - p_interval, ends_at = ends_at - p_interval
  where merchant_id = p_merchant;
  update public.publication_credit_lots
  set expires_at = expires_at - p_interval, created_at = created_at - p_interval
  where merchant_id = p_merchant;
  update public.publication_credit_movements
  set created_at = created_at - p_interval
  where merchant_id = p_merchant;
  alter table public.publication_credit_movements enable trigger publication_credit_movements_immutable;
end;
$$;

-- ---------------------------------------------------------------------------
-- Datos
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
select ids.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  't369.' || ids.label || '@example.test', 'pwd', jsonb_build_object('role', ids.role)
from (values
  (pg_temp.m_block(), 'block', 'merchant'), (pg_temp.m_cost(), 'cost', 'merchant'),
  (pg_temp.m_flow(), 'flow', 'merchant'), (pg_temp.m_prio(), 'prio', 'merchant'),
  (pg_temp.m_unl(), 'unl', 'merchant'), (pg_temp.m_legacy(), 'legacy', 'merchant'),
  (pg_temp.m_cancel(), 'cancel', 'merchant'), (pg_temp.m_fidel(), 'fidel', 'merchant'),
  (pg_temp.m_break(), 'break', 'merchant'), (pg_temp.m_pilot(), 'pilot', 'merchant'),
  (pg_temp.m_disc(), 'disc', 'merchant'), (pg_temp.m_seq(), 'seq', 'merchant'),
  (pg_temp.courier1(), 'courier1', 'courier'), (pg_temp.courier2(), 'courier2', 'courier'),
  (pg_temp.admin(), 'admin', 'merchant')
) as ids(id, label, role)
on conflict (id) do nothing;

update public.profiles set consent_status = 'active' where id::text like '36900000-%';
update public.profiles set role = 'admin' where id = pg_temp.admin();
insert into public.merchants (profile_id, business_name, subscription_status)
select p.id, 'Comercio T369 ' || right(p.id::text, 3), 'pilot'
from public.profiles p
where p.id::text like '36900000-%' and p.role = 'merchant'
on conflict (profile_id) do update set subscription_status = 'pilot', paid_until = null;
update public.couriers set status = 'approved', available = true
where profile_id in (pg_temp.courier1(), pg_temp.courier2());
insert into public.zones (id, name, active, centroid_lat, centroid_lng)
values (pg_temp.zone(), 'Zona T369', true, -27.4300, -65.6100)
on conflict (id) do nothing;

update public.platform_settings set value = '1000'::jsonb where key in ('max_request_publications_per_min', 'max_offers_per_min');
update public.platform_settings set value = '3'::jsonb where key = 'subscription_grace_days';
update public.platform_settings set value = '1000'::jsonb where key = 'min_offer_ars';

-- Catálogo de prueba (como admin con AAL2)
create function pg_temp.plan(p_code text, p_kind text, p_credits integer) returns uuid language plpgsql as $$
declare
  v_result jsonb;
begin
  v_result := pg_temp.rpc(
    pg_temp.admin(), 'aal2',
    format(
      'select public.admin_upsert_publication_plan(null, %L, %L, %L, %s, 10000, true, 1)',
      p_code, 'Plan ' || p_code, p_kind, coalesce(p_credits::text, 'null')
    )
  );
  if v_result ? 'error' then
    raise exception 'plan failed: %', v_result->>'error';
  end if;
  return (v_result->'data'->>'planId')::uuid;
end;
$$;

-- ============================================================================
-- 1. Estructura, RLS, grants y helpers
-- ============================================================================
select has_table('public', t, 'existe ' || t)
from unnest(array[
  'publication_plans', 'merchant_plan_periods', 'publication_credit_lots', 'publication_charges',
  'publication_charge_lots', 'publication_credit_movements', 'merchant_launch_discounts'
]) as t;

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'publication_plans', 'merchant_plan_periods', 'publication_credit_lots', 'publication_charges',
     'publication_charge_lots', 'publication_credit_movements', 'merchant_launch_discounts')),
  'las siete tablas nuevas tienen RLS habilitada'
);

select ok(
  not exists (
    select 1 from unnest(array[
      'publication_plans', 'merchant_plan_periods', 'publication_credit_lots', 'publication_charges',
      'publication_charge_lots', 'publication_credit_movements', 'merchant_launch_discounts'
    ]) as t, unnest(array['select', 'insert', 'update', 'delete']) as priv, unnest(array['anon', 'authenticated']) as r
    where has_table_privilege(r, 'public.' || t, priv)
  ),
  'anon y authenticated no tienen select/insert/update/delete en las tablas nuevas'
);

select ok(
  not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname in (
      'publication_plans', 'merchant_plan_periods', 'publication_credit_lots', 'publication_charges',
      'publication_charge_lots', 'publication_credit_movements', 'merchant_launch_discounts')
      and (p.polpermissive or pg_get_expr(p.polqual, p.polrelid) <> 'false')
  ),
  'las únicas policies de las tablas nuevas son restrictivas de denegación total'
);

select ok(
  not exists (
    select 1 from unnest(array[
      'app_private.publication_setting_int(text,integer)',
      'app_private.publication_cost(integer)',
      'app_private.publication_legacy_end(uuid)',
      'app_private.publication_lot_used(uuid)',
      'app_private.publication_lot_unused_as_of(uuid,timestamp with time zone)',
      'app_private.publication_usable_lots(uuid,timestamp with time zone)',
      'app_private.materialize_carryover(uuid,timestamp with time zone)',
      'app_private.reserve_publication(uuid,uuid,integer,timestamp with time zone)',
      'app_private.consume_publication(uuid,uuid)',
      'app_private.unconsume_publication(uuid,uuid,text)',
      'app_private.release_publication(uuid,uuid,text)',
      'app_private.retire_publication_charge(uuid,uuid)',
      'app_private.publication_balance(uuid,timestamp with time zone)'
    ]) as fn, unnest(array['anon', 'authenticated']) as r
    where has_function_privilege(r, fn, 'execute')
  ),
  'los clientes no pueden ejecutar los helpers app_private de créditos'
);

select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=public, pg_temp'])
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'admin_upsert_publication_plan', 'admin_grant_publication_credits', 'admin_register_plan_period',
     'admin_get_merchant_publication_credits', 'get_my_publication_balance')),
  'las RPC nuevas son SECURITY DEFINER con search_path fijo'
);

select ok(
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'admin_upsert_publication_plan', 'admin_grant_publication_credits', 'admin_register_plan_period',
     'admin_get_merchant_publication_credits', 'get_my_publication_balance')),
  'las RPC nuevas solo se ejecutan como authenticated'
);

select is(
  (select value from public.platform_settings where key = 'publication_drops_per_credit'),
  '2'::jsonb,
  'publication_drops_per_credit arranca en 2'
);
select is(
  (select jsonb_object_agg(key, value) from public.platform_settings
   where key in ('carryover_base_pct', 'carryover_step_pct', 'carryover_cap_pct', 'launch_discount_pct')),
  '{"carryover_base_pct": 5, "carryover_step_pct": 5, "carryover_cap_pct": 35, "launch_discount_pct": 0}'::jsonb,
  'parámetros de fidelidad y descuento con sus valores iniciales'
);

-- Catálogo base
create temp table plans as
select
  pg_temp.plan('t369-quota-40', 'quota', 40) as quota40,
  pg_temp.plan('t369-quota-5', 'quota', 5) as quota5,
  pg_temp.plan('t369-unlimited', 'unlimited', null) as unlimited;
select ok((select quota40 is not null and quota5 is not null and unlimited is not null from plans), 'el admin crea el catálogo de prueba');

-- ============================================================================
-- 2. Piloto encendido: comportamiento actual, sin cargos (prueba 1)
-- ============================================================================
update public.platform_settings set value = 'true'::jsonb where key = 'pilot_active';

select is(pg_temp.err(pg_temp.publish(pg_temp.m_pilot(), pg_temp.id('5001'), 1)), null, 'piloto: un comercio pilot publica');
select is(pg_temp.charge_count(pg_temp.id('5001')), 0, 'piloto: publicar no crea cargo');
select is(pg_temp.err(pg_temp.match(pg_temp.m_pilot(), pg_temp.courier1(), pg_temp.id('5001'))), null, 'piloto: match sin cargo');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_pilot(), 'aal1', format('select public.report_no_show(%L::uuid, true)', pg_temp.id('5001')))),
  null,
  'piloto: report_no_show con republicación funciona como antes'
);
select is(pg_temp.charge_count(pg_temp.id('5001')), 0, 'piloto: no_show con republicación no crea cargo');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_pilot(), 'aal1', format('select public.cancel_request(%L::uuid, null)', pg_temp.id('5001')))),
  null,
  'piloto: cancelar antes del match funciona como antes'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_pilot(), 'aal1', format('select public.republish_request(%L::uuid, null)', pg_temp.id('5001')))),
  null,
  'piloto: republicar una cancelada funciona como antes'
);
select is(pg_temp.charge_count(pg_temp.id('5001')), 0, 'piloto: republicar no crea cargo');

update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.m_pilot();
select is(
  pg_temp.err(pg_temp.publish(pg_temp.m_pilot(), pg_temp.id('5002'), 1)),
  'SUBSCRIPTION_INACTIVE',
  'piloto: un comercio expired sigue recibiendo SUBSCRIPTION_INACTIVE'
);
update public.merchants set subscription_status = 'cancelled' where profile_id = pg_temp.m_pilot();
select is(
  pg_temp.err(pg_temp.publish(pg_temp.m_pilot(), pg_temp.id('5003'), 1)),
  'SUBSCRIPTION_INACTIVE',
  'piloto: un comercio cancelled sigue recibiendo SUBSCRIPTION_INACTIVE'
);
select is(
  (select count(*)::integer from public.publication_charges where merchant_id = pg_temp.m_pilot()),
  0,
  'piloto: ningún cargo para el comercio del piloto'
);

-- ============================================================================
-- 3. Piloto apagado: bloqueo sin derecho (prueba 4)
-- ============================================================================
update public.platform_settings set value = 'false'::jsonb where key = 'pilot_active';

select is(
  pg_temp.err(pg_temp.publish(pg_temp.m_block(), pg_temp.id('5101'), 1)),
  'PUBLICATION_CREDITS_EXHAUSTED',
  'sin créditos ni plan, publicar falla con PUBLICATION_CREDITS_EXHAUSTED'
);
select is(
  (select count(*)::integer from public.delivery_requests where id = pg_temp.id('5101')),
  0,
  'la solicitud rechazada no queda creada ni publicada (writer atómico)'
);
update public.merchants set subscription_status = 'cancelled' where profile_id = pg_temp.m_cancel();
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_cancel(), 5, 'adjustment', pg_temp.id('6101'))), null, 'se pueden acreditar créditos a un cancelled');
select is(
  pg_temp.err(pg_temp.publish(pg_temp.m_cancel(), pg_temp.id('5102'), 1)),
  'SUBSCRIPTION_INACTIVE',
  'un comercio cancelled no publica aunque tenga créditos'
);

-- ============================================================================
-- 4. Acreditación de sueltos: permisos, idempotencia y auditoría (pruebas 7, 8, 10)
-- ============================================================================
select is(
  pg_temp.err(pg_temp.rpc(null, 'aal1', format('select public.admin_grant_publication_credits(%L::uuid, 5, %L, %L::uuid, null)', pg_temp.m_flow(), 'purchase', pg_temp.id('6201')))),
  'UNAUTHENTICATED',
  'sin sesión: UNAUTHENTICATED'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal2', format('select public.admin_grant_publication_credits(%L::uuid, 5, %L, %L::uuid, null)', pg_temp.m_flow(), 'purchase', pg_temp.id('6201')))),
  'UNAUTHORIZED_ACTOR',
  'un comercio no puede acreditarse créditos'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal2', format('select public.admin_grant_publication_credits(%L::uuid, 5, %L, %L::uuid, null)', pg_temp.m_cost(), 'purchase', pg_temp.id('6201')))),
  'UNAUTHORIZED_ACTOR',
  'un comercio no puede acreditar créditos a otro'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal1', format('select public.admin_grant_publication_credits(%L::uuid, 5, %L, %L::uuid, null)', pg_temp.m_flow(), 'purchase', pg_temp.id('6201')))),
  'AAL2_REQUIRED',
  'un admin sin AAL2 no acredita'
);
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_flow(), 0, 'purchase', pg_temp.id('6201'))), 'VALIDATION_ERROR', 'créditos < 1: VALIDATION_ERROR');
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_flow(), 5, 'gift', pg_temp.id('6201'))), 'VALIDATION_ERROR', 'source desconocida: VALIDATION_ERROR');
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.id('999'), 5, 'purchase', pg_temp.id('6201'))), 'NOT_FOUND', 'comercio inexistente: NOT_FOUND');

select is(
  (pg_temp.grant_loose(pg_temp.m_flow(), 20, 'adjustment', pg_temp.id('6201'))->'data'->>'idempotent')::boolean,
  false,
  'la primera acreditación no es idempotente'
);
select is(
  (pg_temp.grant_loose(pg_temp.m_flow(), 20, 'adjustment', pg_temp.id('6201'))->'data'->>'idempotent')::boolean,
  true,
  'el reintento con la misma clave devuelve idempotent=true'
);
select is(
  (select count(*)::integer from public.publication_credit_lots where operation_key = pg_temp.id('6201')),
  1,
  'el reintento no crea un segundo lote'
);
select is(
  pg_temp.err(pg_temp.grant_loose(pg_temp.m_flow(), 21, 'adjustment', pg_temp.id('6201'))),
  'IDEMPOTENCY_CONFLICT',
  'la misma clave con otros datos da IDEMPOTENCY_CONFLICT'
);
select is(
  (select count(*)::integer from public.audit_log where action = 'admin_grant_publication_credits' and target_id = pg_temp.m_flow()::text and actor_id = pg_temp.admin()),
  1,
  'la acreditación queda en audit_log con su actor, una sola vez'
);
select is(
  (select count(*)::integer from public.publication_credit_movements m
   join public.publication_credit_lots l on l.id = m.lot_id
   where l.operation_key = pg_temp.id('6201') and m.kind = 'grant' and m.amount = 20 and m.actor_id = pg_temp.admin()),
  1,
  'la acreditación queda en el libro con su actor'
);
select is(pg_temp.available(pg_temp.m_flow()), 20, 'el comercio tiene 20 créditos sueltos disponibles');

-- Acceso directo bloqueado
select is(
  (pg_temp.rpc(pg_temp.m_flow(), 'aal1', format(
    'insert into public.publication_credit_lots (merchant_id, kind, granted, source) values (%L::uuid, %L, 100, %L) returning 1',
    pg_temp.m_flow(), 'loose', 'purchase')))->>'sqlstate',
  '42501',
  'un comercio no puede insertar lotes directamente'
);
select is(
  (pg_temp.rpc(pg_temp.m_flow(), 'aal1', 'update public.publication_charges set state = ''released'' returning 1'))->>'sqlstate',
  '42501',
  'un comercio no puede modificar cargos directamente'
);
select is(
  (pg_temp.rpc(pg_temp.m_flow(), 'aal1', 'delete from public.publication_credit_movements returning 1'))->>'sqlstate',
  '42501',
  'un comercio no puede borrar movimientos'
);
select is(
  (pg_temp.rpc(pg_temp.m_flow(), 'aal1', 'select count(*)::int from public.publication_credit_lots'))->>'sqlstate',
  '42501',
  'un comercio no puede leer lotes directamente'
);
select throws_ok(
  'update public.publication_credit_movements set amount = amount + 1',
  'P0001'::char(5),
  'INTERNAL_ERROR'::text,
  'el libro de movimientos no admite update ni siquiera para el dueño de la base'
);

-- ============================================================================
-- 5. Descuento de lanzamiento (prueba 7)
-- ============================================================================
update public.platform_settings set value = '20'::jsonb where key = 'launch_discount_pct';
select is(
  (pg_temp.grant_loose(pg_temp.m_disc(), 3, 'adjustment', pg_temp.id('6301'))->'data'->>'launchDiscountPct'),
  null,
  'un ajuste no aplica el descuento'
);
select is(
  (select count(*)::integer from public.merchant_launch_discounts where merchant_id = pg_temp.m_disc()),
  0,
  'un ajuste no consume el beneficio'
);
select is(
  (pg_temp.register(pg_temp.m_disc(), (select quota5 from plans), false, pg_temp.id('6302'))->'data'->>'launchDiscountPct'),
  null,
  'un período de cortesía no aplica el descuento'
);
select is(
  (pg_temp.grant_loose(pg_temp.m_disc(), 10, 'purchase', pg_temp.id('6303'))->'data'->>'launchDiscountPct')::integer,
  20,
  'la primera compra registra el descuento vigente'
);
select is(
  (pg_temp.grant_loose(pg_temp.m_disc(), 10, 'purchase', pg_temp.id('6303'))->'data'->>'launchDiscountPct')::integer,
  20,
  'el reintento idempotente devuelve el mismo descuento'
);
select is(
  (pg_temp.grant_loose(pg_temp.m_disc(), 10, 'purchase', pg_temp.id('6304'))->'data'->>'launchDiscountPct'),
  null,
  'la segunda compra no aplica el descuento'
);
select is(
  (pg_temp.register(pg_temp.m_disc(), (select quota5 from plans), true, pg_temp.id('6305'))->'data'->>'launchDiscountPct'),
  null,
  'una compra de plan posterior tampoco lo aplica'
);
select is(
  (select count(*)::integer from public.merchant_launch_discounts where merchant_id = pg_temp.m_disc()),
  1,
  'el beneficio se registra una sola vez por comercio'
);
update public.platform_settings set value = '0'::jsonb where key = 'launch_discount_pct';

-- ============================================================================
-- 6. Costo híbrido (prueba 2)
-- ============================================================================
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_cost(), 10, 'adjustment', pg_temp.id('6401'))), null, 'costo: 10 créditos sueltos');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_cost(), pg_temp.id('5201'), 1)), null, 'costo: publica 1 entrega');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_cost(), pg_temp.id('5202'), 2)), null, 'costo: publica 2 entregas');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_cost(), pg_temp.id('5203'), 3)), null, 'costo: publica 3 entregas');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_cost(), pg_temp.id('5204'), 5)), null, 'costo: publica 5 entregas');
select is(
  array[(pg_temp.current_charge(pg_temp.id('5201'))).cost, (pg_temp.current_charge(pg_temp.id('5202'))).cost,
        (pg_temp.current_charge(pg_temp.id('5203'))).cost, (pg_temp.current_charge(pg_temp.id('5204'))).cost],
  array[1, 1, 2, 4],
  'con N = 2, 1/2/3/5 entregas cuestan 1/1/2/4'
);
select is(pg_temp.available(pg_temp.m_cost()), 2, 'quedan 2 de 10 créditos');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', 'select public.admin_update_setting(''publication_drops_per_credit'', ''3''::jsonb)')),
  null,
  'el admin cambia N a 3'
);
select is((pg_temp.current_charge(pg_temp.id('5204'))).cost, 4, 'el costo fijado al reservar no cambia al modificar N');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_cost(), pg_temp.id('5205'), 4)), null, 'con N = 3, 4 entregas cuestan 2');
select is((pg_temp.current_charge(pg_temp.id('5205'))).cost, 2, 'costo con N = 3');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', 'select public.admin_update_setting(''publication_drops_per_credit'', ''0''::jsonb)')),
  'INVALID_SETTING_VALUE',
  'N < 1 se rechaza'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', 'select public.admin_update_setting(''carryover_base_pct'', ''40''::jsonb)')),
  'INVALID_SETTING_VALUE',
  'la base de arrastre no puede superar el tope'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', 'select public.admin_update_setting(''launch_discount_pct'', ''101''::jsonb)')),
  'INVALID_SETTING_VALUE',
  'el descuento no puede superar 100'
);
update public.platform_settings set value = '2'::jsonb where key = 'publication_drops_per_credit';
select is(pg_temp.err(pg_temp.publish(pg_temp.m_cost(), pg_temp.id('5206'), 1)), 'PUBLICATION_CREDITS_EXHAUSTED', 'sin saldo suficiente: EXHAUSTED');

-- ============================================================================
-- 7. Transiciones de cargo (prueba 5)
-- ============================================================================
-- 7.1 Publicar reserva; match consume; no_show con republicación vuelve a reserva del mismo cargo
select is(pg_temp.err(pg_temp.publish(pg_temp.m_flow(), pg_temp.id('5301'), 1)), null, 'flujo: publica');
create temp table c5301 as select id from public.publication_charges where request_id = pg_temp.id('5301');
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'reserved', 'publicar deja el cargo reserved');
select is(pg_temp.available(pg_temp.m_flow()), 19, 'la reserva descuenta del disponible');
select is(pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier1(), pg_temp.id('5301'))), null, 'flujo: match');
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'consumed', 'el match consume la reserva');
select is(
  pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier2(), pg_temp.id('5301'))),
  'INVALID_STATE_TRANSITION',
  'un segundo match no vuelve a consumir'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.report_no_show(%L::uuid, true)', pg_temp.id('5301')))),
  null,
  'flujo: no_show con republicación'
);
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'reserved', 'no_show con republicación vuelve a reserved');
select is((pg_temp.current_charge(pg_temp.id('5301'))).id, (select id from c5301), 'no_show reutiliza el mismo cargo');
select is(pg_temp.charge_count(pg_temp.id('5301')), 1, 'no_show no crea un cargo nuevo');
select is(pg_temp.available(pg_temp.m_flow()), 19, 'no_show no cobra de nuevo ni devuelve al saldo');

-- 7.2 Cancelación del repartidor antes del retiro
select is(pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier1(), pg_temp.id('5301'))), null, 'flujo: segundo match');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.courier1(), 'aal1', format('select public.courier_cancel_match(%L::uuid, %L)', pg_temp.id('5301'), 'Se me rompió la moto'))),
  null,
  'flujo: el repartidor cancela antes del retiro'
);
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'reserved', 'courier_cancel_match vuelve a reserved');
select is((pg_temp.current_charge(pg_temp.id('5301'))).id, (select id from c5301), 'courier_cancel_match reutiliza el mismo cargo');

-- 7.3 Vencer sin match (con oferta pendiente) libera al saldo
select ok(pg_temp.offer(pg_temp.courier2(), pg_temp.id('5301')) is not null, 'hay una oferta pendiente al vencer');
update public.delivery_requests set expires_at = now() - interval '1 minute' where id = pg_temp.id('5301');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', 'select public.reconcile_expired_requests()')),
  null,
  'flujo: el comercio reconcilia sus vencidas'
);
select is(
  (select state from public.publication_charges where id = (select id from c5301)),
  'released',
  'vencer sin match, con oferta pendiente, libera la reserva'
);
select is(pg_temp.current_charge(pg_temp.id('5301')), null::public.publication_charges, 'tras liberar no queda cargo corriente');
select is(pg_temp.available(pg_temp.m_flow()), 20, 'el crédito vuelve al saldo');

-- 7.4 Republicar una vencida crea una reserva nueva (D-C1)
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.republish_request(%L::uuid, null)', pg_temp.id('5301')))),
  null,
  'flujo: republica la vencida'
);
select is(pg_temp.charge_count(pg_temp.id('5301')), 2, 'republicar una vencida crea un cargo nuevo');
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'reserved', 'el cargo nuevo queda reserved');
select is(pg_temp.available(pg_temp.m_flow()), 19, 'la republicación reserva un crédito');

-- 7.5 Cancelar antes del match libera; republicar la cancelada reserva de nuevo
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.cancel_request(%L::uuid, null)', pg_temp.id('5301')))),
  null,
  'flujo: cancela antes del match'
);
select is(pg_temp.current_charge(pg_temp.id('5301')), null::public.publication_charges, 'cancelar antes del match libera la reserva');
select is(pg_temp.available(pg_temp.m_flow()), 20, 'cancelar antes del match devuelve el crédito');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.republish_request(%L::uuid, null)', pg_temp.id('5301')))),
  null,
  'flujo: republica la cancelada'
);
select is(pg_temp.available(pg_temp.m_flow()), 19, 'republicar una cancelada antes del match reserva de nuevo');

-- 7.6 Cancelar después del match no reintegra; republicarla deja el consumo como histórico y reserva otro
select is(pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier1(), pg_temp.id('5301'))), null, 'flujo: match antes de cancelar');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.cancel_request(%L::uuid, %L)', pg_temp.id('5301'), 'Cliente se arrepintió'))),
  null,
  'flujo: cancela después del match'
);
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'consumed', 'cancelar después del match deja el cargo consumido');
select is(pg_temp.available(pg_temp.m_flow()), 19, 'cancelar después del match no reintegra');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.republish_request(%L::uuid, null)', pg_temp.id('5301')))),
  null,
  'flujo: republica la cancelada después del match'
);
select is(
  (select count(*)::integer from public.publication_charges where request_id = pg_temp.id('5301') and state = 'consumed' and not is_current),
  1,
  'el consumo anterior queda como histórico (is_current = false)'
);
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'reserved', 'y hay un único cargo corriente reservado');
select is(pg_temp.available(pg_temp.m_flow()), 18, 'republicar después de un consumo cobra otro crédito');

-- 7.7 Sacar al repartidor asignado (D-C2a): histórico consumido intacto y reserva nueva
select is(pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier1(), pg_temp.id('5301'))), null, 'flujo: match antes de sacar al repartidor');
create temp table c5301_consumed as select id from public.publication_charges where request_id = pg_temp.id('5301') and is_current;
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.republish_request(%L::uuid, %L)', pg_temp.id('5301'), 'No contesta los mensajes'))),
  null,
  'flujo: el comercio saca al repartidor y republica'
);
select is(
  (select state || ':' || is_current::text from public.publication_charges where id = (select id from c5301_consumed)),
  'consumed:false',
  'D-C2a: el cargo consumido queda histórico y firme'
);
select is((pg_temp.current_charge(pg_temp.id('5301'))).state, 'reserved', 'D-C2a: la republicación reserva un cargo nuevo');
select is(pg_temp.available(pg_temp.m_flow()), 17, 'D-C2a: sacar al repartidor cobra otro crédito');
select is(
  (select count(*)::integer from public.publication_charges where request_id = pg_temp.id('5301') and is_current),
  1,
  'un solo cargo corriente por solicitud'
);

-- 7.8 no_show sin republicación libera y no toca históricos
select is(pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier1(), pg_temp.id('5301'))), null, 'flujo: match antes del no_show final');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.report_no_show(%L::uuid, false)', pg_temp.id('5301')))),
  null,
  'flujo: no_show sin republicación'
);
select is(pg_temp.current_charge(pg_temp.id('5301')), null::public.publication_charges, 'no_show sin republicación libera el cargo corriente');
select is(pg_temp.available(pg_temp.m_flow()), 18, 'no_show sin republicación devuelve el crédito');
select is(
  (select count(*)::integer from public.publication_charges where request_id = pg_temp.id('5301') and state = 'consumed'),
  2,
  'los consumos históricos siguen consumidos'
);

-- 7.9 Cancelación admin en tránsito: sin reintegro (D-C3)
select is(pg_temp.err(pg_temp.publish(pg_temp.m_flow(), pg_temp.id('5302'), 1)), null, 'flujo: publica para tránsito');
select is(pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier1(), pg_temp.id('5302'))), null, 'flujo: match para tránsito');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.courier1(), 'aal1', format('select public.mark_picked_up(%L::uuid)', pg_temp.id('5302')))),
  null,
  'flujo: retirado'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.report_incident(%L::uuid, %L, %L)', pg_temp.id('5302'), 'damaged_goods', 'Paquete roto en el viaje'))),
  null,
  'flujo: incidente en tránsito'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', format('select public.cancel_request(%L::uuid, %L)', pg_temp.id('5302'), 'Incidente en tránsito'))),
  null,
  'flujo: el admin cancela en tránsito'
);
select is((pg_temp.current_charge(pg_temp.id('5302'))).state, 'consumed', 'D-C3: la cancelación admin en tránsito no reintegra');

-- 7.10 Entregas fallidas de un multi-drop: sin reintegro (D-C4)
select is(pg_temp.err(pg_temp.publish(pg_temp.m_flow(), pg_temp.id('5303'), 3)), null, 'flujo: publica 3 entregas');
select is(pg_temp.err(pg_temp.match(pg_temp.m_flow(), pg_temp.courier1(), pg_temp.id('5303'))), null, 'flujo: match multi-drop');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.courier1(), 'aal1', format('select public.mark_picked_up(%L::uuid)', pg_temp.id('5303')))),
  null,
  'flujo: retirado multi-drop'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.courier1(), 'aal1', format(
    'select public.mark_drop_failed(%L::uuid, %L)',
    (select id from public.delivery_request_drops where request_id = pg_temp.id('5303') and position = 1),
    'Nadie atendió'))),
  null,
  'flujo: una entrega falla'
);
select is(
  (select state || ':' || cost::text from public.publication_charges where request_id = pg_temp.id('5303') and is_current),
  'consumed:2',
  'D-C4: una entrega fallida no reintegra'
);

-- 7.11 Toma directa con precio fijo consume (take_request con auto_assign)
select is(pg_temp.err(pg_temp.publish(pg_temp.m_flow(), pg_temp.id('5304'), 1, 2000, true)), null, 'flujo: publica precio fijo');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.courier2(), 'aal1', format('select public.take_request(%L::uuid, 10, null)', pg_temp.id('5304')))),
  null,
  'flujo: toma directa'
);
select is((pg_temp.current_charge(pg_temp.id('5304'))).state, 'consumed', 'la toma directa con auto_assign consume la reserva');

-- 7.12 Reintento del writer multi-drop no reserva dos veces
select is(pg_temp.err(pg_temp.publish(pg_temp.m_flow(), pg_temp.id('5305'), 1)), null, 'flujo: publica para reintento');
select is(
  ((pg_temp.publish(pg_temp.m_flow(), pg_temp.id('5305'), 1))->'data'->>'idempotent')::boolean,
  true,
  'el reintento del writer es idempotente'
);
select is(pg_temp.charge_count(pg_temp.id('5305')), 1, 'el reintento del writer no reserva dos veces');
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal1', format('select public.publish_request(%L::uuid)', pg_temp.id('5305')))),
  'INVALID_STATE_TRANSITION',
  'repetir publish_request sobre una publicada sigue fallando'
);

select ok(pg_temp.ledger_consistent(), 'libro y saldo derivado coinciden después de las transiciones');

-- ============================================================================
-- 8. Prioridad: plan antes que sueltos, reparto entre lotes (prueba 3)
-- ============================================================================
update public.merchants set subscription_status = 'expired' where profile_id = pg_temp.m_prio();
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_prio(), 2, 'adjustment', pg_temp.id('6501'))), null, 'prioridad: 2 sueltos');
select is(pg_temp.err(pg_temp.register(pg_temp.m_prio(), (select quota5 from plans), true, pg_temp.id('6502'))), null, 'prioridad: plan de 5');
create temp table prio_lots as
select
  (select id from public.publication_credit_lots where merchant_id = pg_temp.m_prio() and kind = 'plan') as plan_lot,
  (select id from public.publication_credit_lots where merchant_id = pg_temp.m_prio() and kind = 'loose') as loose_lot;
select is(pg_temp.err(pg_temp.publish(pg_temp.m_prio(), pg_temp.id('5401'), 5)), null, 'un comercio expired con créditos publica');
select is(
  (select array_agg(lot_id::text || ':' || amount::text) from public.publication_charge_lots
   where charge_id = (pg_temp.current_charge(pg_temp.id('5401'))).id),
  array[(select plan_lot from prio_lots)::text || ':4'],
  'las primeras 4 salen del lote del plan'
);
select is(pg_temp.err(pg_temp.publish(pg_temp.m_prio(), pg_temp.id('5402'), 3)), null, 'prioridad: publica 3 entregas (costo 2)');
select is(
  (select array_agg(lot_id::text || ':' || amount::text order by lot_id::text) from public.publication_charge_lots
   where charge_id = (pg_temp.current_charge(pg_temp.id('5402'))).id),
  (select array_agg(x order by x) from unnest(array[
    (select plan_lot from prio_lots)::text || ':1', (select loose_lot from prio_lots)::text || ':1']) as x),
  'la reserva se reparte: 1 del plan y 1 suelto'
);
select is(pg_temp.available(pg_temp.m_prio()), 1, 'queda 1 suelto');

-- ============================================================================
-- 9. Ilimitado y legacy_paid (prueba 3)
-- ============================================================================
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_unl(), 3, 'adjustment', pg_temp.id('6601'))), null, 'ilimitado: 3 sueltos');
select is(pg_temp.err(pg_temp.register(pg_temp.m_unl(), (select unlimited from plans), true, pg_temp.id('6602'))), null, 'ilimitado: registra plan ilimitado');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_unl(), pg_temp.id('5501'), 5)), null, 'ilimitado: publica 5 entregas');
select is(
  (select mode || ':' || cost::text from public.publication_charges where request_id = pg_temp.id('5501') and is_current),
  'unlimited:0',
  'con ilimitado vigente el cargo es unlimited sin costo'
);
select is(pg_temp.available(pg_temp.m_unl()), 3, 'con ilimitado los sueltos quedan intactos');

update public.merchants
set subscription_status = 'active', paid_until = ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 5)
where profile_id = pg_temp.m_legacy();
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_legacy(), 2, 'adjustment', pg_temp.id('6701'))), null, 'legacy: 2 sueltos');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_legacy(), pg_temp.id('5601'), 1)), null, 'legacy: publica');
select is(
  (select mode || ':' || cost::text from public.publication_charges where request_id = pg_temp.id('5601') and is_current),
  'legacy_paid:0',
  'legacy_paid vigente publica sin reservar'
);
select is(pg_temp.available(pg_temp.m_legacy()), 2, 'legacy_paid no toca los sueltos');

-- ============================================================================
-- 10. Planes programados, 2-A y período mensual (prueba 6)
-- ============================================================================
-- Renovación anticipada: el período siguiente empieza al terminar el vigente y sus créditos no se usan antes.
select is(pg_temp.err(pg_temp.register(pg_temp.m_unl(), (select quota40 from plans), true, pg_temp.id('6603'))), null, 'programa un plan de 40 tras el ilimitado');
select is(
  (select p2.starts_at = p1.ends_at from public.merchant_plan_periods p1
   join public.merchant_plan_periods p2 on p2.previous_period_id = p1.id
   where p1.operation_key = pg_temp.id('6602') and p2.operation_key = pg_temp.id('6603')),
  true,
  'el cambio de plan aplica desde el próximo período'
);
select is(
  (select count(*)::integer from app_private.publication_usable_lots(pg_temp.m_unl(), now()) where kind = 'plan'),
  0,
  'el lote de un plan programado no es usable antes de starts_at'
);
select is(
  ((pg_temp.rpc(pg_temp.m_unl(), 'aal1', 'select public.get_my_publication_balance()'))->'data'->>'scheduled')::integer,
  40,
  'el saldo muestra los 40 créditos como programados'
);
select is(
  (select ends_at = ((starts_at at time zone 'America/Argentina/Buenos_Aires') + interval '1 month') at time zone 'America/Argentina/Buenos_Aires'
   from public.merchant_plan_periods where operation_key = pg_temp.id('6602')),
  true,
  'el período dura un mes calendario desde la activación'
);

-- 2-A: con legacy vigente el primer plan se agenda al terminar el derecho anterior (con gracia)
select is(pg_temp.err(pg_temp.register(pg_temp.m_legacy(), (select quota5 from plans), true, pg_temp.id('6702'))), null, 'legacy: compra un plan');
select is(
  (select starts_at from public.merchant_plan_periods where operation_key = pg_temp.id('6702')),
  (((now() at time zone 'America/Argentina/Buenos_Aires')::date + 5 + 3 + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  '2-A: el primer plan empieza el primer instante después de paid_until + gracia'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', format(
    'select public.admin_set_subscription(%L::uuid, %L, %L::date, null)',
    pg_temp.m_legacy(), 'active', (now() at time zone 'America/Argentina/Buenos_Aires')::date + 30))),
  'INVALID_STATE_TRANSITION',
  '2-A: extender paid_until sobre un plan programado se rechaza'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', format(
    'select public.admin_set_subscription(%L::uuid, %L, %L::date, null)',
    pg_temp.m_legacy(), 'active', (now() at time zone 'America/Argentina/Buenos_Aires')::date + 4))),
  null,
  '2-A: acortar el legacy sin superponer se acepta'
);

-- ============================================================================
-- 11. Fidelidad, arrastre al corte y conversión D-C7 (prueba 6, D-C7)
-- ============================================================================
select is(pg_temp.err(pg_temp.register(pg_temp.m_fidel(), (select quota40 from plans), true, pg_temp.id('6801'))), null, 'fidelidad: primer plan de 40');
select is(
  (select streak || ':' || carryover_pct from public.merchant_plan_periods where operation_key = pg_temp.id('6801')),
  '1:0',
  'el primer período tiene racha 1 y sin arrastre'
);
select is(pg_temp.err(pg_temp.publish(pg_temp.m_fidel(), pg_temp.id('5701'), 1)), null, 'fidelidad: publica A');
select is(pg_temp.err(pg_temp.match(pg_temp.m_fidel(), pg_temp.courier1(), pg_temp.id('5701'))), null, 'fidelidad: A consumida');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_fidel(), pg_temp.id('5702'), 1)), null, 'fidelidad: publica B (queda reservada)');
select is(pg_temp.err(pg_temp.publish(pg_temp.m_fidel(), pg_temp.id('5703'), 1)), null, 'fidelidad: publica C');
select is(pg_temp.err(pg_temp.match(pg_temp.m_fidel(), pg_temp.courier1(), pg_temp.id('5703'))), null, 'fidelidad: C matcheada');
create temp table fidel_lot as
select id from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and kind = 'plan';

-- Fin del período: termina hace 1 día (dentro de la gracia de 3)
select pg_temp.shift_back(pg_temp.m_fidel(), interval '1 month 1 day');
update public.delivery_requests set expires_at = now() + interval '1 hour' where id = pg_temp.id('5702');
select is(
  app_private.publication_lot_unused_as_of((select id from fidel_lot), (select ends_at from public.merchant_plan_periods where operation_key = pg_temp.id('6801'))),
  37,
  'sin usar al corte: 40 − 3 reservados/consumidos'
);
select is(pg_temp.err(pg_temp.register(pg_temp.m_fidel(), (select quota40 from plans), true, pg_temp.id('6802'))), null, 'fidelidad: renovación tardía dentro de la gracia');
select is(
  (select streak || ':' || carryover_pct from public.merchant_plan_periods where operation_key = pg_temp.id('6802')),
  '2:5',
  '1-A: la renovación tardía dentro de la gracia conserva la racha (5% en la primera renovación)'
);
select is(
  (select starts_at from public.merchant_plan_periods where operation_key = pg_temp.id('6802')),
  now(),
  '1-A: la renovación tardía empieza al registrarse'
);
select is(
  (select count(*)::integer from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and kind = 'carryover'),
  0,
  'el arrastre todavía no se materializó'
);
select is(
  ((pg_temp.rpc(pg_temp.m_fidel(), 'aal1', 'select public.get_my_publication_balance()'))->'data'->>'mode'),
  'credits',
  'la lectura del comercio materializa y devuelve el modo'
);
select is(
  (select granted from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and kind = 'carryover'),
  2,
  'arrastre = min(sin usar al corte, floor(5% × 40)) = 2'
);
select is(
  (select expires_at = (select ends_at from public.merchant_plan_periods where operation_key = pg_temp.id('6802'))
   from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and kind = 'carryover'),
  true,
  'lo arrastrado vence con el período nuevo'
);
select is(pg_temp.err(pg_temp.rpc(pg_temp.m_fidel(), 'aal1', 'select public.get_my_publication_balance()')), null, 'segunda lectura');
select is(
  (select count(*)::integer from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and kind = 'carryover'),
  1,
  'el arrastre se materializa una sola vez'
);

-- Consumir una reserva cuyo lote venció
select is(pg_temp.err(pg_temp.match(pg_temp.m_fidel(), pg_temp.courier2(), pg_temp.id('5702'))), null, 'una reserva de un lote vencido se consume en el match');
-- Republicación con reserva existente sin pedir plan vigente: no_show con republicación
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_fidel(), 'aal1', format('select public.report_no_show(%L::uuid, true)', pg_temp.id('5702')))),
  null,
  'no_show republica con la reserva existente aunque su lote haya vencido'
);
select is((pg_temp.current_charge(pg_temp.id('5702'))).state, 'reserved', 'la reserva sigue tomada del lote vencido');

-- Liberar esa reserva convierte la parte del lote vencido en un suelto, una sola vez (D-C7)
update public.delivery_requests set expires_at = now() - interval '1 minute' where id = pg_temp.id('5702');
select is(pg_temp.err(pg_temp.rpc(pg_temp.m_fidel(), 'aal1', 'select public.reconcile_expired_requests()')), null, 'vence la reserva del lote vencido');
select is(
  (select count(*)::integer || ':' || coalesce(sum(granted), 0)::text from public.publication_credit_lots
   where merchant_id = pg_temp.m_fidel() and source = 'refund_conversion'),
  '1:1',
  'D-C7: el crédito vuelve como un suelto nuevo'
);
select is(
  (select refund_source_lot_id from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and source = 'refund_conversion'),
  (select id from fidel_lot),
  'la conversión referencia el lote de origen'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_fidel(), 'aal1', 'select public.reconcile_expired_requests()')),
  null,
  'una segunda reconciliación'
);
select is(
  (select count(*)::integer from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and source = 'refund_conversion'),
  1,
  'D-C7: no se convierte dos veces'
);
select is(
  app_private.publication_lot_unused_as_of((select id from fidel_lot), (select ends_at from public.merchant_plan_periods where operation_key = pg_temp.id('6801'))),
  37,
  'una liberación posterior al corte no recalcula el arrastre'
);
select is(
  (select granted from public.publication_credit_lots where merchant_id = pg_temp.m_fidel() and kind = 'carryover'),
  2,
  'el arrastre materializado es inmutable'
);

-- Racha y tope: renovaciones anticipadas consecutivas
select is(pg_temp.err(pg_temp.register(pg_temp.m_fidel(), (select quota40 from plans), true, pg_temp.id('6803'))), null, 'renovación 3');
select is(pg_temp.err(pg_temp.register(pg_temp.m_fidel(), (select quota40 from plans), true, pg_temp.id('6804'))), null, 'renovación 4');
update public.platform_settings set value = '12'::jsonb where key = 'carryover_cap_pct';
select is(pg_temp.err(pg_temp.register(pg_temp.m_fidel(), (select quota40 from plans), true, pg_temp.id('6805'))), null, 'renovación 5 con tope 12');
select is(
  (select array_agg(streak || ':' || carryover_pct order by starts_at) from public.merchant_plan_periods where merchant_id = pg_temp.m_fidel()),
  array['1:0', '2:5', '3:10', '4:15', '5:12'],
  'la racha suma 5% por renovación consecutiva y respeta el tope configurable'
);
update public.platform_settings set value = '35'::jsonb where key = 'carryover_cap_pct';
select is(
  (select count(*)::integer from public.publication_credit_lots l
   join public.merchant_plan_periods p on p.id = l.period_id
   where l.merchant_id = pg_temp.m_fidel() and l.kind = 'plan' and p.starts_at > now()),
  3,
  'los planes programados existen pero no son usables todavía'
);

-- Corte de racha: renovar fuera de la gracia vuelve a 1
select is(pg_temp.err(pg_temp.register(pg_temp.m_break(), (select quota40 from plans), true, pg_temp.id('6901'))), null, 'corte: primer plan');
select pg_temp.shift_back(pg_temp.m_break(), interval '1 month 10 days');
select is(pg_temp.err(pg_temp.register(pg_temp.m_break(), (select quota40 from plans), true, pg_temp.id('6902'))), null, 'corte: renovación tardía fuera de la gracia');
select is(
  (select streak || ':' || carryover_pct || ':' || (previous_period_id is null)::text from public.merchant_plan_periods where operation_key = pg_temp.id('6902')),
  '1:0:true',
  'renovar fuera de la gracia corta la racha y no arrastra'
);

-- El ilimitado no arrastra ni concede publicaciones después de ends_at
select pg_temp.shift_back(pg_temp.m_unl(), interval '1 month 1 day');
select is(pg_temp.err(pg_temp.rpc(pg_temp.m_unl(), 'aal1', 'select public.get_my_publication_balance()')), null, 'ilimitado vencido: lectura');
select is(
  (select count(*)::integer from public.publication_credit_lots where merchant_id = pg_temp.m_unl() and kind = 'carryover'),
  0,
  'un período posterior a un ilimitado no recibe arrastre'
);
select is(pg_temp.err(pg_temp.publish(pg_temp.m_unl(), pg_temp.id('5502'), 1)), null, 'después del ilimitado publica con el plan de cupo');
select is(
  (select mode from public.publication_charges where request_id = pg_temp.id('5502') and is_current),
  'credits',
  'el ilimitado no concede publicaciones después de ends_at'
);

-- ============================================================================
-- 12. Secuencia con saldo insuficiente: nunca saldo negativo (prueba 9, versión determinística)
-- ============================================================================
select is(pg_temp.err(pg_temp.grant_loose(pg_temp.m_seq(), 3, 'adjustment', pg_temp.id('7001'))), null, 'secuencia: 3 créditos');
select is(
  (select array_agg(coalesce(pg_temp.err(pg_temp.publish(pg_temp.m_seq(), pg_temp.id((7100 + n)::text), 1)), 'ok') order by n)
   from generate_series(1, 5) as n),
  array['ok', 'ok', 'ok', 'PUBLICATION_CREDITS_EXHAUSTED', 'PUBLICATION_CREDITS_EXHAUSTED'],
  'con 3 créditos, 5 publicaciones seguidas: 3 publican y 2 reciben EXHAUSTED'
);
select is(pg_temp.available(pg_temp.m_seq()), 0, 'el saldo queda en 0, nunca negativo');

-- ============================================================================
-- 13. Lecturas: comercio y admin (prueba 10)
-- ============================================================================
select is(pg_temp.err(pg_temp.rpc(null, 'aal1', 'select public.get_my_publication_balance()')), 'UNAUTHENTICATED', 'lectura sin sesión');
select is(pg_temp.err(pg_temp.rpc(pg_temp.courier1(), 'aal1', 'select public.get_my_publication_balance()')), 'UNAUTHORIZED_ACTOR', 'un repartidor no lee saldos');
select is(
  ((pg_temp.rpc(pg_temp.m_flow(), 'aal1', 'select public.get_my_publication_balance()'))->'data'->>'merchantId')::uuid,
  pg_temp.m_flow(),
  'el comercio lee solo su propio saldo'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.m_flow(), 'aal2', format('select public.admin_get_merchant_publication_credits(%L::uuid, 50, null)', pg_temp.m_cost()))),
  'UNAUTHORIZED_ACTOR',
  'un comercio no lee el saldo de otro por la RPC admin'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal1', format('select public.admin_get_merchant_publication_credits(%L::uuid, 50, null)', pg_temp.m_flow()))),
  'AAL2_REQUIRED',
  'la lectura admin exige AAL2'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', format('select public.admin_get_merchant_publication_credits(%L::uuid, 51, null)', pg_temp.m_flow()))),
  'VALIDATION_ERROR',
  'la lectura admin pagina de a 50 como máximo'
);
select is(
  jsonb_array_length((pg_temp.rpc(pg_temp.admin(), 'aal2', format('select public.admin_get_merchant_publication_credits(%L::uuid, 2, null)', pg_temp.m_flow())))->'data'->'movements'),
  2,
  'la lectura admin devuelve el libro paginado'
);
select ok(
  ((pg_temp.rpc(pg_temp.admin(), 'aal2', format('select public.admin_get_merchant_publication_credits(%L::uuid, 2, null)', pg_temp.m_flow())))->'data'->>'nextCursor') is not null,
  'la lectura admin devuelve cursor cuando hay más'
);

-- Catálogo: errores
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', format(
    'select public.admin_upsert_publication_plan(%L::uuid, %L, %L, %L, 30, 10000, true, 1)',
    (select quota40 from plans), 't369-quota-40', 'Plan cambiado', 'quota'))),
  'PLAN_IN_USE',
  'no se cambia el cupo de un plan con períodos'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', format(
    'select public.admin_upsert_publication_plan(%L::uuid, %L, %L, %L, 40, 12000, false, 2)',
    (select quota5 from plans), 't369-quota-5', 'Plan 5 inactivo', 'quota'))),
  'PLAN_IN_USE',
  'tampoco se cambia el cupo de otro plan en uso'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', format(
    'select public.admin_upsert_publication_plan(%L::uuid, %L, %L, %L, 5, 12000, false, 2)',
    (select quota5 from plans), 't369-quota-5', 'Plan 5 inactivo', 'quota'))),
  null,
  'se puede cambiar precio, nombre y estado de un plan en uso'
);
select is(
  pg_temp.err(pg_temp.register(pg_temp.m_break(), (select quota5 from plans), true, pg_temp.id('6903'))),
  'PLAN_INACTIVE',
  'no se registra un período con un plan inactivo'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', 'select public.admin_upsert_publication_plan(null, ''x'', ''Plan'', ''quota'', 5, null, true, 1)')),
  'VALIDATION_ERROR',
  'el código del plan se valida'
);
select is(
  pg_temp.err(pg_temp.rpc(pg_temp.admin(), 'aal2', 'select public.admin_upsert_publication_plan(null, ''t369-bad'', ''Plan'', ''unlimited'', 5, null, true, 1)')),
  'VALIDATION_ERROR',
  'un ilimitado no lleva cupo'
);
select is(
  (pg_temp.register(pg_temp.m_break(), (select quota40 from plans), true, pg_temp.id('6902'))->'data'->>'idempotent')::boolean,
  true,
  'el reintento de un período con la misma clave es idempotente'
);
select is(
  pg_temp.err(pg_temp.register(pg_temp.m_flow(), (select quota40 from plans), true, pg_temp.id('6902'))),
  'IDEMPOTENCY_CONFLICT',
  'reusar la clave de un período para otro comercio da IDEMPOTENCY_CONFLICT'
);

select ok(pg_temp.ledger_consistent(), 'libro y saldo derivado coinciden al final de la suite');

select * from finish();
rollback;
