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
\echo '--- update_setting with what PostgREST builds from {"p_value":"1500"} (jsonb string)'
select pg_temp.try($$select public.admin_update_setting('min_offer_ars','"1500"'::jsonb)::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select pg_temp.try($$select public.admin_update_setting('pilot_active','"true"'::jsonb)::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
\echo '--- pilot_terms_version whitespace only'
select pg_temp.try($$select public.admin_update_setting('pilot_terms_version','"   "'::jsonb)::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
\echo '--- decide: rejected with reason -> where is reason stored? audit_log rows before/after'
select count(*) from public.audit_log;
select pg_temp.try($$select public.admin_decide_courier('aaaaaaaa-0000-4000-8000-000000000003','rejected','documento ilegible')::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select count(*) from public.audit_log;
\echo '--- decide: rejected -> approved, approved -> approved (no INVALID_STATE_TRANSITION)'
select pg_temp.try($$select public.admin_decide_courier('aaaaaaaa-0000-4000-8000-000000000003','approved',null)::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select pg_temp.try($$select public.admin_decide_courier('aaaaaaaa-0000-4000-8000-000000000003','rejected','x')::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
\echo '--- precedence: rejected without reason on missing courier'
select pg_temp.try($$select public.admin_decide_courier('aaaaaaaa-0000-4000-8000-00000000ffff','rejected',null)::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
\echo '--- set_subscription active without paid_until clears existing paid_until'
update public.merchants set paid_until='2026-12-31', notes='n1' where profile_id='aaaaaaaa-0000-4000-8000-000000000002';
select pg_temp.try($$select public.admin_set_subscription('aaaaaaaa-0000-4000-8000-000000000002','active',null,null)::text$$,'aaaaaaaa-0000-4000-8000-000000000001','aal2');
select paid_until, notes from public.merchants where profile_id='aaaaaaaa-0000-4000-8000-000000000002';
rollback;
