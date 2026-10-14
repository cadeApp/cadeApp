import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-024] DB_CONTAINER no está definido.');
  process.exit(1);
}

function runSql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`[CC-024] SQL falló: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.output = '';
    this.proc = spawn(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.proc.stdout.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
    this.proc.stderr.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
  }

  send(sql) {
    this.proc.stdin.write(`${sql.trim()}\n`);
  }

  async waitFor(marker, timeoutMs = 10_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.output.includes(marker)) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`[CC-024][${this.label}] timeout esperando ${marker}`);
  }

  async close() {
    try {
      this.proc.stdin.write('rollback;\n\\q\n');
      this.proc.stdin.end();
      await new Promise((resolve) => {
        if (this.proc.exitCode !== null) {
          resolve();
          return;
        }
        this.proc.once('close', resolve);
        setTimeout(resolve, 2_000);
      });
    } catch {
      this.proc.kill('SIGTERM');
    }
  }
}

function payloadSql(requestId, zoneId, notes = null) {
  const notesSql = notes === null ? 'null' : `'${notes}'`;
  return `jsonb_build_object(
    'requestId', '${requestId}',
    'pickupZoneId', '${zoneId}',
    'pickupAddress', 'Av Mitre 900',
    'pickupLat', -27.4330,
    'pickupLng', -65.6150,
    'fixedPriceArs', null,
    'autoAssign', false,
    'drops', jsonb_build_array(
      jsonb_build_object(
        'dropoffZoneId', '${zoneId}',
        'dropoffAddress', 'Alberdi 900',
        'dropoffLat', -27.4250,
        'dropoffLng', -65.6080,
        'recipientName', 'Destinatario Uno',
        'recipientPhone', '3865123456',
        'recipientConsentDeclared', true,
        'packageType', 'chico',
        'recipientPaymentMethod', 'cash',
        'needsChange', false,
        'cashChangeAmount', null,
        'notes', ${notesSql}
      ),
      jsonb_build_object(
        'dropoffZoneId', '${zoneId}',
        'dropoffAddress', 'Belgrano 900',
        'dropoffLat', -27.4200,
        'dropoffLng', -65.6050,
        'recipientName', 'Destinatario Dos',
        'recipientPhone', '3865123457',
        'recipientConsentDeclared', true,
        'packageType', 'mediano',
        'recipientPaymentMethod', 'transfer',
        'needsChange', false,
        'cashChangeAmount', null,
        'notes', null
      )
    )
  )`;
}

function claimsSql(actorId) {
  return `jsonb_build_object('sub', '${actorId}', 'role', 'authenticated', 'aal', 'aal2')::text`;
}

async function configureSession(session, actorId) {
  const marker = `CC024_CONFIGURED_${crypto.randomUUID()}`;
  session.send(`
    \\pset tuples_only on
    \\pset format unaligned
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', ${claimsSql(actorId)}, true);
    select '${marker}';
  `);
  await session.waitFor(marker);
}

function resultMarkerSql(marker, payload, catchError) {
  if (!catchError) {
    return `select '${marker}:' || public.create_and_publish_multi_drop(${payload})::text || ':END_${marker}';`;
  }
  return `
    do $cc024$
    declare
      v_result jsonb;
    begin
      begin
        v_result := public.create_and_publish_multi_drop(${payload});
        raise notice '${marker}:OK:%:END_${marker}', v_result::text;
      exception when others then
        raise notice '${marker}:ERROR:%:END_${marker}', SQLERRM;
      end;
    end
    $cc024$;
  `;
}

function readResult(session, marker) {
  const match = session.output.match(new RegExp(`${marker}:(.*?):END_${marker}`));
  if (!match) {
    throw new Error(`[CC-024][${session.label}] no se encontró resultado ${marker}`);
  }
  const raw = match[1];
  if (raw.startsWith('ERROR:')) return { error: raw.slice('ERROR:'.length) };
  if (raw.startsWith('OK:')) return JSON.parse(raw.slice('OK:'.length));
  return JSON.parse(raw);
}

async function waitForBlockedLock(blockerPid, waiterPid) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const blocked = runSql(`
      select count(*)::int
      from pg_stat_activity
      where pid = ${waiterPid}
        and wait_event_type = 'Lock'
        and ${blockerPid} = any(pg_blocking_pids(${waiterPid}));
    `);
    if (Number(blocked) === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`[CC-024] no se observó bloqueo de ${waiterPid} por ${blockerPid}`);
}

function assertFinalState(requestId) {
  const values = runSql(`
    select
      (select count(*) from public.delivery_requests where id = '${requestId}'),
      (select count(*) from public.delivery_request_contacts where request_id = '${requestId}'),
      (select count(*) from public.delivery_request_drops where request_id = '${requestId}'),
      (select count(*) from public.delivery_request_drop_contacts dc
       join public.delivery_request_drops d on d.id = dc.drop_id
       where d.request_id = '${requestId}'),
      (select count(*) from public.audit_log where target_id = '${requestId}' and action = 'publish_request');
  `).split('|');
  assert.deepEqual(values, ['1', '1', '2', '2', '1'], 'el estado concurrente debe tener una sola publicación y N hijos');
}

async function runScenario({ name, holderActor, waiterActor, holderFirst, waiterPayload, expected }) {
  const requestId = crypto.randomUUID();
  const zoneId = runSql('select id from public.zones where active order by id limit 1;');
  const holder = new PsqlSession(`${name}-holder`);
  const waiter = new PsqlSession(`${name}-waiter`);
  const first = holderFirst ? holder : waiter;
  const second = holderFirst ? waiter : holder;
  const firstActor = holderActor;
  const secondActor = waiterActor;
  const holderPayload = payloadSql(requestId, zoneId);

  try {
    await configureSession(first, firstActor);
    const firstMarker = `CC024_FIRST_${crypto.randomUUID()}`;
    first.send(resultMarkerSql(firstMarker, holderPayload, false));
    await first.waitFor(firstMarker);
    const firstResult = readResult(first, firstMarker);
    assert.equal(firstResult.idempotent, false, `${name}: la primera sesión debe crear la solicitud`);

    await configureSession(second, secondActor);
    const waiterPidMarker = `CC024_WAITER_PID_${crypto.randomUUID()}`;
    second.send(`select 'PID:${waiterPidMarker}:' || pg_backend_pid() || ':END_${waiterPidMarker}';`);
    await second.waitFor(waiterPidMarker);
    const waiterPidMatch = second.output.match(new RegExp(`PID:${waiterPidMarker}:(\\d+):END_${waiterPidMarker}`));
    assert.ok(waiterPidMatch, `${name}: no se obtuvo pid del waiter`);
    const waiterPid = Number(waiterPidMatch[1]);
    const blockerPidMarker = `CC024_BLOCKER_PID_${crypto.randomUUID()}`;
    first.send(`select 'PID:${blockerPidMarker}:' || pg_backend_pid() || ':END_${blockerPidMarker}';`);
    await first.waitFor(blockerPidMarker);
    const blockerPidMatch = first.output.match(new RegExp(`PID:${blockerPidMarker}:(\\d+):END_${blockerPidMarker}`));
    assert.ok(blockerPidMatch, `${name}: no se obtuvo pid del blocker`);
    const blockerPid = Number(blockerPidMatch[1]);

    const secondMarker = `CC024_SECOND_${crypto.randomUUID()}`;
    second.send(resultMarkerSql(secondMarker, waiterPayload(requestId, zoneId), expected !== 'idempotent'));
    await waitForBlockedLock(blockerPid, waiterPid);

    const releaseMarker = `CC024_RELEASED_${crypto.randomUUID()}`;
    first.send(`commit; select '${releaseMarker}';`);
    await first.waitFor(releaseMarker);
    await second.waitFor(secondMarker);
    const secondResult = readResult(second, secondMarker);
    if (expected === 'idempotent') {
      assert.equal(secondResult.idempotent, true, `${name}: el retry debe ser idempotente`);
    } else {
      assert.equal(secondResult.error, expected, `${name}: el rechazo debe conservar el código de contrato`);
    }
    second.send('commit;');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assertFinalState(requestId);
  } finally {
    await holder.close();
    await waiter.close();
    runSql(`
      delete from public.audit_log where target_id = '${requestId}';
      delete from public.rate_limits where subject in ('${holderActor}', '${waiterActor}');
      delete from public.delivery_requests where id = '${requestId}';
    `);
  }
}

async function run() {
  const merchantA = crypto.randomUUID();
  const merchantB = crypto.randomUUID();
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${merchantA}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${merchantA}@cc024.test', 'pwd', '{"role":"merchant"}'::jsonb),
      ('${merchantB}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${merchantB}@cc024.test', 'pwd', '{"role":"merchant"}'::jsonb)
    on conflict (id) do nothing;
    insert into public.profiles (id, role, consent_status)
    values ('${merchantA}', 'merchant', 'active'), ('${merchantB}', 'merchant', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';
    insert into public.merchants (profile_id, business_name, subscription_status)
    values ('${merchantA}', 'CC024 A', 'pilot'), ('${merchantB}', 'CC024 B', 'pilot')
    on conflict (profile_id) do update set subscription_status = 'pilot';
  `);

  try {
    await runScenario({
      name: 'orden-A-mismo-payload',
      holderActor: merchantA,
      waiterActor: merchantA,
      holderFirst: true,
      waiterPayload: (requestId, zoneId) => payloadSql(requestId, zoneId),
      expected: 'idempotent',
    });
    await runScenario({
      name: 'orden-B-mismo-payload',
      holderActor: merchantA,
      waiterActor: merchantA,
      holderFirst: false,
      waiterPayload: (requestId, zoneId) => payloadSql(requestId, zoneId),
      expected: 'idempotent',
    });
    await runScenario({
      name: 'payload-divergente',
      holderActor: merchantA,
      waiterActor: merchantA,
      holderFirst: true,
      waiterPayload: (requestId, zoneId) => payloadSql(requestId, zoneId, 'Nota divergente'),
      expected: 'VALIDATION_ERROR',
    });
    await runScenario({
      name: 'comerciante-ajeno',
      holderActor: merchantA,
      waiterActor: merchantB,
      holderFirst: false,
      waiterPayload: (requestId, zoneId) => payloadSql(requestId, zoneId),
      expected: 'NOT_FOUND',
    });
    console.log('[CC-024] 4 escenarios concurrentes GREEN: dos órdenes, payload divergente y comerciante ajeno.');
  } finally {
    runSql(`
      delete from public.audit_log where target_id in (
        select id::text from public.delivery_requests where merchant_id in ('${merchantA}', '${merchantB}')
      );
      delete from public.rate_limits where subject in ('${merchantA}', '${merchantB}');
      delete from public.delivery_requests where merchant_id in ('${merchantA}', '${merchantB}');
      delete from public.merchants where profile_id in ('${merchantA}', '${merchantB}');
      delete from public.profiles where id in ('${merchantA}', '${merchantB}');
      delete from auth.users where id in ('${merchantA}', '${merchantB}');
    `);
  }
}

run().catch((error) => {
  console.error(`[CC-024] RED/ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
