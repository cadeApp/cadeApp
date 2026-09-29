\set QUIET on
\pset tuples_only on
\pset format unaligned
begin;
create function pg_temp.try(p_sql text, p_uid uuid, p_aal text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text,''), true);
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid::text,'role','authenticated','aal',p_aal)::text, true);
  begin
    execute p_sql into r;
    perform set_config('role','postgres',true);
    return 'OK ' || coalesce(r,'null');
  exception when others then
    perform set_config('role','postgres',true);
    return 'ERR ' || sqlstate || ' ' || sqlerrm;
  end;
end $$;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','adm@t.l','x','{"role":"merchant"}'),
 ('aaaaaaaa-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mer@t.l','x','{"role":"merchant"}'),
 ('aaaaaaaa-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cou@t.l','x','{"role":"courier"}');
delete from public.merchants where profile_id='aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set role='admin' where id='aaaaaaaa-0000-4000-8000-000000000001';
insert into public.courier_documents (id, courier_id, kind, storage_path) values
 ('dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000003','license','p/lic'),
 ('dddddddd-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','selfie','p/selfie');
\echo '--- D04: doc verificado / rechazado / purgado'
insert into public.courier_documents (id, courier_id, kind, storage_path, status, purge_after, purged_at) values
 ('dddddddd-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000003','insurance','p/ins-ver','verified',null,null),
 ('dddddddd-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000003','insurance','p/ins-rej','rejected',null,null),
 ('dddddddd-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-000000000003','insurance','p/ins-pur','submitted',now()-interval '1 day',now());
select k, pg_temp.try(format($$select public.admin_verify_document(%L,'verified',null)::text$$, k),'aaaaaaaa-0000-4000-8000-000000000001','aal2') from unnest(array['dddddddd-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000005']) k;
\echo '--- H10: contenido de audit_log tras decide(rejected, motivo) y verify(rejected, motivo)'
select pg_temp.try($$select public.admin_decide_courier('aaaaaaaa-0000-4000-8000-000000000003','rejected','documento ilegible')::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select pg_temp.try($$select public.admin_verify_document('dddddddd-0000-4000-8000-000000000001','rejected','foto borrosa')::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select action, target_type, actor_id, before::text, after::text from public.audit_log order by id;
\echo '--- H02/H05: suspender con 1 pending + 1 accepted en otra solicitud'
update public.couriers set status='approved', available=true where profile_id='aaaaaaaa-0000-4000-8000-000000000003';
do $$ declare z uuid; begin select id into z from public.zones where active limit 1;
insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status) values
 ('eeeeeeee-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002',z,z,'chico','cash','published'),
 ('eeeeeeee-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000002',z,z,'chico','cash','published');
insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status) values
 ('ffffffff-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000003',1500,20,'pending'),
 ('ffffffff-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003',1600,20,'accepted'); end $$;
select pg_temp.try($$select public.admin_suspend_courier('aaaaaaaa-0000-4000-8000-000000000003','motivo')::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select id, status from public.offers where courier_id='aaaaaaaa-0000-4000-8000-000000000003' order by id;
\echo '--- H10: audit de update_setting'
select pg_temp.try($$select public.admin_update_setting('min_offer_ars','1500'::jsonb)::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select action, target_id, before::text, after::text from public.audit_log where action='admin_update_setting';
rollback;
