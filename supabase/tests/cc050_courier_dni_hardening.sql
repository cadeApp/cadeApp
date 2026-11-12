begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select no_plan();

-- CC-050 (T-434, SEC-09): límite diario de envíos de alta, liberación de DNI por disputa, búsqueda de reclamantes y
-- guarda de reinstate.
create function pg_temp.admin() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000050a1'::uuid $$;
-- c(n): repartidores. Límite: 1-3. Punta a punta: 4 (dueño del DNI) y 5 (intenta el DNI ajeno). Liberación: 10-19.
-- Búsqueda: 30-45. Bypass: 50.
create function pg_temp.c(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-00000050' || lpad(n::text, 4, '0'))::uuid
$$;
create function pg_temp.hmac(n integer) returns text language sql as $$ select repeat(lpad(to_hex(n), 2, '0'), 32) $$;

create function pg_temp.act_as(p_actor uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  set local role service_role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.seed_docs(p_courier uuid) returns void language plpgsql as $$
declare
  v_kind text;
begin
  foreach v_kind in array array['dni_front', 'dni_back', 'selfie', 'avatar'] loop
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values (p_courier, v_kind::public.courier_document_kind,
      'courier/' || p_courier::text || '/' || v_kind || '_1730000000000.jpg', 'submitted');
  end loop;
end $$;

create function pg_temp.rate_count(p_actor uuid) returns integer language sql as $$
  select coalesce(sum(count), 0)::integer from public.rate_limits
  where subject = p_actor::text and action = 'courier_application_submit'
$$;
create function pg_temp.rate_rows(p_actor uuid) returns integer language sql as $$
  select count(*)::integer from public.rate_limits
  where subject = p_actor::text and action = 'courier_application_submit'
$$;
create function pg_temp.release_audits(p_courier uuid) returns integer language sql as $$
  select count(*)::integer from public.audit_log
  where action = 'courier_dni_released' and target_id = p_courier::text
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'pwd', meta::jsonb
from (
  select pg_temp.admin() as id, 'cc050.admin@example.test' as email, '{"role":"merchant"}' as meta
  union all
  select pg_temp.c(n), 'cc050.c' || n || '@example.test', '{"role":"courier"}'
  from generate_series(1, 50) as n
  where n in (1, 2, 3, 4, 5, 6, 50) or n between 10 and 19 or n between 30 and 45
) as t(id, email, meta);

update public.profiles set consent_status = 'active'
where id = pg_temp.admin() or id in (select pg_temp.c(n) from generate_series(1, 50) n);
update public.profiles set role = 'admin' where id = pg_temp.admin();

-- ---------------------------------------------------------------------------
-- Estructura y privilegios
-- ---------------------------------------------------------------------------
select has_function('public', 'consume_courier_application_attempt', array[]::text[],
  'existe consume_courier_application_attempt()');
select has_function('public', 'admin_release_courier_dni', array['uuid', 'text'], 'existe admin_release_courier_dni');
select has_function('public', 'admin_find_courier_dispute_candidates', array['text'],
  'existe admin_find_courier_dispute_candidates');

select ok(not has_function_privilege('anon', 'public.consume_courier_application_attempt()', 'execute'),
  'anon no ejecuta el consumo');
select ok(has_function_privilege('authenticated', 'public.consume_courier_application_attempt()', 'execute'),
  'authenticated ejecuta el consumo');
select ok(not has_function_privilege('anon', 'public.admin_release_courier_dni(uuid, text)', 'execute'),
  'anon no ejecuta la liberación');
select ok(has_function_privilege('authenticated', 'public.admin_release_courier_dni(uuid, text)', 'execute'),
  'authenticated ejecuta la liberación (la barrera es assert_admin_aal2)');
select ok(not has_function_privilege('anon', 'public.admin_find_courier_dispute_candidates(text)', 'execute'),
  'anon no ejecuta la búsqueda');
select ok(has_function_privilege('authenticated', 'public.admin_find_courier_dispute_candidates(text)', 'execute'),
  'authenticated ejecuta la búsqueda (la barrera es assert_admin_aal2)');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=public, pg_temp']) from pg_proc
  where oid in ('public.consume_courier_application_attempt()'::regprocedure,
    'public.admin_release_courier_dni(uuid, text)'::regprocedure,
    'public.admin_find_courier_dispute_candidates(text)'::regprocedure)),
  'las tres RPC son security definer con search_path fijo');
-- H07: la ventana diaria se fija con la zona de Tucumán dentro de la función.
select ok(pg_get_functiondef('public.consume_courier_application_attempt()'::regprocedure)
    ~* 'date_trunc\(\s*''day''\s*,\s*now\(\)\s*,\s*''America/Argentina/Tucuman''\s*\)',
  'la ventana usa date_trunc con la zona America/Argentina/Tucuman');

-- ---------------------------------------------------------------------------
-- Límite: 5 por día y por cuenta
-- ---------------------------------------------------------------------------
select pg_temp.act_as_anon();
select throws_ok($$ select public.consume_courier_application_attempt() $$, '42501', null,
  'anon no ejecuta el consumo');

select pg_temp.act_as(pg_temp.c(1), 'aal1');
select lives_ok($$ select public.consume_courier_application_attempt() $$, 'consumo 1 de c1');
select lives_ok($$ select public.consume_courier_application_attempt() $$, 'consumo 2 de c1');
select lives_ok($$ select public.consume_courier_application_attempt() $$, 'consumo 3 de c1');
select lives_ok($$ select public.consume_courier_application_attempt() $$, 'consumo 4 de c1');
select lives_ok($$ select public.consume_courier_application_attempt() $$, 'consumo 5 de c1');
select throws_ok($$ select public.consume_courier_application_attempt() $$, 'P0001', 'RATE_LIMITED',
  'el sexto consumo del día da RATE_LIMITED');
select pg_temp.as_postgres();
select is(pg_temp.rate_count(pg_temp.c(1)), 5, 'el rechazo no suma: el contador queda en 5');

select pg_temp.act_as(pg_temp.c(2), 'aal1');
select lives_ok($$ select public.consume_courier_application_attempt() $$, 'otra cuenta tiene su propio cupo');

-- Día anterior agotado: el día de hoy vuelve a tener cupo.
select pg_temp.as_postgres();
insert into public.rate_limits (subject, action, window_start, count)
values (pg_temp.c(3)::text, 'courier_application_submit',
  date_trunc('day', now() - interval '1 day', 'America/Argentina/Tucuman'), 5);
select pg_temp.act_as(pg_temp.c(3), 'aal1');
select lives_ok($$ select public.consume_courier_application_attempt() $$,
  'con el día anterior agotado, el de hoy vuelve a pasar');

-- H07: cambiar el TimeZone de la sesión no abre otra ventana.
select pg_temp.as_postgres();
delete from public.rate_limits where subject = pg_temp.c(2)::text;
create function pg_temp.consume_in_zone(p_zone text) returns text language plpgsql as $$
begin
  perform set_config('TimeZone', p_zone, true);
  perform public.consume_courier_application_attempt();
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
select pg_temp.act_as(pg_temp.c(2), 'aal1');
select is(
  array[
    pg_temp.consume_in_zone('UTC'),
    pg_temp.consume_in_zone('America/Argentina/Tucuman'),
    pg_temp.consume_in_zone('America/Los_Angeles'),
    pg_temp.consume_in_zone('UTC'),
    pg_temp.consume_in_zone('America/Los_Angeles'),
    pg_temp.consume_in_zone('America/Argentina/Tucuman')
  ],
  array['ok', 'ok', 'ok', 'ok', 'ok', 'RATE_LIMITED'],
  'alternando la zona de sesión, el sexto consumo igual da RATE_LIMITED'
);
select pg_temp.as_postgres();
select is(pg_temp.rate_rows(pg_temp.c(2)), 1, 'tres zonas de sesión dejan una sola fila de rate_limits');
select set_config('TimeZone', 'UTC', true);

-- ---------------------------------------------------------------------------
-- Punta a punta: cinco finalize fallidos por DNI ajeno consumen el cupo
-- ---------------------------------------------------------------------------
select pg_temp.seed_docs(pg_temp.c(4));
select pg_temp.seed_docs(pg_temp.c(5));
select pg_temp.as_service();
select is((public.finalize_courier_application(pg_temp.c(4), pg_temp.hmac(4), 'bike', null)->>'ok'), 'true',
  'c4 registra el DNI 4');
select pg_temp.as_postgres();

-- Cada intento: consumo como c5 (transacción del consumo) y finalize como service_role en una subtransacción que falla.
create function pg_temp.attempt_with_taken_dni() returns text language plpgsql as $$
declare
  v_result text;
begin
  perform pg_temp.act_as(pg_temp.c(5), 'aal1');
  begin
    perform public.consume_courier_application_attempt();
  exception when others then
    perform pg_temp.as_postgres();
    return 'consume:' || sqlerrm;
  end;
  perform pg_temp.as_service();
  begin
    perform public.finalize_courier_application(pg_temp.c(5), pg_temp.hmac(4), 'bike', null);
    v_result := 'finalize:ok';
  exception when others then
    v_result := 'finalize:' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  return v_result;
end $$;
select is(
  array[
    pg_temp.attempt_with_taken_dni(), pg_temp.attempt_with_taken_dni(), pg_temp.attempt_with_taken_dni(),
    pg_temp.attempt_with_taken_dni(), pg_temp.attempt_with_taken_dni()
  ],
  array_fill('finalize:DNI_ALREADY_REGISTERED'::text, array[5]),
  'cinco intentos con un DNI ajeno fallan en finalize con DNI_ALREADY_REGISTERED'
);
select is(pg_temp.rate_count(pg_temp.c(5)), 5, 'los cinco finalize fallidos dejan el contador en 5');
select is(pg_temp.attempt_with_taken_dni(), 'consume:RATE_LIMITED',
  'el sexto intento se corta en el consumo, sin llegar a finalize');
select is((select application_submitted from public.couriers where profile_id = pg_temp.c(5)), false,
  'c5 sigue sin envío');

-- ---------------------------------------------------------------------------
-- Liberación de DNI
-- ---------------------------------------------------------------------------
-- c10-c17 rechazados o suspendidos con DNI enviado; c18 pendiente enviado; c19 aprobado.
select pg_temp.seed_docs(pg_temp.c(n)) from generate_series(10, 19) n;
select pg_temp.as_service();
select public.finalize_courier_application(pg_temp.c(n), pg_temp.hmac(n), 'bike', null) from generate_series(10, 19) n;
select pg_temp.as_postgres();
update public.couriers set status = 'rejected' where profile_id in (pg_temp.c(10), pg_temp.c(12), pg_temp.c(13),
  pg_temp.c(14), pg_temp.c(15), pg_temp.c(16), pg_temp.c(17));
update public.couriers set status = 'suspended' where profile_id = pg_temp.c(11);
update public.couriers set status = 'approved' where profile_id = pg_temp.c(19);

select pg_temp.act_as(pg_temp.c(10), 'aal2');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(10), 'reclamo del titular') $$,
  'P0001', 'UNAUTHORIZED_ACTOR', 'un repartidor no libera DNI');
select pg_temp.act_as(pg_temp.admin(), 'aal1');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(10), 'reclamo del titular') $$,
  'P0001', 'AAL2_REQUIRED', 'un admin sin aal2 no libera DNI');
select pg_temp.act_as_anon();
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(10), 'reclamo del titular') $$,
  '42501', null, 'anon no ejecuta la liberación');

select pg_temp.act_as(pg_temp.admin(), 'aal2');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(12), null) $$,
  'P0001', 'VALIDATION_ERROR', 'motivo null → VALIDATION_ERROR');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(12), '') $$,
  'P0001', 'VALIDATION_ERROR', 'motivo vacío → VALIDATION_ERROR');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(12), '      ') $$,
  'P0001', 'VALIDATION_ERROR', 'motivo de solo espacios → VALIDATION_ERROR');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(12), ' ab ') $$,
  'P0001', 'VALIDATION_ERROR', 'motivo de 2 caracteres tras btrim → VALIDATION_ERROR');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(12), repeat('x', 501)) $$,
  'P0001', 'VALIDATION_ERROR', 'motivo de 501 caracteres → VALIDATION_ERROR');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(12), 'hash ' || repeat('ab', 32)) $$,
  'P0001', 'VALIDATION_ERROR', 'motivo con 64 hex → VALIDATION_ERROR');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(12), 'dni 30123456 del titular') $$,
  'P0001', 'VALIDATION_ERROR', 'motivo con 8 dígitos seguidos → VALIDATION_ERROR');
select pg_temp.as_postgres();
select ok((select dni_hmac = pg_temp.hmac(12) from public.couriers where profile_id = pg_temp.c(12))
    and pg_temp.release_audits(pg_temp.c(12)) = 0,
  'los motivos inválidos no cambian el DNI ni auditan');

select pg_temp.act_as(pg_temp.admin(), 'aal2');
select is((public.admin_release_courier_dni(pg_temp.c(10), 'Reclamo verificado del titular'))->>'released', 'true',
  'admin aal2 libera el DNI de un rechazado');
select is((public.admin_release_courier_dni(pg_temp.c(11), 'Reclamo verificado del titular'))->>'released', 'true',
  'admin aal2 libera el DNI de un suspendido');
select is((public.admin_release_courier_dni(pg_temp.c(13), '  abc  '))->>'released', 'true',
  'motivo de 3 caracteres tras btrim pasa');
select is((public.admin_release_courier_dni(pg_temp.c(14), repeat('y', 500)))->>'released', 'true',
  'motivo de 500 caracteres pasa');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(18), 'reclamo del titular') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'un pendiente no se libera');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(19), 'reclamo del titular') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'un aprobado no se libera');
select throws_ok($$ select public.admin_release_courier_dni('00000000-0000-4000-8000-0000000050f9', 'reclamo') $$,
  'P0001', 'NOT_FOUND', 'id inexistente → NOT_FOUND');
select throws_ok($$ select public.admin_release_courier_dni(pg_temp.c(10), 'otra vez') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'la segunda liberación da INVALID_STATE_TRANSITION');
select pg_temp.as_postgres();
select ok((select dni_hmac is null from public.couriers where profile_id = pg_temp.c(10))
    and (select dni_hmac is null from public.couriers where profile_id = pg_temp.c(11)),
  'la liberación deja dni_hmac en null');
select is(pg_temp.release_audits(pg_temp.c(10)), 1, 'la segunda llamada no duplica el audit');
select ok((select before = '{"dni_registered": true}'::jsonb
      and after->>'dni_registered' = 'false'
      and after->>'reason' = 'Reclamo verificado del titular'
      and actor_id = pg_temp.admin() and target_type = 'courier'
    from public.audit_log where action = 'courier_dni_released' and target_id = pg_temp.c(10)::text),
  'el audit guarda dni_registered y el motivo');
select ok(not exists (
    select 1 from public.audit_log
    where action = 'courier_dni_released'
      and (before::text ~ '[0-9a-f]{64}' or after::text ~ '[0-9a-f]{64}')
  ), 'ningún audit de liberación contiene un hash');
select is((select after->>'reason' from public.audit_log
    where action = 'courier_dni_released' and target_id = pg_temp.c(13)::text), 'abc',
  'el motivo se guarda con btrim');

-- Después de liberar, otra cuenta registra ese DNI.
select pg_temp.seed_docs(pg_temp.c(6));
select pg_temp.as_service();
select is((public.finalize_courier_application(pg_temp.c(6), pg_temp.hmac(10), 'bike', null)->>'ok'), 'true',
  'otra cuenta registra el DNI liberado');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------------------
-- Guarda de reinstate
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select throws_ok($$ select public.admin_reinstate_courier(pg_temp.c(11), 'reconsideración') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'reinstate no reactiva a un repartidor con el DNI liberado');
select is((public.admin_reinstate_courier(pg_temp.c(15), 'reconsideración'))->>'status', 'approved',
  'reinstate sigue reconsiderando a un rechazado con DNI');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------------------
-- Búsqueda de reclamantes
-- ---------------------------------------------------------------------------
-- c30-c40: 11 pendientes sin enviar con documentos y el mismo teléfono; c34 y c35 con la misma fecha de alta.
-- c41: mismo teléfono pero enviado; c42: mismo teléfono sin documentos; c43: mismo teléfono aprobado.
-- c44: teléfono puro; c45: teléfono con prefijo internacional.
select pg_temp.seed_docs(pg_temp.c(n)) from generate_series(30, 41) n;
select pg_temp.seed_docs(pg_temp.c(43));
select pg_temp.seed_docs(pg_temp.c(44));
select pg_temp.seed_docs(pg_temp.c(45));
update public.profiles set phone = '381 555 0000' where id in (select pg_temp.c(n) from generate_series(30, 43) n);
update public.profiles set created_at = timestamptz '2026-01-01 12:00:00+00' + ((n - 30) * interval '1 hour')
from generate_series(30, 40) n where id = pg_temp.c(n);
update public.profiles set created_at = timestamptz '2026-01-01 16:00:00+00' where id = pg_temp.c(35);
update public.profiles set phone = '3812345678' where id = pg_temp.c(44);
update public.profiles set phone = '+543819990000' where id = pg_temp.c(45);
select pg_temp.as_service();
select public.finalize_courier_application(pg_temp.c(41), pg_temp.hmac(41), 'bike', null);
select pg_temp.as_postgres();
update public.couriers set status = 'approved' where profile_id = pg_temp.c(43);

select pg_temp.act_as(pg_temp.c(30), 'aal2');
select throws_ok($$ select public.admin_find_courier_dispute_candidates('3815550000') $$,
  'P0001', 'UNAUTHORIZED_ACTOR', 'un repartidor no busca candidatos');
select pg_temp.act_as(pg_temp.admin(), 'aal1');
select throws_ok($$ select public.admin_find_courier_dispute_candidates('3815550000') $$,
  'P0001', 'AAL2_REQUIRED', 'un admin sin aal2 no busca candidatos');
select pg_temp.act_as_anon();
select throws_ok($$ select public.admin_find_courier_dispute_candidates('3815550000') $$,
  '42501', null, 'anon no ejecuta la búsqueda');

select pg_temp.act_as(pg_temp.admin(), 'aal2');
select throws_ok($$ select public.admin_find_courier_dispute_candidates('') $$,
  'P0001', 'VALIDATION_ERROR', 'búsqueda vacía → VALIDATION_ERROR');
select throws_ok($$ select public.admin_find_courier_dispute_candidates('juan') $$,
  'P0001', 'VALIDATION_ERROR', 'texto genérico → VALIDATION_ERROR');
select throws_ok($$ select public.admin_find_courier_dispute_candidates('%3812345678') $$,
  'P0001', 'VALIDATION_ERROR', 'comodín → VALIDATION_ERROR');
select throws_ok($$ select public.admin_find_courier_dispute_candidates('foo3812345678') $$,
  'P0001', 'VALIDATION_ERROR', 'basura con 10 dígitos → VALIDATION_ERROR');
select throws_ok($$ select public.admin_find_courier_dispute_candidates('555 0000') $$,
  'P0001', 'VALIDATION_ERROR', 'teléfono parcial → VALIDATION_ERROR');

select is(jsonb_typeof(public.admin_find_courier_dispute_candidates('3810000000')), 'object',
  'sin coincidencias la raíz es un objeto');
select is(public.admin_find_courier_dispute_candidates('3810000000'), '{"candidates": []}'::jsonb,
  'sin coincidencias devuelve {"candidates": []}');
select is(jsonb_typeof(public.admin_find_courier_dispute_candidates('3815550000')->'candidates'), 'array',
  'con coincidencias candidates es un array');
select is(
  (select array_agg(e->>'courierId' order by ord)
   from jsonb_array_elements(public.admin_find_courier_dispute_candidates('(381) 555-0000')->'candidates')
     with ordinality as t(e, ord)),
  array[
    pg_temp.c(40), pg_temp.c(39), pg_temp.c(38), pg_temp.c(37), pg_temp.c(36), pg_temp.c(35), pg_temp.c(34),
    pg_temp.c(33), pg_temp.c(32), pg_temp.c(31)
  ]::text[],
  '11 elegibles: devuelve 10 por fecha de alta desc y profile_id desc (c35 y c34 empatados)'
);
select ok(not exists (
    select 1 from jsonb_array_elements(public.admin_find_courier_dispute_candidates('3815550000')->'candidates') e
    where (e->>'courierId')::uuid in (pg_temp.c(41), pg_temp.c(42), pg_temp.c(43))
  ), 'no devuelve cuentas enviadas, sin documentos ni aprobadas');
select is(
  (select array_agg(e->>'courierId')
   from jsonb_array_elements(public.admin_find_courier_dispute_candidates('3812345678')->'candidates') e),
  array[pg_temp.c(44)::text], 'el teléfono puro encuentra sin excepción');
select is(
  (select array_agg(e->>'courierId')
   from jsonb_array_elements(public.admin_find_courier_dispute_candidates('+54 (381) 999-0000')->'candidates') e),
  array[pg_temp.c(45)::text], 'el teléfono formateado encuentra sin excepción');
select is(
  (select array_agg(e->>'courierId')
   from jsonb_array_elements(public.admin_find_courier_dispute_candidates(pg_temp.c(44)::text)->'candidates') e),
  array[pg_temp.c(44)::text], 'el UUID exacto encuentra');
select ok((
    select bool_and(
      e->>'phoneMasked' ~ '0000$' and e->>'phoneMasked' !~ '555'
      and e->>'applicationSubmitted' = 'false' and e->>'status' = 'pending'
      and (e->>'documentsCount')::integer = 4
      and not (e ? 'dniHmac') and e::text !~ '[0-9a-f]{64}' and e::text !~ 'courier/'
    )
    from jsonb_array_elements(public.admin_find_courier_dispute_candidates('3815550000')->'candidates') e
  ), 'cada candidato tiene teléfono enmascarado y no expone hash, paths ni el teléfono completo');

create function pg_temp.list_pending_ids() returns uuid[] language sql as $$
  select coalesce(array_agg((e->>'id')::uuid), '{}')
  from jsonb_array_elements(public.admin_list_applicants('pending', null, null, null, 'next', 50)->'items') e
$$;
select ok(not (pg_temp.c(30) = any(pg_temp.list_pending_ids())),
  'admin_list_applicants sigue excluyendo la cuenta pendiente sin enviar');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------------------
-- Bypass: el repartidor no cambia dni_hmac directo
-- ---------------------------------------------------------------------------
select pg_temp.seed_docs(pg_temp.c(50));
select pg_temp.as_service();
select public.finalize_courier_application(pg_temp.c(50), pg_temp.hmac(50), 'bike', null);
select pg_temp.as_postgres();
create function pg_temp.try_clear_own_dni() returns void language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.c(50), 'aal1');
  begin
    update public.couriers set dni_hmac = null where profile_id = pg_temp.c(50);
  exception when others then
    null;
  end;
  perform pg_temp.as_postgres();
end $$;
select pg_temp.try_clear_own_dni();
select is((select dni_hmac from public.couriers where profile_id = pg_temp.c(50)), pg_temp.hmac(50),
  'el update directo de dni_hmac como repartidor no tiene efecto');

select * from finish();
rollback;
