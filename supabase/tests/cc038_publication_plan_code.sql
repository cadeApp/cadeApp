begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(30);

-- CC-038 (T-411): admin_upsert_publication_plan genera el código del plan desde el nombre y no lo cambia al editar.
create function pg_temp.admin_a() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000380a1'::uuid $$;

create function pg_temp.act_as(actor_id uuid, aal text default 'aal2')
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

-- Alta de un plan con cupo 5 como admin aal2; devuelve la salida de la RPC.
create function pg_temp.create_plan(p_code text, p_name text)
returns jsonb language plpgsql as $$
declare
  v_result jsonb;
begin
  perform pg_temp.act_as(pg_temp.admin_a());
  v_result := public.admin_upsert_publication_plan(null, p_code, p_name, 'quota', 5, null, true, 1);
  perform pg_temp.reset_actor();
  return v_result;
end;
$$;

-- Edición de un plan como admin aal2; devuelve la salida de la RPC.
create function pg_temp.edit_plan(p_plan_id uuid, p_code text, p_name text)
returns jsonb language plpgsql as $$
declare
  v_result jsonb;
begin
  perform pg_temp.act_as(pg_temp.admin_a());
  v_result := public.admin_upsert_publication_plan(p_plan_id, p_code, p_name, 'quota', 5, null, true, 1);
  perform pg_temp.reset_actor();
  return v_result;
end;
$$;

create function pg_temp.plan_id(p_code text) returns uuid language sql as $$
  select id from public.publication_plans where code = p_code
$$;

-- Error de la RPC como admin aal2 (o null si no falló); el rol vuelve a postgres para leer la tabla después.
create function pg_temp.upsert_error(p_plan_id uuid, p_code text, p_name text)
returns text language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.admin_a());
  begin
    perform public.admin_upsert_publication_plan(p_plan_id, p_code, p_name, 'quota', 5, null, true, 1);
  exception when others then
    perform pg_temp.reset_actor();
    return sqlerrm;
  end;
  perform pg_temp.reset_actor();
  return null;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.admin_a(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc038.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb);
update public.profiles set consent_status = 'active', role = 'admin' where id = pg_temp.admin_a();

-- ---------------------------------------------------------------------------------------------------------------------
-- Helper y privilegios
-- ---------------------------------------------------------------------------------------------------------------------
select has_function('app_private', 'publication_plan_code_base', array['text'], 'existe el helper de la base del código');
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'app_private.publication_plan_code_base(text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'el helper no tiene execute para public'
);
select ok(
  not has_function_privilege('anon', 'app_private.publication_plan_code_base(text)', 'execute'),
  'el helper no tiene execute para anon'
);
select ok(
  not has_function_privilege('authenticated', 'app_private.publication_plan_code_base(text)', 'execute'),
  'el helper no tiene execute para authenticated'
);
select has_function(
  'public', 'admin_upsert_publication_plan',
  array['uuid', 'text', 'text', 'text', 'integer', 'integer', 'boolean', 'integer'],
  'la firma de la RPC no cambia'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_upsert_publication_plan(uuid, text, text, text, integer, integer, boolean, integer)', 'execute')
  and not has_function_privilege('anon', 'public.admin_upsert_publication_plan(uuid, text, text, text, integer, integer, boolean, integer)', 'execute'),
  'la RPC conserva sus grants: authenticated sí, anon no'
);

select is(app_private.publication_plan_code_base('CC038 Básico 20'), 'cc038-basico-20', 'minúsculas, sin tildes y con guiones');
select is(app_private.publication_plan_code_base('Ñandú  Premium!!'), 'nandu-premium', 'la ñ, los espacios repetidos y los símbolos');
select is(app_private.publication_plan_code_base('  ÁÉÍÓÚ üç  '), 'aeiou-uc', 'mayúsculas acentuadas, diéresis y ç');
select is(app_private.publication_plan_code_base('¡¡'), 'plan', 'un nombre sin letras ni números da «plan»');
select is(
  app_private.publication_plan_code_base(repeat('Ab ', 26)),
  'ab-ab-ab-ab-ab-ab-ab-ab-ab-ab-ab',
  'un nombre largo se corta en 32 caracteres sin guion final'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Alta: código generado
-- ---------------------------------------------------------------------------------------------------------------------
select is(pg_temp.create_plan(null, 'CC038 Básico 20')->>'code', 'cc038-basico-20', 'con p_code nulo, el código sale del nombre');
select is(pg_temp.create_plan('', 'CC038 Básico 20')->>'code', 'cc038-basico-20-2', 'con p_code vacío también, y el repetido lleva -2');
select is(pg_temp.create_plan('   ', 'CC038 Básico 20')->>'code', 'cc038-basico-20-3', 'el tercero lleva -3');
select is(
  (select after->>'code' from public.audit_log
   where action = 'admin_upsert_publication_plan' and target_id = pg_temp.plan_id('cc038-basico-20')::text),
  'cc038-basico-20',
  'la auditoría registra el código generado'
);

select is(pg_temp.create_plan('cc038-salto', 'CC038 Salto')->>'code', 'cc038-salto', 'compatibilidad: un código explícito válido se usa');
select is(pg_temp.create_plan('cc038-salto-7', 'CC038 Salto 7')->>'code', 'cc038-salto-7', 'otro código explícito con sufijo');
select is(pg_temp.create_plan(null, 'CC038 Salto')->>'code', 'cc038-salto-8', 'el generado sigue al mayor sufijo existente');

select is(pg_temp.create_plan('cc038-libre-2', 'CC038 Libre 2')->>'code', 'cc038-libre-2', 'existe base-2 sin la base');
select is(pg_temp.create_plan(null, 'CC038 Libre')->>'code', 'cc038-libre', 'una base libre se usa sin sufijo');

select is(
  pg_temp.create_plan(null, 'CC038 ' || repeat('Ab ', 24))->>'code',
  'cc038-ab-ab-ab-ab-ab-ab-ab-ab-ab',
  'un nombre largo da un código de hasta 32 caracteres que cumple el check'
);

select is(pg_temp.upsert_error(null, 'X', 'CC038 Inválido'), 'VALIDATION_ERROR', 'un código explícito inválido da VALIDATION_ERROR');
select is(pg_temp.upsert_error(null, 'cc038-salto', 'CC038 Otro'), 'VALIDATION_ERROR', 'un código explícito repetido da VALIDATION_ERROR');

-- ---------------------------------------------------------------------------------------------------------------------
-- Edición: el código es fijo
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  pg_temp.edit_plan(pg_temp.plan_id('cc038-basico-20'), null, 'CC038 Renombrado') - 'planId',
  jsonb_build_object(
    'code', 'cc038-basico-20', 'name', 'CC038 Renombrado', 'kind', 'quota', 'monthlyCredits', 5,
    'referencePriceArs', null, 'active', true, 'sort', 1
  ),
  'editar con p_code nulo cambia el nombre y conserva el código'
);
select is(
  pg_temp.edit_plan(pg_temp.plan_id('cc038-basico-20'), '', 'CC038 Renombrado')->>'code',
  'cc038-basico-20',
  'editar con p_code vacío conserva el código'
);
select is(
  pg_temp.edit_plan(pg_temp.plan_id('cc038-basico-20'), 'cc038-basico-20', 'CC038 Renombrado')->>'code',
  'cc038-basico-20',
  'editar con el mismo código lo acepta'
);

select is(
  pg_temp.upsert_error(pg_temp.plan_id('cc038-basico-20'), 'cc038-otro', 'CC038 Cambiado'),
  'VALIDATION_ERROR',
  'editar con otro código da VALIDATION_ERROR'
);

select is(
  (select name from public.publication_plans where code = 'cc038-basico-20'),
  'CC038 Renombrado',
  'el intento rechazado no cambia la fila'
);
select is(pg_temp.plan_id('cc038-otro'), null, 'ningún plan quedó con el código pedido');
select is(
  (select count(*)::integer from public.publication_plans where code like 'cc038-basico-20%'),
  3,
  'siguen los tres planes con sus códigos'
);

select * from finish();
rollback;
