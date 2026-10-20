/**
 * Concurrencia determinista de dos sesiones PostgreSQL para CC-034 (T-385): admin_reinstate_courier.
 *
 * Escenarios (sesiones reales, sincronizadas con pg_blocking_pids, sin sleeps de coordinación):
 *   1. reactivar/reactivar: dos admins reactivan al mismo suspendido. La segunda espera el lock de couriers y
 *      devuelve idempotent: true; queda 1 sola fila de auditoría y nunca 40P01.
 *   2. reactivar → suspender: la suspensión espera a la reactivación; el estado final es suspended.
 *   3. suspender → reactivar: la reactivación espera a la suspensión y la revierte; el estado final es approved.
 *   --mutation-check: quitar el `for update` de una copia efímera de la migración hace que el escenario 1 duplique
 *   la auditoría (RED); al restaurar la migración original vuelve a GREEN.
 */

import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const TAG = '[CC-034]';
const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error(`${TAG} ERROR: La variable de entorno DB_CONTAINER no está definida.`);
  process.exit(1);
}

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20261020113000_cc034_admin_reinstate_courier.sql'
);

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

function claimsSql(actorId, aal) {
  return `jsonb_build_object('sub', '${actorId}', 'role', 'authenticated', 'aal', '${aal}')::text`;
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.proc = spawn(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
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

  async configureAdmin(adminId) {
    const marker = `CONFIGURED_${crypto.randomUUID()}`;
    this.send(`
      \\pset tuples_only on
      \\pset format unaligned
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', ${claimsSql(adminId, 'aal2')}, true);
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

function setCourierStatus(courierId, status) {
  runSql(`
    update public.couriers
    set status = '${status}', available = false, vehicle_type = 'moto'
    where profile_id = '${courierId}';
    delete from public.audit_log
    where target_id = '${courierId}' and action in ('admin_reinstate_courier', 'admin_suspend_courier');
  `);
}

function auditCount(courierId, action) {
  return Number(
    runSql(`select count(*)::int from public.audit_log where target_id = '${courierId}' and action = '${action}';`)
  );
}

function courierStatus(courierId) {
  return runSql(`select status::text from public.couriers where profile_id = '${courierId}';`);
}

const reinstateCall = (courierId, reason) =>
  `public.admin_reinstate_courier('${courierId}', '${reason}')`;
const suspendCall = (courierId) =>
  `public.admin_suspend_courier('${courierId}', 'Suspensión concurrente')`;

/** Escenario 1: dos reactivaciones simultáneas del mismo suspendido. Devuelve lo observado para el mutation-check. */
async function reinstateTwice(adminA, adminB, courierId) {
  setCourierStatus(courierId, 'suspended');
  const s1 = new PsqlSession('Admin-A');
  const s2 = new PsqlSession('Admin-B');
  try {
    const pid1 = await s1.initPid();
    const pid2 = await s2.initPid();
    await s1.configureAdmin(adminA);
    await s2.configureAdmin(adminB);

    const first = s1.call(reinstateCall(courierId, 'Primera reactivación'));
    await s1.waitFor(`END_${first}`);
    assert.ok(s1.result(first).ok, `${TAG} la primera reactivación debe completar dentro de su transacción`);

    const second = s2.call(reinstateCall(courierId, 'Segunda reactivación'));
    await waitForBlockedLock(pid1, pid2);
    await s1.commit();
    await s2.waitFor(`END_${second}`);
    await s2.commit();

    return {
      output: s1.output + s2.output,
      second: s2.result(second),
      audits: auditCount(courierId, 'admin_reinstate_courier'),
      status: courierStatus(courierId),
    };
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function scenario1(adminA, adminB, courierId) {
  console.log(`${TAG} Escenario 1: reactivar/reactivar...`);
  const observed = await reinstateTwice(adminA, adminB, courierId);
  assert.ok(!observed.output.includes('40P01'), `${TAG} no debe haber deadlock 40P01`);
  assert.ok(observed.second.ok, `${TAG} la segunda reactivación no debe fallar: ${observed.second.body}`);
  assert.match(observed.second.body, /"idempotent": true/, `${TAG} la segunda debe ser idempotente`);
  assert.match(observed.second.body, /"previousStatus": "approved"/, `${TAG} la segunda ve approved`);
  assert.equal(observed.audits, 1, `${TAG} exactamente 1 fila de auditoría`);
  assert.equal(observed.status, 'approved', `${TAG} el estado final es approved`);
  console.log(`${TAG} Escenario 1 GREEN: una sola reactivación auditada, la segunda idempotente, sin 40P01.`);
}

async function scenario2(adminA, adminB, courierId) {
  console.log(`${TAG} Escenario 2: reactivar → suspender...`);
  setCourierStatus(courierId, 'suspended');
  const s1 = new PsqlSession('Reinstate');
  const s2 = new PsqlSession('Suspend');
  try {
    const pid1 = await s1.initPid();
    const pid2 = await s2.initPid();
    await s1.configureAdmin(adminA);
    await s2.configureAdmin(adminB);

    const reinstate = s1.call(reinstateCall(courierId, 'Reactivación antes de suspender'));
    await s1.waitFor(`END_${reinstate}`);
    assert.ok(s1.result(reinstate).ok, `${TAG} la reactivación debe completar`);

    const suspend = s2.call(suspendCall(courierId));
    await waitForBlockedLock(pid1, pid2);
    await s1.commit();
    await s2.waitFor(`END_${suspend}`);
    await s2.commit();

    const output = s1.output + s2.output;
    assert.ok(!output.includes('40P01'), `${TAG} no debe haber deadlock 40P01`);
    assert.ok(s2.result(suspend).ok, `${TAG} la suspensión posterior debe aplicarse: ${s2.result(suspend).body}`);
    assert.equal(courierStatus(courierId), 'suspended', `${TAG} el estado final es el del último commit`);
    assert.equal(auditCount(courierId, 'admin_reinstate_courier'), 1, `${TAG} 1 auditoría de reactivación`);
    assert.equal(auditCount(courierId, 'admin_suspend_courier'), 1, `${TAG} 1 auditoría de suspensión`);
    console.log(`${TAG} Escenario 2 GREEN: la suspensión espera a la reactivación y queda como estado final.`);
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function scenario3(adminA, adminB, courierId) {
  console.log(`${TAG} Escenario 3: suspender → reactivar...`);
  setCourierStatus(courierId, 'approved');
  const s1 = new PsqlSession('Suspend');
  const s2 = new PsqlSession('Reinstate');
  try {
    const pid1 = await s1.initPid();
    const pid2 = await s2.initPid();
    await s1.configureAdmin(adminA);
    await s2.configureAdmin(adminB);

    const suspend = s1.call(suspendCall(courierId));
    await s1.waitFor(`END_${suspend}`);
    assert.ok(s1.result(suspend).ok, `${TAG} la suspensión debe completar`);

    const reinstate = s2.call(reinstateCall(courierId, 'Reactivación después de suspender'));
    await waitForBlockedLock(pid1, pid2);
    await s1.commit();
    await s2.waitFor(`END_${reinstate}`);
    await s2.commit();

    const output = s1.output + s2.output;
    assert.ok(!output.includes('40P01'), `${TAG} no debe haber deadlock 40P01`);
    const result = s2.result(reinstate);
    assert.ok(result.ok, `${TAG} la reactivación posterior debe aplicarse: ${result.body}`);
    assert.match(result.body, /"previousStatus": "suspended"/, `${TAG} la reactivación ve la suspensión ya commiteada`);
    assert.equal(courierStatus(courierId), 'approved', `${TAG} el estado final es el del último commit`);
    assert.equal(auditCount(courierId, 'admin_reinstate_courier'), 1, `${TAG} 1 auditoría de reactivación`);
    console.log(`${TAG} Escenario 3 GREEN: la reactivación espera a la suspensión y la revierte, sin 40P01.`);
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function mutationCheck(adminA, adminB, courierId) {
  console.log(`${TAG} --- Control de mutación: admin_reinstate_courier sin "for update" ---`);
  const originalSql = fs.readFileSync(migrationPath, 'utf8');
  const lockClause = /\n\s*for update;/;
  assert.ok(lockClause.test(originalSql), `${TAG} la migración debe contener el "for update" a mutar`);
  const mutatedSql = originalSql.replace(lockClause, ';');
  assert.notEqual(mutatedSql, originalSql, `${TAG} la mutación debe modificar el SQL`);
  try {
    runSql(mutatedSql);
    const observed = await reinstateTwice(adminA, adminB, courierId);
    assert.equal(
      observed.audits,
      2,
      `${TAG} RED esperado: sin el lock la segunda reactivación lee 'suspended' y vuelve a auditar (obtenido ${observed.audits})`
    );
    console.log(`${TAG} Control de mutación RED confirmado: sin "for update" la auditoría se duplica.`);
  } finally {
    runSql(originalSql);
  }
  await scenario1(adminA, adminB, courierId);
  console.log(`${TAG} Control de mutación GREEN confirmado: con la migración original vuelve a 1 sola auditoría.`);
}

async function main() {
  const adminA = crypto.randomUUID();
  const adminB = crypto.randomUUID();
  const courierId = crypto.randomUUID();
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${adminA}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adminA_${adminA}@cc034.test', 'pwd', '{"role":"merchant"}'::jsonb),
      ('${adminB}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adminB_${adminB}@cc034.test', 'pwd', '{"role":"merchant"}'::jsonb),
      ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier_${courierId}@cc034.test', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values
      ('${adminA}', 'admin', 'active'),
      ('${adminB}', 'admin', 'active'),
      ('${courierId}', 'courier', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';

    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
    values ('${courierId}', 'suspended', false, 'moto', 'CC34AAA')
    on conflict (profile_id) do update set status = 'suspended', vehicle_type = 'moto';
  `);

  if (process.argv.includes('--mutation-check')) {
    await mutationCheck(adminA, adminB, courierId);
  } else {
    await scenario1(adminA, adminB, courierId);
    await scenario2(adminA, adminB, courierId);
    await scenario3(adminA, adminB, courierId);
  }
  console.log(`${TAG} Todos los escenarios GREEN.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
