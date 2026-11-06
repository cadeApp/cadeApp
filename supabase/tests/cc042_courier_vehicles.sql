-- CC-042 / T-419: vehículos del repartidor, documentos por vehículo y vehículo activo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select no_plan();

create function pg_temp.admin() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042a1'::uuid $$;
create function pg_temp.merchant() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042b1'::uuid $$;
create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042c1'::uuid $$;
create function pg_temp.courier_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042c2'::uuid $$;
create function pg_temp.pending() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042c3'::uuid $$;
create function pg_temp.not_sent() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042c4'::uuid $$;
create function pg_temp.rejected() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042c5'::uuid $$;
create function pg_temp.suspended() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042c6'::uuid $$;
create function pg_temp.legacy() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042c7'::uuid $$;
create function pg_temp.zone() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000042d1'::uuid $$;
create function pg_temp.request(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000042e00' || p_n::text)::uuid $$;
create function pg_temp.offer(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000042f00' || p_n::text)::uuid $$;
create function pg_temp.act_as(p_actor uuid, p_aal text default 'aal1') returns void language plpgsql as $$ begin set local role authenticated; perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', p_aal)::text, true); end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$ begin set local role anon; perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $$;
create function pg_temp.as_no_subject() returns void language plpgsql as $$ begin set local role authenticated; perform set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal1"}', true); end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$ begin set local role postgres; perform set_config('request.jwt.claims', '', true); end $$;

-- Ids capturados en la prueba (también los usa el actor autenticado).
create temp table cc042_ids (k text primary key, id uuid not null);
grant select, insert on cc042_ids to authenticated;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select id from cc042_ids where k = p_k $$;
create function pg_temp.courier(p_courier uuid) returns public.couriers language sql as $$ select * from public.couriers where profile_id = p_courier $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-admin@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.merchant(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-merchant@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.courier_a(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-a@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.courier_b(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-b@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.pending(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-p@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.not_sent(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-n@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.rejected(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-r@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.suspended(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-s@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.legacy(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc042-l@example.test', 'pwd', '{"role":"courier"}')
on conflict (id) do nothing;

update public.profiles
set consent_status = 'active',
    role = case
      when id = pg_temp.admin() then 'admin'::public.profile_role
      when id = pg_temp.merchant() then 'merchant'::public.profile_role
      else 'courier'::public.profile_role
    end
where id in (pg_temp.admin(), pg_temp.merchant(), pg_temp.courier_a(), pg_temp.courier_b(), pg_temp.pending(),
             pg_temp.not_sent(), pg_temp.rejected(), pg_temp.suspended(), pg_temp.legacy());

insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate, license_status, insurance_status)
values
  (pg_temp.courier_a(), 'approved', false, 'moto', 'abc 123', 'verified', 'submitted'),
  (pg_temp.courier_b(), 'approved', false, 'car', 'AB 123 CD', 'none', 'none'),
  (pg_temp.pending(), 'pending', false, 'bike', null, 'none', 'none'),
  (pg_temp.not_sent(), 'pending', false, null, null, 'none', 'none'),
  (pg_temp.rejected(), 'rejected', false, 'moto', 'AAA 111', 'none', 'none'),
  (pg_temp.suspended(), 'suspended', false, 'moto', 'AAA 222', 'none', 'none'),
  (pg_temp.legacy(), 'approved', false, 'bike', null, 'verified', 'none')
on conflict (profile_id) do update
set status = excluded.status, available = false, vehicle_type = excluded.vehicle_type,
    vehicle_plate = excluded.vehicle_plate, license_status = excluded.license_status,
    insurance_status = excluded.insurance_status;

-- Postulación enviada (el guard de CC-043 solo deja marcarla con la bandera del finalize y el dueño de la función).
select set_config('app.courier_application_finalize', 'on', true);
update public.couriers
set application_submitted = true, submitted_at = now()
where profile_id in (pg_temp.courier_a(), pg_temp.courier_b(), pg_temp.pending(), pg_temp.rejected(),
                     pg_temp.suspended(), pg_temp.legacy());
select set_config('app.courier_application_finalize', 'off', true);

-- Documentos anteriores a CC-042 de courier_a: licencia (vigente e histórica) y seguro, sin vehículo.
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current, purge_after)
values
  (pg_temp.courier_a(), 'license', 'courier/00000000-0000-4000-8000-0000000042c1/license_1730000000000.jpg', 'verified', true, null),
  (pg_temp.courier_a(), 'license', 'courier/00000000-0000-4000-8000-0000000042c1/license_1720000000000.jpg', 'rejected', false, now() + interval '30 days'),
  (pg_temp.courier_a(), 'insurance', 'courier/00000000-0000-4000-8000-0000000042c1/insurance_1730000000000.jpg', 'submitted', true, null),
  (pg_temp.courier_a(), 'dni_front', 'courier/00000000-0000-4000-8000-0000000042c1/dni_front_1730000000000.jpg', 'verified', true, null),
  (pg_temp.legacy(), 'license', 'courier/00000000-0000-4000-8000-0000000042c7/license_1730000000000.jpg', 'verified', true, null);

insert into storage.buckets (id, name, public) values ('courier-docs', 'courier-docs', false) on conflict (id) do nothing;
insert into storage.objects (id, bucket_id, name, owner) values
  (gen_random_uuid(), 'courier-docs', 'courier/00000000-0000-4000-8000-0000000042c1/license_1740000000001.jpg', pg_temp.courier_a()),
  (gen_random_uuid(), 'courier-docs', 'courier/00000000-0000-4000-8000-0000000042c1/license_1740000000002.jpg', pg_temp.courier_a()),
  (gen_random_uuid(), 'courier-docs', 'courier/00000000-0000-4000-8000-0000000042c1/insurance_1740000000003.jpg', pg_temp.courier_a()),
  (gen_random_uuid(), 'courier-docs', 'courier/00000000-0000-4000-8000-0000000042c1/insurance_1740000000004.jpg', pg_temp.courier_a()),
  (gen_random_uuid(), 'courier-docs', 'courier/00000000-0000-4000-8000-0000000042c2/license_1740000000005.jpg', pg_temp.courier_b())
on conflict do nothing;

-- ============================================================================
-- Estructura y permisos
-- ============================================================================

select has_table('public', 'courier_vehicles', 'existe courier_vehicles');
select has_column('public', 'couriers', 'active_vehicle_id', 'couriers.active_vehicle_id existe');
select has_column('public', 'courier_documents', 'vehicle_id', 'courier_documents.vehicle_id existe');
select ok((select relrowsecurity from pg_class where oid = 'public.courier_vehicles'::regclass), 'courier_vehicles tiene RLS');
select ok(not has_table_privilege('authenticated', 'public.courier_vehicles', 'insert'), 'sin INSERT directo en courier_vehicles');
select ok(not has_table_privilege('authenticated', 'public.courier_vehicles', 'update'), 'sin UPDATE directo en courier_vehicles');
select ok(not has_table_privilege('authenticated', 'public.courier_vehicles', 'delete'), 'sin DELETE directo en courier_vehicles');
select ok(not has_table_privilege('anon', 'public.courier_vehicles', 'select'), 'anon no lee courier_vehicles');

select ok(has_function_privilege('authenticated', 'public.get_my_courier_vehicles()', 'execute'), 'get_my_courier_vehicles para authenticated');
select ok(has_function_privilege('authenticated', 'public.add_courier_vehicle(public.vehicle_type, text, boolean)', 'execute'), 'add_courier_vehicle para authenticated');
select ok(has_function_privilege('authenticated', 'public.update_courier_vehicle(uuid, text)', 'execute'), 'update_courier_vehicle para authenticated');
select ok(has_function_privilege('authenticated', 'public.remove_courier_vehicle(uuid)', 'execute'), 'remove_courier_vehicle para authenticated');
select ok(has_function_privilege('authenticated', 'public.set_active_courier_vehicle(uuid)', 'execute'), 'set_active_courier_vehicle para authenticated');
select ok(not has_function_privilege('anon', 'public.add_courier_vehicle(public.vehicle_type, text, boolean)', 'execute'), 'anon sin execute en add_courier_vehicle');
select ok(not has_function_privilege('anon', 'public.set_active_courier_vehicle(uuid)', 'execute'), 'anon sin execute en set_active_courier_vehicle');
select ok(not has_function_privilege('authenticated', 'app_private.cc042_sync_courier_reflection(uuid)', 'execute'), 'ayudante de reflejo sin execute para clientes');
select ok(not has_function_privilege('authenticated', 'app_private.cc042_backfill_courier_vehicles()', 'execute'), 'backfill sin execute para clientes');
select ok(not has_function_privilege('authenticated', 'app_private.cc042_lock_vehicle_owner(uuid)', 'execute'), 'ayudante de actor sin execute para clientes');
select ok((select bool_and(prosecdef) from pg_proc where oid in (
  'public.get_my_courier_vehicles()'::regprocedure,
  'public.add_courier_vehicle(public.vehicle_type, text, boolean)'::regprocedure,
  'public.update_courier_vehicle(uuid, text)'::regprocedure,
  'public.remove_courier_vehicle(uuid)'::regprocedure,
  'public.set_active_courier_vehicle(uuid)'::regprocedure)), 'las RPC de vehículos son security definer');
select ok((select bool_and(array_to_string(proconfig, ',') like '%search_path=public, pg_temp%') from pg_proc where oid in (
  'public.get_my_courier_vehicles()'::regprocedure,
  'public.add_courier_vehicle(public.vehicle_type, text, boolean)'::regprocedure,
  'public.update_courier_vehicle(uuid, text)'::regprocedure,
  'public.remove_courier_vehicle(uuid)'::regprocedure,
  'public.set_active_courier_vehicle(uuid)'::regprocedure)), 'las RPC de vehículos fijan search_path');
select has_function('public', 'add_courier_optional_document', array['jsonb', 'uuid'], 'add_courier_optional_document suma p_vehicle_id');
select has_function('public', 'replace_courier_document', array['jsonb', 'uuid'], 'replace_courier_document suma p_vehicle_id');
select hasnt_function('public', 'add_courier_optional_document', array['jsonb'], 'la firma vieja de add_courier_optional_document no existe');
select hasnt_function('public', 'replace_courier_document', array['jsonb'], 'la firma vieja de replace_courier_document no existe');

-- ============================================================================
-- Backfill
-- ============================================================================

select ok(app_private.cc042_backfill_courier_vehicles() >= 6, 'backfill crea los vehículos de los repartidores con vehículo');
select is(app_private.cc042_backfill_courier_vehicles(), 0, 'backfill es idempotente');
select is((select count(*)::int from public.couriers
  where profile_id in (pg_temp.courier_a(), pg_temp.courier_b(), pg_temp.pending(), pg_temp.rejected(), pg_temp.suspended(), pg_temp.legacy())
    and active_vehicle_id is not null), 6, 'cada repartidor con vehículo queda con su vehículo activo');
insert into cc042_ids select 'a_moto', active_vehicle_id from public.couriers where profile_id = pg_temp.courier_a();
insert into cc042_ids select 'b_car', active_vehicle_id from public.couriers where profile_id = pg_temp.courier_b();
insert into cc042_ids select 'legacy_bike', active_vehicle_id from public.couriers where profile_id = pg_temp.legacy();
select ok(pg_temp.id('a_moto') is not null, 'courier_a queda con vehículo activo');
select is((select row(vehicle_type, plate, license_status, insurance_status)::text from public.courier_vehicles where id = pg_temp.id('a_moto')),
  row('moto'::public.vehicle_type, 'ABC 123'::text, 'verified'::public.document_review_status, 'submitted'::public.document_review_status)::text,
  'el vehículo copia tipo, patente en mayúsculas y estados');
select is((select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a() and kind in ('license', 'insurance') and vehicle_id = pg_temp.id('a_moto')),
  3, 'licencia (vigente e histórica) y seguro quedan en el vehículo');
select is((select vehicle_id from public.courier_documents where courier_id = pg_temp.courier_a() and kind = 'dni_front'), null, 'el DNI no tiene vehículo');
select is((select row(license_status, insurance_status)::text from public.courier_vehicles where id = pg_temp.id('legacy_bike')),
  row('none'::public.document_review_status, 'none'::public.document_review_status)::text, 'la bici no tiene licencia ni seguro');
select is((pg_temp.courier(pg_temp.legacy())).license_status::text, 'verified', 'el backfill no toca el reflejo de un repartidor en bici');
select is((select vehicle_id from public.courier_documents where courier_id = pg_temp.legacy() and kind = 'license'), null,
  'la licencia vieja de una bici queda sin vehículo');
select is((select count(*)::int from public.courier_vehicles where courier_id = pg_temp.not_sent()), 0, 'sin vehículo no hay filas');

-- ============================================================================
-- Checks y consistencia
-- ============================================================================

select throws_ok($$ insert into public.courier_vehicles (courier_id, vehicle_type, plate) values (pg_temp.courier_b(), 'bike', 'ABC 123') $$,
  '23514', null, 'bici con patente viola el check');
select throws_ok($$ insert into public.courier_vehicles (courier_id, vehicle_type, license_status) values (pg_temp.courier_b(), 'walk', 'submitted') $$,
  '23514', null, 'a pie con licencia viola el check');
select throws_ok($$ insert into public.courier_vehicles (courier_id, vehicle_type, plate) values (pg_temp.courier_b(), 'car', 'XYZ 999') $$,
  '23505', null, 'dos autos vigentes del mismo repartidor violan el índice único');
select throws_ok($$ update public.couriers set active_vehicle_id = pg_temp.id('b_car') where profile_id = pg_temp.courier_a() $$,
  'P0001', 'VALIDATION_ERROR', 'el vehículo activo tiene que ser del mismo repartidor');
select throws_ok($$ update public.courier_vehicles set archived_at = now() where id = pg_temp.id('a_moto') $$,
  'P0001', 'INVALID_STATE_TRANSITION', 'no se archiva el vehículo activo ni por escritura directa');
select throws_ok($$ insert into public.courier_documents (courier_id, kind, storage_path, status, vehicle_id)
  values (pg_temp.courier_a(), 'dni_back', 'courier/00000000-0000-4000-8000-0000000042c1/dni_back_1.jpg', 'submitted', pg_temp.id('a_moto')) $$,
  '23514', null, 'un DNI no puede tener vehículo');
select throws_ok($$ insert into public.courier_documents (courier_id, kind, storage_path, status, vehicle_id)
  values (pg_temp.courier_b(), 'license', 'courier/00000000-0000-4000-8000-0000000042c2/license_x.jpg', 'submitted', pg_temp.id('a_moto')) $$,
  'P0001', 'VALIDATION_ERROR', 'el vehículo del documento tiene que ser del mismo repartidor');

-- ============================================================================
-- Autorización
-- ============================================================================

select pg_temp.as_anon();
select throws_ok($$ select public.get_my_courier_vehicles() $$, '42501', null, 'anon no ejecuta get_my_courier_vehicles');
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, '42501', null, 'anon no ejecuta add_courier_vehicle');
select pg_temp.as_no_subject();
select throws_ok($$ select public.get_my_courier_vehicles() $$, 'P0001', 'UNAUTHENTICATED', 'sin sesión: get');
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, 'P0001', 'UNAUTHENTICATED', 'sin sesión: add');
select throws_ok($$ select public.update_courier_vehicle(pg_temp.id('a_moto'), 'ABC 124') $$, 'P0001', 'UNAUTHENTICATED', 'sin sesión: update');
select throws_ok($$ select public.remove_courier_vehicle(pg_temp.id('a_moto')) $$, 'P0001', 'UNAUTHENTICATED', 'sin sesión: remove');
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_moto')) $$, 'P0001', 'UNAUTHENTICATED', 'sin sesión: set_active');

select pg_temp.act_as(pg_temp.merchant());
select throws_ok($$ select public.get_my_courier_vehicles() $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'comercio: get');
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'comercio: add');
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_moto')) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'comercio: set_active');
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'admin: add');

select pg_temp.act_as(pg_temp.suspended());
select throws_ok($$ select public.get_my_courier_vehicles() $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'suspendido: get');
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'suspendido: add');
select pg_temp.act_as(pg_temp.rejected());
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'rechazado: add');
select pg_temp.act_as(pg_temp.not_sent());
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, 'P0001', 'INVALID_STATE_TRANSITION', 'postulación sin enviar: add');

select pg_temp.as_postgres();
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.courier_a();
select pg_temp.act_as(pg_temp.courier_a());
select throws_ok($$ select public.get_my_courier_vehicles() $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'consentimiento inactivo: get');
select throws_ok($$ select public.add_courier_vehicle('bike', null, false) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'consentimiento inactivo: add');
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_moto')) $$, 'P0001', 'UNAUTHORIZED_ACTOR', 'consentimiento inactivo: set_active');
select pg_temp.as_postgres();
update public.profiles set consent_status = 'active' where id = pg_temp.courier_a();

-- Vehículo de otro repartidor.
select pg_temp.act_as(pg_temp.courier_a());
select throws_ok($$ select public.update_courier_vehicle(pg_temp.id('b_car'), 'AB 999 CD') $$, 'P0001', 'NOT_FOUND', 'no edita el vehículo de otro');
select throws_ok($$ select public.remove_courier_vehicle(pg_temp.id('b_car')) $$, 'P0001', 'NOT_FOUND', 'no quita el vehículo de otro');
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('b_car')) $$, 'P0001', 'NOT_FOUND', 'no activa el vehículo de otro');
select is((select count(*)::int from public.courier_vehicles where courier_id = pg_temp.courier_b()), 0, 'RLS: no lee los vehículos de otro');
select is((select count(*)::int from public.courier_vehicles where courier_id = pg_temp.courier_a()), 1, 'RLS: lee los propios');

-- Escritura directa.
select throws_ok($$ insert into public.courier_vehicles (courier_id, vehicle_type) values (pg_temp.courier_a(), 'bike') $$,
  '42501', null, 'el repartidor no inserta vehículos directo');
select throws_ok($$ update public.courier_vehicles set plate = 'ZZZ 999' where id = pg_temp.id('a_moto') $$,
  '42501', null, 'el repartidor no actualiza vehículos directo');
select throws_ok($$ delete from public.courier_vehicles where id = pg_temp.id('a_moto') $$,
  '42501', null, 'el repartidor no borra vehículos directo');
select throws_ok($$ update public.couriers set vehicle_type = 'bike' where profile_id = pg_temp.courier_a() $$,
  '42501', null, 'couriers_update_self rechaza vehicle_type');
select throws_ok($$ update public.couriers set vehicle_plate = 'ZZZ 999' where profile_id = pg_temp.courier_a() $$,
  '42501', null, 'couriers_update_self rechaza vehicle_plate');
select throws_ok($$ update public.couriers set active_vehicle_id = null where profile_id = pg_temp.courier_a() $$,
  '42501', null, 'couriers_update_self rechaza active_vehicle_id');
select lives_ok($$ update public.couriers set available = false where profile_id = pg_temp.courier_a() $$,
  'couriers_update_self sigue permitiendo la disponibilidad');

-- ============================================================================
-- Altas, patente y DUPLICATE_VEHICLE
-- ============================================================================

select throws_ok($$ select public.add_courier_vehicle(null, null, false) $$, 'P0001', 'VALIDATION_ERROR', 'tipo nulo es inválido');
select throws_ok($$ select public.add_courier_vehicle('car', null, false) $$, 'P0001', 'VALIDATION_ERROR', 'auto sin patente es inválido');
select throws_ok($$ select public.add_courier_vehicle('car', 'mi auto', false) $$, 'P0001', 'VALIDATION_ERROR', 'auto con patente inválida');
select throws_ok($$ select public.add_courier_vehicle('bike', 'ABC 123', false) $$, 'P0001', 'VALIDATION_ERROR', 'bici con patente es inválida');
select throws_ok($$ select public.add_courier_vehicle('moto', 'XYZ 789', false) $$, 'P0001', 'DUPLICATE_VEHICLE', 'segunda moto falla');

insert into cc042_ids select 'a_bike', (public.add_courier_vehicle('bike', null, false)->>'vehicleId')::uuid;
select ok(pg_temp.id('a_bike') is not null, 'agrega una bici');
select is((pg_temp.courier(pg_temp.courier_a())).active_vehicle_id, pg_temp.id('a_moto'), 'sin p_make_active el activo no cambia');
select is((pg_temp.courier(pg_temp.courier_a())).vehicle_type::text, 'moto', 'el reflejo sigue en la moto');
select is(jsonb_array_length(public.get_my_courier_vehicles()->'vehicles'), 2, 'get_my_courier_vehicles devuelve los dos');
select is(public.get_my_courier_vehicles()->>'activeVehicleId', pg_temp.id('a_moto')::text, 'get_my_courier_vehicles marca el activo');
insert into cc042_ids select 'a_car', (public.add_courier_vehicle('car', ' ab 456 cd ', false)->>'vehicleId')::uuid;
select is((select plate from public.courier_vehicles where id = pg_temp.id('a_car')), 'AB 456 CD', 'la patente se guarda normalizada');

-- ============================================================================
-- Reflejo y doc_level
-- ============================================================================

select is((pg_temp.courier(pg_temp.courier_a())).doc_level, 1, 'doc_level inicial con la licencia verificada de la moto');
select is(public.set_active_courier_vehicle(pg_temp.id('a_bike'))->>'activeVehicleId', pg_temp.id('a_bike')::text, 'activa la bici');
select is((select row(vehicle_type, vehicle_plate, license_status, insurance_status, active_vehicle_id)::text from public.couriers where profile_id = pg_temp.courier_a()),
  row('bike'::public.vehicle_type, null::text, 'none'::public.document_review_status, 'none'::public.document_review_status, pg_temp.id('a_bike'))::text,
  'el reflejo pasa a la bici');
select is((pg_temp.courier(pg_temp.courier_a())).doc_level, 0, 'doc_level sigue al activo (bici)');
select is(public.set_active_courier_vehicle(pg_temp.id('a_bike'))->>'activeVehicleId', pg_temp.id('a_bike')::text, 'activar el que ya está activo es OK');
select pg_temp.as_postgres();
select is((select count(*)::int from public.audit_log where actor_id = pg_temp.courier_a() and action = 'set_active_courier_vehicle'), 1,
  'el reintento no duplica la auditoría');
select pg_temp.act_as(pg_temp.courier_a());
select lives_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_moto')) $$, 'vuelve a la moto');
select is((pg_temp.courier(pg_temp.courier_a())).vehicle_plate, 'ABC 123', 'la patente de la moto se conserva al alternar');
select is((pg_temp.courier(pg_temp.courier_a())).doc_level, 1, 'doc_level vuelve con la moto');

insert into cc042_ids select 'a_walk', (public.add_courier_vehicle('walk', null, true)->>'vehicleId')::uuid;
select is((pg_temp.courier(pg_temp.courier_a())).active_vehicle_id, pg_temp.id('a_walk'), 'con p_make_active el nuevo queda activo');
select is((pg_temp.courier(pg_temp.courier_a())).vehicle_type::text, 'walk', 'y el reflejo lo sigue');
select lives_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_moto')) $$, 'vuelve a la moto otra vez');

-- Editar la patente del activo: el seguro vuelve a none, la licencia se conserva.
select is(public.update_courier_vehicle(pg_temp.id('a_moto'), 'ABC 999')->>'vehicleId', pg_temp.id('a_moto')::text, 'edita la patente de la moto');
select is((select row(plate, license_status, insurance_status)::text from public.courier_vehicles where id = pg_temp.id('a_moto')),
  row('ABC 999'::text, 'verified'::public.document_review_status, 'none'::public.document_review_status)::text,
  'nueva patente: seguro a none, licencia conservada');
select is((select row(vehicle_plate, insurance_status)::text from public.couriers where profile_id = pg_temp.courier_a()),
  row('ABC 999'::text, 'none'::public.document_review_status)::text, 'el reflejo toma la patente y el seguro');
select pg_temp.as_postgres();
select is((select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a() and kind = 'insurance' and is_current), 0,
  'el seguro de la patente vieja deja de estar vigente');
select pg_temp.act_as(pg_temp.courier_a());
select is(public.update_courier_vehicle(pg_temp.id('a_moto'), 'abc 999')->>'vehicleId', pg_temp.id('a_moto')::text, 'misma patente es OK sin cambios');
select throws_ok($$ select public.update_courier_vehicle(pg_temp.id('a_moto'), null) $$, 'P0001', 'VALIDATION_ERROR', 'la moto no queda sin patente');
-- Editar un inactivo no toca el reflejo.
select lives_ok($$ select public.update_courier_vehicle(pg_temp.id('a_car'), 'AB 457 CD') $$, 'edita la patente de un inactivo');
select is((pg_temp.courier(pg_temp.courier_a())).vehicle_plate, 'ABC 999', 'el reflejo no cambia al editar un inactivo');

-- ============================================================================
-- Documentos por vehículo
-- ============================================================================

select throws_ok($$ select public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000042c1/license_1740000000001.jpg'), pg_temp.id('a_bike')) $$,
  'P0001', 'VALIDATION_ERROR', 'la bici no lleva licencia');
select throws_ok($$ select public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000042c1/license_1740000000001.jpg'), pg_temp.id('b_car')) $$,
  'P0001', 'NOT_FOUND', 'no carga licencia en el vehículo de otro');
-- Licencia del auto (inactivo): el reflejo no cambia.
select is(public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000042c1/license_1740000000001.jpg'), pg_temp.id('a_car'))->>'status',
  'submitted', 'licencia del auto queda submitted');
select is((select license_status::text from public.courier_vehicles where id = pg_temp.id('a_car')), 'submitted', 'el auto marca la licencia');
select is((pg_temp.courier(pg_temp.courier_a())).license_status::text, 'verified', 'el reflejo (moto) no cambia por el auto');
select pg_temp.as_postgres();
select is((select vehicle_id from public.courier_documents where courier_id = pg_temp.courier_a() and kind = 'license' and is_current and status = 'submitted'),
  pg_temp.id('a_car'), 'el documento queda en el auto');
select is((select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a() and kind = 'license' and is_current), 2,
  'una licencia vigente por vehículo');
-- Seguro de la moto activa: sin p_vehicle_id usa el activo y actualiza el reflejo.
select pg_temp.act_as(pg_temp.courier_a());
select is(public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000042c1/insurance_1740000000003.jpg'))->>'status',
  'submitted', 'seguro sin p_vehicle_id va al vehículo activo');
select is((pg_temp.courier(pg_temp.courier_a())).insurance_status::text, 'submitted', 'el reflejo toma el seguro del activo');

-- Verificación del admin: inactivo no toca el reflejo; activo sí, con doc_level.
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select public.admin_verify_document(
  (select id from public.courier_documents where vehicle_id = pg_temp.id('a_car') and kind = 'license' and is_current), 'verified') $$,
  'admin verifica la licencia del auto');
select pg_temp.as_postgres();
select is((select license_status::text from public.courier_vehicles where id = pg_temp.id('a_car')), 'verified', 'el auto queda con licencia verificada');
select is((pg_temp.courier(pg_temp.courier_a())).doc_level, 1, 'doc_level no cambia por un inactivo');
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select public.admin_verify_document(
  (select id from public.courier_documents where vehicle_id = pg_temp.id('a_moto') and kind = 'insurance' and is_current), 'verified') $$,
  'admin verifica el seguro de la moto activa');
select pg_temp.as_postgres();
select is((pg_temp.courier(pg_temp.courier_a())).insurance_status::text, 'verified', 'el reflejo toma la verificación del activo');
select is((pg_temp.courier(pg_temp.courier_a())).doc_level, 2, 'doc_level sube con el activo');
-- Rechazo y reemplazo por vehículo. La licencia de la moto vino verificada del backfill: se la deja en revisión (como
-- si se hubiera vuelto a cargar) para que el admin la pueda decidir.
select pg_temp.as_postgres();
update public.courier_documents set status = 'submitted'
where vehicle_id = pg_temp.id('a_moto') and kind = 'license' and is_current;
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select lives_ok($$ select public.admin_verify_document(
  (select id from public.courier_documents where vehicle_id = pg_temp.id('a_moto') and kind = 'license' and is_current), 'rejected', 'Vencida', 'expired') $$,
  'admin rechaza la licencia de la moto');
select pg_temp.as_postgres();
select is((pg_temp.courier(pg_temp.courier_a())).license_status::text, 'rejected', 'el reflejo toma el rechazo');
select pg_temp.act_as(pg_temp.courier_a());
select throws_ok($$ select public.replace_courier_document(jsonb_build_object('kind','dni_front','storagePath','courier/00000000-0000-4000-8000-0000000042c1/dni_front_1740000000009.jpg'), pg_temp.id('a_moto')) $$,
  'P0001', 'VALIDATION_ERROR', 'el DNI no admite vehículo');
select is(public.replace_courier_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000042c1/license_1740000000002.jpg'), pg_temp.id('a_moto'))->>'status',
  'submitted', 'reemplaza la licencia de la moto');
select is((pg_temp.courier(pg_temp.courier_a())).license_status::text, 'submitted', 'el reflejo toma el reemplazo');
select pg_temp.as_postgres();
select is((select license_status::text from public.courier_vehicles where id = pg_temp.id('a_car')), 'verified', 'el reemplazo de la moto no toca el auto');

-- ============================================================================
-- Archivar
-- ============================================================================

select pg_temp.act_as(pg_temp.courier_a());
select throws_ok($$ select public.remove_courier_vehicle(pg_temp.id('a_moto')) $$, 'P0001', 'INVALID_STATE_TRANSITION', 'no se quita el activo');
select is(public.remove_courier_vehicle(pg_temp.id('a_walk'))->>'vehicleId', pg_temp.id('a_walk')::text, 'quita un inactivo');
select is(jsonb_array_length(public.get_my_courier_vehicles()->'vehicles'), 3, 'el archivado no se lista');
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_walk')) $$, 'P0001', 'NOT_FOUND', 'no se activa un archivado');
select throws_ok($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000042c1/insurance_1740000000004.jpg'), pg_temp.id('a_walk')) $$,
  'P0001', 'NOT_FOUND', 'no se cargan documentos en un archivado');
insert into cc042_ids select 'a_walk2', (public.add_courier_vehicle('walk', null, false)->>'vehicleId')::uuid;
select ok(pg_temp.id('a_walk2') is distinct from pg_temp.id('a_walk'), 'después de archivar se puede volver a agregar ese tipo');

-- ============================================================================
-- VEHICLE_SWITCH_BLOCKED
-- ============================================================================

select pg_temp.as_postgres();
insert into public.zones (id, name, centroid_lat, centroid_lng, active)
values (pg_temp.zone(), 'CC042 Zona', -27.430000, -65.620000, true);
insert into public.delivery_requests (id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method,
  created_at, published_at, expires_at)
values
  (pg_temp.request(1), pg_temp.merchant(), 'published', pg_temp.zone(), pg_temp.zone(), 'chico', 'cash', now(), now(), now() + interval '1 hour'),
  (pg_temp.request(2), pg_temp.merchant(), 'matched', pg_temp.zone(), pg_temp.zone(), 'chico', 'cash', now(), now(), null),
  (pg_temp.request(3), pg_temp.merchant(), 'published', pg_temp.zone(), pg_temp.zone(), 'chico', 'cash', now(), now() - interval '2 hours', now() - interval '1 hour');
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
values (pg_temp.offer(1), pg_temp.request(1), pg_temp.courier_a(), 1500, 15, 'pending');

select pg_temp.act_as(pg_temp.courier_a());
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_car')) $$, 'P0001', 'VEHICLE_SWITCH_BLOCKED', 'oferta pendiente bloquea el cambio');
select throws_ok($$ select public.update_courier_vehicle(pg_temp.id('a_moto'), 'ABC 777') $$, 'P0001', 'VEHICLE_SWITCH_BLOCKED', 'oferta pendiente bloquea la patente del activo');
select throws_ok($$ select public.add_courier_vehicle('car', 'AB 111 CD', true) $$, 'P0001', 'DUPLICATE_VEHICLE', 'el duplicado se detecta antes del bloqueo');
select lives_ok($$ select public.update_courier_vehicle(pg_temp.id('a_car'), 'AB 458 CD') $$, 'la patente de un inactivo se puede cambiar con ofertas');
select is((pg_temp.courier(pg_temp.courier_a())).active_vehicle_id, pg_temp.id('a_moto'), 'el bloqueo no cambia el activo');

-- Una oferta pendiente de una solicitud vencida no bloquea.
select pg_temp.as_postgres();
update public.offers set status = 'withdrawn' where id = pg_temp.offer(1);
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
values (pg_temp.offer(3), pg_temp.request(3), pg_temp.courier_a(), 1500, 15, 'pending');
select pg_temp.act_as(pg_temp.courier_a());
select lives_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_car')) $$, 'una oferta de solicitud vencida no bloquea');
select lives_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_moto')) $$, 'vuelve a la moto');

-- Viaje activo.
select pg_temp.as_postgres();
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status, decided_at)
values (pg_temp.offer(2), pg_temp.request(2), pg_temp.courier_a(), 1500, 15, 'accepted', now());
update public.delivery_requests set accepted_offer_id = pg_temp.offer(2), matched_at = now() where id = pg_temp.request(2);
select pg_temp.act_as(pg_temp.courier_a());
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_car')) $$, 'P0001', 'VEHICLE_SWITCH_BLOCKED', 'viaje matched bloquea el cambio');
select pg_temp.as_postgres();
update public.delivery_requests set status = 'in_transit', picked_up_at = now() where id = pg_temp.request(2);
select pg_temp.act_as(pg_temp.courier_a());
select throws_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_car')) $$, 'P0001', 'VEHICLE_SWITCH_BLOCKED', 'viaje in_transit bloquea el cambio');
select pg_temp.as_postgres();
update public.delivery_requests set status = 'delivered', delivered_at = now() where id = pg_temp.request(2);
select pg_temp.act_as(pg_temp.courier_a());
select lives_ok($$ select public.set_active_courier_vehicle(pg_temp.id('a_car')) $$, 'con el viaje entregado se puede cambiar');

-- ============================================================================
-- Onboarding: finalize crea el vehículo del alta y le asocia licencia y seguro
-- ============================================================================

select pg_temp.as_postgres();
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
values
  (pg_temp.not_sent(), 'dni_front', 'courier/00000000-0000-4000-8000-0000000042c4/dni_front_1.jpg', 'submitted', true),
  (pg_temp.not_sent(), 'dni_back', 'courier/00000000-0000-4000-8000-0000000042c4/dni_back_1.jpg', 'submitted', true),
  (pg_temp.not_sent(), 'selfie', 'courier/00000000-0000-4000-8000-0000000042c4/selfie_1.jpg', 'submitted', true),
  (pg_temp.not_sent(), 'avatar', 'courier/00000000-0000-4000-8000-0000000042c4/avatar_1.jpg', 'submitted', true),
  (pg_temp.not_sent(), 'license', 'courier/00000000-0000-4000-8000-0000000042c4/license_1.jpg', 'submitted', true);
set local role service_role;
select is((public.finalize_courier_application(pg_temp.not_sent(), repeat('a', 64), 'moto', 'aa 123 bb')->>'idempotent'), 'false',
  'finalize envía la postulación');
select pg_temp.as_postgres();
select is((select count(*)::int from public.courier_vehicles where courier_id = pg_temp.not_sent()), 1, 'finalize crea el vehículo del alta');
select is((select row(vehicle_type, plate)::text from public.courier_vehicles v join public.couriers c on c.active_vehicle_id = v.id where c.profile_id = pg_temp.not_sent()),
  row('moto'::public.vehicle_type, 'AA 123 BB'::text)::text, 'el vehículo del alta queda activo');
select is((select vehicle_id from public.courier_documents where courier_id = pg_temp.not_sent() and kind = 'license'),
  (pg_temp.courier(pg_temp.not_sent())).active_vehicle_id, 'la licencia del onboarding queda en ese vehículo');

-- ============================================================================
-- Privacidad: el comercio no ve la lista de vehículos
-- ============================================================================

select pg_temp.act_as(pg_temp.merchant());
select is((select count(*)::int from public.courier_vehicles), 0, 'el comercio no lee vehículos');
select pg_temp.act_as(pg_temp.admin(), 'aal2');
select ok((select count(*)::int from public.courier_vehicles) >= 4, 'el admin lee los vehículos');

select * from finish();
rollback;
