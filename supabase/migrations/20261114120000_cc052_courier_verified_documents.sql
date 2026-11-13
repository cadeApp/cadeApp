-- CC-052 (T-437, B-05): aprobar o rehabilitar un repartidor exige los cuatro documentos obligatorios del alta
-- (dni_front, dni_back, selfie, avatar) vigentes, verificados y sin purgar. Agrega la subsanación de documentos para
-- rechazados y suspendidos (D5-A), sin rehabilitar. D1-A…D7-A ratificadas por Lautaro073 el 2026-11-13.

-- 1. Helper interno: exactamente un vigente por tipo obligatorio, verificado y sin purgar. Sin grants a clientes.
create or replace function app_private.courier_required_documents_verified(p_courier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) = 4
  from (
    select d.kind
    from public.courier_documents d
    where d.courier_id = p_courier_id
      and d.kind in ('dni_front', 'dni_back', 'selfie', 'avatar')
      and coalesce(d.is_current, true)
    group by d.kind
    having count(*) = 1
       and bool_and(d.status = 'verified' and d.purged_at is null)
  ) ok;
$$;

revoke all on function app_private.courier_required_documents_verified(uuid) from public, anon, authenticated;

-- 2. admin_reinstate_courier (CC-050) con la guarda de CC-052 después del camino idempotente y de la guarda de estado.
create or replace function public.admin_reinstate_courier(
  p_courier_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reason text := trim(p_reason);
  v_courier_status public.courier_status;
  v_vehicle_type public.vehicle_type;
  v_dni_hmac text;
  v_application_submitted boolean;
begin
  perform app_private.assert_admin_aal2();

  if v_reason is null or v_reason = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  if char_length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Mismo primer lock que admin_suspend_courier, admin_decide_courier y las RPC del repartidor.
  select status, vehicle_type, dni_hmac, application_submitted
  into v_courier_status, v_vehicle_type, v_dni_hmac, v_application_submitted
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- Reintento o doble clic: ya está aprobado. Sin update ni auditoría (no mira documentos).
  if v_courier_status = 'approved' then
    return jsonb_build_object(
      'courierId', p_courier_id,
      'previousStatus', 'approved',
      'status', 'approved',
      'idempotent', true
    );
  end if;

  -- CC-050: solo vuelve una postulación enviada y con DNI (deja afuera el DNI liberado por disputa, D7-A).
  if v_courier_status not in ('suspended', 'rejected')
     or v_vehicle_type is null
     or not v_application_submitted
     or v_dni_hmac is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- REVIEW ONLY / NEVER MERGE (T-437 RED): guarda de admin_reinstate_courier quitada.

  -- available queda como esté (false tras la suspensión): el repartidor la reactiva con set_availability.
  update public.couriers
  set
    status = 'approved',
    decided_at = now(),
    decided_by = v_actor_id,
    deactivated_at = null
  where profile_id = p_courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_reinstate_courier',
    'courier',
    p_courier_id::text,
    jsonb_build_object('status', v_courier_status),
    jsonb_build_object('status', 'approved', 'reason', v_reason)
  );

  return jsonb_build_object(
    'courierId', p_courier_id,
    'previousStatus', v_courier_status,
    'status', 'approved',
    'idempotent', false
  );
end;
$$;

revoke all on function public.admin_reinstate_courier(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reinstate_courier(uuid, text) to authenticated;

-- 3. admin_decide_courier (CC-050) con la guarda de CC-052 solo al aprobar. Rechazar no mira documentos.
create or replace function public.admin_decide_courier(
  p_courier_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_courier_status public.courier_status;
  v_application_submitted boolean;
  v_decided_at timestamptz := now();
  v_target_status public.courier_status;
begin
  -- H14: autenticación, rol admin y MFA (aal2) en un solo lugar
  perform app_private.assert_admin_aal2();

  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_decision = 'rejected' and (p_reason is null or trim(p_reason) = '') then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select status, application_submitted
  into v_courier_status, v_application_submitted
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- D03: solo desde 'pending'. CC-050: y con la postulación enviada (antes del update y del audit).
  if v_courier_status <> 'pending' or not v_application_submitted then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- REVIEW ONLY / NEVER MERGE (T-437 RED): guarda de admin_decide_courier quitada.

  v_target_status := p_decision::public.courier_status;

  update public.couriers
  set
    status = v_target_status,
    decided_at = v_decided_at,
    decided_by = v_actor_id
  where profile_id = p_courier_id;

  -- D02 / H10: Registrar evento en audit_log
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_decide_courier',
    'courier',
    p_courier_id::text,
    jsonb_build_object('status', v_courier_status),
    jsonb_build_object('status', v_target_status, 'reason', p_reason)
  );

  return jsonb_build_object(
    'courierId', p_courier_id,
    'status', v_target_status,
    'decidedAt', to_char(v_decided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.admin_decide_courier(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_decide_courier(uuid, text, text) to authenticated;

-- 4. Subsanación (D5-A): un rejected o suspended con DNI registrado vuelve a presentar un obligatorio en submitted.
-- No rehabilita: la verificación sigue en admin_verify_document y la vuelta, en admin_reinstate_courier.
create or replace function public.resubmit_courier_required_document(p_payload jsonb)
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
  v_idempotency_key text;
  v_courier_rec record;
  v_existing_id uuid;
  v_existing_status public.document_review_status;
  v_existing_path text;
  v_current_id uuid;
  v_current_status public.document_review_status;
  v_current_path text;
  v_current_purged_at timestamptz;
  v_current_purge_after timestamptz;
  v_new_doc_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_profile_role, v_consent_status
  from public.profiles
  where id = v_actor_id;

  if v_profile_role is distinct from 'courier' or v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  v_kind_text := p_payload->>'kind';
  v_storage_path := p_payload->>'storagePath';
  v_idempotency_key := nullif(trim(p_payload->>'idempotencyKey'), '');

  if v_kind_text is null
     or v_kind_text not in ('dni_front', 'dni_back', 'selfie', 'avatar')
     or p_payload ? 'vehicleId'
     or v_storage_path is null
     or trim(v_storage_path) = ''
     or v_idempotency_key is null
     or v_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_kind := v_kind_text::public.courier_document_kind;
  v_expected_prefix := 'courier/' || v_actor_id::text || '/' || v_kind_text || '_';

  if left(v_storage_path, length(v_expected_prefix)) <> v_expected_prefix or v_storage_path like '%..%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_storage_suffix := substr(v_storage_path, length(v_expected_prefix) + 1);

  if v_storage_suffix !~* '^[0-9]+[.](png|jpe?g|webp|pdf)$' or v_storage_suffix like '%/%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Mismo primer lock que admin_reinstate_courier, admin_verify_document y el reemplazo de CC-025.
  select profile_id, status, application_submitted, dni_hmac into v_courier_rec
  from public.couriers
  where profile_id = v_actor_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select role, consent_status into v_profile_role, v_consent_status
  from public.profiles
  where id = v_actor_id
  for share;

  if not found or v_profile_role is distinct from 'courier' or v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- pending y approved usan replace_courier_document. D7-A: con el DNI liberado no hay subsanación.
  if v_courier_rec.status::text not in ('rejected', 'suspended')
     or not v_courier_rec.application_submitted
     or v_courier_rec.dni_hmac is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  select id, status, storage_path into v_existing_id, v_existing_status, v_existing_path
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
      'replacedDocumentId', null,
      'idempotent', true
    );
  end if;

  select id, status, storage_path, purged_at, purge_after
  into v_current_id, v_current_status, v_current_path, v_current_purged_at, v_current_purge_after
  from public.courier_documents
  where courier_id = v_actor_id
    and kind = v_kind
    and vehicle_id is null
    and is_current = true
  for update;

  if found then
    if v_current_status = 'submitted' and v_current_path = v_storage_path then
      return jsonb_build_object(
        'documentId', v_current_id,
        'kind', v_kind,
        'status', v_current_status,
        'replacedDocumentId', null,
        'idempotent', true
      );
    end if;

    if not (v_current_status = 'rejected' or (v_current_status = 'verified' and v_current_purged_at is not null)) then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
    end if;
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'courier-docs' and name = v_storage_path
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_current_id is not null then
    update public.courier_documents
    set
      is_current = false,
      purge_after = coalesce(v_current_purge_after, now() + interval '30 days')
    where id = v_current_id;
  end if;

  insert into public.courier_documents (
    courier_id, kind, storage_path, status, is_current, rejection_code, idempotency_key, purge_after, purged_at,
    vehicle_id
  ) values (
    v_actor_id, v_kind, v_storage_path, 'submitted', true, null, v_idempotency_key, null, null, null
  )
  returning id into v_new_doc_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'resubmit_courier_required_document',
    'courier_document',
    v_new_doc_id::text,
    jsonb_build_object(
      'replaced_document_id', v_current_id,
      'kind', v_kind,
      'old_status', v_current_status,
      'old_purged', v_current_purged_at is not null
    ),
    jsonb_build_object(
      'new_document_id', v_new_doc_id,
      'kind', v_kind,
      'status', 'submitted',
      'courier_status', v_courier_rec.status
    )
  );

  return jsonb_build_object(
    'documentId', v_new_doc_id,
    'kind', v_kind,
    'status', 'submitted',
    'replacedDocumentId', v_current_id,
    'idempotent', false
  );
end;
$$;

revoke all on function public.resubmit_courier_required_document(jsonb) from public, anon;
grant execute on function public.resubmit_courier_required_document(jsonb) to authenticated;

-- 5. D4-C: conteo anónimo de aprobados que hoy no cumplen. Sin backfill ni suspensión; seguimiento en #743.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.couriers c
  where c.status = 'approved'
    and not app_private.courier_required_documents_verified(c.profile_id);

  raise notice 'CC-052: % repartidores aprobados sin los cuatro obligatorios verificados (seguimiento #743)', v_count;
end;
$$;
