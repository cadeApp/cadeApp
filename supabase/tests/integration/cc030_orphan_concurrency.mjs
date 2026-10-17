/**
 * CC-030 — carreras reales de dos sesiones entre el reclamo de huérfanos y los writers de courier_documents.
 * Ejecutar con DB_CONTAINER del entorno local/CI tras aplicar migraciones.
 *
 *   node cc030_orphan_concurrency.mjs                  → GREEN: reclamo y writer se serializan por ruta.
 *   node cc030_orphan_concurrency.mjs --mutation-check → sin el trigger de guarda, el writer adopta una ruta ya
 *                                                       reclamada (RED esperado); luego restaura y verifica GREEN.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-030] DB_CONTAINER no está definido.');
  process.exit(1);
}

function runSql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`[CC-030] SQL falló: ${result.stderr || result.stdout}`);
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
      ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.process.stdout.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
    this.process.stderr.on('data', (chunk) => {
      this.output += chunk.toString('utf8');
    });
    this.process.on('exit', (code, signal) => {
      this.exit = { code, signal };
    });
  }

  send(label, sql) {
    const outputStart = this.output.length;
    const marker = `CC030_${label}_DONE`;
    this.process.stdin.write(`\\pset tuples_only on\n\\pset format unaligned\n${sql.trim()}\n\\echo ${marker}\n`);
    return { outputStart, marker };
  }

  async wait({ outputStart, marker }, timeoutMs = 8_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const output = this.output.slice(outputStart);
      if (output.includes(marker)) return output;
      if (this.exit) {
        throw new Error(`[CC-030][${this.label}] psql terminó antes de ${marker}: ${output}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`[CC-030][${this.label}] timeout esperando ${marker}: ${this.output.slice(outputStart)}`);
  }

  async run(label, sql) {
    const output = await this.wait(this.send(label, sql));
    if (/(^|\n)ERROR:/.test(output)) {
      throw new Error(`[CC-030][${this.label}] SQL falló en ${label}: ${output}`);
    }
    return output;
  }

  /** Confirma que la sentencia sigue esperando un lock (no terminó en `ms`). */
  async assertBlocked(pending, ms = 1_000) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    assert.ok(
      !this.output.slice(pending.outputStart).includes(pending.marker),
      `[CC-030][${this.label}] se esperaba que la sentencia quedara bloqueada por el advisory lock`
    );
  }

  close() {
    this.process.stdin.end();
    this.process.kill('SIGTERM');
  }
}

const serviceRoleSql = `
  begin;
  set local role service_role;
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);
`;

function courierSql(courierId) {
  return `
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal1"}', true);
  `;
}

function parseClaim(output) {
  const line = output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.startsWith('{') && value.includes('"claimed"'));
  assert.ok(line, `[CC-030] la RPC no devolvió JSON: ${output}`);
  return JSON.parse(line);
}

function claimedPaths(result) {
  return result.claimed.map((item) => item.storagePath);
}

function putOldObject(path, courierId) {
  runSql(`
    insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at)
    values (gen_random_uuid(), 'courier-docs', '${path}', '${courierId}', now() - interval '10 days', now() - interval '10 days');
  `);
}

function resetRejectedLicense(courierId, path) {
  runSql(`
    delete from public.courier_documents where courier_id = '${courierId}';
    insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
    values ('${courierId}', 'license', '${path}', 'rejected', true);
  `);
}

function documentCount(path) {
  return Number(runSql(`select count(*) from public.courier_documents where storage_path = '${path}';`));
}

function claimCount(path) {
  return Number(runSql(`select count(*) from app_private.courier_document_orphan_claims where storage_path = '${path}';`));
}

async function withSessions(fn) {
  const first = new PsqlSession('first');
  const second = new PsqlSession('second');
  try {
    await fn(first, second);
  } finally {
    first.close();
    second.close();
  }
}

/** Escenario A: el writer toma la ruta primero; el reclamo la salta y luego ya no es huérfana. */
async function writerFirst(courierId, base) {
  const path = `courier/${courierId}/license_${base + 1}.jpg`;
  putOldObject(path, courierId);

  await withSessions(async (writer, claimer) => {
    await writer.run('A_REPLACE', `${courierSql(courierId)}
      select public.replace_courier_document(jsonb_build_object('kind', 'license', 'storagePath', '${path}'));`);

    const claim = parseClaim(
      await claimer.run('A_CLAIM', `${serviceRoleSql} select public.claim_orphan_courier_documents(100, false);`)
    );
    assert.ok(!claimedPaths(claim).includes(path), 'el reclamo no toma la ruta que un writer tiene bloqueada');
    assert.ok(claim.skippedLockedCount >= 1, 'el reclamo informa la ruta bloqueada para reintentar');

    await writer.run('A_COMMIT', 'commit;');
    await claimer.run('A_CLAIM_COMMIT', 'commit;');
  });

  assert.equal(documentCount(path), 1, 'el writer que llegó primero conserva su fila');
  assert.equal(claimCount(path), 0, 'no existe reclamo sobre una ruta referenciada');

  await withSessions(async (claimer) => {
    const retry = parseClaim(
      await claimer.run('A_RETRY', `${serviceRoleSql} select public.claim_orphan_courier_documents(100, false);`)
    );
    assert.ok(!claimedPaths(retry).includes(path), 'tras el commit del writer la ruta deja de ser candidata');
    await claimer.run('A_RETRY_COMMIT', 'commit;');
  });
}

/** Escenario B: el reclamo toma la ruta primero; el writer espera y falla con NOT_FOUND. */
async function claimFirst(courierId, base, { expectGuard }) {
  const path = `courier/${courierId}/license_${base + 2}.jpg`;
  putOldObject(path, courierId);

  let writerOutput = '';
  await withSessions(async (claimer, writer) => {
    const claim = parseClaim(
      await claimer.run('B_CLAIM', `${serviceRoleSql} select public.claim_orphan_courier_documents(100, false);`)
    );
    assert.ok(claimedPaths(claim).includes(path), 'el reclamo toma la ruta huérfana');

    const pending = writer.send(
      'B_REPLACE',
      `${courierSql(courierId)}
       select public.replace_courier_document(jsonb_build_object('kind', 'license', 'storagePath', '${path}'));
       commit;`
    );
    if (expectGuard) await writer.assertBlocked(pending);

    await claimer.run('B_CLAIM_COMMIT', 'commit;');
    writerOutput = await writer.wait(pending);
  });

  return { path, writerOutput };
}

async function runGreen(courierId, base) {
  resetRejectedLicense(courierId, `courier/${courierId}/license_${base}.jpg`);
  await writerFirst(courierId, base);

  resetRejectedLicense(courierId, `courier/${courierId}/license_${base}.jpg`);
  const { path, writerOutput } = await claimFirst(courierId, base, { expectGuard: true });
  assert.match(writerOutput, /ERROR:\s+NOT_FOUND/, 'el writer bloqueado falla con NOT_FOUND tras el reclamo');
  assert.equal(documentCount(path), 0, 'ninguna fila referencia la ruta reclamada');
  assert.equal(claimCount(path), 1, 'el reclamo queda persistido');
  console.log('[CC-030] GREEN: writer primero gana; reclamo primero bloquea al writer sin TOCTOU.');
}

async function runMutationCheck(courierId, base) {
  runSql('alter table public.courier_documents disable trigger courier_documents_orphan_claim_guard;');
  try {
    resetRejectedLicense(courierId, `courier/${courierId}/license_${base}.jpg`);
    const { path, writerOutput } = await claimFirst(courierId, base + 10, { expectGuard: false });
    assert.doesNotMatch(writerOutput, /ERROR:/, 'mutación: sin trigger el writer no encuentra barrera');
    assert.equal(documentCount(path), 1, 'mutación: la ruta reclamada quedó referenciada (TOCTOU)');
    assert.equal(claimCount(path), 1, 'mutación: el reclamo convive con la fila');
    console.log('[CC-030] RED confirmado: sin el trigger de guarda un writer adopta una ruta ya reclamada.');
  } finally {
    runSql('alter table public.courier_documents enable trigger courier_documents_orphan_claim_guard;');
  }
  await runGreen(courierId, base + 100);
}

async function main() {
  const courierId = crypto.randomUUID();
  const base = 1_700_000_000_000;

  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier_${courierId}@cc030.test', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;
    insert into public.profiles (id, role, consent_status)
    values ('${courierId}', 'courier', 'active')
    on conflict (id) do update set role = 'courier', consent_status = 'active';
    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
    values ('${courierId}', 'pending', false, 'moto', 'CC30INT')
    on conflict (profile_id) do update set status = 'pending';
    insert into storage.buckets (id, name, public)
    values ('courier-docs', 'courier-docs', false)
    on conflict (id) do nothing;
  `);

  try {
    if (process.argv.includes('--mutation-check')) {
      await runMutationCheck(courierId, base);
    } else {
      await runGreen(courierId, base);
    }
  } finally {
    runSql(`
      delete from public.audit_log where actor_id = '${courierId}';
      delete from public.courier_documents where courier_id = '${courierId}';
      delete from app_private.courier_document_orphan_claims where storage_path like 'courier/${courierId}/%';
      select set_config('storage.allow_delete_query', 'true', false);
      delete from storage.objects where bucket_id = 'courier-docs' and name like 'courier/${courierId}/%';
      delete from public.couriers where profile_id = '${courierId}';
      delete from public.profiles where id = '${courierId}';
      delete from auth.users where id = '${courierId}';
    `);
  }
}

main().catch((error) => {
  console.error(`[CC-030] ERROR: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
