-- CC-033: alta posterior de licencia o seguro opcionales del repartidor.
create or replace function public.add_courier_optional_document(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_profile_role text;
  v_consent_status text;
  v_kind_text text;
  v_kind public.courier_document_kind;
  v_storage_path text;
  v_expected_prefix text;
  v_storage_suffix text;
  v_idempotency_key_text text;
  v_idempotency_key uuid;
  v_courier_rec record;
  v_existing_id uuid;
  v_existing_status public.document_review_status;
  v_existing_path text;
  v_existing_current boolean;
  v_current_id uuid;
  v_current_status public.document_review_status;
  v_current_path text;
  v_document_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select role, consent_status into v_profile_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_profile_role is distinct from 'courier' or v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if not (p_payload ? 'kind') or jsonb_typeof(p_payload->'kind') <> 'string'
     or not (p_payload ? 'storagePath') or jsonb_typeof(p_payload->'storagePath') <> 'string'
     or ((p_payload ? 'idempotencyKey') and jsonb_typeof(p_payload->'idempotencyKey') <> 'string') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_kind_text := p_payload->>'kind';
  v_storage_path := p_payload->>'storagePath';
  v_idempotency_key_text := p_payload->>'idempotencyKey';

  if v_kind_text is null
     or v_kind_text not in ('license', 'insurance')
     or trim(v_storage_path) = '' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_kind := v_kind_text::public.courier_document_kind;
  v_expected_prefix := 'courier/' || v_actor_id::text || '/' || v_kind_text || '_';

  if left(v_storage_path, length(v_expected_prefix)) <> v_expected_prefix
     or v_storage_path like '%..%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_storage_suffix := substr(v_storage_path, length(v_expected_prefix) + 1);
  if v_storage_suffix !~ '^[0-9]+[.](png|jpe?g|webp|pdf)$'
     or v_storage_suffix like '%/%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if (p_payload ? 'idempotencyKey')
     and (v_idempotency_key_text is null
          or v_idempotency_key_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_idempotency_key := v_idempotency_key_text::uuid;

  -- Orden de locks de CC-025/CC-033: couriers, profiles, courier_documents.
  select profile_id, status, vehicle_type into v_courier_rec
  from public.couriers
  where profile_id = v_actor_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_courier_rec.status::text in ('rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_courier_rec.status::text not in ('pending', 'approved') or v_courier_rec.vehicle_type is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  select role, consent_status into v_profile_role, v_consent_status
  from public.profiles
  where id = v_actor_id
  for share;

  if not found or v_profile_role is distinct from 'courier' or v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_idempotency_key is not null then
    select id, status, storage_path, is_current
    into v_existing_id, v_existing_status, v_existing_path, v_existing_current
    from public.courier_documents
    where courier_id = v_actor_id
      and kind = v_kind
      and idempotency_key = v_idempotency_key;

    if found then
      if v_existing_path <> v_storage_path then
        raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
      end if;

      return jsonb_build_object(
        'documentId', v_existing_id,
        'kind', v_kind,
        'status', v_existing_status,
        'isCurrent', v_existing_current,
        'idempotent', true
      );
    end if;
  end if;

  select id, status, storage_path
  into v_current_id, v_current_status, v_current_path
  from public.courier_documents
  where courier_id = v_actor_id
    and kind = v_kind
    and is_current = true
  for update;

  if found then
    if v_current_status = 'submitted' and v_current_path = v_storage_path then
      return jsonb_build_object(
        'documentId', v_current_id,
        'kind', v_kind,
        'status', v_current_status,
        'isCurrent', true,
        'idempotent', true
      );
    end if;

    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'courier-docs'
      and name = v_storage_path
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  insert into public.courier_documents (
    courier_id,
    kind,
    storage_path,
    status,
    is_current,
    rejection_code,
    idempotency_key,
    purge_after,
    purged_at
  ) values (
    v_actor_id,
    v_kind,
    v_storage_path,
    'submitted',
    true,
    null,
    v_idempotency_key,
    null,
    null
  )
  returning id into v_document_id;

  if v_kind = 'license' then
    update public.couriers set license_status = 'submitted' where profile_id = v_actor_id;
  else
    update public.couriers set insurance_status = 'submitted' where profile_id = v_actor_id;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'add_courier_optional_document',
    'courier_document',
    v_document_id::text,
    jsonb_build_object('kind', v_kind, 'previous_status', 'none'),
    jsonb_build_object(
      'document_id', v_document_id,
      'kind', v_kind,
      'status', 'submitted',
      'is_current', true,
      'idempotency_key', v_idempotency_key
    )
  );

  return jsonb_build_object(
    'documentId', v_document_id,
    'kind', v_kind,
    'status', 'submitted',
    'isCurrent', true,
    'idempotent', false
  );
end;
$$;

revoke all on function public.add_courier_optional_document(jsonb) from public, anon;
grant execute on function public.add_courier_optional_document(jsonb) to authenticated;
