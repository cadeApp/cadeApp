-- CC-025: Subetapa B0 — RPC transaccional aditiva de alta de onboarding (Issue #363, T-356)
-- Resuelve la limitación estructural H01 serializando bajo lock couriers(profile_id) FOR UPDATE.
-- Es aditiva y backward-compatible con el esquema expandido de la Fase A (PR #374).

create or replace function public.submit_courier_onboarding_documents(p_documents jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_courier_id uuid := auth.uid();
  v_profile_role text;
  v_consent_status text;
  v_courier_rec record;
  v_doc_elem jsonb;
  v_kind_text text;
  v_kind public.courier_document_kind;
  v_storage_path text;
  v_expected_prefix text;
  v_has_dni_front boolean := false;
  v_has_dni_back boolean := false;
  v_has_selfie boolean := false;
  v_has_avatar boolean := false;
  v_inserted_count integer := 0;
  v_reused_count integer := 0;
  v_existing_doc record;
  v_duplicate_check record;
begin
  -- 1. Autenticación y actor inicial
  if v_courier_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_profile_role, v_consent_status
  from public.profiles
  where id = v_courier_id;

  if v_profile_role is distinct from 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'CONSENT_REQUIRED';
  end if;

  -- 2. Lock transaccional serializador sobre couriers (orden unificado CC-025)
  select profile_id, status, vehicle_type into v_courier_rec
  from public.couriers
  where profile_id = v_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- 3. Elegibilidad del courier bajo el lock (H03)
  if v_courier_rec.status::text in ('rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- 4. Revalidación concurrente de perfil y consentimiento legal bajo snapshot actual (H04)
  select role, consent_status into v_profile_role, v_consent_status
  from public.profiles
  where id = v_courier_id
  for share;

  if not found or v_profile_role is distinct from 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'CONSENT_REQUIRED';
  end if;

  -- 5. Validación de estructura del payload
  if p_documents is null or jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) = 0 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_expected_prefix := 'courier/' || v_courier_id::text || '/';

  for v_doc_elem in select * from jsonb_array_elements(p_documents)
  loop
    v_kind_text := trim(v_doc_elem->>'kind');
    v_storage_path := trim(v_doc_elem->>'storage_path');

    if v_kind_text is null or v_kind_text = '' or v_storage_path is null or v_storage_path = '' then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    if v_kind_text not in ('dni_front', 'dni_back', 'selfie', 'avatar', 'license', 'insurance') then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    if v_storage_path not like (v_expected_prefix || '%') or v_storage_path like '%..%' or length(v_storage_path) > 300 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    if v_kind_text = 'dni_front' then
      if v_has_dni_front then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;
      v_has_dni_front := true;
    elsif v_kind_text = 'dni_back' then
      if v_has_dni_back then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;
      v_has_dni_back := true;
    elsif v_kind_text = 'selfie' then
      if v_has_selfie then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;
      v_has_selfie := true;
    elsif v_kind_text = 'avatar' then
      if v_has_avatar then raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR'; end if;
      v_has_avatar := true;
    end if;
  end loop;

  if not (v_has_dni_front and v_has_dni_back and v_has_selfie and v_has_avatar) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- 6. Detección de ambigüedad en documentos existentes (esquema expandido sin índice único)
  for v_duplicate_check in
    select kind, count(*) as cnt
    from public.courier_documents
    where courier_id = v_courier_id
      and coalesce(is_current, true) = true
    group by kind
    having count(*) > 1
  loop
    raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
  end loop;

  -- 7. Procesamiento atómico bajo el lock
  for v_doc_elem in select * from jsonb_array_elements(p_documents)
  loop
    v_kind_text := trim(v_doc_elem->>'kind');
    v_kind := v_kind_text::public.courier_document_kind;
    v_storage_path := trim(v_doc_elem->>'storage_path');

    select id, kind, storage_path, status, is_current
    into v_existing_doc
    from public.courier_documents
    where courier_id = v_courier_id
      and kind = v_kind
      and coalesce(is_current, true) = true
    for update;

    if found then
      if v_existing_doc.status not in ('submitted', 'verified') then
        raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
      end if;

      if v_existing_doc.storage_path <> v_storage_path then
        raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
      end if;

      v_reused_count := v_reused_count + 1;
    else
      insert into public.courier_documents (
        courier_id,
        kind,
        storage_path,
        status,
        is_current,
        rejection_code,
        idempotency_key
      ) values (
        v_courier_id,
        v_kind,
        v_storage_path,
        'submitted',
        true,
        null,
        null
      );

      v_inserted_count := v_inserted_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'courier_id', v_courier_id,
    'inserted_count', v_inserted_count,
    'reused_count', v_reused_count
  );
end;
$$;

revoke all on function public.submit_courier_onboarding_documents(jsonb) from public, anon;
grant execute on function public.submit_courier_onboarding_documents(jsonb) to authenticated;
