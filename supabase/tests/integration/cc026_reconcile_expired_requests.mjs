/**
 * CC-026 — carreras reales de dos sesiones para el reconciliador SQL.
 * Ejecutar con DB_CONTAINER del entorno local/CI tras aplicar migraciones.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-026] DB_CONTAINER no está definido.');
  process.exit(1);
}

function runSql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`[CC-026] SQL falló: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.output = '';
    this.exit = null;
    this.process = spawn(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.process.stdout.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
    this.process.stderr.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
    this.process.on('error', (error) => {
      this.exit = { code: null, signal: null, error: error.message };
    });
    this.process.on('exit', (code, signal) => {
      this.exit = { code, signal, error: null };
    });
  }

  send(sql) {
    const outputStart = this.output.length;
    this.process.stdin.write(`${sql.trim()}\n`);
    return outputStart;
  }

  async waitFor(marker, outputStart, timeoutMs = 8_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const output = this.output.slice(outputStart);
      if (output.includes(marker)) return output;
      if (this.exit) {
        throw new Error(
          `[CC-026][${this.label}] psql terminó antes de ${marker}: ${JSON.stringify(this.exit)}\n${output}`
        );
      }
      if (/(^|\n)ERROR:/.test(output)) {
        throw new Error(`[CC-026][${this.label}] SQL falló antes de ${marker}: ${output}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(
      `[CC-026][${this.label}] timeout esperando ${marker}: ${this.output.slice(outputStart)}`
    );
  }

  async run(label, sql) {
    const marker = `CC026_${label}_DONE`;
    const outputStart = this.send(`
      \\pset tuples_only on
      \\pset format unaligned
      ${sql}
      \\echo ${marker}
    `);
    return this.waitFor(marker, outputStart);
  }

  async reconcile(label, sql) {
    const output = await this.run(label, sql);
    const jsonLine = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('{') && line.includes('"expiredRequestIds"'));
    assert.ok(jsonLine, `[CC-026][${this.label}] la RPC no devolvió JSON de reconciliación: ${output}`);

    const result = JSON.parse(jsonLine);
    assert.ok(Array.isArray(result.expiredRequestIds), '[CC-026] RPC devuelve expiredRequestIds');
    assert.equal(typeof result.expiredCount, 'number', '[CC-026] RPC devuelve expiredCount');
    assert.equal(typeof result.hasMore, 'boolean', '[CC-026] RPC devuelve hasMore');
    return result;
  }

  async close() {
    this.process.stdin.end();
    this.process.kill('SIGTERM');
  }
}

function authenticatedSessionSql(actorId) {
  return `
    begin;
    set role authenticated;
    select set_config('request.jwt.claims',
      '{"sub":"${actorId}","role":"authenticated","aal":"aal1"}', false);
  `;
}

function createFixture({ merchantId, courierId, zoneId, expiresAtSql }) {
  const requestId = crypto.randomUUID();
  const offerId = crypto.randomUUID();
  runSql(`
    insert into public.delivery_requests (
      id, merchant_id, status, pickup_zone_id, dropoff_zone_id, package_type,
      recipient_payment_method, expires_at, published_at
    ) values (
      '${requestId}', '${merchantId}', 'published', '${zoneId}', '${zoneId}', 'chico',
      'cash', ${expiresAtSql}, now()
    );
    insert into public.offers (id, request_id, courier_id, amount_ars, eta_minutes, status)
    values ('${offerId}', '${requestId}', '${courierId}', 1500, 15, 'pending');
  `);
  return { requestId, offerId };
}

function requestState(requestId) {
  return JSON.parse(
    runSql(`
      select jsonb_build_object(
        'status', (select status::text from public.delivery_requests where id = '${requestId}'),
        'expiresInFuture', (select expires_at > clock_timestamp() from public.delivery_requests where id = '${requestId}'),
        'offerStatus', (select status::text from public.offers where request_id = '${requestId}'),
        'auditCount', (select count(*) from public.audit_log where target_id = '${requestId}' and action = 'expired')
      )::text;
    `)
  );
}

async function withSessions(fn) {
  const first = new PsqlSession('first');
  const second = new PsqlSession('second');
  try {
    await fn(first, second);
  } finally {
    await first.close();
    await second.close();
  }
}

async function run() {
  const merchantId = crypto.randomUUID();
  const courierId = crypto.randomUUID();
  const zoneId = runSql('select id from public.zones where active order by id limit 1;');
  assert.ok(zoneId, '[CC-026] se requiere una zona activa');
  const requestIds = [];

  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${merchantId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${merchantId}@cc026.test', 'pwd', '{"role":"merchant"}'::jsonb),
      ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${courierId}@cc026.test', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;
    insert into public.profiles (id, role, consent_status)
    values ('${merchantId}', 'merchant', 'active'), ('${courierId}', 'courier', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';
    insert into public.merchants (profile_id, business_name, subscription_status)
    values ('${merchantId}', 'CC026 concurrencia', 'pilot')
    on conflict (profile_id) do update set subscription_status = 'pilot';
    insert into public.couriers (profile_id, status, available)
    values ('${courierId}', 'approved', true)
    on conflict (profile_id) do update set status = 'approved', available = true;
  `);

  try {
    // Dos lectores: uno transiciona y el otro recibe hasMore=true sin duplicar auditoría ni oferta.
    const readers = createFixture({
      merchantId,
      courierId,
      zoneId,
      expiresAtSql: "clock_timestamp() - interval '1 minute'",
    });
    requestIds.push(readers.requestId);
    await withSessions(async (first, second) => {
      const firstResult = await first.reconcile(
        'READER_ONE',
        `${authenticatedSessionSql(merchantId)}
          select public.reconcile_expired_requests();`
      );
      assert.equal(firstResult.expiredCount, 1, 'primer lector transiciona la solicitud vencida');
      assert.equal(firstResult.hasMore, false, 'primer lector no declara backlog inexistente');

      const secondResult = await second.reconcile(
        'READER_TWO',
        `${authenticatedSessionSql(merchantId)}
          select public.reconcile_expired_requests();`
      );
      assert.equal(secondResult.expiredCount, 0, 'segundo lector no duplica la transición bloqueada');
      assert.equal(secondResult.hasMore, true, 'lector que salta lock marca reintento pendiente');

      await first.run('READER_ONE_COMMIT', 'commit;');
      await second.run('READER_TWO_COMMIT', 'commit;');
    });
    assert.deepEqual(requestState(readers.requestId), {
      status: 'expired',
      expiresInFuture: false,
      offerStatus: 'expired',
      auditCount: 1,
    });

    // Una aceptación iniciada antes del vencimiento y con el lock primero conserva el match.
    const acceptance = createFixture({
      merchantId,
      courierId,
      zoneId,
      expiresAtSql: "clock_timestamp() + interval '2 seconds'",
    });
    requestIds.push(acceptance.requestId);
    await withSessions(async (first, second) => {
      await first.run('ACCEPT_LOCK', `${authenticatedSessionSql(merchantId)}
        select id from public.delivery_requests where id = '${acceptance.requestId}' for update;
      `);
      const skippedResult = await second.reconcile(
        'ACCEPT_RECONCILE',
        `select pg_sleep(3);
          ${authenticatedSessionSql(merchantId)}
          select public.reconcile_expired_requests();`
      );
      assert.equal(skippedResult.expiredCount, 0, 'reconciliación no vence la fila bloqueada para aceptación');
      assert.equal(skippedResult.hasMore, true, 'reconciliación bloqueada conserva señal de reintento');
      await first.run('ACCEPT_COMMIT', `select public.accept_offer('${acceptance.offerId}'); commit;`);
      await second.run('ACCEPT_RECONCILE_COMMIT', 'commit;');
    });
    assert.equal(requestState(acceptance.requestId).status, 'matched', 'aceptación previa al límite gana');
    assert.equal(requestState(acceptance.requestId).auditCount, 0, 'match no recibe auditoría de expiración');

    // Republicación bloquea el snapshot anterior; el retry no vence la solicitud renovada.
    const republish = createFixture({
      merchantId,
      courierId,
      zoneId,
      expiresAtSql: "clock_timestamp() - interval '1 minute'",
    });
    requestIds.push(republish.requestId);
    await withSessions(async (first, second) => {
      await first.run('REPUBLISH_LOCK', `${authenticatedSessionSql(merchantId)}
        select id from public.delivery_requests where id = '${republish.requestId}' for update;
      `);
      const skippedResult = await second.reconcile(
        'REPUBLISH_RECONCILE',
        `${authenticatedSessionSql(merchantId)}
          select public.reconcile_expired_requests();`
      );
      assert.equal(skippedResult.expiredCount, 0, 'reconciliación no vence la fila bloqueada para republicación');
      assert.equal(skippedResult.hasMore, true, 'reconciliación bloqueada conserva señal de reintento');
      await first.run('REPUBLISH_COMMIT', `select public.republish_request('${republish.requestId}', null); commit;`);
      await second.run('REPUBLISH_RECONCILE_COMMIT', 'commit;');
    });
    assert.deepEqual(requestState(republish.requestId), {
      status: 'published',
      expiresInFuture: true,
      offerStatus: 'pending',
      auditCount: 0,
    });

    console.log('[CC-026] GREEN: dos lectores, aceptación y republicación se serializan sin expiraciones parciales.');
  } finally {
    if (requestIds.length > 0) {
      const ids = requestIds.map((requestId) => `'${requestId}'`).join(', ');
      runSql(`
        update public.delivery_requests set accepted_offer_id = null where id in (${ids});
        delete from public.audit_log where target_id in (${ids});
        delete from public.offers where request_id in (${ids});
        delete from public.delivery_requests where id in (${ids});
      `);
    }
    runSql(`
      delete from public.merchants where profile_id = '${merchantId}';
      delete from public.couriers where profile_id = '${courierId}';
      delete from public.profiles where id in ('${merchantId}', '${courierId}');
      delete from auth.users where id in ('${merchantId}', '${courierId}');
    `);
  }
}

run().catch((error) => {
  console.error(`[CC-026] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
