-- ============================================================================
-- T-340 (Paso 3/4): Limpieza segura de valores legacy (CC-022 §10)
-- ============================================================================
-- 1. Sincronización previa: asegurar que cualquier solicitud existente con notes
--    o cash_change_amount tenga sus valores preservados en delivery_request_drop_contacts
--    (position = 1) antes de la limpieza.
-- 2. Limpieza idempotente: poner en NULL delivery_requests.notes y cash_change_amount
--    en todas las filas existentes.
-- 3. Actualización de app_private.request_cycle: el puente legacy para solicitudes
--    con 0 drops copia a delivery_request_drop_contacts y limpia delivery_requests
--    en la misma transacción al publicar.
-- Las columnas delivery_requests.notes y cash_change_amount permanecen en el esquema;
-- su retiro físico queda reservado para un CC posterior (CC-022 §10 paso 5).

-- 1. Helper privado de limpieza segura de valores legacy con preflight y preservación (CC-022 §10, PR326-H01)
create or replace function app_private.t340_clean_legacy()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unbacked_count integer;
begin
  -- Sincronizar solicitudes legacy elegibles mediante el backfill existente
  perform app_private.t340_backfill_legacy();

  -- Sincronizar únicamente datos faltantes a drop_contacts (position 1) cuando no hay conflicto
  update public.delivery_request_drop_contacts dc
  set notes = case
        when dc.notes is null and r.notes is not null then r.notes
        else dc.notes
      end,
      cash_change_amount = case
        when dc.cash_change_amount is null
             and d.recipient_payment_method = 'cash'
             and d.needs_change
             and r.cash_change_amount is not null
          then r.cash_change_amount
        else dc.cash_change_amount
      end
  from public.delivery_request_drops d
  join public.delivery_requests r on r.id = d.request_id
  where d.id = dc.drop_id
    and d.position = 1
    and (
      (dc.notes is null and r.notes is not null)
      or (dc.cash_change_amount is null and d.recipient_payment_method = 'cash' and d.needs_change and r.cash_change_amount is not null)
    );

  -- Preflight check: comprobar que toda solicitud histórica no-draft con datos legacy no nulos
  -- tenga un drop (position = 1) y contacto enlazado con copia íntegra y equivalente.
  -- Si falta respaldo o diverge, abortar la transacción completa antes de cualquier limpieza.
  -- Diagnóstico seguro: conteo numérico y código, sin valores de notas, contactos ni montos sensibles.
  select count(*)
  into v_unbacked_count
  from public.delivery_requests r
  where r.status <> 'draft'
    and (r.notes is not null or r.cash_change_amount is not null)
    and not exists (
      select 1
      from public.delivery_request_drops d
      join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
      where d.request_id = r.id
        and d.position = 1
        and (r.notes is null or dc.notes is not distinct from r.notes)
        and (
          r.cash_change_amount is null
          or (
            d.recipient_payment_method = 'cash'
            and d.needs_change
            and dc.cash_change_amount is not distinct from r.cash_change_amount
          )
        )
    );

  if v_unbacked_count > 0 then
    raise exception 'T340_PREFLIGHT_UNBACKED_OR_DIVERGENT: % non-draft requests with unbacked legacy data', v_unbacked_count
      using errcode = 'P0001';
  end if;

  -- Limpieza selectiva: poner NULL únicamente en solicitudes verificadas (no-drafts con respaldo íntegro).
  -- Los borradores (drafts) conservan sus datos intactos hasta la publicación.
  update public.delivery_requests r
  set notes = null,
      cash_change_amount = null
  from public.delivery_request_drops d
  join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
  where d.request_id = r.id
    and d.position = 1
    and r.status <> 'draft'
    and (r.notes is not null or r.cash_change_amount is not null)
    and (r.notes is null or dc.notes is not distinct from r.notes)
    and (
      r.cash_change_amount is null
      or (
        d.recipient_payment_method = 'cash'
        and d.needs_change
        and dc.cash_change_amount is not distinct from r.cash_change_amount
      )
    );
end;
$$;

revoke all on function app_private.t340_clean_legacy() from public, anon, authenticated;

-- Ejecución atómica de la limpieza en la migración
select app_private.t340_clean_legacy();

-- 3. Actualización de app_private.request_cycle con limpieza en la misma transacción (CC-022 §10)
create or replace function app_private.request_cycle(
  p_action text,
  p_request_id uuid,
  p_reason text default null,
  p_republish boolean default false,
  p_kind text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_request public.delivery_requests%rowtype;
  v_offer public.offers%rowtype;
  v_courier public.couriers%rowtype;
  v_merchant public.merchants%rowtype;
  v_contacts public.delivery_request_contacts%rowtype;
  v_pickup public.zones%rowtype;
  v_eff_status public.delivery_request_status;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_pilot jsonb;
  v_grace integer;
  v_distance integer;
  v_lat1 numeric; v_lng1 numeric; v_lat2 numeric; v_lng2 numeric;
  v_count integer;
  v_limit integer;
  v_status public.delivery_request_status;
  v_result jsonb;
  v_incident uuid;
  v_rate_action text;
  v_consent_status public.consent_status;
  -- Variables de multi-drop
  v_drops_count integer := 0;
  v_max_drops integer;
  v_new_drop_id uuid;
  v_drop_row record;
  v_can_calc_total boolean;
  v_total_distance integer;
  v_seg_distance integer;
  v_drop1_id uuid;
  v_drop1_payment text;
  v_drop1_needs_change boolean;
  v_drop1_notes text;
  v_drop1_cash_change integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select role, consent_status into v_role, v_consent_status from public.profiles where id = v_uid;
  if (v_role is null or (v_role = 'courier' and p_action in ('publish_request','republish_request','report_no_show'))
    or (p_action in ('publish_request','republish_request','report_no_show') and v_role <> 'merchant')
    or (p_action in ('mark_picked_up','mark_delivered','courier_cancel_match') and v_role <> 'courier')
    or (p_action = 'report_incident' and v_role not in ('merchant','courier'))
    or (p_action = 'cancel_request' and v_role not in ('merchant','admin'))) then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;
  if v_role <> 'admin' and (v_consent_status is distinct from 'active') then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  if p_request_id is null or (p_action = 'report_incident' and (
      p_kind is null or p_description is null
      or length(btrim(p_kind)) not between 2 and 80
      or length(btrim(p_description)) not between 5 and 1000)) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select * into v_request from public.delivery_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_offer from public.offers
    where id = v_request.accepted_offer_id and request_id = p_request_id for update;
  if v_role = 'courier' then
    if p_action = 'report_incident' and (v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted') then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
    select * into v_courier from public.couriers where profile_id = v_uid for share;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_courier.status = 'suspended' then raise exception 'COURIER_SUSPENDED' using errcode = 'P0001'; end if;
    if v_courier.status <> 'approved' then raise exception 'COURIER_NOT_APPROVED' using errcode = 'P0001'; end if;
    if v_offer.courier_id is distinct from v_uid or v_offer.status is distinct from 'accepted' then
      raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
    end if;
  elsif v_role = 'merchant' and v_request.merchant_id <> v_uid then
    raise exception 'UNAUTHORIZED_ACTOR' using errcode = 'P0001';
  end if;

  v_eff_status := case when v_request.status = 'published' and v_request.expires_at <= v_now
    then 'expired'::public.delivery_request_status else v_request.status end;
  if p_action = 'cancel_request' and v_request.status = 'published' and v_request.expires_at <= v_now then
    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;
  if (p_action = 'publish_request' and v_eff_status <> 'draft')
    or (p_action = 'cancel_request' and not (
      (v_role = 'merchant' and v_eff_status in ('published','matched'))
      or (v_role = 'admin' and v_eff_status = 'in_transit')))
    or (p_action in ('mark_picked_up','report_no_show','courier_cancel_match') and v_eff_status <> 'matched')
    or (p_action = 'mark_delivered' and v_eff_status <> 'in_transit')
    or (p_action = 'republish_request' and v_eff_status not in ('matched','expired','cancelled'))
    or (p_action = 'report_incident' and v_eff_status not in ('published','matched','in_transit','delivered')) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  -- CC-022 §6: mark_delivered sólo se admite si drops_count = 1
  if p_action = 'mark_delivered' and v_request.drops_count > 1 then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  if p_action = 'cancel_request' and v_role = 'admin'
    and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'AAL2_REQUIRED' using errcode = 'P0001';
  end if;
  if ((p_action = 'cancel_request' and v_eff_status in ('matched','in_transit'))
    or (p_action = 'republish_request' and v_eff_status = 'matched')
    or p_action = 'courier_cancel_match') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_action = 'cancel_request' and v_role = 'admin' and v_eff_status = 'in_transit'
    and not exists (select 1 from public.incidents where request_id = p_request_id) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_no_show' and (v_offer.id is null or v_offer.status <> 'accepted') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  if p_action = 'report_incident' and v_eff_status = 'delivered'
    and (v_request.delivered_at is null or v_now > v_request.delivered_at + interval '24 hours') then
    raise exception 'INCIDENT_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;

  if p_action in ('publish_request','republish_request') or (p_action = 'report_no_show' and p_republish) then
    select * into v_merchant from public.merchants where profile_id = v_request.merchant_id for share;
    select value into v_pilot from public.platform_settings where key = 'pilot_active';
    if v_pilot is null or jsonb_typeof(v_pilot) <> 'boolean' then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    v_grace := app_private.request_setting_int('subscription_grace_days');
    if v_merchant.profile_id is null or v_merchant.subscription_status in ('expired','cancelled')
      or not coalesce((v_merchant.subscription_status = 'pilot' and v_pilot = 'true'::jsonb)
        or (v_merchant.paid_until + v_grace >=
          (v_now at time zone 'America/Argentina/Buenos_Aires')::date), false) then
      raise exception 'SUBSCRIPTION_INACTIVE' using errcode = 'P0001';
    end if;
  end if;
  if p_action in ('publish_request','republish_request','courier_cancel_match')
    or (p_action = 'report_no_show' and p_republish) then
    v_expires := v_now + make_interval(mins => app_private.request_setting_int('request_ttl_minutes'));
  end if;

  if p_action = 'publish_request' then
    -- 1. Puente legacy si la solicitud tiene CERO drops (CC-022 §5, §10 Paso 3)
    select count(*) into v_drops_count from public.delivery_request_drops where request_id = p_request_id;
    if v_drops_count = 0 then
      select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for update;
      if not found or not v_contacts.recipient_consent_declared
         or btrim(coalesce(v_contacts.dropoff_address, '')) = ''
         or btrim(coalesce(v_contacts.recipient_name, '')) = ''
         or btrim(coalesce(v_contacts.recipient_phone, '')) = ''
         or v_request.dropoff_zone_id is null
         or v_request.package_type is null
         or v_request.recipient_payment_method is null then
        raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
      end if;

      if v_request.recipient_payment_method = 'cash' and v_request.needs_change then
        if v_request.cash_change_amount is null or v_request.cash_change_amount <= 0 then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      end if;

      insert into public.delivery_request_drops (
        request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status
      ) values (
        p_request_id,
        1,
        v_request.dropoff_zone_id,
        v_request.package_type,
        v_request.recipient_payment_method,
        case when v_request.recipient_payment_method = 'cash' then v_request.needs_change else false end,
        'pending'
      ) returning id into v_new_drop_id;

      insert into public.delivery_request_drop_contacts (
        drop_id, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared, cash_change_amount, notes
      ) values (
        v_new_drop_id,
        v_contacts.dropoff_address,
        v_contacts.dropoff_lat,
        v_contacts.dropoff_lng,
        v_contacts.recipient_name,
        v_contacts.recipient_phone,
        v_contacts.recipient_consent_declared,
        case when v_request.recipient_payment_method = 'cash' and v_request.needs_change then v_request.cash_change_amount else null end,
        v_request.notes
      );

      -- Paso 3 (CC-022 §10): Limpieza de valores legacy en la misma transacción tras copiarlos a drop_contacts
      update public.delivery_requests
      set notes = null,
          cash_change_amount = null
      where id = p_request_id;

      v_drops_count := 1;
    else
      -- PR326-H02: Puente con drops preexistentes
      -- Bajo el lock existente (v_request ya está bloqueado FOR UPDATE):
      -- si hay datos legacy, comprobar drop 1, sincronizar dato faltante sin conflicto,
      -- verificar igualdad por valor y limpiar solo después. Ante discrepancia, abortar.
      if v_request.notes is not null or v_request.cash_change_amount is not null then
        select d.id, d.recipient_payment_method, d.needs_change,
               dc.notes, dc.cash_change_amount
        into v_drop1_id, v_drop1_payment, v_drop1_needs_change,
             v_drop1_notes, v_drop1_cash_change
        from public.delivery_request_drops d
        left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
        where d.request_id = p_request_id and d.position = 1
        for update;

        if v_drop1_id is null then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;

        -- Comprobar discrepancia antes de mutar
        if v_request.notes is not null and v_drop1_notes is not null and v_drop1_notes is distinct from v_request.notes then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;

        if v_request.cash_change_amount is not null then
          if v_drop1_payment <> 'cash' or not coalesce(v_drop1_needs_change, false) then
            raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
          end if;
          if v_drop1_cash_change is not null and v_drop1_cash_change is distinct from v_request.cash_change_amount then
            raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
          end if;
        end if;

        -- Sincronizar únicamente el dato faltante de position=1 cuando no hay conflicto
        if (v_request.notes is not null and v_drop1_notes is null)
           or (v_request.cash_change_amount is not null and v_drop1_payment = 'cash' and v_drop1_needs_change and v_drop1_cash_change is null) then
          update public.delivery_request_drop_contacts
          set notes = coalesce(notes, v_request.notes),
              cash_change_amount = coalesce(
                cash_change_amount,
                case when v_drop1_payment = 'cash' and v_drop1_needs_change then v_request.cash_change_amount else null end
              )
          where drop_id = v_drop1_id;
        end if;

        -- Comprobar igualdad por valor
        select dc.notes, dc.cash_change_amount
        into v_drop1_notes, v_drop1_cash_change
        from public.delivery_request_drop_contacts dc
        where dc.drop_id = v_drop1_id;

        if (v_request.notes is not null and v_drop1_notes is distinct from v_request.notes)
           or (v_request.cash_change_amount is not null and (
                v_drop1_payment <> 'cash'
                or not coalesce(v_drop1_needs_change, false)
                or v_drop1_cash_change is distinct from v_request.cash_change_amount
              )) then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;

        -- Limpiar solo tras verificar igualdad
        update public.delivery_requests
        set notes = null,
            cash_change_amount = null
        where id = p_request_id;
      end if;
    end if;

    select count(*) into v_drops_count from public.delivery_request_drops where request_id = p_request_id;
    if v_drops_count = 0 then
      raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
    end if;

    v_max_drops := app_private.request_setting_int('max_drops_per_request');
    if v_drops_count > v_max_drops then
      raise exception 'DROP_LIMIT_EXCEEDED' using errcode = 'P0001';
    end if;

    -- Posiciones consecutivas desde 1
    if exists (
      select 1
      from generate_series(1, v_drops_count) as expected_pos
      where not exists (
        select 1 from public.delivery_request_drops d
        where d.request_id = p_request_id and d.position = expected_pos
      )
    ) then
      raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
    end if;

    select * into v_contacts from public.delivery_request_contacts where request_id = p_request_id for share;
    if not found or btrim(coalesce(v_contacts.pickup_address, '')) = '' then
      raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
    end if;

    select * into v_pickup from public.zones where id = v_request.pickup_zone_id for share;
    if v_pickup.id is null or not v_pickup.active then
      raise exception 'INVALID_ZONE' using errcode = 'P0001';
    end if;

    v_lat1 := coalesce(v_contacts.pickup_lat, v_pickup.centroid_lat);
    v_lng1 := coalesce(v_contacts.pickup_lng, v_pickup.centroid_lng);
    if v_lat1 is not null and (v_lat1 not between -27.4800 and -27.3800 or v_lng1 not between -65.6450 and -65.5800) then
      raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
    end if;

    v_can_calc_total := (v_lat1 is not null and v_lng1 is not null);
    v_total_distance := 0;

    for v_drop_row in
      select d.id, d.position, d.dropoff_zone_id, d.recipient_payment_method, d.needs_change,
             dc.drop_id, dc.dropoff_address, dc.dropoff_lat, dc.dropoff_lng, dc.recipient_name, dc.recipient_phone,
             dc.recipient_consent_declared, dc.cash_change_amount,
             z.active as zone_active, z.centroid_lat, z.centroid_lng
      from public.delivery_request_drops d
      left join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
      left join public.zones z on z.id = d.dropoff_zone_id
      where d.request_id = p_request_id
      order by d.position
    loop
      if v_drop_row.drop_id is null
         or not coalesce(v_drop_row.recipient_consent_declared, false)
         or btrim(coalesce(v_drop_row.dropoff_address, '')) = ''
         or btrim(coalesce(v_drop_row.recipient_name, '')) = ''
         or btrim(coalesce(v_drop_row.recipient_phone, '')) = '' then
        raise exception 'MISSING_REQUIRED_FIELDS' using errcode = 'P0001';
      end if;

      if v_drop_row.dropoff_zone_id is null or not coalesce(v_drop_row.zone_active, false) then
        raise exception 'INVALID_ZONE' using errcode = 'P0001';
      end if;

      v_lat2 := coalesce(v_drop_row.dropoff_lat, v_drop_row.centroid_lat);
      v_lng2 := coalesce(v_drop_row.dropoff_lng, v_drop_row.centroid_lng);
      if v_lat2 is not null and (v_lat2 not between -27.4800 and -27.3800 or v_lng2 not between -65.6450 and -65.5800) then
        raise exception 'OUT_OF_BOUNDS_AGUILARES' using errcode = 'P0001';
      end if;

      if v_drop_row.recipient_payment_method <> 'cash' and v_drop_row.needs_change then
        raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
      end if;
      if v_drop_row.recipient_payment_method = 'cash' and v_drop_row.needs_change then
        if v_drop_row.cash_change_amount is null or v_drop_row.cash_change_amount <= 0 then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      else
        if v_drop_row.cash_change_amount is not null then
          raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
        end if;
      end if;

      if v_can_calc_total and v_lat1 is not null and v_lng1 is not null and v_lat2 is not null and v_lng2 is not null then
        v_seg_distance := app_private.route_segment_distance(v_lat1, v_lng1, v_lat2, v_lng2);
        update public.delivery_request_drops set approx_distance_m = v_seg_distance where id = v_drop_row.id;
        v_total_distance := v_total_distance + v_seg_distance;
        v_lat1 := v_lat2;
        v_lng1 := v_lng2;
      else
        v_can_calc_total := false;
        update public.delivery_request_drops set approx_distance_m = null where id = v_drop_row.id;
      end if;
    end loop;

    v_distance := case when v_can_calc_total then v_total_distance else null end;
    update public.delivery_requests
    set drops_count = v_drops_count
    where id = p_request_id;

    if v_request.fixed_price_ars is not null and v_request.fixed_price_ars < app_private.request_setting_int('min_offer_ars') then
      raise exception 'OFFER_BELOW_MINIMUM' using errcode = 'P0001';
    end if;
  end if;

  if p_action in ('publish_request','republish_request','report_incident') then
    v_rate_action := case when p_action = 'report_incident' then 'report_incident' else 'publish_request' end;
    v_limit := app_private.request_setting_int(case when p_action = 'report_incident'
      then 'max_incidents_per_min' else 'max_request_publications_per_min' end);
    insert into public.rate_limits (subject, action, window_start, count)
      values (v_uid::text, v_rate_action, date_trunc('minute', v_now), 1)
      on conflict (subject, action, window_start) do update set count = public.rate_limits.count + 1
      returning count into v_count;
    if v_count > v_limit then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;
  end if;

  if p_action = 'report_incident' then
    insert into public.incidents (request_id, reporter_id, kind, description, status)
      values (p_request_id, v_uid, btrim(p_kind), btrim(p_description), 'open') returning id into v_incident;
    return jsonb_build_object('incidentId', v_incident, 'requestId', p_request_id, 'status', 'open', 'createdAt', v_now);
  elsif p_action = 'mark_picked_up' then
    update public.delivery_requests set status = 'in_transit', picked_up_at = v_now where id = p_request_id;
    return jsonb_build_object('requestId', p_request_id, 'status', 'in_transit', 'pickedUpAt', v_now);
  elsif p_action = 'mark_delivered' then
    update public.delivery_requests set status = 'delivered', delivered_at = v_now where id = p_request_id;
    update public.delivery_request_drops set status = 'delivered', delivered_at = v_now where request_id = p_request_id and position = 1;
    return jsonb_build_object('requestId', p_request_id, 'status', 'delivered', 'deliveredAt', v_now);
  end if;

  v_status := case when p_action = 'cancel_request' or (p_action = 'report_no_show' and not p_republish)
    then 'cancelled'::public.delivery_request_status else 'published'::public.delivery_request_status end;
  update public.offers set status = 'cancelled', decided_at = v_now
    where id = v_request.accepted_offer_id and request_id = p_request_id and status = 'accepted';
  update public.offers set status = 'expired', decided_at = v_now
    where request_id = p_request_id and status = 'pending';
  if p_action = 'report_no_show' or nullif(btrim(p_reason), '') is not null then
    insert into public.request_cancellation_reasons (request_id, offer_id, actor_id, action, reason)
      values (p_request_id, v_request.accepted_offer_id, v_uid, p_action,
        case when p_action = 'report_no_show' then 'no_show' else btrim(p_reason) end);
  end if;
  update public.delivery_requests set status = v_status, accepted_offer_id = null,
    published_at = case when v_status = 'published' then v_now else published_at end,
    expires_at = v_expires,
    matched_at = case when v_status = 'published' then null else matched_at end,
    picked_up_at = case when v_status = 'published' then null else picked_up_at end,
    delivered_at = null,
    cancelled_at = case when v_status = 'cancelled' then v_now end,
    cancel_reason = case when p_action = 'report_no_show' then 'no_show' else nullif(btrim(p_reason), '') end,
    route_distance_m = case when p_action = 'publish_request' then v_distance else route_distance_m end
    where id = p_request_id;
  if v_status = 'published' then
    update public.delivery_requests set cancel_reason = null where id = p_request_id;
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
    values (v_uid, p_action, 'delivery_request', p_request_id,
      jsonb_build_object('status', v_request.status, 'offerId', v_request.accepted_offer_id),
      jsonb_build_object('status', v_status));
  v_result := jsonb_build_object('requestId', p_request_id, 'status', v_status);
  if p_action = 'cancel_request' then
    return v_result || jsonb_build_object('cancelledAt', v_now);
  elsif p_action in ('report_no_show','courier_cancel_match') then
    return v_result || jsonb_build_object('cancelledOfferId', v_request.accepted_offer_id, 'expiresAt', v_expires);
  elsif p_action = 'publish_request' then
    return v_result || jsonb_build_object(
      'publishedAt', v_now,
      'expiresAt', v_expires,
      'routeDistanceM', v_distance,
      'fixedPriceArs', v_request.fixed_price_ars,
      'autoAssign', v_request.auto_assign,
      'dropsCount', v_drops_count
    );
  end if;
  return v_result || jsonb_build_object('publishedAt', v_now, 'expiresAt', v_expires);
end;
$$;

revoke all on function app_private.request_cycle(text,uuid,text,boolean,text,text) from public, anon, authenticated;
