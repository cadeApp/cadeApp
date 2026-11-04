-- ============================================================================
-- CC-043 (T-421): envío explícito de la postulación del repartidor
-- ============================================================================
--
-- `application_submitted` marca la postulación enviada (y el onboarding completo del repartidor) y `submitted_at` el
-- momento del primer envío, con el reloj de la base. Solo los escribe `finalize_courier_application`, que llama el
-- servidor con `service_role`; un trigger rechaza cualquier otra escritura y, en la ventana `migrate-*` → deploy, el
-- `update` final del onboarding anterior (DNI + vehículo sin envío).

-- 1. Columnas
alter table public.couriers
  add column if not exists application_submitted boolean not null default false,
  add column if not exists submitted_at timestamptz;

alter table public.couriers
  drop constraint if exists couriers_submitted_at_requires_application;
alter table public.couriers
  add constraint couriers_submitted_at_requires_application
  check (submitted_at is null or application_submitted);

-- 2. Backfill: envíos históricos según T-334 (`vehicle_type` no nulo), sin fecha. Se hace antes del trigger.
update public.couriers
set application_submitted = true
where vehicle_type is not null
  and application_submitted = false;

-- PR587-H07: cantidad de históricos marcados a los que les falta algún documento obligatorio vigente (sin datos).
do $$
declare
  v_incomplete integer;
begin
  select count(*) into v_incomplete
  from public.couriers c
  where c.application_submitted
    and c.submitted_at is null
    and (
      select count(distinct d.kind)
      from public.courier_documents d
      where d.courier_id = c.profile_id
        and d.kind in ('dni_front', 'dni_back', 'selfie', 'avatar')
        and coalesce(d.is_current, true) = true
        and d.status in ('submitted', 'verified')
    ) < 4;

  raise notice 'CC-043: % postulaciones históricas marcadas como enviadas con documentos obligatorios incompletos', v_incomplete;
end;
$$;

-- 3. RPC de finalización (solo service_role)
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
begin
  -- 1. Lock de couriers primero (orden CC-025: couriers → profiles → courier_documents)
  select profile_id, status, application_submitted, submitted_at, dni_hmac, vehicle_type, vehicle_plate
  into v_courier
  from public.couriers
  where profile_id = p_courier_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  -- 2. Actor y estado bajo el lock
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

  -- 3. Datos, antes de escribir
  if p_dni_hmac is null or p_dni_hmac !~ '^[0-9a-f]{64}$' or p_vehicle_type is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_vehicle_type in ('moto', 'car') then
    if v_plate is null
      or v_plate !~ '^([A-Z]{2}\s?[0-9]{3}\s?[A-Z]{2}|[A-Z]\s?[0-9]{3}\s?[A-Z]{3}|[A-Z]{3}\s?[0-9]{3}|[0-9]{3}\s?[A-Z]{3})$' then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  end if;

  -- 4. Ya enviada: reintento idéntico sin escribir; datos distintos se rechazan. Un histórico sigue sin fecha.
  if v_courier.application_submitted then
    if v_courier.dni_hmac is not distinct from p_dni_hmac
      and v_courier.vehicle_type is not distinct from p_vehicle_type
      and v_courier.vehicle_plate is not distinct from v_plate then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'submittedAt', to_char(v_courier.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      );
    end if;

    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  -- 5. Primer envío: un documento vigente y válido por cada tipo obligatorio
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

  -- 6. Una sola escritura, autorizada para el trigger dentro de esta transacción
  v_submitted_at := now();
  perform set_config('app.courier_application_finalize', 'on', true);

  begin
    update public.couriers
    set dni_hmac = p_dni_hmac,
        vehicle_type = p_vehicle_type,
        vehicle_plate = v_plate,
        application_submitted = true,
        submitted_at = v_submitted_at
    where profile_id = p_courier_id;
  exception
    when unique_violation then
      perform set_config('app.courier_application_finalize', 'off', true);
      raise exception using errcode = 'P0001', message = 'DNI_ALREADY_REGISTERED';
  end;

  perform set_config('app.courier_application_finalize', 'off', true);

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

-- 4. Guarda de las columnas del envío
create or replace function app_private.couriers_guard_application()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  -- La marca sola no es una credencial (cualquier rol con SQL la puede fijar): además, quien escribe tiene que ser
  -- el dueño de finalize_courier_application, es decir, la propia RPC security definer.
  v_authorized boolean :=
    coalesce(current_setting('app.courier_application_finalize', true), '') = 'on'
    and current_user = (
      select pg_get_userbyid(p.proowner)
      from pg_proc p
      where p.oid = 'public.finalize_courier_application(uuid, text, public.vehicle_type, text)'::regprocedure
    );
begin
  if tg_op = 'INSERT' then
    if new.application_submitted or new.submitted_at is not null then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    return new;
  end if;

  if new.application_submitted is distinct from old.application_submitted
    or new.submitted_at is distinct from old.submitted_at then
    if not v_authorized
      or (old.application_submitted and not new.application_submitted)
      or (old.submitted_at is not null and new.submitted_at is distinct from old.submitted_at) then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
  end if;

  -- PR587-H08: el `update` final del onboarding anterior (DNI + vehículo sin envío) falla en vez de dar un OK falso.
  if not v_authorized
    and not new.application_submitted
    and new.dni_hmac is not null
    and new.vehicle_type is not null
    and (new.dni_hmac is distinct from old.dni_hmac or new.vehicle_type is distinct from old.vehicle_type) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
  end if;

  return new;
end;
$$;

revoke all on function app_private.couriers_guard_application() from public, anon, authenticated;

drop trigger if exists couriers_guard_application on public.couriers;
create trigger couriers_guard_application
  before insert or update on public.couriers
  for each row execute function app_private.couriers_guard_application();
