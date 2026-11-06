-- CC-042 / T-419: varios vehículos por repartidor, con licencia y seguro propios, y un vehículo activo.
--
-- Las columnas vehicle_type, vehicle_plate, license_status e insurance_status de couriers pasan a ser un reflejo del
-- vehículo activo: solo las escriben las RPC de este archivo, admin_verify_document y finalize_courier_application.
-- Los lectores actuales (ofertas, viaje, prioridad, admin, doc_level) siguen leyendo couriers sin cambios.
--
-- Reconciliación con CC-043 (posterior a CC-042): el vehículo del alta lo crea finalize_courier_application, que es
-- la que guarda el vehículo de la postulación; las RPC de vehículos son para después del envío. Si una RPC de
-- documentos no recibe vehicleId para licencia o seguro, usa el vehículo activo (la app anterior sigue andando
-- entre la migración y el deploy). El vehículo viaja en `p_payload.vehicleId`: las firmas de las RPC de documentos no
-- cambian (sin sobrecargas ni grants nuevos).

-- ============================================================================
-- 1. Modelo
-- ============================================================================

create table public.courier_vehicles (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers (profile_id) on delete cascade,
  vehicle_type public.vehicle_type not null,
  plate text,
  license_status public.document_review_status not null default 'none',
  insurance_status public.document_review_status not null default 'none',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  -- La patente obligatoria para moto y auto la exigen las RPC; acá solo se impide en bici y a pie (hay datos viejos
  -- de moto sin patente que el backfill tiene que poder copiar).
  constraint courier_vehicles_plate_by_type check (vehicle_type in ('moto', 'car') or plate is null),
  constraint courier_vehicles_documents_by_type check (
    vehicle_type in ('moto', 'car') or (license_status = 'none' and insurance_status = 'none')
  )
);

-- Un vehículo vigente por tipo y por repartidor (moto y bici sí; dos motos no).
create unique index courier_vehicles_one_per_type
  on public.courier_vehicles (courier_id, vehicle_type)
  where archived_at is null;

create index courier_vehicles_courier_idx on public.courier_vehicles (courier_id);

alter table public.couriers
  add column active_vehicle_id uuid references public.courier_vehicles (id);

alter table public.courier_documents
  add column vehicle_id uuid references public.courier_vehicles (id);

alter table public.courier_documents
  add constraint courier_documents_vehicle_only_for_vehicle_kinds
  check (vehicle_id is null or kind in ('license', 'insurance'));

create index courier_documents_vehicle_idx on public.courier_documents (vehicle_id) where vehicle_id is not null;

-- Un documento vigente por repartidor, tipo y vehículo (antes: por repartidor y tipo). Los documentos sin vehículo
-- (DNI, selfie, avatar y los de licencia o seguro sin vehículo) comparten la clave nula.
drop index if exists public.courier_documents_unique_current;
create unique index courier_documents_unique_current
  on public.courier_documents (
    courier_id,
    kind,
    coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where (is_current = true);

-- ============================================================================
-- 2. Consistencia
-- ============================================================================

-- El vehículo activo es del mismo repartidor y no está archivado.
create or replace function app_private.cc042_guard_active_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.active_vehicle_id is not null and not exists (
    select 1
    from public.courier_vehicles v
    where v.id = new.active_vehicle_id
      and v.courier_id = new.profile_id
      and v.archived_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  return new;
end;
$$;

revoke all on function app_private.cc042_guard_active_vehicle() from public, anon, authenticated;

create trigger couriers_cc042_active_vehicle
  before insert or update of active_vehicle_id on public.couriers
  for each row execute function app_private.cc042_guard_active_vehicle();

-- El vehículo de un documento es del mismo repartidor.
create or replace function app_private.cc042_guard_document_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.vehicle_id is not null and not exists (
    select 1 from public.courier_vehicles v where v.id = new.vehicle_id and v.courier_id = new.courier_id
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  return new;
end;
$$;

revoke all on function app_private.cc042_guard_document_vehicle() from public, anon, authenticated;

create trigger courier_documents_cc042_vehicle
  before insert or update of vehicle_id, courier_id on public.courier_documents
  for each row execute function app_private.cc042_guard_document_vehicle();

-- No se archiva el vehículo activo (además del chequeo de remove_courier_vehicle).
create or replace function app_private.cc042_guard_vehicle_archive()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.archived_at is not null and old.archived_at is null and exists (
    select 1 from public.couriers c where c.profile_id = new.courier_id and c.active_vehicle_id = new.id
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;
  return new;
end;
$$;

revoke all on function app_private.cc042_guard_vehicle_archive() from public, anon, authenticated;

create trigger courier_vehicles_cc042_archive
  before update of archived_at on public.courier_vehicles
  for each row execute function app_private.cc042_guard_vehicle_archive();

-- PR624-H03 (D01=A): vehículo y patente con que se envió la postulación. Es un hecho histórico, separado del reflejo
-- mutable (vehicle_type/vehicle_plate): los reintentos de finalize_courier_application se comparan contra esto.
alter table public.couriers
  add column application_vehicle_type public.vehicle_type,
  add column application_vehicle_plate text;

-- Solo finalize (primer envío) y el backfill de esta migración lo escriben, con su bandera y siendo el dueño de la
-- función (mismo criterio que couriers_guard_application de CC-043); una vez escrito no cambia más.
create or replace function app_private.cc042_guard_application_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_authorized boolean :=
    coalesce(current_setting('app.courier_application_snapshot', true), '') = 'on'
    and current_user = (
      select pg_get_userbyid(p.proowner)
      from pg_proc p
      where p.oid = 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)'::regprocedure
    );
begin
  if tg_op = 'INSERT' then
    if new.application_vehicle_type is not null or new.application_vehicle_plate is not null then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    return new;
  end if;

  if new.application_vehicle_type is distinct from old.application_vehicle_type
    or new.application_vehicle_plate is distinct from old.application_vehicle_plate then
    if not v_authorized or old.application_vehicle_type is not null or new.application_vehicle_type is null then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.cc042_guard_application_snapshot() from public, anon, authenticated;

-- ============================================================================
-- 3. RLS y permisos
-- ============================================================================

alter table public.courier_vehicles enable row level security;

create policy courier_vehicles_select_self on public.courier_vehicles
  for select to authenticated
  using (courier_id = auth.uid() and app_private.is_active_operational_actor());

create policy courier_vehicles_select_admin on public.courier_vehicles
  for select to authenticated
  using (app_private.is_admin());

revoke all on table public.courier_vehicles from public, anon, authenticated;
grant select on table public.courier_vehicles to authenticated;

-- couriers_update_self suma las columnas del vehículo a las congeladas: el vehículo se cambia solo por RPC.
drop policy if exists couriers_update_self on public.couriers;
create policy couriers_update_self on public.couriers
  for update to authenticated
  using (profile_id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    profile_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = (select c.status from public.couriers c where c.profile_id = auth.uid())
    and dni_hmac is not distinct from (select c.dni_hmac from public.couriers c where c.profile_id = auth.uid())
    and license_status = (select c.license_status from public.couriers c where c.profile_id = auth.uid())
    and insurance_status = (select c.insurance_status from public.couriers c where c.profile_id = auth.uid())
    and decided_by is not distinct from (select c.decided_by from public.couriers c where c.profile_id = auth.uid())
    and decided_at is not distinct from (select c.decided_at from public.couriers c where c.profile_id = auth.uid())
    and deactivated_at is not distinct from (select c.deactivated_at from public.couriers c where c.profile_id = auth.uid())
    and vehicle_type is not distinct from (select c.vehicle_type from public.couriers c where c.profile_id = auth.uid())
    and vehicle_plate is not distinct from (select c.vehicle_plate from public.couriers c where c.profile_id = auth.uid())
    and active_vehicle_id is not distinct from (select c.active_vehicle_id from public.couriers c where c.profile_id = auth.uid())
    and application_vehicle_type is not distinct from (select c.application_vehicle_type from public.couriers c where c.profile_id = auth.uid())
    and application_vehicle_plate is not distinct from (select c.application_vehicle_plate from public.couriers c where c.profile_id = auth.uid())
  );

-- ============================================================================
-- 4. Backfill: el vehículo actual de cada repartidor pasa a ser su vehículo activo
-- ============================================================================

-- Función interna e idempotente (solo toca repartidores con vehículo y sin vehículo activo) para que el pgTAP pueda
-- probarla: en CI la base está vacía cuando corre la migración.
create or replace function app_private.cc042_backfill_courier_vehicles()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created integer;
begin
  -- PR624-H03: el vehículo de la postulación ya enviada, antes de que cambie el activo.
  perform set_config('app.courier_application_snapshot', 'on', true);
  update public.couriers
  set application_vehicle_type = vehicle_type,
      application_vehicle_plate = nullif(upper(btrim(vehicle_plate)), '')
  where application_submitted
    and application_vehicle_type is null
    and vehicle_type is not null;
  perform set_config('app.courier_application_snapshot', 'off', true);

  insert into public.courier_vehicles (courier_id, vehicle_type, plate, license_status, insurance_status)
  select
    c.profile_id,
    c.vehicle_type,
    case when c.vehicle_type in ('moto', 'car') then nullif(upper(btrim(c.vehicle_plate)), '') end,
    case when c.vehicle_type in ('moto', 'car') then c.license_status else 'none' end,
    case when c.vehicle_type in ('moto', 'car') then c.insurance_status else 'none' end
  from public.couriers c
  where c.vehicle_type is not null
    and c.active_vehicle_id is null
    and not exists (
      select 1 from public.courier_vehicles v
      where v.courier_id = c.profile_id and v.vehicle_type = c.vehicle_type and v.archived_at is null
    );

  -- Licencia y seguro (también las versiones históricas, para la auditoría) quedan en ese vehículo.
  update public.courier_documents d
  set vehicle_id = v.id
  from public.couriers c
  join public.courier_vehicles v
    on v.courier_id = c.profile_id and v.vehicle_type = c.vehicle_type and v.archived_at is null
  where c.active_vehicle_id is null
    and v.vehicle_type in ('moto', 'car')
    and d.courier_id = c.profile_id
    and d.kind in ('license', 'insurance')
    and d.vehicle_id is null;

  -- Se marca el activo: en moto o auto el reflejo ya tiene esos valores.
  update public.couriers c
  set active_vehicle_id = v.id
  from public.courier_vehicles v
  where v.courier_id = c.profile_id
    and v.vehicle_type = c.vehicle_type
    and v.archived_at is null
    and c.active_vehicle_id is null;

  get diagnostics v_created = row_count;

  -- PR624-H02: en bici o a pie el reflejo no conserva una licencia o un seguro viejos (doc_level sigue al activo). Los
  -- documentos quedan para la auditoría, sin vehículo.

  return v_created;
end;
$$;

revoke all on function app_private.cc042_backfill_courier_vehicles() from public, anon, authenticated;

select app_private.cc042_backfill_courier_vehicles();

-- El guard va después del backfill de la migración (que corre con la bandera, pero así no depende del orden).
create trigger couriers_guard_application_snapshot
  before insert or update on public.couriers
  for each row execute function app_private.cc042_guard_application_snapshot();

-- ============================================================================
-- 5. Ayudantes internos (sin execute para clientes)
-- ============================================================================

-- Valida al repartidor que administra sus vehículos y toma el lock de couriers (primero couriers, igual que
-- submit_offer, take_request y accept_offer). Exige postulación enviada y estado pending o approved.
create or replace function app_private.cc042_lock_vehicle_owner(p_actor uuid)
returns public.couriers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.profile_role;
  v_consent public.consent_status;
  v_courier public.couriers;
begin
  if p_actor is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent from public.profiles where id = p_actor;
  if v_role is distinct from 'courier' or v_consent is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  select * into v_courier from public.couriers where profile_id = p_actor for update;
  if not found or v_courier.status::text in ('rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if not v_courier.application_submitted then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- Revalida perfil y consentimiento bajo el lock.
  select role, consent_status into v_role, v_consent from public.profiles where id = p_actor for share;
  if v_role is distinct from 'courier' or v_consent is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  return v_courier;
end;
$$;

revoke all on function app_private.cc042_lock_vehicle_owner(uuid) from public, anon, authenticated;

-- Ofertas pendientes vigentes o un viaje activo: el comercio eligió viendo un vehículo y una patente.
create or replace function app_private.cc042_vehicle_switch_blocked(p_courier uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.offers o
    join public.delivery_requests r on r.id = o.request_id
    where o.courier_id = p_courier
      and o.status = 'pending'
      and r.status = 'published'
      and (r.expires_at is null or r.expires_at > now())
  ) or exists (
    select 1
    from public.delivery_requests r
    join public.offers o on o.id = r.accepted_offer_id
    where o.courier_id = p_courier
      and r.status in ('matched', 'in_transit')
  );
$$;

revoke all on function app_private.cc042_vehicle_switch_blocked(uuid) from public, anon, authenticated;

-- Copia el vehículo activo a las columnas de couriers.
create or replace function app_private.cc042_sync_courier_reflection(p_courier uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.couriers c
  set vehicle_type = v.vehicle_type,
      vehicle_plate = v.plate,
      license_status = v.license_status,
      insurance_status = v.insurance_status
  from public.courier_vehicles v
  where v.id = c.active_vehicle_id
    and c.profile_id = p_courier;
$$;

revoke all on function app_private.cc042_sync_courier_reflection(uuid) from public, anon, authenticated;

-- Patente normalizada y validada por tipo. Devuelve null para bici y a pie.
create or replace function app_private.cc042_normalize_plate(p_vehicle_type public.vehicle_type, p_plate text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_plate text := nullif(upper(btrim(p_plate)), '');
begin
  if p_vehicle_type in ('moto', 'car') then
    if v_plate is null
      or v_plate !~ '^([A-Z]{2}\s?[0-9]{3}\s?[A-Z]{2}|[A-Z]\s?[0-9]{3}\s?[A-Z]{3}|[A-Z]{3}\s?[0-9]{3}|[0-9]{3}\s?[A-Z]{3})$' then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    return v_plate;
  end if;

  if v_plate is not null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  return null;
end;
$$;

revoke all on function app_private.cc042_normalize_plate(public.vehicle_type, text) from public, anon, authenticated;

-- ============================================================================
-- 6. RPC de vehículos
-- ============================================================================

create or replace function public.get_my_courier_vehicles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.profile_role;
  v_consent public.consent_status;
  v_courier public.couriers;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select role, consent_status into v_role, v_consent from public.profiles where id = v_actor;
  if v_role is distinct from 'courier' or v_consent is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  select * into v_courier from public.couriers where profile_id = v_actor;
  if not found or v_courier.status::text in ('rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  return jsonb_build_object(
    'activeVehicleId', v_courier.active_vehicle_id,
    'vehicles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'vehicleType', v.vehicle_type,
          'plate', v.plate,
          'licenseStatus', v.license_status,
          'insuranceStatus', v.insurance_status
        )
        order by v.created_at, v.id
      )
      from public.courier_vehicles v
      where v.courier_id = v_actor
        and v.archived_at is null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_courier_vehicles() from public, anon, authenticated;
grant execute on function public.get_my_courier_vehicles() to authenticated;

create or replace function public.add_courier_vehicle(
  p_vehicle_type public.vehicle_type,
  p_plate text,
  p_make_active boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_courier public.couriers;
  v_plate text;
  v_vehicle_id uuid;
  v_activate boolean;
begin
  v_courier := app_private.cc042_lock_vehicle_owner(v_actor);

  if p_vehicle_type is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  v_plate := app_private.cc042_normalize_plate(p_vehicle_type, p_plate);

  if exists (
    select 1 from public.courier_vehicles
    where courier_id = v_actor and vehicle_type = p_vehicle_type and archived_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_VEHICLE';
  end if;

  v_activate := coalesce(p_make_active, false) or v_courier.active_vehicle_id is null;
  if v_activate and v_courier.active_vehicle_id is not null and app_private.cc042_vehicle_switch_blocked(v_actor) then
    raise exception using errcode = 'P0001', message = 'VEHICLE_SWITCH_BLOCKED';
  end if;

  insert into public.courier_vehicles (courier_id, vehicle_type, plate)
  values (v_actor, p_vehicle_type, v_plate)
  returning id into v_vehicle_id;

  if v_activate then
    update public.couriers set active_vehicle_id = v_vehicle_id where profile_id = v_actor;
    perform app_private.cc042_sync_courier_reflection(v_actor);
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor,
    'add_courier_vehicle',
    'courier_vehicle',
    v_vehicle_id::text,
    jsonb_build_object('active_vehicle_id', v_courier.active_vehicle_id),
    jsonb_build_object('vehicle_type', p_vehicle_type, 'active', v_activate)
  );

  return jsonb_build_object('vehicleId', v_vehicle_id);
end;
$$;

revoke all on function public.add_courier_vehicle(public.vehicle_type, text, boolean) from public, anon, authenticated;
grant execute on function public.add_courier_vehicle(public.vehicle_type, text, boolean) to authenticated;

create or replace function public.update_courier_vehicle(p_vehicle_id uuid, p_plate text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_courier public.couriers;
  v_vehicle public.courier_vehicles;
  v_plate text;
  v_is_active boolean;
begin
  v_courier := app_private.cc042_lock_vehicle_owner(v_actor);

  select * into v_vehicle
  from public.courier_vehicles
  where id = p_vehicle_id and courier_id = v_actor and archived_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  v_plate := app_private.cc042_normalize_plate(v_vehicle.vehicle_type, p_plate);
  if v_plate is not distinct from v_vehicle.plate then
    return jsonb_build_object('vehicleId', v_vehicle.id);
  end if;

  v_is_active := v_courier.active_vehicle_id = v_vehicle.id;
  if v_is_active and app_private.cc042_vehicle_switch_blocked(v_actor) then
    raise exception using errcode = 'P0001', message = 'VEHICLE_SWITCH_BLOCKED';
  end if;

  -- El seguro es de esa patente: vuelve a cargarse (la licencia es del repartidor y se conserva).
  update public.courier_documents
  set is_current = false,
      purge_after = coalesce(purge_after, now() + interval '30 days')
  where courier_id = v_actor
    and vehicle_id = v_vehicle.id
    and kind = 'insurance'
    and is_current = true;

  update public.courier_vehicles
  set plate = v_plate,
      insurance_status = 'none'
  where id = v_vehicle.id;

  if v_is_active then
    perform app_private.cc042_sync_courier_reflection(v_actor);
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor,
    'update_courier_vehicle',
    'courier_vehicle',
    v_vehicle.id::text,
    jsonb_build_object('insurance_status', v_vehicle.insurance_status),
    jsonb_build_object('plate_changed', true, 'insurance_status', 'none')
  );

  return jsonb_build_object('vehicleId', v_vehicle.id);
end;
$$;

revoke all on function public.update_courier_vehicle(uuid, text) from public, anon, authenticated;
grant execute on function public.update_courier_vehicle(uuid, text) to authenticated;

create or replace function public.remove_courier_vehicle(p_vehicle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_courier public.couriers;
  v_vehicle public.courier_vehicles;
begin
  v_courier := app_private.cc042_lock_vehicle_owner(v_actor);

  select * into v_vehicle
  from public.courier_vehicles
  where id = p_vehicle_id and courier_id = v_actor and archived_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_courier.active_vehicle_id = v_vehicle.id then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  update public.courier_vehicles set archived_at = now() where id = v_vehicle.id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor,
    'remove_courier_vehicle',
    'courier_vehicle',
    v_vehicle.id::text,
    jsonb_build_object('vehicle_type', v_vehicle.vehicle_type),
    jsonb_build_object('archived', true)
  );

  return jsonb_build_object('vehicleId', v_vehicle.id);
end;
$$;

revoke all on function public.remove_courier_vehicle(uuid) from public, anon, authenticated;
grant execute on function public.remove_courier_vehicle(uuid) to authenticated;

create or replace function public.set_active_courier_vehicle(p_vehicle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_courier public.couriers;
  v_vehicle public.courier_vehicles;
begin
  v_courier := app_private.cc042_lock_vehicle_owner(v_actor);

  select * into v_vehicle
  from public.courier_vehicles
  where id = p_vehicle_id and courier_id = v_actor and archived_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- Ya activo: OK sin cambios ni auditoría.
  if v_courier.active_vehicle_id = v_vehicle.id then
    return jsonb_build_object('activeVehicleId', v_vehicle.id);
  end if;

  if app_private.cc042_vehicle_switch_blocked(v_actor) then
    raise exception using errcode = 'P0001', message = 'VEHICLE_SWITCH_BLOCKED';
  end if;

  update public.couriers set active_vehicle_id = v_vehicle.id where profile_id = v_actor;
  perform app_private.cc042_sync_courier_reflection(v_actor);

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor,
    'set_active_courier_vehicle',
    'courier',
    v_actor::text,
    jsonb_build_object('active_vehicle_id', v_courier.active_vehicle_id),
    jsonb_build_object('active_vehicle_id', v_vehicle.id, 'vehicle_type', v_vehicle.vehicle_type)
  );

  return jsonb_build_object('activeVehicleId', v_vehicle.id);
end;
$$;

revoke all on function public.set_active_courier_vehicle(uuid) from public, anon, authenticated;
grant execute on function public.set_active_courier_vehicle(uuid) to authenticated;

-- ============================================================================
-- 7. Documentos por vehículo
-- ============================================================================

-- Resuelve el vehículo de un documento de licencia o seguro: el pedido o, si no viene, el activo. Devuelve null si el
-- repartidor todavía no tiene vehículos (datos anteriores a CC-042): el documento queda sin vehículo, como antes.
create or replace function app_private.cc042_document_vehicle(
  p_actor uuid,
  p_requested uuid,
  p_active uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_vehicle public.courier_vehicles;
begin
  if p_requested is null and p_active is null then
    return null;
  end if;

  select * into v_vehicle
  from public.courier_vehicles
  where id = coalesce(p_requested, p_active)
    and courier_id = p_actor
    and archived_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_vehicle.vehicle_type not in ('moto', 'car') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  return v_vehicle.id;
end;
$$;

revoke all on function app_private.cc042_document_vehicle(uuid, uuid, uuid) from public, anon, authenticated;

-- `vehicleId` opcional del payload de las RPC de documentos: ausente o null = el activo; si viene, un uuid en texto.
create or replace function app_private.cc042_payload_vehicle_id(p_payload jsonb)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_payload is null or not (p_payload ? 'vehicleId') or jsonb_typeof(p_payload->'vehicleId') = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_payload->'vehicleId') <> 'string'
     or (p_payload->>'vehicleId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  return (p_payload->>'vehicleId')::uuid;
end;
$$;

revoke all on function app_private.cc042_payload_vehicle_id(jsonb) from public, anon, authenticated;

-- Marca el estado de licencia o seguro en el vehículo (o en couriers si el documento no tiene vehículo) y actualiza el
-- reflejo si es el activo.
create or replace function app_private.cc042_set_vehicle_document_status(
  p_courier uuid,
  p_vehicle uuid,
  p_kind public.courier_document_kind,
  p_status public.document_review_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_kind not in ('license', 'insurance') then
    return;
  end if;

  if p_vehicle is null then
    if p_kind = 'license' then
      update public.couriers set license_status = p_status where profile_id = p_courier;
    else
      update public.couriers set insurance_status = p_status where profile_id = p_courier;
    end if;
    return;
  end if;

  if p_kind = 'license' then
    update public.courier_vehicles set license_status = p_status where id = p_vehicle;
  else
    update public.courier_vehicles set insurance_status = p_status where id = p_vehicle;
  end if;

  if exists (select 1 from public.couriers where profile_id = p_courier and active_vehicle_id = p_vehicle) then
    perform app_private.cc042_sync_courier_reflection(p_courier);
  end if;
end;
$$;

revoke all on function app_private.cc042_set_vehicle_document_status(uuid, uuid, public.courier_document_kind, public.document_review_status)
  from public, anon, authenticated;

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
  v_courier_rec record;
  v_requested_vehicle uuid;
  v_vehicle_id uuid;
  v_existing_id uuid;
  v_existing_status public.document_review_status;
  v_existing_path text;
  v_existing_current boolean;
  v_existing_vehicle uuid;
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

  v_requested_vehicle := app_private.cc042_payload_vehicle_id(p_payload);

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

  select profile_id, status, vehicle_type, active_vehicle_id into v_courier_rec
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

  -- CC-042: el documento es de un vehículo propio, vigente, moto o auto (el pedido o el activo).
  v_vehicle_id := app_private.cc042_document_vehicle(v_actor_id, v_requested_vehicle, v_courier_rec.active_vehicle_id);

  if v_idempotency_key_text is not null then
    select id, status, storage_path, is_current, vehicle_id
    into v_existing_id, v_existing_status, v_existing_path, v_existing_current, v_existing_vehicle
    from public.courier_documents
    where courier_id = v_actor_id
      and kind = v_kind
      and idempotency_key = v_idempotency_key_text;

    if found then
      -- PR624-H04: la misma clave para otro vehículo no es un reintento.
      if v_existing_path <> v_storage_path or v_existing_vehicle is distinct from v_vehicle_id then
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
    and vehicle_id is not distinct from v_vehicle_id
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
    purged_at,
    vehicle_id
  ) values (
    v_actor_id,
    v_kind,
    v_storage_path,
    'submitted',
    true,
    null,
    v_idempotency_key_text,
    null,
    null,
    v_vehicle_id
  )
  returning id into v_document_id;

  perform app_private.cc042_set_vehicle_document_status(v_actor_id, v_vehicle_id, v_kind, 'submitted');

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
      'idempotency_key', v_idempotency_key_text,
      'vehicle_id', v_vehicle_id
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

revoke all on function public.add_courier_optional_document(jsonb) from public, anon, authenticated;
grant execute on function public.add_courier_optional_document(jsonb) to authenticated;

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
  v_expected_prefix text;
  v_storage_suffix text;
  v_idempotency_key text;
  v_current_id uuid;
  v_current_status public.document_review_status;
  v_current_storage_path text;
  v_current_purge_after timestamptz;
  v_new_doc_id uuid;
  v_profile_role text;
  v_consent_status text;
  v_courier_rec record;
  v_requested_vehicle uuid;
  v_vehicle_id uuid;
  v_existing_idem_id uuid;
  v_existing_idem_status public.document_review_status;
  v_existing_idem_path text;
  v_existing_idem_current boolean;
  v_existing_idem_vehicle uuid;
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

  if v_kind_text is null or v_storage_path is null or trim(v_storage_path) = '' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_kind_text not in ('dni_front', 'dni_back', 'selfie', 'avatar', 'license', 'insurance') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- CC-042: solo licencia y seguro son de un vehículo.
  v_requested_vehicle := app_private.cc042_payload_vehicle_id(p_payload);
  if v_requested_vehicle is not null and v_kind_text not in ('license', 'insurance') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_kind := v_kind_text::public.courier_document_kind;

  v_expected_prefix := 'courier/' || v_actor_id::text || '/' || v_kind_text || '_';

  if left(v_storage_path, length(v_expected_prefix)) <> v_expected_prefix
     or v_storage_path like '%..%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  v_storage_suffix := substr(v_storage_path, length(v_expected_prefix) + 1);

  if v_storage_suffix !~* '^[0-9]+[.](png|jpe?g|webp|pdf)$'
     or v_storage_suffix like '%/%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_idempotency_key is not null then
    if v_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  end if;

  select profile_id, status, active_vehicle_id into v_courier_rec
  from public.couriers
  where profile_id = v_actor_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_courier_rec.status::text in ('rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  select role, consent_status into v_profile_role, v_consent_status
  from public.profiles
  where id = v_actor_id
  for share;

  if not found or v_profile_role is distinct from 'courier' or v_consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_kind in ('license', 'insurance') then
    v_vehicle_id := app_private.cc042_document_vehicle(v_actor_id, v_requested_vehicle, v_courier_rec.active_vehicle_id);
  end if;

  if v_idempotency_key is not null then
    select id, status, storage_path, is_current, vehicle_id
    into v_existing_idem_id, v_existing_idem_status, v_existing_idem_path, v_existing_idem_current, v_existing_idem_vehicle
    from public.courier_documents
    where courier_id = v_actor_id
      and kind = v_kind
      and idempotency_key = v_idempotency_key;

    if found then
      -- PR624-H04: la misma clave para otro vehículo no es un reintento.
      if v_existing_idem_path <> v_storage_path or v_existing_idem_vehicle is distinct from v_vehicle_id then
        raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
      end if;

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

  select id, status, storage_path, purge_after
  into v_current_id, v_current_status, v_current_storage_path, v_current_purge_after
  from public.courier_documents
  where courier_id = v_actor_id
    and kind = v_kind
    and vehicle_id is not distinct from v_vehicle_id
    and is_current = true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

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

  if v_current_status <> 'rejected' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'courier-docs' and name = v_storage_path
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  update public.courier_documents
  set
    is_current = false,
    purge_after = coalesce(v_current_purge_after, now() + interval '30 days')
  where id = v_current_id;

  insert into public.courier_documents (
    courier_id,
    kind,
    storage_path,
    status,
    is_current,
    rejection_code,
    idempotency_key,
    purge_after,
    purged_at,
    vehicle_id
  ) values (
    v_actor_id,
    v_kind,
    v_storage_path,
    'submitted',
    true,
    null,
    v_idempotency_key,
    null,
    null,
    v_vehicle_id
  )
  returning id into v_new_doc_id;

  perform app_private.cc042_set_vehicle_document_status(v_actor_id, v_vehicle_id, v_kind, 'submitted');

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
      'idempotency_key', v_idempotency_key,
      'vehicle_id', v_vehicle_id
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

-- El onboarding asocia la licencia y el seguro al vehículo activo si ya existe (reintento después del envío). En el
-- primer envío todavía no hay vehículo: finalize_courier_application los asocia al crearlo.
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
  v_vehicle_doc_target uuid;
  v_doc_vehicle uuid;
begin
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

  select profile_id, status, vehicle_type, active_vehicle_id into v_courier_rec
  from public.couriers
  where profile_id = v_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_courier_rec.status::text in ('rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

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

  -- Licencia y seguro van al vehículo activo si es moto o auto; si no hay, quedan sin vehículo.
  select v.id into v_vehicle_doc_target
  from public.courier_vehicles v
  where v.id = v_courier_rec.active_vehicle_id
    and v.vehicle_type in ('moto', 'car');

  for v_duplicate_check in
    select kind, vehicle_id, count(*) as cnt
    from public.courier_documents
    where courier_id = v_courier_id
      and coalesce(is_current, true) = true
    group by kind, vehicle_id
    having count(*) > 1
  loop
    raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
  end loop;

  for v_doc_elem in select * from jsonb_array_elements(p_documents)
  loop
    v_kind_text := trim(v_doc_elem->>'kind');
    v_kind := v_kind_text::public.courier_document_kind;
    v_storage_path := trim(v_doc_elem->>'storage_path');
    v_doc_vehicle := case when v_kind in ('license', 'insurance') then v_vehicle_doc_target end;

    select id, kind, storage_path, status, is_current
    into v_existing_doc
    from public.courier_documents
    where courier_id = v_courier_id
      and kind = v_kind
      and vehicle_id is not distinct from v_doc_vehicle
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
        idempotency_key,
        vehicle_id
      ) values (
        v_courier_id,
        v_kind,
        v_storage_path,
        'submitted',
        true,
        null,
        null,
        v_doc_vehicle
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

-- admin_verify_document decide sobre el vehículo del documento y, si es el activo, actualiza el reflejo. Sin vehículo
-- (datos anteriores a CC-042) escribe couriers como antes.
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
  v_vehicle_id uuid;
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

  select courier_id into v_courier_id
  from public.courier_documents
  where id = p_document_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  perform 1 from public.couriers
  where profile_id = v_courier_id
  for update;

  select kind, status, purged_at, is_current, vehicle_id
  into v_kind, v_doc_status, v_purged_at, v_is_current, v_vehicle_id
  from public.courier_documents
  where id = p_document_id
    and courier_id = v_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

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

  perform app_private.cc042_set_vehicle_document_status(v_courier_id, v_vehicle_id, v_kind, v_target_status);

  select doc_level into v_doc_level
  from public.couriers
  where profile_id = v_courier_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id,
    'admin_verify_document',
    'courier_document',
    p_document_id::text,
    jsonb_build_object('status', v_doc_status, 'kind', v_kind, 'courier_id', v_courier_id, 'vehicle_id', v_vehicle_id),
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

-- ============================================================================
-- 8. finalize_courier_application crea el vehículo del alta
-- ============================================================================

create or replace function public.finalize_courier_application(
  p_courier_id uuid,
  p_dni_hmac text,
  p_vehicle_type public.vehicle_type,
  p_vehicle_plate text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_courier record;
  v_profile record;
  v_plate text := nullif(upper(btrim(p_vehicle_plate)), '');
  v_kind text;
  v_current integer;
  v_valid integer;
  v_submitted_at timestamptz;
  v_vehicle_id uuid;
begin
  select profile_id, status, application_submitted, submitted_at, dni_hmac, vehicle_type, vehicle_plate,
         application_vehicle_type, application_vehicle_plate
  into v_courier
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select role, consent_status into v_profile
  from public.profiles
  where id = p_courier_id
  for share;

  if not found or v_profile.role is distinct from 'courier' then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if v_profile.consent_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'CONSENT_REQUIRED';
  end if;

  if v_courier.status::text not in ('pending', 'approved') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  if p_dni_hmac is null or p_dni_hmac !~ '^[0-9a-f]{64}$' or p_vehicle_type is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_vehicle_type in ('moto', 'car') then
    if v_plate is null
      or v_plate !~ '^([A-Z]{2}\s?[0-9]{3}\s?[A-Z]{2}|[A-Z]\s?[0-9]{3}\s?[A-Z]{3}|[A-Z]{3}\s?[0-9]{3}|[0-9]{3}\s?[A-Z]{3})$' then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  elsif v_plate is not null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_courier.application_submitted then
    -- PR624-H03 (D01=A): contra el vehículo de la postulación, no contra el activo (cambia con CC-042). Sin snapshot
    -- solo queda una postulación marcada fuera de finalize y del backfill: ahí el reflejo es el único dato que hay.
    if v_courier.dni_hmac is not distinct from p_dni_hmac
      and (case when v_courier.application_vehicle_type is null then v_courier.vehicle_type
                else v_courier.application_vehicle_type end) is not distinct from p_vehicle_type
      and (case when v_courier.application_vehicle_type is null then v_courier.vehicle_plate
                else v_courier.application_vehicle_plate end) is not distinct from v_plate then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'submittedAt', to_char(v_courier.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      );
    end if;

    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  foreach v_kind in array array['dni_front', 'dni_back', 'selfie', 'avatar']
  loop
    select
      count(*)::integer,
      (count(*) filter (where d.status in ('submitted', 'verified')))::integer
    into v_current, v_valid
    from public.courier_documents d
    where d.courier_id = p_courier_id
      and d.kind = v_kind::public.courier_document_kind
      and coalesce(d.is_current, true) = true;

    if v_current <> 1 or v_valid <> 1 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  end loop;

  v_submitted_at := now();
  perform set_config('app.courier_application_finalize', 'on', true);
  perform set_config('app.courier_application_snapshot', 'on', true);

  begin
    update public.couriers
    set dni_hmac = p_dni_hmac,
        vehicle_type = p_vehicle_type,
        vehicle_plate = v_plate,
        application_vehicle_type = p_vehicle_type,
        application_vehicle_plate = v_plate,
        application_submitted = true,
        submitted_at = v_submitted_at
    where profile_id = p_courier_id;
  exception
    when unique_violation then
      perform set_config('app.courier_application_finalize', 'off', true);
      perform set_config('app.courier_application_snapshot', 'off', true);
      raise exception using errcode = 'P0001', message = 'DNI_ALREADY_REGISTERED';
  end;

  perform set_config('app.courier_application_finalize', 'off', true);
  perform set_config('app.courier_application_snapshot', 'off', true);

  -- CC-042: el vehículo del alta queda activo, con la licencia y el seguro del onboarding asociados.
  select id into v_vehicle_id
  from public.courier_vehicles
  where courier_id = p_courier_id and vehicle_type = p_vehicle_type and archived_at is null;

  if found then
    update public.courier_vehicles set plate = v_plate where id = v_vehicle_id;
  else
    insert into public.courier_vehicles (courier_id, vehicle_type, plate)
    values (p_courier_id, p_vehicle_type, v_plate)
    returning id into v_vehicle_id;
  end if;

  if p_vehicle_type in ('moto', 'car') then
    update public.courier_documents
    set vehicle_id = v_vehicle_id
    where courier_id = p_courier_id
      and kind in ('license', 'insurance')
      and vehicle_id is null;

    -- PR624-H01: los estados salen de la licencia y el seguro vigentes del vehículo (los que acaba de cargar
    -- submit_courier_onboarding_documents), no del reflejo anterior.
    update public.courier_vehicles v
    set license_status = coalesce((
          select d.status from public.courier_documents d
          where d.vehicle_id = v.id and d.kind = 'license' and coalesce(d.is_current, true)
          order by d.uploaded_at desc limit 1), 'none'),
        insurance_status = coalesce((
          select d.status from public.courier_documents d
          where d.vehicle_id = v.id and d.kind = 'insurance' and coalesce(d.is_current, true)
          order by d.uploaded_at desc limit 1), 'none')
    where v.id = v_vehicle_id;
  end if;

  update public.couriers set active_vehicle_id = v_vehicle_id where profile_id = p_courier_id;
  perform app_private.cc042_sync_courier_reflection(p_courier_id);

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'submittedAt', to_char(v_submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
end;
$$;

revoke all on function public.finalize_courier_application(uuid, text, public.vehicle_type, text)
  from public, anon, authenticated;
grant execute on function public.finalize_courier_application(uuid, text, public.vehicle_type, text) to service_role;
