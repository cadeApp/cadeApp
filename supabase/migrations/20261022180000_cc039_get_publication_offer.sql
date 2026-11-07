-- CC-039 (T-412): oferta comercial para el comercio. Planes activos (sin código ni datos internos), precio de
-- referencia del crédito suelto y descuento de primera compra si todavía le corresponde. Solo lectura.

create function public.get_publication_offer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.profile_role;
  v_consent public.consent_status;
  v_plans jsonb;
  v_loose_price integer;
  v_discount integer;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  select role, consent_status into v_role, v_consent from public.profiles where id = v_uid;
  if v_role is distinct from 'merchant' or v_consent is distinct from 'active'
     or not exists (select 1 from public.merchants where profile_id = v_uid) then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;

  -- Catálogo corto y curado por el admin: el tope de 50 solo protege la respuesta.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'planId', p.id, 'name', p.name, 'kind', p.kind,
        'monthlyCredits', p.monthly_credits, 'referencePriceArs', p.reference_price_ars
      )
      order by p.sort, p.id
    ),
    '[]'::jsonb
  )
  into v_plans
  from (
    select id, name, kind, monthly_credits, reference_price_ars, sort
    from public.publication_plans
    where active
    order by sort, id
    limit 50
  ) p;

  v_loose_price := app_private.publication_setting_int('loose_credit_reference_price_ars', null);

  -- El beneficio se consume con la primera compra registrada (fila en merchant_launch_discounts), aunque sea 0 %.
  v_discount := app_private.publication_setting_int('launch_discount_pct', 0);
  if v_discount <= 0 or exists (select 1 from public.merchant_launch_discounts where merchant_id = v_uid) then
    v_discount := null;
  end if;

  return jsonb_build_object(
    'plans', v_plans,
    'looseCreditReferencePriceArs', v_loose_price,
    'launchDiscountPct', v_discount
  );
end;
$$;

comment on function public.get_publication_offer() is
  'CC-039: planes activos, precio de referencia del crédito suelto y descuento de primera compra para el comercio.';

revoke all on function public.get_publication_offer() from public, anon, authenticated;
grant execute on function public.get_publication_offer() to authenticated;
