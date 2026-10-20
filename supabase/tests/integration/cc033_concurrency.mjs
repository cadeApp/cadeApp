/** CC-033: carreras de dos sesiones reales para alta opcional y suspensión. */
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) throw new Error('[CC-033] DB_CONTAINER es obligatorio.');
const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261020065319_cc033_add_courier_optional_document.sql');

function runSql(sql) {
  const result = spawnSync('docker', ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`[CC-033] SQL error: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function claims(id, role, aal = 'aal1') {
  return `jsonb_build_object('sub','${id}','role','authenticated','aal','${aal}')::text`;
}

class Session {
  constructor(label) {
    this.label = label;
    this.output = '';
    this.failure = null;
    this.proc = spawn('docker', ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.on('data', (data) => { this.output += data.toString('utf8'); });
    this.proc.stderr.on('data', (data) => { this.output += data.toString('utf8'); });
    this.proc.on('error', (error) => { this.failure = error.message; });
    this.proc.on('exit', (code) => { if (code && !this.failure) this.failure = `psql terminó con ${code}`; });
  }

  send(sql) { this.proc.stdin.write(`${sql.trim()}\n`); }

  async waitFor(marker, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (typeof marker === 'string' ? this.output.includes(marker) : marker.test(this.output)) return this.output;
      if (this.failure) throw new Error(`[CC-033][${this.label}] ${this.failure}: ${this.output}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`[CC-033][${this.label}] timeout esperando ${marker}: ${this.output}`);
  }

  async init(actorId, role, aal = 'aal1') {
    const marker = `READY_${crypto.randomUUID()}`;
    this.send(`\\pset tuples_only on
      \\pset format unaligned
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', ${claims(actorId, role, aal)}, true);
      select '${marker}:' || pg_backend_pid();`);
    const output = await this.waitFor(marker);
    const match = output.match(new RegExp(`${marker}:(\\d+)`));
    if (!match) throw new Error(`[CC-033][${this.label}] no devolvió pid`);
    this.pid = Number(match[1]);
  }

  async close() {
    if (this.proc.exitCode === null) {
      this.proc.stdin.end('rollback;\n\\q\n');
      await new Promise((resolve) => { this.proc.once('close', resolve); setTimeout(resolve, 2000); });
    }
  }
}

async function waitBlocked(holder, waiter) {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const blocked = Number(runSql(`select count(*) from pg_stat_activity where pid=${waiter.pid} and wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(${waiter.pid}));`));
    if (blocked === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`[CC-033] ${waiter.label} no quedó bloqueada por ${holder.label}`);
}

function fixture() {
  const courierId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const unique = Date.now();
  const pathA = `courier/${courierId}/insurance_${unique}1.jpg`;
  const pathB = `courier/${courierId}/insurance_${unique}2.jpg`;
  runSql(`
    insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_user_meta_data) values
      ('${courierId}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cc033-${courierId}@test','pwd','{"role":"courier"}'),
      ('${adminId}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cc033-${adminId}@test','pwd','{"role":"merchant"}') on conflict do nothing;
    insert into public.profiles(id,role,consent_status) values
      ('${courierId}','courier','active'),('${adminId}','admin','active')
      on conflict(id) do update set role=excluded.role,consent_status='active';
    insert into public.couriers(profile_id,status,available,vehicle_type,vehicle_plate) values
      ('${courierId}','pending',false,'moto','CC033')
      on conflict(profile_id) do update set status='pending',vehicle_type='moto',insurance_status='none',license_status='none';
    insert into storage.buckets(id,name,public) values('courier-docs','courier-docs',false) on conflict(id) do nothing;
    insert into storage.objects(id,bucket_id,name,owner) values
      (gen_random_uuid(),'courier-docs','${pathA}','${courierId}'),
      (gen_random_uuid(),'courier-docs','${pathB}','${courierId}') on conflict do nothing;
  `);
  return { courierId, adminId, pathA, pathB };
}

async function addAgainstAdd(samePath) {
  const { courierId, pathA, pathB } = fixture();
  const first = new Session('alta-1');
  const second = new Session('alta-2');
  const secondPath = samePath ? pathA : pathB;
  try {
    await first.init(courierId, 'courier');
    await second.init(courierId, 'courier');
    const firstDone = `FIRST_${crypto.randomUUID()}`;
    first.send(`select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','${pathA}')); select '${firstDone}';`);
    await first.waitFor(firstDone);
    const secondDone = `SECOND_${crypto.randomUUID()}`;
    second.send(`do $body$ declare value jsonb; begin begin value:=public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','${secondPath}')); raise notice '${secondDone}:OK:%', value; exception when others then raise notice '${secondDone}:ERROR:%', SQLERRM; end; end $body$;`);
    await waitBlocked(first, second);
    first.send('commit;');
    await second.waitFor(secondDone);
    assert.ok(!second.output.includes('40P01'), 'alta/alta no genera deadlock');
    if (samePath) assert.match(second.output, /idempotent["']?\s*:\s*true/i, 'misma ruta devuelve idempotent true');
    else assert.match(second.output, /INVALID_STATE_TRANSITION/, 'ruta distinta se rechaza tras serializar');
    assert.equal(Number(runSql(`select count(*) from public.courier_documents where courier_id='${courierId}' and kind='insurance' and is_current;`)), 1, 'queda una sola fila vigente');
    assert.equal(Number(runSql(`select count(*) from public.audit_log where actor_id='${courierId}' and action='add_courier_optional_document';`)), 1, 'queda una sola auditoría');
  } finally { await first.close(); await second.close(); }
}

async function addAgainstSuspend(suspensionFirst) {
  const { courierId, adminId, pathA } = fixture();
  const add = new Session('alta');
  const suspend = new Session('suspensión');
  try {
    await add.init(courierId, 'courier');
    await suspend.init(adminId, 'admin', 'aal2');
    const addDone = `ADD_${crypto.randomUUID()}`;
    const suspendDone = `SUSPEND_${crypto.randomUUID()}`;
    if (suspensionFirst) {
      suspend.send(`select 1 from public.couriers where profile_id='${courierId}' for update; select '${suspendDone}:LOCKED';`);
      await suspend.waitFor(`${suspendDone}:LOCKED`);
      add.send(`do $body$ begin begin perform public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','${pathA}')); raise notice '${addDone}:OK'; exception when others then raise notice '${addDone}:ERROR:%', SQLERRM; end; end $body$;`);
      await waitBlocked(suspend, add);
      suspend.send(`select public.admin_suspend_courier('${courierId}','CC-033 concurrencia'); commit; select '${suspendDone}:COMMIT';`);
      await suspend.waitFor(`${suspendDone}:COMMIT`);
      await add.waitFor(addDone);
      assert.match(add.output, /UNAUTHORIZED_ACTOR/, 'si suspensión toma el lock primero, alta se rechaza');
      assert.equal(Number(runSql(`select count(*) from public.courier_documents where courier_id='${courierId}';`)), 0, 'suspensión previa no deja documento');
    } else {
      add.send(`select public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','${pathA}')); select '${addDone}:DONE';`);
      await add.waitFor(`${addDone}:DONE`);
      suspend.send(`select public.admin_suspend_courier('${courierId}','CC-033 concurrencia'); select '${suspendDone}:DONE';`);
      await waitBlocked(add, suspend);
      add.send('commit;');
      await suspend.waitFor(`${suspendDone}:DONE`);
      const suspendCommit = `SUSPEND_${crypto.randomUUID()}_COMMIT`;
      suspend.send(`commit; select '${suspendCommit}';`);
      await suspend.waitFor(suspendCommit);
      assert.ok(!suspend.output.includes('40P01'), 'alta/suspensión no genera deadlock');
      assert.equal(Number(runSql(`select count(*) from public.courier_documents where courier_id='${courierId}' and kind='insurance' and is_current;`)), 1, 'alta previa persiste antes de suspensión');
    }
    assert.equal(runSql(`select status from public.couriers where profile_id='${courierId}';`), 'suspended', 'estado final es suspended');
  } finally { await add.close(); await suspend.close(); }
}

async function mutationCheck() {
  const original = fs.readFileSync(migrationPath, 'utf8');
  const needle = '  -- Orden de locks de CC-025/CC-033: couriers, profiles, courier_documents.\n';
  const mutated = original.replace(needle, `${needle}  -- MUTACIÓN RED: documento antes de courier rompe el orden global.\n  perform 1 from public.courier_documents where courier_id = v_actor_id and kind = v_kind for update;\n`);
  assert.notEqual(mutated, original, 'la mutación debe invertir el primer lock efectivo');
  const { courierId, pathA } = fixture();
  runSql(`insert into public.courier_documents(courier_id,kind,storage_path,status,is_current) values('${courierId}','insurance','${pathA}','submitted',true);`);
  try {
    runSql(mutated);
    const courierLock = new Session('mut-courier');
    const rpc = new Session('mut-rpc');
    try {
      await courierLock.init(courierId, 'courier'); await rpc.init(courierId, 'courier');
      courierLock.send(`select 1 from public.couriers where profile_id='${courierId}' for update; select 'COURIER_LOCKED';`);
      await courierLock.waitFor('COURIER_LOCKED');
      rpc.send(`do $body$ begin begin perform public.add_courier_optional_document(jsonb_build_object('kind','insurance','storagePath','${pathA}')); exception when others then raise notice 'RPC_ERROR:%', SQLSTATE; end; end $body$;`);
      await waitBlocked(courierLock, rpc);
      courierLock.send(`select 1 from public.courier_documents where courier_id='${courierId}' and kind='insurance' for update;`);
      const results = await Promise.allSettled([courierLock.waitFor(/40P01|deadlock detected/, 5000), rpc.waitFor(/40P01|deadlock detected/, 5000)]);
      assert.ok(results.some((result) => result.status === 'fulfilled'), 'mutación RED provoca deadlock real 40P01');
    } finally { await courierLock.close(); await rpc.close(); }
  } finally {
    runSql(original);
  }
  await addAgainstAdd(true);
  console.log('[CC-033] mutación RED detectada y migración original GREEN restaurada.');
}

async function main() {
  if (process.argv.includes('--mutation-check')) await mutationCheck();
  else {
    await addAgainstAdd(false);
    await addAgainstAdd(true);
    await addAgainstSuspend(true);
    await addAgainstSuspend(false);
  }
  console.log('[CC-033] concurrencia completada sin deadlocks en producción.');
}

main().catch((error) => { console.error(`[CC-033] ${error.stack || error}`); process.exitCode = 1; });
