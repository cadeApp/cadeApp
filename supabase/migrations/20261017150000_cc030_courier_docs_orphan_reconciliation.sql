-- CC-030 / T-370 (Issue #399): reconciliación segura de objetos huérfanos del bucket privado courier-docs.
-- Un objeto es huérfano cuando ninguna fila de public.courier_documents (vigente, histórica o purgada)
-- referencia su ruta y su última escritura supera la ventana de gracia de 7 días. La purga legítima de
-- históricos (purge_after, D8, 30 días) no cambia: esos objetos siempre tienen fila y nunca son candidatos.
--
-- Protocolo en dos fases, porque Storage no participa de la transacción de PostgreSQL:
--   1. claim_orphan_courier_documents: bajo un advisory lock por ruta, revalida que no exista fila y registra
--      un reclamo permanente. Desde ese commit ningún writer puede crear una fila con esa ruta (trigger).
--   2. El cron borra los objetos reclamados con la API de Storage y llama a
--      complete_orphan_courier_document_purge, que confirma sólo los reclamos cuyo objeto ya no existe.

-- 1. Reclamos (tabla interna, sin acceso de clientes)
create table if not exists app_private.courier_document_orphan_claims (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  object_last_write_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts >= 1),
  purged_at timestamptz
);

revoke all on table app_private.courier_document_orphan_claims from public, anon, authenticated;

create index if not exists courier_document_orphan_claims_pending_idx
  on app_private.courier_document_orphan_claims (claimed_at)
  where purged_at is null;

-- 2. Lock por ruta compartido por los writers de courier_documents y por el reclamo.
-- Clave de dos enteros con namespace propio para no colisionar con otros advisory locks.
create or replace function app_private.lock_courier_document_path(p_storage_path text, p_wait boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if p_storage_path is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_wait then
    perform pg_advisory_xact_lock(hashtext('cc030:courier-docs'), hashtext(p_storage_path));
    return true;
  end if;

  return pg_try_advisory_xact_lock(hashtext('cc030:courier-docs'), hashtext(p_storage_path));
end;
$$;

revoke all on function app_private.lock_courier_document_path(text, boolean)
  from public, anon, authenticated;

-- 3. Barrera para todo writer (submit_courier_onboarding_documents, replace_courier_document y futuros):
-- una ruta reclamada como huérfana no puede volver a quedar referenciada por una fila.
create or replace function app_private.guard_courier_document_orphan_claim()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app_private.lock_courier_document_path(new.storage_path, true);

  -- Sentencia nueva tras obtener el lock: en READ COMMITTED ve el reclamo ya confirmado.
  if exists (
    select 1
    from app_private.courier_document_orphan_claims c
    where c.storage_path = new.storage_path
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_courier_document_orphan_claim()
  from public, anon, authenticated;

drop trigger if exists courier_documents_orphan_claim_guard on public.courier_documents;
create trigger courier_documents_orphan_claim_guard
  before insert or update of storage_path on public.courier_documents
  for each row
  execute function app_private.guard_courier_document_orphan_claim();

-- 4. Fase 1: reclamar (o contar en dry-run) objetos huérfanos con lotes acotados.
create or replace function public.claim_orphan_courier_documents(
  p_limit integer default 100,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grace constant interval := interval '7 days';
  v_cutoff timestamptz := now() - v_grace;
  v_candidate record;
  v_claim_id uuid;
  v_claimed jsonb := '[]'::jsonb;
  v_candidate_count integer := 0;
  v_skipped_locked integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 or p_dry_run is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  for v_candidate in
    select
      o.name as storage_path,
      greatest(o.created_at, coalesce(o.updated_at, o.created_at)) as last_write_at
    from storage.objects o
    where o.bucket_id = 'courier-docs'
      and o.created_at is not null
      and greatest(o.created_at, coalesce(o.updated_at, o.created_at)) < v_cutoff
      and not exists (
        select 1 from public.courier_documents d where d.storage_path = o.name
      )
    order by last_write_at, o.name
    limit p_limit + 1
  loop
    v_candidate_count := v_candidate_count + 1;
    -- Se pide uno más que el límite sólo para informar hasMore.
    exit when v_candidate_count > p_limit;

    if p_dry_run then
      continue;
    end if;

    -- Sin esperar: si un writer tiene la ruta tomada, se reintenta en la próxima ejecución.
    if not app_private.lock_courier_document_path(v_candidate.storage_path, false) then
      v_skipped_locked := v_skipped_locked + 1;
      continue;
    end if;

    -- Revalidación bajo lock (sentencias nuevas, snapshot nuevo): ninguna fila y el objeto sigue viejo.
    if exists (
      select 1 from public.courier_documents d where d.storage_path = v_candidate.storage_path
    ) or not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'courier-docs'
        and o.name = v_candidate.storage_path
        and greatest(o.created_at, coalesce(o.updated_at, o.created_at)) < v_cutoff
    ) then
      continue;
    end if;

    insert into app_private.courier_document_orphan_claims as c (storage_path, object_last_write_at)
    values (v_candidate.storage_path, v_candidate.last_write_at)
    on conflict (storage_path) do update
      set claimed_at = now(),
          attempts = c.attempts + 1,
          object_last_write_at = excluded.object_last_write_at,
          purged_at = null
    returning id into v_claim_id;

    v_claimed := v_claimed || jsonb_build_array(
      jsonb_build_object('claimId', v_claim_id, 'storagePath', v_candidate.storage_path)
    );
  end loop;

  return jsonb_build_object(
    'dryRun', p_dry_run,
    'candidateCount', least(v_candidate_count, p_limit),
    'claimed', v_claimed,
    'skippedLockedCount', v_skipped_locked,
    'hasMore', v_candidate_count > p_limit
  );
end;
$$;

revoke all on function public.claim_orphan_courier_documents(integer, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_orphan_courier_documents(integer, boolean) to service_role;

-- 5. Fase 2: confirmar los reclamos cuyo objeto ya no existe. Sin argumentos a propósito: también
-- recupera reclamos de ejecuciones anteriores que borraron el objeto pero fallaron antes de confirmar.
create or replace function public.complete_orphan_courier_document_purge()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_completed integer;
  v_pending integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  with completed as (
    update app_private.courier_document_orphan_claims c
    set purged_at = now()
    where c.purged_at is null
      and not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'courier-docs' and o.name = c.storage_path
      )
    returning c.id, c.claimed_at, c.attempts, c.purged_at
  ), audited as (
    -- Auditoría sin ruta ni datos personales: la ruta queda sólo en la tabla interna de reclamos.
    insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
    select
      null,
      'orphan_storage_object_purged',
      'courier_document_orphan_claim',
      completed.id::text,
      jsonb_build_object('claimed_at', completed.claimed_at),
      jsonb_build_object('purged_at', completed.purged_at, 'attempts', completed.attempts)
    from completed
    returning 1
  )
  select count(*)::integer into v_completed from audited;

  select count(*)::integer into v_pending
  from app_private.courier_document_orphan_claims
  where purged_at is null;

  return jsonb_build_object(
    'completedCount', v_completed,
    'pendingCount', v_pending
  );
end;
$$;

revoke all on function public.complete_orphan_courier_document_purge()
  from public, anon, authenticated;
grant execute on function public.complete_orphan_courier_document_purge() to service_role;
