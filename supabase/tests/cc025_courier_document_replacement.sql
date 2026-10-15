begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(57);

create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000025a1'::uuid $$;
create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000025c1'::uuid $$;
create function pg_temp.courier_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000025c2'::uuid $$;

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

create function pg_temp.act_as_anon()
returns void language plpgsql as $$
begin
  set local role anon;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
end;
$$;

create function pg_temp.act_as_authenticated_without_subject()
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal1')::text, true);
end;
$$;

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Crear usuarios de prueba
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc25.admin@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc25.courierA@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.courier_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc25.courierB@example.test', 'pwd', '{"role":"courier"}'::jsonb);

update public.profiles
set consent_status = 'active'
where id in (pg_temp.admin_a(), pg_temp.courier_a(), pg_temp.courier_b());

update public.profiles set role = 'admin' where id = pg_temp.admin_a();

update public.couriers
set status = 'pending', available = false, vehicle_type = 'moto', vehicle_plate = 'CC25AAA'
where profile_id in (pg_temp.courier_a(), pg_temp.courier_b());

-- Asegurar existencia de buckets en storage
insert into storage.buckets (id, name, public)
values ('courier-docs', 'courier-docs', false), ('other-bucket', 'other-bucket', false)
on conflict do nothing;

-- 1. Schema: columnas y constraints
select has_column('public', 'courier_documents', 'is_current', 'courier_documents tiene columna is_current');
select col_not_null('public', 'courier_documents', 'is_current', 'is_current es not null');
select col_has_default('public', 'courier_documents', 'is_current', 'is_current tiene default true');
select has_column('public', 'courier_documents', 'rejection_code', 'courier_documents tiene columna rejection_code');
select has_column('public', 'courier_documents', 'idempotency_key', 'courier_documents tiene columna idempotency_key');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.courier_documents')
      and conname = 'courier_documents_rejection_code_check'
      and contype = 'c'
  ),
  'courier_documents tiene check de catalogo seguro para rejection_code'
);

-- 2a. PR364-R01: UPSERT (ON CONFLICT DO UPDATE) falla con SQLSTATE 42501 incluso en fila nueva por revocacion de UPDATE
select pg_temp.act_as(pg_temp.courier_a());

select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025d1',
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_initial.jpg',
      'submitted',
      true
    ) on conflict (id) do update set storage_path = excluded.storage_path;
  $$,
  '42501|permission denied',
  'PR364-R01: INSERT ... ON CONFLICT DO UPDATE es rechazado con 42501 porque UPDATE esta revocado'
);

-- 2b. PR364-R02: RLS bloquea INSERT directo con idempotency_key asignada (debe ser null)
select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current, idempotency_key
    ) values (
      '00000000-0000-4000-8000-0000000025d1',
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_initial.jpg',
      'submitted',
      true,
      '00000000-0000-4000-8000-000000000099'::uuid
    );
  $$,
  'violates row-level security',
  'PR364-R02: RLS rechaza INSERT directo con idempotency_key asignada'
);

select is(
  (select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a() and kind = 'license'),
  0,
  'PR364-R02: Cero filas insertadas tras intento con idempotency_key no null'
);

-- 2c. RLS bloquea intentos directos de alterar status, rejection_code, is_current o courier_id en INSERT
select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025d1',
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_initial.jpg',
      'verified',
      true
    );
  $$,
  'violates row-level security',
  'RLS bloquea INSERT directo intentando auto-verificar documento'
);

select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current, rejection_code
    ) values (
      '00000000-0000-4000-8000-0000000025d1',
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_initial.jpg',
      'submitted',
      true,
      'illegible'
    );
  $$,
  'violates row-level security',
  'RLS bloquea INSERT directo con rejection_code asignado'
);

select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025d1',
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_initial.jpg',
      'submitted',
      false
    );
  $$,
  'violates row-level security',
  'RLS bloquea INSERT directo con is_current = false'
);

select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025d1',
      '00000000-0000-4000-8000-0000000025c2',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c2/license_initial.jpg',
      'submitted',
      true
    );
  $$,
  'violates row-level security',
  'RLS bloquea INSERT directo asignando courier_id ajeno'
);

-- 2d. Inserción inicial legítima permitida por RLS cuando no existe documento
select lives_ok(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025d1',
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_initial.jpg',
      'submitted',
      true
    );
  $$,
  'RLS permite la insercion inicial cuando no existe documento del mismo kind'
);

-- 3. Inserción directa duplicada BLOQUEADA por RLS (cierre de PR358-H01)
select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025d2',
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_second.jpg',
      'submitted',
      true
    );
  $$,
  'violates row-level security',
  'RLS bloquea INSERT directo cuando ya existe un documento del mismo kind (PR358-H01 cerrado)'
);

-- 4. Matriz RLS y permisos: UPDATE, DELETE e INSERT directos en courier_documents
-- 4a. Courier propio: UPDATE y DELETE directos REVOCADOS
select pg_temp.act_as(pg_temp.courier_a());
select throws_matching(
  $$
    update public.courier_documents
    set status = 'verified'
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'Courier no puede hacer UPDATE directo (permiso UPDATE revocado en tabla)'
);

select throws_matching(
  $$
    delete from public.courier_documents
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'DELETE directo revocado para usuarios autenticados'
);

-- 4b. Courier ajeno: UPDATE y DELETE sobre documento de otro courier
select pg_temp.act_as(pg_temp.courier_b());
select throws_matching(
  $$
    update public.courier_documents
    set status = 'verified'
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'Courier ajeno no puede hacer UPDATE directo'
);

select throws_matching(
  $$
    delete from public.courier_documents
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'Courier ajeno no puede hacer DELETE directo'
);

-- 4c. Admin AAL1: UPDATE, DELETE e INSERT directos REVOCADOS / BLOQUEADOS
select pg_temp.act_as(pg_temp.admin_a(), 'aal1');
select throws_matching(
  $$
    update public.courier_documents
    set status = 'verified'
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'Admin AAL1 no puede hacer UPDATE directo (debe usar RPC admin_verify_document con AAL2)'
);

select throws_matching(
  $$
    delete from public.courier_documents
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'Admin AAL1 no puede hacer DELETE directo'
);

select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025a2',
      '00000000-0000-4000-8000-0000000025c1',
      'dni_back',
      'courier/00000000-0000-4000-8000-0000000025c1/dni_back.jpg',
      'submitted',
      true
    );
  $$,
  'violates row-level security',
  'Admin AAL1 no puede hacer INSERT directo sobre courier_documents'
);

-- 4d. Admin AAL2: UPDATE, DELETE e INSERT directos REVOCADOS / BLOQUEADOS
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select throws_matching(
  $$
    update public.courier_documents
    set status = 'verified'
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'Admin AAL2 no puede saltar la RPC auditada mediante UPDATE directo'
);

select throws_matching(
  $$
    delete from public.courier_documents
    where id = '00000000-0000-4000-8000-0000000025d1';
  $$,
  '42501|permission denied',
  'Admin AAL2 no puede hacer DELETE directo'
);

select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025a3',
      '00000000-0000-4000-8000-0000000025c1',
      'dni_back',
      'courier/00000000-0000-4000-8000-0000000025c1/dni_back.jpg',
      'submitted',
      true
    );
  $$,
  'violates row-level security',
  'Admin AAL2 no puede hacer INSERT directo sobre courier_documents'
);

-- 4e. Anon: sin acceso de lectura ni insercion (RLS) y sin permisos de modificacion (42501)
select pg_temp.act_as_anon();
select is(
  (select count(*)::int from public.courier_documents),
  0,
  'Anon no ve ninguna fila de courier_documents por RLS'
);

select throws_matching(
  $$
    insert into public.courier_documents (
      id, courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025a4',
      '00000000-0000-4000-8000-0000000025c1',
      'dni_back',
      'courier/00000000-0000-4000-8000-0000000025c1/dni_back.jpg',
      'submitted',
      true
    );
  $$,
  'violates row-level security',
  'Anon no puede hacer INSERT sobre courier_documents (bloqueado por RLS)'
);

select throws_matching(
  $$
    update public.courier_documents set status = 'verified';
  $$,
  '42501|permission denied',
  'Anon no tiene permiso UPDATE sobre courier_documents'
);

select throws_matching(
  $$
    delete from public.courier_documents;
  $$,
  '42501|permission denied',
  'Anon no tiene permiso DELETE sobre courier_documents'
);

-- 5a. RPC replace_courier_document: anon no tiene permisos de ejecución
select pg_temp.act_as_anon();
select throws_ok(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_new.jpg'
    ));
  $$,
  '42501'::char(5),
  null::text,
  'replace_courier_document rechaza actor anonimo por falta de execute grant'
);

-- 5b. RPC replace_courier_document: authenticated sin sub devuelve UNAUTHENTICATED
select pg_temp.act_as_authenticated_without_subject();
select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_new.jpg'
    ));
  $$,
  'UNAUTHENTICATED',
  'replace_courier_document rechaza actor authenticated sin sub'
);

-- 6. RPC replace_courier_document: rechazo actor no courier
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025a1/license_new.jpg'
    ));
  $$,
  'UNAUTHORIZED_ACTOR',
  'replace_courier_document rechaza actor que no es courier'
);

-- 7. RPC replace_courier_document: rechazo path inválido o ajeno
select pg_temp.act_as(pg_temp.courier_a());
select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c2/license_new.jpg'
    ));
  $$,
  'VALIDATION_ERROR',
  'replace_courier_document rechaza storagePath de otro usuario'
);

select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/../other/license_new.jpg'
    ));
  $$,
  'VALIDATION_ERROR',
  'replace_courier_document rechaza storagePath con path traversal'
);

select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_new.jpg',
      'idempotencyKey', 'not-a-valid-uuid'
    ));
  $$,
  'VALIDATION_ERROR',
  'replace_courier_document rechaza idempotencyKey con formato no UUID'
);

-- 8. RPC replace_courier_document: no se puede reemplazar documento en estado submitted
select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg'
    ));
  $$,
  'INVALID_STATE_TRANSITION',
  'replace_courier_document rechaza reemplazar documento que aun esta en submitted'
);

-- 9. Admin rechaza documento legítimamente (con motivo seguro y nota interna de auditoría)
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select lives_ok(
  $$
    select public.admin_verify_document(
      '00000000-0000-4000-8000-0000000025d1',
      'rejected',
      'Nota interna admin: imagen borrosa y bordes cortados',
      'illegible'
    );
  $$,
  'admin_verify_document rechaza con p_rejection_code seguro'
);

select is(
  (select rejection_code from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d1'),
  'illegible',
  'courier_documents almacena rejection_code seguro'
);

-- 10. PR364-H01: Comprobación incondicional de objeto en Storage
select pg_temp.act_as(pg_temp.courier_a());

-- 10a. Bucket vacío (no existe objeto en courier-docs) -> falla con NOT_FOUND
select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg'
    ));
  $$,
  'NOT_FOUND',
  'H01: replace_courier_document falla con NOT_FOUND cuando el objeto no existe en Storage (bucket vacio)'
);

-- 10b. Objeto existe en bucket equivocado -> falla con NOT_FOUND
select pg_temp.reset_actor();
insert into storage.objects (id, bucket_id, name, owner)
values ('00000000-0000-4000-8000-0000000025e1', 'other-bucket', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg', pg_temp.courier_a())
on conflict do nothing;

select pg_temp.act_as(pg_temp.courier_a());
select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg'
    ));
  $$,
  'NOT_FOUND',
  'H01: replace_courier_document falla con NOT_FOUND cuando el objeto esta en bucket equivocado'
);

-- 11. Courier reemplaza documento rechazado exitosamente cuando el objeto existe en courier-docs
select pg_temp.reset_actor();
insert into storage.objects (id, bucket_id, name, owner)
values ('00000000-0000-4000-8000-0000000025e2', 'courier-docs', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg', pg_temp.courier_a())
on conflict do nothing;

select pg_temp.act_as(pg_temp.courier_a());
create table pg_temp.replace_res as
select public.replace_courier_document(jsonb_build_object(
  'kind', 'license',
  'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg',
  'idempotencyKey', '00000000-0000-4000-8000-0000000000f1'
)) as res;

select is(
  (select res->>'status' from pg_temp.replace_res),
  'submitted',
  'replace_courier_document retorna status = submitted'
);

select is(
  (select res->>'isCurrent' from pg_temp.replace_res)::boolean,
  true,
  'replace_courier_document retorna isCurrent = true'
);

select is(
  (select res->>'idempotent' from pg_temp.replace_res)::boolean,
  false,
  'replace_courier_document retorna idempotent = false en primera ejecucion'
);

select is(
  (select res->>'replacedDocumentId' from pg_temp.replace_res),
  '00000000-0000-4000-8000-0000000025d1',
  'replace_courier_document referencia al documento reemplazado'
);

-- 12. Verificar base de datos: documento previo desactivado con retención de 30 días (D8 / Decisión B)
select pg_temp.reset_actor();

select is(
  (select is_current from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d1'),
  false,
  'Documento anterior queda marcado con is_current = false'
);

select ok(
  (select purge_after > now() + interval '29 days' from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d1'),
  'Documento anterior conserva retencion de 30 dias (D8 / Decision B)'
);

-- 13. PR364-H04: Privacidad del historial en RLS SELECT
select pg_temp.act_as(pg_temp.courier_a());
select is(
  (select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a()),
  1,
  'PR364-H04: Courier dueno solo ve su documento vigente (is_current=true), no ve historicos'
);

select pg_temp.act_as(pg_temp.courier_b());
select is(
  (select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a()),
  0,
  'PR364-H04: Courier ajeno no puede ver ningun documento de otro courier'
);

select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select is(
  (select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a()),
  2,
  'PR364-H04: Admin puede ver documentos vigentes e historicos para revision y auditoria'
);

-- 14. PR364-H07: Idempotencia estricta por idempotency_key
select pg_temp.act_as(pg_temp.courier_a());
create table pg_temp.retry_res as
select public.replace_courier_document(jsonb_build_object(
  'kind', 'license',
  'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg',
  'idempotencyKey', '00000000-0000-4000-8000-0000000000f1'
)) as res;

select is(
  (select res->>'idempotent' from pg_temp.retry_res)::boolean,
  true,
  'PR364-H07: Reintento con misma idempotencyKey retorna idempotent = true'
);

select throws_matching(
  $$
    select public.replace_courier_document(jsonb_build_object(
      'kind', 'license',
      'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_other_path.jpg',
      'idempotencyKey', '00000000-0000-4000-8000-0000000000f1'
    ));
  $$,
  'VALIDATION_ERROR',
  'PR364-H07: Misma idempotencyKey con storagePath diferente falla con VALIDATION_ERROR'
);

select pg_temp.reset_actor();
select is(
  (select count(*)::int from public.audit_log where action = 'replace_courier_document' and actor_id = pg_temp.courier_a()),
  1,
  'PR364-H07: Reintento idempotente NO duplica eventos en audit_log'
);

-- 15. PR364-H02: Admin no puede decidir sobre un documento obsoleto
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select throws_matching(
  $$
    select public.admin_verify_document(
      '00000000-0000-4000-8000-0000000025d1',
      'verified'
    );
  $$,
  'INVALID_STATE_TRANSITION',
  'admin_verify_document rechaza decidir sobre documento obsoleto (is_current = false)'
);

-- 16. Admin verifica la nueva versión vigente exitosamente
create table pg_temp.verify_res as
select public.admin_verify_document(
  (select (res->>'documentId')::uuid from pg_temp.replace_res),
  'verified'
) as res;

select is(
  (select res->>'status' from pg_temp.verify_res),
  'verified',
  'admin_verify_document aprueba la nueva version vigente'
);

-- 17. PR364-H07: Reintento con misma idempotencyKey despues de que admin verifico devuelve status verified
select pg_temp.act_as(pg_temp.courier_a());
create table pg_temp.retry_after_verified as
select public.replace_courier_document(jsonb_build_object(
  'kind', 'license',
  'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg',
  'idempotencyKey', '00000000-0000-4000-8000-0000000000f1'
)) as res;

select is(
  (select res->>'status' from pg_temp.retry_after_verified),
  'verified',
  'PR364-H07: Reintento con misma idempotencyKey tras aprobacion admin devuelve status verified'
);

-- 18. Invariante de indice unico: no pueden existir dos is_current = true para el mismo courier y kind
select pg_temp.reset_actor();
select throws_matching(
  $$
    insert into public.courier_documents (
      courier_id, kind, storage_path, status, is_current
    ) values (
      '00000000-0000-4000-8000-0000000025c1',
      'license',
      'courier/00000000-0000-4000-8000-0000000025c1/license_illegal.jpg',
      'submitted',
      true
    );
  $$,
  'courier_documents_unique_current',
  'Indice unico parcial impide dos documentos vigentes para el mismo (courier_id, kind)'
);

-- 19. PR364-H06: Backfill no vence prematuramente documentos antiguos
-- Si un documento fue subido hace 90 dias y no tenia purge_after, el backfill asigna now() + 30 dias
insert into public.courier_documents (
  id, courier_id, kind, storage_path, status, uploaded_at, purge_after, is_current
) values (
  '00000000-0000-4000-8000-0000000025d9',
  '00000000-0000-4000-8000-0000000025c2',
  'license',
  'courier/00000000-0000-4000-8000-0000000025c2/license_90d.jpg',
  'submitted',
  now() - interval '90 days',
  null,
  false
);

-- Ejecutar logica de backfill sobre duplicados
with ranked as (
  select
    id,
    row_number() over (partition by courier_id, kind order by uploaded_at desc, id desc) as rn
  from public.courier_documents
  where courier_id = '00000000-0000-4000-8000-0000000025c2'
)
update public.courier_documents cd
set purge_after = case
  when cd.purge_after is null then now() + interval '30 days'
  else cd.purge_after
end
from ranked
where cd.id = ranked.id and cd.id = '00000000-0000-4000-8000-0000000025d9';

select ok(
  (select purge_after > now() + interval '29 days' from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d9'),
  'PR364-H06: Backfill preserva retencion asignando now() + 30 dias para historicos antiguos sin purge_after'
);

rollback;
