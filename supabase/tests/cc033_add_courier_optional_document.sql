begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select no_plan();

create function pg_temp.admin() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033a1'::uuid $$;
create function pg_temp.merchant() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033b1'::uuid $$;
create function pg_temp.approved() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c1'::uuid $$;
create function pg_temp.pending() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c2'::uuid $$;
create function pg_temp.incomplete() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c3'::uuid $$;
create function pg_temp.rejected() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c4'::uuid $$;
create function pg_temp.suspended() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000033c5'::uuid $$;
create function pg_temp.act_as(p_actor uuid, p_aal text default 'aal1') returns void language plpgsql as $$ begin set local role authenticated; perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor::text, 'role', 'authenticated', 'aal', p_aal)::text, true); end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$ begin set local role anon; perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $$;
create function pg_temp.as_no_subject() returns void language plpgsql as $$ begin set local role authenticated; perform set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal1"}', true); end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$ begin set local role postgres; perform set_config('request.jwt.claims', '', true); end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc033-admin@example.test', 'pwd', '{"role":"admin"}'),
  (pg_temp.merchant(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc033-merchant@example.test', 'pwd', '{"role":"merchant"}'),
  (pg_temp.approved(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc033-approved@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.pending(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc033-pending@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.incomplete(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc033-incomplete@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.rejected(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc033-rejected@example.test', 'pwd', '{"role":"courier"}'),
  (pg_temp.suspended(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'cc033-suspended@example.test', 'pwd', '{"role":"courier"}')
on conflict (id) do nothing;

update public.profiles set consent_status = 'active', role = case when id = pg_temp.admin() then 'admin'::public.profile_role when id = pg_temp.merchant() then 'merchant'::public.profile_role else 'courier'::public.profile_role end
where id in (pg_temp.admin(), pg_temp.merchant(), pg_temp.approved(), pg_temp.pending(), pg_temp.incomplete(), pg_temp.rejected(), pg_temp.suspended());
insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
values (pg_temp.approved(),'approved',false,'moto','CC033A'), (pg_temp.pending(),'pending',false,'moto','CC033P'), (pg_temp.incomplete(),'pending',false,null,null), (pg_temp.rejected(),'rejected',false,'moto','CC033R'), (pg_temp.suspended(),'suspended',false,'moto','CC033S')
on conflict (profile_id) do update set status=excluded.status, vehicle_type=excluded.vehicle_type, available=false, license_status='none', insurance_status='none';
insert into storage.buckets (id,name,public) values ('courier-docs','courier-docs',false) on conflict (id) do nothing;
insert into storage.objects (id,bucket_id,name,owner) values
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c1/license_1730000000000.jpg',pg_temp.approved()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c2/insurance_1730000000001.pdf',pg_temp.pending()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c3/license_1730000000002.jpg',pg_temp.incomplete()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c4/license_1730000000003.jpg',pg_temp.rejected()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c5/license_1730000000004.jpg',pg_temp.suspended()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg',pg_temp.approved()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000006.jpg',pg_temp.approved()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000007.jpg',pg_temp.approved()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000008.jpg',pg_temp.approved()),
  (gen_random_uuid(),'courier-docs','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000009.jpg',pg_temp.approved()) on conflict do nothing;

select has_function('public','add_courier_optional_document',array['jsonb'],'CC-033 expone la RPC jsonb');
select ok((select prosecdef from pg_proc where oid='public.add_courier_optional_document(jsonb)'::regprocedure),'RPC usa security definer');
select ok(coalesce((select array_to_string(proconfig,',') from pg_proc where oid='public.add_courier_optional_document(jsonb)'::regprocedure),'') like '%search_path=public, pg_temp%','RPC fija search_path seguro');
select ok(has_function_privilege('authenticated','public.add_courier_optional_document(jsonb)','execute'),'authenticated tiene execute');
select ok(not has_function_privilege('anon','public.add_courier_optional_document(jsonb)','execute'),'anon no tiene execute');
select ok(not has_table_privilege('authenticated','public.courier_documents','insert'),'INSERT directo permanece revocado');

select pg_temp.act_as(pg_temp.approved());
select is(public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000033c1/license_1730000000000.jpg'))->>'status','submitted','approved completo crea license submitted');
select is((select license_status::text from public.couriers where profile_id=pg_temp.approved()),'submitted','actualiza license_status');
select is((select doc_level from public.couriers where profile_id=pg_temp.approved()),0,'alta no eleva doc_level');
select is((select count(*)::int from public.courier_documents where courier_id=pg_temp.approved() and kind='license' and is_current),1,'crea exactamente un documento vigente');
select is((select count(*)::int from public.audit_log where actor_id=pg_temp.approved() and action='add_courier_optional_document'),1,'crea una auditoría');
select ok(not exists(select 1 from public.audit_log where actor_id=pg_temp.approved() and action='add_courier_optional_document' and (before::text like '%license_1730000000000.jpg%' or after::text like '%license_1730000000000.jpg%')),'auditoría no guarda storage_path');
select pg_temp.act_as(pg_temp.pending());
select is(public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c2/insurance_1730000000001.pdf'))->>'kind','insurance','pending completo crea insurance');
select is((select insurance_status::text from public.couriers where profile_id=pg_temp.pending()),'submitted','actualiza insurance_status');
select is((select doc_level from public.couriers where profile_id=pg_temp.pending()),0,'pending submitted conserva doc_level');

select pg_temp.act_as(pg_temp.incomplete());
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000033c3/license_1730000000002.jpg')); $$,'INVALID_STATE_TRANSITION','onboarding incompleto es rechazado');
select is((select count(*)::int from public.courier_documents where courier_id=pg_temp.incomplete()),0,'onboarding incompleto no inserta');
select is((select count(*)::int from public.audit_log where actor_id=pg_temp.incomplete() and action='add_courier_optional_document'),0,'onboarding incompleto no audita');
select pg_temp.act_as(pg_temp.approved());
select throws_matching($$ select public.add_courier_optional_document('null'::jsonb); $$,'VALIDATION_ERROR','payload JSON null es inválido');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg')); $$,'VALIDATION_ERROR','kind ausente es inválido');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind',null,'storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg')); $$,'VALIDATION_ERROR','kind JSON null es inválido');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath',null)); $$,'VALIDATION_ERROR','storagePath JSON null es inválido');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','dni_front','storagePath','courier/00000000-0000-4000-8000-0000000033c1/dni_front_1.jpg')); $$,'VALIDATION_ERROR','dni_front no admite alta posterior');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','selfie','storagePath','courier/00000000-0000-4000-8000-0000000033c1/selfie_1.jpg')); $$,'VALIDATION_ERROR','selfie no admite alta posterior');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','avatar','storagePath','courier/00000000-0000-4000-8000-0000000033c1/avatar_1.jpg')); $$,'VALIDATION_ERROR','avatar no admite alta posterior');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c2/insurance_1730000000001.pdf')); $$,'VALIDATION_ERROR','path ajeno es inválido');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_../x.jpg')); $$,'VALIDATION_ERROR','path traversal es inválido');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.exe')); $$,'VALIDATION_ERROR','extensión no permitida es inválida');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.PNG')); $$,'VALIDATION_ERROR','extensión en mayúsculas no es canónica');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg','idempotencyKey','no-es-uuid')); $$,'VALIDATION_ERROR','idempotencyKey inválida es rechazada');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg','idempotencyKey','')); $$,'VALIDATION_ERROR','idempotencyKey vacía es inválida');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg','idempotencyKey','  ')); $$,'VALIDATION_ERROR','idempotencyKey con espacios es inválida');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg','idempotencyKey',null)); $$,'VALIDATION_ERROR','idempotencyKey JSON null es inválida');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000099.jpg')); $$,'NOT_FOUND','objeto inexistente devuelve NOT_FOUND');

select pg_temp.as_postgres();
insert into public.courier_documents(courier_id,kind,storage_path,status,is_current) values(pg_temp.approved(),'insurance','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000005.jpg','submitted',true);
select pg_temp.act_as(pg_temp.approved());
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000006.jpg')); $$,'INVALID_STATE_TRANSITION','submitted vigente bloquea nueva alta');
select pg_temp.as_postgres(); update public.courier_documents set status='verified' where courier_id=pg_temp.approved() and kind='insurance' and is_current;
select pg_temp.act_as(pg_temp.approved());
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000006.jpg')); $$,'INVALID_STATE_TRANSITION','verified vigente bloquea nueva alta');
select pg_temp.as_postgres(); update public.courier_documents set status='rejected' where courier_id=pg_temp.approved() and kind='insurance' and is_current;
select pg_temp.act_as(pg_temp.approved());
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000006.jpg')); $$,'INVALID_STATE_TRANSITION','rejected vigente debe usar replace');
select pg_temp.as_postgres(); delete from public.courier_documents where courier_id=pg_temp.approved() and kind='insurance';

select pg_temp.act_as(pg_temp.approved());
select is(public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000007.jpg','idempotencyKey','00000000-0000-4000-8000-0000000033d1'))->>'idempotent','false','primera alta con clave no es reintento');
select is(public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000007.jpg','idempotencyKey','00000000-0000-4000-8000-0000000033d1'))->>'idempotent','true','misma clave y path es idempotente');
select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000008.jpg','idempotencyKey','00000000-0000-4000-8000-0000000033d1')); $$,'VALIDATION_ERROR','misma clave con otro path falla');
select is((select count(*)::int from public.courier_documents where courier_id=pg_temp.approved() and kind='insurance'),1,'clave no duplica filas');
select is((select count(*)::int from public.audit_log where actor_id=pg_temp.approved() and action='add_courier_optional_document' and after->>'idempotency_key'='00000000-0000-4000-8000-0000000033d1'),1,'clave no duplica auditoría');
select is(public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000007.jpg'))->>'idempotent','true','mismo path submitted sin clave es idempotente');

select pg_temp.act_as(pg_temp.rejected()); select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000033c4/license_1730000000003.jpg')); $$,'UNAUTHORIZED_ACTOR','rejected es rechazado');
select pg_temp.act_as(pg_temp.suspended()); select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000033c5/license_1730000000004.jpg')); $$,'UNAUTHORIZED_ACTOR','suspended es rechazado');
select pg_temp.act_as(pg_temp.merchant()); select throws_matching($$ select public.add_courier_optional_document(jsonb_build_object('kind','license','storagePath','courier/00000000-0000-4000-8000-0000000033b1/license_1.jpg')); $$,'UNAUTHORIZED_ACTOR','merchant es rechazado');
select pg_temp.as_anon(); select throws_ok($$ select public.add_courier_optional_document('{}'::jsonb); $$,'42501'::char(5),null::text,'anon no tiene execute');
select pg_temp.as_no_subject(); select throws_matching($$ select public.add_courier_optional_document('{}'::jsonb); $$,'UNAUTHENTICATED','sin sub es UNAUTHENTICATED');
select pg_temp.act_as(pg_temp.approved()); select throws_matching($$ insert into public.courier_documents(courier_id,kind,storage_path,status,is_current) values('00000000-0000-4000-8000-0000000033c1','insurance','courier/00000000-0000-4000-8000-0000000033c1/direct.jpg','submitted',true); $$,'42501|permission denied','INSERT directo falla 42501');

select pg_temp.as_postgres(); delete from public.courier_documents where courier_id=pg_temp.approved() and kind='insurance';
select pg_temp.act_as(pg_temp.approved());
select is(public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','courier/00000000-0000-4000-8000-0000000033c1/insurance_1730000000009.jpg'))->>'status','submitted','alta para verify queda submitted');
select pg_temp.act_as(pg_temp.admin(),'aal2');
select lives_ok($$ select public.admin_verify_document((select id from public.courier_documents where courier_id='00000000-0000-4000-8000-0000000033c1' and kind='insurance' and is_current),'verified',null,null); $$,'admin verifica alta opcional');
select is((select insurance_status::text from public.couriers where profile_id=pg_temp.approved()),'verified','verify actualiza estado');
select is((select doc_level from public.couriers where profile_id=pg_temp.approved()),1,'verify eleva doc_level');
select * from finish();
rollback;
