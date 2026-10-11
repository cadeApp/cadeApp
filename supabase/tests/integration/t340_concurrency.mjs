/**
 * Runner de concurrencia determinista de dos sesiones PostgreSQL para T-340 / CC-022 §2b (H08) y §6 (H14).
 *
 * H08: Verifica la serialización del guard app_private.lock_draft_request_for_child_write()
 * contra public.publish_request() en ambos órdenes de adquisición de lock para:
 *   - INSERT delivery_request_drops
 *   - UPDATE delivery_request_drops
 *   - DELETE delivery_request_drops
 *   - UPDATE delivery_request_drop_contacts
 *
 * H14: Verifica la serialización de dos marcas simultáneas sobre las últimas entregas de una
 * solicitud in_transit (CC-022 §6), asegurando que el cierre a delivered ocurra exactamente una vez
 * y que ningún drop quede en pending:
 *   - mark_drop_delivered + mark_drop_failed
 *   - mark_drop_failed + mark_drop_delivered (orden de tipos invertido)
 *   - mark_drop_failed + mark_drop_failed (cierre en delivered con todas las entregas failed)
 */

import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[H08/H14] ERROR: La variable de entorno DB_CONTAINER no está definida.');
  process.exit(1);
}

function runSql(sql) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8' }
  );
  if (res.status !== 0) {
    throw new Error(`[H08/H14] SQL error: ${res.stderr || res.stdout}\nQuery: ${sql}`);
  }
  return res.stdout.trim();
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.proc = spawn(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.output = '';
    this.pid = null;
    this.proc.stdout.on('data', (d) => {
      this.output += d.toString('utf8');
    });
    this.proc.stderr.on('data', (d) => {
      this.output += d.toString('utf8');
    });
  }

  send(sql) {
    this.proc.stdin.write(sql.trim() + '\n');
  }

  async waitFor(marker, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = typeof marker === 'string' ? this.output.includes(marker) : marker.test(this.output);
      if (found) {
        return this.output;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`[H08/H14][${this.label}] Timeout esperando marcador "${marker}". Salida acumulada:\n${this.output}`);
  }

  async initPid() {
    this.send(`select 'PID:' || pg_backend_pid() || ':ENDPID';`);
    await this.waitFor(/PID:\d+:ENDPID/);
    const m = this.output.match(/PID:(\d+):ENDPID/);
    if (!m) throw new Error(`[H08/H14][${this.label}] No se pudo determinar pg_backend_pid`);
    this.pid = Number(m[1]);
    return this.pid;
  }

  async close() {
    try {
      this.proc.stdin.end();
      this.proc.kill('SIGTERM');
    } catch {}
  }
}

async function waitForBlockedLock(blockerPid, waiterPid, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const countStr = runSql(`
      select count(*)::int
      from pg_stat_activity
      where pid = ${waiterPid}
        and wait_event_type = 'Lock'
        and ${blockerPid} = any(pg_blocking_pids(${waiterPid}));
    `);
    const count = Number(countStr);
    if (count > 0) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(
    `[H08/H14] Timeout esperando que waiter PID ${waiterPid} quede bloqueado por blocker PID ${blockerPid} con wait_event_type = 'Lock'.`
  );
}

async function run() {
  console.log(`[H08/H14] Iniciando runner concurrente contra contenedor: ${dbContainer}`);

  // Preparar actores y entorno común
  const merchantId = '00000000-0000-4000-8000-0000000034a1';
  const courierId = '00000000-0000-4000-8000-0000000034c1';

  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${merchantId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'merchant_conc@test.local', 'pwd', '{"role":"merchant"}'::jsonb),
      ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier_conc@test.local', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values
      ('${merchantId}', 'merchant', 'active'),
      ('${courierId}', 'courier', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';

    insert into public.merchants (profile_id, business_name, subscription_status)
    values ('${merchantId}', 'Comercio Concurrencia', 'pilot')
    on conflict (profile_id) do update set subscription_status = 'pilot';

    insert into public.couriers (profile_id, status, available)
    values ('${courierId}', 'approved', true)
    on conflict (profile_id) do update set status = 'approved', available = true;
  `);

  const zoneId = runSql(`select id from public.zones where active limit 1;`);
  assert.ok(zoneId, 'Se requiere al menos una zona activa');

  const createdRequests = [];

  function createDraftFixture(initialDrops = 1) {
    const reqId = crypto.randomUUID();
    createdRequests.push(reqId);
    runSql(`
      insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status, drops_count)
      values ('${reqId}', '${merchantId}', '${zoneId}', 'draft', ${initialDrops});

      insert into public.delivery_request_contacts (request_id, pickup_address, pickup_lat, pickup_lng)
      values ('${reqId}', 'Calle San Martín 123, Aguilares', -27.4330, -65.6150);
    `);

    const dropIds = [];
    for (let pos = 1; pos <= initialDrops; pos++) {
      const dropId = crypto.randomUUID();
      dropIds.push(dropId);
      runSql(`
        insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status)
        values ('${dropId}', '${reqId}', ${pos}, '${zoneId}', 'chico', 'cash', false, 'pending');

        insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared)
        values ('${dropId}', 'Dirección inicial ${pos}', -27.4250, -65.6080, 'Destinatario ${pos}', '+54386500000${pos}', true);
      `);
    }
    return { reqId, dropIds };
  }

  function createInTransitFixture(dropsCount = 2) {
    const reqId = crypto.randomUUID();
    const offerId = crypto.randomUUID();
    createdRequests.push(reqId);

    runSql(`
      insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status, drops_count)
      values ('${reqId}', '${merchantId}', '${zoneId}', 'in_transit', ${dropsCount});

      insert into public.offers (id, request_id, courier_id, status, amount_ars, eta_minutes)
      values ('${offerId}', '${reqId}', '${courierId}', 'accepted', 1500, 20);

      update public.delivery_requests
      set accepted_offer_id = '${offerId}'
      where id = '${reqId}';

      insert into public.delivery_request_contacts (request_id, pickup_address, pickup_lat, pickup_lng)
      values ('${reqId}', 'Calle San Martín 123, Aguilares', -27.4330, -65.6150);
    `);

    const dropIds = [];
    for (let pos = 1; pos <= dropsCount; pos++) {
      const dropId = crypto.randomUUID();
      dropIds.push(dropId);
      runSql(`
        insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status)
        values ('${dropId}', '${reqId}', ${pos}, '${zoneId}', 'chico', 'cash', false, 'pending');

        insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared)
        values ('${dropId}', 'Dirección entrega ${pos}', -27.4250, -65.6080, 'Destinatario ${pos}', '+54386500000${pos}', true);
      `);
    }
    return { reqId, dropIds };
  }

  try {
    // =========================================================================
    // SECCIÓN 1: H08 — Serialización entre mutaciones de hijo y publish_request
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. INSERT delivery_request_drops vs publish_request
    // -------------------------------------------------------------------------
    console.log('[H08] Escenario 1A: INSERT drop adquiere lock primero...');
    {
      const { reqId } = createDraftFixture(1);

      const s1 = new PsqlSession('S1_INSERT_A');
      const s2 = new PsqlSession('S2_PUBLISH_A');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
          values ('${reqId}', 2, '${zoneId}', 'chico', 'cash', false);
          insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared)
          select id, 'Dirección Drop 2', -27.4250, -65.6080, 'Destinatario 2', '+543865000002', true
          from public.delivery_request_drops
          where request_id = '${reqId}' and position = 2;
          \\echo S1_LOCKED
        `);
        await s1.waitFor('S1_LOCKED');

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          commit;
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');
        await s2.waitFor('S2_DONE');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const dropsCount = runSql(`select count(*)::int from public.delivery_request_drops where request_id = '${reqId}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.equal(dropsCount, '2', 'drops_count debe reflejar la versión confirmada con 2 drops');
        console.log('       -> OK (S2 esperó lock, publicó versión confirmada con 2 drops)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    console.log('[H08] Escenario 1B: publish_request adquiere lock primero...');
    {
      const { reqId } = createDraftFixture(1);

      const s1 = new PsqlSession('S1_PUBLISH_B');
      const s2 = new PsqlSession('S2_INSERT_B');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          \\echo S1_PUBLISHED
        `);
        await s1.waitFor('S1_PUBLISHED');
        assert.ok(
          s1.output.includes('"status": "published"') || s1.output.includes('"status":"published"'),
          'publish_request debe responder status published'
        );

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          insert into public.delivery_request_drops (request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change)
          values ('${reqId}', 2, '${zoneId}', 'chico', 'cash', false);
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');

        await s2.waitFor('INVALID_STATE_TRANSITION');
        assert.ok(!s2.output.includes('S2_DONE'), 'S2 no debe haber emitido S2_DONE por error de serialización');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const countDrops = runSql(`select count(*)::int from public.delivery_request_drops where request_id = '${reqId}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.equal(countDrops, '1', 'El drop 2 no debe haber sido insertado');
        console.log('       -> OK (S2 esperó lock de publicación real y abortó con INVALID_STATE_TRANSITION sin mutar)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    // -------------------------------------------------------------------------
    // 2. UPDATE delivery_request_drops vs publish_request
    // -------------------------------------------------------------------------
    console.log('[H08] Escenario 2A: UPDATE drop adquiere lock primero...');
    {
      const { reqId, dropIds } = createDraftFixture(1);

      const s1 = new PsqlSession('S1_UPDATE_A');
      const s2 = new PsqlSession('S2_PUBLISH_A');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          update public.delivery_request_drops set package_type = 'grande' where id = '${dropIds[0]}';
          \\echo S1_LOCKED
        `);
        await s1.waitFor('S1_LOCKED');

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          commit;
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');
        await s2.waitFor('S2_DONE');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const pkg = runSql(`select package_type from public.delivery_request_drops where id = '${dropIds[0]}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.equal(pkg, 'grande', 'La actualización a grande debe confirmarse');
        console.log('       -> OK (S2 esperó lock, publicó versión con package_type actualizado)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    console.log('[H08] Escenario 2B: publish_request adquiere lock primero...');
    {
      const { reqId, dropIds } = createDraftFixture(1);

      const s1 = new PsqlSession('S1_PUBLISH_B');
      const s2 = new PsqlSession('S2_UPDATE_B');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          \\echo S1_PUBLISHED
        `);
        await s1.waitFor('S1_PUBLISHED');
        assert.ok(
          s1.output.includes('"status": "published"') || s1.output.includes('"status":"published"'),
          'publish_request debe responder status published'
        );

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          update public.delivery_request_drops set package_type = 'grande' where id = '${dropIds[0]}';
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');

        await s2.waitFor('INVALID_STATE_TRANSITION');
        assert.ok(!s2.output.includes('S2_DONE'), 'S2 no debe haber emitido S2_DONE por error de serialización');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const pkg = runSql(`select package_type from public.delivery_request_drops where id = '${dropIds[0]}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.equal(pkg, 'chico', 'package_type debe permanecer intacto');
        console.log('       -> OK (S2 esperó lock de publicación real y abortó con INVALID_STATE_TRANSITION sin mutar)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    // -------------------------------------------------------------------------
    // 3. DELETE delivery_request_drops vs publish_request
    // -------------------------------------------------------------------------
    console.log('[H08] Escenario 3A: DELETE drop adquiere lock primero...');
    {
      const { reqId, dropIds } = createDraftFixture(2);

      const s1 = new PsqlSession('S1_DELETE_A');
      const s2 = new PsqlSession('S2_PUBLISH_A');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          delete from public.delivery_request_drops where id = '${dropIds[1]}';
          \\echo S1_LOCKED
        `);
        await s1.waitFor('S1_LOCKED');

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          commit;
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');
        await s2.waitFor('S2_DONE');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const dropsCount = runSql(`select count(*)::int from public.delivery_request_drops where request_id = '${reqId}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.equal(dropsCount, '1', 'drops_count debe reflejar 1 solo drop tras delete');
        console.log('       -> OK (S2 esperó lock, publicó versión confirmada con 1 drop restante)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    console.log('[H08] Escenario 3B: publish_request adquiere lock primero...');
    {
      const { reqId, dropIds } = createDraftFixture(2);

      const s1 = new PsqlSession('S1_PUBLISH_B');
      const s2 = new PsqlSession('S2_DELETE_B');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          \\echo S1_PUBLISHED
        `);
        await s1.waitFor('S1_PUBLISHED');
        assert.ok(
          s1.output.includes('"status": "published"') || s1.output.includes('"status":"published"'),
          'publish_request debe responder status published'
        );

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          delete from public.delivery_request_drops where id = '${dropIds[1]}';
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');

        await s2.waitFor('INVALID_STATE_TRANSITION');
        assert.ok(!s2.output.includes('S2_DONE'), 'S2 no debe haber emitido S2_DONE por error de serialización');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const countDrops = runSql(`select count(*)::int from public.delivery_request_drops where id = '${dropIds[1]}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.equal(countDrops, '1', 'El drop 2 no debe haber sido eliminado');
        console.log('       -> OK (S2 esperó lock de publicación real y abortó con INVALID_STATE_TRANSITION sin mutar)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    // -------------------------------------------------------------------------
    // 4. UPDATE delivery_request_drop_contacts vs publish_request
    // -------------------------------------------------------------------------
    console.log('[H08] Escenario 4A: UPDATE drop_contacts adquiere lock primero...');
    {
      const { reqId, dropIds } = createDraftFixture(1);

      const s1 = new PsqlSession('S1_UPDATE_CONTACTS_A');
      const s2 = new PsqlSession('S2_PUBLISH_A');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          update public.delivery_request_drop_contacts set dropoff_address = 'Calle Confirmada Modificada' where drop_id = '${dropIds[0]}';
          \\echo S1_LOCKED
        `);
        await s1.waitFor('S1_LOCKED');

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          commit;
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');
        await s2.waitFor('S2_DONE');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const addr = runSql(`select dropoff_address from public.delivery_request_drop_contacts where drop_id = '${dropIds[0]}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.equal(addr, 'Calle Confirmada Modificada', 'La dirección modificada debe confirmarse');
        console.log('       -> OK (S2 esperó lock, publicó versión con contactos modificados)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    console.log('[H08] Escenario 4B: publish_request adquiere lock primero...');
    {
      const { reqId, dropIds } = createDraftFixture(1);

      const s1 = new PsqlSession('S1_PUBLISH_B');
      const s2 = new PsqlSession('S2_UPDATE_CONTACTS_B');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          select public.publish_request('${reqId}');
          \\echo S1_PUBLISHED
        `);
        await s1.waitFor('S1_PUBLISHED');
        assert.ok(
          s1.output.includes('"status": "published"') || s1.output.includes('"status":"published"'),
          'publish_request debe responder status published'
        );

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${merchantId}","role":"authenticated","aal":"aal2"}', false);
          update public.delivery_request_drop_contacts set dropoff_address = 'Dirección Ilegal' where drop_id = '${dropIds[0]}';
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');

        await s2.waitFor('INVALID_STATE_TRANSITION');
        assert.ok(!s2.output.includes('S2_DONE'), 'S2 no debe haber emitido S2_DONE por error de serialización');

        const status = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const addr = runSql(`select dropoff_address from public.delivery_request_drop_contacts where drop_id = '${dropIds[0]}';`);
        assert.equal(status, 'published', 'Estado final debe ser published');
        assert.notEqual(addr, 'Dirección Ilegal', 'La dirección no debe haber sido modificada');
        console.log('       -> OK (S2 esperó lock de publicación real y abortó con INVALID_STATE_TRANSITION sin mutar)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    console.log('[H08] TODOS LOS ESCENARIOS CONCURRENTES COMPLETADOS EXITOSAMENTE (8/8).');

    // =========================================================================
    // SECCIÓN 2: H14 — Dos marcas concurrentes de las últimas entregas (CC-022 §6)
    // =========================================================================

    // -------------------------------------------------------------------------
    // 5. mark_drop_delivered + mark_drop_failed concurrentes
    // -------------------------------------------------------------------------
    console.log('[H14] Escenario 5: mark_drop_delivered + mark_drop_failed concurrentes...');
    {
      const { reqId, dropIds } = createInTransitFixture(2);

      const s1 = new PsqlSession('S1_DELIVERED_CONC');
      const s2 = new PsqlSession('S2_FAILED_CONC');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_delivered('${dropIds[0]}');
          \\echo S1_MARKED
        `);
        await s1.waitFor('S1_MARKED');

        // S2 intenta marcar el segundo drop como fallido; debe quedar bloqueado por lock en delivery_requests
        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_failed('${dropIds[1]}', 'Cliente no se presentó');
          commit;
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        // Mientras S1 retiene la transacción, el padre sigue en in_transit en la base
        const midStatus = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        assert.equal(midStatus, 'in_transit', 'Padre debe seguir in_transit antes del cierre de S1 y S2');

        // Confirmar S1: libera el lock y el drop 1 queda delivered
        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');

        // S2 despierta, adquiere el lock, evalúa que ya no hay drops pending y cierra el padre a delivered
        await s2.waitFor('S2_DONE');

        const finalStatus = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const delAt = runSql(`select delivered_at from public.delivery_requests where id = '${reqId}';`);
        const drop1St = runSql(`select status from public.delivery_request_drops where id = '${dropIds[0]}';`);
        const drop2St = runSql(`select status from public.delivery_request_drops where id = '${dropIds[1]}';`);
        const pendingCount = runSql(`select count(*)::int from public.delivery_request_drops where request_id = '${reqId}' and status = 'pending';`);

        assert.equal(finalStatus, 'delivered', 'Estado final de solicitud debe ser delivered');
        assert.ok(delAt && delAt.length > 0, 'delivered_at de solicitud debe ser no nulo');
        assert.equal(drop1St, 'delivered', 'Drop 1 debe ser delivered');
        assert.equal(drop2St, 'failed', 'Drop 2 debe ser failed');
        assert.equal(pendingCount, '0', 'Ningún drop debe permanecer en pending');

        // Reintento idempotente sobre ambos drops
        const retry1 = runSql(`
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_delivered('${dropIds[0]}');
        `);
        assert.ok(retry1.includes('"idempotent": true') || retry1.includes('"idempotent":true'), 'Reintento de mark_drop_delivered debe ser idempotente');

        const retry2 = runSql(`
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_failed('${dropIds[1]}', 'Cliente no se presentó');
        `);
        assert.ok(retry2.includes('"idempotent": true') || retry2.includes('"idempotent":true'), 'Reintento de mark_drop_failed debe ser idempotente');

        console.log('       -> OK (S2 esperó lock, padre cerró exactamente una vez a delivered, 0 drops pending, reintentos idempotentes)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    // -------------------------------------------------------------------------
    // 6. mark_drop_failed + mark_drop_delivered concurrentes (orden invertido de tipos)
    // -------------------------------------------------------------------------
    console.log('[H14] Escenario 6: mark_drop_failed + mark_drop_delivered concurrentes...');
    {
      const { reqId, dropIds } = createInTransitFixture(2);

      const s1 = new PsqlSession('S1_FAILED_FIRST');
      const s2 = new PsqlSession('S2_DELIVERED_SECOND');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_failed('${dropIds[0]}', 'Dirección inaccesible');
          \\echo S1_MARKED
        `);
        await s1.waitFor('S1_MARKED');

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_delivered('${dropIds[1]}');
          commit;
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        const midStatus = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        assert.equal(midStatus, 'in_transit', 'Padre debe seguir in_transit antes del commit de S1');

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');
        await s2.waitFor('S2_DONE');

        const finalStatus = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const delAt = runSql(`select delivered_at from public.delivery_requests where id = '${reqId}';`);
        const drop1St = runSql(`select status from public.delivery_request_drops where id = '${dropIds[0]}';`);
        const drop2St = runSql(`select status from public.delivery_request_drops where id = '${dropIds[1]}';`);
        const pendingCount = runSql(`select count(*)::int from public.delivery_request_drops where request_id = '${reqId}' and status = 'pending';`);

        assert.equal(finalStatus, 'delivered', 'Estado final de solicitud debe ser delivered');
        assert.ok(delAt && delAt.length > 0, 'delivered_at de solicitud debe ser no nulo');
        assert.equal(drop1St, 'failed', 'Drop 1 debe ser failed');
        assert.equal(drop2St, 'delivered', 'Drop 2 debe ser delivered');
        assert.equal(pendingCount, '0', 'Ningún drop debe permanecer en pending');

        console.log('       -> OK (S2 esperó lock, padre cerró exactamente una vez a delivered con orden invertido de marcas)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    // -------------------------------------------------------------------------
    // 7. mark_drop_failed + mark_drop_failed concurrentes (all-failed cierra en delivered)
    // -------------------------------------------------------------------------
    console.log('[H14] Escenario 7: mark_drop_failed + mark_drop_failed concurrentes (all-failed)...');
    {
      const { reqId, dropIds } = createInTransitFixture(2);

      const s1 = new PsqlSession('S1_FAILED_ALL_A');
      const s2 = new PsqlSession('S2_FAILED_ALL_B');
      await s1.initPid();
      await s2.initPid();

      try {
        s1.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_failed('${dropIds[0]}', 'Rechazado por destinatario 1');
          \\echo S1_MARKED
        `);
        await s1.waitFor('S1_MARKED');

        s2.send(`
          begin;
          set role authenticated;
          select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}', false);
          select public.mark_drop_failed('${dropIds[1]}', 'Rechazado por destinatario 2');
          commit;
          \\echo S2_DONE
        `);

        await waitForBlockedLock(s1.pid, s2.pid);

        const midStatus = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        assert.equal(midStatus, 'in_transit', 'Padre debe seguir in_transit antes del commit de S1');

        s1.send(`
          commit;
          \\echo S1_COMMITTED
        `);
        await s1.waitFor('S1_COMMITTED');
        await s2.waitFor('S2_DONE');

        const finalStatus = runSql(`select status from public.delivery_requests where id = '${reqId}';`);
        const delAt = runSql(`select delivered_at from public.delivery_requests where id = '${reqId}';`);
        const drop1St = runSql(`select status from public.delivery_request_drops where id = '${dropIds[0]}';`);
        const drop2St = runSql(`select status from public.delivery_request_drops where id = '${dropIds[1]}';`);
        const pendingCount = runSql(`select count(*)::int from public.delivery_request_drops where request_id = '${reqId}' and status = 'pending';`);

        assert.equal(finalStatus, 'delivered', 'Estado final de solicitud debe ser delivered aun con todos failed (CC-022 §6)');
        assert.ok(delAt && delAt.length > 0, 'delivered_at de solicitud debe ser no nulo');
        assert.equal(drop1St, 'failed', 'Drop 1 debe ser failed');
        assert.equal(drop2St, 'failed', 'Drop 2 debe ser failed');
        assert.equal(pendingCount, '0', 'Ningún drop debe permanecer en pending');

        console.log('       -> OK (S2 esperó lock, padre cerró exactamente una vez a delivered con todas las entregas fallidas)');
      } finally {
        await s1.close();
        await s2.close();
      }
    }

    console.log('[H14] TODOS LOS ESCENARIOS DE MARCAS CONCURRENTES COMPLETADOS EXITOSAMENTE (3/3).');
  } finally {
    // Limpieza de fixtures
    if (createdRequests.length > 0) {
      const inList = createdRequests.map((id) => `'${id}'`).join(',');
      runSql(`
        delete from public.offers where request_id in (${inList});
        delete from public.delivery_requests where id in (${inList});
      `);
    }
  }
}

run().catch((err) => {
  console.error('[H08/H14] ERROR EN EJECUCIÓN CONCURRENTE:', err);
  process.exit(1);
});
