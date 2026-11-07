begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(63);

-- CC-040 (T-414): novedades del admin. Privilegios, autorización, validaciones, tope diario, público, banner, cierre,
-- baja de promociones, destinatarios del push, registro del envío e historial.
create function pg_temp.u(n integer) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-0000004000' || lpad(n::text, 2, '0'))::uuid
$$;
-- 1 admin · 2 comercio A · 3 comercio B · 4 comercio con consentimiento pendiente
-- 5 repartidor A (aprobado, se da de baja) · 6 repartidor B (aprobado) · 7 repartidor pendiente de aprobación

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

-- Ejecuta una consulta jsonb como el actor (null = sesión sin sujeto); devuelve {data} o {error}.
create function pg_temp.call(p_actor uuid, p_aal text, p_sql text)
returns jsonb language plpgsql as $$
declare
  v_result jsonb;
begin
  if p_actor is null then
    set local role authenticated;
    perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'aal', 'aal2')::text, true);
  else
    perform pg_temp.act_as(p_actor, p_aal);
  end if;
  begin
    execute p_sql into v_result;
  exception when others then
    perform pg_temp.reset_actor();
    return jsonb_build_object('error', sqlerrm);
  end;
  perform pg_temp.reset_actor();
  return jsonb_build_object('data', v_result);
end;
$$;

create function pg_temp.err(p_result jsonb) returns text language sql as $$ select p_result->>'error' $$;

create function pg_temp.create_as_admin(p_audience text, p_title text, p_cta text default 'none', p_days integer default 7)
returns jsonb language sql as $$
  select pg_temp.call(
    pg_temp.u(1), 'aal2',
    format('select public.admin_create_announcement(%L, %L, %L, %L, %s)', p_audience, p_title, 'Texto de ' || p_title, p_cta, p_days)
  )
$$;

create function pg_temp.mine(p_actor uuid) returns jsonb language sql as $$
  select pg_temp.call(p_actor, 'aal1', 'select public.get_my_announcement()')
$$;

-- Admin primero y conteo base del público, para no depender de otros perfiles de la base.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values (pg_temp.u(1), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc040.ad@example.test', 'pwd', '{"role":"merchant"}'::jsonb);
update public.profiles set consent_status = 'active', role = 'admin', display_name = 'Admin CC040' where id = pg_temp.u(1);
delete from public.merchants where profile_id = pg_temp.u(1);

create temp table baseline as
select
  (pg_temp.call(pg_temp.u(1), 'aal2', 'select public.admin_count_announcement_audience(''merchants'')'))->'data' as merchants,
  (pg_temp.call(pg_temp.u(1), 'aal2', 'select public.admin_count_announcement_audience(''couriers'')'))->'data' as couriers;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  (pg_temp.u(2), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc040.ma@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.u(3), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc040.mb@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.u(4), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc040.mp@example.test', 'pwd', '{"role":"merchant"}'::jsonb),
  (pg_temp.u(5), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc040.ca@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.u(6), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc040.cb@example.test', 'pwd', '{"role":"courier"}'::jsonb),
  (pg_temp.u(7), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cc040.cp@example.test', 'pwd', '{"role":"courier"}'::jsonb);

update public.profiles set consent_status = 'active'
where id in (pg_temp.u(2), pg_temp.u(3), pg_temp.u(5), pg_temp.u(6), pg_temp.u(7));
update public.couriers set status = 'approved' where profile_id in (pg_temp.u(5), pg_temp.u(6));

-- Preferencias: A acepta y tiene suscripción; B sin fila; repartidor A se dio de baja; repartidor B acepta sin suscripción.
insert into public.promotion_preferences (profile_id, push_promotions)
values (pg_temp.u(2), true), (pg_temp.u(5), false), (pg_temp.u(6), true);
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (pg_temp.u(2), 'https://push.example.test/cc040-a', 'p256dh', 'auth');

-- ---------------------------------------------------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------------------------------------------------
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.announcements'::regclass, 'public.announcement_dismissals'::regclass,
                   'public.promotion_preferences'::regclass)),
  'las tres tablas tienen RLS'
);
select ok(
  not exists (
    select 1
    from unnest(array['public.announcements', 'public.announcement_dismissals', 'public.promotion_preferences']) t,
         unnest(array['select', 'insert', 'update', 'delete']) priv,
         unnest(array['anon', 'authenticated']) r
    where has_table_privilege(r, t, priv)
  ),
  'anon y authenticated no tienen privilegios de tabla'
);
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'))
   from unnest(array[
     'public.admin_count_announcement_audience(text)',
     'public.admin_create_announcement(text, text, text, text, integer)',
     'public.admin_record_announcement_push(uuid, integer, integer, integer)',
     'public.admin_list_announcements(timestamptz, uuid, integer)',
     'public.get_my_announcement()',
     'public.dismiss_announcement(uuid)',
     'public.set_promotions_opt_in(boolean)'
   ]) f),
  'las siete RPC: execute para authenticated y no para anon'
);
select ok(
  has_function_privilege('service_role', 'public.announcement_push_recipients(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.announcement_push_recipients(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.announcement_push_recipients(uuid)', 'execute'),
  'announcement_push_recipients solo la ejecuta service_role'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid in (
      'public.admin_count_announcement_audience(text)'::regprocedure,
      'public.admin_create_announcement(text, text, text, text, integer)'::regprocedure,
      'public.admin_record_announcement_push(uuid, integer, integer, integer)'::regprocedure,
      'public.admin_list_announcements(timestamptz, uuid, integer)'::regprocedure,
      'public.get_my_announcement()'::regprocedure,
      'public.dismiss_announcement(uuid)'::regprocedure,
      'public.set_promotions_opt_in(boolean)'::regprocedure,
      'public.announcement_push_recipients(uuid)'::regprocedure,
      'app_private.announcement_audience(text)'::regprocedure,
      'app_private.announcement_actor()'::regprocedure,
      'app_private.announcement_is_for(text, uuid)'::regprocedure
    )
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'public no tiene execute en ninguna función de CC-040'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Autorización
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', 'select public.admin_count_announcement_audience(''merchants'')')),
  'UNAUTHORIZED_ACTOR', 'un comercio no cuenta destinatarios'
);
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal1', 'select public.admin_count_announcement_audience(''merchants'')')),
  'AAL2_REQUIRED', 'un admin aal1 recibe AAL2_REQUIRED'
);
select is(
  pg_temp.err(pg_temp.call(null, 'aal2', 'select public.admin_create_announcement(''merchants'', ''T'', ''B'', ''none'', 7)')),
  'UNAUTHENTICATED', 'sin sujeto no se crea una novedad'
);
select is(pg_temp.err(pg_temp.mine(pg_temp.u(1))), 'UNAUTHORIZED_ACTOR', 'el admin no tiene banner propio');
select is(pg_temp.err(pg_temp.mine(pg_temp.u(4))), 'UNAUTHORIZED_ACTOR', 'un comercio sin consentimiento activo no lee');
select is(pg_temp.err(pg_temp.mine(null)), 'UNAUTHENTICATED', 'sin sujeto: UNAUTHENTICATED');

-- PR542-H05: matriz de autorización por RPC. Las cuatro del admin × (sin sesión, comercio, admin aal1) y las tres del
-- usuario × (sin sesión, admin, comercio sin consentimiento activo), con un id válido inexistente donde hace falta.
create function pg_temp.admin_rpc(p_name text) returns text language sql as $$
  select case p_name
    when 'count' then 'select public.admin_count_announcement_audience(''merchants'')'
    when 'create' then 'select public.admin_create_announcement(''merchants'', ''T'', ''B'', ''none'', 7)'
    when 'record' then 'select public.admin_record_announcement_push(''00000000-0000-4000-8000-0000004099fe''::uuid, 0, 0, 0)'
    when 'list' then 'select public.admin_list_announcements(null, null, 5)'
  end
$$;
create function pg_temp.user_rpc(p_name text) returns text language sql as $$
  select case p_name
    when 'mine' then 'select public.get_my_announcement()'
    when 'dismiss' then 'select public.dismiss_announcement(''00000000-0000-4000-8000-0000004099fe''::uuid)'
    when 'optin' then 'select public.set_promotions_opt_in(true)'
  end
$$;

select is(pg_temp.err(pg_temp.call(null, 'aal2', pg_temp.admin_rpc('count'))), 'UNAUTHENTICATED', 'count: sin sesión');
select is(pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', pg_temp.admin_rpc('create'))), 'UNAUTHORIZED_ACTOR', 'create: comercio');
select is(pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal1', pg_temp.admin_rpc('create'))), 'AAL2_REQUIRED', 'create: admin aal1');
select is(pg_temp.err(pg_temp.call(null, 'aal2', pg_temp.admin_rpc('record'))), 'UNAUTHENTICATED', 'record: sin sesión');
select is(pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', pg_temp.admin_rpc('record'))), 'UNAUTHORIZED_ACTOR', 'record: comercio');
select is(pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal1', pg_temp.admin_rpc('record'))), 'AAL2_REQUIRED', 'record: admin aal1');
select is(pg_temp.err(pg_temp.call(null, 'aal2', pg_temp.admin_rpc('list'))), 'UNAUTHENTICATED', 'list: sin sesión');
select is(pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', pg_temp.admin_rpc('list'))), 'UNAUTHORIZED_ACTOR', 'list: comercio');
select is(pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal1', pg_temp.admin_rpc('list'))), 'AAL2_REQUIRED', 'list: admin aal1');
select is(pg_temp.err(pg_temp.call(null, 'aal1', pg_temp.user_rpc('dismiss'))), 'UNAUTHENTICATED', 'dismiss: sin sesión');
select is(pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2', pg_temp.user_rpc('dismiss'))), 'UNAUTHORIZED_ACTOR', 'dismiss: admin');
select is(pg_temp.err(pg_temp.call(pg_temp.u(4), 'aal1', pg_temp.user_rpc('dismiss'))), 'UNAUTHORIZED_ACTOR', 'dismiss: comercio sin consentimiento activo');
select is(pg_temp.err(pg_temp.call(null, 'aal1', pg_temp.user_rpc('optin'))), 'UNAUTHENTICATED', 'set_promotions_opt_in: sin sesión');
select is(pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2', pg_temp.user_rpc('optin'))), 'UNAUTHORIZED_ACTOR', 'set_promotions_opt_in: admin');
select is(pg_temp.err(pg_temp.call(pg_temp.u(4), 'aal1', pg_temp.user_rpc('optin'))), 'UNAUTHORIZED_ACTOR', 'set_promotions_opt_in: comercio sin consentimiento activo');

-- ---------------------------------------------------------------------------------------------------------------------
-- Validaciones
-- ---------------------------------------------------------------------------------------------------------------------
select is(pg_temp.err(pg_temp.create_as_admin('merchants', '   ')), 'VALIDATION_ERROR', 'título vacío');
select is(pg_temp.err(pg_temp.create_as_admin('merchants', repeat('x', 61))), 'VALIDATION_ERROR', 'título de 61');
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2',
    format('select public.admin_create_announcement(''merchants'', ''T'', %L, ''none'', 7)', repeat('y', 141)))),
  'VALIDATION_ERROR', 'texto de 141'
);
select is(
  pg_temp.err(pg_temp.create_as_admin('merchants', 'Acción ajena', 'courier_feed')),
  'VALIDATION_ERROR', 'una acción de repartidor no va a comercios'
);
select is(
  pg_temp.err(pg_temp.create_as_admin('all', 'Acción con ambos', 'merchant_plan')),
  'VALIDATION_ERROR', 'con ambos públicos no hay botón'
);
select ok(
  pg_temp.err(pg_temp.create_as_admin('merchants', 'Cero días', 'none', 0)) = 'VALIDATION_ERROR'
  and pg_temp.err(pg_temp.create_as_admin('merchants', 'Treinta y un días', 'none', 31)) = 'VALIDATION_ERROR',
  'los días visibles van de 1 a 30'
);
select is(pg_temp.err(pg_temp.create_as_admin('todos', 'Público raro')), 'VALIDATION_ERROR', 'público desconocido');

-- ---------------------------------------------------------------------------------------------------------------------
-- Público estimado
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  (pg_temp.call(pg_temp.u(1), 'aal2', 'select public.admin_count_announcement_audience(''merchants'')'))->'data',
  jsonb_build_object(
    'recipients', (select (merchants->>'recipients')::integer + 2 from baseline),
    'pushRecipients', (select (merchants->>'pushRecipients')::integer + 1 from baseline)
  ),
  'comercios: los dos activos (no el pendiente); push solo el que aceptó y tiene suscripción'
);
select is(
  (pg_temp.call(pg_temp.u(1), 'aal2', 'select public.admin_count_announcement_audience(''couriers'')'))->'data',
  jsonb_build_object(
    'recipients', (select (couriers->>'recipients')::integer + 1 from baseline),
    'pushRecipients', (select (couriers->>'pushRecipients')::integer from baseline)
  ),
  'repartidores: el aprobado sin baja; ni el dado de baja ni el pendiente; sin suscripción no suma push'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Alta, auditoría y tope diario
-- ---------------------------------------------------------------------------------------------------------------------
create temp table ann (n integer primary key, id uuid);
insert into ann values
  (1, ((pg_temp.create_as_admin('merchants', 'A1 comercios', 'merchant_plan'))->'data'->>'announcementId')::uuid),
  (2, ((pg_temp.create_as_admin('couriers', 'A2 repartidores', 'courier_feed'))->'data'->>'announcementId')::uuid),
  (3, ((pg_temp.create_as_admin('all', 'A3 todos'))->'data'->>'announcementId')::uuid),
  (4, ((pg_temp.create_as_admin('merchants', 'A4 vencida'))->'data'->>'announcementId')::uuid),
  (5, ((pg_temp.create_as_admin('merchants', 'A5 comercios', 'merchant_new_request', 3))->'data'->>'announcementId')::uuid);

select is((select count(*)::integer from ann where id is not null), 5, 'se crearon cinco novedades');
select ok(
  (select visible_until between now() + interval '3 days' - interval '1 minute' and now() + interval '3 days' + interval '1 minute'
   from public.announcements where id = (select id from ann where n = 5)),
  'la vigencia es ahora más los días pedidos'
);
select is(
  (select after->>'title' from public.audit_log
   where action = 'admin_create_announcement' and target_id = (select id::text from ann where n = 5)),
  'A5 comercios', 'el alta queda en la auditoría'
);
select is(pg_temp.err(pg_temp.create_as_admin('merchants', 'A6 sexta')), 'RATE_LIMITED', 'la sexta en 24 h da RATE_LIMITED');

-- Fechas distintas para ordenar, y A4 ya vencida.
update public.announcements set created_at = now() - (6 - (select n from ann where ann.id = announcements.id)) * interval '1 hour'
where id in (select id from ann);
update public.announcements set visible_until = now() - interval '1 minute' where id = (select id from ann where n = 4);

-- ---------------------------------------------------------------------------------------------------------------------
-- Banner
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  (pg_temp.mine(pg_temp.u(2)))->'data'->'announcement'->>'id',
  (select id::text from ann where n = 5),
  'el comercio ve la vigente más reciente de su público'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys((pg_temp.mine(pg_temp.u(2)))->'data'->'announcement') k),
  array['body', 'cta', 'id', 'title'],
  'el banner expone solo id, title, body y cta'
);
select is(
  (pg_temp.call(pg_temp.u(2), 'aal1', format('select public.dismiss_announcement(%L)', (select id from ann where n = 5))))->'data',
  '{"dismissed": true}'::jsonb, 'el comercio cierra la novedad'
);
select is(
  (pg_temp.mine(pg_temp.u(2)))->'data'->'announcement'->>'id',
  (select id::text from ann where n = 3),
  'cerrada la más reciente, ve la siguiente de su público (A3, para todos); la vencida no'
);
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', format('select public.dismiss_announcement(%L)', (select id from ann where n = 5)))),
  null, 'cerrar dos veces es idempotente'
);
select is(
  (pg_temp.mine(pg_temp.u(3)))->'data'->'announcement'->>'id',
  (select id::text from ann where n = 5),
  'el cierre es por cuenta: otro comercio la sigue viendo'
);
select is(
  (pg_temp.mine(pg_temp.u(6)))->'data'->'announcement'->>'id',
  (select id::text from ann where n = 3),
  'el repartidor ve la más reciente de repartidores o todos'
);
select is((pg_temp.mine(pg_temp.u(5)))->'data', '{"announcement": null}'::jsonb, 'quien se dio de baja no ve banner');
select is((pg_temp.mine(pg_temp.u(7)))->'data', '{"announcement": null}'::jsonb, 'un repartidor no aprobado no ve banner');
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', format('select public.dismiss_announcement(%L)', (select id from ann where n = 2)))),
  'NOT_FOUND', 'un comercio no cierra una novedad de repartidores'
);
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', 'select public.dismiss_announcement(''00000000-0000-4000-8000-0000004099ff''::uuid)')),
  'NOT_FOUND', 'una novedad inexistente da NOT_FOUND'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Baja de promociones
-- ---------------------------------------------------------------------------------------------------------------------
select ok(
  (pg_temp.call(pg_temp.u(3), 'aal1', 'select public.set_promotions_opt_in(false)'))->'data' = '{"enabled": false}'::jsonb
  and (pg_temp.mine(pg_temp.u(3)))->'data' = '{"announcement": null}'::jsonb,
  'darse de baja oculta el banner'
);
-- La lectura va en otra sentencia: dentro de la misma, la consulta vería la foto previa a la RPC.
create temp table reaccept as
select (pg_temp.call(pg_temp.u(3), 'aal1', 'select public.set_promotions_opt_in(true)'))->'data' as r;
select ok(
  (select r from reaccept) = '{"enabled": true}'::jsonb
  and (select push_promotions from public.promotion_preferences where profile_id = pg_temp.u(3)),
  'volver a aceptar guarda la preferencia'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Destinatarios del push
-- ---------------------------------------------------------------------------------------------------------------------
select ok(
  (select array_agg(r) from public.announcement_push_recipients((select id from ann where n = 5)) r)
    @> array[pg_temp.u(2), pg_temp.u(3)]
  and not ((select array_agg(r) from public.announcement_push_recipients((select id from ann where n = 5)) r)
    && array[pg_temp.u(4), pg_temp.u(5), pg_temp.u(6), pg_temp.u(7)]),
  'push a comercios: solo los que aceptaron, sin pendientes ni repartidores'
);
select ok(
  pg_temp.u(6) = any (array(select public.announcement_push_recipients((select id from ann where n = 3))))
  and not (pg_temp.u(5) = any (array(select public.announcement_push_recipients((select id from ann where n = 3))))),
  'push a todos: el repartidor que aceptó sí, el que se dio de baja no'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Registro del envío push
-- ---------------------------------------------------------------------------------------------------------------------
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2',
    format('select public.admin_record_announcement_push(%L, 3, 2, 1)', (select id from ann where n = 5)))),
  null, 'se registra el resultado del push'
);
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2',
    format('select public.admin_record_announcement_push(%L, 3, 2, 1)', (select id from ann where n = 5)))),
  'INVALID_STATE_TRANSITION', 'el resultado se registra una sola vez'
);
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2',
    format('select public.admin_record_announcement_push(%L, 1, 2, 0)', (select id from ann where n = 3)))),
  'VALIDATION_ERROR', 'enviados más fallidos no superan los destinatarios'
);
select is(
  pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2',
    'select public.admin_record_announcement_push(''00000000-0000-4000-8000-0000004099ff''::uuid, 0, 0, 0)')),
  'NOT_FOUND', 'una novedad inexistente da NOT_FOUND'
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Historial
-- ---------------------------------------------------------------------------------------------------------------------
create temp table page1 as
select (pg_temp.call(pg_temp.u(1), 'aal2', 'select public.admin_list_announcements(null, null, 2)'))->'data' as r;
select is(
  (select array_agg((e->>'id')::uuid order by ord) from page1, jsonb_array_elements(r->'items') with ordinality t(e, ord)),
  array[(select id from ann where n = 5), (select id from ann where n = 4)],
  'primera página: las más recientes primero'
);
select is(
  (select array_agg((e->>'id')::uuid order by ord)
   from page1,
        jsonb_array_elements(
          (pg_temp.call(pg_temp.u(1), 'aal2', format(
            'select public.admin_list_announcements(%L::timestamptz, %L::uuid, 2)',
            r->'nextCursor'->>'createdAt', r->'nextCursor'->>'id')))->'data'->'items'
        ) with ordinality t(e, ord)),
  array[(select id from ann where n = 3), (select id from ann where n = 2)],
  'segunda página por keyset'
);
select is(
  (select jsonb_build_object('createdByName', e->'createdByName', 'pushSent', e->'pushSent', 'cta', e->'cta')
   from page1, jsonb_array_elements(r->'items') e where e->>'id' = (select id::text from ann where n = 5)),
  '{"createdByName": "Admin CC040", "pushSent": 2, "cta": "merchant_new_request"}'::jsonb,
  'cada fila trae quién la creó, la acción y el resultado del push'
);
select ok(
  pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2', 'select public.admin_list_announcements(null, null, 0)')) = 'VALIDATION_ERROR'
  and pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal2', 'select public.admin_list_announcements(now(), null, 10)')) = 'VALIDATION_ERROR',
  'límite fuera de 1–50 o cursor incompleto: VALIDATION_ERROR'
);
select ok(
  pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1', 'select to_jsonb(count(*)) from public.announcements')) like 'permission denied%',
  'un comercio no lee la tabla directamente'
);

select * from finish();
rollback;
