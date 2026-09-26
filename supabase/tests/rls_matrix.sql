begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(55);

-- IDs para los actores de la matriz
create function pg_temp.admin_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000a1'::uuid $$;
create function pg_temp.merchant_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000b1'::uuid $$;
create function pg_temp.merchant_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000b2'::uuid $$;
create function pg_temp.merchant_idle_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000b3'::uuid $$;
create function pg_temp.courier_pending_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c1'::uuid $$;
create function pg_temp.courier_approved_1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c2'::uuid $$;
create function pg_temp.courier_approved_2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c3'::uuid $$;
create function pg_temp.courier_suspended_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000c4'::uuid $$;

-- IDs de solicitudes y ofertas
create function pg_temp.req_m1_pub_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000101'::uuid $$;
create function pg_temp.req_m1_matched_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000102'::uuid $$;
create function pg_temp.req_m2_pub_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000103'::uuid $$;
create function pg_temp.offer_c1_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000201'::uuid $$;
create function pg_temp.offer_c2_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000202'::uuid $$;

-- Helper para cambiar contexto de autenticación como en Supabase
create function pg_temp.act_as(role_name text, actor_id uuid default null)
returns void
language plpgsql
as $$
begin
  if role_name = 'anon' then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

create function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Setup fixture data como superusuario
do $$
declare
  zone_id uuid;
begin
  select id into zone_id from public.zones where active limit 1;

  -- Usuarios en auth.users
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (pg_temp.admin_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm1@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.merchant_idle_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm3@example.test', 'pwd', '{"role": "merchant"}'),
    (pg_temp.courier_pending_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_approved_1_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_approved_2_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3@example.test', 'pwd', '{"role": "courier"}'),
    (pg_temp.courier_suspended_id(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c4@example.test', 'pwd', '{"role": "courier"}');

  -- Promover admin vía bootstrap oficial
  update public.profiles set role = 'admin' where id = pg_temp.admin_id();

  -- Activar consent_status para actores operativos de la matriz
  update public.profiles set consent_status = 'active'
  where id in (
    pg_temp.merchant_1_id(),
    pg_temp.merchant_2_id(),
    pg_temp.merchant_idle_id(),
    pg_temp.courier_approved_1_id(),
    pg_temp.courier_approved_2_id(),
    pg_temp.courier_suspended_id()
  );

  -- Ajustar estados de couriers
  update public.couriers set status = 'approved', available = true where profile_id in (pg_temp.courier_approved_1_id(), pg_temp.courier_approved_2_id());
  update public.couriers set status = 'suspended' where profile_id = pg_temp.courier_suspended_id();

  -- Solicitudes
  insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status, expires_at)
  values
    (pg_temp.req_m1_pub_id(), pg_temp.merchant_1_id(), zone_id, zone_id, 'chico', 'cash', 'published', now() + interval '1 hour'),
    (pg_temp.req_m1_matched_id(), pg_temp.merchant_1_id(), zone_id, zone_id, 'chico', 'cash', 'matched', now() + interval '1 hour'),
    (pg_temp.req_m2_pub_id(), pg_temp.merchant_2_id(), zone_id, zone_id, 'mediano', 'transfer', 'published', now() + interval '1 hour');

  -- Contactos
  insert into public.delivery_request_contacts (request_id, pickup_address, dropoff_address, recipient_name, recipient_phone)
  values
    (pg_temp.req_m1_pub_id(), 'San Martin 100', 'Alberdi 200', 'Destinatario M1 Pub', '3865111111'),
    (pg_temp.req_m1_matched_id(), 'San Martin 100', 'Belgrano 300', 'Destinatario M1 Matched', '3865222222'),
    (pg_temp.req_m2_pub_id(), 'Mitre 500', 'Avellaneda 600', 'Destinatario M2 Pub', '3865333333');

  -- Ofertas
  insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
  values
    (pg_temp.offer_c1_id(), pg_temp.req_m1_matched_id(), pg_temp.courier_approved_1_id(), 1500, 15, 'accepted'),
    (pg_temp.offer_c2_id(), pg_temp.req_m1_pub_id(), pg_temp.courier_approved_2_id(), 1600, 20, 'pending');

  -- Vincular oferta aceptada
  update public.delivery_requests set accepted_offer_id = pg_temp.offer_c1_id() where id = pg_temp.req_m1_matched_id();
end;
$$;

-- 1. anon no ve delivery_requests
select pg_temp.act_as('anon');
select is(
  (select count(*) from public.delivery_requests),
  0::bigint,
  'anon sees 0 delivery_requests'
);

-- 2. anon no ve delivery_request_contacts
select is(
  (select count(*) from public.delivery_request_contacts),
  0::bigint,
  'anon sees 0 delivery_request_contacts'
);

-- 3. H04: anon ve zonas activas sin error de permisos
select ok(
  (select count(*) from public.zones where active) >= 1,
  'anon can select active zones without permission error'
);

-- 4. merchant_1 ve sus solicitudes, no las de merchant_2
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select is(
  (select count(*) from public.delivery_requests),
  2::bigint,
  'merchant_1 sees only its own 2 delivery_requests'
);

-- 5. merchant_1 ve los contactos de sus solicitudes
select is(
  (select count(*) from public.delivery_request_contacts),
  2::bigint,
  'merchant_1 sees contacts for its own 2 requests'
);

-- 6. courier pending ve 0 delivery_requests
select pg_temp.act_as('authenticated', pg_temp.courier_pending_id());
select is(
  (select count(*) from public.delivery_requests),
  0::bigint,
  'courier pending sees 0 delivery_requests'
);

-- 7. courier suspended ve 0 delivery_requests
select pg_temp.act_as('authenticated', pg_temp.courier_suspended_id());
select is(
  (select count(*) from public.delivery_requests),
  0::bigint,
  'courier suspended sees 0 delivery_requests'
);

-- 8. courier approved ve solicitudes published
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select count(*) from public.delivery_requests where status = 'published'),
  2::bigint,
  'courier approved sees 2 published delivery_requests'
);

-- 9. INVARIANTE CLAVE: courier approved_1 ve SOLO contactos de la solicitud donde es el asignado
select is(
  (select array_agg(request_id order by request_id) from public.delivery_request_contacts),
  array[pg_temp.req_m1_matched_id()],
  'courier approved sees contacts ONLY for matched request where it is the accepted courier'
);

-- 10. courier approved_2 NO ve contactos de req_m1_matched
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select is(
  (select count(*) from public.delivery_request_contacts),
  0::bigint,
  'courier approved_2 sees 0 contacts because it was not accepted on any request'
);

-- 11. H03: courier approved ve comercios con solicitudes activas pero NO ve comercio ocioso
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select ok(
  exists (
    select 1
    from public.merchant_public
    where profile_id = pg_temp.merchant_1_id()
  )
  and not exists (
    select 1
    from public.merchant_public
    where profile_id = pg_temp.merchant_idle_id()
  ),
  'courier sees active merchants with requests but cannot see idle merchant'
);

-- 12. merchant ve ofertas de sus solicitudes
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select is(
  (select count(*) from public.offers),
  2::bigint,
  'merchant_1 sees the 2 offers made to its requests'
);

-- 13. courier approved ve solo sus propias ofertas
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select count(*) from public.offers),
  1::bigint,
  'courier approved_1 sees only its 1 own offer'
);

-- 14. Storage courier-docs: bucket existe y es privado
select pg_temp.reset_actor();
select ok(
  exists (select 1 from storage.buckets where id = 'courier-docs' and not public),
  'bucket courier-docs exists and is private'
);

-- 15. Storage courier-docs: select denegado a courier autenticado
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select is(
  (select count(*) from storage.objects where bucket_id = 'courier-docs'),
  0::bigint,
  'direct select on storage courier-docs is denied to authenticated couriers'
);

-- 16. H09: Storage courier-docs: insert denegado a actor sin rol courier
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (gen_random_uuid(), ''courier-docs'', ''courier/'' || pg_temp.merchant_1_id() || ''/test.png'')',
  '42501'::char(5),
  null::text,
  'merchant cannot insert into courier-docs bucket'
);

-- 17. admin ve todas las solicitudes y contactos
select pg_temp.act_as('authenticated', pg_temp.admin_id());
select is(
  (select count(*) from public.delivery_requests),
  3::bigint,
  'admin sees all 3 delivery_requests'
);

-- 18. H07 (PR54): merchant puede hacer update y dispara set_updated_at sin error de permisos
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select lives_ok(
  'update public.delivery_requests set notes = ''updated by merchant'' where id = pg_temp.req_m1_pub_id()',
  'merchant can update its own request and trigger set_updated_at executes without privilege error'
);

-- 19. H05: profiles update legítimo permitido
select lives_ok(
  'update public.profiles set display_name = ''Comercio Test'' where id = pg_temp.merchant_1_id()',
  'profile owner can update display_name'
);

-- 20. H05: profiles update rechaza auto-promoción a admin
select throws_ok(
  'update public.profiles set role = ''admin'' where id = pg_temp.merchant_1_id()',
  '42501'::char(5),
  null::text,
  'profile owner cannot elevate role to admin'
);

-- 21. H05: couriers update legítimo permitido
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select lives_ok(
  'update public.couriers set available = false, vehicle_plate = ''123XYZ'' where profile_id = pg_temp.courier_approved_1_id()',
  'courier can update operational availability and plate'
);

-- 22. H01: couriers update rechaza autoverificación de documentos
select throws_ok(
  'update public.couriers set license_status = ''verified'', insurance_status = ''verified'' where profile_id = pg_temp.courier_approved_1_id()',
  '42501'::char(5),
  null::text,
  'courier cannot self-verify license or insurance status'
);

-- 23. H01: couriers update rechaza falsificar aprobación administrativa
select throws_ok(
  'update public.couriers set decided_by = pg_temp.admin_id() where profile_id = pg_temp.courier_approved_1_id()',
  '42501'::char(5),
  null::text,
  'courier cannot forge decided_by approval record'
);

-- 24. H05: merchants update legítimo permitido
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select lives_ok(
  'update public.merchants set business_name = ''Pizzeria Centro'' where profile_id = pg_temp.merchant_1_id()',
  'merchant can update business_name'
);

-- 25. H02: merchants update rechaza autoconcederse suscripción
select throws_ok(
  'update public.merchants set subscription_status = ''active'', paid_until = ''2099-12-31'' where profile_id = pg_temp.merchant_1_id()',
  '42501'::char(5),
  null::text,
  'merchant cannot grant self active subscription or extended paid_until'
);

-- 26. H06: offers update de merchant rechaza alterar monto ofrecido
select throws_ok(
  'update public.offers set amount_ars = 500 where id = pg_temp.offer_c2_id()',
  '42501'::char(5),
  null::text,
  'merchant cannot tamper with courier offer amount'
);

-- 27. H08: incidents insert rechaza reportero sin relación con la solicitud
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select throws_ok(
  'insert into public.incidents (request_id, reporter_id, kind, description) values (pg_temp.req_m1_matched_id(), pg_temp.courier_approved_2_id(), ''complaint'', ''unrelated incident'')',
  '42501'::char(5),
  null::text,
  'unrelated courier cannot create incident on request'
);

-- 28. H08: incidents insert permitido a courier asignado a la solicitud
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select lives_ok(
  'insert into public.incidents (request_id, reporter_id, kind, description) values (pg_temp.req_m1_matched_id(), pg_temp.courier_approved_1_id(), ''delay'', ''pincho rueda'')',
  'assigned courier can create incident on its matched request'
);

-- 29. H11: courier cannot change the amount of an already accepted offer
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select throws_ok(
  'update public.offers set amount_ars = 9000 where id = pg_temp.offer_c1_id()',
  '42501'::char(5),
  null::text,
  'courier cannot change the amount of an already accepted offer'
);

-- 30. H12: merchant cannot mark its own request as delivered
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  'update public.delivery_requests set status = ''delivered'', delivered_at = now() where id = pg_temp.req_m1_pub_id()',
  '42501'::char(5),
  null::text,
  'merchant cannot mark its own request as delivered'
);

-- 31-32. H15: a courier cannot create an offer with a decided lifecycle.
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select throws_ok(
  'insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, status) values (pg_temp.req_m2_pub_id(), pg_temp.courier_approved_1_id(), 1500, 15, ''accepted'')',
  '42501'::char(5), null::text,
  'courier cannot create an offer that is born accepted'
);
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select throws_ok(
  'insert into public.offers (request_id, courier_id, amount_ars, eta_minutes, decided_at) values (pg_temp.req_m2_pub_id(), pg_temp.courier_approved_2_id(), 1500, 15, now())',
  '42501'::char(5), null::text,
  'courier cannot create an offer with a decision timestamp'
);

-- 33-39. H16: only a new draft with server timestamps may be inserted.
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, status) select pg_temp.merchant_1_id(), id, id, ''chico'', ''cash'', ''delivered'' from public.zones where active limit 1',
  '42501'::char(5), null::text,
  'merchant cannot create a request that is born delivered'
);
select throws_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, created_at) select pg_temp.merchant_1_id(), id, id, ''chico'', ''cash'', now() - interval ''1 day'' from public.zones where active limit 1',
  '42501'::char(5), null::text,
  'merchant cannot backdate request creation'
);
select throws_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, published_at) select pg_temp.merchant_1_id(), id, id, ''chico'', ''cash'', now() from public.zones where active limit 1',
  '42501'::char(5), null::text,
  'merchant cannot create a request with published_at set'
);
select throws_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, matched_at) select pg_temp.merchant_1_id(), id, id, ''chico'', ''cash'', now() from public.zones where active limit 1',
  '42501'::char(5), null::text,
  'merchant cannot create a request with matched_at set'
);
select throws_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, picked_up_at) select pg_temp.merchant_1_id(), id, id, ''chico'', ''cash'', now() from public.zones where active limit 1',
  '42501'::char(5), null::text,
  'merchant cannot create a request with picked_up_at set'
);
select throws_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, delivered_at) select pg_temp.merchant_1_id(), id, id, ''chico'', ''cash'', now() from public.zones where active limit 1',
  '42501'::char(5), null::text,
  'merchant cannot create a request with delivered_at set'
);
select throws_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method, cancelled_at) select pg_temp.merchant_1_id(), id, id, ''chico'', ''cash'', now() from public.zones where active limit 1',
  '42501'::char(5), null::text,
  'merchant cannot create a request with cancelled_at set'
);

-- 40-42. H17: document review and retention metadata belong to the server.
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select throws_ok(
  'insert into public.courier_documents (courier_id, kind, storage_path, status) values (pg_temp.courier_approved_2_id(), ''license'', ''courier/c3/license/forged-review.jpg'', ''verified'')',
  '42501'::char(5), null::text,
  'courier cannot upload a document already verified'
);
select throws_ok(
  'insert into public.courier_documents (courier_id, kind, storage_path, purge_after) values (pg_temp.courier_approved_2_id(), ''insurance'', ''courier/c3/insurance/forged-purge.jpg'', now())',
  '42501'::char(5), null::text,
  'courier cannot choose document purge_after'
);
select throws_ok(
  'insert into public.courier_documents (courier_id, kind, storage_path, purge_after, purged_at) values (pg_temp.courier_approved_2_id(), ''avatar'', ''courier/c3/avatar/forged-purged.jpg'', now(), now())',
  '42501'::char(5), null::text,
  'courier cannot mark a new document as purged'
);

-- 43-44. H18: incident resolution belongs to an admin workflow.
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  'insert into public.incidents (request_id, reporter_id, kind, description, status) values (pg_temp.req_m1_pub_id(), pg_temp.merchant_1_id(), ''complaint'', ''forged resolution'', ''resolved'')',
  '42501'::char(5), null::text,
  'merchant cannot create an incident already resolved'
);
select throws_ok(
  'insert into public.incidents (request_id, reporter_id, kind, description, resolution) values (pg_temp.req_m1_pub_id(), pg_temp.merchant_1_id(), ''complaint'', ''forged resolution'', ''closed by me'')',
  '42501'::char(5), null::text,
  'merchant cannot write an incident resolution on insert'
);

-- 45. H19: accepted_at must be the database transaction time.
select throws_ok(
  'insert into public.consents (profile_id, document, version, accepted_at) values (pg_temp.merchant_1_id(), ''tos'', ''v1'', now() - interval ''1 day'')',
  '42501'::char(5), null::text,
  'merchant cannot backdate consent acceptance'
);

-- 46. H20: the legitimate edit to a pending own offer remains possible.
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select lives_ok(
  'update public.offers set message = ''still available'' where id = pg_temp.offer_c2_id()',
  'courier can edit its own pending offer'
);

-- 47. H06: merchant cannot move offer lifecycle outside the T-006 RPC.
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select throws_ok(
  'update public.offers set status = ''accepted'' where id = pg_temp.offer_c2_id()',
  '42501'::char(5), null::text,
  'merchant cannot accept an offer without the RPC'
);

-- 48-49. H20: an owner cannot delete a request or an offer directly.
select pg_temp.reset_actor();
insert into public.delivery_requests (id, merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method)
select '00000000-0000-0000-0000-000000000104'::uuid, pg_temp.merchant_1_id(), id, id, 'chico', 'cash'
from public.zones where active limit 1;
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
delete from public.delivery_requests where id = '00000000-0000-0000-0000-000000000104'::uuid;
select is(
  (select count(*) from public.delivery_requests where id = '00000000-0000-0000-0000-000000000104'::uuid),
  1::bigint,
  'merchant cannot delete its own request'
);
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
delete from public.offers where id = pg_temp.offer_c2_id();
select is(
  (select count(*) from public.offers where id = pg_temp.offer_c2_id()),
  1::bigint,
  'courier cannot delete its own offer'
);

-- 50. H20: lives_ok alone would also accept an UPDATE that changed zero rows.
select is(
  (select message from public.offers where id = pg_temp.offer_c2_id()),
  'still available',
  'courier pending offer edit persisted'
);

-- 51-55. Legitimate inserts still work with the stricter initial-state checks.
select pg_temp.act_as('authenticated', pg_temp.courier_approved_1_id());
select lives_ok(
  'insert into public.offers (request_id, courier_id, amount_ars, eta_minutes) values (pg_temp.req_m2_pub_id(), pg_temp.courier_approved_1_id(), 1500, 15)',
  'approved courier can create a pending offer'
);
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select lives_ok(
  'insert into public.delivery_requests (merchant_id, pickup_zone_id, dropoff_zone_id, package_type, recipient_payment_method) values (pg_temp.merchant_1_id(), (select id from public.zones where active limit 1), (select id from public.zones where active limit 1), ''chico'', ''cash'')',
  'merchant can create a draft request with server timestamps'
);
select pg_temp.act_as('authenticated', pg_temp.courier_approved_2_id());
select lives_ok(
  'insert into public.courier_documents (courier_id, kind, storage_path) values (pg_temp.courier_approved_2_id(), ''license'', ''courier/c3/license/normal-upload.jpg'')',
  'courier can submit a document for review'
);
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
select lives_ok(
  'insert into public.incidents (request_id, reporter_id, kind, description) values (pg_temp.req_m1_pub_id(), pg_temp.merchant_1_id(), ''complaint'', ''normal incident'')',
  'merchant can report an open incident'
);
select throws_ok(
  'insert into public.consents (profile_id, document, version) values (pg_temp.merchant_1_id(), ''tos'', ''v1'')',
  '42501',
  null,
  'merchant cannot directly insert consent row via authenticated role (H08)'
);

select * from finish();
rollback;
