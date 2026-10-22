-- CC-038 (T-411): el código del plan lo genera la base desde el nombre y no cambia al editar.
-- La firma de admin_upsert_publication_plan no cambia: la UI anterior, que manda p_code, sigue funcionando durante el
-- rollout; la nueva manda p_code nulo.

-- Base del código: minúsculas, sin tildes, tramos fuera de [a-z0-9] como un guion, sin guiones en los bordes y hasta
-- 32 caracteres (deja lugar al sufijo «-N»). Con menos de 2 caracteres, «plan».
create function app_private.publication_plan_code_base(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when length(v.base) < 2 then 'plan' else v.base end
  from (
    select btrim(
      left(
        btrim(
          regexp_replace(
            translate(lower(coalesce(p_name, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
            '[^a-z0-9]+', '-', 'g'
          ),
          '-'
        ),
        32
      ),
      '-'
    ) as base
  ) v
$$;

revoke all on function app_private.publication_plan_code_base(text) from public, anon, authenticated;

-- Catálogo de planes (D2). kind y monthly_credits no cambian si el plan ya tiene períodos. El código es fijo.
create or replace function public.admin_upsert_publication_plan(
  p_plan_id uuid,
  p_code text,
  p_name text,
  p_kind text,
  p_monthly_credits integer,
  p_reference_price_ars integer,
  p_active boolean,
  p_sort integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_plan public.publication_plans%rowtype;
  v_before jsonb;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
  v_base text;
  v_suffix bigint;
begin
  perform app_private.assert_admin_aal2();

  if (v_code <> '' and v_code !~ '^[a-z0-9][a-z0-9_-]{1,39}$')
     or length(v_name) not between 2 and 80
     or p_kind is null or p_kind not in ('quota', 'unlimited')
     or (p_kind = 'quota' and (p_monthly_credits is null or p_monthly_credits < 1 or p_monthly_credits > 100000))
     or (p_kind = 'unlimited' and p_monthly_credits is not null)
     or (p_reference_price_ars is not null and (p_reference_price_ars < 0 or p_reference_price_ars > 100000000))
     or p_active is null
     or p_sort is null or p_sort < 0 or p_sort > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_plan_id is null then
    -- Serializa las altas: el sufijo se calcula con lo ya confirmado y dos altas con el mismo nombre no chocan.
    perform pg_advisory_xact_lock(hashtext('cc038:publication-plan-code'));

    if v_code <> '' then
      -- Compatibilidad (CC-038): la UI anterior manda el código.
      if exists (select 1 from public.publication_plans where code = v_code) then
        raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
      end if;
    else
      -- La base libre se usa tal cual; si no, sigue al mayor sufijo «base-N» (la base sola cuenta como 1).
      v_base := app_private.publication_plan_code_base(v_name);
      if not exists (select 1 from public.publication_plans where code = v_base) then
        v_code := v_base;
      else
        select coalesce(max(substring(pl.code from '-([0-9]{1,7})$')::bigint), 1)
        into v_suffix
        from public.publication_plans pl
        where pl.code ~ ('^' || v_base || '-[0-9]{1,7}$');
        v_code := v_base || '-' || (v_suffix + 1)::text;
      end if;
      if length(v_code) > 40 then
        raise exception using errcode = 'P0001', message = 'INTERNAL_ERROR';
      end if;
    end if;

    insert into public.publication_plans (code, name, kind, monthly_credits, reference_price_ars, active, sort)
    values (v_code, v_name, p_kind, p_monthly_credits, p_reference_price_ars, p_active, p_sort)
    returning * into v_plan;
  else
    select * into v_plan from public.publication_plans where id = p_plan_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_code <> '' and v_code <> v_plan.code then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    if (v_plan.kind <> p_kind or v_plan.monthly_credits is distinct from p_monthly_credits)
       and exists (select 1 from public.merchant_plan_periods where plan_id = p_plan_id) then
      raise exception using errcode = 'P0001', message = 'PLAN_IN_USE';
    end if;
    v_before := to_jsonb(v_plan) - 'created_at' - 'updated_at';
    update public.publication_plans
    set name = v_name, kind = p_kind, monthly_credits = p_monthly_credits,
        reference_price_ars = p_reference_price_ars, active = p_active, sort = p_sort, updated_at = now()
    where id = p_plan_id
    returning * into v_plan;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (
    v_actor_id, 'admin_upsert_publication_plan', 'publication_plan', v_plan.id::text,
    v_before, to_jsonb(v_plan) - 'created_at' - 'updated_at'
  );

  return jsonb_build_object(
    'planId', v_plan.id, 'code', v_plan.code, 'name', v_plan.name, 'kind', v_plan.kind,
    'monthlyCredits', v_plan.monthly_credits, 'referencePriceArs', v_plan.reference_price_ars,
    'active', v_plan.active, 'sort', v_plan.sort
  );
end;
$$;

comment on function public.admin_upsert_publication_plan(uuid, text, text, text, integer, integer, boolean, integer) is
  'CC-029 / CC-038: crea o edita un plan. Con p_code nulo o vacío, el código se genera desde el nombre; al editar, no cambia.';
