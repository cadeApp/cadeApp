begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(28);

-- CC-041 (T-415): presencia de repartidores y conteo de conectados. Privilegios, autorización, señal con now(),
-- conteo (aprobados, disponibles, consentimiento activo, señal dentro de la ventana) y el parámetro nuevo.
create function pg_temp.u(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-0000004100' || lpad(n::text, 2, '0'))::uuid
$$;
-- 1 admin · 2 comercio · 3 comercio sin consentimiento activo
-- 4 repartidor A (aprobado, disponible) · 5 repartidor B (aprobado, disponible, señal vieja)
-- 6 repartidor C (aprobado, no disponible) · 7 repartidor suspendido · 8 repartidor pendiente
-- 9 repartidor aprobado sin consentimiento activo

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

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Ejecuta una consulta jsonb como el actor (null = sesión sin sujeto); devuelve {data} o {error}.
create function pg_temp.call(p_actor uuid, p_aal text, p_sql text)
returns jsonb language plpgsql as $$
declare
  v_result jsonb;
begin
  if p_actor is null then
    set local role authenticated;
    perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal2')::text, true);
  else
    perform pg_temp.act_as(p_actor, p_aal);
  end if;
  begin
    execute p_sql into v_result;
  exception when others then
    perform pg_temp.reset_actor();
    return jsonb_build_object('error', sqlerrm);
  end;
  perform pg_temp.reset_actor();
  return jsonb_build_object('data', v_result);
end;
$$;

create function pg_temp.err(p_result jsonb) returns text language sql as $$ select p_result->>'error' $$;
create function pg_temp.beat(p_actor uuid) returns jsonb language sql as $$
  select pg_temp.call(p_actor, 'aal1', 'select public.courier_heartbeat()')
$$;
create function pg_temp.online(p_actor uuid default null) returns jsonb language sql as $$
  select pg_temp.call(coalesce(p_actor, pg_temp.u(2)), 'aal1', 'select public.get_online_couriers_count()')
$$;
create function pg_temp.setting(p_key text, p_value text) returns jsonb language sql as $$
  select pg_temp.call(pg_temp.u(1), 'aal2', format('select public.admin_update_setting(%L, %L::jsonb)', p_key, p_value))
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.u(1), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.u(2), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.ma@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.u(3), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.mp@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.u(4), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.ca@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.u(5), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.cb@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.u(6), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.cc@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.u(7), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.cs@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.u(8), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.cp@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.u(9), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc041.cn@example.test', 'pwd', '{"role":"courier"}'::jsonb);

update public.profiles set consent_status = 'active'
where id in (pg_temp.u(1), pg_temp.u(2), pg_temp.u(4), pg_temp.u(5), pg_temp.u(6), pg_temp.u(7), pg_temp.u(8));
update public.profiles set role = 'admin' where id = pg_temp.u(1);
update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.u(4), pg_temp.u(5), pg_temp.u(9));
update public.couriers set status = 'approved', available = false where profile_id = pg_temp.u(6);
update public.couriers set status = 'suspended', available = false where profile_id = pg_temp.u(7);

create temp table baseline as select ((pg_temp.online())->'data'->>'count')::integer as n;

-- ---------------------------------------------------------------------------------------------------------------------
-- Tabla, privilegios y parámetro por defecto
-- ---------------------------------------------------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.courier_presence'::regclass)
  and exists (select 1 from pg_policies where tablename = 'courier_presence' and policyname = 'courier_presence_no_client_access'),
  'courier_presence tiene RLS y la policy deny-all'
);
select ok(
  not exists (
    select 1
    from unnest(array['select', 'insert', 'update', 'delete']) priv, unnest(array['anon', 'authenticated']) r
    where has_table_privilege(r, 'public.courier_presence', priv)
  ),
  'anon y authenticated no tienen privilegios sobre courier_presence'
);
select ok(
  has_function_privilege('authenticated', 'public.courier_heartbeat()', 'execute')
  and has_function_privilege('authenticated', 'public.get_online_couriers_count()', 'execute')
  and not has_function_privilege('anon', 'public.courier_heartbeat()', 'execute')
  and not has_function_privilege('anon', 'public.get_online_couriers_count()', 'execute'),
  'las dos RPC: execute para authenticated y no para anon'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid in ('public.courier_heartbeat()'::regprocedure, 'public.get_online_couriers_count()'::regprocedure)
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'public no tiene execute en las RPC de CC-041'
);
select is(
  (select value from public.platform_settings where key = 'courier_online_window_minutes'),
  '10'::jsonb,
  'la ventana arranca en 10 minutos'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Autorización de la señal
-- ---------------------------------------------------------------------------------------------------------------------
select is(pg_temp.err(pg_temp.beat(null)), 'UNAUTHENTICATED', 'señal sin sesión');
select is(pg_temp.err(pg_temp.beat(pg_temp.u(2))), 'UNAUTHORIZED_ACTOR', 'señal de un comercio');
select is(pg_temp.err(pg_temp.beat(pg_temp.u(9))), 'UNAUTHORIZED_ACTOR', 'señal de un repartidor sin consentimiento activo');
select is(pg_temp.err(pg_temp.beat(pg_temp.u(7))), 'COURIER_NOT_APPROVED', 'señal de un repartidor suspendido');
select is(pg_temp.err(pg_temp.beat(pg_temp.u(8))), 'COURIER_NOT_APPROVED', 'señal de un repartidor pendiente');

-- ---------------------------------------------------------------------------------------------------------------------
-- Autorización del conteo
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  pg_temp.err(pg_temp.call(null, 'aal1', 'select public.get_online_couriers_count()')),
  'UNAUTHENTICATED', 'conteo sin sesión'
);
select is(pg_temp.err(pg_temp.online(pg_temp.u(4))), 'UNAUTHORIZED_ACTOR', 'conteo de un repartidor');
select is(pg_temp.err(pg_temp.online(pg_temp.u(3))), 'UNAUTHORIZED_ACTOR', 'conteo de un comercio sin consentimiento activo');
select is(pg_temp.err(pg_temp.online(pg_temp.u(1))), 'UNAUTHORIZED_ACTOR', 'conteo del admin');

-- ---------------------------------------------------------------------------------------------------------------------
-- Señal
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  (pg_temp.beat(pg_temp.u(4)))->'data'->>'lastSeenAt',
  to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'la señal devuelve la hora de la base'
);
select is(
  (select last_seen_at from public.courier_presence where courier_id = pg_temp.u(4)),
  now(),
  'la presencia guarda now(), no una hora del cliente'
);
select ok(
  pg_temp.err(pg_temp.beat(pg_temp.u(4))) is null
  and (select count(*) from public.courier_presence where courier_id = pg_temp.u(4)) = 1,
  'repetir la señal es idempotente'
);

-- B con señal de hace 20 minutos y C con señal pero sin «Disponible».
select pg_temp.beat(pg_temp.u(5));
update public.courier_presence set last_seen_at = now() - interval '20 minutes' where courier_id = pg_temp.u(5);
select pg_temp.beat(pg_temp.u(6));

-- ---------------------------------------------------------------------------------------------------------------------
-- Conteo
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  (pg_temp.online())->'data',
  jsonb_build_object('count', (select n from baseline) + 1, 'windowMinutes', 10),
  'solo cuenta al aprobado disponible con señal reciente'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys((pg_temp.online())->'data') k),
  array['count', 'windowMinutes'],
  'el conteo devuelve solo count y windowMinutes'
);
select is(pg_temp.err(pg_temp.setting('courier_online_window_minutes', '30')), null, 'el admin amplía la ventana a 30');
select is(
  (pg_temp.online())->'data',
  jsonb_build_object('count', (select n from baseline) + 2, 'windowMinutes', 30),
  'con 30 minutos también cuenta la señal de hace 20'
);
update public.couriers set available = true where profile_id = pg_temp.u(6);
select is(((pg_temp.online())->'data'->>'count')::integer, (select n from baseline) + 3, 'al prender «Disponible» cuenta');
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.u(4);
select is(
  ((pg_temp.online())->'data'->>'count')::integer,
  (select n from baseline) + 2,
  'sin consentimiento activo deja de contar'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- admin_update_setting
-- ---------------------------------------------------------------------------------------------------------------------
select is(pg_temp.err(pg_temp.setting('courier_online_window_minutes', '1')), 'INVALID_SETTING_VALUE', 'ventana de 1 minuto');
select is(pg_temp.err(pg_temp.setting('courier_online_window_minutes', '61')), 'INVALID_SETTING_VALUE', 'ventana de 61 minutos');
select ok(
  pg_temp.err(pg_temp.setting('courier_online_window_minutes', '2.5')) = 'INVALID_SETTING_VALUE'
  and pg_temp.err(pg_temp.setting('courier_online_window_minutes', '"10"')) = 'INVALID_SETTING_VALUE',
  'la ventana es un número entero'
);
select is(pg_temp.err(pg_temp.setting('min_offer_ars', '1500')), null, 'las demás claves siguen funcionando');
select is(pg_temp.err(pg_temp.setting('clave_inexistente', '1')), 'INVALID_SETTING_KEY', 'una clave desconocida se rechaza');

select * from finish();
rollback;
