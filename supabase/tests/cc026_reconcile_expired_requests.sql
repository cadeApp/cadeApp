begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.cc026_id(p_suffix text) returns uuid language sql immutable as $$
  select ('30000000-0000-4000-8000-' || lpad(p_suffix, 12, '0'))::uuid;
$$;

create function pg_temp.merchant_id() returns uuid language sql immutable as $$
  select pg_temp.cc026_id('261');
$$;

create function pg_temp.other_merchant_id() returns uuid language sql immutable as $$
  select pg_temp.cc026_id('262');
$$;

create function pg_temp.courier_id() returns uuid language sql immutable as $$
  select pg_temp.cc026_id('263');
$$;

create function pg_temp.admin_id() returns uuid language sql immutable as $$
  select pg_temp.cc026_id('264');
$$;

create function pg_temp.zone_id() returns uuid language sql immutable as $$
  select pg_temp.cc026_id('265');
$$;

create function pg_temp.as_authenticated(p_actor uuid, p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

create function pg_temp.as_unauthenticated(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;
  execute p_sql into v_result;
  set local role postgres;
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

create function pg_temp.as_service_role(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  execute p_sql into v_result;
  set local role postgres;
  return jsonb_build_object('data', v_result);
exception when others then
  set local role postgres;
  return jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate);
end;
$$;

create function pg_temp.error_state_as_authenticated(p_actor uuid, p_sql text)
returns text
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
  set local role authenticated;
  execute p_sql;
  set local role postgres;
  return null;
exception when others then
  set local role postgres;
  return sqlstate;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc026.merchant@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.other_merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc026.other@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc026.courier@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc026.admin@example.test', 'pwd', '{"role":"merchant"}'::jsonb)
on conflict (id) do nothing;

update public.profiles
set role = 'merchant', consent_status = 'active'
where id in (pg_temp.merchant_id(), pg_temp.other_merchant_id());
update public.profiles set role = 'courier', consent_status = 'active' where id = pg_temp.courier_id();
update public.profiles set role = 'admin', consent_status = 'active' where id = pg_temp.admin_id();

insert into public.merchants (profile_id, business_name, subscription_status)
values
  (pg_temp.merchant_id(), 'CC026 Comercio', 'pilot'),
  (pg_temp.other_merchant_id(), 'CC026 Comercio ajeno', 'pilot')
on conflict (profile_id) do update set subscription_status = 'pilot';
insert into public.couriers (profile_id, status, available)
values (pg_temp.courier_id(), 'approved', true)
on conflict (profile_id) do update set status = 'approved', available = true;
insert into public.zones (id, name, centroid_lat, centroid_lng, active)
values (pg_temp.zone_id(), 'Zona CC026', -27.430000, -65.620000, true)
on conflict (id) do nothing;

create function pg_temp.clear_requests() returns void language plpgsql as $$
begin
  -- Rompe la referencia inversa de una oferta aceptada antes de borrar las ofertas hijas.
  update public.delivery_requests
  set accepted_offer_id = null
  where merchant_id in (pg_temp.merchant_id(), pg_temp.other_merchant_id());
  delete from public.offers
  where request_id in (
    select id from public.delivery_requests
    where merchant_id in (pg_temp.merchant_id(), pg_temp.other_merchant_id())
  );
  delete from public.audit_log
  where target_id in (
    select id::text from public.delivery_requests
    where merchant_id in (pg_temp.merchant_id(), pg_temp.other_merchant_id())
  );
  delete from public.delivery_requests
  where merchant_id in (pg_temp.merchant_id(), pg_temp.other_merchant_id());
end;
$$;

create function pg_temp.seed_request(
  p_request_id uuid,
  p_merchant_id uuid,
  p_status public.delivery_request_status,
  p_expires_at timestamptz,
  p_accepted boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_offer_id uuid := gen_random_uuid();
begin
  insert into public.delivery_requests (
    id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
    recipient_payment_method, expires_at, published_at
  ) values (
    p_request_id, p_merchant_id, p_status, pg_temp.zone_id(), pg_temp.zone_id(), 'chico',
    'cash', p_expires_at, case when p_status = 'published' then now() else null end
  );
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values (
    v_offer_id, p_request_id, pg_temp.courier_id(), 1500, 15,
    case when p_accepted then 'accepted'::public.offer_status else 'pending'::public.offer_status end
  );
  if p_accepted then
    update public.delivery_requests set accepted_offer_id = v_offer_id where id = p_request_id;
  end if;
  return v_offer_id;
end;
$$;

select ok(to_regprocedure('public.reconcile_expired_requests()') is not null, 'CC-026 expone RPC merchant');
select ok(to_regprocedure('public.reconcile_expired_requests_cron(integer)') is not null, 'CC-026 expone RPC cron');
select ok(to_regprocedure('app_private.reconcile_expired_requests(uuid,integer,timestamp with time zone)') is not null, 'CC-026 expone helper privado');
select ok(
  coalesce((
    select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
    from pg_proc p
    where p.oid = 'public.reconcile_expired_requests()'::regprocedure
  ), false),
  'RPC merchant usa SECURITY DEFINER y search_path fijo'
);
select ok(
  coalesce((
    select p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
    from pg_proc p
    where p.oid = 'app_private.reconcile_expired_requests(uuid,integer,timestamp with time zone)'::regprocedure
  ), false),
  'helper privado usa SECURITY DEFINER y search_path fijo'
);
select ok(not has_function_privilege('anon', 'app_private.reconcile_expired_requests(uuid,integer,timestamp with time zone)', 'EXECUTE'), 'anon no ejecuta helper');
select ok(not has_function_privilege('authenticated', 'app_private.reconcile_expired_requests(uuid,integer,timestamp with time zone)', 'EXECUTE'), 'authenticated no ejecuta helper');
select ok(has_function_privilege('authenticated', 'public.reconcile_expired_requests()', 'EXECUTE'), 'authenticated ejecuta RPC merchant');
select ok(not has_function_privilege('authenticated', 'public.reconcile_expired_requests_cron(integer)', 'EXECUTE'), 'authenticated no ejecuta cron');
select ok(has_function_privilege('service_role', 'public.reconcile_expired_requests_cron(integer)', 'EXECUTE'), 'service_role ejecuta cron');

select is(pg_temp.as_unauthenticated('select public.reconcile_expired_requests()')->>'error', 'UNAUTHENTICATED', 'RPC merchant exige identidad');
select is(pg_temp.as_authenticated(pg_temp.courier_id(), 'select public.reconcile_expired_requests()')->>'error', 'UNAUTHORIZED_ACTOR', 'courier no reconcilia');
select is(pg_temp.as_authenticated(pg_temp.admin_id(), 'select public.reconcile_expired_requests()')->>'error', 'UNAUTHORIZED_ACTOR', 'admin ordinario no reconcilia');
update public.profiles set consent_status = 'pending' where id = pg_temp.merchant_id();
select is(pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->>'error', 'UNAUTHORIZED_ACTOR', 'comercio sin consentimiento activo no reconcilia');
update public.profiles set consent_status = 'active' where id = pg_temp.merchant_id();

select pg_temp.clear_requests();
select pg_temp.seed_request(pg_temp.cc026_id('1'), pg_temp.merchant_id(), 'published', now() - interval '1 millisecond');
select pg_temp.seed_request(pg_temp.cc026_id('2'), pg_temp.merchant_id(), 'published', now());
select pg_temp.seed_request(pg_temp.cc026_id('3'), pg_temp.merchant_id(), 'published', now() + interval '5 minutes');
select pg_temp.seed_request(pg_temp.cc026_id('4'), pg_temp.merchant_id(), 'published', null);
select pg_temp.seed_request(pg_temp.cc026_id('5'), pg_temp.merchant_id(), 'published', now() - interval '1 minute', true);
select pg_temp.seed_request(pg_temp.cc026_id('6'), pg_temp.merchant_id(), 'matched', now() - interval '1 minute');
select pg_temp.seed_request(pg_temp.cc026_id('7'), pg_temp.merchant_id(), 'in_transit', now() - interval '1 minute');
select pg_temp.seed_request(pg_temp.cc026_id('8'), pg_temp.merchant_id(), 'delivered', now() - interval '1 minute');
select pg_temp.seed_request(pg_temp.cc026_id('9'), pg_temp.merchant_id(), 'cancelled', now() - interval '1 minute');
select pg_temp.seed_request(pg_temp.cc026_id('10'), pg_temp.merchant_id(), 'expired', now() - interval '1 minute');
select pg_temp.seed_request(pg_temp.cc026_id('11'), pg_temp.other_merchant_id(), 'published', now() - interval '1 minute');

select is((pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->'data'->>'expiredCount')::integer, 2, 'vencen solo las dos published propias en o antes del límite');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('1')), 'expired', 'vence justo antes del límite');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('2')), 'expired', 'vence en el instante exacto');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('3')), 'published', 'no vence antes del límite');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('4')), 'published', 'expires_at nulo no vence');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('5')), 'published', 'accepted_offer_id no nulo no vence');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('6')), 'matched', 'matched permanece intacta');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('7')), 'in_transit', 'in_transit permanece intacta');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('8')), 'delivered', 'delivered permanece intacta');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('9')), 'cancelled', 'cancelled permanece intacta');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('10')), 'expired', 'expired permanece intacta');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('11')), 'published', 'comercio no puede mutar solicitud ajena');
select is((select status::text from public.offers where request_id = pg_temp.cc026_id('1')), 'expired', 'expira oferta pending de solicitud modificada');
select ok((select decided_at is not null from public.offers where request_id = pg_temp.cc026_id('1')), 'oferta expirada recibe decided_at');
select is((select count(*)::integer from public.audit_log where target_id = pg_temp.cc026_id('1')::text and action = 'expired'), 1, 'inserta una sola auditoría por solicitud modificada');
select is((pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->'data'->>'expiredCount')::integer, 0, 'reintento idempotente no devuelve transiciones');
select is((select count(*)::integer from public.audit_log where target_id = pg_temp.cc026_id('1')::text and action = 'expired'), 1, 'reintento no duplica auditoría');

select is(pg_temp.error_state_as_authenticated(pg_temp.merchant_id(), format('update public.delivery_requests set status = ''expired'' where id = %L', pg_temp.cc026_id('3'))), '42501', 'comercio no actualiza delivery_requests.status directo');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('3')), 'published', 'bypass de status no persiste cambio');
select is(pg_temp.error_state_as_authenticated(pg_temp.merchant_id(), format('update public.delivery_requests set accepted_offer_id = null where id = %L', pg_temp.cc026_id('5'))), '42501', 'comercio no actualiza accepted_offer_id directo');
select ok((select accepted_offer_id is not null from public.delivery_requests where id = pg_temp.cc026_id('5')), 'bypass de accepted_offer_id no persiste cambio');
select is(pg_temp.error_state_as_authenticated(pg_temp.merchant_id(), format('update public.delivery_requests set expires_at = now() where id = %L', pg_temp.cc026_id('3'))), '42501', 'comercio no actualiza expires_at directo');
select ok((select expires_at > now() + interval '4 minutes' from public.delivery_requests where id = pg_temp.cc026_id('3')), 'bypass de expires_at no persiste cambio');
select is(pg_temp.error_state_as_authenticated(pg_temp.courier_id(), format('update public.offers set status = ''expired'' where request_id = %L', pg_temp.cc026_id('3'))), '42501', 'repartidor no actualiza offers.status directo');
select is((select status::text from public.offers where request_id = pg_temp.cc026_id('3')), 'pending', 'bypass de offers.status no persiste cambio');
select is(pg_temp.error_state_as_authenticated(pg_temp.courier_id(), format('update public.offers set decided_at = now() where request_id = %L', pg_temp.cc026_id('3'))), '42501', 'repartidor no actualiza offers.decided_at directo');
select ok((select decided_at is null from public.offers where request_id = pg_temp.cc026_id('3')), 'bypass de offers.decided_at no persiste cambio');

select pg_temp.clear_requests();
select pg_temp.seed_request(pg_temp.cc026_id('20'), pg_temp.merchant_id(), 'published', now() - interval '1 minute');
create function pg_temp.fail_cc026_write() returns trigger language plpgsql as $$
begin
  if current_setting('cc026.fail_target', true) = tg_table_name then
    raise exception 'CC026_FORCED_%', tg_table_name;
  end if;
  return new;
end;
$$;
create trigger cc026_fail_offer before update on public.offers for each row execute function pg_temp.fail_cc026_write();
create trigger cc026_fail_audit before insert on public.audit_log for each row execute function pg_temp.fail_cc026_write();

select set_config('cc026.fail_target', 'offers', true);
select like(pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->>'error', 'CC026_FORCED_offers%', 'fallo de offers aborta la RPC');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('20')), 'published', 'fallo de offers revierte estado de solicitud');
select is((select status::text from public.offers where request_id = pg_temp.cc026_id('20')), 'pending', 'fallo de offers conserva oferta pending');
select is((select count(*)::integer from public.audit_log where target_id = pg_temp.cc026_id('20')::text), 0, 'fallo de offers no deja auditoría parcial');

select set_config('cc026.fail_target', 'audit_log', true);
select like(pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->>'error', 'CC026_FORCED_audit_log%', 'fallo de audit aborta la RPC');
select is((select status::text from public.delivery_requests where id = pg_temp.cc026_id('20')), 'published', 'fallo de audit revierte estado de solicitud');
select is((select status::text from public.offers where request_id = pg_temp.cc026_id('20')), 'pending', 'fallo de audit conserva oferta pending');
select set_config('cc026.fail_target', '', true);

select pg_temp.clear_requests();
insert into public.delivery_requests (
  id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
  recipient_payment_method, expires_at, published_at
)
select
  pg_temp.cc026_id((1000 + n)::text), pg_temp.merchant_id(), 'published', pg_temp.zone_id(), pg_temp.zone_id(), 'chico',
  'cash', now() - interval '1 minute', now()
from generate_series(1, 51) as n;
insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, status)
select id, pg_temp.courier_id(), 1500, 15, 'pending'
from public.delivery_requests
where merchant_id = pg_temp.merchant_id();

select is((pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->'data'->>'expiredCount')::integer, 50, 'merchant procesa primer lote de 50');
select is((pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->'data'->>'expiredCount')::integer, 1, 'merchant procesa segundo lote de 1');
select is((pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests()')->'data'->>'expiredCount')::integer, 0, 'tercer lote queda vacío');

select is(pg_temp.as_authenticated(pg_temp.merchant_id(), 'select public.reconcile_expired_requests_cron(200)')->>'sqlstate', '42501', 'authenticated no puede invocar cron');
select is((pg_temp.as_service_role('select public.reconcile_expired_requests_cron(200)')->'data'->>'expiredCount')::integer, 0, 'cron service_role reutiliza operación idempotente');

select * from finish();
rollback;
