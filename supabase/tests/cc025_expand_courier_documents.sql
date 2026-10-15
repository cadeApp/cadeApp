begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(18);

-- Test actors
create function pg_temp.test_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025a01'::uuid
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

-- 2. Guard constraint existence
select has_check('public', 'courier_documents', 'courier_documents_expansion_guard', 'Expansion guard constraint must exist');

-- 3. Invariants on pre-existing rows: all rows must have is_current=true, rejection_code=NULL, idempotency_key=NULL
select is(
  (select count(*)::integer from public.courier_documents where is_current is distinct from true or rejection_code is not null or idempotency_key is not null),
  0,
  'All existing courier_documents rows must satisfy expansion defaults (true, null, null)'
);

-- 4. Permissions: authenticated role MUST retain UPDATE privilege during expand phase (required by old UPSERT writer)
select ok(
  has_table_privilege('authenticated', 'public.courier_documents', 'UPDATE'),
  'authenticated must retain UPDATE privilege on courier_documents during expand phase'
);

-- Setup test courier
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values (pg_temp.test_courier(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier_expand@test.com', 'pwd', '{"role":"courier"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, role, consent_status)
values (pg_temp.test_courier(), 'courier', 'active')
on conflict (id) do update set role = excluded.role, consent_status = 'active';

insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
values (pg_temp.test_courier(), 'pending', false, 'moto', 'EXP01')
on conflict (profile_id) do nothing;

-- 5. Old writer compatibility: INSERT and UPSERT without specifying new columns must succeed under authenticated role
select pg_temp.act_as(pg_temp.test_courier());

select lives_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values (pg_temp.test_courier(), 'license', 'courier/exp_lic_1.jpg', 'submitted');
  $$,
  'Old writer INSERT without new fields must succeed under authenticated role'
);

select lives_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values (pg_temp.test_courier(), 'license', 'courier/exp_lic_1.jpg', 'submitted')
    on conflict (storage_path) do update set status = 'submitted';
  $$,
  'Old writer UPSERT (ON CONFLICT DO UPDATE) must succeed under authenticated role'
);

-- 6. Guard enforcement: attempts to forge invalid values must fail with check constraint violation (23514)
select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
    values (pg_temp.test_courier(), 'avatar', 'courier/fake_avatar.jpg', 'submitted', false);
  $$,
  '23514',
  NULL,
  'INSERT with is_current=false must be rejected by expansion guard'
);

select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status, rejection_code)
    values (pg_temp.test_courier(), 'avatar', 'courier/fake_avatar.jpg', 'submitted', 'other_safe');
  $$,
  '23514',
  NULL,
  'INSERT with forged rejection_code must be rejected by expansion guard'
);

select throws_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status, idempotency_key)
    values (pg_temp.test_courier(), 'avatar', 'courier/fake_avatar.jpg', 'submitted', '00000000-0000-4000-8000-000000000099');
  $$,
  '23514',
  NULL,
  'INSERT with forged idempotency_key must be rejected by expansion guard'
);

select pg_temp.reset_actor();

select * from finish();
rollback;
