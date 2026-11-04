begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select no_plan();

-- CC-044 (T-421): admin_list_applicants. Autorización, privilegios, normalización, filtro de envío, total,
-- paginación en los dos sentidos, validación y privacidad.
create function pg_temp.admin() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000044a1'::uuid $$;
create function pg_temp.merchant() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000044b1'::uuid $$;
-- p(1..6) pendientes enviados; a(1) aprobado; n(1) pendiente sin envío.
create function pg_temp.p(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-00000044' || lpad(n::text, 4, '0'))::uuid
$$;
create function pg_temp.a1() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000044e1'::uuid $$;
create function pg_temp.n1() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000044f1'::uuid $$;
create function pg_temp.t0() returns timestamptz language sql as $$ select '2026-11-04 12:00:00+00'::timestamptz $$;

create function pg_temp.act_as(p_actor uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
create function pg_temp.as_no_subject() returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal2"}', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Dueño de la sesión con los claims del admin aal2: la RPC autoriza por auth.uid()/aal, y la tabla temporal y el
-- orden esperado se leen sin depender de los permisos de authenticated.
create function pg_temp.as_admin_owner() returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', '00000000-0000-4000-8000-0000000044a1', 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

create function pg_temp.ids(p_result jsonb) returns uuid[] language sql as $$
  select coalesce(array_agg((e->>'id')::uuid order by ord), '{}')
  from jsonb_array_elements(p_result->'items') with ordinality as t(e, ord)
$$;
create function pg_temp.item(p_result jsonb, p_id uuid) returns jsonb language sql as $$
  select e from jsonb_array_elements(p_result->'items') e where e->>'id' = p_id::text
$$;
create function pg_temp.list(
  p_status text, p_query text default null, p_cursor jsonb default null, p_direction text default 'next',
  p_limit integer default null
) returns jsonb language sql as $$
  select public.admin_list_applicants(
    p_status, p_query, (p_cursor->>'createdAt')::timestamptz, (p_cursor->>'id')::uuid, p_direction, p_limit)
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'pwd', meta::jsonb
from (
  select * from (values
  (pg_temp.admin(), 'cc044.admin@example.test', '{"role":"merchant"}'),
  (pg_temp.merchant(), 'cc044.merchant@example.test', '{"role":"merchant"}'),
  (pg_temp.a1(), 'cc044.a1@example.test', '{"role":"courier"}'),
  (pg_temp.n1(), 'cc044.n1@example.test', '{"role":"courier"}')
) as fixed(id, email, meta)
  union all
  select pg_temp.p(n), 'cc044.p' || n || '@example.test', '{"role":"courier"}' from generate_series(1, 6) n
) as t(id, email, meta);

update public.profiles set consent_status = 'active'
where id in (pg_temp.admin(), pg_temp.merchant(), pg_temp.a1(), pg_temp.n1())
  or id in (select pg_temp.p(n) from generate_series(1, 6) n);
update public.profiles set role = 'admin' where id = pg_temp.admin();

-- Nombres y altas: p(1) y p(2) empatan en t0; p(4) y p(5) empatan en t0 - 2 h.
update public.profiles as pr set display_name = v.name, created_at = v.created_at, phone = '+54938650044' || v.n
from (values
  (pg_temp.p(1), 'José Pérez', pg_temp.t0(), 1),
  (pg_temp.p(2), 'Lucía Pereyra', pg_temp.t0(), 2),
  (pg_temp.p(3), 'Martín  Núñez', pg_temp.t0() - interval '1 hour', 3),
  (pg_temp.p(4), 'Álvaro Gómez', pg_temp.t0() - interval '2 hours', 4),
  (pg_temp.p(5), 'Ana Histórica', pg_temp.t0() - interval '2 hours', 5),
  (pg_temp.p(6), 'Josefina Ruiz', pg_temp.t0() - interval '3 hours', 6),
  (pg_temp.a1(), 'José Aprobado', pg_temp.t0() - interval '4 hours', 7),
  (pg_temp.n1(), 'José Sin Envío', pg_temp.t0() - interval '5 hours', 8)
) as v(id, name, created_at, n)
where pr.id = v.id;

-- Envíos (fixture del dueño con la marca, como el backfill; la RPC real la prueba cc043). p(5) es histórico sin fecha.
select set_config('app.courier_application_finalize', 'on', true);
update public.couriers as c
set application_submitted = true,
    vehicle_type = 'bike',
    dni_hmac = case when c.profile_id = pg_temp.p(1) then repeat('44', 32) else null end,
    submitted_at = case when c.profile_id = pg_temp.p(5) then null else pg_temp.t0() + interval '30 minutes' end
where c.profile_id in (select pg_temp.p(n) from generate_series(1, 6) n) or c.profile_id = pg_temp.a1();
select set_config('app.courier_application_finalize', 'off', true);
update public.couriers set status = 'approved' where profile_id = pg_temp.a1();

insert into public.courier_documents (courier_id, kind, storage_path, status)
values (pg_temp.p(1), 'license', 'courier/' || pg_temp.p(1)::text || '/license_1730000000000.jpg', 'submitted');

-- ---------------------------------------------------------------------------
-- Estructura y privilegios
-- ---------------------------------------------------------------------------
select ok((select prosecdef from pg_proc where oid = 'public.admin_list_applicants(text, text, timestamptz, uuid, text, integer)'::regprocedure),
  'admin_list_applicants es security definer');
select ok((select provolatile = 's' from pg_proc where oid = 'public.admin_list_applicants(text, text, timestamptz, uuid, text, integer)'::regprocedure),
  'admin_list_applicants es stable');
select ok((select proconfig @> array['search_path=public, pg_temp'] from pg_proc
  where oid = 'public.admin_list_applicants(text, text, timestamptz, uuid, text, integer)'::regprocedure),
  'admin_list_applicants fija search_path');
select ok(has_function_privilege('authenticated', 'public.admin_list_applicants(text, text, timestamptz, uuid, text, integer)', 'execute'),
  'authenticated tiene execute');
select ok(not has_function_privilege('anon', 'public.admin_list_applicants(text, text, timestamptz, uuid, text, integer)', 'execute'),
  'anon no tiene execute');
select ok(not has_function_privilege('public', 'public.admin_list_applicants(text, text, timestamptz, uuid, text, integer)', 'execute'),
  'public no tiene execute');
select ok(not has_function_privilege('authenticated', 'app_private.search_normalize(text)', 'execute')
  and not has_function_privilege('anon', 'app_private.search_normalize(text)', 'execute')
  and not has_function_privilege('public', 'app_private.search_normalize(text)', 'execute'),
  'los clientes no ejecutan search_normalize');
select ok((select provolatile = 'i' from pg_proc where oid = 'app_private.search_normalize(text)'::regprocedure),
  'search_normalize es immutable');

-- ---------------------------------------------------------------------------
-- Autorización
-- ---------------------------------------------------------------------------
select pg_temp.as_no_subject();
select throws_ok($$ select pg_temp.list('pending') $$, 'P0001', 'UNAUTHENTICATED', 'sin sesión: UNAUTHENTICATED');
select pg_temp.act_as(pg_temp.merchant());
select throws_ok($$ select pg_temp.list('pending') $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'comercio: UNAUTHORIZED_ACTOR');
select pg_temp.act_as(pg_temp.p(1));
select throws_ok($$ select pg_temp.list('pending') $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'repartidor: UNAUTHORIZED_ACTOR');
select pg_temp.act_as(pg_temp.admin(), 'aal1');
select throws_ok($$ select pg_temp.list('pending') $$, 'P0001', 'AAL2_REQUIRED', 'admin aal1: AAL2_REQUIRED');
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select pg_temp.list('pending') $$, 'admin aal2 recibe la página');

-- ---------------------------------------------------------------------------
-- Filtro de envío y total
-- ---------------------------------------------------------------------------
select is((pg_temp.list('pending')->>'total')::integer, 6, 'pending: solo las 6 postulaciones enviadas');
select ok(not (pg_temp.ids(pg_temp.list('pending', null, null, 'next', 50)) @> array[pg_temp.n1()]),
  'una cuenta pendiente sin envío no aparece');
select ok(pg_temp.ids(pg_temp.list('pending', null, null, 'next', 50)) @> array[pg_temp.p(5)],
  'un histórico enviado sin fecha aparece');
select is(pg_temp.item(pg_temp.list('pending', null, null, 'next', 50), pg_temp.p(5))->'submittedAt', 'null'::jsonb,
  'el histórico devuelve submittedAt null');
select is(pg_temp.item(pg_temp.list('pending', null, null, 'next', 50), pg_temp.p(1))->>'submittedAt',
  '2026-11-04T12:30:00.000000Z', 'submittedAt es el de CC-043');
select is(pg_temp.ids(pg_temp.list('approved')), array[pg_temp.a1()], 'approved filtra solo por estado');

-- ---------------------------------------------------------------------------
-- Normalización (sin tildes, sin mayúsculas, sin comodines)
-- ---------------------------------------------------------------------------
select is(pg_temp.ids(pg_temp.list('pending', 'jose')), array[pg_temp.p(1), pg_temp.p(6)], 'jose encuentra a José y Josefina');
select is(pg_temp.ids(pg_temp.list('pending', 'JOSE')), array[pg_temp.p(1), pg_temp.p(6)], 'JOSE encuentra lo mismo');
select is(pg_temp.ids(pg_temp.list('pending', '  José ')), array[pg_temp.p(1), pg_temp.p(6)], 'José con espacios encuentra lo mismo');
select is((pg_temp.list('pending', 'jose')->>'total')::integer, 2, 'el total respeta la búsqueda');
select is(pg_temp.ids(pg_temp.list('pending', 'nunez')), array[pg_temp.p(3)], 'nunez encuentra a Núñez');
select is(pg_temp.ids(pg_temp.list('pending', 'martin nunez')), array[pg_temp.p(3)], 'los espacios dobles del nombre se colapsan');
select is(pg_temp.ids(pg_temp.list('pending', 'alvaro')), array[pg_temp.p(4)], 'alvaro encuentra a Álvaro');
select is(pg_temp.ids(pg_temp.list('pending', 'perez')), array[pg_temp.p(1)], 'perez no encuentra a Pereyra');
select is(pg_temp.ids(pg_temp.list('pending', 'jos%')), '{}'::uuid[], 'jos% no es comodín');
select is(pg_temp.ids(pg_temp.list('pending', 'j_se')), '{}'::uuid[], 'j_se no es comodín');
select is(pg_temp.ids(pg_temp.list('approved', 'jose')), array[pg_temp.a1()], 'la búsqueda respeta el estado');
select is(pg_temp.ids(pg_temp.list('pending', '+54938650044')), '{}'::uuid[], 'no busca por teléfono');
select is(pg_temp.list('pending', '   ')->>'total', '6', 'un término en blanco no filtra');

-- ---------------------------------------------------------------------------
-- Paginación en los dos sentidos
-- ---------------------------------------------------------------------------
select pg_temp.as_admin_owner();
create temporary table cc044_pages on commit drop as
with p1 as (select pg_temp.list('pending', null, null, 'next', 2) as r),
     p2 as (select pg_temp.list('pending', null, (select r->'nextCursor' from p1), 'next', 2) as r),
     p3 as (select pg_temp.list('pending', null, (select r->'nextCursor' from p2), 'next', 2) as r)
select (select r from p1) as p1, (select r from p2) as p2, (select r from p3) as p3;

-- El orden esperado sale de la misma tabla.
select is(
  (select pg_temp.ids(p1) || pg_temp.ids(p2) || pg_temp.ids(p3) from cc044_pages),
  (select array_agg(c.profile_id order by p.created_at desc, c.profile_id desc)
   from public.couriers c join public.profiles p on p.id = c.profile_id
   where c.status = 'pending' and c.application_submitted),
  'next recorre las 6 filas en orden (created_at desc, id desc), con empates');
select is((select p1->'prevCursor' from cc044_pages), 'null'::jsonb, 'primera página sin prevCursor');
select is((select p3->'nextCursor' from cc044_pages), 'null'::jsonb, 'última página sin nextCursor');
select ok((select p2->'prevCursor' <> 'null'::jsonb and p2->'nextCursor' <> 'null'::jsonb from cc044_pages),
  'la página del medio tiene los dos cursores');
select is((select (p2->>'total')::integer from cc044_pages), 6, 'el total no cambia entre páginas');
select is(
  (select pg_temp.ids(pg_temp.list('pending', null, p3->'prevCursor', 'prev', 2)) from cc044_pages),
  (select pg_temp.ids(p2) from cc044_pages), 'prev desde la página 3 vuelve a la página 2');
select is(
  (select pg_temp.ids(pg_temp.list('pending', null, p2->'prevCursor', 'prev', 2)) from cc044_pages),
  (select pg_temp.ids(p1) from cc044_pages), 'prev desde la página 2 vuelve a la página 1');
select is(
  (select pg_temp.list('pending', null, p2->'prevCursor', 'prev', 2)->'prevCursor' from cc044_pages),
  'null'::jsonb, 'volver a la primera página deja prevCursor null');

-- Con búsqueda
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select is(pg_temp.ids(pg_temp.list('pending', 'jose', null, 'next', 1)), array[pg_temp.p(1)], 'jose, página 1');
select is(
  pg_temp.ids(pg_temp.list('pending', 'jose', pg_temp.list('pending', 'jose', null, 'next', 1)->'nextCursor', 'next', 1)),
  array[pg_temp.p(6)], 'jose, página 2 respeta la búsqueda');
select is(
  pg_temp.list('pending', 'jose', pg_temp.list('pending', 'jose', null, 'next', 1)->'nextCursor', 'next', 1)->'nextCursor',
  'null'::jsonb, 'jose, la página 2 es la última');
select is(
  pg_temp.ids(pg_temp.list('pending', 'jose',
    pg_temp.list('pending', 'jose', pg_temp.list('pending', 'jose', null, 'next', 1)->'nextCursor', 'next', 1)->'prevCursor',
    'prev', 1)),
  array[pg_temp.p(1)], 'jose, prev vuelve a José');

-- ---------------------------------------------------------------------------
-- Validación
-- ---------------------------------------------------------------------------
select throws_ok($$ select pg_temp.list('draft') $$, 'P0001', 'VALIDATION_ERROR', 'estado inválido');
select throws_ok($$ select pg_temp.list(null) $$, 'P0001', 'VALIDATION_ERROR', 'estado nulo');
select throws_ok($$ select public.admin_list_applicants('pending', null, now(), null) $$, 'P0001', 'VALIDATION_ERROR',
  'cursor incompleto');
select throws_ok($$ select pg_temp.list('pending', null, null, 'back') $$, 'P0001', 'VALIDATION_ERROR', 'dirección inválida');
select throws_ok($$ select pg_temp.list('pending', null, null, 'prev') $$, 'P0001', 'VALIDATION_ERROR', 'prev sin cursor');
select throws_ok($$ select pg_temp.list('pending', null, null, 'next', 0) $$, 'P0001', 'VALIDATION_ERROR', 'límite 0');
select throws_ok($$ select pg_temp.list('pending', null, null, 'next', 51) $$, 'P0001', 'VALIDATION_ERROR', 'límite 51');
select throws_ok($$ select pg_temp.list('pending', repeat('a', 81)) $$, 'P0001', 'VALIDATION_ERROR', 'término de 81 caracteres');
select lives_ok($$ select pg_temp.list('pending', repeat('a', 80)) $$, 'término de 80 caracteres');

-- ---------------------------------------------------------------------------
-- Privacidad y forma del ítem
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.item(pg_temp.list('pending', null, null, 'next', 50), pg_temp.p(1))) k),
  array['createdAt', 'displayName', 'docLevel', 'documents', 'hasDni', 'id', 'insuranceStatus', 'licenseStatus', 'phone',
    'status', 'submittedAt', 'vehicleType'],
  'el ítem trae solo las claves del contrato');
select is(pg_temp.item(pg_temp.list('pending', null, null, 'next', 50), pg_temp.p(1))->'documents',
  '{"dniFront": false, "dniBack": false, "selfie": false, "license": true, "insurance": false}'::jsonb,
  'documents marca los tipos vigentes');
select is(pg_temp.item(pg_temp.list('pending', null, null, 'next', 50), pg_temp.p(1))->>'hasDni', 'true', 'hasDni con DNI');
select is(pg_temp.item(pg_temp.list('pending', null, null, 'next', 50), pg_temp.p(2))->>'hasDni', 'false', 'hasDni sin DNI');
select ok(pg_temp.list('pending', null, null, 'next', 50)::text !~ (repeat('44', 32) || '|storage_path|courier/|cbu|alias'),
  'la salida no trae el hash del DNI, rutas ni datos bancarios');

select * from finish();
rollback;
