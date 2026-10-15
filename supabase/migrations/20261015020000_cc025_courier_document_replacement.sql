-- CC-025: Rechazo seguro y reemplazo transaccional de documentos del repartidor (T-356, Issue #363)

-- 1. Agregar columnas is_current, rejection_code e idempotency_key a courier_documents
alter table public.courier_documents
  add column if not exists is_current boolean not null default true,
  add column if not exists rejection_code text,
  add column if not exists idempotency_key text;

-- Restricción de catálogo seguro para rejection_code
alter table public.courier_documents
  drop constraint if exists courier_documents_rejection_code_check;

alter table public.courier_documents
  add constraint courier_documents_rejection_code_check
  check (
    rejection_code is null or rejection_code in (
      'illegible',
      'expired',
      'data_mismatch',
      'wrong_type',
      'incomplete',
      'other_safe'
    )
  );

-- 2. Backfill determinista de versión vigente por (courier_id, kind)
-- PR364-H06: Decision B de retención: para versiones históricas obsoletadas por el backfill,
-- purge_after = now() + 30 days (no uploaded_at) para no purgar prematuramente archivos subidos hace >30 días.
with ranked as (
  select
    id,
    row_number() over (
      partition by courier_id, kind
      order by uploaded_at desc, id desc
    ) as rn
  from public.courier_documents
)
update public.courier_documents cd
set
  is_current = (ranked.rn = 1),
  purge_after = case
    when ranked.rn > 1 and cd.purge_after is null then now() + interval '30 days'
    else cd.purge_after
  end
from ranked
where cd.id = ranked.id;

-- 3. Índices únicos parciales
-- Unicidad de versión vigente: exactamente una versión vigente por (courier_id, kind)
drop index if exists public.courier_documents_unique_current;
create unique index courier_documents_unique_current
  on public.courier_documents (courier_id, kind)
  where (is_current = true);

-- PR364-H07: Unicidad de idempotency_key por intento de reemplazo (courier_id, kind, idempotency_key)
drop index if exists public.courier_documents_unique_idempotency;
create unique index courier_documents_unique_idempotency
  on public.courier_documents (courier_id, kind, idempotency_key)
  where (idempotency_key is not null);

-- 4. RLS y permisos sobre courier_documents
-- PR364-H03: Revocar UPDATE y DELETE directos en tabla para cerrar bypass por API REST
revoke update, delete on table public.courier_documents from public, anon, authenticated;

-- PR364-H03: Eliminar política write_admin FOR ALL permisiva heredada de rls_v1
drop policy if exists courier_documents_write_admin on public.courier_documents;

-- Reemplazar select_admin: admin puede leer documentos vigentes e históricos para auditoría
drop policy if exists courier_documents_select_admin on public.courier_documents;
create policy courier_documents_select_admin on public.courier_documents
  for select to authenticated
  using (app_private.is_admin());

-- PR364-H04: Reemplazar select_self: repartidor SOLO puede consultar su documento VIGENTE (is_current = true)
drop policy if exists courier_documents_select_self on public.courier_documents;
create policy courier_documents_select_self on public.courier_documents
  for select to authenticated
  using (
    courier_id = auth.uid()
    and coalesce(is_current, true) = true
    and app_private.is_active_operational_actor()
  );

-- PR358-H01 / PR364-H05: Inserción restringida para alta inicial de onboarding
drop policy if exists courier_documents_insert_self on public.courier_documents;
create policy courier_documents_insert_self on public.courier_documents
  for insert to authenticated
  with check (
    courier_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = 'submitted'
    and coalesce(is_current, true) = true
    and rejection_code is null
    and purge_after is null
    and purged_at is null
    and not exists (
      select 1 from public.courier_documents cd
      where cd.courier_id = auth.uid()
        and cd.kind = courier_documents.kind
        and cd.is_current = true
    )
  );

-- 5. RPC pública replace_courier_document (Decisión 4C)
create or replace function public.replace_courier_document(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_kind_text text;
  v_kind public.courier_document_kind;
  v_storage_path text;
  v_idempotency_key text;
  v_current_id uuid;
  v_current_status public.document_review_status;
  v_current_storage_path text;
  v_current_purge_after timestamptz;
  v_new_doc_id uuid;
  v_profile_role text;
  v_existing_idem_id uuid;
  v_existing_idem_status public.document_review_status;
  v_existing_idem_path text;
  v_existing_idem_current boolean;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role into v_profile_role
  from public.profiles
  where id = v_actor_id;

  if v_profile_role is distinct from 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if not app_private.is_active_operational_actor() then
    raise exception using errcode = 'P0001', message = 'CONSENT_REQUIRED';
  end if;

  v_kind_text := p_payload->>'kind';
  v_storage_path := p_payload->>'storagePath';
  v_idempotency_key := nullif(trim(p_payload->>'idempotencyKey'), '');

  if v_kind_text is null or v_storage_path is null or trim(v_storage_path) = '' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_kind_text not in ('dni_front', 'dni_back', 'selfie', 'avatar', 'license', 'insurance') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_kind := v_kind_text::public.courier_document_kind;

  -- Validar pertenencia canónica del path: courier/<v_actor_id>/<v_kind>_*
  if v_storage_path not like ('courier/' || v_actor_id::text || '/' || v_kind_text || '_%')
     or v_storage_path like '%..%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- PR364-H07: Validar formato UUID de idempotencyKey si fue provista
  if v_idempotency_key is not null then
    if v_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  end if;

  -- PR364-H02: Lock ordenado unificado en todo el sistema: 1. couriers
  perform 1 from public.couriers
  where profile_id = v_actor_id
  for update;

  -- PR364-H07: Comprobar idempotencia persistida por idempotency_key
  if v_idempotency_key is not null then
    select id, status, storage_path, is_current
    into v_existing_idem_id, v_existing_idem_status, v_existing_idem_path, v_existing_idem_current
    from public.courier_documents
    where courier_id = v_actor_id
      and kind = v_kind
      and idempotency_key = v_idempotency_key;

    if found then
      -- Misma clave con path diferente -> VALIDATION_ERROR
      if v_existing_idem_path <> v_storage_path then
        raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
      end if;

      -- Retorno idempotente sin duplicar auditoría ni filas
      return jsonb_build_object(
        'documentId', v_existing_idem_id,
        'kind', v_kind,
        'status', v_existing_idem_status,
        'replacedDocumentId', null,
        'isCurrent', v_existing_idem_current,
        'idempotent', true
      );
    end if;
  end if;

  -- PR364-H02: Lock ordenado unificado en todo el sistema: 2. courier_documents vigente
  select id, status, storage_path, purge_after
  into v_current_id, v_current_status, v_current_storage_path, v_current_purge_after
  from public.courier_documents
  where courier_id = v_actor_id
    and kind = v_kind
    and is_current = true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- Idempotencia ante reintento con mismo path sobre documento ya promovido (fallback sin idempotencyKey)
  if v_current_status = 'submitted' and v_current_storage_path = v_storage_path then
    return jsonb_build_object(
      'documentId', v_current_id,
      'kind', v_kind,
      'status', v_current_status,
      'replacedDocumentId', null,
      'isCurrent', true,
      'idempotent', true
    );
  end if;

  -- Solo se permite reemplazar un documento en estado 'rejected'
  if v_current_status <> 'rejected' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- PR364-H01: Verificación INCONDICIONAL del objeto en storage.objects
  -- Falla con NOT_FOUND aunque el bucket esté completamente vacío si el objeto no existe
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'courier-docs' and name = v_storage_path
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- Desactivar documento rechazado anterior (retención 30 días tras reemplazo, D8 / Decisión B)
  update public.courier_documents
  set
    is_current = false,
    purge_after = coalesce(v_current_purge_after, now() + interval '30 days')
  where id = v_current_id;

  -- Insertar nueva versión vigente
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
  returning id into v_new_doc_id;

  -- Sincronizar en couriers para license o insurance
  if v_kind = 'license' then
    update public.couriers
    set license_status = 'submitted'
    where profile_id = v_actor_id;
  elsif v_kind = 'insurance' then
    update public.couriers
    set insurance_status = 'submitted'
    where profile_id = v_actor_id;
  end if;

  -- Auditoría inmutable sin PII
  insert into public.audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    before,
    after
  ) values (
    v_actor_id,
    'replace_courier_document',
    'courier_document',
    v_new_doc_id::text,
    jsonb_build_object(
      'replaced_document_id', v_current_id,
      'kind', v_kind,
      'old_status', v_current_status
    ),
    jsonb_build_object(
      'new_document_id', v_new_doc_id,
      'kind', v_kind,
      'status', 'submitted',
      'is_current', true,
      'idempotency_key', v_idempotency_key
    )
  );

  return jsonb_build_object(
    'documentId', v_new_doc_id,
    'kind', v_kind,
    'status', 'submitted',
    'replacedDocumentId', v_current_id,
    'isCurrent', true,
    'idempotent', false
  );
end;
$$;

revoke all on function public.replace_courier_document(jsonb) from public, anon;
grant execute on function public.replace_courier_document(jsonb) to authenticated;

-- 6. Actualizar admin_verify_document para validar vigencia, persistir rejection_code y unificar locks
drop function if exists public.admin_verify_document(uuid, text, text);

create or replace function public.admin_verify_document(
  p_document_id uuid,
  p_decision text,
  p_reason text default null,
  p_rejection_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_courier_id uuid;
  v_kind public.courier_document_kind;
  v_doc_status public.document_review_status;
  v_purged_at timestamptz;
  v_is_current boolean;
  v_target_status public.document_review_status;
  v_doc_level integer;
  v_effective_code text;
begin
  perform app_private.assert_admin_aal2();

  if p_decision not in ('verified', 'rejected') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_decision = 'rejected' and (p_reason is null or trim(p_reason) = '') then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  -- PR364-H02: Identificar courier_id primero para adquirir locks en orden consistente
  select courier_id into v_courier_id
  from public.courier_documents
  where id = p_document_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- PR364-H02: Lock ordenado unificado: 1. couriers
  perform 1 from public.couriers
  where profile_id = v_courier_id
  for update;

  -- PR364-H02: Lock ordenado unificado: 2. courier_documents (revalidando bajo lock)
  select kind, status, purged_at, is_current
  into v_kind, v_doc_status, v_purged_at, v_is_current
  from public.courier_documents
  where id = p_document_id
    and courier_id = v_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- PR358-H02: Admin no puede decidir sobre un documento obsoleto
  if not coalesce(v_is_current, true) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  if v_doc_status <> 'submitted' or v_purged_at is not null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  v_target_status := p_decision::public.document_review_status;

  if p_decision = 'rejected' then
    v_effective_code := coalesce(nullif(trim(p_rejection_code), ''), 'other_safe');
    if v_effective_code not in ('illegible', 'expired', 'data_mismatch', 'wrong_type', 'incomplete', 'other_safe') then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    update public.courier_documents
    set
      status = v_target_status,
      rejection_code = v_effective_code
    where id = p_document_id;
  else
    v_effective_code := null;
    update public.courier_documents
    set
      status = v_target_status,
      rejection_code = null
    where id = p_document_id;
  end if;

  if v_kind = 'license' then
    update public.couriers
    set license_status = v_target_status
    where profile_id = v_courier_id;
  elsif v_kind = 'insurance' then
    update public.couriers
    set insurance_status = v_target_status
    where profile_id = v_courier_id;
  end if;

  select doc_level into v_doc_level
  from public.couriers
  where profile_id = v_courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_verify_document',
    'courier_document',
    p_document_id::text,
    jsonb_build_object('status', v_doc_status, 'kind', v_kind, 'courier_id', v_courier_id),
    jsonb_build_object(
      'status', v_target_status,
      'reason', p_reason,
      'rejection_code', v_effective_code,
      'docLevel', coalesce(v_doc_level, 0)
    )
  );

  return jsonb_build_object(
    'documentId', p_document_id,
    'courierId', v_courier_id,
    'kind', v_kind,
    'status', v_target_status,
    'rejectionCode', v_effective_code,
    'docLevel', coalesce(v_doc_level, 0)
  );
end;
$$;

revoke all on function public.admin_verify_document(uuid, text, text, text) from public, anon;
grant execute on function public.admin_verify_document(uuid, text, text, text) to authenticated;
