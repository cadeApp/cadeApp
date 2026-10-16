begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(37);

-- Test actors
create function pg_temp.test_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025b01'::uuid
$$;

create function pg_temp.other_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025b02'::uuid
$$;

create function pg_temp.test_merchant() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025b03'::uuid
$$;

create function pg_temp.orphan_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025b04'::uuid
$$;

create function pg_temp.rejected_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025b05'::uuid
$$;

create function pg_temp.suspended_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025b06'::uuid
$$;

create function pg_temp.approved_courier() returns uuid language sql as $$
  select '00000000-0000-4000-8000-000000025b07'::uuid
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

-- Setup test fixtures
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.test_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'courier_b0@test.com', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.other_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'other_courier_b0@test.com', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.test_merchant(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'merchant_b0@test.com', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.orphan_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'orphan_courier_b0@test.com', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.rejected_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'rejected_courier_b0@test.com', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.suspended_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'suspended_courier_b0@test.com', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.approved_courier(), '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'approved_courier_b0@test.com', 'pwd', '{"role":"courier"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, role, display_name, phone, consent_status)
values
  (pg_temp.test_courier(), 'courier', 'Courier B0', '+543865000001', 'active'),
  (pg_temp.other_courier(), 'courier', 'Other Courier B0', '+543865000002', 'pending'),
  (pg_temp.test_merchant(), 'merchant', 'Merchant B0', '+543865000003', 'active'),
  (pg_temp.orphan_courier(), 'courier', 'Orphan Courier B0', '+543865000004', 'active'),
  (pg_temp.rejected_courier(), 'courier', 'Rejected Courier B0', '+543865000005', 'active'),
  (pg_temp.suspended_courier(), 'courier', 'Suspended Courier B0', '+543865000006', 'active'),
  (pg_temp.approved_courier(), 'courier', 'Approved Courier B0', '+543865000007', 'active')
on conflict (id) do update set
  role = excluded.role,
  consent_status = excluded.consent_status;

insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
values
  (pg_temp.test_courier(), 'pending', false, null, null),
  (pg_temp.other_courier(), 'pending', false, null, null),
  (pg_temp.rejected_courier(), 'rejected', false, null, null),
  (pg_temp.suspended_courier(), 'suspended', false, null, null),
  (pg_temp.approved_courier(), 'approved', false, null, null)
on conflict (profile_id) do update set
  status = excluded.status,
  available = excluded.available,
  vehicle_type = excluded.vehicle_type,
  vehicle_plate = excluded.vehicle_plate;

delete from public.couriers where profile_id = pg_temp.orphan_courier();

-- 1. Existence and signature
select has_function('public', 'submit_courier_onboarding_documents', ARRAY['jsonb'], 'submit_courier_onboarding_documents function must exist');

-- 2. Privileges
select ok(
  has_table_privilege('authenticated', 'public.courier_documents', 'SELECT'),
  'authenticated role must have SELECT privilege on courier_documents'
);

select ok(
  has_function_privilege('authenticated', 'public.submit_courier_onboarding_documents(jsonb)', 'EXECUTE'),
  'authenticated role must have EXECUTE privilege on submit_courier_onboarding_documents'
);

-- 3. Permissions: anon cannot execute
select throws_matching(
  $$
    set local role anon;
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'permission denied',
  'anon must be denied EXECUTE on submit_courier_onboarding_documents'
);

-- 4. Unauthenticated execution fails with UNAUTHENTICATED
select pg_temp.act_as(null);
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'UNAUTHENTICATED',
  'Calling without auth.uid() must throw UNAUTHENTICATED'
);

-- 5. Merchant cannot execute (UNAUTHORIZED_ACTOR)
select pg_temp.act_as(pg_temp.test_merchant());
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'UNAUTHORIZED_ACTOR',
  'Merchant role must throw UNAUTHORIZED_ACTOR'
);

-- 6. Missing couriers table record fails with NOT_FOUND
select pg_temp.act_as(pg_temp.orphan_courier());
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.orphan_courier()::text || '/dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.orphan_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.orphan_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.orphan_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'NOT_FOUND',
  'Calling onboarding RPC when courier record is missing must throw NOT_FOUND'
);

-- 7. Courier with pending consent fails with CONSENT_REQUIRED
select pg_temp.act_as(pg_temp.other_courier());
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'CONSENT_REQUIRED',
  'Courier with pending consent must throw CONSENT_REQUIRED'
);

-- 8. Invalid payloads: null, not array, empty
select pg_temp.act_as(pg_temp.test_courier());

select throws_matching(
  $$ select public.submit_courier_onboarding_documents(null); $$,
  'VALIDATION_ERROR',
  'Null payload must throw VALIDATION_ERROR'
);

select throws_matching(
  $$ select public.submit_courier_onboarding_documents('{"kind":"dni_front"}'::jsonb); $$,
  'VALIDATION_ERROR',
  'Object payload (not array) must throw VALIDATION_ERROR'
);

select throws_matching(
  $$ select public.submit_courier_onboarding_documents('[]'::jsonb); $$,
  'VALIDATION_ERROR',
  'Empty array must throw VALIDATION_ERROR'
);

-- 9. Missing required kinds (e.g. only dni_front)
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_front.jpg')
      )
    );
  $$,
  'VALIDATION_ERROR',
  'Payload missing required kinds must throw VALIDATION_ERROR'
);

-- 10. Duplicate kinds in input payload
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_front_1.jpg'),
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_front_2.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'VALIDATION_ERROR',
  'Duplicate kind in payload must throw VALIDATION_ERROR'
);

-- 11. Storage path validation: invalid prefix or path traversal
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'other/path/dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'VALIDATION_ERROR',
  'Storage path not belonging to courier must throw VALIDATION_ERROR'
);

select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/../escape.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'VALIDATION_ERROR',
  'Path traversal .. must throw VALIDATION_ERROR'
);

-- 12. Successful first submission
create function pg_temp.valid_docs_payload() returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_front.jpg'),
    jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_back.jpg'),
    jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/selfie.jpg'),
    jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/avatar.jpg')
  );
$$;

select lives_ok(
  $$ select public.submit_courier_onboarding_documents(pg_temp.valid_docs_payload()); $$,
  'Initial submission with 4 valid documents succeeds'
);

-- Check inserted rows
select results_eq(
  $$
    select count(*)::integer, count(distinct kind)::integer
    from public.courier_documents
    where courier_id = pg_temp.test_courier();
  $$,
  $$ values (4, 4) $$,
  'Must have inserted exactly 4 distinct document kinds'
);

select results_eq(
  $$
    select distinct is_current, status, rejection_code, idempotency_key
    from public.courier_documents
    where courier_id = pg_temp.test_courier();
  $$,
  $$ values (true, 'submitted'::public.document_review_status, null::text, null::text) $$,
  'All inserted documents must have is_current=true, status=submitted, and null rejection_code/idempotency_key'
);

-- 13. Idempotent retry with exact same payload
select lives_ok(
  $$ select public.submit_courier_onboarding_documents(pg_temp.valid_docs_payload()); $$,
  'Idempotent retry with exact same payload succeeds'
);

select results_eq(
  $$
    select count(*)::integer
    from public.courier_documents
    where courier_id = pg_temp.test_courier();
  $$,
  $$ values (4) $$,
  'Idempotent retry must not duplicate document rows'
);

-- 14. Idempotent retry with verified document retains verified status
select pg_temp.reset_actor();
update public.courier_documents
set status = 'verified'
where courier_id = pg_temp.test_courier() and kind = 'dni_front';

select pg_temp.act_as(pg_temp.test_courier());
select lives_ok(
  $$ select public.submit_courier_onboarding_documents(pg_temp.valid_docs_payload()); $$,
  'Idempotent retry with verified document succeeds without error'
);

select results_eq(
  $$
    select status
    from public.courier_documents
    where courier_id = pg_temp.test_courier() and kind = 'dni_front';
  $$,
  $$ values ('verified'::public.document_review_status) $$,
  'Verified document must retain status=verified on idempotent retry'
);

-- 15. Path discrepancy on existing kind throws VALIDATION_ERROR
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/different_dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'VALIDATION_ERROR',
  'Path discrepancy on existing kind must throw VALIDATION_ERROR'
);

-- Check row count still 4
select results_eq(
  $$
    select count(*)::integer
    from public.courier_documents
    where courier_id = pg_temp.test_courier();
  $$,
  $$ values (4) $$,
  'Failed discrepancy attempt must not insert new rows'
);

-- 16. Existing active document in status rejected cannot be overwritten by onboarding RPC (throws VALIDATION_ERROR)
select pg_temp.reset_actor();
update public.courier_documents
set status = 'rejected'
where courier_id = pg_temp.test_courier() and kind = 'dni_back';

select pg_temp.act_as(pg_temp.test_courier());
select throws_matching(
  $$ select public.submit_courier_onboarding_documents(pg_temp.valid_docs_payload()); $$,
  'VALIDATION_ERROR',
  'Attempting onboarding submit when an active document is rejected must throw VALIDATION_ERROR'
);

-- 17. Existing dirty duplicate active rows throws INTERNAL_ERROR
select pg_temp.reset_actor();
-- Temporarily restore status to submitted
update public.courier_documents set status = 'submitted' where courier_id = pg_temp.test_courier();

-- Insert an extra active row for avatar to simulate duplicate
insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
values (pg_temp.test_courier(), 'avatar', 'courier/' || pg_temp.test_courier()::text || '/avatar_duplicate.jpg', 'submitted', true);

select pg_temp.act_as(pg_temp.test_courier());
select throws_matching(
  $$ select public.submit_courier_onboarding_documents(pg_temp.valid_docs_payload()); $$,
  'INTERNAL_ERROR',
  'Pre-existing duplicate active rows must throw INTERNAL_ERROR'
);

-- 18. Optional kinds: license and insurance can be submitted additively
select pg_temp.reset_actor();
-- Clean up duplicate avatar row
delete from public.courier_documents
where courier_id = pg_temp.test_courier()
  and storage_path = 'courier/' || pg_temp.test_courier()::text || '/avatar_duplicate.jpg';

select pg_temp.act_as(pg_temp.test_courier());

create function pg_temp.docs_with_vehicle_payload() returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_front.jpg'),
    jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/dni_back.jpg'),
    jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/selfie.jpg'),
    jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/avatar.jpg'),
    jsonb_build_object('kind', 'license', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/license.jpg'),
    jsonb_build_object('kind', 'insurance', 'storage_path', 'courier/' || pg_temp.test_courier()::text || '/insurance.jpg')
  );
$$;

select lives_ok(
  $$ select public.submit_courier_onboarding_documents(pg_temp.docs_with_vehicle_payload()); $$,
  'Submitting with license and insurance succeeds'
);

select results_eq(
  $$
    select count(*)::integer, count(distinct kind)::integer
    from public.courier_documents
    where courier_id = pg_temp.test_courier();
  $$,
  $$ values (6, 6) $$,
  'All 6 kinds must be present without duplicates'
);

-- 19. Courier status guard: rejected courier throws UNAUTHORIZED_ACTOR (H03)
select pg_temp.act_as(pg_temp.rejected_courier());

select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.rejected_courier()::text || '/dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.rejected_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.rejected_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.rejected_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'UNAUTHORIZED_ACTOR',
  'Rejected courier must throw UNAUTHORIZED_ACTOR'
);

select results_eq(
  $$
    select count(*)::integer
    from public.courier_documents
    where courier_id = pg_temp.rejected_courier();
  $$,
  $$ values (0) $$,
  'Rejected courier invocation must insert 0 rows'
);

-- 20. Courier status guard: suspended courier throws UNAUTHORIZED_ACTOR (H03)
select pg_temp.act_as(pg_temp.suspended_courier());

select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.suspended_courier()::text || '/dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.suspended_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.suspended_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.suspended_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'UNAUTHORIZED_ACTOR',
  'Suspended courier must throw UNAUTHORIZED_ACTOR'
);

select results_eq(
  $$
    select count(*)::integer
    from public.courier_documents
    where courier_id = pg_temp.suspended_courier();
  $$,
  $$ values (0) $$,
  'Suspended courier invocation must insert 0 rows'
);

-- 21. Courier status guard: approved courier submission succeeds (H03)
select pg_temp.act_as(pg_temp.approved_courier());

select lives_ok(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'Approved courier submission succeeds'
);

select results_eq(
  $$
    select count(*)::integer
    from public.courier_documents
    where courier_id = pg_temp.approved_courier();
  $$,
  $$ values (4) $$,
  'Approved courier submission must insert 4 rows'
);

-- 22. Coexistence reality: direct REST insert with distinct path bypasses Phase A RLS and is detected by RPC (H01)
-- Under Phase A, only UNIQUE(storage_path) exists. A direct REST insert with an alternative storage_path
-- passes courier_documents_insert_self policy and creates a second active row for the same kind.
select lives_ok(
  $$
    insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
    values (
      pg_temp.approved_courier(),
      'dni_front',
      'courier/' || pg_temp.approved_courier()::text || '/dni_front_alt_path.jpg',
      'submitted',
      true
    );
  $$,
  'Direct REST insert with alternative path succeeds under Phase A RLS (bypassing RPC lock)'
);

select results_eq(
  $$
    select count(*)::integer
    from public.courier_documents
    where courier_id = pg_temp.approved_courier() and kind = 'dni_front';
  $$,
  $$ values (2) $$,
  'Phase A RLS allows 2 rows for same kind when storage_path is distinct'
);

-- Subsequent call to the RPC detects the ambiguity and raises INTERNAL_ERROR
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents(
      jsonb_build_array(
        jsonb_build_object('kind', 'dni_front', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/dni_front.jpg'),
        jsonb_build_object('kind', 'dni_back', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/dni_back.jpg'),
        jsonb_build_object('kind', 'selfie', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/selfie.jpg'),
        jsonb_build_object('kind', 'avatar', 'storage_path', 'courier/' || pg_temp.approved_courier()::text || '/avatar.jpg')
      )
    );
  $$,
  'INTERNAL_ERROR',
  'Subsequent RPC invocation detects pre-existing duplicate kind and fails safely with INTERNAL_ERROR'
);

select * from finish();
rollback;
