/**
 * Concurrencia determinista de dos sesiones PostgreSQL para CC-035 (T-386): register_push_subscription.
 *
 * Escenarios (sesiones reales, sincronizadas con pg_blocking_pids, sin sleeps de coordinación):
 *   1. alta/alta: dos cuentas registran a la vez el mismo endpoint nuevo. La segunda espera en el índice único, recibe
 *      unique_violation y reintenta por la fila confirmada: queda 1 sola fila, de la segunda cuenta (último commit),
 *      con 1 auditoría de reasignación, sin errores ni 40P01.
 *   2. reasignar/reasignar: dos cuentas toman a la vez un endpoint de una tercera. La segunda espera el lock de la
 *      fila y reasigna después: 1 fila, de la segunda cuenta, con 2 auditorías.
 *   --mutation-check: una copia efímera de la migración con un solo intento (sin reintento ante unique_violation) deja
 *   a la segunda sesión del escenario 1 en error (RED); al restaurar la migración original vuelve a GREEN.
 */

import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const TAG = '[CC-035]';
const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error(`${TAG} ERROR: La variable de entorno DB_CONTAINER no está definida.`);
  process.exit(1);
}

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20261020123000_cc035_register_push_subscription.sql'
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

  async configureActor(actorId) {
    const marker = `CONFIGURED_${crypto.randomUUID()}`;
    this.send(`
      \\pset tuples_only on
      \\pset format unaligned
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', ${claimsSql(actorId, 'aal1')}, true);
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

function resetEndpoint(endpoint) {
  runSql(`
    delete from public.audit_log
    where action = 'push_subscription_reassigned'
      and target_id in (select id::text from public.push_subscriptions where endpoint = '${endpoint}');
    delete from public.push_subscriptions where endpoint = '${endpoint}';
  `);
}

function snapshot(endpoint) {
  const rows = runSql(`select user_id::text from public.push_subscriptions where endpoint = '${endpoint}';`)
    .split('\n')
    .filter(Boolean);
  const audits = Number(
    runSql(`
      select count(*)::int from public.audit_log
      where action = 'push_subscription_reassigned'
        and target_id in (select id::text from public.push_subscriptions where endpoint = '${endpoint}');
    `)
  );
  return { rows, audits };
}

const registerCall = (endpoint, keySuffix) =>
  `public.register_push_subscription(jsonb_build_object('endpoint', '${endpoint}', 'p256dh', 'P256dh${keySuffix}', 'auth', 'Auth${keySuffix}', 'platform', 'web'))`;

/** Escenario 1: dos altas simultáneas del mismo endpoint nuevo. Devuelve lo observado para el mutation-check. */
async function registerTwice(userA, userB, endpoint) {
  resetEndpoint(endpoint);
  const s1 = new PsqlSession('Cuenta-A');
  const s2 = new PsqlSession('Cuenta-B');
  try {
    const pid1 = await s1.initPid();
    const pid2 = await s2.initPid();
    await s1.configureActor(userA);
    await s2.configureActor(userB);

    const first = s1.call(registerCall(endpoint, 'A'));
    await s1.waitFor(`END_${first}`);
    assert.ok(s1.result(first).ok, `${TAG} el alta de A debe completar dentro de su transacción`);

    const second = s2.call(registerCall(endpoint, 'B'));
    await waitForBlockedLock(pid1, pid2);
    await s1.commit();
    await s2.waitFor(`END_${second}`);
    await s2.commit();

    return { output: s1.output + s2.output, second: s2.result(second), ...snapshot(endpoint) };
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function scenario1(userA, userB, endpoint) {
  console.log(`${TAG} Escenario 1: alta/alta del mismo endpoint nuevo...`);
  const observed = await registerTwice(userA, userB, endpoint);
  assert.ok(!observed.output.includes('40P01'), `${TAG} no debe haber deadlock 40P01`);
  assert.ok(observed.second.ok, `${TAG} la segunda alta no debe fallar: ${observed.second.body}`);
  assert.match(observed.second.body, /"reassigned": true/, `${TAG} la segunda toma el endpoint de A`);
  assert.match(observed.second.body, /"created": false/, `${TAG} la segunda no crea otra fila`);
  assert.deepEqual(observed.rows, [userB], `${TAG} queda 1 sola fila, de B (último commit)`);
  assert.equal(observed.audits, 1, `${TAG} 1 auditoría de reasignación`);
  console.log(`${TAG} Escenario 1 GREEN: unique_violation reintentada, 1 fila de B, 1 auditoría, sin 40P01.`);
}

async function scenario2(userA, userB, userC, endpoint) {
  console.log(`${TAG} Escenario 2: reasignar/reasignar un endpoint existente...`);
  resetEndpoint(endpoint);
  runSql(`
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, platform)
    values ('${userC}', '${endpoint}', 'P256dhC', 'AuthC', 'web');
  `);
  const s1 = new PsqlSession('Cuenta-A');
  const s2 = new PsqlSession('Cuenta-B');
  try {
    const pid1 = await s1.initPid();
    const pid2 = await s2.initPid();
    await s1.configureActor(userA);
    await s2.configureActor(userB);

    const first = s1.call(registerCall(endpoint, 'A'));
    await s1.waitFor(`END_${first}`);
    assert.ok(s1.result(first).ok, `${TAG} la reasignación de A debe completar`);

    const second = s2.call(registerCall(endpoint, 'B'));
    await waitForBlockedLock(pid1, pid2);
    await s1.commit();
    await s2.waitFor(`END_${second}`);
    await s2.commit();

    const output = s1.output + s2.output;
    assert.ok(!output.includes('40P01'), `${TAG} no debe haber deadlock 40P01`);
    const result = s2.result(second);
    assert.ok(result.ok, `${TAG} la segunda reasignación debe aplicarse: ${result.body}`);
    assert.match(result.body, /"reassigned": true/, `${TAG} la segunda reasigna desde A`);
    const after = snapshot(endpoint);
    assert.deepEqual(after.rows, [userB], `${TAG} 1 sola fila, de B`);
    assert.equal(after.audits, 2, `${TAG} 2 auditorías: C→A y A→B`);
    console.log(`${TAG} Escenario 2 GREEN: el lock de la fila serializa, 1 fila de B y 2 auditorías.`);
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function mutationCheck(userA, userB, endpoint) {
  console.log(`${TAG} --- Control de mutación: register_push_subscription sin reintento ante unique_violation ---`);
  const originalSql = fs.readFileSync(migrationPath, 'utf8');
  const loop = 'for v_attempt in 1..2 loop';
  assert.ok(originalSql.includes(loop), `${TAG} la migración debe contener el bucle de dos intentos a mutar`);
  const mutatedSql = originalSql.replace(loop, 'for v_attempt in 1..1 loop');
  try {
    runSql(mutatedSql);
    const observed = await registerTwice(userA, userB, endpoint);
    assert.ok(
      !observed.second.ok,
      `${TAG} RED esperado: sin reintento la segunda alta debe fallar (obtenido ${observed.second.body})`
    );
    assert.deepEqual(observed.rows, [userA], `${TAG} RED: queda solo la fila de A`);
    console.log(`${TAG} Control de mutación RED confirmado: sin reintento la segunda cuenta falla.`);
  } finally {
    runSql(originalSql);
  }
  await scenario1(userA, userB, endpoint);
  console.log(`${TAG} Control de mutación GREEN confirmado: con la migración original la segunda reintenta y gana.`);
}

async function main() {
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const userC = crypto.randomUUID();
  const endpoint = `https://fcm.googleapis.com/fcm/send/cc035-${crypto.randomUUID()}`;
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${userA}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a_${userA}@cc035.test', 'pwd', '{"role":"merchant"}'::jsonb),
      ('${userB}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b_${userB}@cc035.test', 'pwd', '{"role":"courier"}'::jsonb),
      ('${userC}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c_${userC}@cc035.test', 'pwd', '{"role":"merchant"}'::jsonb)
    on conflict (id) do nothing;

    update public.profiles set consent_status = 'active' where id in ('${userA}', '${userB}', '${userC}');
  `);

  if (process.argv.includes('--mutation-check')) {
    await mutationCheck(userA, userB, endpoint);
  } else {
    await scenario1(userA, userB, endpoint);
    await scenario2(userA, userB, userC, endpoint);
  }
  resetEndpoint(endpoint);
  console.log(`${TAG} Todos los escenarios GREEN.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
