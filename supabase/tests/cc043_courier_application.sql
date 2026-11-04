begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select no_plan();

-- CC-043 (T-421): finalize_courier_application, application_submitted/submitted_at y su trigger de guarda.
create function pg_temp.admin() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000043a1'::uuid $$;
create function pg_temp.merchant() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000043b1'::uuid $$;
-- c(1) primer envío; c(2) sin selfie; c(3) sin consentimiento; c(4) rechazado; c(5) rol cambiado a merchant;
-- c(6) DNI duplicado; c(7) histórico enviado sin fecha; c(8) escritor anterior con DNI nulo; c(9) escritor anterior
-- con DNI previo; c(10) vehículo sin envío; c(11) bici; c(12) patentes; c(13) RPC posteriores.
create function pg_temp.c(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-00000043' || lpad(n::text, 4, '0'))::uuid
$$;
create function pg_temp.hmac(n integer) returns text language sql as $$ select repeat(lpad(to_hex(n), 2, '0'), 32) $$;

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

-- Cuatro documentos obligatorios vigentes (y, si se pide, licencia) de un repartidor.
create function pg_temp.seed_docs(p_courier uuid, p_skip text default null) returns void language plpgsql as $$
declare
  v_kind text;
begin
  foreach v_kind in array array['dni_front', 'dni_back', 'selfie', 'avatar'] loop
    if v_kind is distinct from p_skip then
      insert into public.courier_documents (courier_id, kind, storage_path, status)
      values (p_courier, v_kind::public.courier_document_kind,
        'courier/' || p_courier::text || '/' || v_kind || '_1730000000000.jpg', 'submitted');
    end if;
  end loop;
end $$;

create function pg_temp.finalize(p_courier uuid, p_hmac text, p_vehicle public.vehicle_type, p_plate text)
returns jsonb language sql as $$
  select public.finalize_courier_application(p_courier, p_hmac, p_vehicle, p_plate)
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'pwd', meta::jsonb
from (
  select * from (values
  (pg_temp.admin(), 'cc043.admin@example.test', '{"role":"merchant"}'),
  (pg_temp.merchant(), 'cc043.merchant@example.test', '{"role":"merchant"}')
) as fixed(id, email, meta)
  union all
  select pg_temp.c(n), 'cc043.c' || n || '@example.test', '{"role":"courier"}' from generate_series(1, 13) as n
) as t(id, email, meta);

update public.profiles set consent_status = 'active'
where id in (pg_temp.admin(), pg_temp.merchant()) or id in (select pg_temp.c(n) from generate_series(1, 13) n);
update public.profiles set role = 'admin' where id = pg_temp.admin();
-- El alta de la cuenta es anterior al envío.
update public.profiles set created_at = now() - interval '3 days' where id = pg_temp.c(1);

select pg_temp.seed_docs(pg_temp.c(n)) from generate_series(1, 13) n where n <> 2;
select pg_temp.seed_docs(pg_temp.c(2), 'selfie');
update public.profiles set consent_status = 'pending' where id = pg_temp.c(3);
update public.couriers set status = 'rejected' where profile_id = pg_temp.c(4);
update public.profiles set role = 'merchant' where id = pg_temp.c(5);

-- ---------------------------------------------------------------------------
-- Estructura, privilegios y backfill
-- ---------------------------------------------------------------------------
select has_column('public', 'couriers', 'application_submitted', 'couriers.application_submitted existe');
select col_not_null('public', 'couriers', 'application_submitted', 'application_submitted no admite null');
select col_default_is('public', 'couriers', 'application_submitted', 'false', 'application_submitted arranca en false');
select has_column('public', 'couriers', 'submitted_at', 'couriers.submitted_at existe');
select ok((select prosecdef from pg_proc where oid = 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)'::regprocedure),
  'finalize_courier_application es security definer');
select ok((select proconfig @> array['search_path=public, pg_temp'] from pg_proc
  where oid = 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)'::regprocedure),
  'finalize_courier_application fija search_path');
select ok(has_function_privilege('service_role', 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)', 'execute'),
  'service_role puede finalizar');
select ok(not has_function_privilege('authenticated', 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)', 'execute'),
  'authenticated no puede finalizar');
select ok(not has_function_privilege('anon', 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)', 'execute'),
  'anon no puede finalizar');
select ok(not has_function_privilege('public', 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)', 'execute'),
  'public no puede finalizar');
select ok(not has_function_privilege('authenticated', 'app_private.couriers_guard_application()', 'execute')
  and not has_function_privilege('anon', 'app_private.couriers_guard_application()', 'execute')
  and not has_function_privilege('public', 'app_private.couriers_guard_application()', 'execute'),
  'los clientes no ejecutan el helper del trigger');
select is((select count(*)::integer from public.couriers where submitted_at is not null and not application_submitted), 0,
  'ninguna fila tiene fecha sin envío');
-- Backfill: la migración marcó los envíos previos (vehículo no nulo) sin inventarles fecha.
select is((select count(*)::integer from public.couriers
  where vehicle_type is not null and profile_id not in (select pg_temp.c(n) from generate_series(1, 13) n)
    and (not application_submitted or submitted_at is not null)), 0,
  'backfill: las filas previas con vehículo quedan enviadas y sin fecha');
select is((select count(*)::integer from public.couriers
  where vehicle_type is null and application_submitted and submitted_at is null
    and profile_id not in (select pg_temp.c(n) from generate_series(1, 13) n)), 0,
  'backfill: las filas previas sin vehículo no quedan enviadas');
select is((select application_submitted from public.couriers where profile_id = pg_temp.c(1)), false,
  'una cuenta nueva arranca sin envío');

-- ---------------------------------------------------------------------------
-- Primer envío
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select is((pg_temp.finalize(pg_temp.c(1), pg_temp.hmac(1), 'moto', ' ab 123 cd ')->>'idempotent'), 'false',
  'primer envío: idempotent false');
select pg_temp.as_postgres();
select ok((select application_submitted and submitted_at = now() and dni_hmac = pg_temp.hmac(1)
    and vehicle_type = 'moto' and vehicle_plate = 'AB 123 CD'
  from public.couriers where profile_id = pg_temp.c(1)),
  'primer envío: escribe DNI, vehículo, patente normalizada, marca y la hora de la transacción');
select ok((select c.submitted_at <> p.created_at from public.couriers c join public.profiles p on p.id = c.profile_id
  where c.profile_id = pg_temp.c(1)), 'la fecha de envío no es la del alta de la cuenta');

-- Reintento idéntico y con datos distintos
select pg_temp.as_service();
select is((pg_temp.finalize(pg_temp.c(1), pg_temp.hmac(1), 'moto', 'AB 123 CD')->>'idempotent'), 'true',
  'reintento idéntico: idempotent true');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(1), pg_temp.hmac(99), 'moto', 'AB 123 CD') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'reintento con otro DNI se rechaza');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(1), pg_temp.hmac(1), 'car', 'AB 123 CD') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'reintento con otro vehículo se rechaza');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(1), pg_temp.hmac(1), 'moto', 'AC 123 CD') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'reintento con otra patente se rechaza');
select pg_temp.as_postgres();
select ok((select submitted_at = now() and dni_hmac = pg_temp.hmac(1) and vehicle_plate = 'AB 123 CD'
  from public.couriers where profile_id = pg_temp.c(1)), 'los reintentos no cambian la fila ni la fecha');

-- ---------------------------------------------------------------------------
-- Errores (nada escrito)
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select throws_ok($$ select pg_temp.finalize('00000000-0000-4000-8000-0000000043ff', pg_temp.hmac(2), 'bike', null) $$,
  'P0001', 'NOT_FOUND', 'repartidor inexistente: NOT_FOUND');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(2), pg_temp.hmac(2), 'bike', null) $$,
  'P0001', 'VALIDATION_ERROR', 'sin selfie: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(3), pg_temp.hmac(3), 'bike', null) $$,
  'P0001', 'CONSENT_REQUIRED', 'sin consentimiento: CONSENT_REQUIRED');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(4), pg_temp.hmac(4), 'bike', null) $$,
  'P0001', 'UNAUTHORIZED_ACTOR', 'rechazado: UNAUTHORIZED_ACTOR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(5), pg_temp.hmac(5), 'bike', null) $$,
  'P0001', 'UNAUTHORIZED_ACTOR', 'rol no courier: UNAUTHORIZED_ACTOR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(6), 'ABC', 'bike', null) $$,
  'P0001', 'VALIDATION_ERROR', 'HMAC inválido: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(6), upper(pg_temp.hmac(171)), 'bike', null) $$,
  'P0001', 'VALIDATION_ERROR', 'HMAC en mayúsculas: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(6), pg_temp.hmac(6), null, null) $$,
  'P0001', 'VALIDATION_ERROR', 'sin vehículo: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(6), pg_temp.hmac(1), 'bike', null) $$,
  'P0001', 'DNI_ALREADY_REGISTERED', 'DNI de otro repartidor: DNI_ALREADY_REGISTERED');
select pg_temp.as_postgres();
select is((select count(*)::integer from public.couriers
  where profile_id in (pg_temp.c(2), pg_temp.c(3), pg_temp.c(4), pg_temp.c(5), pg_temp.c(6))
    and (application_submitted or submitted_at is not null or dni_hmac is not null)), 0,
  'los envíos rechazados no escriben nada');

-- ---------------------------------------------------------------------------
-- Patente
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select throws_ok($$ select pg_temp.finalize(pg_temp.c(12), pg_temp.hmac(12), 'moto', null) $$,
  'P0001', 'VALIDATION_ERROR', 'moto sin patente: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(12), pg_temp.hmac(12), 'moto', '   ') $$,
  'P0001', 'VALIDATION_ERROR', 'moto con patente en blanco: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(12), pg_temp.hmac(12), 'car', 'mi auto') $$,
  'P0001', 'VALIDATION_ERROR', 'auto con texto arbitrario: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(12), pg_temp.hmac(12), 'car', 'AB1234CD') $$,
  'P0001', 'VALIDATION_ERROR', 'auto con formato casi válido: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(12), pg_temp.hmac(12), 'bike', 'ABC 123') $$,
  'P0001', 'VALIDATION_ERROR', 'bici con patente: VALIDATION_ERROR');
select throws_ok($$ select pg_temp.finalize(pg_temp.c(12), pg_temp.hmac(12), 'walk', 'ABC 123') $$,
  'P0001', 'VALIDATION_ERROR', 'a pie con patente: VALIDATION_ERROR');
select pg_temp.as_postgres();
select is((select application_submitted from public.couriers where profile_id = pg_temp.c(12)), false,
  'las patentes inválidas no escriben nada');

-- Los cuatro formatos válidos se guardan en mayúsculas (cada uno en su propia transacción anidada).
create function pg_temp.plate_saved(p_plate text) returns text language plpgsql as $$
declare
  v_saved text;
begin
  perform set_config('role', 'service_role', true);
  perform public.finalize_courier_application(pg_temp.c(12), pg_temp.hmac(12), 'car', p_plate);
  select vehicle_plate into v_saved from public.couriers where profile_id = pg_temp.c(12);
  raise exception using errcode = 'P0002', message = v_saved;
exception
  when sqlstate 'P0002' then
    return sqlerrm;
end $$;
select is(pg_temp.plate_saved('ab 123 cd'), 'AB 123 CD', 'formato nuevo AB 123 CD');
select is(pg_temp.plate_saved('AB123CD'), 'AB123CD', 'formato nuevo sin espacios');
select is(pg_temp.plate_saved(' a 123 bcd'), 'A 123 BCD', 'formato nuevo A 123 BCD');
select is(pg_temp.plate_saved('abc 123'), 'ABC 123', 'formato viejo ABC 123');
select is(pg_temp.plate_saved('123abc'), '123ABC', 'formato viejo 123 ABC');
select pg_temp.as_postgres();
select is((select application_submitted from public.couriers where profile_id = pg_temp.c(12)), false,
  'las pruebas de patente se revierten');

select pg_temp.as_service();
select is((pg_temp.finalize(pg_temp.c(11), pg_temp.hmac(11), 'bike', null)->>'idempotent'), 'false', 'bici sin patente se envía');
select pg_temp.as_postgres();
select is((select vehicle_plate from public.couriers where profile_id = pg_temp.c(11)), null, 'bici queda sin patente');

-- ---------------------------------------------------------------------------
-- Histórico enviado sin fecha (como los del backfill)
-- ---------------------------------------------------------------------------
select set_config('app.courier_application_finalize', 'on', true);
update public.couriers set application_submitted = true, dni_hmac = pg_temp.hmac(7), vehicle_type = 'bike'
where profile_id = pg_temp.c(7);
select set_config('app.courier_application_finalize', 'off', true);
select pg_temp.as_service();
select is((pg_temp.finalize(pg_temp.c(7), pg_temp.hmac(7), 'bike', null)),
  jsonb_build_object('ok', true, 'idempotent', true, 'submittedAt', null),
  'histórico reintentado: idempotent y submittedAt null');
select pg_temp.as_postgres();
select is((select submitted_at from public.couriers where profile_id = pg_temp.c(7)), null, 'el histórico sigue sin fecha');
update public.couriers set available = false, license_status = 'submitted' where profile_id = pg_temp.c(7);
select is((select submitted_at from public.couriers where profile_id = pg_temp.c(7)), null,
  'otro update no le inventa fecha al histórico');

-- ---------------------------------------------------------------------------
-- Guarda de compatibilidad (escritor anterior) y vehículo sin envío
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select throws_ok($$
  update public.couriers set dni_hmac = pg_temp.hmac(8), vehicle_type = 'moto', vehicle_plate = 'ABC 123'
  where profile_id = pg_temp.c(8) and status in ('pending', 'approved')
$$, 'P0001', 'INVALID_STATE_TRANSITION', 'escritor anterior (DNI nulo): INVALID_STATE_TRANSITION');
select pg_temp.as_postgres();
update public.couriers set dni_hmac = pg_temp.hmac(9) where profile_id = pg_temp.c(9);
select pg_temp.as_service();
select throws_ok($$
  update public.couriers set dni_hmac = pg_temp.hmac(9), vehicle_type = 'moto', vehicle_plate = 'ABC 123'
  where profile_id = pg_temp.c(9) and status in ('pending', 'approved')
$$, 'P0001', 'INVALID_STATE_TRANSITION', 'escritor anterior (DNI previo): INVALID_STATE_TRANSITION');
select pg_temp.as_postgres();
select ok((select vehicle_type is null and not application_submitted from public.couriers where profile_id = pg_temp.c(8))
  and (select vehicle_type is null and not application_submitted from public.couriers where profile_id = pg_temp.c(9)),
  'el escritor anterior no deja la fila cambiada');
select pg_temp.as_service();
select lives_ok($$ update public.couriers set vehicle_type = 'bike' where profile_id = pg_temp.c(10) $$,
  'vehículo con DNI nulo y sin envío se puede guardar (CC-042)');
select pg_temp.as_postgres();
select is((select application_submitted from public.couriers where profile_id = pg_temp.c(10)), false,
  'guardar el vehículo no marca el envío');

-- ---------------------------------------------------------------------------
-- Bypass directo de las columnas
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.c(10));
select throws_ok($$ update public.couriers set application_submitted = true where profile_id = pg_temp.c(10) $$,
  'P0001', 'VALIDATION_ERROR', 'repartidor no marca su envío');
select throws_ok($$ update public.couriers set submitted_at = now() where profile_id = pg_temp.c(10) $$,
  'P0001', 'VALIDATION_ERROR', 'repartidor no fija su fecha');
select set_config('app.courier_application_finalize', 'on', true);
select throws_ok($$ update public.couriers set application_submitted = true where profile_id = pg_temp.c(10) $$,
  'P0001', 'VALIDATION_ERROR', 'repartidor con la marca fijada a mano tampoco (no es el dueño)');
select set_config('app.courier_application_finalize', 'off', true);
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select throws_ok($$ update public.couriers set application_submitted = true where profile_id = pg_temp.c(10) $$,
  'P0001', 'VALIDATION_ERROR', 'admin aal2 no marca un envío');
select throws_ok($$ update public.couriers set submitted_at = null where profile_id = pg_temp.c(1) $$,
  'P0001', 'VALIDATION_ERROR', 'admin no borra una fecha');
select pg_temp.act_as(pg_temp.admin(), 'aal1');
select throws_ok($$ update public.couriers set application_submitted = true where profile_id = pg_temp.c(10) $$,
  'P0001', 'VALIDATION_ERROR', 'admin aal1 no marca un envío');
select pg_temp.as_service();
select throws_ok($$ update public.couriers set application_submitted = true where profile_id = pg_temp.c(10) $$,
  'P0001', 'VALIDATION_ERROR', 'service_role no marca un envío sin la RPC');
select throws_ok($$ update public.couriers set application_submitted = false where profile_id = pg_temp.c(1) $$,
  'P0001', 'VALIDATION_ERROR', 'service_role no deshace un envío');
select throws_ok($$ update public.couriers set submitted_at = now() - interval '1 day' where profile_id = pg_temp.c(1) $$,
  'P0001', 'VALIDATION_ERROR', 'service_role no cambia una fecha fijada');
select set_config('app.courier_application_finalize', 'on', true);
select throws_ok($$ update public.couriers set submitted_at = now() where profile_id = pg_temp.c(10) $$,
  'P0001', 'VALIDATION_ERROR', 'service_role con la marca fijada a mano tampoco');
select set_config('app.courier_application_finalize', 'off', true);
select pg_temp.as_postgres();
select throws_ok($$ insert into public.couriers (profile_id, application_submitted) values (pg_temp.merchant(), true) $$,
  'P0001', 'VALIDATION_ERROR', 'insert con application_submitted se rechaza');
select throws_ok($$ insert into public.couriers (profile_id, submitted_at) values (pg_temp.merchant(), now()) $$,
  'P0001', 'VALIDATION_ERROR', 'insert con submitted_at se rechaza');
select set_config('app.courier_application_finalize', 'on', true);
select throws_ok($$ update public.couriers set application_submitted = false where profile_id = pg_temp.c(1) $$,
  'P0001', 'VALIDATION_ERROR', 'ni con la marca se vuelve a false');
select throws_ok($$ update public.couriers set submitted_at = now() - interval '1 day' where profile_id = pg_temp.c(1) $$,
  'P0001', 'VALIDATION_ERROR', 'ni con la marca se cambia una fecha fijada');
select set_config('app.courier_application_finalize', 'off', true);

-- ---------------------------------------------------------------------------
-- Las RPC posteriores no tocan la fecha
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select is((pg_temp.finalize(pg_temp.c(13), pg_temp.hmac(13), 'moto', 'ABC 123')->>'idempotent'), 'false', 'c(13) se envía');
select pg_temp.as_postgres();
create temporary table cc043_sent on commit drop as
  select submitted_at from public.couriers where profile_id = pg_temp.c(13);
grant select on cc043_sent to authenticated, service_role;
create function pg_temp.unchanged() returns boolean language sql as $$
  select (select submitted_at from public.couriers where profile_id = pg_temp.c(13))
    is not distinct from (select submitted_at from cc043_sent)
    and (select application_submitted from public.couriers where profile_id = pg_temp.c(13))
$$;

insert into storage.buckets (id, name, public) values ('courier-docs', 'courier-docs', false) on conflict (id) do nothing;
insert into storage.objects (id, bucket_id, name, owner) values
  (gen_random_uuid(), 'courier-docs', 'courier/' || pg_temp.c(13)::text || '/license_1730000000100.jpg', pg_temp.c(13)),
  (gen_random_uuid(), 'courier-docs', 'courier/' || pg_temp.c(13)::text || '/license_1730000000200.jpg', pg_temp.c(13));

-- Cambio de vehículo posterior
update public.couriers set vehicle_type = 'car', vehicle_plate = 'AB 123 CD' where profile_id = pg_temp.c(13);
select ok(pg_temp.unchanged(), 'cambiar de vehículo no cambia la fecha');

select pg_temp.act_as(pg_temp.c(13), 'aal1');
select lives_ok($$ select public.add_courier_optional_document(jsonb_build_object('kind', 'license',
  'storagePath', 'courier/' || pg_temp.c(13)::text || '/license_1730000000100.jpg')) $$, 'add_courier_optional_document corre');
select pg_temp.as_postgres();
select ok(pg_temp.unchanged(), 'add_courier_optional_document no cambia la fecha');

select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select public.admin_verify_document(
  (select id from public.courier_documents where courier_id = pg_temp.c(13) and kind = 'license' and is_current),
  'rejected', 'Imagen borrosa', 'illegible') $$, 'admin_verify_document corre');
select pg_temp.as_postgres();
select ok(pg_temp.unchanged(), 'admin_verify_document no cambia la fecha');

select pg_temp.act_as(pg_temp.c(13), 'aal1');
select lives_ok($$ select public.replace_courier_document(jsonb_build_object('kind', 'license',
  'storagePath', 'courier/' || pg_temp.c(13)::text || '/license_1730000000200.jpg')) $$, 'replace_courier_document corre');
select pg_temp.as_postgres();
select ok(pg_temp.unchanged(), 'replace_courier_document no cambia la fecha');

select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select public.admin_decide_courier(pg_temp.c(13), 'approved') $$, 'admin_decide_courier corre');
select pg_temp.as_postgres();
select ok(pg_temp.unchanged(), 'admin_decide_courier no cambia la fecha');

select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select public.admin_suspend_courier(pg_temp.c(13), 'Prueba CC-043') $$, 'admin_suspend_courier corre');
select pg_temp.as_postgres();
select ok(pg_temp.unchanged(), 'admin_suspend_courier no cambia la fecha');

select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select public.admin_reinstate_courier(pg_temp.c(13), 'Prueba CC-043') $$, 'admin_reinstate_courier corre');
select pg_temp.as_postgres();
select ok(pg_temp.unchanged(), 'admin_reinstate_courier no cambia la fecha');

select * from finish();
rollback;
