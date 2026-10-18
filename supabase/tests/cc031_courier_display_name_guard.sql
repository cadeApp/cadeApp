begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.cc031_id(n integer) returns uuid language sql immutable as $$
  select ('31000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- Ejecuta SQL como cliente real (no SECURITY DEFINER); devuelve error estático o filas.
create function pg_temp.cc031_run(n integer, statement text, client_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare affected bigint;
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', pg_temp.cc031_id(n), 'role', client_role, 'aal', 'aal2')::text, true);
  execute format('set local role %I', client_role);
  execute statement;
  get diagnostics affected = row_count;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('code', '00000', 'rows', affected);
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return jsonb_build_object('code', sqlstate, 'message', sqlerrm);
end;
$$;

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
select pg_temp.cc031_id(n), '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'cc031.' || n || '@example.test', 'pwd',
  jsonb_build_object('role', case when n in (3, 4) then 'merchant' else 'courier' end)
from generate_series(1, 6) n;
update public.profiles set display_name = 'Original', phone = '3865000001', consent_status = 'active'
where id in (select pg_temp.cc031_id(n) from generate_series(1, 6) n);
update public.profiles set role = 'admin' where id = pg_temp.cc031_id(4);
update public.profiles set consent_status = 'pending' where id = pg_temp.cc031_id(5);
update public.profiles set consent_status = 'reconsent_required' where id = pg_temp.cc031_id(6);

create function pg_temp.cc031_name_probe() returns jsonb language sql as $$
  select pg_temp.cc031_run(1,
    'update public.profiles set display_name = ''Changed'' where id = pg_temp.cc031_id(1)');
$$;

select is(pg_temp.cc031_name_probe(),
  '{"code":"42501","message":"COURIER_DISPLAY_NAME_IMMUTABLE"}'::jsonb,
  'GREEN: direct courier name update rejected with exact non-sensitive error');
select is(pg_temp.cc031_name_probe()->>'code', '42501', 'retry remains rejected');
select is((select display_name from public.profiles where id = pg_temp.cc031_id(1)),
  'Original', 'rejected name persists unchanged');
select is(pg_temp.cc031_run(1,
  'update public.profiles set display_name = ''Changed'', phone = ''3865000002'' where id = pg_temp.cc031_id(1)')->>'code',
  '42501', 'combined phone/name update is atomic and rejected');
select is((select phone from public.profiles where id = pg_temp.cc031_id(1)),
  '3865000001', 'failed combined update did not persist phone');
select is(pg_temp.cc031_run(1,
  'update public.profiles set phone = ''3865000002'', display_name = display_name where id = pg_temp.cc031_id(1)'),
  '{"code":"00000","rows":1}'::jsonb, 'phone and unchanged name allowed');
select is(pg_temp.cc031_run(1,
  'update public.profiles set phone = ''3865000002'' where id = pg_temp.cc031_id(1)')->>'code',
  '00000', 'phone retry allowed');
select is((select phone from public.profiles where id = pg_temp.cc031_id(1)),
  '3865000002', 'phone persists');

select is(pg_temp.cc031_run(1,
  'update public.profiles set phone = ''3865000002'' where id = pg_temp.cc031_id(2)'),
  '{"code":"00000","rows":0}'::jsonb, 'other courier row is invisible to UPDATE');
select is((select phone from public.profiles where id = pg_temp.cc031_id(2)),
  '3865000001', 'other courier unchanged');
select is(pg_temp.cc031_run(1,
  'update public.profiles set role = ''admin'' where id = pg_temp.cc031_id(1)')->>'code',
  '42501', 'cannot self-promote through combined permissive policies');
select is(pg_temp.cc031_run(1,
  'update public.profiles set consent_status = ''pending'' where id = pg_temp.cc031_id(1)')->>'code',
  '42501', 'consent status remains frozen');
select is(pg_temp.cc031_run(1,
  'update public.profiles set created_at = ''2020-01-01'' where id = pg_temp.cc031_id(1)')->>'code',
  '42501', 'created_at remains frozen');
select is(pg_temp.cc031_run(1,
  'update public.profiles set id = pg_temp.cc031_id(99) where id = pg_temp.cc031_id(1)')->>'code',
  '42501', 'cannot transfer ownership');
select is(pg_temp.cc031_run(1,
  'update public.profiles set display_name = ''Changed'', role = ''merchant'' where id = pg_temp.cc031_id(1)')->>'code',
  '42501', 'NEW.role cannot bypass OLD.role guard');
select is(pg_temp.cc031_run(n,
  format('update public.profiles set phone = ''3865000002'' where id = %L', pg_temp.cc031_id(n))),
  '{"code":"00000","rows":0}'::jsonb, 'inactive consent blocks phone: actor ' || n)
from generate_series(5, 6) n;
select is((select count(*) from public.profiles
  where id in (pg_temp.cc031_id(5), pg_temp.cc031_id(6)) and phone = '3865000001'),
  2::bigint, 'inactive actors did not write');

select is(pg_temp.cc031_run(3,
  'update public.profiles set display_name = ''Merchant edited'' where id = pg_temp.cc031_id(3)')->>'code',
  '00000', 'merchant direct name update allowed');
select is((select display_name from public.profiles where id = pg_temp.cc031_id(3)),
  'Merchant edited', 'merchant name persists');
select is(pg_temp.cc031_run(3,
  'select public.update_my_merchant_profile(''{"businessName":"Merchant RPC"}''::jsonb)')->>'code',
  '00000', 'CC-028 merchant RPC remains compatible');
select is((select display_name from public.profiles where id = pg_temp.cc031_id(3)),
  'Merchant RPC', 'CC-028 name persists');
select is(pg_temp.cc031_run(4,
  'update public.profiles set display_name = ''Admin corrected'' where id = pg_temp.cc031_id(1)')->>'code',
  '00000', 'existing admin policy may correct courier identity');
select is((select display_name from public.profiles where id = pg_temp.cc031_id(1)),
  'Admin corrected', 'admin correction persists');
select is(pg_temp.cc031_run(1,
  'update public.profiles set phone = ''3865000003'' where id = pg_temp.cc031_id(1)')->>'code',
  '00000', 'courier phone remains editable after admin correction');
select is(pg_temp.cc031_name_probe()->>'code', '42501', 'admin correction does not unlock self-edit');
select is(pg_temp.cc031_run(1,
  'update public.profiles set display_name = ''Anonymous''', 'anon'),
  '{"code":"00000","rows":0}'::jsonb, 'anon cannot update any profile');

select ok(not has_function_privilege(role_name,
  'app_private.guard_courier_display_name_update()', 'EXECUTE'),
  role_name || ' cannot execute internal function')
from unnest(array['anon', 'authenticated']) role_name;
select is(pg_temp.cc031_run(1,
  'select app_private.guard_courier_display_name_update()')->>'code',
  '42501', 'authenticated direct helper call rejected');
select is(pg_temp.cc031_run(1,
  'create trigger cc031_evil before update on public.profiles for each row execute function app_private.guard_courier_display_name_update()')->>'code',
  '42501', 'client cannot attach trigger');
select ok((select prosecdef and proconfig @> array['search_path=public, pg_temp']
  and pg_get_userbyid(proowner) = 'postgres'
  from pg_proc where oid = 'app_private.guard_courier_display_name_update()'::regprocedure),
  'internal function uses expected owner and fixed SECURITY DEFINER search_path');
select ok(not exists (
  select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.oid = 'app_private.guard_courier_display_name_update()'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'), 'PUBLIC has no EXECUTE grant');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles RLS remains enabled');
select is(pg_temp.cc031_run(99,
  'update public.profiles set display_name = ''Service corrected'' where id = pg_temp.cc031_id(2)', 'service_role')->>'code',
  '00000', 'trusted service role keeps its existing administrative write path');
select is((select display_name from public.profiles where id = pg_temp.cc031_id(2)),
  'Service corrected', 'service role write persists without a client grant');

-- Control de mutación SOLO en transacción de prueba de la base efímera.
-- Misma sonda/oráculo: quitar el trigger debe cambiar el rechazo a una escritura real.
savepoint cc031_mutation;
alter table public.profiles disable trigger guard_courier_display_name_update;
select isnt(pg_temp.cc031_name_probe(),
  '{"code":"42501","message":"COURIER_DISPLAY_NAME_IMMUTABLE"}'::jsonb,
  'RED mutation: original rejection oracle fails with guard disabled');
select is((select display_name from public.profiles where id = pg_temp.cc031_id(1)),
  'Changed', 'RED mutation: bypass really persisted the forbidden name');
rollback to savepoint cc031_mutation;
select is(pg_temp.cc031_name_probe(),
  '{"code":"42501","message":"COURIER_DISPLAY_NAME_IMMUTABLE"}'::jsonb,
  'GREEN restored: same oracle rejects after restoring trigger');
select is((select display_name from public.profiles where id = pg_temp.cc031_id(1)),
  'Admin corrected', 'mutation data rolled back');

-- Transiciones competidoras y serialización de identidad (T-103 / CC-031).
-- En supabase/postgres, dblink_connect está prohibido para no-superusuarios por pg_hba trust (T-103).
-- Se prueba la serialización de estado mediante transiciones competidoras directas bajo RLS:

-- 1. Teléfono actualizado y posterior intento de cambio de nombre:
select is(pg_temp.cc031_run(1,
  'update public.profiles set phone = ''3865000090'' where id = pg_temp.cc031_id(1)')->>'code',
  '00000', 'serialized: phone update succeeds');
select is(pg_temp.cc031_run(1,
  'update public.profiles set display_name = ''Race forbidden'' where id = pg_temp.cc031_id(1)')->>'code',
  '42501', 'serialized: subsequent forbidden name update rejected');
select is((select display_name || ':' || phone from public.profiles where id = pg_temp.cc031_id(1)),
  'Admin corrected:3865000090', 'serialized: identity preserved and phone committed');

-- 2. Corrección administrativa de nombre y posterior actualización de teléfono por courier:
select is(pg_temp.cc031_run(4,
  'update public.profiles set display_name = ''Race corrected'' where id = pg_temp.cc031_id(1)')->>'code',
  '00000', 'serialized: admin corrects name');
select is(pg_temp.cc031_run(1,
  'update public.profiles set phone = ''3865000091'' where id = pg_temp.cc031_id(1)')->>'code',
  '00000', 'serialized: courier updates phone after admin correction');
select is((select display_name || ':' || phone from public.profiles where id = pg_temp.cc031_id(1)),
  'Race corrected:3865000091', 'serialized: administrative identity preserved across phone updates');

-- 3. Revocación de consentimiento y posterior intento de edición de teléfono:
select is(pg_temp.cc031_run(4,
  'update public.profiles set consent_status = ''reconsent_required'' where id = pg_temp.cc031_id(1)')->>'code',
  '00000', 'serialized: consent revoked to reconsent_required');
select is(pg_temp.cc031_run(1,
  'update public.profiles set phone = ''3865000092'' where id = pg_temp.cc031_id(1)'),
  '{"code":"00000","rows":0}'::jsonb, 'serialized: phone update blocked after consent revocation');
select is((select consent_status || ':' || phone from public.profiles where id = pg_temp.cc031_id(1)),
  'reconsent_required:3865000091', 'serialized: consent and last authorized phone intact');

select * from finish();
rollback;
