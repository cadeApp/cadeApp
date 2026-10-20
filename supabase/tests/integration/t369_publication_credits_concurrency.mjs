/**
 * Runner de concurrencia multisesión para T-369 / CC-029 (revisión PR #397, H01; decisión 1-A de Lautaro073).
 *
 * Cada escenario abre sesiones PostgreSQL físicas distintas (psql dentro del contenedor de la base efímera de CI).
 * La sincronización es por locks reales: una sesión bloqueadora toma un lock, las sesiones bajo prueba quedan
 * esperando (se confirma en pg_stat_activity, wait_event_type = 'Lock') y recién entonces se libera. Sin sleeps.
 *
 * Escenarios:
 *   1. 3 créditos y 5 publicaciones en paralelo: exactamente 3 publican y 2 reciben PUBLICATION_CREDITS_EXHAUSTED.
 *   2. Doble publicación de la misma solicitud: a lo sumo un cargo corriente.
 *   3. accept_offer vs cancel_request en carrera: un solo efecto financiero final, sin deadlock.
 *   4. reconcile_expired_requests vs accept_offer vs cancel_request sobre una vencida: una sola liberación.
 *   5. Misma operationKey en dos sesiones: un solo lote / período, una sola auditoría.
 *   6. Primera compra concurrente (decisión 2-A): una sola fila de beneficio.
 *   7. Cambio de gracia vs alta de período (H03), en ambos órdenes.
 *
 * --mutation-check: en la base efímera reemplaza temporalmente funciones por versiones sin el control (sin tocar las
 * aserciones), exige que la invariante contable falle y restaura (GREEN). Incluye los controles pgTAP de H02–H05.
 */

import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const TAG = '[T369]';
const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error(`${TAG} ERROR: La variable de entorno DB_CONTAINER no está definida.`);
  process.exit(1);
}

const LOCK_WAIT_TIMEOUT_MS = Number(process.env.LOCK_TIMEOUT_MS) || 10000;
const SESSION_SETUP = "set statement_timeout = '20s'; set lock_timeout = '15s';";
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const PGTAP_SUITE = 'supabase/tests/t369_publication_credits.sql';

function psqlArgs(extra = []) {
  return ['exec', '-i', dbContainer, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', ...extra];
}

function runSql(sql) {
  const res = spawnSync('docker', psqlArgs(['-t', '-A']), { input: sql, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (res.status !== 0) {
    throw new Error(`${TAG} SQL error: ${res.stderr || res.stdout}\nSQL: ${sql.slice(0, 400)}`);
  }
  return res.stdout.trim();
}

function claims(actor, aal) {
  return JSON.stringify({ sub: actor, role: 'authenticated', aal });
}

/** Script de una RPC como usuario final; imprime OUT:<json> o termina con ERROR. */
function rpcScript(actor, aal, expr) {
  return `
    begin;
    set local role authenticated;
    do $$ begin perform set_config('request.jwt.claims', '${claims(actor, aal)}', true); end $$;
    select 'OUT:' || coalesce((${expr})::text, 'null');
    commit;
  `;
}

function parseOutcome(output) {
  const out = output.match(/OUT:(.*)/);
  if (out) return { ok: true, data: JSON.parse(out[1]) };
  const error = output.match(/ERROR:\s+([A-Z0-9_]+|deadlock detected|canceling statement[^\n]*)/);
  return { ok: false, error: error ? error[1] : output.trim() };
}

/** RPC síncrona en su propia conexión. */
function rpc(actor, aal, expr) {
  const res = spawnSync('docker', psqlArgs(['-t', '-A']), {
    input: rpcScript(actor, aal, expr),
    encoding: 'utf8',
  });
  return parseOutcome(`${res.stdout}\n${res.stderr}`);
}

function rpcOk(actor, aal, expr) {
  const result = rpc(actor, aal, expr);
  if (!result.ok) throw new Error(`${TAG} RPC falló (${expr.slice(0, 80)}): ${result.error}`);
  return result.data;
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.output = '';
    this.exited = false;
    this.pid = null;
    this.proc = spawn('docker', psqlArgs(['-t', '-A']), { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.on('data', (d) => (this.output += d.toString('utf8')));
    this.proc.stderr.on('data', (d) => (this.output += d.toString('utf8')));
    this.proc.on('exit', () => (this.exited = true));
  }

  send(sql) {
    this.proc.stdin.write(`${sql.trim()}\n`);
  }

  async waitFor(marker, timeoutMs = LOCK_WAIT_TIMEOUT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (marker.test(this.output)) return this.output;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`${TAG}[${this.label}] Timeout esperando ${marker}. Salida:\n${this.output}`);
  }

  async init() {
    this.send(`${SESSION_SETUP} select 'PID:' || pg_backend_pid() || ':ENDPID';`);
    await this.waitFor(/PID:\d+:ENDPID/);
    this.pid = Number(this.output.match(/PID:(\d+):ENDPID/)[1]);
    return this;
  }

  /** Lanza una RPC sin esperar su resultado. */
  start(actor, aal, expr) {
    this.send(`${rpcScript(actor, aal, expr)}\n\\echo DONE`);
  }

  async result() {
    await this.waitFor(/DONE|ERROR:/);
    return parseOutcome(this.output);
  }

  close() {
    try {
      this.proc.stdin.end();
      this.proc.kill('SIGTERM');
    } catch {}
  }
}

async function openSessions(labels) {
  return Promise.all(labels.map((label) => new PsqlSession(label).init()));
}

/** Sesión que toma un lock y lo mantiene hasta release(). */
async function holdLock(label, lockSql) {
  const session = await new PsqlSession(label).init();
  session.send(`begin; ${lockSql}\n\\echo LOCKED`);
  await session.waitFor(/LOCKED/);
  return {
    session,
    async release() {
      session.send('commit;\n\\echo RELEASED');
      await session.waitFor(/RELEASED/);
    },
  };
}

/** Espera a que cada pid esté esperando un lock (o, si allowDone, que su sesión ya haya terminado). */
async function waitLockWaiting(sessions, { allowDone = false } = {}) {
  const start = Date.now();
  while (Date.now() - start < LOCK_WAIT_TIMEOUT_MS) {
    const pending = sessions.filter((s) => !(allowDone && /DONE|ERROR:/.test(s.output)));
    if (pending.length === 0) return;
    const waiting = Number(
      runSql(`select count(*) from pg_stat_activity where wait_event_type = 'Lock' and pid in (${pending.map((s) => s.pid).join(',')});`)
    );
    if (waiting === pending.length) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`${TAG} Timeout esperando que ${sessions.map((s) => s.label).join(', ')} queden bloqueadas por lock.`);
}

function closeAll(sessions) {
  for (const s of sessions) s.close();
}

// ---------------------------------------------------------------------------
// Fixtures (sin datos productivos: UUID aleatorios, dominio example.test, se borran al final)
// ---------------------------------------------------------------------------
const created = { profiles: [], plans: [] };
const SETTINGS_KEYS = [
  'pilot_active',
  'max_request_publications_per_min',
  'max_offers_per_min',
  'subscription_grace_days',
  'launch_discount_pct',
  'min_offer_ars',
];
let savedSettings = [];
let zoneId = null;
let courierId = null;
let adminId = null;

function createProfile(role, { status = 'pilot', paidUntilDays = null } = {}) {
  const id = crypto.randomUUID();
  created.profiles.push(id);
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      't369c.${id.slice(0, 8)}@example.test', 'pwd', '{"role":"${role === 'admin' ? 'merchant' : role}"}'::jsonb);
    insert into public.profiles (id, role, consent_status) values ('${id}', '${role}', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';
  `);
  if (role === 'merchant') {
    const paidUntil =
      paidUntilDays === null ? 'null' : `((now() at time zone 'America/Argentina/Buenos_Aires')::date + ${paidUntilDays})`;
    runSql(`
      insert into public.merchants (profile_id, business_name, subscription_status, paid_until)
      values ('${id}', 'Comercio T369 concurrencia', '${status}', ${paidUntil})
      on conflict (profile_id) do update set subscription_status = excluded.subscription_status, paid_until = excluded.paid_until;
    `);
  }
  if (role === 'courier') {
    runSql(`
      insert into public.couriers (profile_id, status, available) values ('${id}', 'approved', true)
      on conflict (profile_id) do update set status = 'approved', available = true;
    `);
  }
  return id;
}

function setup() {
  savedSettings = SETTINGS_KEYS.map((k) => [k, runSql(`select value::text from public.platform_settings where key = '${k}';`)]);
  runSql(`
    update public.platform_settings set value = 'false'::jsonb where key = 'pilot_active';
    update public.platform_settings set value = '1000'::jsonb where key in ('max_request_publications_per_min', 'max_offers_per_min', 'min_offer_ars');
    update public.platform_settings set value = '3'::jsonb where key = 'subscription_grace_days';
    update public.platform_settings set value = '0'::jsonb where key = 'launch_discount_pct';
  `);
  zoneId = runSql('select id from public.zones where active order by id limit 1;');
  assert.ok(zoneId, 'Se requiere al menos una zona activa');
  courierId = createProfile('courier');
  adminId = createProfile('admin');
}

function cleanup() {
  if (created.profiles.length > 0) {
    const ids = created.profiles.map((id) => `'${id}'`).join(',');
    runSql(`
      update public.delivery_requests set accepted_offer_id = null where merchant_id in (${ids});
      delete from public.offers where request_id in (select id from public.delivery_requests where merchant_id in (${ids}));
      delete from public.delivery_requests where merchant_id in (${ids});
      delete from public.rate_limits where subject in (${ids});
      delete from public.merchants where profile_id in (${ids});
      delete from public.couriers where profile_id in (${ids});
      delete from public.profiles where id in (${ids});
      delete from auth.users where id in (${ids});
    `);
    created.profiles = [];
  }
  if (created.plans.length > 0) {
    runSql(`delete from public.publication_plans where id in (${created.plans.map((id) => `'${id}'`).join(',')});`);
    created.plans = [];
  }
  for (const [k, v] of savedSettings) {
    if (v) runSql(`update public.platform_settings set value = '${v}'::jsonb where key = '${k}';`);
  }
}

function payload(requestId, drops = 1) {
  return JSON.stringify({
    requestId,
    pickupZoneId: zoneId,
    pickupAddress: 'Av Mitre 369',
    pickupLat: -27.433,
    pickupLng: -65.615,
    fixedPriceArs: null,
    autoAssign: false,
    drops: Array.from({ length: drops }, (_, i) => ({
      dropoffZoneId: zoneId,
      dropoffAddress: `Alberdi ${i + 1}`,
      dropoffLat: -27.425,
      dropoffLng: -65.608,
      recipientName: `Destinatario ${i + 1}`,
      recipientPhone: `3865369${String(i + 1).padStart(3, '0')}`,
      recipientConsentDeclared: true,
      packageType: 'chico',
      recipientPaymentMethod: 'transfer',
      needsChange: false,
      cashChangeAmount: null,
      notes: null,
    })),
  });
}

const publishExpr = (requestId) => `public.create_and_publish_multi_drop('${payload(requestId)}'::jsonb)`;

function grantLoose(merchantId, credits, source = 'adjustment') {
  return rpcOk(adminId, 'aal2', `public.admin_grant_publication_credits('${merchantId}'::uuid, ${credits}, '${source}', '${crypto.randomUUID()}'::uuid, null)`);
}

function createPlan() {
  const code = `t369c-${crypto.randomBytes(3).toString('hex')}`;
  const plan = rpcOk(adminId, 'aal2', `public.admin_upsert_publication_plan(null, '${code}', 'Plan ${code}', 'quota', 5, 10000, true, 1)`);
  created.plans.push(plan.planId);
  return plan.planId;
}

function publishNow(merchantId) {
  const requestId = crypto.randomUUID();
  rpcOk(merchantId, 'aal1', publishExpr(requestId));
  return requestId;
}

function submitOffer(requestId) {
  return rpcOk(courierId, 'aal1', `public.submit_offer('${requestId}'::uuid, 1500, 15, null)`).offerId;
}

function available(merchantId) {
  return Number(
    runSql(`select coalesce(sum(u.available), 0) from app_private.publication_usable_lots('${merchantId}'::uuid, clock_timestamp()) as u;`)
  );
}

/** Invariante contable del libro (CC-029 prueba 11), por comercio. */
function assertLedger(merchantId, label) {
  const broken = runSql(`
    select count(*)
    from public.publication_credit_lots l
    where l.merchant_id = '${merchantId}'
      and (
        app_private.publication_lot_used(l.id) <> coalesce((
          select sum(case m.kind when 'reserve' then m.amount when 'release' then -m.amount else 0 end)
          from public.publication_credit_movements m where m.lot_id = l.id), 0)
        or app_private.publication_lot_used(l.id) > l.granted
      );
  `);
  assert.equal(broken, '0', `${label}: libro y saldo derivado deben coincidir, sin saldo negativo`);
}

function assertNoDeadlock(sessions, label) {
  for (const s of sessions) {
    assert.ok(!/deadlock detected|40P01/.test(s.output), `${label}: ${s.label} no debe terminar en deadlock. Salida:
${s.output}`);
  }
}

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------

/** Invariantes contables de E1; el control de mutación H01 exige que falle alguna de estas mismas aserciones. */
const E1_LABEL = 'E1 publicaciones paralelas';
const E1_INVARIANTS = {
  ok: `${E1_LABEL}: exactamente 3 publican`,
  exhausted: `${E1_LABEL}: exactamente 2 reciben PUBLICATION_CREDITS_EXHAUSTED`,
  published: `${E1_LABEL}: 3 solicitudes publicadas`,
  reserved: `${E1_LABEL}: se reservan 3 créditos, nunca más que lo acreditado`,
  available: `${E1_LABEL}: saldo final 0, nunca negativo`,
  ledger: `${E1_LABEL}: libro y saldo derivado deben coincidir, sin saldo negativo`,
};

/** 1. 3 créditos, 5 publicaciones simultáneas. */
async function scenarioPublishRace() {
  const label = E1_LABEL;
  const merchantId = createProfile('merchant');
  grantLoose(merchantId, 3);
  const blocker = await holdLock('E1_BLOCKER', `select id from public.publication_credit_lots where merchant_id = '${merchantId}' for update;`);
  const sessions = await openSessions(['E1_S1', 'E1_S2', 'E1_S3', 'E1_S4', 'E1_S5']);
  try {
    for (const s of sessions) s.start(merchantId, 'aal1', publishExpr(crypto.randomUUID()));
    await waitLockWaiting(sessions);
    await blocker.release();
    const results = await Promise.all(sessions.map((s) => s.result()));
    assertNoDeadlock(sessions, label);
    const metrics = {
      ok: results.filter((r) => r.ok).length,
      exhausted: results.filter((r) => !r.ok && r.error === 'PUBLICATION_CREDITS_EXHAUSTED').length,
      published: Number(runSql(`select count(*) from public.delivery_requests where merchant_id = '${merchantId}' and status = 'published';`)),
      reserved: Number(
        runSql(`
          select coalesce(sum(cl.amount), 0) from public.publication_charge_lots cl
          join public.publication_charges c on c.id = cl.charge_id
          where c.merchant_id = '${merchantId}' and c.state <> 'released';
        `)
      ),
      granted: 3,
      available: available(merchantId),
    };
    console.log(`${TAG} ${label}: métricas ${JSON.stringify(metrics)}`);
    assert.equal(metrics.ok, 3, E1_INVARIANTS.ok);
    assert.equal(metrics.exhausted, 2, E1_INVARIANTS.exhausted);
    assert.equal(metrics.published, 3, E1_INVARIANTS.published);
    assert.equal(metrics.reserved, 3, E1_INVARIANTS.reserved);
    assert.equal(metrics.available, 0, E1_INVARIANTS.available);
    assertLedger(merchantId, label);
    console.log(`${TAG} ${label}: OK (3 publican, 2 EXHAUSTED, reservado 3/3)`);
  } finally {
    closeAll([...sessions, blocker.session]);
  }
}

/** 2. Dos sesiones publican la misma solicitud. */
async function scenarioSameRequest() {
  const label = 'E2 misma solicitud';
  const merchantId = createProfile('merchant');
  grantLoose(merchantId, 3);
  const requestId = crypto.randomUUID();
  const dropId = crypto.randomUUID();
  runSql(`
    insert into public.delivery_requests (id, merchant_id, pickup_zone_id, status, drops_count)
    values ('${requestId}', '${merchantId}', '${zoneId}', 'draft', 1);
    insert into public.delivery_request_contacts (request_id, pickup_address, pickup_lat, pickup_lng)
    values ('${requestId}', 'Av Mitre 369', -27.4330, -65.6150);
    insert into public.delivery_request_drops (id, request_id, position, dropoff_zone_id, package_type, recipient_payment_method, needs_change, status)
    values ('${dropId}', '${requestId}', 1, '${zoneId}', 'chico', 'cash', false, 'pending');
    insert into public.delivery_request_drop_contacts (drop_id, dropoff_address, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, recipient_consent_declared)
    values ('${dropId}', 'Alberdi 1', -27.4250, -65.6080, 'Destinatario 1', '3865369001', true);
  `);
  const blocker = await holdLock('E2_BLOCKER', `select id from public.delivery_requests where id = '${requestId}' for update;`);
  const sessions = await openSessions(['E2_S1', 'E2_S2']);
  try {
    for (const s of sessions) s.start(merchantId, 'aal1', `public.publish_request('${requestId}'::uuid)`);
    await waitLockWaiting(sessions);
    await blocker.release();
    const results = await Promise.all(sessions.map((s) => s.result()));
    assertNoDeadlock(sessions, label);
    assert.equal(results.filter((r) => r.ok).length, 1, `${label}: una sola publicación gana`);
    assert.equal(
      runSql(`select count(*) from public.publication_charges where request_id = '${requestId}' and is_current;`),
      '1',
      `${label}: a lo sumo un cargo corriente`
    );
    assert.equal(available(merchantId), 2, `${label}: se cobra un solo crédito`);
    assertLedger(merchantId, label);
    console.log(`${TAG} ${label}: OK (1 publica, 1 cargo corriente)`);
  } finally {
    closeAll([...sessions, blocker.session]);
  }
}

/** 3. accept_offer vs cancel_request sobre una publicada con reserva. */
async function scenarioAcceptVsCancel() {
  const label = 'E3 match vs cancelación';
  const merchantId = createProfile('merchant');
  grantLoose(merchantId, 2);
  const requestId = publishNow(merchantId);
  const offerId = submitOffer(requestId);
  const blocker = await holdLock('E3_BLOCKER', `select id from public.delivery_requests where id = '${requestId}' for update;`);
  const [accept, cancel] = await openSessions(['E3_ACCEPT', 'E3_CANCEL']);
  try {
    accept.start(merchantId, 'aal1', `public.accept_offer('${offerId}'::uuid)::jsonb`);
    await waitLockWaiting([accept]);
    cancel.start(merchantId, 'aal1', `public.cancel_request('${requestId}'::uuid, null)`);
    await waitLockWaiting([accept, cancel]);
    await blocker.release();
    const [acceptResult, cancelResult] = await Promise.all([accept.result(), cancel.result()]);
    assertNoDeadlock([accept, cancel], label);
    assert.ok(acceptResult.ok || cancelResult.ok, `${label}: al menos una transición se aplica`);
    const state = runSql(`select string_agg(state, ',' order by created_at) from public.publication_charges where request_id = '${requestId}';`);
    assert.equal(state.split(',').length, 1, `${label}: un solo cargo para la solicitud`);
    if (acceptResult.ok) {
      assert.equal(state, 'consumed', `${label}: si hubo match, el cargo queda consumido y no se reintegra`);
      assert.equal(available(merchantId), 1, `${label}: con match se cobró un crédito`);
    } else {
      assert.equal(state, 'released', `${label}: sin match, la cancelación libera la reserva`);
      assert.equal(available(merchantId), 2, `${label}: sin match el crédito vuelve al saldo`);
    }
    assertLedger(merchantId, label);
    console.log(`${TAG} ${label}: OK (accept=${acceptResult.ok}, cancel=${cancelResult.ok}, cargo=${state})`);
  } finally {
    closeAll([accept, cancel, blocker.session]);
  }
}

/** 4. reconcile vs accept vs cancel sobre una solicitud ya vencida. */
async function scenarioReconcileRace() {
  const label = 'E4 reconciliación vs match vs cancelación';
  const merchantId = createProfile('merchant');
  grantLoose(merchantId, 2);
  const requestId = publishNow(merchantId);
  const offerId = submitOffer(requestId);
  runSql(`update public.delivery_requests set expires_at = now() - interval '1 minute' where id = '${requestId}';`);
  // La liberación inserta movimientos con FK al lote: el bloqueador retiene el lote para que la reconciliación quede
  // a mitad de camino, con la solicitud tomada, mientras accept y cancel esperan esa solicitud.
  const blocker = await holdLock('E4_BLOCKER', `select id from public.publication_credit_lots where merchant_id = '${merchantId}' for update;`);
  const [reconcile, accept, cancel] = await openSessions(['E4_RECONCILE', 'E4_ACCEPT', 'E4_CANCEL']);
  try {
    reconcile.start(merchantId, 'aal1', 'public.reconcile_expired_requests()');
    await waitLockWaiting([reconcile]);
    accept.start(merchantId, 'aal1', `public.accept_offer('${offerId}'::uuid)::jsonb`);
    cancel.start(merchantId, 'aal1', `public.cancel_request('${requestId}'::uuid, null)`);
    await waitLockWaiting([reconcile, accept, cancel]);
    await blocker.release();
    const [reconcileResult, acceptResult] = await Promise.all([reconcile.result(), accept.result(), cancel.result()]);
    assertNoDeadlock([reconcile, accept, cancel], label);
    assert.ok(reconcileResult.ok, `${label}: la reconciliación termina`);
    assert.ok(!acceptResult.ok, `${label}: no hay match sobre una vencida`);
    assert.equal(
      runSql(`select string_agg(state, ',') from public.publication_charges where request_id = '${requestId}';`),
      'released',
      `${label}: el cargo queda liberado`
    );
    assert.equal(
      runSql(`select count(*) from public.publication_credit_movements where request_id = '${requestId}' and kind = 'release';`),
      '1',
      `${label}: una sola liberación`
    );
    assert.equal(available(merchantId), 2, `${label}: el crédito vuelve una sola vez`);
    assertLedger(merchantId, label);
    console.log(`${TAG} ${label}: OK (una liberación, sin match, sin deadlock)`);
  } finally {
    closeAll([reconcile, accept, cancel]);
    blocker.session.close();
  }
}

/** 5. Misma operationKey desde dos sesiones admin: acreditación y período. */
async function scenarioSameOperationKey() {
  const label = 'E5 misma operationKey';
  const merchantId = createProfile('merchant');
  const planId = createPlan();
  for (const kind of ['grant', 'period']) {
    const key = crypto.randomUUID();
    const expr =
      kind === 'grant'
        ? `public.admin_grant_publication_credits('${merchantId}'::uuid, 5, 'adjustment', '${key}'::uuid, 'Nota concurrente')`
        : `public.admin_register_plan_period('${merchantId}'::uuid, '${planId}'::uuid, false, '${key}'::uuid, 'Nota concurrente')`;
    const blocker = await holdLock(`E5_${kind}_BLOCKER`, `select profile_id from public.merchants where profile_id = '${merchantId}' for update;`);
    const sessions = await openSessions([`E5_${kind}_S1`, `E5_${kind}_S2`]);
    try {
      for (const s of sessions) s.start(adminId, 'aal2', expr);
      await waitLockWaiting(sessions);
      await blocker.release();
      const results = await Promise.all(sessions.map((s) => s.result()));
      assertNoDeadlock(sessions, label);
      assert.ok(results.every((r) => r.ok), `${label} (${kind}): ambos reintentos responden sin error`);
      assert.deepEqual(
        results.map((r) => r.data.idempotent).sort(),
        [false, true],
        `${label} (${kind}): uno crea y el otro es idempotente`
      );
      const table = kind === 'grant' ? 'publication_credit_lots' : 'merchant_plan_periods';
      assert.equal(runSql(`select count(*) from public.${table} where operation_key = '${key}';`), '1', `${label} (${kind}): una sola fila`);
      const action = kind === 'grant' ? 'admin_grant_publication_credits' : 'admin_register_plan_period';
      assert.equal(
        runSql(`select count(*) from public.audit_log where action = '${action}' and target_id = '${merchantId}';`),
        '1',
        `${label} (${kind}): una sola auditoría`
      );
    } finally {
      closeAll([...sessions, blocker.session]);
    }
  }
  assert.equal(
    runSql(`select count(*) from public.publication_credit_movements where merchant_id = '${merchantId}' and kind = 'grant';`),
    '2',
    `${label}: un movimiento de alta por operación (lote suelto y lote del plan)`
  );
  assertLedger(merchantId, label);
  console.log(`${TAG} ${label}: OK (una fila y una auditoría por clave)`);
}

/** 6. Dos primeras compras simultáneas con el beneficio al 0 % (decisión 2-A). */
async function scenarioFirstPurchase() {
  const label = 'E6 primera compra concurrente';
  const merchantId = createProfile('merchant');
  const blocker = await holdLock('E6_BLOCKER', `select profile_id from public.merchants where profile_id = '${merchantId}' for update;`);
  const sessions = await openSessions(['E6_S1', 'E6_S2']);
  try {
    for (const s of sessions) {
      s.start(adminId, 'aal2', `public.admin_grant_publication_credits('${merchantId}'::uuid, 3, 'purchase', '${crypto.randomUUID()}'::uuid, null)`);
    }
    await waitLockWaiting(sessions);
    await blocker.release();
    const results = await Promise.all(sessions.map((s) => s.result()));
    assertNoDeadlock(sessions, label);
    assert.ok(results.every((r) => r.ok), `${label}: ambas compras se registran`);
    assert.deepEqual(
      results.map((r) => r.data.launchDiscountPct).sort(),
      [0, null],
      `${label}: solo una es la primera compra (0 %)`
    );
    assert.equal(
      runSql(`select count(*) || ':' || min(pct) from public.merchant_launch_discounts where merchant_id = '${merchantId}';`),
      '1:0',
      `${label}: una sola fila de beneficio`
    );
    console.log(`${TAG} ${label}: OK (una sola primera compra)`);
  } finally {
    closeAll([...sessions, blocker.session]);
  }
}

const legacyEndSql = (merchantId) => `app_private.publication_legacy_end('${merchantId}'::uuid)`;

const E7B_LABEL = 'E7b gracia primero, alta después';
const E7B_INVARIANTS = {
  overlap: `${E7B_LABEL}: el plan no se superpone con el derecho legacy`,
  startsAtLegacyEnd: `${E7B_LABEL}: el plan empieza exactamente al fin legacy con la gracia nueva`,
};

/** 7b. El cambio de gracia toma el parámetro primero; el alta del período espera y agenda con la gracia nueva. */
async function scenarioGraceThenRegister() {
  const label = E7B_LABEL;
  const merchantId = createProfile('merchant', { status: 'active', paidUntilDays: 5 });
  const planId = createPlan();
  const [setter, register] = await openSessions(['E7B_SETTING', 'E7B_REGISTER']);
  try {
    setter.send(`
      begin;
      set local role authenticated;
      do $$ begin perform set_config('request.jwt.claims', '${claims(adminId, 'aal2')}', true); end $$;
      select 'OUT:' || public.admin_update_setting('subscription_grace_days', '10'::jsonb)::text;
      \\echo SETTING_HELD
    `);
    await setter.waitFor(/SETTING_HELD|ERROR:/);
    assert.ok(/SETTING_HELD/.test(setter.output), `${label}: el cambio de gracia se acepta sin períodos en conflicto`);
    register.start(adminId, 'aal2', `public.admin_register_plan_period('${merchantId}'::uuid, '${planId}'::uuid, true, '${crypto.randomUUID()}'::uuid, null)`);
    // Sano: el alta queda esperando el FOR SHARE del parámetro. Si una versión sin ese lock termina antes del commit,
    // la espera no debe convertirse en timeout: el oráculo es el estado final, verificado abajo.
    await waitLockWaiting([register], { allowDone: true });
    const finishedBeforeCommit = /DONE|ERROR:/.test(register.output);
    setter.send('commit;\n\\echo COMMITTED');
    await setter.waitFor(/COMMITTED/);
    const registerResult = await register.result();
    assertNoDeadlock([setter, register], label);
    assert.ok(registerResult.ok, `${label}: el alta del período termina`);
    console.log(`${TAG} ${label}: el alta ${finishedBeforeCommit ? 'terminó antes' : 'esperó el lock hasta'} el commit de la gracia`);
    const overlap =
      runSql(`
        select (${legacyEndSql(merchantId)} > starts_at)::text
        from public.merchant_plan_periods where merchant_id = '${merchantId}';
      `) === 'true';
    assert.equal(overlap, false, E7B_INVARIANTS.overlap);
    assert.equal(
      runSql(`select (starts_at = ${legacyEndSql(merchantId)})::text from public.merchant_plan_periods where merchant_id = '${merchantId}';`),
      'true',
      E7B_INVARIANTS.startsAtLegacyEnd
    );
    console.log(`${TAG} ${label}: OK (el alta esperó y agendó con gracia 10)`);
  } finally {
    closeAll([setter, register]);
    // El comercio deja de tener derecho legacy para que la gracia vuelva a 3 en la limpieza del escenario.
    runSql(`
      update public.merchants set subscription_status = 'expired', paid_until = null where profile_id = '${merchantId}';
      update public.platform_settings set value = '3'::jsonb where key = 'subscription_grace_days';
    `);
  }
}

/** 7a. El alta del período toma el comercio y el parámetro primero; el cambio de gracia espera y se rechaza. */
async function scenarioRegisterThenGrace() {
  const label = 'E7a alta primero, gracia después';
  const merchantId = createProfile('merchant', { status: 'active', paidUntilDays: 5 });
  const planId = createPlan();
  const [register, setter] = await openSessions(['E7A_REGISTER', 'E7A_SETTING']);
  try {
    register.send(`
      begin;
      set local role authenticated;
      do $$ begin perform set_config('request.jwt.claims', '${claims(adminId, 'aal2')}', true); end $$;
      select 'OUT:' || public.admin_register_plan_period('${merchantId}'::uuid, '${planId}'::uuid, true, '${crypto.randomUUID()}'::uuid, null)::text;
      \\echo REGISTER_HELD
    `);
    await register.waitFor(/REGISTER_HELD|ERROR:/);
    assert.ok(/REGISTER_HELD/.test(register.output), `${label}: el alta del período se registra`);
    setter.start(adminId, 'aal2', `public.admin_update_setting('subscription_grace_days', '10'::jsonb)`);
    await waitLockWaiting([setter]);
    register.send('commit;\n\\echo COMMITTED');
    await register.waitFor(/COMMITTED/);
    const setterResult = await setter.result();
    assertNoDeadlock([register, setter], label);
    assert.deepEqual(setterResult, { ok: false, error: 'INVALID_SETTING_VALUE' }, `${label}: el cambio de gracia se rechaza`);
    assert.equal(
      runSql(`select value::text from public.platform_settings where key = 'subscription_grace_days';`),
      '3',
      `${label}: la gracia sigue en 3`
    );
    assert.equal(
      runSql(`select (${legacyEndSql(merchantId)} <= starts_at)::text from public.merchant_plan_periods where merchant_id = '${merchantId}';`),
      'true',
      `${label}: el plan sigue después del derecho legacy`
    );
    console.log(`${TAG} ${label}: OK (el cambio esperó y se rechazó con INVALID_SETTING_VALUE)`);
  } finally {
    closeAll([register, setter]);
    runSql(`update public.merchants set subscription_status = 'expired', paid_until = null where profile_id = '${merchantId}';`);
  }
}

async function runAll() {
  console.log(`${TAG} Iniciando runner multisesión contra ${dbContainer}`);
  setup();
  try {
    await scenarioPublishRace();
    await scenarioSameRequest();
    await scenarioAcceptVsCancel();
    await scenarioReconcileRace();
    await scenarioSameOperationKey();
    await scenarioFirstPurchase();
    await scenarioGraceThenRegister();
    await scenarioRegisterThenGrace();
    console.log(`${TAG} TODOS LOS ESCENARIOS MULTISESIÓN OK (8/8)`);
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// Controles de mutación (base efímera de CI): RED con la misma aserción, luego GREEN tras restaurar
// ---------------------------------------------------------------------------

function functionDef(signature) {
  const def = runSql(`select pg_get_functiondef('${signature}'::regprocedure);`);
  assert.ok(def.length > 0, `No se pudo leer ${signature}`);
  return def;
}

function mutate(signature, replacements) {
  const original = functionDef(signature);
  let mutated = original;
  for (const [from, to] of replacements) {
    const count = mutated.split(from).length - 1;
    assert.equal(count, 1, `${TAG} La mutación de ${signature} esperaba 1 aparición de «${from}» y encontró ${count}`);
    mutated = mutated.replace(from, to);
  }
  runSql(`${mutated};`);
  return () => runSql(`${original};`);
}

function runPgTap() {
  const res = spawnSync(pnpmCmd, ['supabase', 'test', 'db', PGTAP_SUITE], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
  });
  const output = `${res.stdout || ''}\n${res.stderr || ''}`;
  return { status: res.status, output, failures: output.split('\n').filter((l) => l.includes('Failed test') || /^not ok/.test(l)) };
}

async function pgTapMutation(id, signature, replacements, expectedFailure) {
  const restore = mutate(signature, replacements);
  try {
    const red = runPgTap();
    console.log(`${TAG} ${id} mutado:\n${red.failures.join('\n')}`);
    assert.notEqual(red.status, 0, `${TAG} ${id}: la suite pgTAP debió fallar con la mutación`);
    assert.ok(!/syntax error/.test(red.output), `${TAG} ${id}: la mutación no debe romper la sintaxis`);
    assert.ok(red.failures.some((l) => l.includes(expectedFailure)), `${TAG} ${id}: debe fallar «${expectedFailure}»`);
    console.log(`${TAG} ${id} RED: falla «${expectedFailure}»`);
  } finally {
    restore();
  }
  const green = runPgTap();
  assert.equal(green.status, 0, `${TAG} ${id}: la suite debe volver a GREEN tras restaurar:\n${green.output.slice(-2000)}`);
  console.log(`${TAG} ${id} GREEN tras restaurar`);
}

/**
 * Corre el escenario original, sin cambios, contra el SQL mutado. Solo cuenta como RED un AssertionError cuyo mensaje
 * es una de las invariantes esperadas; si pasa, o falla por timeout, conexión, sintaxis u otra aserción, el control
 * falla (CI rojo).
 */
async function expectInvariantFailure(id, scenario, expectedMessages) {
  try {
    await scenario();
  } catch (err) {
    if (!(err instanceof assert.AssertionError)) {
      throw new Error(`${TAG} ${id}: la ejecución mutada falló por una causa ajena a las invariantes: ${err}`);
    }
    // Node agrega el diff («\n\n5 !== 3\n») después del mensaje propio: la primera línea es exactamente la invariante.
    const headline = err.message.split('\n')[0];
    if (!expectedMessages.includes(headline)) {
      throw new Error(`${TAG} ${id}: falló una aserción no esperada: ${err.message}`);
    }
    console.log(`${TAG} ${id} RED: AssertionError «${headline}» (actual ${JSON.stringify(err.actual)}, esperado ${JSON.stringify(err.expected)})`);
    return;
  }
  throw new Error(`${TAG} ${id}: la ejecución mutada pasó; la prueba no detecta la falta del control`);
}

async function runMutationChecks() {
  console.log(`${TAG} Controles de mutación RED→GREEN contra ${dbContainer}`);
  setup();
  try {
    // H01: sin el lock del comercio ni el de los lotes, las 5 publicaciones leen el mismo saldo y sobregiran.
    {
      const restoreCycle = mutate('app_private.request_cycle(text,uuid,text,boolean,text,text)', [
        ['where profile_id = v_request.merchant_id for no key update;', 'where profile_id = v_request.merchant_id;'],
      ]);
      const restoreReserve = mutate('app_private.reserve_publication(uuid,uuid,integer,timestamp with time zone)', [
        ['perform 1 from public.publication_credit_lots where merchant_id = p_merchant_id for no key update;', ''],
      ]);
      try {
        await expectInvariantFailure('H01', scenarioPublishRace, Object.values(E1_INVARIANTS));
      } finally {
        restoreReserve();
        restoreCycle();
      }
      await scenarioPublishRace();
      console.log(`${TAG} H01 GREEN tras restaurar: la misma función afirma 3 publican / 2 EXHAUSTED`);
    }

    // H03 (carrera): sin el FOR SHARE del parámetro, el alta agenda con la gracia vieja y queda superpuesta.
    {
      const restore = mutate('public.admin_register_plan_period(uuid,uuid,boolean,uuid,text)', [
        ["perform 1 from public.platform_settings where key = 'subscription_grace_days' for share;", ''],
      ]);
      try {
        await expectInvariantFailure('H03 (carrera)', scenarioGraceThenRegister, [E7B_INVARIANTS.overlap]);
      } finally {
        restore();
      }
      await scenarioGraceThenRegister();
      console.log(`${TAG} H03 (carrera) GREEN tras restaurar: el plan empieza al fin legacy con la gracia nueva`);
    }
  } finally {
    cleanup();
  }

  await pgTapMutation(
    'H02',
    'public.admin_grant_publication_credits(uuid,integer,text,uuid,text)',
    [['\n       or v_lot.note is distinct from v_note then', ' then']],
    'H02: misma clave con otra nota da IDEMPOTENCY_CONFLICT'
  );
  await pgTapMutation(
    'H03',
    'public.admin_update_setting(text,jsonb)',
    [['if v_old_value is distinct from p_value and exists (', 'if false and exists (']],
    'H03: ampliar la gracia'
  );
  await pgTapMutation(
    'H04',
    'app_private.release_publication(uuid,uuid,text)',
    [['v_now timestamptz := clock_timestamp();', 'v_now timestamptz := now();']],
    'H04: la parte del lote vencido vuelve como un suelto nuevo'
  );
  await pgTapMutation(
    'H05',
    'public.admin_grant_publication_credits(uuid,integer,text,uuid,text)',
    [['values (p_merchant_id, v_pct, v_lot.id)', 'select p_merchant_id, v_pct, v_lot.id where v_pct > 0']],
    'H05: la primera compra con 0 % devuelve launchDiscountPct = 0'
  );
  console.log(`${TAG} CONTROLES DE MUTACIÓN COMPLETOS (H01, H02, H03 secuencial y carrera, H04, H05)`);
}

const main = process.argv.includes('--mutation-check') ? runMutationChecks : runAll;
main().catch((err) => {
  console.error(`${TAG} ERROR:`, err);
  process.exit(1);
});
