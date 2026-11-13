/**
 * Concurrencia determinista de dos sesiones PostgreSQL para CC-052 (T-437, B-05).
 *
 * Todas las RPC toman primero el lock de la fila de couriers (CC-052 §Concurrencia). Escenarios, con sesiones reales
 * sincronizadas con pg_blocking_pids y sin sleeps de coordinación:
 *   1. verificar → aprobar: la aprobación espera la verificación del último obligatorio y pasa.
 *   2. aprobar → verificar: la aprobación ve el obligatorio sin verificar y falla con DOCUMENTS_NOT_VERIFIED; la
 *      verificación posterior aplica y un reintento de la aprobación pasa.
 *   3. rechazar documento → aprobar: la aprobación espera el rechazo y falla con DOCUMENTS_NOT_VERIFIED.
 *   4. subsanar → rehabilitar: la rehabilitación espera la subsanación y falla con DOCUMENTS_NOT_VERIFIED.
 *   5. rehabilitar → subsanar: la subsanación espera la rehabilitación, ve approved y falla con
 *      INVALID_STATE_TRANSITION.
 * En ningún escenario hay deadlock 40P01.
 */

import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const TAG = '[CC-052]';
const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error(`${TAG} ERROR: La variable de entorno DB_CONTAINER no está definida.`);
  process.exit(1);
}

const KINDS = ['dni_front', 'dni_back', 'selfie', 'avatar'];

function runSql(sql) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-t', '-A'],
    { input: sql, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(`${TAG} SQL error: ${res.stderr || res.stdout}\nQuery: ${sql}`);
  }
  return res.stdout.trim();
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.proc = spawn('docker', ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.output = '';
    this.pid = null;
    this.processFailure = null;
    this.proc.on('error', (error) => {
      this.processFailure = `error de proceso: ${error.message}`;
    });
    this.proc.on('exit', (code, signal) => {
      if (code !== null && code !== 0) this.processFailure = `proceso terminó con código ${code}`;
      else if (signal) this.processFailure = `proceso terminó por señal ${signal}`;
    });
    this.proc.stdin.on('error', () => {});
    this.proc.stdout.on('data', (d) => {
      this.output += d.toString('utf8');
    });
    this.proc.stderr.on('data', (d) => {
      this.output += d.toString('utf8');
    });
  }

  send(sql) {
    if (this.proc.exitCode !== null) {
      throw new Error(`${TAG}[${this.label}] No se puede enviar SQL: el proceso ya terminó.`);
    }
    this.proc.stdin.write(sql.trim() + '\n');
  }

  async waitFor(marker, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = typeof marker === 'string' ? this.output.includes(marker) : marker.test(this.output);
      if (found) return this.output;
      if (this.processFailure) {
        throw new Error(`${TAG}[${this.label}] ${this.processFailure} mientras esperaba ${marker}`);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`${TAG}[${this.label}] Timeout esperando "${marker}". Salida:\n${this.output}`);
  }

  async initPid() {
    this.send(`select 'PID:' || pg_backend_pid() || ':ENDPID';`);
    await this.waitFor(/PID:\d+:ENDPID/);
    const m = this.output.match(/PID:(\d+):ENDPID/);
    if (!m) throw new Error(`${TAG}[${this.label}] No se pudo determinar pg_backend_pid`);
    this.pid = Number(m[1]);
    return this.pid;
  }

  /** Abre la transacción con el rol authenticated y los claims del actor. */
  async configure(actorId, aal) {
    const marker = `CONFIGURED_${crypto.randomUUID()}`;
    this.send(`
      \\pset tuples_only on
      \\pset format unaligned
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims',
        jsonb_build_object('sub', '${actorId}', 'role', 'authenticated', 'aal', '${aal}')::text, true);
      select '${marker}';
    `);
    await this.waitFor(marker);
  }

  /** Ejecuta una llamada RPC dentro de la transacción abierta y deja el resultado en la salida con un marcador. */
  call(callSql) {
    const marker = `RES_${crypto.randomUUID()}`;
    this.send(`
      do $call$
      declare
        v_res jsonb;
      begin
        begin
          v_res := ${callSql};
          raise notice '${marker}:OK:%:END_${marker}', v_res::text;
        exception when others then
          raise notice '${marker}:ERROR:% %:END_${marker}', SQLSTATE, SQLERRM;
        end;
      end $call$;
    `);
    return marker;
  }

  result(marker) {
    const m = this.output.match(new RegExp(`${marker}:(OK|ERROR):([\\s\\S]*?):END_${marker}`));
    if (!m) throw new Error(`${TAG}[${this.label}] Sin resultado para ${marker}. Salida:\n${this.output}`);
    return { ok: m[1] === 'OK', body: m[2] };
  }

  async commit() {
    const marker = `COMMITTED_${crypto.randomUUID()}`;
    this.send(`
      commit;
      select '${marker}';
    `);
    await this.waitFor(marker);
  }

  async close() {
    try {
      if (this.proc.exitCode === null && this.proc.stdin && !this.proc.stdin.destroyed) {
        this.proc.stdin.write('rollback;\n\\q\n');
        this.proc.stdin.end();
      }
      await new Promise((resolve) => {
        if (this.proc.exitCode !== null) return resolve();
        this.proc.once('close', resolve);
        setTimeout(resolve, 2000);
      });
    } catch {
      this.proc.kill('SIGTERM');
    }
  }
}

async function waitForBlockedLock(blockerPid, waiterPid, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const count = runSql(`
      select count(*)::int
      from pg_stat_activity
      where pid = ${waiterPid}
        and wait_event_type = 'Lock'
        and ${blockerPid} = any(pg_blocking_pids(${waiterPid}));
    `);
    if (Number(count) > 0) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`${TAG} Timeout esperando bloqueo: ${waiterPid} bloqueado por ${blockerPid}`);
}

function createUser(id, role) {
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      '${role}_${id}@cc052.test', 'pwd', '{"role":"${role === 'admin' ? 'merchant' : role}"}'::jsonb)
    on conflict (id) do nothing;
    insert into public.profiles (id, role, consent_status) values ('${id}', '${role}', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';
  `);
}

/**
 * Repartidor enviado y con DNI en `status`. `docs` mapea cada obligatorio a su estado (verified, submitted o rejected).
 * Siembra también el objeto de Storage que usa la subsanación.
 */
function createCourier(status, docs) {
  const id = crypto.randomUUID();
  createUser(id, 'courier');
  runSql(`
    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
    values ('${id}', '${status}', false, 'moto', 'CC52AAA')
    on conflict (profile_id) do update set status = excluded.status, vehicle_type = 'moto';
    begin;
    select set_config('app.courier_application_finalize', 'on', true);
    update public.couriers
    set application_submitted = true, submitted_at = now(),
      dni_hmac = encode(sha256(convert_to('${id}', 'UTF8')), 'hex')
    where profile_id = '${id}';
    commit;
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values ${KINDS.map((k) => `('${id}', '${k}', 'courier/${id}/${k}_1730000000000.png', '${docs[k]}')`).join(', ')};
    insert into storage.objects (bucket_id, name, owner)
    values ('courier-docs', 'courier/${id}/selfie_1730000000001.png', '${id}');
  `);
  return id;
}

function docId(courierId, kind) {
  return runSql(
    `select id from public.courier_documents where courier_id = '${courierId}' and kind = '${kind}' and is_current;`
  );
}

function courierStatus(courierId) {
  return runSql(`select status::text from public.couriers where profile_id = '${courierId}';`);
}

function auditCount(target, action) {
  return Number(runSql(`select count(*)::int from public.audit_log where target_id = '${target}' and action = '${action}';`));
}

function docCount(courierId) {
  return Number(runSql(`select count(*)::int from public.courier_documents where courier_id = '${courierId}';`));
}

const approveCall = (courierId) => `public.admin_decide_courier('${courierId}', 'approved', null)`;
const reinstateCall = (courierId) => `public.admin_reinstate_courier('${courierId}', 'Revisión concurrente')`;
const verifyCall = (documentId, decision) =>
  decision === 'verified'
    ? `public.admin_verify_document('${documentId}', 'verified', null)`
    : `public.admin_verify_document('${documentId}', 'rejected', 'Imagen borrosa')`;
const resubmitCall = (courierId) =>
  `public.resubmit_courier_required_document(jsonb_build_object('kind', 'selfie', 'storagePath', ` +
  `'courier/${courierId}/selfie_1730000000001.png', 'idempotencyKey', '${crypto.randomUUID()}'))`;

/** El primero corre y retiene el lock; el segundo espera, y se resuelve tras el commit del primero. */
async function race({ firstActor, firstAal, firstCall, secondActor, secondAal, secondCall }) {
  const s1 = new PsqlSession('Primera');
  const s2 = new PsqlSession('Segunda');
  try {
    const pid1 = await s1.initPid();
    const pid2 = await s2.initPid();
    await s1.configure(firstActor, firstAal);
    await s2.configure(secondActor, secondAal);

    const first = s1.call(firstCall);
    await s1.waitFor(`END_${first}`);
    const second = s2.call(secondCall);
    await waitForBlockedLock(pid1, pid2);
    await s1.commit();
    await s2.waitFor(`END_${second}`);
    await s2.commit();

    const output = s1.output + s2.output;
    assert.ok(!output.includes('40P01'), `${TAG} no debe haber deadlock 40P01`);
    return { first: s1.result(first), second: s2.result(second) };
  } finally {
    await s1.close();
    await s2.close();
  }
}

/** Dos operaciones en orden, cada una en su transacción, para el caso en que la primera falla y no retiene el lock. */
async function sequential(actorA, aalA, callA, actorB, aalB, callB) {
  const s1 = new PsqlSession('Primera');
  const s2 = new PsqlSession('Segunda');
  try {
    await s1.configure(actorA, aalA);
    const a = s1.call(callA);
    await s1.waitFor(`END_${a}`);
    await s2.configure(actorB, aalB);
    const b = s2.call(callB);
    await s2.waitFor(`END_${b}`);
    await s2.commit();
    await s1.commit();
    return { first: s1.result(a), second: s2.result(b) };
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function scenario1(adminA, adminB) {
  console.log(`${TAG} Escenario 1: verificar el último obligatorio → aprobar...`);
  const courier = createCourier('pending', { dni_front: 'verified', dni_back: 'verified', selfie: 'submitted', avatar: 'verified' });
  const r = await race({
    firstActor: adminA, firstAal: 'aal2', firstCall: verifyCall(docId(courier, 'selfie'), 'verified'),
    secondActor: adminB, secondAal: 'aal2', secondCall: approveCall(courier),
  });
  assert.ok(r.first.ok, `${TAG} la verificación debe aplicar: ${r.first.body}`);
  assert.ok(r.second.ok, `${TAG} la aprobación posterior debe pasar: ${r.second.body}`);
  assert.equal(courierStatus(courier), 'approved', `${TAG} el estado final es approved`);
  assert.equal(auditCount(courier, 'admin_decide_courier'), 1, `${TAG} 1 auditoría de decisión`);
  console.log(`${TAG} Escenario 1 GREEN: la aprobación espera la verificación y pasa.`);
}

async function scenario2(adminA, adminB) {
  console.log(`${TAG} Escenario 2: aprobar → verificar el último obligatorio...`);
  const courier = createCourier('pending', { dni_front: 'verified', dni_back: 'verified', selfie: 'submitted', avatar: 'verified' });
  const r = await sequential(adminA, 'aal2', approveCall(courier), adminB, 'aal2', verifyCall(docId(courier, 'selfie'), 'verified'));
  assert.ok(!r.first.ok && r.first.body.includes('DOCUMENTS_NOT_VERIFIED'),
    `${TAG} la aprobación previa falla con DOCUMENTS_NOT_VERIFIED: ${r.first.body}`);
  assert.ok(r.second.ok, `${TAG} la verificación posterior aplica: ${r.second.body}`);
  assert.equal(courierStatus(courier), 'pending', `${TAG} sigue pending tras la aprobación fallida`);
  assert.equal(auditCount(courier, 'admin_decide_courier'), 0, `${TAG} sin auditoría de decisión`);
  const s = new PsqlSession('Reintento');
  try {
    await s.configure(adminA, 'aal2');
    const m = s.call(approveCall(courier));
    await s.waitFor(`END_${m}`);
    await s.commit();
    assert.ok(s.result(m).ok, `${TAG} el reintento de la aprobación pasa: ${s.result(m).body}`);
  } finally {
    await s.close();
  }
  assert.equal(courierStatus(courier), 'approved', `${TAG} el reintento deja approved`);
  console.log(`${TAG} Escenario 2 GREEN: la aprobación previa falla sin efectos y el reintento pasa.`);
}

async function scenario3(adminA, adminB) {
  console.log(`${TAG} Escenario 3: rechazar el último obligatorio → aprobar...`);
  const courier = createCourier('pending', { dni_front: 'verified', dni_back: 'verified', selfie: 'submitted', avatar: 'verified' });
  const r = await race({
    firstActor: adminA, firstAal: 'aal2', firstCall: verifyCall(docId(courier, 'selfie'), 'rejected'),
    secondActor: adminB, secondAal: 'aal2', secondCall: approveCall(courier),
  });
  assert.ok(r.first.ok, `${TAG} el rechazo debe aplicar: ${r.first.body}`);
  assert.ok(!r.second.ok && r.second.body.includes('DOCUMENTS_NOT_VERIFIED'),
    `${TAG} la aprobación posterior falla con DOCUMENTS_NOT_VERIFIED: ${r.second.body}`);
  assert.equal(courierStatus(courier), 'pending', `${TAG} sigue pending`);
  assert.equal(auditCount(courier, 'admin_decide_courier'), 0, `${TAG} sin auditoría de decisión`);
  console.log(`${TAG} Escenario 3 GREEN: la aprobación espera el rechazo y falla.`);
}

async function scenario4(adminA) {
  console.log(`${TAG} Escenario 4: subsanar → rehabilitar...`);
  const courier = createCourier('rejected', { dni_front: 'verified', dni_back: 'verified', selfie: 'rejected', avatar: 'verified' });
  const r = await race({
    firstActor: courier, firstAal: 'aal1', firstCall: resubmitCall(courier),
    secondActor: adminA, secondAal: 'aal2', secondCall: reinstateCall(courier),
  });
  assert.ok(r.first.ok, `${TAG} la subsanación debe aplicar: ${r.first.body}`);
  assert.ok(!r.second.ok && r.second.body.includes('DOCUMENTS_NOT_VERIFIED'),
    `${TAG} la rehabilitación posterior falla con DOCUMENTS_NOT_VERIFIED: ${r.second.body}`);
  assert.equal(courierStatus(courier), 'rejected', `${TAG} sigue rejected`);
  assert.equal(auditCount(courier, 'admin_reinstate_courier'), 0, `${TAG} sin auditoría de rehabilitación`);
  console.log(`${TAG} Escenario 4 GREEN: la rehabilitación espera la subsanación y falla.`);
}

async function scenario5(adminA) {
  console.log(`${TAG} Escenario 5: rehabilitar → subsanar...`);
  const courier = createCourier('rejected', { dni_front: 'verified', dni_back: 'verified', selfie: 'verified', avatar: 'verified' });
  const before = docCount(courier);
  const r = await race({
    firstActor: adminA, firstAal: 'aal2', firstCall: reinstateCall(courier),
    secondActor: courier, secondAal: 'aal1', secondCall: resubmitCall(courier),
  });
  assert.ok(r.first.ok, `${TAG} la rehabilitación debe aplicar: ${r.first.body}`);
  assert.ok(!r.second.ok && r.second.body.includes('INVALID_STATE_TRANSITION'),
    `${TAG} la subsanación posterior ve approved y falla: ${r.second.body}`);
  assert.equal(courierStatus(courier), 'approved', `${TAG} queda approved`);
  assert.equal(docCount(courier), before, `${TAG} sin documentos nuevos`);
  console.log(`${TAG} Escenario 5 GREEN: la subsanación espera la rehabilitación y falla.`);
}

async function main() {
  const adminA = crypto.randomUUID();
  const adminB = crypto.randomUUID();
  createUser(adminA, 'admin');
  createUser(adminB, 'admin');

  await scenario1(adminA, adminB);
  await scenario2(adminA, adminB);
  await scenario3(adminA, adminB);
  await scenario4(adminA);
  await scenario5(adminA);
  console.log(`${TAG} Todos los escenarios GREEN.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
