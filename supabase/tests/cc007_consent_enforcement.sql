begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(18);

-- 1. IDs para los actores de prueba
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000aa'::uuid $$;
create function pg_temp.active_merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000b1'::uuid $$;
create function pg_temp.pending_merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000b2'::uuid $$;
create function pg_temp.reconsent_merchant_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000b3'::uuid $$;
create function pg_temp.active_courier_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000c1'::uuid $$;
create function pg_temp.pending_courier_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000c2'::uuid $$;
create function pg_temp.reconsent_courier_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000c3'::uuid $$;
create function pg_temp.backfill_test_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000000d1'::uuid $$;

-- Helper para cambiar contexto de autenticacion
create function pg_temp.act_as(role_name text, actor_id uuid default null)
returns void
language plpgsql
as $$
begin
  if role_name = 'anon' then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

create function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Setup fixtures como superusuario
do $$
begin
  -- Usuarios en auth.users
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.com', 'pwd', '{"role":"merchant"}'::jsonb),
    (pg_temp.active_merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'active.m@test.com', 'pwd', '{"role":"merchant"}'::jsonb),
    (pg_temp.pending_merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending.m@test.com', 'pwd', '{"role":"merchant"}'::jsonb),
    (pg_temp.reconsent_merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reconsent.m@test.com', 'pwd', '{"role":"merchant"}'::jsonb),
    (pg_temp.active_courier_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'active.c@test.com', 'pwd', '{"role":"courier"}'::jsonb),
    (pg_temp.pending_courier_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending.c@test.com', 'pwd', '{"role":"courier"}'::jsonb),
    (pg_temp.reconsent_courier_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reconsent.c@test.com', 'pwd', '{"role":"courier"}'::jsonb),
    (pg_temp.backfill_test_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'backfill@test.com', 'pwd', '{"role":"merchant"}'::jsonb)
  on conflict (id) do nothing;

  -- Perfiles
  update public.profiles set role = 'admin', consent_status = 'active' where id = pg_temp.admin_id();
  update public.profiles set consent_status = 'active' where id in (pg_temp.active_merchant_id(), pg_temp.active_courier_id());
  update public.profiles set consent_status = 'reconsent_required' where id in (pg_temp.reconsent_merchant_id(), pg_temp.reconsent_courier_id());
  update public.profiles set consent_status = 'pending' where id in (pg_temp.pending_merchant_id(), pg_temp.pending_courier_id(), pg_temp.backfill_test_id());

  -- Tablas operativas
  update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.active_courier_id(), pg_temp.reconsent_courier_id());
  update public.couriers set status = 'pending', available = false where profile_id = pg_temp.pending_courier_id();

  -- Consentimientos para el active merchant
  insert into public.consents (profile_id, document, version)
  values
    (pg_temp.active_merchant_id(), 'tos', '1.0'),
    (pg_temp.active_merchant_id(), 'privacy', '1.0')
  on conflict do nothing;
end;
$$;

-- PRUEBA 1: pending merchant puede leer su propio perfil (allowlist minimo)
select pg_temp.act_as('authenticated', pg_temp.pending_merchant_id());
select is(
  (select count(*)::integer from public.profiles where id = pg_temp.pending_merchant_id()),
  1,
  'pending merchant can read own profile'
);

-- PRUEBA 2: pending merchant no puede leer su propia fila en merchants por RLS
select is(
  (select count(*)::integer from public.merchants where profile_id = pg_temp.pending_merchant_id()),
  0,
  'pending merchant denied operational access to merchants table via RLS'
);

-- PRUEBA 3: pending merchant no puede insertar requests por RLS
select throws_ok(
  $$
    insert into public.delivery_requests (
      merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method
    )
    values (
      pg_temp.pending_merchant_id(),
      (select id from public.zones where active limit 1),
      (select id from public.zones where active limit 1),
      'chico',
      'cash'
    )
  $$,
  '42501',
  null,
  'pending merchant cannot insert delivery_requests'
);

-- PRUEBA 4: reconsent_required merchant denegado en tabla merchants por RLS
select pg_temp.act_as('authenticated', pg_temp.reconsent_merchant_id());
select is(
  (select count(*)::integer from public.merchants where profile_id = pg_temp.reconsent_merchant_id()),
  0,
  'reconsent_required merchant denied operational access to merchants table via RLS'
);

-- PRUEBA 5: active merchant tiene acceso normal a merchants
select pg_temp.act_as('authenticated', pg_temp.active_merchant_id());
select is(
  (select count(*)::integer from public.merchants where profile_id = pg_temp.active_merchant_id()),
  1,
  'active merchant has normal operational access to merchants table'
);

-- PRUEBA 6: admin exento del gate de consentimiento operativo
select pg_temp.act_as('authenticated', pg_temp.admin_id());
select is(
  (select count(*)::integer from public.merchants),
  (select count(*)::integer from public.merchants),
  'admin is exempt and can see all merchants'
);

-- PRUEBA 7: pending courier no puede ver su fila de courier por RLS
select pg_temp.act_as('authenticated', pg_temp.pending_courier_id());
select is(
  (select count(*)::integer from public.couriers where profile_id = pg_temp.pending_courier_id()),
  0,
  'pending courier denied operational access to couriers table'
);

-- PRUEBA 8: RPC submit_offer rechaza a pending courier con UNAUTHORIZED_ACTOR
select throws_ok(
  $$
    select public.submit_offer(
      gen_random_uuid(),
      1500,
      20
    )
  $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'submit_offer rejects pending courier with UNAUTHORIZED_ACTOR'
);

-- PRUEBA 9: RPC publish_request rechaza a pending merchant con UNAUTHORIZED_ACTOR
select pg_temp.act_as('authenticated', pg_temp.pending_merchant_id());
select throws_ok(
  $$
    select public.publish_request(gen_random_uuid())
  $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'publish_request rejects pending merchant with UNAUTHORIZED_ACTOR'
);

-- PRUEBA 10: activate_account_consents no es ejecutable por authenticated
select throws_ok(
  $$
    select public.activate_account_consents(
      pg_temp.pending_merchant_id(),
      '1.0',
      '1.0'
    )
  $$,
  '42501',
  null,
  'activate_account_consents cannot be executed by authenticated role'
);

-- PRUEBA 11: activate_account_consents no es ejecutable por anon
select pg_temp.act_as('anon');
select throws_ok(
  $$
    select public.activate_account_consents(
      pg_temp.pending_merchant_id(),
      '1.0',
      '1.0'
    )
  $$,
  '42501',
  null,
  'activate_account_consents cannot be executed by anon role'
);

-- PRUEBA 12: activacion atomica como superusuario / service_role
select pg_temp.reset_actor();
select lives_ok(
  $$
    select public.activate_account_consents(
      pg_temp.pending_merchant_id(),
      '1.0',
      '1.0'
    )
  $$,
  'superuser can activate account consents atomically'
);

-- PRUEBA 13: tras activacion atomica, el perfil queda active
select is(
  (select consent_status::text from public.profiles where id = pg_temp.pending_merchant_id()),
  'active',
  'profile consent_status transitioned to active'
);

-- PRUEBA 14: y ambas filas (tos y privacy) existen en public.consents
select is(
  (select count(*)::integer from public.consents where profile_id = pg_temp.pending_merchant_id() and document in ('tos', 'privacy')),
  2,
  'both tos and privacy consents exist for activated profile'
);

-- PRUEBA 15: atomicidad: activate_account_consents rechaza admin (ADMIN_EXEMPT)
select throws_ok(
  $$
    select public.activate_account_consents(
      pg_temp.admin_id(),
      '1.0',
      '1.0'
    )
  $$,
  'P0001',
  'ADMIN_EXEMPT',
  'activate_account_consents rejects admin role'
);

-- PRUEBA 16: atomicidad: si faltan parametros, revierte sin tocar nada
select throws_ok(
  $$
    select public.activate_account_consents(
      pg_temp.reconsent_merchant_id(),
      '',
      '1.0'
    )
  $$,
  'P0001',
  'VALIDATION_ERROR',
  'activate_account_consents validates version strings'
);

select is(
  (select consent_status::text from public.profiles where id = pg_temp.reconsent_merchant_id()),
  'reconsent_required',
  'reconsent_required status unchanged after failed validation'
);

-- PRUEBA 17: Backfill completo: perfil con ambos consentimientos pasa a active
do $$
begin
  insert into public.consents (profile_id, document, version)
  values
    (pg_temp.backfill_test_id(), 'tos', '1.0'),
    (pg_temp.backfill_test_id(), 'privacy', '1.0')
  on conflict do nothing;

  update public.profiles p
  set consent_status = case
    when p.role = 'admin' then 'active'::public.consent_status
    when exists (
      select 1 from public.consents c1
      where c1.profile_id = p.id and c1.document = 'tos'
    ) and exists (
      select 1 from public.consents c2
      where c2.profile_id = p.id and c2.document = 'privacy'
    ) then 'active'::public.consent_status
    else 'pending'::public.consent_status
  end
  where p.id = pg_temp.backfill_test_id();
end;
$$;

select is(
  (select consent_status::text from public.profiles where id = pg_temp.backfill_test_id()),
  'active',
  'backfill with both consents results in active'
);

-- PRUEBA 18: Backfill incompleto: perfil con solo un consentimiento pasa a pending
do $$
begin
  delete from public.consents where profile_id = pg_temp.backfill_test_id() and document = 'privacy';

  update public.profiles p
  set consent_status = case
    when p.role = 'admin' then 'active'::public.consent_status
    when exists (
      select 1 from public.consents c1
      where c1.profile_id = p.id and c1.document = 'tos'
    ) and exists (
      select 1 from public.consents c2
      where c2.profile_id = p.id and c2.document = 'privacy'
    ) then 'active'::public.consent_status
    else 'pending'::public.consent_status
  end
  where p.id = pg_temp.backfill_test_id();
end;
$$;

select is(
  (select consent_status::text from public.profiles where id = pg_temp.backfill_test_id()),
  'pending',
  'backfill with missing consent results in pending'
);

select * from finish();
rollback;
