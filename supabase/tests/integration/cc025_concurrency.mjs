/**
 * Runner de concurrencia determinista de dos sesiones PostgreSQL para CC-025 (H02).
 *
 * Verifica que ambas funciones críticas (admin_verify_document y replace_courier_document)
 * adquieren locks en orden estrictamente uniforme:
 *   1. public.couriers (por profile_id)
 *   2. public.courier_documents (por id)
 *
 * Escenarios probados:
 *   1. Admin AAL2 decide mientras Courier intenta sustituir el documento (orden couriers -> docs).
 *      No hay deadlock SQLSTATE 40P01; se preserva versión única vigente e integridad de auditoría.
 *   2. Courier sustituye mientras Admin AAL2 intenta decidir sobre el documento.
 *      No hay deadlock SQLSTATE 40P01; Admin recibe INVALID_STATE_TRANSITION al quedar obsoleto el doc.
 *   3. Control de mutación negativa (--mutation-check):
 *      Invertir el orden de adquisición entre couriers y courier_documents provoca deadlock real (SQLSTATE 40P01)
 *      bajo concurrencia cruzada; el orden uniforme de producción previene el deadlock.
 */

import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-025][H02] ERROR: La variable de entorno DB_CONTAINER no está definida.');
  process.exit(1);
}

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20261016210000_cc025_courier_document_replacement.sql'
);

function runSql(sql) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(`[CC-025][H02] SQL error: ${res.stderr || res.stdout}\nQuery: ${sql}`);
  }
  return res.stdout.trim();
}

function claimsSql(actorId, role, aal = 'aal1') {
  return `jsonb_build_object('sub', '${actorId}', 'role', 'authenticated', 'aal', '${aal}')::text`;
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.proc = spawn(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.output = '';
    this.pid = null;
    this.processFailure = null;

    this.proc.on('error', (err) => {
      this.processFailure = `error de proceso: ${err.message}`;
    });
    this.proc.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        this.processFailure = `proceso terminó con código ${code}`;
      } else if (signal) {
        this.processFailure = `proceso terminó por señal ${signal}`;
      }
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
      throw new Error(`[CC-025][H02][${this.label}] No se puede enviar SQL: el proceso ya terminó.`);
    }
    this.proc.stdin.write(sql.trim() + '\n');
  }

  async waitFor(marker, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = typeof marker === 'string' ? this.output.includes(marker) : marker.test(this.output);
      if (found) {
        return this.output;
      }
      if (this.processFailure) {
        throw new Error(`[CC-025][H02][${this.label}] ${this.processFailure} mientras esperaba ${marker}`);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`[CC-025][H02][${this.label}] Timeout esperando marcador "${marker}". Salida:\n${this.output}`);
  }

  async initPid() {
    this.send(`select 'PID:' || pg_backend_pid() || ':ENDPID';`);
    await this.waitFor(/PID:\d+:ENDPID/);
    const m = this.output.match(/PID:(\d+):ENDPID/);
    if (!m) throw new Error(`[CC-025][H02][${this.label}] No se pudo determinar pg_backend_pid`);
    this.pid = Number(m[1]);
    return this.pid;
  }

  async configure(actorId, role, aal = 'aal1') {
    const marker = `CONFIGURED_${crypto.randomUUID()}`;
    this.send(`
      \\pset tuples_only on
      \\pset format unaligned
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', ${claimsSql(actorId, role, aal)}, true);
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
    const countStr = runSql(`
      select count(*)::int
      from pg_stat_activity
      where pid = ${waiterPid}
        and wait_event_type = 'Lock'
        and ${blockerPid} = any(pg_blocking_pids(${waiterPid}));
    `);
    if (Number(countStr) > 0) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`[CC-025][H02] Timeout esperando bloqueo: ${waiterPid} bloqueado por ${blockerPid}`);
}

async function runScenario1(adminId, courierId, docId) {
  console.log('[CC-025][H02] Ejecutando Escenario 1: Admin decide mientras Courier intenta reemplazar...');

  const adminSession = new PsqlSession('Admin-S1');
  const courierSession = new PsqlSession('Courier-S1');

  try {
    const adminPid = await adminSession.initPid();
    const courierPid = await courierSession.initPid();

    await adminSession.configure(adminId, 'admin', 'aal2');
    await courierSession.configure(courierId, 'courier', 'aal1');

    // 1. Admin adquiere lock de couriers
    const lockMarker = `ADMIN_LOCKED_${crypto.randomUUID()}`;
    adminSession.send(`
      select 1 from public.couriers where profile_id = '${courierId}' for update;
      select '${lockMarker}';
    `);
    await adminSession.waitFor(lockMarker);

    // 2. Courier intenta replace_courier_document concurrentemente (bloqueará en couriers)
    const courierResultMarker = `COURIER_RES_${crypto.randomUUID()}`;
    courierSession.send(`
      do $c1$
      declare
        v_res jsonb;
      begin
        begin
          v_res := public.replace_courier_document(jsonb_build_object(
            'kind', 'license',
            'storagePath', 'courier/${courierId}/license_v2.jpg',
            'idempotencyKey', '00000000-0000-4000-8000-0000000001a1'
          ));
          raise notice '${courierResultMarker}:OK:%:END_${courierResultMarker}', v_res::text;
        exception when others then
          raise notice '${courierResultMarker}:ERROR:%:END_${courierResultMarker}', SQLERRM;
        end;
      end $c1$;
    `);

    // 3. Confirmar que Courier está bloqueado esperando a Admin
    await waitForBlockedLock(adminPid, courierPid);

    // 4. Admin completa decisión verificando el documento original y comitea
    const adminCommitMarker = `ADMIN_COMMITTED_${crypto.randomUUID()}`;
    adminSession.send(`
      select public.admin_verify_document('${docId}', 'verified');
      commit;
      select '${adminCommitMarker}';
    `);
    await adminSession.waitFor(adminCommitMarker);

    // 5. Courier se desbloquea: debe evaluar estado verificado y fallar limpiamente con INVALID_STATE_TRANSITION
    await courierSession.waitFor(`END_${courierResultMarker}`);
    const courierOutput = courierSession.output;

    assert.ok(!courierOutput.includes('40P01'), 'No debe ocurrir deadlock SQLSTATE 40P01');
    assert.ok(
      courierOutput.includes('INVALID_STATE_TRANSITION'),
      'Courier debe recibir INVALID_STATE_TRANSITION porque el documento fue aprobado por admin'
    );

    // 6. Verificar invariantes en la base de datos
    const currentCount = Number(
      runSql(`select count(*)::int from public.courier_documents where courier_id = '${courierId}' and is_current = true;`)
    );
    assert.equal(currentCount, 1, 'Debe existir exactamente 1 documento vigente');

    const verifiedDocId = runSql(
      `select id from public.courier_documents where courier_id = '${courierId}' and is_current = true and status = 'verified';`
    );
    assert.equal(verifiedDocId, docId, 'El documento original debe quedar verificado');

    console.log('[CC-025][H02] Escenario 1 GREEN: Sin deadlock 40P01, lock ordenado respetado, estado consistente.');
  } finally {
    await adminSession.close();
    await courierSession.close();
  }
}

async function runScenario2(adminId, courierId, docId) {
  console.log('[CC-025][H02] Ejecutando Escenario 2: Courier sustituye mientras Admin intenta verificar...');

  // Resetear documento a status rejected para habilitar reemplazo
  runSql(`
    update public.courier_documents
    set status = 'rejected', rejection_code = 'illegible', is_current = true
    where id = '${docId}';
    update public.couriers set license_status = 'rejected' where profile_id = '${courierId}';
  `);

  const adminSession = new PsqlSession('Admin-S2');
  const courierSession = new PsqlSession('Courier-S2');

  try {
    const adminPid = await adminSession.initPid();
    const courierPid = await courierSession.initPid();

    await adminSession.configure(adminId, 'admin', 'aal2');
    await courierSession.configure(courierId, 'courier', 'aal1');

    // 1. Courier ejecuta replace_courier_document en su transacción (retiene lock couriers y courier_documents)
    const courierResultMarker = `COURIER_RES_${crypto.randomUUID()}`;
    courierSession.send(`
      do $c2$
      declare
        v_res jsonb;
      begin
        begin
          v_res := public.replace_courier_document(jsonb_build_object(
            'kind', 'license',
            'storagePath', 'courier/${courierId}/license_v2.jpg',
            'idempotencyKey', '00000000-0000-4000-8000-0000000001a2'
          ));
          raise notice '${courierResultMarker}:OK:%:END_${courierResultMarker}', v_res::text;
        exception when others then
          raise notice '${courierResultMarker}:ERROR:%:END_${courierResultMarker}', SQLERRM;
        end;
      end $c2$;
    `);
    await courierSession.waitFor(`END_${courierResultMarker}`);
    assert.ok(courierSession.output.includes(`${courierResultMarker}:OK:`), 'Courier debe ejecutar reemplazo exitoso en su tx');

    // 2. Admin intenta admin_verify_document concurrentemente antes del commit del courier (bloqueará en couriers)
    const adminResultMarker = `ADMIN_RES_${crypto.randomUUID()}`;
    adminSession.send(`
      do $a2$
      declare
        v_res jsonb;
      begin
        begin
          v_res := public.admin_verify_document('${docId}', 'verified');
          raise notice '${adminResultMarker}:OK:%:END_${adminResultMarker}', v_res::text;
        exception when others then
          raise notice '${adminResultMarker}:ERROR:%:END_${adminResultMarker}', SQLERRM;
        end;
      end $a2$;
    `);

    // 3. Confirmar que Admin está bloqueado esperando a Courier
    await waitForBlockedLock(courierPid, adminPid);

    // 4. Courier comitea su transacción liberando los locks
    const courierCommitMarker = `COURIER_COMMITTED_${crypto.randomUUID()}`;
    courierSession.send(`
      commit;
      select '${courierCommitMarker}';
    `);
    await courierSession.waitFor(courierCommitMarker);

    // 5. Admin se desbloquea: bajo lock descubre que docId ya no es vigente (is_current = false)
    // y falla limpiamente con INVALID_STATE_TRANSITION
    await adminSession.waitFor(`END_${adminResultMarker}`);
    const adminOutput = adminSession.output;

    assert.ok(!adminOutput.includes('40P01'), 'No debe ocurrir deadlock SQLSTATE 40P01');
    assert.ok(
      adminOutput.includes('INVALID_STATE_TRANSITION'),
      'Admin debe recibir INVALID_STATE_TRANSITION al intentar verificar versión que quedó obsoleta'
    );

    // 6. Verificar invariantes en la base de datos
    const currentCount = Number(
      runSql(`select count(*)::int from public.courier_documents where courier_id = '${courierId}' and is_current = true;`)
    );
    assert.equal(currentCount, 1, 'Debe existir exactamente 1 documento vigente tras reemplazo');

    const oldDocCurrent = runSql(`select is_current from public.courier_documents where id = '${docId}';`);
    assert.equal(oldDocCurrent, 'f', 'El documento reemplazado debe tener is_current = false');

    const auditCount = Number(
      runSql(
        `select count(*)::int from public.audit_log where actor_id = '${courierId}' and action = 'replace_courier_document';`
      )
    );
    assert.equal(auditCount, 1, 'Debe existir exactamente 1 registro en audit_log para el reemplazo');

    console.log('[CC-025][H02] Escenario 2 GREEN: Sin deadlock 40P01, serialización limpia ante reemplazo concurrente.');
  } finally {
    await adminSession.close();
    await courierSession.close();
  }
}

async function runScenario3B0AndReplaceLockOrder(adminId, courierId, docId) {
  console.log('[CC-025][H02] Ejecutando Escenario 3: Orden unificado de locks entre B0 (submit_courier_onboarding_documents) y Fase C...');

  const b0CourierId = crypto.randomUUID();
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values ('${b0CourierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b0c_${b0CourierId}@cc025.test', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values ('${b0CourierId}', 'courier', 'active')
    on conflict (id) do update set role = 'courier', consent_status = 'active';

    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
    values ('${b0CourierId}', 'pending', false, 'moto', 'CC25B0C')
    on conflict (profile_id) do update set status = 'pending';

    insert into storage.objects (id, bucket_id, name, owner)
    values (gen_random_uuid(), 'courier-docs', 'courier/${b0CourierId}/dni_front_v2.jpg', '${b0CourierId}')
    on conflict do nothing;
  `);

  const payloadB0 = JSON.stringify([
    { kind: 'dni_front', storage_path: `courier/${b0CourierId}/dni_front_v1.jpg` },
    { kind: 'dni_back', storage_path: `courier/${b0CourierId}/dni_back_v1.jpg` },
    { kind: 'selfie', storage_path: `courier/${b0CourierId}/selfie_v1.jpg` },
    { kind: 'avatar', storage_path: `courier/${b0CourierId}/avatar_v1.jpg` },
  ]);

  const s1 = new PsqlSession('B0-Session');
  const s2 = new PsqlSession('Replace-Session');

  try {
    const pid1 = await s1.initPid();
    const pid2 = await s2.initPid();

    await s1.configure(b0CourierId, 'courier', 'aal1');
    await s2.configure(b0CourierId, 'courier', 'aal1');

    // 1. S1 ejecuta submit_courier_onboarding_documents (adquiere couriers FOR UPDATE e inserta los 4 docs)
    const s1Marker = `B0_DONE_${crypto.randomUUID()}`;
    s1.send(`
      select public.submit_courier_onboarding_documents('${payloadB0}'::jsonb);
      select '${s1Marker}';
    `);
    await s1.waitFor(s1Marker);

    // 2. S2 invoca replace_courier_document concurrentemente y se bloquea en couriers FOR UPDATE (mismo primer lock)
    const s2Marker = `REP_RES_${crypto.randomUUID()}`;
    s2.send(`
      do $s3$
      declare
        v_res jsonb;
      begin
        begin
          v_res := public.replace_courier_document(jsonb_build_object(
            'kind', 'dni_front',
            'storagePath', 'courier/${b0CourierId}/dni_front_v2.jpg'
          ));
          raise notice '${s2Marker}:OK:%:END_${s2Marker}', v_res::text;
        exception when others then
          raise notice '${s2Marker}:ERROR:%:END_${s2Marker}', SQLERRM;
        end;
      end $s3$;
    `);

    await waitForBlockedLock(pid1, pid2);

    // 3. S1 comitea el alta B0
    const s1Commit = `B0_COMMIT_${crypto.randomUUID()}`;
    s1.send(`
      commit;
      select '${s1Commit}';
    `);
    await s1.waitFor(s1Commit);

    // 4. S2 se desbloquea, ve dni_front en estado 'submitted' y rechaza con INVALID_STATE_TRANSITION (0 deadlocks)
    await s2.waitFor(`END_${s2Marker}`);
    assert.ok(!s2.output.includes('40P01'), 'No debe ocurrir deadlock 40P01 entre B0 y replace_courier_document');
    assert.ok(
      s2.output.includes('INVALID_STATE_TRANSITION'),
      'replace_courier_document debe rechazar con INVALID_STATE_TRANSITION tras el alta B0 en submitted'
    );

    const activeDocsCount = Number(
      runSql(`select count(*)::int from public.courier_documents where courier_id = '${b0CourierId}' and is_current = true;`)
    );
    assert.equal(activeDocsCount, 4, 'Deben existir exactamente los 4 documentos vigentes insertados por B0');

    console.log('[CC-025][H02] Escenario 3 GREEN: B0 y replace_courier_document serializan limpiamente sobre couriers FOR UPDATE.');
  } finally {
    await s1.close();
    await s2.close();
    runSql(`
      delete from public.courier_documents where courier_id = '${b0CourierId}';
      delete from public.couriers where profile_id = '${b0CourierId}';
      update storage.objects set owner = null where owner = '${b0CourierId}';
      delete from public.profiles where id = '${b0CourierId}';
      delete from auth.users where id = '${b0CourierId}';
    `);
  }
}

async function runDeadlockMutationCheck(adminId, courierId, docId) {
  console.log('[CC-025][H02] Ejecutando control de mutación RED->GREEN sobre la función SQL real replace_courier_document...');

  const originalSql = fs.readFileSync(migrationPath, 'utf8');

  // Mutar la función real replace_courier_document eliminando el lock inicial sobre public.couriers FOR UPDATE.
  // Sin ese lock inicial, replace_courier_document bloquea primero courier_documents FOR UPDATE y recién al final
  // ejecuta UPDATE public.couriers SET license_status = 'submitted' (invirtiendo el orden a courier_documents -> couriers
  // frente a admin_verify_document que toma couriers -> courier_documents).
  const targetLockBlock = `  -- PR364-H02 / B0-H03: Lock ordenado unificado: 1. couriers FOR UPDATE + elegibilidad de estado
  select profile_id, status into v_courier_rec
  from public.couriers
  where profile_id = v_actor_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if v_courier_rec.status::text in ('rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED_ACTOR';
  end if;`;

  assert.ok(
    originalSql.includes(targetLockBlock),
    '[CC-025][H02] No se encontró el bloque literal de lock couriers FOR UPDATE en 20261016210000_cc025_courier_document_replacement.sql'
  );

  const mutatedSql = originalSql.replace(
    targetLockBlock,
    '  -- MUTACIÓN DE PRUEBA: sin lock inicial sobre couriers (invierte orden real a courier_documents -> couriers)'
  );
  assert.notEqual(originalSql, mutatedSql, 'La mutación debe alterar el SQL real de replace_courier_document');

  try {
    // 1. Aplicar la migración mutada en PostgreSQL
    runSql(mutatedSql);

    // Preparar documento en estado 'rejected' para que replace_courier_document avance hasta el UPDATE de couriers,
    // mientras admin_verify_document se invoca en paralelo tras bloquear couriers.
    runSql(`
      delete from public.courier_documents where courier_id = '${courierId}';
      insert into public.courier_documents (id, courier_id, kind, storage_path, status, rejection_code, is_current)
      values ('${docId}', '${courierId}', 'license', 'courier/${courierId}/license_initial.jpg', 'rejected', 'illegible', true);
      update public.couriers set license_status = 'rejected' where profile_id = '${courierId}';
    `);

    const adminSession = new PsqlSession('Mutant-Admin');
    const courierSession = new PsqlSession('Mutant-Courier');

    try {
      const adminPid = await adminSession.initPid();
      const courierPid = await courierSession.initPid();

      await adminSession.configure(adminId, 'admin', 'aal2');
      await courierSession.configure(courierId, 'courier', 'aal1');

      // Paso A: Admin toma el primer lock de su jerarquía (public.couriers FOR UPDATE)
      const adminLockedMarker = `MUT_ADMIN_LOCKED_${crypto.randomUUID()}`;
      adminSession.send(`
        select 1 from public.couriers where profile_id = '${courierId}' for update;
        select '${adminLockedMarker}';
      `);
      await adminSession.waitFor(adminLockedMarker);

      // Paso B: Courier invoca la RPC REAL mutada public.replace_courier_document para 'license'.
      // Como el lock inicial sobre couriers fue removido en la mutación, la RPC toma primero el lock sobre
      // courier_documents(id = docId), actualiza courier_documents, inserta la nueva versión y se bloquea en
      // "update public.couriers set license_status = 'submitted' where profile_id = v_actor_id" esperando a Admin!
      const courierDoneMarker = `MUT_COURIER_DONE_${crypto.randomUUID()}`;
      courierSession.send(`
        do $mut_c$
        declare
          v_res jsonb;
        begin
          begin
            v_res := public.replace_courier_document(jsonb_build_object(
              'kind', 'license',
              'storagePath', 'courier/${courierId}/license_v2.jpg',
              'idempotencyKey', '00000000-0000-4000-8000-0000000001a9'
            ));
            raise notice 'MUT_COURIER_OK:%', v_res::text;
          exception when deadlock_detected then
            raise notice 'DEADLOCK_40P01_DETECTED';
          when others then
            raise notice 'MUT_COURIER_ERR:%:%', SQLSTATE, SQLERRM;
          end;
        end $mut_c$;
        select '${courierDoneMarker}';
      `);

      // Confirmar en pg_stat_activity que la RPC replace_courier_document está bloqueada esperando a Admin
      await waitForBlockedLock(adminPid, courierPid);

      // Paso C: Admin invoca la RPC REAL public.admin_verify_document('${docId}', 'verified'),
      // la cual intenta tomar el lock sobre courier_documents(id = docId) que retiene Courier -> DEADLOCK 40P01!
      const adminDoneMarker = `MUT_ADMIN_DONE_${crypto.randomUUID()}`;
      adminSession.send(`
        do $mut_a$
        declare
          v_res jsonb;
        begin
          begin
            v_res := public.admin_verify_document('${docId}', 'verified');
            raise notice 'MUT_ADMIN_OK:%', v_res::text;
          exception when deadlock_detected then
            raise notice 'DEADLOCK_40P01_DETECTED';
          when others then
            raise notice 'MUT_ADMIN_ERR:%:%', SQLSTATE, SQLERRM;
          end;
        end $mut_a$;
        select '${adminDoneMarker}';
      `);

      let deadlockDetected = false;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (
          adminSession.output.includes('DEADLOCK_40P01_DETECTED') ||
          courierSession.output.includes('DEADLOCK_40P01_DETECTED') ||
          adminSession.output.includes('40P01') ||
          courierSession.output.includes('40P01')
        ) {
          deadlockDetected = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 40));
      }

      assert.ok(
        deadlockDetected,
        `[CC-025][H02] La mutación de la RPC real replace_courier_document sin lock inicial en couriers DEBE producir deadlock 40P01.\nAdmin output:\n${adminSession.output}\nCourier output:\n${courierSession.output}`
      );
      console.log('[CC-025][H02] Control de mutación RED confirmado: al omitir couriers FOR UPDATE en replace_courier_document, las RPCs reales entran en deadlock 40P01.');
    } finally {
      await adminSession.close();
      await courierSession.close();
    }

    // 2. Restaurar la migración original de producción y comprobar que el mismo escenario vuelve a GREEN (0 deadlocks)
    runSql(originalSql);
    runSql(`
      delete from public.courier_documents where courier_id = '${courierId}';
      insert into public.courier_documents (id, courier_id, kind, storage_path, status, is_current)
      values ('${docId}', '${courierId}', 'license', 'courier/${courierId}/license_initial.jpg', 'submitted', true);
      update public.couriers set license_status = 'submitted' where profile_id = '${courierId}';
    `);
    await runScenario1(adminId, courierId, docId);
    console.log('[CC-025][H02] Control de mutación GREEN confirmado: tras restaurar la migración original, las RPCs serializan sin deadlock 40P01.');
  } finally {
    runSql(originalSql);
  }
}

async function main() {
  const adminId = crypto.randomUUID();
  const courierId = crypto.randomUUID();
  const docId = crypto.randomUUID();

  // Setup de entidades
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${adminId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_${adminId}@cc025.test', 'pwd', '{"role":"merchant"}'::jsonb),
      ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier_${courierId}@cc025.test', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values
      ('${adminId}', 'admin', 'active'),
      ('${courierId}', 'courier', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';

    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate, license_status)
    values ('${courierId}', 'pending', false, 'moto', 'CC25H02', 'submitted')
    on conflict (profile_id) do update set status = 'pending', license_status = 'submitted';

    insert into storage.buckets (id, name, public)
    values ('courier-docs', 'courier-docs', false)
    on conflict (id) do nothing;

    insert into storage.objects (id, bucket_id, name, owner)
    values
      (gen_random_uuid(), 'courier-docs', 'courier/${courierId}/license_initial.jpg', '${courierId}'),
      (gen_random_uuid(), 'courier-docs', 'courier/${courierId}/license_v2.jpg', '${courierId}')
    on conflict do nothing;

    insert into public.courier_documents (id, courier_id, kind, storage_path, status, is_current)
    values ('${docId}', '${courierId}', 'license', 'courier/${courierId}/license_initial.jpg', 'submitted', true)
    on conflict do nothing;
  `);

  try {
    if (process.argv.includes('--mutation-check')) {
      await runDeadlockMutationCheck(adminId, courierId, docId);
    } else {
      await runScenario1(adminId, courierId, docId);
      await runScenario2(adminId, courierId, docId);
      await runScenario3B0AndReplaceLockOrder(adminId, courierId, docId);
    }
    console.log('[CC-025][H02] Todos los escenarios concurrentes solicitados completados con éxito.');
  } finally {
    runSql(`
      delete from public.audit_log where actor_id in ('${adminId}', '${courierId}') or target_id in ('${adminId}', '${courierId}');
      delete from public.courier_documents where courier_id = '${courierId}';
      delete from public.couriers where profile_id = '${courierId}';
      update storage.objects set owner = null where owner = '${courierId}';
      delete from public.profiles where id in ('${adminId}', '${courierId}');
      delete from auth.users where id in ('${adminId}', '${courierId}');
    `);
  }
}

main().catch((err) => {
  console.error(`[CC-025][H02] ERROR: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  process.exitCode = 1;
});
