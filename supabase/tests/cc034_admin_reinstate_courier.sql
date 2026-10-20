begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(49);

-- CC-034 (T-385): admin_reinstate_courier reactiva un suspendido o reconsidera un rechazado.
create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034a1'::uuid $$;
create function pg_temp.merchant_m() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034b1'::uuid $$;
create function pg_temp.courier_susp() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c1'::uuid $$;
create function pg_temp.courier_rej() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c2'::uuid $$;
create function pg_temp.courier_appr() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c3'::uuid $$;
create function pg_temp.courier_pend() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c4'::uuid $$;
create function pg_temp.courier_incomplete() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034c5'::uuid $$;
create function pg_temp.req_1() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034e1'::uuid $$;
create function pg_temp.req_2() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034e2'::uuid $$;
create function pg_temp.missing_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000034f9'::uuid $$;

create function pg_temp.act_as(actor_id uuid, aal text default 'aal1')
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', aal)::text,
    true
  );
end;
$$;

create function pg_temp.act_as_anon()
returns void language plpgsql as $$
begin
  set local role anon;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
end;
$$;

create function pg_temp.act_as_authenticated_without_subject()
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal2')::text, true);
end;
$$;

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function pg_temp.courier_status(p_id uuid)
returns text language sql security definer set search_path = public, pg_temp as $$
  select status::text from public.couriers where profile_id = p_id;
$$;

create function pg_temp.reinstate_audits(p_id uuid)
returns integer language sql security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.audit_log where action = 'admin_reinstate_courier' and target_id = p_id::text;
$$;

-- Intento directo por tabla, ejecutado con el rol del actor (security invoker); el error no aborta la transacción.
create function pg_temp.try_direct_status_update(p_id uuid)
returns text language plpgsql as $$
begin
  update public.couriers set status = 'approved' where profile_id = p_id;
  return 'no-error';
exception when others then
  return sqlstate;
end;
$$;

do $$
declare
  v_zone_id uuid;
begin
  select id into v_zone_id from public.zones where active limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_a(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc34.admin@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
    (pg_temp.merchant_m(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc34.merchant@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
    (pg_temp.courier_susp(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc34.susp@example.test', 'pwd', '{"role":"courier"}'::jsonb),
    (pg_temp.courier_rej(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc34.rej@example.test', 'pwd', '{"role":"courier"}'::jsonb),
    (pg_temp.courier_appr(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc34.appr@example.test', 'pwd', '{"role":"courier"}'::jsonb),
    (pg_temp.courier_pend(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc34.pend@example.test', 'pwd', '{"role":"courier"}'::jsonb),
    (pg_temp.courier_incomplete(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc34.incomplete@example.test', 'pwd', '{"role":"courier"}'::jsonb);

  update public.profiles set role = 'admin' where id = pg_temp.admin_a();
  update public.profiles set consent_status = 'active'
  where id in (
    pg_temp.admin_a(), pg_temp.merchant_m(), pg_temp.courier_susp(), pg_temp.courier_rej(),
    pg_temp.courier_appr(), pg_temp.courier_pend(), pg_temp.courier_incomplete()
  );

  -- courier_susp arranca aprobado y disponible: se suspende por la RPC real para tener una oferta retirada.
  update public.couriers set status = 'approved', available = true, vehicle_type = 'moto', vehicle_plate = 'CC34AAA'
  where profile_id = pg_temp.courier_susp();
  update public.couriers set status = 'rejected', available = false, vehicle_type = 'bike'
  where profile_id = pg_temp.courier_rej();
  update public.couriers set status = 'approved', available = true, vehicle_type = 'car', vehicle_plate = 'CC34BBB'
  where profile_id = pg_temp.courier_appr();
  update public.couriers set status = 'pending', available = false, vehicle_type = 'moto'
  where profile_id = pg_temp.courier_pend();
  update public.couriers set status = 'suspended', available = false, vehicle_type = null
  where profile_id = pg_temp.courier_incomplete();

  insert into public.platform_settings (key, value)
  values ('min_offer_ars', '1000'::jsonb)
  on conflict (key) do update set value = '1000'::jsonb;

  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status, expires_at)
  values
    (pg_temp.req_1(), pg_temp.merchant_m(), v_zone_id, v_zone_id, 'chico', 'cash', 'published', now() + interval '30 minutes'),
    (pg_temp.req_2(), pg_temp.merchant_m(), v_zone_id, v_zone_id, 'chico', 'cash', 'published', now() + interval '30 minutes');
end;
$$;

-- 1. Firma, seguridad y grants
select has_function('public', 'admin_reinstate_courier', array['uuid', 'text'], 'CC-034 expone admin_reinstate_courier(uuid, text)');
select ok(
  (select prosecdef from pg_proc where oid = 'public.admin_reinstate_courier(uuid, text)'::regprocedure),
  'admin_reinstate_courier es security definer'
);
select ok(
  (select proconfig @> array['search_path=public, pg_temp'] from pg_proc where oid = 'public.admin_reinstate_courier(uuid, text)'::regprocedure),
  'admin_reinstate_courier fija search_path = public, pg_temp'
);
select ok(
  not has_function_privilege('anon', 'public.admin_reinstate_courier(uuid, text)', 'EXECUTE'),
  'anon no tiene execute sobre admin_reinstate_courier'
);
select ok(
  not has_function_privilege('public', 'public.admin_reinstate_courier(uuid, text)', 'EXECUTE'),
  'public no tiene execute sobre admin_reinstate_courier'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_reinstate_courier(uuid, text)', 'EXECUTE'),
  'authenticated tiene execute; la autorización real la hace assert_admin_aal2'
);

-- 2. Preparación: courier_susp oferta y el admin lo suspende con la RPC real (la oferta pasa a withdrawn)
select pg_temp.act_as(pg_temp.courier_susp());
select lives_ok(
  $$ select public.submit_offer(pg_temp.req_1(), 1500, 15, 'Oferta antes de la suspensión') $$,
  'courier_susp aprobado oferta antes de la suspensión'
);
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select lives_ok(
  $$ select public.admin_suspend_courier(pg_temp.courier_susp(), 'Incidente en revisión') $$,
  'el admin suspende a courier_susp con la RPC real'
);
select pg_temp.reset_actor();
select is(
  (select status::text from public.offers where request_id = pg_temp.req_1() and courier_id = pg_temp.courier_susp()),
  'withdrawn',
  'la suspensión retiró la oferta pendiente'
);

-- 3. Actores rechazados
select pg_temp.act_as_anon();
select throws_ok(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), 'Revisado') $$,
  '42501'::char(5),
  null::text,
  'anon no puede ejecutar admin_reinstate_courier'
);

select pg_temp.act_as_authenticated_without_subject();
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), 'Revisado') $$,
  'UNAUTHENTICATED',
  'sin sub en el JWT: UNAUTHENTICATED'
);

select pg_temp.act_as(pg_temp.courier_appr(), 'aal2');
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), 'Revisado') $$,
  'UNAUTHORIZED_ACTOR',
  'un repartidor no puede reactivar'
);

select pg_temp.act_as(pg_temp.merchant_m(), 'aal2');
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), 'Revisado') $$,
  'UNAUTHORIZED_ACTOR',
  'un comercio no puede reactivar'
);

select pg_temp.act_as(pg_temp.admin_a(), 'aal1');
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), 'Revisado') $$,
  'AAL2_REQUIRED',
  'admin sin MFA (aal1): AAL2_REQUIRED'
);

-- 4. Validaciones del admin con AAL2
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), '   ') $$,
  'REASON_REQUIRED',
  'motivo vacío: REASON_REQUIRED'
);
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), null) $$,
  'REASON_REQUIRED',
  'motivo nulo: REASON_REQUIRED'
);
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_susp(), repeat('x', 501)) $$,
  'VALIDATION_ERROR',
  'motivo de más de 500 caracteres: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.missing_id(), 'Revisado') $$,
  'NOT_FOUND',
  'repartidor inexistente: NOT_FOUND'
);
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_pend(), 'Revisado') $$,
  'INVALID_STATE_TRANSITION',
  'pending: INVALID_STATE_TRANSITION (la primera decisión sigue en admin_decide_courier)'
);
select throws_matching(
  $$ select public.admin_reinstate_courier(pg_temp.courier_incomplete(), 'Revisado') $$,
  'INVALID_STATE_TRANSITION',
  'suspendido con onboarding incompleto: INVALID_STATE_TRANSITION'
);

select pg_temp.reset_actor();
select is(pg_temp.courier_status(pg_temp.courier_susp()), 'suspended', 'los rechazos no cambiaron a courier_susp');
select is(pg_temp.courier_status(pg_temp.courier_pend()), 'pending', 'pending sigue pending');
select is(pg_temp.courier_status(pg_temp.courier_incomplete()), 'suspended', 'onboarding incompleto sigue suspended');
select is(
  (select count(*)::int from public.audit_log
   where action = 'admin_reinstate_courier'
     and target_id in (
       pg_temp.courier_susp()::text, pg_temp.courier_rej()::text, pg_temp.courier_appr()::text,
       pg_temp.courier_pend()::text, pg_temp.courier_incomplete()::text, pg_temp.missing_id()::text
     )),
  0,
  'ningún rechazo escribió auditoría (solo los repartidores de este test: la base puede traer filas de otras suites)'
);

-- 5. Reactivar un suspendido
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
create table pg_temp.reinstate_susp as
select public.admin_reinstate_courier(pg_temp.courier_susp(), '  Incidente aclarado  ') as res;

select is(
  (select res from pg_temp.reinstate_susp),
  jsonb_build_object('courierId', pg_temp.courier_susp(), 'previousStatus', 'suspended', 'status', 'approved', 'idempotent', false),
  'reactivar devuelve previousStatus suspended e idempotent false'
);

select pg_temp.reset_actor();
select is(pg_temp.courier_status(pg_temp.courier_susp()), 'approved', 'courier_susp queda approved');
select is(
  (select available from public.couriers where profile_id = pg_temp.courier_susp()),
  false,
  'vuelve sin disponibilidad (available = false)'
);
select ok(
  (select deactivated_at is null from public.couriers where profile_id = pg_temp.courier_susp()),
  'deactivated_at vuelve a null'
);
select is(
  (select decided_by from public.couriers where profile_id = pg_temp.courier_susp()),
  pg_temp.admin_a(),
  'decided_by es el admin que reactivó'
);
select ok(
  (select decided_at > now() - interval '1 minute' from public.couriers where profile_id = pg_temp.courier_susp()),
  'decided_at se actualiza'
);
select is(pg_temp.reinstate_audits(pg_temp.courier_susp()), 1, 'reactivar escribe una fila de auditoría');
select is(
  (select before from public.audit_log where action = 'admin_reinstate_courier' and target_id = pg_temp.courier_susp()::text),
  jsonb_build_object('status', 'suspended'),
  'auditoría before = {status: suspended}'
);
select is(
  (select after from public.audit_log where action = 'admin_reinstate_courier' and target_id = pg_temp.courier_susp()::text),
  jsonb_build_object('status', 'approved', 'reason', 'Incidente aclarado'),
  'auditoría after = {status: approved, reason} con el motivo recortado'
);
select is(
  (select actor_id from public.audit_log where action = 'admin_reinstate_courier' and target_id = pg_temp.courier_susp()::text),
  pg_temp.admin_a(),
  'la auditoría registra al admin como actor'
);
select is(
  (select status::text from public.offers where request_id = pg_temp.req_1() and courier_id = pg_temp.courier_susp()),
  'withdrawn',
  'la oferta retirada por la suspensión no se restaura'
);

-- 6. Reintento sobre el ya aprobado: idempotente, sin update ni auditoría
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select is(
  public.admin_reinstate_courier(pg_temp.courier_susp(), 'Doble clic'),
  jsonb_build_object('courierId', pg_temp.courier_susp(), 'previousStatus', 'approved', 'status', 'approved', 'idempotent', true),
  'reintento sobre approved: previousStatus approved e idempotent true'
);
select pg_temp.reset_actor();
select is(pg_temp.reinstate_audits(pg_temp.courier_susp()), 1, 'el reintento no duplica la auditoría');

-- 7. Reconsiderar un rechazado
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select is(
  public.admin_reinstate_courier(pg_temp.courier_rej(), 'Documentación revisada'),
  jsonb_build_object('courierId', pg_temp.courier_rej(), 'previousStatus', 'rejected', 'status', 'approved', 'idempotent', false),
  'reconsiderar devuelve previousStatus rejected'
);
select pg_temp.reset_actor();
select is(pg_temp.courier_status(pg_temp.courier_rej()), 'approved', 'courier_rej queda approved');
select is(pg_temp.reinstate_audits(pg_temp.courier_rej()), 1, 'reconsiderar escribe una fila de auditoría');

-- 8. Un aprobado previo (nunca suspendido) también es idempotente y no audita
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select is(
  (public.admin_reinstate_courier(pg_temp.courier_appr(), 'Sin cambios'))->>'idempotent',
  'true',
  'repartidor ya aprobado: idempotent true'
);
select pg_temp.reset_actor();
select is(pg_temp.reinstate_audits(pg_temp.courier_appr()), 0, 'sin auditoría para el aprobado previo');

-- 9. Bypass directo: el repartidor no puede cambiar couriers.status por tabla
select pg_temp.act_as(pg_temp.courier_incomplete());
create table pg_temp.bypass_res as select pg_temp.try_direct_status_update(pg_temp.courier_incomplete()) as outcome;
select pg_temp.reset_actor();
select is(
  pg_temp.courier_status(pg_temp.courier_incomplete()),
  'suspended',
  'un update directo de couriers.status no tiene efecto (RLS/privilegios)'
);

-- 10. Después de reactivar y activar la disponibilidad, submit_offer vuelve a aceptar
select pg_temp.act_as(pg_temp.courier_susp());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_2(), 1500, 15, 'Sin disponibilidad todavía') $$,
  'P0001'::char(5),
  null::text,
  'reactivado pero sin disponibilidad: submit_offer rechaza'
);
select lives_ok(
  $$ select public.set_availability(true) $$,
  'el repartidor reactivado activa su disponibilidad'
);
select lives_ok(
  $$ select public.submit_offer(pg_temp.req_2(), 1500, 15, 'Oferta después de reactivar') $$,
  'reactivado y disponible: submit_offer acepta'
);
select pg_temp.reset_actor();
select is(
  (select status::text from public.offers where request_id = pg_temp.req_2() and courier_id = pg_temp.courier_susp()),
  'pending',
  'la oferta nueva queda pending'
);

-- 11. La auditoría no guarda datos de contacto ni de documentos
select ok(
  not exists (
    select 1 from public.audit_log
    where action = 'admin_reinstate_courier'
      and target_id in (pg_temp.courier_susp()::text, pg_temp.courier_rej()::text)
      and (after ? 'phone' or after ? 'dni' or after ? 'storage_path' or before ? 'phone')
  ),
  'auditoría sin teléfono, DNI ni rutas de documentos'
);

-- 12. admin_decide_courier sigue igual: no decide desde suspended (D03 intacta)
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select throws_matching(
  $$ select public.admin_decide_courier(pg_temp.courier_incomplete(), 'approved', 'Intento') $$,
  'INVALID_STATE_TRANSITION',
  'admin_decide_courier sigue rechazando desde suspended (D03)'
);

select pg_temp.reset_actor();
select * from finish();
rollback;
