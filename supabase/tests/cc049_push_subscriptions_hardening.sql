-- CC-049 / T-432 (SEC-07): push_subscriptions solo por RPC (sin insert/update de clientes) y allowlist en la RPC.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(57);

create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000049' || lpad(n::text, 2, '0'))::uuid
$$;
create function pg_temp.merchant() returns uuid language sql immutable as $$ select pg_temp.id(1) $$;
create function pg_temp.merchant_b() returns uuid language sql immutable as $$ select pg_temp.id(2) $$;
create function pg_temp.sub_a() returns uuid language sql immutable as $$ select pg_temp.id(10) $$;
create function pg_temp.sub_b() returns uuid language sql immutable as $$ select pg_temp.id(11) $$;

-- Ejecuta una sentencia como `authenticated` con el sub dado; devuelve código, filas y mensaje.
create function pg_temp.run(p_uid uuid, p_sql text)
returns jsonb language plpgsql as $$
declare affected bigint;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
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

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.merchant(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc049.m@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.merchant_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc049.mb@example.test', 'pwd', '{"role":"merchant"}');
update public.profiles set consent_status = 'active' where id in (pg_temp.merchant(), pg_temp.merchant_b());

insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth, platform, created_at, last_seen_at)
values
  (pg_temp.sub_a(), pg_temp.merchant(), 'https://fcm.googleapis.com/fcm/send/cc049-a', 'p256dhA', 'authA', 'web',
   '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z'),
  (pg_temp.sub_b(), pg_temp.merchant_b(), 'https://fcm.googleapis.com/fcm/send/cc049-b', 'p256dhB', 'authB', 'web',
   '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z');

create temporary table cc049_snapshot on commit drop as
select id, to_jsonb(s) as row from public.push_subscriptions s where id in (pg_temp.sub_a(), pg_temp.sub_b());

create temporary table cc049_columns (col text primary key, val text not null) on commit drop;
insert into cc049_columns values
  ('user_id', quote_literal(pg_temp.merchant_b())),
  ('endpoint', quote_literal('https://push.example.com/hack')),
  ('p256dh', quote_literal('otraClave')),
  ('auth', quote_literal('otraAuth')),
  ('platform', 'null'),
  ('last_seen_at', 'now()');

-- 1-7. Probe de RLS (H01): con grants temporales en una subtransacción que se revierte, la RLS sola rechaza el insert y
-- deja el update en 0 filas. Los resultados quedan en una tabla; las aserciones van afuera.
create temporary table cc049_rls_probe (label text primary key, res jsonb) on commit drop;
do $$
declare
  v_results jsonb := '{}'::jsonb;
  c record;
begin
  begin
    grant insert, update on public.push_subscriptions to authenticated;
    v_results := v_results || jsonb_build_object('insert', pg_temp.run(pg_temp.merchant(),
      'insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), ''https://push.example.com/probe'', ''k'', ''a'')'));
    for c in select * from cc049_columns loop
      v_results := v_results || jsonb_build_object(c.col, pg_temp.run(pg_temp.merchant(),
        format('update public.push_subscriptions set %I = %s where id = %L', c.col, c.val, pg_temp.sub_a())));
    end loop;
    raise exception using errcode = 'U0049', message = 'cc049 rls probe rollback';
  exception when sqlstate 'U0049' then
    null;
  end;
  insert into cc049_rls_probe select key, value from jsonb_each(v_results);
end;
$$;

select is((select res ->> 'code' from cc049_rls_probe where label = 'insert'), '42501',
  'CC-049: con grant temporal, la RLS rechaza el insert directo');
select is(p.res, jsonb_build_object('code', '00000', 'rows', 0),
  format('CC-049: con grant temporal, la RLS deja en 0 filas el update de %s', p.label))
from cc049_rls_probe p where p.label <> 'insert' order by p.label;

-- 8-21. Grants (H01): revocados después del probe; anon sin ninguno.
select ok(not has_table_privilege('authenticated', 'public.push_subscriptions', p),
  format('CC-049: authenticated sin %s en push_subscriptions', p))
from unnest(array['INSERT', 'UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p;
select ok(has_table_privilege('authenticated', 'public.push_subscriptions', p),
  format('CC-049: authenticated conserva %s en push_subscriptions', p))
from unnest(array['SELECT', 'DELETE']) as p;
select ok(not has_table_privilege('anon', 'public.push_subscriptions', p),
  format('CC-049: anon sin %s en push_subscriptions', p))
from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p;

-- 22-23. El helper no es ejecutable por clientes.
select ok(not has_function_privilege('anon', 'app_private.is_allowed_push_endpoint(text)', 'execute'),
  'CC-049: anon sin execute sobre app_private.is_allowed_push_endpoint');
select ok(not has_function_privilege('authenticated', 'app_private.is_allowed_push_endpoint(text)', 'execute'),
  'CC-049: authenticated sin execute sobre app_private.is_allowed_push_endpoint');

-- 24-31. Bypass sin grant: insert, update de cada columna y truncate dan 42501; la fila no cambia.
select is(pg_temp.run(pg_temp.merchant(),
  'insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), ''https://push.example.com/x'', ''k'', ''a'')') ->> 'code',
  '42501', 'CC-049: insert directo de authenticated da 42501');
select is(pg_temp.run(pg_temp.merchant(),
  format('update public.push_subscriptions set %I = %s where id = %L', c.col, c.val, pg_temp.sub_a())) ->> 'code',
  '42501', format('CC-049: update directo de %s da 42501', c.col))
from cc049_columns c order by c.col;
select is(pg_temp.run(pg_temp.merchant(), 'truncate public.push_subscriptions') ->> 'code',
  '42501', 'CC-049: truncate de authenticated da 42501');

-- 32. La fila propia y la ajena quedan exactamente igual.
select ok((select bool_and(to_jsonb(s) = n.row) from public.push_subscriptions s join cc049_snapshot n on n.id = s.id),
  'CC-049: los intentos rechazados no cambian ninguna fila');

-- 33-36. Select y delete: la propia se ve; la ajena no se ve ni se borra.
select is(pg_temp.run(pg_temp.merchant(),
  format('select 1 from public.push_subscriptions where id = %L', pg_temp.sub_a())) ->> 'rows',
  '1', 'CC-049: el dueño ve su suscripción');
select is(pg_temp.run(pg_temp.merchant(),
  format('select 1 from public.push_subscriptions where id = %L', pg_temp.sub_b())) ->> 'rows',
  '0', 'CC-049: la suscripción ajena no se ve');
select is(pg_temp.run(pg_temp.merchant(),
  format('delete from public.push_subscriptions where id = %L', pg_temp.sub_b())) ->> 'rows',
  '0', 'CC-049: el delete de la suscripción ajena borra 0 filas');
select ok(exists (select 1 from public.push_subscriptions where id = pg_temp.sub_b()),
  'CC-049: la suscripción ajena sigue existiendo');

-- 37-55. La RPC aplica la tabla canónica E01–E19 (CC-049 §Impacto exacto).
create temporary table cc049_cases (case_id text primary key, endpoint text not null, expected boolean not null) on commit drop;
insert into cc049_cases values
  ('E01', 'https://fcm.googleapis.com/fcm/send/abc', true),
  ('E02', 'https://updates.push.services.mozilla.com/wpush/v2/abc', true),
  ('E03', 'https://web.push.apple.com/QAbc', true),
  ('E04', 'https://wns2-par02p.notify.windows.com/w/?token=abc', true),
  ('E05', 'https://FCM.GoogleAPIs.com/fcm/send/abc', true),
  ('E06', 'https://fcm.googleapis.com:443/fcm/send/abc', true),
  ('E07', 'http://fcm.googleapis.com/fcm/send/abc', false),
  ('E08', 'https://push.example.com/abc', false),
  ('E09', 'https://fcm.googleapis.com.evil.example/abc', false),
  ('E10', 'https://fcm.googleapis.com@evil.example/abc', false),
  ('E11', 'https://fcm.googleapis.com:8443/fcm/send/abc', false),
  ('E12', 'https://fcm.googleapis.com\evil.example/abc', false),
  ('E13', 'https://fcm.googleapis.com./fcm/send/abc', false),
  ('E14', 'https://fcm%2egoogleapis.com/fcm/send/abc', false),
  ('E15', 'https://[2001:db8::1]/fcm/send/abc', false),
  ('E16', 'https://fcm.googleapis.com', false),
  ('E17', 'https://notify.windows.com/w/?token=abc', false),
  ('E18', 'https://a.b.notify.windows.com/w/?token=abc', false),
  ('E19', 'https://evilnotify.windows.com/w/?token=abc', false);

create temporary table cc049_rpc_results on commit drop as
select c.case_id, c.endpoint, c.expected,
  pg_temp.run(pg_temp.merchant(), format('select public.register_push_subscription(%L::jsonb)',
    jsonb_build_object('endpoint', c.endpoint, 'p256dh', 'BKeyP256dh_valid', 'auth', 'AuthKey_valid'))) as res
from cc049_cases c order by c.case_id;

select is(
  case when r.res ->> 'code' = '00000' then 'aceptado' else r.res ->> 'message' end,
  case when r.expected then 'aceptado' else 'VALIDATION_ERROR' end,
  format('CC-049: register_push_subscription %s (%s)', r.case_id, r.endpoint))
from cc049_rpc_results r order by r.case_id;

-- 56. Los rechazados no escriben ni auditan.
select is(
  (select count(*)::integer from public.push_subscriptions s join cc049_cases c on c.endpoint = s.endpoint and not c.expected)
  + (select count(*)::integer from public.audit_log where action = 'push_subscription_reassigned'
       and actor_id = pg_temp.merchant()),
  0, 'CC-049: los endpoints rechazados no dejan filas ni auditoría');

-- 57. El dueño borra su suscripción.
select is(pg_temp.run(pg_temp.merchant(),
  format('delete from public.push_subscriptions where id = %L', pg_temp.sub_a())) ->> 'rows',
  '1', 'CC-049: el dueño borra su suscripción');

select * from finish();
rollback;
