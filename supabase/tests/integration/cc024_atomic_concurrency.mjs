import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-024] DB_CONTAINER no está definido.');
  process.exit(1);
}

function sqlLiteral(value) {
  return value === null ? 'null' : `'${value.replaceAll("'", "''")}'`;
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
    this.processFailure = null;
    this.proc = spawn(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.proc.on('error', (error) => {
      this.processFailure = `proceso psql falló: ${error.message}`;
    });
    this.proc.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        this.processFailure = `proceso psql terminó con código ${code}`;
      } else if (signal) {
        this.processFailure = `proceso psql terminó por señal ${signal}`;
      }
    });
    this.proc.stdout.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
    this.proc.stderr.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
  }

  send(sql) {
    if (this.proc.exitCode !== null) {
      throw new Error(`[CC-024][${this.label}] no se puede enviar SQL: el proceso ya terminó`);
    }
    this.proc.stdin.write(`${sql.trim()}\n`);
  }

  async waitFor(marker, timeoutMs = 10_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.output.includes(marker)) return;
      if (this.processFailure) {
        throw new Error(`[CC-024][${this.label}] ${this.processFailure} mientras esperaba ${marker}`);
      }
      if (this.proc.exitCode !== null) {
        throw new Error(`[CC-024][${this.label}] proceso terminó antes de emitir ${marker}`);
      }
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
  const notesSql = sqlLiteral(notes);
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

function assertFinalState(requestId, { name, expectedWinner }) {
  const state = JSON.parse(runSql(`
    select jsonb_build_object(
      'requestCount', (select count(*) from public.delivery_requests where id = '${requestId}'),
      'pickupCount', (select count(*) from public.delivery_request_contacts where request_id = '${requestId}'),
      'dropCount', (select count(*) from public.delivery_request_drops where request_id = '${requestId}'),
      'contactCount', (select count(*) from public.delivery_request_drop_contacts dc
                       join public.delivery_request_drops d on d.id = dc.drop_id
                       where d.request_id = '${requestId}'),
      'auditCount', (select count(*) from public.audit_log where target_id = '${requestId}' and action = 'publish_request'),
      'merchantId', (select merchant_id::text from public.delivery_requests where id = '${requestId}'),
      'drop1', (select jsonb_build_object(
        'address', dc.dropoff_address,
        'name', dc.recipient_name,
        'phone', dc.recipient_phone,
        'consent', dc.recipient_consent_declared,
        'notes', dc.notes
      ) from public.delivery_request_drops d
      join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
      where d.request_id = '${requestId}' and d.position = 1),
      'drop2', (select jsonb_build_object(
        'address', dc.dropoff_address,
        'name', dc.recipient_name,
        'phone', dc.recipient_phone,
        'consent', dc.recipient_consent_declared,
        'notes', dc.notes
      ) from public.delivery_request_drops d
      join public.delivery_request_drop_contacts dc on dc.drop_id = d.id
      where d.request_id = '${requestId}' and d.position = 2)
    )::text;
  `));
  assert.equal(
    state.requestCount === 1
      && state.pickupCount === 1
      && state.dropCount === 2
      && state.contactCount === 2
      && state.auditCount === 1,
    true,
    `${name}: el estado final debe conservar una publicación y dos drops/contactos`
  );
  assert.equal(state.merchantId === expectedWinner.actorId, true, `${name}: merchant_id persistido coincide con el ganador`);
  assert.equal(
    Boolean(
      state.drop1
      && state.drop1.address === 'Alberdi 900'
      && state.drop1.name === 'Destinatario Uno'
      && state.drop1.phone === '3865123456'
      && state.drop1.consent === true
      && state.drop1.notes === expectedWinner.notes
    ),
    true,
    `${name}: los datos privados del drop 1 coinciden con el ganador`
  );
  assert.equal(
    Boolean(
      state.drop2
      && state.drop2.address === 'Belgrano 900'
      && state.drop2.name === 'Destinatario Dos'
      && state.drop2.phone === '3865123457'
      && state.drop2.consent === true
      && state.drop2.notes === null
    ),
    true,
    `${name}: los datos privados del drop 2 coinciden con el ganador`
  );
}

function participant(actorId, notes = null) {
  return {
    actorId,
    notes,
    payload: (requestId, zoneId) => payloadSql(requestId, zoneId, notes),
  };
}

async function runScenario({ name, participants, winningIndex, expected, assertedWinnerIndex = winningIndex }) {
  const requestId = crypto.randomUUID();
  const zoneId = runSql('select id from public.zones where active order by id limit 1;');
  assert.equal(participants.length, 2, `${name}: el escenario debe tener dos participantes`);
  assert.ok(winningIndex === 0 || winningIndex === 1, `${name}: winningIndex inválido`);
  assert.ok(assertedWinnerIndex === 0 || assertedWinnerIndex === 1, `${name}: assertedWinnerIndex inválido`);
  const firstParticipant = participants[winningIndex];
  const secondParticipant = participants[1 - winningIndex];
  const expectedWinner = participants[assertedWinnerIndex];
  const first = new PsqlSession(`${name}-first`);
  const second = new PsqlSession(`${name}-second`);

  try {
    await configureSession(first, firstParticipant.actorId);
    const firstMarker = `CC024_FIRST_${crypto.randomUUID()}`;
    first.send(resultMarkerSql(firstMarker, firstParticipant.payload(requestId, zoneId), false));
    await first.waitFor(firstMarker);
    const firstResult = readResult(first, firstMarker);
    assert.equal(firstResult.idempotent, false, `${name}: la primera sesión debe crear la solicitud`);

    await configureSession(second, secondParticipant.actorId);
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
    second.send(resultMarkerSql(secondMarker, secondParticipant.payload(requestId, zoneId), expected !== 'idempotent'));
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
    const commitMarker = `CC024_SECOND_COMMITTED_${crypto.randomUUID()}`;
    second.send(`commit; select '${commitMarker}';`);
    await second.waitFor(commitMarker);
    assertFinalState(requestId, { name, expectedWinner });
  } finally {
    await first.close();
    await second.close();
    runSql(`
      delete from public.audit_log where target_id = '${requestId}';
      delete from public.rate_limits where subject in ('${firstParticipant.actorId}', '${secondParticipant.actorId}');
      delete from public.delivery_requests where id = '${requestId}';
    `);
  }
}

function createAndPublishDefinition() {
  return runSql("select pg_get_functiondef('public.create_and_publish_multi_drop(jsonb)'::regprocedure);");
}

function installLegacyConsentGuard(definition) {
  const legacy = definition.replace(
    /v_drop\s*->\s*'recipientConsentDeclared'\s+is\s+distinct\s+from\s+'true'::jsonb/i,
    "v_drop->>'recipientConsentDeclared' <> 'true'"
  );
  assert.notEqual(legacy, definition, '[CC-024][H07] no se encontró la guarda tipada para mutar');
  runSql(legacy);
}

function runConsentPgTap() {
  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['supabase', 'test', 'db', 'supabase/tests/t340_multi_drop.sql'],
    { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 }
  );
  if (result.error) {
    throw new Error(`[CC-024][H07] no se pudo iniciar pgTAP: ${result.error.message}`);
  }
  return {
    exit: result.status,
    signal: result.signal,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pgTapSummary(output, expectedResult) {
  const lines = output.split(/\r?\n/);
  const filesLine = lines.find((line) => line.includes('Files='));
  const resultLine = lines.find((line) => line.includes('Result:'));
  assert.ok(filesLine, '[CC-024][H07] pgTAP debe informar el resumen Files/Tests');
  assert.ok(resultLine, '[CC-024][H07] pgTAP debe informar el resultado final');
  assert.match(resultLine, new RegExp(`Result:\\s*${expectedResult}`), `[CC-024][H07] pgTAP debe informar Result: ${expectedResult}`);
  return `${filesLine.trim()} ${resultLine.trim()}`;
}

function assertConsentPgTapFailure(result, description) {
  assert.equal(result.signal, null, '[CC-024][H07] el pgTAP mutado no debe terminar por señal');
  assert.notEqual(result.exit, null, '[CC-024][H07] el pgTAP mutado debe informar código de salida');
  assert.notEqual(result.exit, 0, '[CC-024][H07] la suite inalterada debe fallar con la guarda textual');
  assert.match(
    result.output,
    new RegExp(`# Failed test \\d+: "${escapeRegExp(description)}"`),
    '[CC-024][H07] el fallo debe pertenecer exactamente a la aserción de consentimiento JSON string true'
  );
  return pgTapSummary(result.output, 'FAIL');
}

function assertConsentPgTapGreen(result, description) {
  assert.equal(result.signal, null, '[CC-024][H07] el pgTAP restaurado no debe terminar por señal');
  assert.equal(result.exit, 0, '[CC-024][H07] la misma suite debe pasar con la guarda JSONB restaurada');
  assert.match(result.output, /Result: PASS/, '[CC-024][H07] pgTAP restaurado debe informar Result: PASS');
  assert.doesNotMatch(
    result.output,
    new RegExp(`# Failed test \\d+: "${escapeRegExp(description)}"`),
    '[CC-024][H07] la aserción de consentimiento JSON string true debe volver a pasar'
  );
  return pgTapSummary(result.output, 'PASS');
}

async function runConsentMutationCheck() {
  const definition = createAndPublishDefinition();
  const description = 'CC-024 rechaza consentimiento JSON string "true"';

  try {
    installLegacyConsentGuard(definition);
    const red = runConsentPgTap();
    const redSummary = assertConsentPgTapFailure(red, description);
    console.log(`[CC-024][H07] RED auténtico: pgTAP inalterado falló en ${description} (exit ${red.exit}; ${redSummary}).`);
  } finally {
    runSql(definition);
  }

  const green = runConsentPgTap();
  const greenSummary = assertConsentPgTapGreen(green, description);
  console.log(`[CC-024][H07] GREEN auténtico: la misma suite pgTAP pasó tras restaurar la guarda JSONB (exit ${green.exit}; ${greenSummary}).`);
}

async function runRetryMutationCheck(actorId) {
  const definition = createAndPublishDefinition();
  const mutated = definition.replace(/('idempotent',\s*)true\b/, "$1false");
  assert.notEqual(mutated, definition, '[CC-024][H06] no se encontró idempotent=true para mutar');
  const retryParticipants = [participant(actorId), participant(actorId)];
  let redObserved = false;

  try {
    runSql(mutated);
    try {
      await runScenario({
        name: 'retry-idempotente-mutante',
        participants: retryParticipants,
        winningIndex: 0,
        expected: 'idempotent',
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('el retry debe ser idempotente')) throw error;
      redObserved = true;
      console.log('[CC-024][H06] RED obtenido: el runner detectó idempotent=false en el retry mutado.');
    }
  } finally {
    runSql(definition);
  }
  assert.equal(redObserved, true, '[CC-024][H06] el mutante de idempotencia debe fallar en su aserción específica');

  await runScenario({
    name: 'retry-idempotente-restaurado',
    participants: retryParticipants,
    winningIndex: 0,
    expected: 'idempotent',
  });
  console.log('[CC-024][H06] GREEN obtenido tras restaurar idempotent=true.');
}

async function runWinnerOracleNegativeControl(actorId) {
  const divergent = participant(actorId, 'Nota diferente');
  const original = participant(actorId, 'Nota original');
  let redObserved = false;

  try {
    await runScenario({
      name: 'control-negativo-oraculo-ganador',
      participants: [divergent, original],
      winningIndex: 0,
      expected: 'VALIDATION_ERROR',
      assertedWinnerIndex: 1,
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('los datos privados del drop 1')) throw error;
    redObserved = true;
    console.log('[CC-024][H06] Control negativo de oráculo: una expectativa deliberadamente errónea fue detectada por la aserción de notas; no es una mutación funcional de backend.');
  }
  assert.equal(redObserved, true, '[CC-024][H06] el control negativo debe ser detectado por la aserción de datos persistidos');

  await runScenario({
    name: 'control-negativo-oraculo-restaurado',
    participants: [divergent, original],
    winningIndex: 0,
    expected: 'VALIDATION_ERROR',
  });
  console.log('[CC-024][H06] Control negativo de oráculo restaurado: el escenario normal conserva el ganador real.');
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
      name: 'retry-idempotente',
      participants: [participant(merchantA), participant(merchantA)],
      winningIndex: 0,
      expected: 'idempotent',
    });
    await runScenario({
      name: 'A-original-gana',
      participants: [participant(merchantA, 'Nota original'), participant(merchantA, 'Nota diferente')],
      winningIndex: 0,
      expected: 'VALIDATION_ERROR',
    });
    await runScenario({
      name: 'A-diferente-gana',
      participants: [participant(merchantA, 'Nota diferente'), participant(merchantA, 'Nota original')],
      winningIndex: 0,
      expected: 'VALIDATION_ERROR',
    });
    await runScenario({
      name: 'A-crea-B-pierde',
      participants: [participant(merchantA), participant(merchantB)],
      winningIndex: 0,
      expected: 'NOT_FOUND',
    });
    await runScenario({
      name: 'B-crea-A-pierde',
      participants: [participant(merchantB), participant(merchantA)],
      winningIndex: 0,
      expected: 'NOT_FOUND',
    });
    await runRetryMutationCheck(merchantA);
    await runWinnerOracleNegativeControl(merchantA);
    await runConsentMutationCheck();
    console.log('[CC-024] 5 escenarios concurrentes GREEN: retry, dos ganadores invertidos y dos colisiones de actor.');
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
