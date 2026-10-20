begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(41);

-- CC-035 (T-386): register_push_subscription registra la suscripción y reasigna el endpoint a la cuenta logueada.
create function pg_temp.merchant_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000035b1'::uuid $$;
create function pg_temp.courier_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000035c1'::uuid $$;
create function pg_temp.merchant_pending() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000035b2'::uuid $$;
create function pg_temp.admin_d() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000035a1'::uuid $$;
create function pg_temp.endpoint() returns text language sql as $$ select 'https://fcm.googleapis.com/fcm/send/cc035-endpoint-abc' $$;
create function pg_temp.admin_endpoint() returns text language sql as $$ select 'https://fcm.googleapis.com/fcm/send/cc035-admin-xyz' $$;

create function pg_temp.payload(p_endpoint text, p_p256dh text default 'BKeyP256dh_valid-base64url', p_auth text default 'AuthKey_valid-1', p_platform text default 'web')
returns jsonb language sql as $$
  select jsonb_build_object('endpoint', p_endpoint, 'p256dh', p_p256dh, 'auth', p_auth, 'platform', p_platform);
$$;

create function pg_temp.act_as(actor_id uuid)
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', 'aal1')::text,
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
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal1')::text, true);
end;
$$;

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Intento directo por tabla con el rol del actor (security invoker); un error no aborta la transacción del test.
create function pg_temp.try_direct_owner_update(p_endpoint text, p_new_owner uuid)
returns text language plpgsql as $$
begin
  update public.push_subscriptions set user_id = p_new_owner where endpoint = p_endpoint;
  return 'no-error';
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant_a(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc35.a@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_b(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc35.b@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.merchant_pending(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc35.pending@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.admin_d(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc35.admin@example.test', 'pwd', '{"role":"merchant"}'::jsonb);

update public.profiles set consent_status = 'active' where id in (pg_temp.merchant_a(), pg_temp.courier_b());
update public.profiles set consent_status = 'pending' where id in (pg_temp.merchant_pending(), pg_temp.admin_d());
update public.profiles set role = 'admin' where id = pg_temp.admin_d();

-- 1. Firma, seguridad y grants
select has_function('public', 'register_push_subscription', array['jsonb'], 'CC-035 expone register_push_subscription(jsonb)');
select ok(
  (select prosecdef from pg_proc where oid = 'public.register_push_subscription(jsonb)'::regprocedure),
  'register_push_subscription es security definer'
);
select ok(
  (select proconfig @> array['search_path=public, pg_temp'] from pg_proc where oid = 'public.register_push_subscription(jsonb)'::regprocedure),
  'register_push_subscription fija search_path = public, pg_temp'
);
select ok(
  not has_function_privilege('anon', 'public.register_push_subscription(jsonb)', 'EXECUTE'),
  'anon no tiene execute'
);
select ok(
  not has_function_privilege('public', 'public.register_push_subscription(jsonb)', 'EXECUTE'),
  'public no tiene execute'
);
select ok(
  has_function_privilege('authenticated', 'public.register_push_subscription(jsonb)', 'EXECUTE'),
  'authenticated tiene execute'
);

-- 2. Actores rechazados
select pg_temp.act_as_anon();
select throws_ok(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint())) $$,
  '42501'::char(5),
  null::text,
  'anon no puede ejecutar register_push_subscription'
);

select pg_temp.act_as_authenticated_without_subject();
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint())) $$,
  'UNAUTHENTICATED',
  'sin sub en el JWT: UNAUTHENTICATED'
);

select pg_temp.act_as(pg_temp.merchant_pending());
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint())) $$,
  'UNAUTHORIZED_ACTOR',
  'comercio sin consentimiento activo: UNAUTHORIZED_ACTOR'
);

-- 3. Validaciones
select pg_temp.act_as(pg_temp.merchant_a());
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload('http://insecure.test/endpoint')) $$,
  'VALIDATION_ERROR',
  'endpoint sin https: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload('https://push.test/' || repeat('x', 2048))) $$,
  'VALIDATION_ERROR',
  'endpoint de más de 2048 caracteres: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint(), 'no valida!')) $$,
  'VALIDATION_ERROR',
  'p256dh fuera de base64url: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint(), 'BKeyP256dh', repeat('a', 257))) $$,
  'VALIDATION_ERROR',
  'auth de más de 256 caracteres: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint(), 'BKeyP256dh', 'AuthKey', 'ios')) $$,
  'VALIDATION_ERROR',
  'platform desconocida: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.register_push_subscription('"no es un objeto"'::jsonb) $$,
  'VALIDATION_ERROR',
  'payload que no es un objeto: VALIDATION_ERROR'
);
-- PR457-H01: `->>` convertiría estos valores en texto que pasa la regex; el tipo JSON tiene que ser string.
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint()) || jsonb_build_object('p256dh', true)) $$,
  'VALIDATION_ERROR',
  'p256dh booleano: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint()) || jsonb_build_object('auth', 12345)) $$,
  'VALIDATION_ERROR',
  'auth numérico: VALIDATION_ERROR'
);
select throws_matching(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint()) || jsonb_build_object('platform', jsonb_build_object('x', 1))) $$,
  'VALIDATION_ERROR',
  'platform objeto: VALIDATION_ERROR'
);

select pg_temp.reset_actor();
select is(
  (select count(*)::int from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  0,
  'los rechazos no crearon filas'
);

-- 4. Alta nueva
select pg_temp.act_as(pg_temp.merchant_a());
create table pg_temp.created_res as
select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint())) as res;

select is((select (res->>'created')::boolean from pg_temp.created_res), true, 'alta nueva: created true');
select is((select (res->>'reassigned')::boolean from pg_temp.created_res), false, 'alta nueva: reassigned false');

select pg_temp.reset_actor();
select is(
  (select user_id from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  pg_temp.merchant_a(),
  'la fila queda a nombre de la cuenta logueada'
);
select is(
  (select id::text from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  (select res->>'subscriptionId' from pg_temp.created_res),
  'subscriptionId es el id de la fila'
);
select is(
  (select platform from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  'web',
  'platform web guardada'
);

-- 5. Reintento de la misma cuenta: sin duplicar ni auditar
select pg_temp.act_as(pg_temp.merchant_a());
select is(
  public.register_push_subscription(pg_temp.payload(pg_temp.endpoint(), 'NuevaP256dh', 'NuevoAuth')),
  jsonb_build_object('subscriptionId', (select (res->>'subscriptionId')::uuid from pg_temp.created_res), 'created', false, 'reassigned', false),
  'reintento propio: created false, reassigned false y el mismo id'
);
select pg_temp.reset_actor();
select is(
  (select count(*)::int from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  1,
  'el reintento no duplica la fila'
);
select is(
  (select p256dh from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  'NuevaP256dh',
  'el reintento actualiza las claves'
);
select is(
  (select count(*)::int from public.audit_log
   where action = 'push_subscription_reassigned'
     and target_id = (select res->>'subscriptionId' from pg_temp.created_res)),
  0,
  'el reintento propio no audita'
);

-- 6. Otra cuenta en el mismo navegador: reasignación auditada sin exponer al dueño anterior
select pg_temp.act_as(pg_temp.courier_b());
create table pg_temp.reassign_res as
select public.register_push_subscription(pg_temp.payload(pg_temp.endpoint(), 'ClaveDeB', 'AuthDeB', null)) as res;

select is(
  (select res from pg_temp.reassign_res),
  jsonb_build_object('subscriptionId', (select (res->>'subscriptionId')::uuid from pg_temp.created_res), 'created', false, 'reassigned', true),
  'reasignación: created false, reassigned true y el mismo id'
);
select is(
  (select array_agg(k order by k) from pg_temp.reassign_res, jsonb_object_keys(res) as k),
  array['created', 'reassigned', 'subscriptionId'],
  'la salida tiene solo subscriptionId, created y reassigned (nunca el dueño anterior)'
);

select pg_temp.reset_actor();
select is(
  (select user_id from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  pg_temp.courier_b(),
  'el endpoint pasa a la cuenta logueada'
);
select is(
  (select auth from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  'AuthDeB',
  'la reasignación guarda las claves nuevas'
);
select ok(
  (select platform is null from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  'platform nula se guarda como null'
);
select is(
  (select count(*)::int from public.audit_log
   where action = 'push_subscription_reassigned'
     and target_id = (select res->>'subscriptionId' from pg_temp.created_res)),
  1,
  'la reasignación escribe una fila de auditoría'
);
select is(
  (select before from public.audit_log
   where action = 'push_subscription_reassigned'
     and target_id = (select res->>'subscriptionId' from pg_temp.created_res)),
  jsonb_build_object('user_id', pg_temp.merchant_a()),
  'auditoría before = {user_id: dueño anterior}'
);
select is(
  (select after from public.audit_log
   where action = 'push_subscription_reassigned'
     and target_id = (select res->>'subscriptionId' from pg_temp.created_res)),
  jsonb_build_object('user_id', pg_temp.courier_b()),
  'auditoría after = {user_id: cuenta logueada}'
);
select ok(
  not exists (
    select 1 from public.audit_log
    where action = 'push_subscription_reassigned'
      and target_id = (select res->>'subscriptionId' from pg_temp.created_res)
      and (before::text like '%fcm.googleapis%' or after::text like '%fcm.googleapis%'
           or before::text like '%AuthDeB%' or after::text like '%ClaveDeB%')
  ),
  'la auditoría no guarda el endpoint ni las claves'
);

-- 7. Bypass directo: el dueño anterior no puede recuperar la fila por tabla (RLS)
select pg_temp.act_as(pg_temp.merchant_a());
create table pg_temp.bypass_res as
select pg_temp.try_direct_owner_update(pg_temp.endpoint(), pg_temp.merchant_a()) as outcome;
select is(
  (select count(*)::int from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  0,
  'el dueño anterior ya no ve la fila reasignada (RLS)'
);
select pg_temp.reset_actor();
select is(
  (select user_id from public.push_subscriptions where endpoint = pg_temp.endpoint()),
  pg_temp.courier_b(),
  'un update directo de una fila ajena no tiene efecto'
);

-- 8. El admin registra aunque su consentimiento no esté activo (misma regla que la policy)
select pg_temp.act_as(pg_temp.admin_d());
select lives_ok(
  $$ select public.register_push_subscription(pg_temp.payload(pg_temp.admin_endpoint())) $$,
  'el admin con consentimiento pendiente puede registrar su suscripción'
);
select pg_temp.reset_actor();
select is(
  (select user_id from public.push_subscriptions where endpoint = pg_temp.admin_endpoint()),
  pg_temp.admin_d(),
  'la suscripción del admin queda a su nombre'
);

select pg_temp.reset_actor();
select * from finish();
rollback;
