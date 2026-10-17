begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(47);

create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000030c1'::uuid $$;
create function pg_temp.p(p_name text) returns text language sql as $$
  select 'courier/00000000-0000-4000-8000-0000000030c1/' || p_name
$$;

create function pg_temp.act_as_service_role()
returns void language plpgsql as $$
begin
  set local role service_role;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
end;
$$;

create function pg_temp.act_as(actor_id uuid)
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', 'aal1')::text,
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

create function pg_temp.put_object(p_name text, p_created timestamptz, p_updated timestamptz default null, p_bucket text default 'courier-docs')
returns void language sql as $$
  insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at)
  values (gen_random_uuid(), p_bucket, p_name, pg_temp.courier_a(), p_created, coalesce(p_updated, p_created));
$$;

-- Simula el borrado que hace la API de Storage.
create function pg_temp.remove_object(p_name text)
returns void language plpgsql as $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects o where o.bucket_id = 'courier-docs' and o.name = p_name;
end;
$$;

create function pg_temp.claimed_paths(res jsonb)
returns text[] language sql as $$
  select coalesce(array_agg(elem->>'storagePath' order by elem->>'storagePath'), '{}')
  from jsonb_array_elements(res->'claimed') elem
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values (pg_temp.courier_a(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc30.courierA@example.test', 'pwd', '{"role":"courier"}'::jsonb);

update public.profiles set consent_status = 'active' where id = pg_temp.courier_a();
update public.couriers
set status = 'pending', available = false, vehicle_type = 'moto', vehicle_plate = 'CC30AAA'
where profile_id = pg_temp.courier_a();

insert into storage.buckets (id, name, public)
values ('courier-docs', 'courier-docs', false), ('other-bucket', 'other-bucket', false)
on conflict do nothing;

-- 1. Estructura y permisos
select has_table('app_private', 'courier_document_orphan_claims', 'existe la tabla interna de reclamos');
select ok(
  not has_table_privilege('authenticated', 'app_private.courier_document_orphan_claims', 'SELECT')
  and not has_table_privilege('anon', 'app_private.courier_document_orphan_claims', 'SELECT'),
  'clientes no leen reclamos'
);
select ok(
  not has_table_privilege('authenticated', 'app_private.courier_document_orphan_claims', 'INSERT')
  and not has_table_privilege('authenticated', 'app_private.courier_document_orphan_claims', 'DELETE'),
  'clientes no escriben ni borran reclamos'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_orphan_courier_documents(integer, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.claim_orphan_courier_documents(integer, boolean)', 'EXECUTE'),
  'clientes no ejecutan claim_orphan_courier_documents'
);
select ok(
  not has_function_privilege('authenticated', 'public.complete_orphan_courier_document_purge()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.complete_orphan_courier_document_purge()', 'EXECUTE'),
  'clientes no ejecutan complete_orphan_courier_document_purge'
);
select ok(
  has_function_privilege('service_role', 'public.claim_orphan_courier_documents(integer, boolean)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.complete_orphan_courier_document_purge()', 'EXECUTE'),
  'service_role ejecuta ambas RPC'
);
select ok(
  not has_function_privilege('authenticated', 'app_private.lock_courier_document_path(text, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'app_private.lock_courier_document_path(text, boolean)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.guard_courier_document_orphan_claim()', 'EXECUTE'),
  'helpers internos sin execute para clientes'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.claim_orphan_courier_documents(integer, boolean)'::regprocedure),
  true,
  'claim_orphan_courier_documents es security definer'
);
select ok(
  exists (
    select 1
    from pg_proc p, unnest(p.proconfig) as cfg
    where p.oid = 'public.complete_orphan_courier_document_purge()'::regprocedure
      and cfg ~ '^search_path=public,\s*pg_temp$'
  ),
  'complete_orphan_courier_document_purge fija search_path'
);
select has_trigger('public', 'courier_documents', 'courier_documents_orphan_claim_guard', 'courier_documents tiene trigger de guarda');
select ok(
  not has_table_privilege('authenticated', 'public.courier_documents', 'DELETE'),
  'el cliente courier sigue sin DELETE sobre courier_documents'
);

-- 2. Autorización y validación
select pg_temp.act_as(pg_temp.courier_a());
select throws_ok(
  $$ select public.claim_orphan_courier_documents(10, false) $$,
  '42501',
  null,
  'courier autenticado no puede reclamar huérfanos'
);
select throws_ok(
  $$ select public.complete_orphan_courier_document_purge() $$,
  '42501',
  null,
  'courier autenticado no puede confirmar purgas'
);
select pg_temp.reset_actor();
select throws_ok(
  $$ select public.claim_orphan_courier_documents(10, false) $$,
  'P0001',
  'UNAUTHORIZED_ACTOR',
  'sin rol service_role la RPC rechaza aunque el owner pueda ejecutarla'
);

select pg_temp.act_as_service_role();
select throws_ok($$ select public.claim_orphan_courier_documents(0, true) $$, 'P0001', 'VALIDATION_ERROR', 'p_limit 0 rechazado');
select throws_ok($$ select public.claim_orphan_courier_documents(501, true) $$, 'P0001', 'VALIDATION_ERROR', 'p_limit mayor a 500 rechazado');
select throws_ok($$ select public.claim_orphan_courier_documents(10, null) $$, 'P0001', 'VALIDATION_ERROR', 'p_dry_run null rechazado');

-- 3. Fixtures
select pg_temp.reset_actor();
-- Huérfano antiguo: candidato.
select pg_temp.put_object(pg_temp.p('dni_front_1000.jpg'), now() - interval '10 days');
-- Subida reciente sin fila (en curso o reintento): fuera de la gracia.
select pg_temp.put_object(pg_temp.p('dni_front_2000.jpg'), now() - interval '1 hour');
-- Subida justo antes del corte de gracia: todavía protegida.
select pg_temp.put_object(pg_temp.p('dni_front_2500.jpg'), now() - interval '6 days 23 hours');
-- Objeto viejo sobrescrito hace poco: la gracia corre desde la última escritura.
select pg_temp.put_object(pg_temp.p('dni_back_3000.jpg'), now() - interval '20 days', now() - interval '2 hours');
-- Documento vigente rechazado con objeto viejo: permite que replace_courier_document llegue al insert.
select pg_temp.put_object(pg_temp.p('dni_front_0500.jpg'), now() - interval '30 days');
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
values (pg_temp.courier_a(), 'dni_front', pg_temp.p('dni_front_0500.jpg'), 'rejected', true);
-- Documento vigente con objeto viejo.
select pg_temp.put_object(pg_temp.p('license_4000.jpg'), now() - interval '40 days');
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
values (pg_temp.courier_a(), 'license', pg_temp.p('license_4000.jpg'), 'rejected', true);
-- Histórico retenido dentro de los 30 días (D8).
select pg_temp.put_object(pg_temp.p('selfie_5000.jpg'), now() - interval '45 days');
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current, purge_after)
values (pg_temp.courier_a(), 'selfie', pg_temp.p('selfie_5000.jpg'), 'rejected', false, now() + interval '20 days');
-- Histórico vencido pero aún no purgado por el cron legítimo: también tiene fila, no es huérfano.
select pg_temp.put_object(pg_temp.p('selfie_5500.jpg'), now() - interval '60 days');
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current, purge_after)
values (pg_temp.courier_a(), 'selfie', pg_temp.p('selfie_5500.jpg'), 'rejected', false, now() - interval '1 day');
-- Objeto viejo en otro bucket.
select pg_temp.put_object(pg_temp.p('dni_front_6000.jpg'), now() - interval '10 days', null, 'other-bucket');

-- 4. Dry-run: cuenta sin reclamar
select pg_temp.act_as_service_role();
create table pg_temp.dry as select public.claim_orphan_courier_documents(100, true) as res;
select is((select (res->>'dryRun')::boolean from pg_temp.dry), true, 'dry-run informa dryRun=true');
select is((select (res->>'candidateCount')::int from pg_temp.dry), 1, 'dry-run cuenta sólo el huérfano antiguo');
select is((select jsonb_array_length(res->'claimed') from pg_temp.dry), 0, 'dry-run no devuelve rutas reclamadas');
select pg_temp.reset_actor();
select is((select count(*)::int from app_private.courier_document_orphan_claims), 0, 'dry-run no crea reclamos');

-- 5. Enforce: reclama sólo el huérfano antiguo
select pg_temp.act_as_service_role();
create table pg_temp.claim1 as select public.claim_orphan_courier_documents(100, false) as res;
select is((select pg_temp.claimed_paths(res) from pg_temp.claim1), array[pg_temp.p('dni_front_1000.jpg')], 'reclama únicamente el huérfano antiguo');
select is((select (res->>'hasMore')::boolean from pg_temp.claim1), false, 'sin más candidatos');
select is((select (res->>'skippedLockedCount')::int from pg_temp.claim1), 0, 'sin rutas bloqueadas');
select pg_temp.reset_actor();
select is(
  (select array_agg(storage_path order by storage_path) from app_private.courier_document_orphan_claims),
  array[pg_temp.p('dni_front_1000.jpg')],
  'reclamo persistido sólo para el huérfano'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'courier-docs' and name like pg_temp.p('%')),
  8,
  'reclamar no borra ningún objeto: el borrado es de Storage'
);
select is(
  (select count(*)::int from public.courier_documents where courier_id = pg_temp.courier_a()),
  4,
  'documentos vigentes e históricos intactos'
);

-- 6. Barrera: una ruta reclamada no puede volver a quedar referenciada
select throws_ok(
  format(
    $f$ insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
        values (%L, 'dni_front', %L, 'submitted', true) $f$,
    pg_temp.courier_a(), pg_temp.p('dni_front_1000.jpg')
  ),
  'P0001',
  'NOT_FOUND',
  'insert directo con ruta reclamada falla con NOT_FOUND'
);
select throws_ok(
  format(
    $f$ update public.courier_documents set storage_path = %L where storage_path = %L $f$,
    pg_temp.p('dni_front_1000.jpg'), pg_temp.p('license_4000.jpg')
  ),
  'P0001',
  'NOT_FOUND',
  'update de storage_path hacia una ruta reclamada falla con NOT_FOUND'
);

select pg_temp.act_as(pg_temp.courier_a());
select throws_ok(
  format(
    $f$ select public.replace_courier_document(jsonb_build_object('kind', 'dni_front', 'storagePath', %L)) $f$,
    pg_temp.p('dni_front_1000.jpg')
  ),
  'P0001',
  'NOT_FOUND',
  'replace_courier_document no puede adoptar una ruta reclamada'
);
-- Reemplazo legítimo con una subida reciente sigue funcionando (license vigente está rechazada).
select pg_temp.reset_actor();
select pg_temp.put_object(pg_temp.p('license_7000.jpg'), now() - interval '5 minutes');
select pg_temp.act_as(pg_temp.courier_a());
select lives_ok(
  format(
    $f$ select public.replace_courier_document(jsonb_build_object('kind', 'license', 'storagePath', %L)) $f$,
    pg_temp.p('license_7000.jpg')
  ),
  'replace_courier_document con ruta no reclamada sigue funcionando'
);
select pg_temp.reset_actor();
select is(
  (select is_current from public.courier_documents where storage_path = pg_temp.p('license_4000.jpg')),
  false,
  'el rechazado reemplazado pasa a histórico retenido'
);

-- 7. Falla de Storage: el objeto sigue, confirmar no marca nada y el reintento vuelve a reclamar
select pg_temp.act_as_service_role();
create table pg_temp.complete_before as select public.complete_orphan_courier_document_purge() as res;
select is((select (res->>'completedCount')::int from pg_temp.complete_before), 0, 'sin borrado en Storage no se confirma nada');
select is((select (res->>'pendingCount')::int from pg_temp.complete_before), 1, 'el reclamo queda pendiente');

create table pg_temp.claim2 as select public.claim_orphan_courier_documents(100, false) as res;
select is((select pg_temp.claimed_paths(res) from pg_temp.claim2), array[pg_temp.p('dni_front_1000.jpg')], 'reintento vuelve a devolver el huérfano pendiente');
select pg_temp.reset_actor();
select is(
  (select attempts from app_private.courier_document_orphan_claims where storage_path = pg_temp.p('dni_front_1000.jpg')),
  2,
  'el reintento incrementa attempts sin duplicar el reclamo'
);

-- 8. Storage borra el objeto: confirmar audita sin ruta y es idempotente
select pg_temp.remove_object(pg_temp.p('dni_front_1000.jpg'));
select pg_temp.act_as_service_role();
create table pg_temp.complete_after as select public.complete_orphan_courier_document_purge() as res;
select is((select (res->>'completedCount')::int from pg_temp.complete_after), 1, 'confirma el reclamo cuyo objeto ya no existe');
select is((select (res->>'pendingCount')::int from pg_temp.complete_after), 0, 'no quedan reclamos pendientes');
create table pg_temp.complete_again as select public.complete_orphan_courier_document_purge() as res;
select is((select (res->>'completedCount')::int from pg_temp.complete_again), 0, 'confirmar dos veces no duplica');
select pg_temp.reset_actor();
select is(
  (select count(*)::int from public.audit_log where action = 'orphan_storage_object_purged'
     and target_id = (select id::text from app_private.courier_document_orphan_claims where storage_path = pg_temp.p('dni_front_1000.jpg'))),
  1,
  'una sola auditoría por objeto purgado'
);
select is(
  (select count(*)::int from public.audit_log where action = 'orphan_storage_object_purged'
     and (before::text like '%courier/%' or after::text like '%courier/%')),
  0,
  'la auditoría no registra la ruta del objeto'
);
select pg_temp.act_as_service_role();
create table pg_temp.claim3 as select public.claim_orphan_courier_documents(100, false) as res;
select is((select jsonb_array_length(res->'claimed') from pg_temp.claim3), 0, 'objeto ya purgado deja de ser candidato');

-- 9. Lotes acotados
select pg_temp.reset_actor();
select pg_temp.put_object(pg_temp.p('avatar_8000.jpg'), now() - interval '9 days');
select pg_temp.put_object(pg_temp.p('avatar_8001.jpg'), now() - interval '8 days');
select pg_temp.act_as_service_role();
create table pg_temp.batch1 as select public.claim_orphan_courier_documents(1, false) as res;
select is((select pg_temp.claimed_paths(res) from pg_temp.batch1), array[pg_temp.p('avatar_8000.jpg')], 'lote de 1 reclama el más antiguo');
select is((select (res->>'hasMore')::boolean from pg_temp.batch1), true, 'informa hasMore cuando quedan candidatos');
create table pg_temp.batch2 as select public.claim_orphan_courier_documents(1, true) as res;
select is((select (res->>'candidateCount')::int from pg_temp.batch2), 1, 'dry-run respeta el límite del lote');

-- 10. Histórico retenido y vigente nunca reclamados en ninguna corrida
select pg_temp.reset_actor();
select is(
  (select count(*)::int from app_private.courier_document_orphan_claims c
   join public.courier_documents d on d.storage_path = c.storage_path),
  0,
  'ningún reclamo apunta a una ruta con fila en courier_documents'
);

-- 11. PR401-H01: la elegibilidad abarca todo el bucket, no sólo el prefijo de las subidas nuevas de la UI
select pg_temp.reset_actor();
select pg_temp.put_object('legacy/cc030_orphan_old.jpg', now() - interval '9 days');
select pg_temp.act_as_service_role();
create table pg_temp.legacy_claim as
  select public.claim_orphan_courier_documents(100, false) as res;
select ok(
  'legacy/cc030_orphan_old.jpg'::text = any((select pg_temp.claimed_paths(res) from pg_temp.legacy_claim)::text[]),
  'reclama huérfano antiguo no canónico dentro de courier-docs'
);
select pg_temp.reset_actor();

select * from finish();
rollback;
