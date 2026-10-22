begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(36);

-- CC-036 / T-390 (SEC-04): offers queda de solo lectura para los clientes; toda escritura pasa por las RPC.

create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000036a1'::uuid $$;
create function pg_temp.merchant_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000036b1'::uuid $$;
create function pg_temp.courier_a_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000036c1'::uuid $$;
create function pg_temp.courier_b_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000036c2'::uuid $$;
create function pg_temp.req_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000003601'::uuid $$;
create function pg_temp.req_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000003602'::uuid $$;
create function pg_temp.offer_b_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000036f1'::uuid $$;

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
      jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', 'aal2')::text,
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

create function pg_temp.offer_of(p_request_id uuid, p_courier_id uuid)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select id from public.offers
  where request_id = p_request_id and courier_id = p_courier_id
  order by created_at desc
  limit 1;
$$;

do $$
declare
  v_zone_id uuid;
begin
  select id into v_zone_id from public.zones where active limit 1;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-cc036@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm-cc036@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.courier_a_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ca-cc036@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_b_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cb-cc036@example.test', 'pwd', '{"role": "courier"}');

  update public.profiles set role = 'admin' where id = pg_temp.admin_id();
  update public.profiles set consent_status = 'active'
  where id in (pg_temp.merchant_id(), pg_temp.courier_a_id(), pg_temp.courier_b_id());

  update public.couriers set status = 'approved', available = true
  where profile_id in (pg_temp.courier_a_id(), pg_temp.courier_b_id());

  insert into public.platform_settings (key, value)
  values ('min_offer_ars', '1000'::jsonb)
  on conflict (key) do update set value = '1000'::jsonb;

  insert into public.delivery_requests (
    id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status, published_at, expires_at
  )
  values
    (pg_temp.req_1_id(), pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published', now() - interval '5 minutes', now() + interval '25 minutes'),
    (pg_temp.req_2_id(), pg_temp.merchant_id(), v_zone_id, v_zone_id, 'chico', 'cash', 'published', now() - interval '5 minutes', now() + interval '25 minutes');

  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, message, status)
  values (pg_temp.offer_b_id(), pg_temp.req_1_id(), pg_temp.courier_b_id(), 1500, 15, 'mensaje original', 'pending');
end;
$$;

-- 1-6. Privilegios de tabla y de columna: sin escritura para clientes.
select ok(not has_table_privilege('authenticated', 'public.offers', 'INSERT'), 'authenticated no tiene INSERT sobre offers');
select ok(not has_table_privilege('authenticated', 'public.offers', 'UPDATE'), 'authenticated no tiene UPDATE sobre offers');
select ok(not has_table_privilege('authenticated', 'public.offers', 'DELETE'), 'authenticated no tiene DELETE sobre offers');
select ok(not has_table_privilege('authenticated', 'public.offers', 'TRUNCATE'), 'authenticated no tiene TRUNCATE sobre offers');
select ok(not has_table_privilege('anon', 'public.offers', 'INSERT'), 'anon no tiene INSERT sobre offers');
select ok(has_table_privilege('authenticated', 'public.offers', 'SELECT'), 'authenticated conserva SELECT sobre offers');

-- 7-9. El grant por columnas de CC-026 quedó revocado.
select ok(not has_column_privilege('authenticated', 'public.offers', 'amount_ars', 'UPDATE'), 'sin UPDATE de amount_ars');
select ok(not has_column_privilege('authenticated', 'public.offers', 'eta_minutes', 'UPDATE'), 'sin UPDATE de eta_minutes');
select ok(not has_column_privilege('authenticated', 'public.offers', 'message', 'UPDATE'), 'sin UPDATE de message');

-- 10-11. Solo quedan las policies de lectura.
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'offers' and cmd <> 'SELECT'),
  0::bigint,
  'offers no tiene policies de escritura'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'offers' and cmd = 'SELECT'),
  3::bigint,
  'offers conserva sus 3 policies de lectura'
);

-- 12-17. Repartidor aprobado: sin escritura directa.
select pg_temp.act_as('authenticated', pg_temp.courier_b_id());
select throws_ok(
  $$ insert into public.offers (request_id, courier_id, amount_ars, eta_minutes) values (pg_temp.req_2_id(), pg_temp.courier_b_id(), 1, 1) $$,
  '42501'::char(5), null::text,
  'repartidor no inserta una oferta directa (ni debajo del piso)'
);
select throws_ok(
  $$ update public.offers set amount_ars = 99999 where id = pg_temp.offer_b_id() $$,
  '42501'::char(5), null::text,
  'repartidor no cambia el monto de su oferta pending'
);
select throws_ok(
  $$ update public.offers set eta_minutes = 1 where id = pg_temp.offer_b_id() $$,
  '42501'::char(5), null::text,
  'repartidor no cambia el ETA de su oferta pending'
);
select throws_ok(
  $$ update public.offers set message = 'llamame al 381' where id = pg_temp.offer_b_id() $$,
  '42501'::char(5), null::text,
  'repartidor no cambia el mensaje de su oferta pending'
);
select throws_ok(
  $$ delete from public.offers where id = pg_temp.offer_b_id() $$,
  '42501'::char(5), null::text,
  'repartidor no borra su oferta'
);
select is(
  (select count(*) from public.offers where id = pg_temp.offer_b_id()),
  1::bigint,
  'repartidor sigue viendo su oferta (SELECT intacto)'
);

-- 18-19. La oferta no cambió.
select pg_temp.reset_actor();
select is(
  (select amount_ars from public.offers where id = pg_temp.offer_b_id()),
  1500,
  'el monto de la oferta no cambió'
);
select is(
  (select message from public.offers where id = pg_temp.offer_b_id()),
  'mensaje original',
  'el mensaje de la oferta no cambió'
);

-- 20-22. Comercio dueño: sin escritura directa, con lectura.
select pg_temp.act_as('authenticated', pg_temp.merchant_id());
select throws_ok(
  $$ update public.offers set status = 'accepted' where id = pg_temp.offer_b_id() $$,
  '42501'::char(5), null::text,
  'comercio no acepta una oferta sin la RPC'
);
select throws_ok(
  $$ insert into public.offers (request_id, courier_id, amount_ars, eta_minutes) values (pg_temp.req_2_id(), pg_temp.courier_a_id(), 1500, 15) $$,
  '42501'::char(5), null::text,
  'comercio no inserta ofertas'
);
select is(
  (select count(*) from public.offers where request_id = pg_temp.req_1_id()),
  1::bigint,
  'comercio ve las ofertas de su solicitud'
);

-- 23-24. Admin: sin escritura directa, con lectura.
select pg_temp.act_as('authenticated', pg_temp.admin_id());
select throws_ok(
  $$ update public.offers set amount_ars = 2000 where id = pg_temp.offer_b_id() $$,
  '42501'::char(5), null::text,
  'admin no edita ofertas directo'
);
select is(
  (select count(*) from public.offers where id = pg_temp.offer_b_id()),
  1::bigint,
  'admin ve las ofertas'
);

-- 25-26. Anónimo: sin escritura ni lectura de filas.
select pg_temp.act_as('anon');
select throws_ok(
  $$ insert into public.offers (request_id, courier_id, amount_ars, eta_minutes) values (pg_temp.req_2_id(), pg_temp.courier_a_id(), 1500, 15) $$,
  '42501'::char(5), null::text,
  'anon no inserta ofertas'
);
select throws_ok(
  $$ delete from public.offers $$,
  '42501'::char(5), null::text,
  'anon no borra ofertas'
);

-- 27-34. Camino feliz por RPC intacto.
select pg_temp.act_as('authenticated', pg_temp.courier_a_id());
select throws_ok(
  $$ select public.submit_offer(pg_temp.req_2_id(), 999, 15, null) $$,
  'P0001'::char(5), 'OFFER_BELOW_MINIMUM',
  'la RPC sigue aplicando el piso'
);
select lives_ok(
  $$ select public.submit_offer(pg_temp.req_2_id(), 1500, 15, 'voy') $$,
  'submit_offer crea la oferta'
);
select is(
  (select status::text from public.offers where id = pg_temp.offer_of(pg_temp.req_2_id(), pg_temp.courier_a_id())),
  'pending',
  'la oferta creada por RPC queda pending'
);
select lives_ok(
  $$ select public.withdraw_offer(pg_temp.offer_of(pg_temp.req_2_id(), pg_temp.courier_a_id())) $$,
  'withdraw_offer retira la oferta'
);
select is(
  (select status::text from public.offers where id = pg_temp.offer_of(pg_temp.req_2_id(), pg_temp.courier_a_id())),
  'withdrawn',
  'la oferta retirada por RPC queda withdrawn'
);
select lives_ok(
  $$ select public.submit_offer(pg_temp.req_2_id(), 1700, 20, 'reoferta') $$,
  'submit_offer reoferta después de retirar'
);
-- Las dos ofertas se crean en la misma transacción (mismo created_at): se lee la activa por estado.
select is(
  (select amount_ars from public.offers
   where request_id = pg_temp.req_2_id() and courier_id = pg_temp.courier_a_id() and status = 'pending'),
  1700,
  'la reoferta guarda el monto nuevo'
);

select pg_temp.act_as('authenticated', pg_temp.merchant_id());
select lives_ok(
  $$ select public.accept_offer(pg_temp.offer_b_id()) $$,
  'accept_offer acepta la oferta'
);

-- 35-36. La aceptación por RPC quedó escrita.
select pg_temp.reset_actor();
select is(
  (select status::text from public.offers where id = pg_temp.offer_b_id()),
  'accepted',
  'la oferta aceptada por RPC queda accepted'
);
select is(
  (select accepted_offer_id from public.delivery_requests where id = pg_temp.req_1_id()),
  pg_temp.offer_b_id(),
  'la solicitud apunta a la oferta aceptada'
);

select * from finish();
rollback;
