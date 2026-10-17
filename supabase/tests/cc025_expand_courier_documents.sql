begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(24);

-- Test actors
create function pg_temp.test_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025a01'::uuid
$$;

create function pg_temp.other_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025a99'::uuid
$$;

create function pg_temp.act_as(p_actor_id uuid) returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor_id::text, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end;
$$;

create function pg_temp.reset_actor() returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- 1. Schema structure: Columns in courier_documents
select has_column('public', 'courier_documents', 'is_current', 'courier_documents must have is_current column');
select col_not_null('public', 'courier_documents', 'is_current', 'is_current must be NOT NULL');
select col_default_is('public', 'courier_documents', 'is_current', 'true', 'is_current default must be true');
select col_type_is('public', 'courier_documents', 'is_current', 'boolean', 'is_current type must be boolean');

select has_column('public', 'courier_documents', 'rejection_code', 'courier_documents must have rejection_code column');
select col_is_null('public', 'courier_documents', 'rejection_code', 'rejection_code must be nullable');
select col_type_is('public', 'courier_documents', 'rejection_code', 'text', 'rejection_code type must be text');

select has_column('public', 'courier_documents', 'idempotency_key', 'courier_documents must have idempotency_key column');
select col_is_null('public', 'courier_documents', 'idempotency_key', 'idempotency_key must be nullable');
select col_type_is('public', 'courier_documents', 'idempotency_key', 'text', 'idempotency_key type must be text');

-- 2. Phase C contraction retired temporary expansion guard and installed permanent catalog check + unique current index
select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.courier_documents')
      and conname = 'courier_documents_expansion_guard'
  )
  and exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.courier_documents')
      and conname = 'courier_documents_rejection_code_check'
      and contype = 'c'
  ),
  'Temporary expansion guard is retired in Phase C and replaced by courier_documents_rejection_code_check'
);

-- 3. Invariants on pre-existing rows: at most 1 current row per (courier_id, kind)
select is(
  (
    select count(*)::integer from (
      select courier_id, kind
      from public.courier_documents
      where is_current = true
      group by courier_id, kind
      having count(*) > 1
    ) dup
  ),
  0,
  'No duplicate current courier_documents rows exist for any (courier_id, kind)'
);

-- 4. Permissions: authenticated role has INSERT and UPDATE revoked in Phase C while service_role retains UPDATE for sweep
select ok(
  not has_table_privilege('authenticated', 'public.courier_documents', 'INSERT')
  and not has_table_privilege('authenticated', 'public.courier_documents', 'UPDATE')
  and has_table_privilege('service_role', 'public.courier_documents', 'UPDATE'),
  'authenticated has INSERT and UPDATE revoked in Phase C while service_role retains UPDATE privilege'
);

-- Setup test couriers
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values (pg_temp.test_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'courier_expand@test.com', 'pwd', '{"role":"courier"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, role, consent_status)
values (pg_temp.test_courier(), 'courier', 'active')
on conflict (id) do update set role = excluded.role, consent_status = 'active';

insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
values (pg_temp.test_courier(), 'pending', false, 'moto', 'EXP01')
on conflict (profile_id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values (pg_temp.other_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'courier_other@test.com', 'pwd', '{"role":"courier"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, role, consent_status)
values (pg_temp.other_courier(), 'courier', 'active')
on conflict (id) do update set role = excluded.role, consent_status = 'active';

insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
values (pg_temp.other_courier(), 'pending', false, 'moto', 'EXP99')
on conflict (profile_id) do nothing;

-- 5. Initial insert & Phase C contraction enforcement (H01 & H02)
select pg_temp.act_as(pg_temp.test_courier());

-- H02: Explicitly assert current_user and auth.uid() within the active authenticated session
select is(current_user::text, 'authenticated', 'Actor current_user must be authenticated');
select is(auth.uid(), pg_temp.test_courier(), 'Actor auth.uid() must match test courier');

-- Post-Phase-C: Direct INSERT without atomic RPC is denied with 42501 (PR364-R07)
select throws_ok(
  $$
    insert into public.courier_documents (id, courier_id, kind, storage_path, status)
    values ('00000000-0000-4000-8000-000000025d02'::uuid, pg_temp.test_courier(), 'license', 'courier/exp_lic_new.jpg', 'submitted');
  $$,
  '42501',
  NULL,
  'Direct INSERT without atomic RPC is denied with 42501 in Phase C (PR364-R07)'
);

-- Initial onboarding succeeds via submit_courier_onboarding_documents under authenticated role
select lives_ok(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'Initial onboarding succeeds via atomic RPC submit_courier_onboarding_documents under authenticated role'
);

-- Post-Phase-C: Second direct INSERT for the same kind (even with different path) is blocked by 42501
select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values (pg_temp.test_courier(), 'dni_front', 'courier/' || pg_temp.test_courier()::text || '/dni_front_1.jpg', 'submitted');
  $$,
  '42501',
  NULL,
  'Second direct INSERT for existing current kind is blocked with 42501'
);

select is(
  (select count(*)::integer from public.courier_documents where courier_id = pg_temp.test_courier() and kind = 'dni_front'),
  1,
  'Document dni_front has exactly 1 row'
);

-- Post-Phase-C: Direct ON CONFLICT DO UPDATE (legacy UPSERT) is denied with 42501 because UPDATE privilege is revoked
select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values (pg_temp.test_courier(), 'dni_front', 'courier/' || pg_temp.test_courier()::text || '/dni_front_retry.jpg', 'submitted')
    on conflict (id) do update set storage_path = excluded.storage_path;
  $$,
  '42501',
  NULL,
  'Direct UPSERT (ON CONFLICT DO UPDATE) as courier is denied by Phase C privilege revocation (42501)'
);

select is(
  (select storage_path from public.courier_documents where courier_id = pg_temp.test_courier() and kind = 'dni_front'),
  'courier/' || pg_temp.test_courier()::text || '/dni_front.jpg',
  'Storage path remains unchanged after denied update'
);

-- H02 Negative test: Another authenticated user cannot insert documents for this courier
select pg_temp.act_as(pg_temp.other_courier());

select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values (pg_temp.test_courier(), 'avatar', 'courier/spoofed.jpg', 'submitted');
  $$,
  '42501',
  NULL,
  'Different user cannot insert documents for another courier (RLS 42501)'
);

-- 6. Guard enforcement in Phase C: attempts by authenticated to forge is_current=false, rejection_code, or idempotency_key are rejected by RLS (42501)
select pg_temp.act_as(pg_temp.test_courier());

select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
    values (pg_temp.test_courier(), 'avatar', 'courier/fake_avatar.jpg', 'submitted', false);
  $$,
  '42501',
  NULL,
  'INSERT with is_current=false must be rejected by Phase C RLS'
);

select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status, rejection_code)
    values (pg_temp.test_courier(), 'avatar', 'courier/fake_avatar.jpg', 'submitted', 'other_safe');
  $$,
  '42501',
  NULL,
  'INSERT with forged rejection_code must be rejected by Phase C RLS'
);

select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status, idempotency_key)
    values (pg_temp.test_courier(), 'avatar', 'courier/fake_avatar.jpg', 'submitted', '00000000-0000-4000-8000-000000000099');
  $$,
  '42501',
  NULL,
  'INSERT with forged idempotency_key must be rejected by Phase C RLS'
);

select pg_temp.reset_actor();

select * from finish();
rollback;
