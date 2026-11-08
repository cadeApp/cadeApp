-- CC-047 / T-408: acceso admin solo con aal2, sin escrituras directas privilegiadas, audit_log inmutable para
-- clientes, Storage sin acceso directo del admin, accept_offer sin rol admin y nota interna fuera de merchants.notes.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(92);

create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000047' || lpad(n::text, 2, '0'))::uuid
$$;
-- 1 admin · 2 comercio · 3 repartidor aprobado · 4 otro comercio
create function pg_temp.admin() returns uuid language sql immutable as $$ select pg_temp.id(1) $$;
create function pg_temp.merchant() returns uuid language sql immutable as $$ select pg_temp.id(2) $$;
create function pg_temp.courier() returns uuid language sql immutable as $$ select pg_temp.id(3) $$;
create function pg_temp.merchant_b() returns uuid language sql immutable as $$ select pg_temp.id(4) $$;
create function pg_temp.request() returns uuid language sql immutable as $$ select pg_temp.id(10) $$;
create function pg_temp.drop_1() returns uuid language sql immutable as $$ select pg_temp.id(11) $$;
create function pg_temp.offer() returns uuid language sql immutable as $$ select pg_temp.id(12) $$;
create function pg_temp.request_2() returns uuid language sql immutable as $$ select pg_temp.id(13) $$;

-- Ejecuta una sentencia como `authenticated` con el sub y el aal dados; devuelve código, filas y mensaje.
create function pg_temp.run(p_uid uuid, p_aal text, p_sql text)
returns jsonb language plpgsql as $$
declare affected bigint;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
  execute p_sql;
  get diagnostics affected = row_count;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('code', '00000', 'rows', affected);
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('code', sqlstate, 'message', sqlerrm);
end;
$$;

-- Cuenta filas de una consulta como `authenticated` con el sub y el aal dados.
create function pg_temp.count_as(p_uid uuid, p_aal text, p_sql text)
returns bigint language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
  execute format('select count(*) from (%s) q', p_sql) into v;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v;
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return -1;
end;
$$;

-- Intenta la escritura como admin y comprueba, como superusuario, que el valor no cambió.
create function pg_temp.write_blocked(p_aal text, p_sql text, p_unchanged text)
returns boolean language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.run(pg_temp.admin(), p_aal, p_sql);
  execute p_unchanged into v;
  return coalesce(v, false);
end;
$$;

-- Fixture como superusuario.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc047.admin@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.merchant(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc047.m@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.courier(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc047.c@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.merchant_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc047.mb@example.test', 'pwd', '{"role":"merchant"}');
update public.profiles set consent_status = 'active', display_name = 'Original', phone = '3865000047'
where id in (pg_temp.admin(), pg_temp.merchant(), pg_temp.courier(), pg_temp.merchant_b());
update public.profiles set role = 'admin' where id = pg_temp.admin();
update public.couriers set status = 'approved', available = true where profile_id = pg_temp.courier();
update public.merchants set business_name = 'Comercio CC047', notes = 'Referencia del comercio'
where profile_id = pg_temp.merchant();

insert into public.delivery_requests (id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
  recipient_payment_method, expires_at)
select pg_temp.request(), pg_temp.merchant(), 'published', z.id, z.id, 'chico', 'cash', now() + interval '1 hour'
from public.zones z where z.active order by z.id limit 1;
insert into public.delivery_requests (id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
  recipient_payment_method, published_at, expires_at)
select pg_temp.request_2(), pg_temp.merchant(), 'published', z.id, z.id, 'chico', 'cash',
  now() - interval '5 minutes', now() + interval '25 minutes'
from public.zones z where z.active order by z.id limit 1;
insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name,
  recipient_phone, recipient_consent_declared)
values (pg_temp.request(), 'San Martín 47', 'Belgrano 47', 'Destinatario 47', '3865470047', true);
insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type,
  recipient_payment_method, needs_change, status)
select pg_temp.drop_1(), pg_temp.request(), 1, dropoff_zone_id, 'chico', 'cash', false, 'pending'
from public.delivery_requests where id = pg_temp.request()
on conflict (request_id, position) do nothing;
insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, recipient_name, recipient_phone,
  recipient_consent_declared)
select d.id, 'Belgrano 47', 'Destinatario 47', '3865470047', true
from public.delivery_request_drops d where d.request_id = pg_temp.request() and d.position = 1
on conflict (drop_id) do nothing;
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
values (pg_temp.offer(), pg_temp.request(), pg_temp.courier(), 5000, 15, 'pending');

insert into public.consents (profile_id, document, version) values (pg_temp.courier(), 'tos', 'cc047');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (pg_temp.courier(), 'https://fcm.googleapis.com/fcm/send/cc047', 'p256dh', 'auth');
insert into public.rate_limits (subject, action, window_start, count) values ('cc047', 'cc047', now(), 1);
insert into public.audit_log (actor_id, action, target_type, target_id)
values (pg_temp.merchant(), 'cc047_fixture', 'merchant', pg_temp.merchant()::text);
insert into storage.objects (id, bucket_id, name, owner)
values (gen_random_uuid(), 'courier-docs', 'courier/' || pg_temp.courier() || '/cc047.png', pg_temp.courier());

-- D01=B: rate_limits sin lectura para nadie por PostgREST (policy USING false); la RPC sigue contando.
select is(pg_temp.count_as(pg_temp.admin(), 'aal1', $q$select 1 from public.rate_limits where subject = 'cc047'$q$),
  0::bigint, 'D01: admin aal1 no lee rate_limits');
select is(pg_temp.count_as(pg_temp.admin(), 'aal2', $q$select 1 from public.rate_limits where subject = 'cc047'$q$),
  0::bigint, 'D01: admin aal2 no lee rate_limits');
select is((select count(*) from public.rate_limits where subject = 'cc047'), 1::bigint,
  'D01: la fila de rate_limits existe (superusuario)');
select is(pg_temp.run(pg_temp.courier(), 'aal1', format(
  'select public.submit_offer(%L::uuid, 1500, 15, null)', pg_temp.request_2()))->>'code',
  '00000', 'D01: submit_offer de un repartidor aprobado sigue funcionando');
select is(
  (select count from public.rate_limits
   where subject = pg_temp.courier()::text and action = 'submit_offer' and window_start = date_trunc('minute', now())),
  1, 'D01: submit_offer registra su contador en rate_limits');

-- SEC-01: el admin no escribe directo, ni con aal1 ni con aal2; el valor no cambia.
select ok(pg_temp.write_blocked(a.aal, t.stmt, t.unchanged), 'SEC-01 ' || a.aal || ': ' || t.label)
from (values ('aal1'), ('aal2')) a(aal)
cross join lateral (values
  ('profiles.role',
   format('update public.profiles set role = %L where id = %L', 'admin', pg_temp.courier()),
   format('select role = %L from public.profiles where id = %L', 'courier', pg_temp.courier())),
  ('couriers.status',
   format('update public.couriers set status = %L where profile_id = %L', 'suspended', pg_temp.courier()),
   format('select status = %L from public.couriers where profile_id = %L', 'approved', pg_temp.courier())),
  ('merchants.subscription_status',
   format('update public.merchants set subscription_status = %L where profile_id = %L', 'cancelled', pg_temp.merchant()),
   format('select subscription_status <> %L from public.merchants where profile_id = %L', 'cancelled', pg_temp.merchant())),
  ('platform_settings.value',
   $q$update public.platform_settings set value = '987654'::jsonb where key = 'min_offer_ars'$q$,
   $q$select value <> '987654'::jsonb from public.platform_settings where key = 'min_offer_ars'$q$),
  ('delivery_requests.notes',
   format('update public.delivery_requests set notes = %L where id = %L', 'Hack', pg_temp.request()),
   format('select notes is null from public.delivery_requests where id = %L', pg_temp.request())),
  ('delivery_request_contacts',
   format('update public.delivery_request_contacts set recipient_name = %L where request_id = %L', 'Hack', pg_temp.request()),
   format('select recipient_name = %L from public.delivery_request_contacts where request_id = %L', 'Destinatario 47', pg_temp.request())),
  ('delivery_request_drops',
   format('update public.delivery_request_drops set package_type = %L where request_id = %L', 'grande', pg_temp.request()),
   format('select bool_and(package_type = %L) from public.delivery_request_drops where request_id = %L', 'chico', pg_temp.request())),
  ('delivery_request_drop_contacts',
   format('update public.delivery_request_drop_contacts set recipient_name = %L where drop_id in (select id from public.delivery_request_drops where request_id = %L)', 'Hack', pg_temp.request()),
   format('select bool_and(c.recipient_name = %L) from public.delivery_request_drop_contacts c join public.delivery_request_drops d on d.id = c.drop_id where d.request_id = %L', 'Destinatario 47', pg_temp.request())),
  ('consents',
   format('delete from public.consents where profile_id = %L', pg_temp.courier()),
   format('select count(*) = 1 from public.consents where profile_id = %L', pg_temp.courier())),
  ('push_subscriptions',
   format('delete from public.push_subscriptions where user_id = %L', pg_temp.courier()),
   format('select count(*) = 1 from public.push_subscriptions where user_id = %L', pg_temp.courier())),
  ('rate_limits',
   $q$delete from public.rate_limits where subject = 'cc047'$q$,
   $q$select count(*) = 1 from public.rate_limits where subject = 'cc047'$q$),
  ('zones.name',
   $q$update public.zones set name = 'CC047 hack' where id = (select id from public.zones where active order by id limit 1)$q$,
   $q$select count(*) = 0 from public.zones where name = 'CC047 hack'$q$)
) t(label, stmt, unchanged);

-- SEC-01: lecturas del admin solo con aal2.
select is(pg_temp.count_as(pg_temp.admin(), 'aal1', t.q), 0::bigint, 'SEC-01 aal1 no lee ' || t.label)
from (values
  ('delivery_request_contacts', format('select 1 from public.delivery_request_contacts where request_id = %L', pg_temp.request())),
  ('delivery_request_drop_contacts', format('select 1 from public.delivery_request_drop_contacts c join public.delivery_request_drops d on d.id = c.drop_id where d.request_id = %L', pg_temp.request())),
  ('profiles ajenos', format('select 1 from public.profiles where id = %L', pg_temp.courier())),
  ('audit_log', $q$select 1 from public.audit_log where action = 'cc047_fixture'$q$),
  ('merchant_public ajeno', format('select 1 from public.merchant_public where profile_id = %L', pg_temp.merchant()))
) t(label, q);
select ok(pg_temp.count_as(pg_temp.admin(), 'aal2', t.q) > 0, 'SEC-01 aal2 lee ' || t.label)
from (values
  ('delivery_request_contacts', format('select 1 from public.delivery_request_contacts where request_id = %L', pg_temp.request())),
  ('delivery_request_drop_contacts', format('select 1 from public.delivery_request_drop_contacts c join public.delivery_request_drops d on d.id = c.drop_id where d.request_id = %L', pg_temp.request())),
  ('profiles ajenos', format('select 1 from public.profiles where id = %L', pg_temp.courier())),
  ('audit_log', $q$select 1 from public.audit_log where action = 'cc047_fixture'$q$),
  ('merchant_public ajeno', format('select 1 from public.merchant_public where profile_id = %L', pg_temp.merchant()))
) t(label, q);

-- H02: ninguna policy de escritura de public referencia is_admin() (incluye FOR ALL y cualquier nombre). Cubre
-- delivery_request_drops y sus contactos, donde el trigger de T-340 ya rechazaba la escritura ajena.
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and cmd <> 'SELECT'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'app_private[.]is_admin[[:space:]]*[(]'),
  0::bigint, 'SEC-01: ninguna policy de escritura de public usa is_admin()');

-- Las RPC admin con aal2 siguen escribiendo y auditando.
select is(
  pg_temp.run(pg_temp.admin(), 'aal2', $q$select public.admin_update_setting('max_drops_per_request', '3'::jsonb)$q$)->>'code',
  '00000', 'admin_update_setting con aal2 funciona');
select ok(
  exists (select 1 from public.audit_log where action = 'admin_update_setting' and target_id = 'max_drops_per_request'),
  'admin_update_setting deja su fila en audit_log');

-- SEC-11: tres historias. En todas, merchants.notes queda igual y la nota de esa llamada queda en la auditoría.
create function pg_temp.last_admin_note(p_merchant uuid) returns text language sql as $$
  select after->>'notes' from public.audit_log
  where action = 'admin_set_subscription' and target_id = p_merchant::text order by id desc limit 1
$$;
create function pg_temp.set_sub(p_merchant uuid, p_note text) returns text language sql as $$
  select pg_temp.run(pg_temp.admin(), 'aal2', format(
    'select public.admin_set_subscription(%L::uuid, %L, null, %L)', p_merchant, 'active', p_note))->>'code'
$$;

-- Historia 1: la nota del comercio es igual a la que manda el admin.
update public.merchants set notes = 'Nota uno' where profile_id = pg_temp.merchant();
select is(pg_temp.set_sub(pg_temp.merchant(), 'Nota uno'), '00000', 'SEC-11 igual: admin_set_subscription funciona');
select is((select notes from public.merchants where profile_id = pg_temp.merchant()), 'Nota uno',
  'SEC-11 igual: merchants.notes no cambia');
select is(pg_temp.last_admin_note(pg_temp.merchant()), 'Nota uno', 'SEC-11 igual: la nota queda en la auditoría');

-- Historia 2: la nota del comercio es distinta.
update public.merchants set notes = 'Referencia del comercio' where profile_id = pg_temp.merchant();
select is(pg_temp.set_sub(pg_temp.merchant(), 'Nota dos'), '00000', 'SEC-11 distinta: admin_set_subscription funciona');
select is((select notes from public.merchants where profile_id = pg_temp.merchant()), 'Referencia del comercio',
  'SEC-11 distinta: merchants.notes no cambia');
select is(pg_temp.last_admin_note(pg_temp.merchant()), 'Nota dos', 'SEC-11 distinta: la nota queda en la auditoría');

-- Historia 3: el comercio reescribe su nota y el admin vuelve a mandar otra.
select is(pg_temp.run(pg_temp.merchant(), 'aal1', format(
  'update public.merchants set notes = %L where profile_id = %L', 'Reescrita por el comercio', pg_temp.merchant()))->>'rows',
  '1', 'SEC-11 reescrita: el comercio edita su propia nota');
select is(pg_temp.set_sub(pg_temp.merchant(), 'Nota tres'), '00000', 'SEC-11 reescrita: admin_set_subscription funciona');
select is((select notes from public.merchants where profile_id = pg_temp.merchant()), 'Reescrita por el comercio',
  'SEC-11 reescrita: merchants.notes conserva la nota del comercio');
select is(pg_temp.last_admin_note(pg_temp.merchant()), 'Nota tres', 'SEC-11 reescrita: la nota nueva queda en la auditoría');

-- D2=B: la consulta de candidatos distingue coincidencia de diferencia y no devuelve textos.
update public.merchants set notes = 'Nota tres' where profile_id = pg_temp.merchant();
update public.merchants set notes = 'Texto propio del otro comercio' where profile_id = pg_temp.merchant_b();
select is(pg_temp.set_sub(pg_temp.merchant_b(), 'Nota del otro comercio'), '00000',
  'D2: admin_set_subscription sobre el otro comercio funciona');
create temp table cc047_candidatos on commit drop as
with ultimas as (
  select distinct on (a.target_id)
         a.target_id, a.id as audit_id, a.created_at, a.after ->> 'notes' as nota_admin
  from public.audit_log as a
  where a.action = 'admin_set_subscription' and a.target_type = 'merchant' and a.after ->> 'notes' is not null
  order by a.target_id, a.id desc
)
select m.profile_id as merchant_id, u.audit_id, u.created_at as audit_created_at,
       'COINCIDE_REVISAR_AUTORIA'::text as resultado
from public.merchants as m
join ultimas as u on u.target_id = m.profile_id::text
where m.notes is not null and m.notes = u.nota_admin;
select is((select array_agg(merchant_id) from cc047_candidatos where merchant_id in (pg_temp.merchant(), pg_temp.merchant_b())),
  array[pg_temp.merchant()], 'D2: la consulta devuelve el comercio que coincide y no el distinto');
select ok(not exists (select 1 from cc047_candidatos c where to_jsonb(c)::text ~ 'Nota|Texto'),
  'D2: la consulta no devuelve el texto de las notas');

-- SEC-02: audit_log sin escritura para clientes.
select ok(not has_table_privilege(t.r, 'public.audit_log', t.p), 'SEC-02: ' || t.r || ' sin ' || t.p)
from (values ('anon'), ('authenticated')) r(r)
cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) p(p)
cross join lateral (select r.r, p.p) t;
select ok(not has_table_privilege('anon', 'public.audit_log', 'TRUNCATE'), 'SEC-02: anon sin TRUNCATE');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE'), 'SEC-02: authenticated sin TRUNCATE');
-- Ni con aal2 el admin edita o borra la auditoría.
select ok(pg_temp.write_blocked('aal2',
  $q$update public.audit_log set action = 'hack' where action = 'cc047_fixture'$q$,
  $q$select count(*) = 1 from public.audit_log where action = 'cc047_fixture'$q$), 'SEC-02: admin aal2 no edita audit_log');
select ok(pg_temp.write_blocked('aal2',
  $q$delete from public.audit_log where action = 'cc047_fixture'$q$,
  $q$select count(*) = 1 from public.audit_log where action = 'cc047_fixture'$q$), 'SEC-02: admin aal2 no borra audit_log');

-- El trigger (security invoker) rechaza aunque vuelvan el grant y una policy permisiva.
grant update, delete, truncate on public.audit_log to authenticated;
create policy cc047_tmp_all on public.audit_log for all to authenticated using (true) with check (true);
select is(pg_temp.run(pg_temp.admin(), 'aal2',
  $q$update public.audit_log set action = 'hack' where action = 'cc047_fixture'$q$)->>'message',
  'AUDIT_LOG_IMMUTABLE', 'SEC-02: el trigger rechaza UPDATE de authenticated con grant y policy');
select is(pg_temp.run(pg_temp.admin(), 'aal2',
  $q$delete from public.audit_log where action = 'cc047_fixture'$q$)->>'message',
  'AUDIT_LOG_IMMUTABLE', 'SEC-02: el trigger rechaza DELETE de authenticated con grant y policy');
select is(pg_temp.run(pg_temp.admin(), 'aal2', 'truncate public.audit_log')->>'message',
  'AUDIT_LOG_IMMUTABLE', 'SEC-02: el trigger rechaza TRUNCATE de authenticated con grant');
drop policy cc047_tmp_all on public.audit_log;
revoke update, delete, truncate on public.audit_log from authenticated;

-- Service role y la acción de FK siguen funcionando.
set local role service_role;
delete from public.audit_log where action = 'cc047_fixture';
reset role;
select is((select count(*) from public.audit_log where action = 'cc047_fixture'), 0::bigint,
  'SEC-02: service role sigue pudiendo limpiar audit_log');
insert into public.audit_log (actor_id, action, target_type, target_id)
values (pg_temp.merchant_b(), 'cc047_fk', 'merchant', pg_temp.merchant_b()::text);
delete from auth.users where id = pg_temp.merchant_b();
select is((select actor_id from public.audit_log where action = 'cc047_fk'), null::uuid,
  'SEC-02: borrar un perfil pone actor_id en null sin chocar con el trigger');

-- SEC-03: el admin no ve objetos de courier-docs.
select is(pg_temp.count_as(pg_temp.admin(), 'aal2',
  $q$select 1 from storage.objects where bucket_id = 'courier-docs'$q$), 0::bigint,
  'SEC-03: admin aal2 no ve courier-docs en storage.objects');
select ok(pg_temp.write_blocked('aal2',
  format($q$insert into storage.objects (bucket_id, name, owner) values ('courier-docs', %L, %L)$q$,
    'courier/' || pg_temp.courier() || '/admin-cc047.png', pg_temp.admin()),
  format($q$select count(*) = 0 from storage.objects where bucket_id = 'courier-docs' and name = %L$q$,
    'courier/' || pg_temp.courier() || '/admin-cc047.png')),
  'SEC-03: admin aal2 no sube objetos a courier-docs');
select ok(pg_temp.write_blocked('aal2',
  format($q$update storage.objects set name = name || '.x' where bucket_id = 'courier-docs' and name = %L$q$,
    'courier/' || pg_temp.courier() || '/cc047.png'),
  format($q$select count(*) = 1 from storage.objects where bucket_id = 'courier-docs' and name = %L$q$,
    'courier/' || pg_temp.courier() || '/cc047.png')),
  'SEC-03: admin aal2 no renombra objetos de courier-docs');
select ok(pg_temp.write_blocked('aal2',
  format($q$delete from storage.objects where bucket_id = 'courier-docs' and name = %L$q$,
    'courier/' || pg_temp.courier() || '/cc047.png'),
  format($q$select count(*) = 1 from storage.objects where bucket_id = 'courier-docs' and name = %L$q$,
    'courier/' || pg_temp.courier() || '/cc047.png')),
  'SEC-03: admin aal2 no borra objetos de courier-docs');

-- SEC-10: accept_offer no acepta el rol admin.
select is(pg_temp.run(pg_temp.admin(), 'aal2', format('select public.accept_offer(%L::uuid)', pg_temp.offer()))->>'message',
  'UNAUTHORIZED_ACTOR', 'SEC-10: accept_offer como admin aal2 da UNAUTHORIZED_ACTOR');

-- D1: RPC administrativas auditadas.
select is(pg_temp.run(pg_temp.admin(), 'aal2', format(
  'select public.admin_correct_courier_display_name(%L::uuid, %L)', pg_temp.courier(), 'Nombre Corregido'))->>'code',
  '00000', 'D1: admin_correct_courier_display_name con aal2 funciona');
select ok(
  (select display_name = 'Nombre Corregido' from public.profiles where id = pg_temp.courier())
  and exists (select 1 from public.audit_log where action = 'admin_correct_courier_display_name'
              and target_id = pg_temp.courier()::text),
  'D1: el nombre cambia y queda auditado');
select is(pg_temp.run(pg_temp.admin(), 'aal1', format(
  'select public.admin_correct_courier_display_name(%L::uuid, %L)', pg_temp.courier(), 'Otro'))->>'message',
  'AAL2_REQUIRED', 'D1: con aal1 da AAL2_REQUIRED');
select is(pg_temp.run(pg_temp.merchant(), 'aal2', format(
  'select public.admin_revoke_courier_consent(%L::uuid)', pg_temp.courier()))->>'message',
  'UNAUTHORIZED_ACTOR', 'D1: un no admin da UNAUTHORIZED_ACTOR');
select is(
  array[
    pg_temp.run(pg_temp.admin(), 'aal2', format('select public.admin_correct_courier_display_name(%L::uuid, %L)', pg_temp.courier(), ''))->>'message',
    pg_temp.run(pg_temp.admin(), 'aal2', format('select public.admin_correct_courier_display_name(%L::uuid, %L)', pg_temp.courier(), ' Espacio'))->>'message',
    pg_temp.run(pg_temp.admin(), 'aal2', format('select public.admin_correct_courier_display_name(%L::uuid, %L)', pg_temp.courier(), repeat('x', 121)))->>'message',
    pg_temp.run(pg_temp.admin(), 'aal2', format('select public.admin_correct_courier_display_name(%L::uuid, %L)', gen_random_uuid(), 'Nombre'))->>'message',
    pg_temp.run(pg_temp.admin(), 'aal2', format('select public.admin_revoke_courier_consent(%L::uuid)', pg_temp.merchant()))->>'message'
  ],
  array['VALIDATION_ERROR', 'VALIDATION_ERROR', 'VALIDATION_ERROR', 'NOT_FOUND', 'NOT_FOUND'],
  'D1: nombre vacío, con espacios o largo da VALIDATION_ERROR; perfil inexistente o no repartidor da NOT_FOUND');
select is(
  pg_temp.run(pg_temp.admin(), 'aal2', format('select public.admin_revoke_courier_consent(%L::uuid)', pg_temp.courier()))->>'code',
  '00000', 'D1: admin_revoke_courier_consent con aal2 funciona');
-- Sentencia aparte: dentro de un mismo AND, Postgres puede evaluar la subconsulta antes que la llamada.
select ok(
  (select consent_status = 'reconsent_required' from public.profiles where id = pg_temp.courier())
  and exists (select 1 from public.audit_log where action = 'admin_revoke_courier_consent'
              and target_id = pg_temp.courier()::text),
  'D1: el consentimiento pasa a reconsent_required y queda auditado');

-- D3: autoservicio de la cuenta admin, por nivel y por campo. Los campos privilegiados ajenos (couriers.status,
-- merchants.subscription_status, platform_settings.value y contactos) están cubiertos por la matriz SEC-01.
select ok(pg_temp.write_blocked(a.aal,
  format('update public.profiles set %I = %L where id = %L', t.col, t.val, pg_temp.admin()),
  format('select %I::text = %L from public.profiles where id = %L', t.col, t.keep, pg_temp.admin())),
  'D3 ' || a.aal || ': la cuenta admin no cambia su ' || t.col)
from (values ('aal1'), ('aal2')) a(aal)
cross join (values ('role', 'merchant', 'admin'), ('consent_status', 'pending', 'active')) t(col, val, keep);
select is(
  pg_temp.run(pg_temp.admin(), 'aal1', format('update public.profiles set phone = %L where id = %L', '3865999041', pg_temp.admin()))->>'rows',
  '1', 'D3 aal1: la cuenta admin edita su teléfono');
select is((select phone from public.profiles where id = pg_temp.admin()), '3865999041', 'D3 aal1: el teléfono cambia');
select is(
  pg_temp.run(pg_temp.admin(), 'aal2', format('update public.profiles set phone = %L where id = %L', '3865999042', pg_temp.admin()))->>'rows',
  '1', 'D3 aal2: la cuenta admin edita su teléfono');
select is((select phone from public.profiles where id = pg_temp.admin()), '3865999042', 'D3 aal2: el teléfono cambia');
select is(
  pg_temp.run(pg_temp.admin(), 'aal2', format('select public.register_push_subscription(%L::jsonb)',
    jsonb_build_object('endpoint', 'https://fcm.googleapis.com/fcm/send/cc047-admin', 'p256dh', 'BKeyP256dh_valid-base64url',
      'auth', 'AuthKey_valid-1', 'platform', 'web')))->>'code',
  '00000', 'D3: la cuenta admin registra su suscripción push');
select is((select user_id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/cc047-admin'),
  pg_temp.admin(), 'D3: la suscripción push queda a nombre del admin');

select * from finish();
rollback;
