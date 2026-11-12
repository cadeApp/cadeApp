-- CC-048 (SEC-06, T-430): el comercio solo edita su solicitud y sus contactos mientras están en borrador.

-- 1. delivery_requests_update_merchant: la fila vigente tiene que estar en draft.
drop policy if exists delivery_requests_update_merchant on public.delivery_requests;
create policy delivery_requests_update_merchant on public.delivery_requests
  for update to authenticated
  using (merchant_id = auth.uid() and status = 'draft')
  with check (
    merchant_id = auth.uid()
    and app_private.is_active_operational_actor()
    and status = (select dr.status from public.delivery_requests dr where dr.id = delivery_requests.id)
    and accepted_offer_id is not distinct from (select dr.accepted_offer_id from public.delivery_requests dr where dr.id = delivery_requests.id)
    and created_at = (select dr.created_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and published_at is not distinct from (select dr.published_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and matched_at is not distinct from (select dr.matched_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and picked_up_at is not distinct from (select dr.picked_up_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and delivered_at is not distinct from (select dr.delivered_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and cancelled_at is not distinct from (select dr.cancelled_at from public.delivery_requests dr where dr.id = delivery_requests.id)
    and drops_count = (select dr.drops_count from public.delivery_requests dr where dr.id = delivery_requests.id)
  );

-- 2 y 6. Contactos solo en borrador. El using del update toma el lock de la solicitud antes que el de la fila
-- del contacto (mismo orden que el puente legacy de request_cycle).
drop policy if exists contacts_insert_merchant on public.delivery_request_contacts;
create policy contacts_insert_merchant on public.delivery_request_contacts
  for insert to authenticated
  with check (exists (
    select 1 from public.delivery_requests r
    where r.id = delivery_request_contacts.request_id and r.merchant_id = auth.uid() and r.status = 'draft'
  ));

drop policy if exists contacts_update_merchant on public.delivery_request_contacts;
create policy contacts_update_merchant on public.delivery_request_contacts
  for update to authenticated
  using (exists (
    select 1 from public.delivery_requests r
    where r.id = delivery_request_contacts.request_id and r.merchant_id = auth.uid() and r.status = 'draft'
    for update of r
  ))
  with check (exists (
    select 1 from public.delivery_requests r
    where r.id = delivery_request_contacts.request_id and r.merchant_id = auth.uid() and r.status = 'draft'
  ));

-- 3. Grants de delivery_request_contacts: sin delete/truncate y sin mover request_id.
revoke insert, update, delete, truncate, references, trigger on public.delivery_request_contacts from anon, authenticated;
grant insert on public.delivery_request_contacts to authenticated;
grant update (pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared)
  on public.delivery_request_contacts to authenticated;

-- 4. Grants de delivery_requests.
revoke delete, truncate, references, trigger on public.delivery_requests from anon, authenticated;

-- 5. Helper de serialización: rama de contactos y fallback que conserva INVALID_STATE_TRANSITION
-- (el for update ahora pasa por el using draft-only del punto 1).
create or replace function app_private.lock_draft_request_for_child_write()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_req_id uuid;
  v_req_status public.delivery_request_status;
  v_req_merchant_id uuid;
begin
  if current_user in ('authenticated', 'anon') then
    if TG_TABLE_NAME = 'delivery_request_drops' then
      v_req_id := coalesce(NEW.request_id, OLD.request_id);
    elsif TG_TABLE_NAME = 'delivery_request_contacts' then
      v_req_id := coalesce(NEW.request_id, OLD.request_id);
    elsif TG_TABLE_NAME = 'delivery_request_drop_contacts' then
      if TG_OP = 'DELETE' then
        select request_id into v_req_id
        from public.delivery_request_drops
        where id = OLD.drop_id;
        if v_req_id is null then
          return coalesce(NEW, OLD);
        end if;
      else
        select request_id into v_req_id
        from public.delivery_request_drops
        where id = NEW.drop_id;
      end if;
    end if;

    if v_req_id is null then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;

    select status, merchant_id into v_req_status, v_req_merchant_id
    from public.delivery_requests
    where id = v_req_id
    for update;

    if not found then
      select status, merchant_id into v_req_status, v_req_merchant_id
      from public.delivery_requests
      where id = v_req_id;
      if found and v_req_merchant_id = auth.uid() and v_req_status <> 'draft' then
        raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
      end if;
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;

    if v_req_merchant_id <> auth.uid() then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;

    if v_req_status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE_TRANSITION';
    end if;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

revoke all on function app_private.lock_draft_request_for_child_write() from public, anon, authenticated;

drop trigger if exists trg_lock_draft_contacts on public.delivery_request_contacts;
create trigger trg_lock_draft_contacts
  before insert on public.delivery_request_contacts
  for each row execute function app_private.lock_draft_request_for_child_write();

-- REVIEW ONLY: mutación sin set_updated_at.
drop trigger if exists delivery_requests_set_updated_at on public.delivery_requests;
