/**
 * Concurrencia determinista de dos sesiones PostgreSQL para CC-035 (T-386): register_push_subscription.
 *
 * Escenarios (sesiones reales, sincronizadas con pg_blocking_pids, sin sleeps de coordinación):
 *   1. alta/alta: dos cuentas registran a la vez el mismo endpoint nuevo. La segunda espera en el índice único, recibe
 *      unique_violation y reintenta por la fila confirmada: queda 1 sola fila, de la segunda cuenta (último commit),
 *      con 1 auditoría de reasignación, sin errores ni 40P01.
 *   2. reasignar/reasignar: dos cuentas toman a la vez un endpoint de una tercera. La segunda espera el lock de la
 *      fila y reasigna después: 1 fila, de la segunda cuenta, con 2 auditorías.
 *   --mutation-lock-check: una copia efímera sin el `for update` de la lectura por endpoint hace que la segunda
 *   reasignación audite a C como dueño previo (cadena C→A, C→B: RED); al restaurar, C→A→B (GREEN).
 *   --mutation-check: una copia efímera de la migración con un solo intento (sin reintento ante unique_violation) deja
 *   a la segunda sesión del escenario 1 en error (RED); al restaurar la migración original vuelve a GREEN.
 *   3. (CC-049, solo en el modo estándar) preservación en la primera aplicación: la base vuelve a la migración
 *      anterior a CC-049, se siembran una suscripción permitida (E01) y otra fuera de la lista (E08) con timestamps
 *      fijos, se aplica CC-049 con `supabase migration up` y las dos filas siguen con sus ocho columnas iguales. Al
 *      final se restaura la base completa con `supabase db reset`.
 *
 * Las mutaciones re-aplican la migración vigente de la RPC (CC-049, idempotente): restaurar la de CC-035 dejaría la RPC
 * sin la allowlist para los runners siguientes.
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
  'supabase/migrations/20261112120000_cc049_push_subscriptions_hardening.sql'
);
const PRE_CC049_VERSION = '20261111120000';

function supabaseCli(args) {
  const res = spawnSync('pnpm', ['supabase', ...args], { encoding: 'utf8', stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`${TAG} supabase ${args.join(' ')} terminó con código ${res.status}`);
  }
}

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

/** Cadena de reasignaciones del endpoint, en orden de auditoría: [{ from, to }, ...]. */
function auditChain(endpoint) {
  const out = runSql(`
    select coalesce(
      jsonb_agg(jsonb_build_object('from', before->>'user_id', 'to', after->>'user_id') order by id),
      '[]'::jsonb
    )::text
    from public.audit_log
    where action = 'push_subscription_reassigned'
      and target_id in (select id::text from public.push_subscriptions where endpoint = '${endpoint}');
  `);
  return JSON.parse(out);
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
  assert.deepEqual(auditChain(endpoint), [{ from: userA, to: userB }], `${TAG} la única reasignación es A→B`);
  console.log(`${TAG} Escenario 1 GREEN: unique_violation reintentada, 1 fila de B, 1 auditoría, sin 40P01.`);
}

/** Escenario 2: dos reasignaciones simultáneas de un endpoint de C. Devuelve lo observado para el mutation-check. */
async function reassignTwice(userA, userB, userC, endpoint) {
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

    return {
      output: s1.output + s2.output,
      second: s2.result(second),
      ...snapshot(endpoint),
      chain: auditChain(endpoint),
    };
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function scenario2(userA, userB, userC, endpoint) {
  console.log(`${TAG} Escenario 2: reasignar/reasignar un endpoint existente...`);
  const observed = await reassignTwice(userA, userB, userC, endpoint);
  assert.ok(!observed.output.includes('40P01'), `${TAG} no debe haber deadlock 40P01`);
  assert.ok(observed.second.ok, `${TAG} la segunda reasignación debe aplicarse: ${observed.second.body}`);
  assert.match(observed.second.body, /"reassigned": true/, `${TAG} la segunda reasigna desde A`);
  assert.deepEqual(observed.rows, [userB], `${TAG} 1 sola fila, de B`);
  assert.equal(observed.audits, 2, `${TAG} 2 auditorías`);
  assert.deepEqual(
    observed.chain,
    [
      { from: userC, to: userA },
      { from: userA, to: userB },
    ],
    `${TAG} la cadena de auditoría es C→A y después A→B`
  );
  console.log(`${TAG} Escenario 2 GREEN: el lock de la fila serializa; 1 fila de B y cadena C→A→B.`);
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

async function lockMutationCheck(userA, userB, userC, endpoint) {
  console.log(`${TAG} --- Control de mutación: register_push_subscription sin "for update" en la lectura por endpoint ---`);
  const originalSql = fs.readFileSync(migrationPath, 'utf8');
  const lockClause = /\n\s*for update;/;
  assert.equal(originalSql.match(new RegExp(lockClause, 'g'))?.length, 1, `${TAG} debe haber un único "for update" a mutar`);
  const mutatedSql = originalSql.replace(lockClause, ';');
  let observed;
  try {
    runSql(mutatedSql);
    observed = await reassignTwice(userA, userB, userC, endpoint);
  } finally {
    runSql(originalSql);
  }
  // RED solo por la aserción concreta de la cadena: la ejecución tiene que haber terminado bien.
  assert.ok(observed.second.ok, `${TAG} la mutación debe ejecutar sin error para que el RED sea de la cadena`);
  assert.notDeepEqual(
    observed.chain,
    [
      { from: userC, to: userA },
      { from: userA, to: userB },
    ],
    `${TAG} RED esperado: sin el lock la segunda lee a C como dueño (obtenido ${JSON.stringify(observed.chain)})`
  );
  assert.deepEqual(
    observed.chain,
    [
      { from: userC, to: userA },
      { from: userC, to: userB },
    ],
    `${TAG} RED esperado: las dos auditorías registran a C como dueño previo`
  );
  console.log(`${TAG} Control de mutación del lock RED confirmado: cadena ${JSON.stringify(observed.chain)} (C→A, C→B).`);
  await scenario2(userA, userB, userC, endpoint);
  console.log(`${TAG} Control de mutación del lock GREEN confirmado: con la migración original la cadena es C→A→B.`);
}

/** CC-049 (H02, D5-C): la primera aplicación de la migración conserva las filas históricas, permitidas o no. */
function preservationOnFirstApply() {
  console.log(`${TAG} --- CC-049: preservación de suscripciones en la primera aplicación de la migración ---`);
  supabaseCli(['db', 'reset', '--version', PRE_CC049_VERSION, '--no-seed']);
  try {
    const owner = crypto.randomUUID();
    const allowedId = crypto.randomUUID();
    const blockedId = crypto.randomUUID();
    const cc049Applied = () =>
      runSql(`select count(*)::int from pg_policies where tablename = 'push_subscriptions' and policyname = 'push_subscriptions_select_self';`);
    assert.equal(cc049Applied(), '0', `${TAG} precondición: CC-049 todavía no está aplicada`);

    runSql(`
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
      values ('${owner}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_${owner}@cc049.test', 'pwd', '{"role":"merchant"}'::jsonb);
      insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth, platform, created_at, last_seen_at)
      values
        ('${allowedId}', '${owner}', 'https://fcm.googleapis.com/fcm/send/abc', 'p256dhE01', 'authE01', 'web',
         '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z'),
        ('${blockedId}', '${owner}', 'https://push.example.com/abc', 'p256dhE08', 'authE08', null,
         '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z');
    `);
    const snapshot = () =>
      runSql(`
        select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb)::text
        from public.push_subscriptions s where s.user_id = '${owner}';
      `);
    const before = snapshot();
    assert.equal(JSON.parse(before).length, 2, `${TAG} se sembraron las dos filas`);

    supabaseCli(['migration', 'up']);
    assert.equal(cc049Applied(), '1', `${TAG} CC-049 quedó aplicada por migration up`);

    const after = snapshot();
    assert.deepEqual(
      JSON.parse(after),
      JSON.parse(before),
      `${TAG} la primera aplicación de CC-049 debe conservar las dos filas con sus ocho columnas`
    );
    console.log(`${TAG} CC-049 preservación GREEN: E01 y E08 siguen idénticas tras la primera aplicación.`);
  } finally {
    supabaseCli(['db', 'reset']);
  }
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
  } else if (process.argv.includes('--mutation-lock-check')) {
    await lockMutationCheck(userA, userB, userC, endpoint);
  } else {
    await scenario1(userA, userB, endpoint);
    await scenario2(userA, userB, userC, endpoint);
  }
  resetEndpoint(endpoint);
  if (!process.argv.includes('--mutation-check') && !process.argv.includes('--mutation-lock-check')) {
    preservationOnFirstApply();
  }
  console.log(`${TAG} Todos los escenarios GREEN.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
