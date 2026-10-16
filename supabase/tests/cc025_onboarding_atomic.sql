begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(28);

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
insert into auth.users (id, email)
values
  (pg_temp.test_courier(), 'courier_b0@test.com'),
  (pg_temp.other_courier(), 'other_courier_b0@test.com'),
  (pg_temp.test_merchant(), 'merchant_b0@test.com')
on conflict (id) do nothing;

insert into public.profiles (id, role, full_name, phone, consent_status)
values
  (pg_temp.test_courier(), 'courier', 'Courier B0', '+543865000001', 'active'),
  (pg_temp.other_courier(), 'courier', 'Other Courier B0', '+543865000002', 'pending'),
  (pg_temp.test_merchant(), 'merchant', 'Merchant B0', '+543865000003', 'active')
on conflict (id) do update set
  role = excluded.role,
  consent_status = excluded.consent_status;

insert into public.couriers (profile_id, vehicle_type, is_active)
values
  (pg_temp.test_courier(), null, true),
  (pg_temp.other_courier(), null, true)
on conflict (profile_id) do nothing;

-- 1. Existence and signature
select has_function('public', 'submit_courier_onboarding_documents', ARRAY['jsonb'], 'submit_courier_onboarding_documents function must exist');

-- 2. Permissions: anon cannot execute
select throws_matching(
  $$
    set local role anon;
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'permission denied',
  'anon must be denied EXECUTE on submit_courier_onboarding_documents'
);

-- 3. Unauthenticated execution fails with UNAUTHENTICATED
select pg_temp.act_as(null);
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'UNAUTHENTICATED',
  'Calling without auth.uid() must throw UNAUTHENTICATED'
);

-- 4. Merchant cannot execute (UNAUTHORIZED_ACTOR)
select pg_temp.act_as(pg_temp.test_merchant());
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'UNAUTHORIZED_ACTOR',
  'Merchant role must throw UNAUTHORIZED_ACTOR'
);

-- 5. Courier with pending consent fails with CONSENT_REQUIRED
select pg_temp.act_as(pg_temp.other_courier());
select throws_matching(
  $$
    select public.submit_courier_onboarding_documents('[]'::jsonb);
  $$,
  'CONSENT_REQUIRED',
  'Courier with pending consent must throw CONSENT_REQUIRED'
);

-- 6. Invalid payloads: null, not array, empty
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

-- 7. Missing required kinds (e.g. only dni_front)
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

-- 8. Duplicate kinds in input payload
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

-- 9. Storage path validation: invalid prefix or path traversal
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

-- 10. Successful first submission
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

-- 11. Idempotent retry with exact same payload
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

-- 12. Path discrepancy on existing kind throws VALIDATION_ERROR
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

-- 13. Existing active document in status rejected cannot be overwritten by onboarding RPC (throws VALIDATION_ERROR)
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

-- 14. Existing dirty duplicate active rows throws INTERNAL_ERROR
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

-- 15. Optional kinds: license and insurance can be submitted additively
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

select * from finish();
rollback;
