begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(26);

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

-- 1. Schema: columnas y constraints
select has_column('public', 'courier_documents', 'is_current', 'courier_documents tiene columna is_current');
select col_not_null('public', 'courier_documents', 'is_current', 'is_current es not null');
select col_has_default('public', 'courier_documents', 'is_current', 'is_current tiene default true');
select has_column('public', 'courier_documents', 'rejection_code', 'courier_documents tiene columna rejection_code');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.courier_documents')
      and conname = 'courier_documents_rejection_code_check'
      and contype = 'c'
  ),
  'courier_documents tiene check de catalogo seguro para rejection_code'
);

-- 2. Inserción inicial permitida por RLS cuando no existe documento
select pg_temp.act_as(pg_temp.courier_a());

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

-- 4. UPDATE directo bloqueado para couriers (RLS no concede update)
update public.courier_documents
set status = 'verified'
where id = '00000000-0000-4000-8000-0000000025d1';

select is(
  (select status from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d1'),
  'submitted'::public.document_review_status,
  'Courier no puede alterar status mediante UPDATE directo (RLS deniega update a no admins)'
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

-- Verificar que el documento rechazado tiene rejection_code = 'illegible'
select is(
  (select rejection_code from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d1'),
  'illegible',
  'courier_documents almacena rejection_code seguro'
);

-- 10. Courier reemplaza documento rechazado exitosamente
select pg_temp.act_as(pg_temp.courier_a());
create table pg_temp.replace_res as
select public.replace_courier_document(jsonb_build_object(
  'kind', 'license',
  'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg'
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

-- 11. Verificar base de datos: documento previo desactivado con retención de 30 días (D8 / Decisión 3B)
select pg_temp.reset_actor();

select is(
  (select is_current from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d1'),
  false,
  'Documento anterior queda marcado con is_current = false'
);

select ok(
  (select purge_after > now() + interval '29 days' from public.courier_documents where id = '00000000-0000-4000-8000-0000000025d1'),
  'Documento anterior conserva retencion de 30 dias (D8 / Decision 3B)'
);

-- 12. Idempotencia ante reintento con mismo path
select pg_temp.act_as(pg_temp.courier_a());
create table pg_temp.retry_res as
select public.replace_courier_document(jsonb_build_object(
  'kind', 'license',
  'storagePath', 'courier/00000000-0000-4000-8000-0000000025c1/license_v2.jpg'
)) as res;

select is(
  (select res->>'idempotent' from pg_temp.retry_res)::boolean,
  true,
  'Reintento con mismo storagePath sobre version promovida es idempotente'
);

-- 13. Admin no puede decidir sobre un documento obsoleto (PR358-H02 cerrado)
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

-- 14. Admin verifica la nueva versión vigente exitosamente
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

-- 15. Invariante de indice unico: no pueden existir dos is_current = true para el mismo courier y kind
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

rollback;
