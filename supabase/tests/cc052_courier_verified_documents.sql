begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select no_plan();

-- CC-052 (T-437, B-05): aprobar o rehabilitar exige dni_front, dni_back, selfie y avatar vigentes, verificados y sin
-- purgar; subsanación de rechazados y suspendidos sin rehabilitar (D5-A); DNI liberado excluido (D7-A).
create function pg_temp.admin() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000052a1'::uuid $$;
create function pg_temp.merchant() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000052b1'::uuid $$;
-- c(n): 1 aprobable; 100-143 matriz tipo × estado; 200-202 histórico, rechazo y duplicado; 210-212 rehabilitación;
-- 300-304 subsanación.
create function pg_temp.c(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-00000052' || lpad(n::text, 4, '0'))::uuid
$$;
create function pg_temp.kinds() returns text[] language sql as $$ select array['dni_front', 'dni_back', 'selfie', 'avatar'] $$;
create function pg_temp.states() returns text[] language sql as $$ select array['absent', 'submitted', 'rejected', 'purged'] $$;

create function pg_temp.act_as(p_actor uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', p_aal)::text, true);
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

create function pg_temp.status_of(p_courier uuid) returns text language sql security definer set search_path = public, pg_temp as $$
  select status::text from public.couriers where profile_id = p_courier
$$;
create function pg_temp.audits(p_courier uuid, p_action text) returns integer language sql security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.audit_log where action = p_action and target_id = p_courier::text
$$;
create function pg_temp.resubmit_audits(p_courier uuid) returns integer language sql security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.audit_log a
  join public.courier_documents d on d.id::text = a.target_id
  where a.action = 'resubmit_courier_required_document' and d.courier_id = p_courier
$$;
create function pg_temp.doc_count(p_courier uuid) returns integer language sql security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.courier_documents where courier_id = p_courier
$$;
create function pg_temp.path(p_courier uuid, p_kind text, p_n integer) returns text language sql as $$
  select 'courier/' || p_courier::text || '/' || p_kind || '_' || (1730000000000 + p_n)::text || '.png'
$$;
create function pg_temp.payload(p_courier uuid, p_kind text, p_n integer, p_key uuid) returns jsonb language sql as $$
  select jsonb_build_object('kind', p_kind, 'storagePath', pg_temp.path(p_courier, p_kind, p_n), 'idempotencyKey', p_key)
$$;

-- Un repartidor con estado, alta enviada, DNI y vehículo, como su dueño (bandera de finalize, camino de CC-043).
create function pg_temp.courier_setup(p_courier uuid, p_status text, p_with_dni boolean default true) returns void
language plpgsql as $$
begin
  update public.couriers set status = p_status::public.courier_status, available = false, vehicle_type = 'moto'
  where profile_id = p_courier;
  perform set_config('app.courier_application_finalize', 'on', true);
  update public.couriers
  set application_submitted = true, submitted_at = now(),
    dni_hmac = case when p_with_dni then encode(sha256(convert_to(p_courier::text, 'UTF8')), 'hex') end
  where profile_id = p_courier;
  perform set_config('app.courier_application_finalize', 'off', true);
end $$;

-- Los cuatro obligatorios; p_kind queda en p_state (absent: sin documento).
create function pg_temp.seed_required(p_courier uuid, p_kind text default null, p_state text default null) returns void
language plpgsql as $$
declare
  v_kind text;
begin
  foreach v_kind in array pg_temp.kinds() loop
    if v_kind is distinct from p_kind then
      insert into public.courier_documents (courier_id, kind, storage_path, status)
      values (p_courier, v_kind::public.courier_document_kind, pg_temp.path(p_courier, v_kind, 0), 'verified');
    elsif p_state = 'purged' then
      insert into public.courier_documents (courier_id, kind, storage_path, status, purge_after, purged_at)
      values (p_courier, v_kind::public.courier_document_kind, pg_temp.path(p_courier, v_kind, 0), 'verified',
        now() - interval '1 day', now());
    elsif p_state <> 'absent' then
      insert into public.courier_documents (courier_id, kind, storage_path, status)
      values (p_courier, v_kind::public.courier_document_kind, pg_temp.path(p_courier, v_kind, 0),
        p_state::public.document_review_status);
    end if;
  end loop;
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'pwd', meta::jsonb
from (
  select pg_temp.admin(), 'cc052.admin@example.test', '{"role":"merchant"}'
  union all select pg_temp.merchant(), 'cc052.merchant@example.test', '{"role":"merchant"}'
  union all select pg_temp.c(n), 'cc052.c' || n || '@example.test', '{"role":"courier"}'
  from (select 1 union all select generate_series(100, 143) union all select generate_series(200, 202)
    union all select generate_series(210, 212) union all select generate_series(300, 304)) as s(n)
) as t(id, email, meta);

update public.profiles set consent_status = 'active'
where id in (select id from auth.users where email like 'cc052.%@example.test');
update public.profiles set role = 'admin' where id = pg_temp.admin();

-- ---------------------------------------------------------------------------
-- Helper: estructura y privilegios
-- ---------------------------------------------------------------------------
select has_function('app_private', 'courier_required_documents_verified', array['uuid'], 'CC-052 crea el helper');
select ok((select prosecdef from pg_proc where oid = 'app_private.courier_required_documents_verified(uuid)'::regprocedure),
  'el helper es security definer');
select ok(not has_function_privilege('anon', 'app_private.courier_required_documents_verified(uuid)', 'EXECUTE'),
  'anon no ejecuta el helper');
select ok(not has_function_privilege('authenticated', 'app_private.courier_required_documents_verified(uuid)', 'EXECUTE'),
  'authenticated no ejecuta el helper');
select ok(not has_function_privilege('public', 'app_private.courier_required_documents_verified(uuid)', 'EXECUTE'),
  'public no ejecuta el helper');

-- ---------------------------------------------------------------------------
-- Aprobar: caso feliz sin licencia ni seguro
-- ---------------------------------------------------------------------------
select pg_temp.courier_setup(pg_temp.c(1), 'pending');
select pg_temp.seed_required(pg_temp.c(1));
select pg_temp.act_as(pg_temp.admin());
select is((public.admin_decide_courier(pg_temp.c(1), 'approved', null))->>'status', 'approved',
  'aprobar con los cuatro verificados (sin licencia ni seguro) funciona');
select pg_temp.as_postgres();
select is(pg_temp.audits(pg_temp.c(1), 'admin_decide_courier'), 1, 'la aprobación se audita');

-- ---------------------------------------------------------------------------
-- Aprobar: cada tipo obligatorio ausente, submitted, rejected o purgado
-- ---------------------------------------------------------------------------
select pg_temp.courier_setup(pg_temp.c(100 + (k - 1) * 10 + s), 'pending'),
       pg_temp.seed_required(pg_temp.c(100 + (k - 1) * 10 + s), (pg_temp.kinds())[k], (pg_temp.states())[s])
from generate_series(1, 4) k, generate_series(1, 4) s;

select pg_temp.act_as(pg_temp.admin());
select throws_ok(
  format('select public.admin_decide_courier(%L::uuid, %L, null)', pg_temp.c(100 + (k - 1) * 10 + s), 'approved'),
  'P0001', 'DOCUMENTS_NOT_VERIFIED',
  format('aprobar falla con %s en %s', (pg_temp.kinds())[k], (pg_temp.states())[s]))
from generate_series(1, 4) k, generate_series(1, 4) s;
select pg_temp.as_postgres();
select is(
  (select count(*)::integer from generate_series(1, 4) k, generate_series(1, 4) s
   where pg_temp.status_of(pg_temp.c(100 + (k - 1) * 10 + s)) = 'pending'
     and pg_temp.audits(pg_temp.c(100 + (k - 1) * 10 + s), 'admin_decide_courier') = 0),
  16, 'los 16 casos siguen pending y sin audit de decisión');

-- ---------------------------------------------------------------------------
-- Histórico verificado que no reemplaza al vigente; rechazo con documentos sin verificar
-- ---------------------------------------------------------------------------
select pg_temp.courier_setup(pg_temp.c(200), 'pending');
select pg_temp.seed_required(pg_temp.c(200), 'selfie', 'submitted');
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current, purge_after)
values (pg_temp.c(200), 'selfie', pg_temp.path(pg_temp.c(200), 'selfie', 9), 'verified', false, now() + interval '30 days');
select pg_temp.act_as(pg_temp.admin());
select throws_ok(format('select public.admin_decide_courier(%L::uuid, %L, null)', pg_temp.c(200), 'approved'),
  'P0001', 'DOCUMENTS_NOT_VERIFIED', 'un histórico verificado no reemplaza al vigente sin verificar');

select pg_temp.as_postgres();
select pg_temp.courier_setup(pg_temp.c(201), 'pending');
select pg_temp.seed_required(pg_temp.c(201), 'dni_front', 'rejected');
select pg_temp.act_as(pg_temp.admin());
select is((public.admin_decide_courier(pg_temp.c(201), 'rejected', 'DNI ilegible'))->>'status', 'rejected',
  'rechazar con documentos sin verificar sigue funcionando');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------------------
-- Rehabilitar
-- ---------------------------------------------------------------------------
select pg_temp.courier_setup(pg_temp.c(210), 'suspended');
select pg_temp.seed_required(pg_temp.c(210), 'selfie', 'submitted');
select pg_temp.courier_setup(pg_temp.c(211), 'rejected');
select pg_temp.seed_required(pg_temp.c(211), 'dni_back', 'rejected');
update public.couriers set status = 'approved' where profile_id = pg_temp.c(212);

select pg_temp.act_as(pg_temp.admin());
select throws_ok(format('select public.admin_reinstate_courier(%L::uuid, %L)', pg_temp.c(210), 'Revisado'),
  'P0001', 'DOCUMENTS_NOT_VERIFIED', 'reactivar un suspendido falla con la selfie sin verificar');
select throws_ok(format('select public.admin_reinstate_courier(%L::uuid, %L)', pg_temp.c(211), 'Revisado'),
  'P0001', 'DOCUMENTS_NOT_VERIFIED', 'reconsiderar un rechazado falla con el DNI dorso rechazado');
select pg_temp.as_postgres();
select ok(pg_temp.status_of(pg_temp.c(210)) = 'suspended' and pg_temp.status_of(pg_temp.c(211)) = 'rejected'
    and pg_temp.audits(pg_temp.c(210), 'admin_reinstate_courier') = 0
    and pg_temp.audits(pg_temp.c(211), 'admin_reinstate_courier') = 0,
  'sin update ni audit de rehabilitación');

update public.courier_documents set status = 'verified' where courier_id = pg_temp.c(210) and kind = 'selfie';
update public.courier_documents set status = 'verified' where courier_id = pg_temp.c(211) and kind = 'dni_back';
select pg_temp.act_as(pg_temp.admin());
select is((public.admin_reinstate_courier(pg_temp.c(210), 'Revisado'))->>'status', 'approved',
  'reactivar funciona con los cuatro verificados');
select is((public.admin_reinstate_courier(pg_temp.c(211), 'Revisado'))->>'status', 'approved',
  'reconsiderar funciona con los cuatro verificados');
select is((public.admin_reinstate_courier(pg_temp.c(212), 'Sin cambios'))->>'idempotent', 'true',
  'un aprobado sin documentos sigue devolviendo idempotent: true');
select pg_temp.as_postgres();
select is(pg_temp.audits(pg_temp.c(212), 'admin_reinstate_courier'), 0, 'el camino idempotente no audita');

-- ---------------------------------------------------------------------------
-- Subsanación: estructura y privilegios
-- ---------------------------------------------------------------------------
select has_function('public', 'resubmit_courier_required_document', array['jsonb'], 'CC-052 crea la subsanación');
select ok((select prosecdef from pg_proc where oid = 'public.resubmit_courier_required_document(jsonb)'::regprocedure),
  'la subsanación es security definer');
select ok((select proconfig @> array['search_path=public, pg_temp'] from pg_proc
    where oid = 'public.resubmit_courier_required_document(jsonb)'::regprocedure),
  'la subsanación fija search_path');
select ok(not has_function_privilege('anon', 'public.resubmit_courier_required_document(jsonb)', 'EXECUTE'),
  'anon no ejecuta la subsanación');
select ok(has_function_privilege('authenticated', 'public.resubmit_courier_required_document(jsonb)', 'EXECUTE'),
  'authenticated ejecuta la subsanación (la RPC valida al actor)');

-- c300 rechazado: selfie ausente, dni_front rechazado, dni_back verificado y purgado, avatar verificado.
select pg_temp.courier_setup(pg_temp.c(300), 'rejected');
insert into public.courier_documents (courier_id, kind, storage_path, status, purge_after, purged_at)
values
  (pg_temp.c(300), 'dni_front', pg_temp.path(pg_temp.c(300), 'dni_front', 0), 'rejected', null, null),
  (pg_temp.c(300), 'dni_back', pg_temp.path(pg_temp.c(300), 'dni_back', 0), 'verified', now() - interval '1 day', now()),
  (pg_temp.c(300), 'avatar', pg_temp.path(pg_temp.c(300), 'avatar', 0), 'verified', null, null);
insert into storage.objects (bucket_id, name, owner)
select 'courier-docs', pg_temp.path(pg_temp.c(300), k, n), pg_temp.c(300)
from unnest(pg_temp.kinds()) k, generate_series(1, 2) n;

create function pg_temp.snapshot(p_courier uuid) returns text language sql security definer set search_path = public, pg_temp as $$
  select status::text || '|' || application_submitted::text || '|' || coalesce(dni_hmac, '-')
  from public.couriers where profile_id = p_courier
$$;
create temp table t052_before as select pg_temp.snapshot(pg_temp.c(300)) as snap;

select pg_temp.act_as(pg_temp.c(300), 'aal1');
-- Sin vigente: inserta.
select is((public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'selfie', 1,
    '00000000-0000-4000-8000-000000005201')))->>'replacedDocumentId', null, 'sin vigente: inserta sin reemplazado');
-- Vigente rejected: reemplaza.
select isnt((public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'dni_front', 1,
    '00000000-0000-4000-8000-000000005202')))->>'replacedDocumentId', null, 'vigente rechazado: reemplaza');
-- Vigente verificado y purgado: reemplaza.
select isnt((public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'dni_back', 1,
    '00000000-0000-4000-8000-000000005203')))->>'replacedDocumentId', null, 'vigente verificado y purgado: reemplaza');
-- Vigente submitted con la misma ruta (otra clave): idempotente.
select is((public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'selfie', 1,
    '00000000-0000-4000-8000-000000005204')))->>'idempotent', 'true', 'submitted con la misma ruta: idempotente');
-- Vigente submitted con otra ruta: espera la decisión del admin.
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'selfie', 2,
    '00000000-0000-4000-8000-000000005205')) $$, 'P0001', 'INVALID_STATE_TRANSITION', 'submitted con otra ruta: falla');
-- Vigente verificado sin purgar: nada que corregir.
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'avatar', 1,
    '00000000-0000-4000-8000-000000005206')) $$, 'P0001', 'INVALID_STATE_TRANSITION', 'verificado sin purgar: falla');
-- Reintento con la misma clave y ruta; misma clave con otra ruta.
select is((public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'dni_front', 1,
    '00000000-0000-4000-8000-000000005202')))->>'idempotent', 'true', 'misma clave y ruta: idempotente');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'dni_front', 2,
    '00000000-0000-4000-8000-000000005202')) $$, 'P0001', 'VALIDATION_ERROR', 'misma clave con otra ruta: falla');
-- Validaciones.
select throws_ok($$ select public.resubmit_courier_required_document(jsonb_build_object('kind', 'license',
    'storagePath', 'courier/' || pg_temp.c(300)::text || '/license_1730000000001.png',
    'idempotencyKey', '00000000-0000-4000-8000-000000005207')) $$, 'P0001', 'VALIDATION_ERROR', 'un opcional no se subsana');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'avatar', 2,
    '00000000-0000-4000-8000-000000005208') || jsonb_build_object('vehicleId', gen_random_uuid())) $$,
  'P0001', 'VALIDATION_ERROR', 'con vehicleId falla');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(301), 'avatar', 2,
    '00000000-0000-4000-8000-000000005209')) $$, 'P0001', 'VALIDATION_ERROR', 'una ruta ajena falla');
select throws_ok($$ select public.resubmit_courier_required_document(jsonb_build_object('kind', 'avatar',
    'storagePath', 'courier/' || pg_temp.c(300)::text || '/avatar_../1730000000001.png',
    'idempotencyKey', '00000000-0000-4000-8000-000000005210')) $$, 'P0001', 'VALIDATION_ERROR', 'una ruta con .. falla');
select throws_ok($$ select public.resubmit_courier_required_document(jsonb_build_object('kind', 'avatar',
    'storagePath', pg_temp.path(pg_temp.c(300), 'avatar', 2), 'idempotencyKey', 'no-es-uuid')) $$,
  'P0001', 'VALIDATION_ERROR', 'una clave que no es UUID falla');
select throws_ok($$ select public.resubmit_courier_required_document(jsonb_build_object('kind', 'avatar',
    'storagePath', pg_temp.path(pg_temp.c(300), 'avatar', 2))) $$,
  'P0001', 'VALIDATION_ERROR', 'sin clave falla');
select pg_temp.as_postgres();
update public.courier_documents set status = 'rejected' where courier_id = pg_temp.c(300) and kind = 'avatar';
select pg_temp.act_as(pg_temp.c(300), 'aal1');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(300), 'avatar', 7,
    '00000000-0000-4000-8000-000000005211')) $$, 'P0001', 'NOT_FOUND', 'sin objeto en Storage falla');
select pg_temp.as_postgres();

select is(pg_temp.snapshot(pg_temp.c(300)), (select snap from t052_before),
  'la subsanación no cambia status, application_submitted ni dni_hmac');
select is((select count(*)::integer from public.courier_documents
    where courier_id = pg_temp.c(300) and is_current and status = 'submitted' and kind in ('selfie', 'dni_front', 'dni_back')),
  3, 'los tres subsanados quedan vigentes en submitted');
select is((select count(*)::integer from public.courier_documents
    where courier_id = pg_temp.c(300) and not is_current and purge_after is not null), 2,
  'los dos reemplazados quedan históricos con purge_after');
select is(pg_temp.resubmit_audits(pg_temp.c(300)), 3, 'tres subsanaciones auditadas (los reintentos no auditan)');
select ok(not exists (
    select 1 from public.audit_log a join public.courier_documents d on d.id::text = a.target_id
    where a.action = 'resubmit_courier_required_document' and d.courier_id = pg_temp.c(300)
      and (a.before::text like '%courier/%' or a.after::text like '%courier/%')),
  'la auditoría de la subsanación no tiene rutas');
select is((select a.before->>'old_purged' from public.audit_log a join public.courier_documents d on d.id::text = a.target_id
    where a.action = 'resubmit_courier_required_document' and d.courier_id = pg_temp.c(300) and d.kind = 'dni_back'),
  'true', 'la auditoría registra que el reemplazado estaba purgado');
-- PR742-H06: ningún vigente que pasó por las RPC queda con purge_after.
select is((select count(*)::integer from public.courier_documents
    where courier_id = pg_temp.c(300) and is_current and purge_after is not null and status = 'submitted'), 0,
  'ningún vigente subsanado queda con purge_after');

-- Verificación posterior por admin_verify_document y rehabilitación recién con los cuatro verificados.
select pg_temp.act_as(pg_temp.admin());
select public.admin_verify_document(d.id, 'verified', null)
from public.courier_documents d
where d.courier_id = pg_temp.c(300) and d.is_current and d.status = 'submitted';
select throws_ok(format('select public.admin_reinstate_courier(%L::uuid, %L)', pg_temp.c(300), 'Subsanado'),
  'P0001', 'DOCUMENTS_NOT_VERIFIED', 'con el avatar rechazado todavía no se reconsidera');
select pg_temp.as_postgres();
update public.courier_documents set status = 'verified' where courier_id = pg_temp.c(300) and kind = 'avatar' and is_current;
select pg_temp.act_as(pg_temp.admin());
select is((public.admin_reinstate_courier(pg_temp.c(300), 'Subsanado'))->>'status', 'approved',
  'con los cuatro verificados se reconsidera');
select pg_temp.as_postgres();
select is((select count(*)::integer from public.courier_documents
    where courier_id = pg_temp.c(300) and is_current and purge_after is not null), 0,
  'PR742-H06: después de alta, subsanación y verificación ningún vigente tiene purge_after');

-- Estados que no subsanan.
select pg_temp.courier_setup(pg_temp.c(301), 'pending');
select pg_temp.courier_setup(pg_temp.c(302), 'approved');
insert into storage.objects (bucket_id, name, owner)
select 'courier-docs', pg_temp.path(pg_temp.c(n), 'selfie', 1), pg_temp.c(n) from generate_series(301, 304) n;
select pg_temp.act_as(pg_temp.c(301), 'aal1');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(301), 'selfie', 1,
    '00000000-0000-4000-8000-000000005221')) $$, 'P0001', 'INVALID_STATE_TRANSITION', 'pending no subsana');
select pg_temp.act_as(pg_temp.c(302), 'aal1');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(302), 'selfie', 1,
    '00000000-0000-4000-8000-000000005222')) $$, 'P0001', 'INVALID_STATE_TRANSITION', 'approved no subsana');

-- D7-A: DNI liberado por disputa.
select pg_temp.as_postgres();
select pg_temp.courier_setup(pg_temp.c(303), 'rejected', false);
select pg_temp.seed_required(pg_temp.c(303), 'selfie', 'rejected');
create temp table t052_docs as select pg_temp.doc_count(pg_temp.c(303)) as n;
select pg_temp.act_as(pg_temp.c(303), 'aal1');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(303), 'selfie', 1,
    '00000000-0000-4000-8000-000000005223')) $$, 'P0001', 'INVALID_STATE_TRANSITION', 'con el DNI liberado no subsana');
select pg_temp.act_as(pg_temp.admin());
select throws_ok(format('select public.admin_reinstate_courier(%L::uuid, %L)', pg_temp.c(303), 'Revisado'),
  'P0001', 'INVALID_STATE_TRANSITION', 'con el DNI liberado no se reconsidera');
select pg_temp.as_service();
select throws_ok(format('select public.finalize_courier_application(%L::uuid, %L, %L, null)', pg_temp.c(303),
    repeat('5c', 32), 'moto'),
  'P0001', 'UNAUTHORIZED_ACTOR', 'finalize no reabre el alta de un rechazado (sin desvío)');
select pg_temp.as_postgres();
select ok(pg_temp.status_of(pg_temp.c(303)) = 'rejected'
    and pg_temp.doc_count(pg_temp.c(303)) = (select n from t052_docs)
    and pg_temp.resubmit_audits(pg_temp.c(303)) = 0
    and pg_temp.audits(pg_temp.c(303), 'admin_reinstate_courier') = 0
    and (select dni_hmac is null from public.couriers where profile_id = pg_temp.c(303)),
  'DNI liberado: sin update de couriers, sin documentos nuevos y sin audit');

-- PR742-R03: consentimiento no activo.
select pg_temp.courier_setup(pg_temp.c(304), 'rejected');
update public.profiles set consent_status = 'pending' where id = pg_temp.c(304);
select pg_temp.act_as(pg_temp.c(304), 'aal1');
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.c(304), 'selfie', 1,
    '00000000-0000-4000-8000-000000005224')) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'sin consentimiento activo no subsana');
select pg_temp.as_postgres();
select ok(pg_temp.doc_count(pg_temp.c(304)) = 0 and pg_temp.resubmit_audits(pg_temp.c(304)) = 0,
  'sin consentimiento: sin documento nuevo ni audit');

-- Otros actores.
select pg_temp.act_as(pg_temp.admin());
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.admin(), 'selfie', 1,
    '00000000-0000-4000-8000-000000005225')) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'un admin no subsana');
select pg_temp.act_as(pg_temp.merchant());
select throws_ok($$ select public.resubmit_courier_required_document(pg_temp.payload(pg_temp.merchant(), 'selfie', 1,
    '00000000-0000-4000-8000-000000005226')) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'un comercio no subsana');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------------------
-- PR742-H05: duplicados vigentes
-- ---------------------------------------------------------------------------
-- El índice impide un segundo vigente; esta prueba es del índice, no de DOCUMENTS_NOT_VERIFIED.
select pg_temp.courier_setup(pg_temp.c(202), 'pending');
select pg_temp.seed_required(pg_temp.c(202));
select throws_ok(format(
    'insert into public.courier_documents (courier_id, kind, storage_path, status) values (%L::uuid, %L, %L, %L)',
    pg_temp.c(202), 'dni_front', pg_temp.path(pg_temp.c(202), 'dni_front', 5), 'verified'),
  '23505', null, 'courier_documents_unique_current rechaza un segundo vigente del mismo tipo');

-- Rama «duplicado» del helper: último caso del script, con el índice quitado; el rollback final lo restaura.
drop index public.courier_documents_unique_current;
insert into public.courier_documents (courier_id, kind, storage_path, status)
values (pg_temp.c(202), 'dni_front', pg_temp.path(pg_temp.c(202), 'dni_front', 5), 'verified');
select is(app_private.courier_required_documents_verified(pg_temp.c(202)), false,
  'con dos vigentes del mismo tipo el helper devuelve false');
select pg_temp.act_as(pg_temp.admin());
select throws_ok(format('select public.admin_decide_courier(%L::uuid, %L, null)', pg_temp.c(202), 'approved'),
  'P0001', 'DOCUMENTS_NOT_VERIFIED', 'con dos vigentes del mismo tipo aprobar falla');
select pg_temp.as_postgres();

select * from finish();
rollback;
