begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(22);

-- CC-039 (T-412): get_publication_offer. Autorización, privilegios, catálogo visible, parámetros y descuento.
create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000390a1'::uuid $$;
create function pg_temp.merchant_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000390b1'::uuid $$;
create function pg_temp.merchant_b() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000390b2'::uuid $$;
create function pg_temp.merchant_pending() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000390b3'::uuid $$;
create function pg_temp.merchant_no_row() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000390b4'::uuid $$;
create function pg_temp.courier_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000390c1'::uuid $$;
create function pg_temp.plan(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-00000039' || lpad(n::text, 4, '0'))::uuid
$$;

create function pg_temp.act_as(actor_id uuid, aal text default 'aal1')
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id::text, 'role', 'authenticated', 'aal', aal)::text,
    true
  );
end;
$$;

create function pg_temp.reset_actor()
returns void language plpgsql as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Oferta como el actor dado (null = sesión sin sujeto); el rol vuelve a postgres después.
create function pg_temp.offer(p_actor uuid)
returns jsonb language plpgsql as $$
declare
  v_result jsonb;
begin
  if p_actor is null then
    set local role authenticated;
    perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated')::text, true);
  else
    perform pg_temp.act_as(p_actor);
  end if;
  v_result := public.get_publication_offer();
  perform pg_temp.reset_actor();
  return v_result;
end;
$$;

-- Error de la oferta como el actor dado, o null si no falló.
create function pg_temp.offer_error(p_actor uuid)
returns text language plpgsql as $$
begin
  perform pg_temp.offer(p_actor);
  return null;
exception when others then
  perform pg_temp.reset_actor();
  return sqlerrm;
end;
$$;

create function pg_temp.plan_ids(p_offer jsonb)
returns uuid[] language sql as $$
  select coalesce(array_agg((e->>'planId')::uuid order by ord), '{}')
  from jsonb_array_elements(p_offer->'plans') with ordinality as t(e, ord)
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc039.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc039.ma@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_b(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc039.mb@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_pending(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc039.mp@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.merchant_no_row(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc039.mn@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.courier_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc039.ca@example.test', 'pwd', '{"role":"courier"}'::jsonb);

update public.profiles
set consent_status = 'active'
where id in (pg_temp.admin_a(), pg_temp.merchant_a(), pg_temp.merchant_b(), pg_temp.merchant_no_row(), pg_temp.courier_a());
update public.profiles set role = 'admin' where id = pg_temp.admin_a();
delete from public.merchants where profile_id = pg_temp.merchant_no_row();

-- Catálogo de la prueba: lo previo queda inactivo para que el resultado dependa solo de estas filas.
update public.publication_plans set active = false;
insert into public.publication_plans (id, code, name, kind, monthly_credits, reference_price_ars, active, sort)
values
  (pg_temp.plan(1), 'cc039-plan-40', 'CC039 Plan 40', 'quota', 40, 20000, true, 2),
  (pg_temp.plan(2), 'cc039-ilimitado', 'CC039 Ilimitado', 'unlimited', null, null, true, 1),
  (pg_temp.plan(3), 'cc039-inactivo', 'CC039 Inactivo', 'quota', 5, 1000, false, 0),
  (pg_temp.plan(4), 'cc039-plan-10', 'CC039 Plan 10', 'quota', 10, 6000, true, 1);

delete from public.platform_settings where key = 'loose_credit_reference_price_ars';
update public.platform_settings set value = '0'::jsonb where key = 'launch_discount_pct';

-- ---------------------------------------------------------------------------------------------------------------------
-- Función y privilegios
-- ---------------------------------------------------------------------------------------------------------------------
select has_function('public', 'get_publication_offer', array[]::text[], 'existe get_publication_offer()');
select ok(
  has_function_privilege('authenticated', 'public.get_publication_offer()', 'execute'),
  'authenticated tiene execute'
);
select ok(not has_function_privilege('anon', 'public.get_publication_offer()', 'execute'), 'anon no tiene execute');
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.get_publication_offer()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'public no tiene execute'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Autorización
-- ---------------------------------------------------------------------------------------------------------------------
select is(pg_temp.offer_error(null), 'UNAUTHENTICATED', 'sin sujeto: UNAUTHENTICATED');
select is(pg_temp.offer_error(pg_temp.courier_a()), 'UNAUTHORIZED_ACTOR', 'un repartidor: UNAUTHORIZED_ACTOR');
select is(pg_temp.offer_error(pg_temp.admin_a()), 'UNAUTHORIZED_ACTOR', 'un admin: UNAUTHORIZED_ACTOR');
select is(
  pg_temp.offer_error(pg_temp.merchant_pending()),
  'UNAUTHORIZED_ACTOR',
  'un comercio sin consentimiento activo: UNAUTHORIZED_ACTOR'
);
select is(
  pg_temp.offer_error(pg_temp.merchant_no_row()),
  'UNAUTHORIZED_ACTOR',
  'un perfil de comercio sin alta en merchants: UNAUTHORIZED_ACTOR'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  pg_temp.plan_ids(pg_temp.offer(pg_temp.merchant_a())),
  array[pg_temp.plan(2), pg_temp.plan(4), pg_temp.plan(1)],
  'solo los planes activos, en orden sort, id'
);
select ok(
  not (pg_temp.plan(3) = any (pg_temp.plan_ids(pg_temp.offer(pg_temp.merchant_a())))),
  'el plan inactivo no aparece'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.offer(pg_temp.merchant_a())->'plans'->0) k),
  array['kind', 'monthlyCredits', 'name', 'planId', 'referencePriceArs'],
  'cada plan expone solo planId, name, kind, monthlyCredits y referencePriceArs (sin code)'
);
select is(
  pg_temp.offer(pg_temp.merchant_a())->'plans'->2,
  jsonb_build_object(
    'planId', pg_temp.plan(1), 'name', 'CC039 Plan 40', 'kind', 'quota', 'monthlyCredits', 40,
    'referencePriceArs', 20000
  ),
  'un plan con cupo devuelve sus créditos y su precio'
);
select is(
  pg_temp.offer(pg_temp.merchant_a())->'plans'->0,
  jsonb_build_object(
    'planId', pg_temp.plan(2), 'name', 'CC039 Ilimitado', 'kind', 'unlimited', 'monthlyCredits', null,
    'referencePriceArs', null
  ),
  'un ilimitado devuelve créditos y precio nulos'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.offer(pg_temp.merchant_a())) k),
  array['launchDiscountPct', 'looseCreditReferencePriceArs', 'plans'],
  'la oferta tiene solo plans, looseCreditReferencePriceArs y launchDiscountPct'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Parámetros y descuento
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  pg_temp.offer(pg_temp.merchant_a())->'looseCreditReferencePriceArs',
  'null'::jsonb,
  'sin precio del crédito suelto cargado: null'
);
insert into public.platform_settings (key, value) values ('loose_credit_reference_price_ars', '900'::jsonb);
select is(
  pg_temp.offer(pg_temp.merchant_a())->'looseCreditReferencePriceArs',
  '900'::jsonb,
  'con el precio del crédito suelto cargado: su valor'
);

select is(pg_temp.offer(pg_temp.merchant_a())->'launchDiscountPct', 'null'::jsonb, 'descuento de 0 %: null');
update public.platform_settings set value = '15'::jsonb where key = 'launch_discount_pct';
select is(
  pg_temp.offer(pg_temp.merchant_a())->'launchDiscountPct',
  '15'::jsonb,
  'descuento de 15 % y sin primera compra: 15'
);

-- Primera compra de merchant_a: consume el beneficio.
select pg_temp.act_as(pg_temp.admin_a(), 'aal2');
select public.admin_grant_publication_credits(
  pg_temp.merchant_a(), 1, 'purchase', '00000000-0000-4000-8000-0000000391a1'::uuid, null
);
select pg_temp.reset_actor();

select is(
  pg_temp.offer(pg_temp.merchant_a())->'launchDiscountPct',
  'null'::jsonb,
  'después de la primera compra: null'
);
select is(
  pg_temp.offer(pg_temp.merchant_b())->'launchDiscountPct',
  '15'::jsonb,
  'otro comercio sin compras sigue viendo su descuento'
);

-- Tope de 50 planes.
insert into public.publication_plans (code, name, kind, monthly_credits, reference_price_ars, active, sort)
select 'cc039-tope-' || n, 'CC039 Tope ' || n, 'quota', 5, null, true, 100
from generate_series(1, 60) n;
select is(
  jsonb_array_length(pg_temp.offer(pg_temp.merchant_a())->'plans'),
  50,
  'devuelve como mucho 50 planes'
);

select * from finish();
rollback;
