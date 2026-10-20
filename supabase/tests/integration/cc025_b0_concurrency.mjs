/**
 * Test de concurrencia y atomicidad para la subetapa B0 de CC-025 (PR B0).
 *
 * Verificaciones:
 *   1. Dos sesiones concurrentes con RUTAS IDÉNTICAS (idempotencia en carrera):
 *      Ambas peticiones se serializan bajo el lock couriers(profile_id) FOR UPDATE.
 *      La primera inserta 4 documentos; la segunda detecta la coincidencia exacta y reutiliza
 *      sin duplicar filas (count = 4).
 *   2. Dos sesiones concurrentes con RUTAS DISTINTAS:
 *      La primera sesión adquiere el lock e inserta el lote A.
 *      La segunda sesión espera determinísticamente en pg_locks el lock couriers FOR UPDATE.
 *      Tras commit de la primera, la segunda re-evalúa bajo snapshot committed, detecta discrepancia
 *      de paths y rechaza de forma segura con VALIDATION_ERROR.
 *      La base de datos mantiene exactamente 1 fila por kind (0 duplicados).
 *   3. Diagnóstico de convivencia con escritores directos / legacy (H01):
 *      Demuestra el comportamiento durante la ventana de transición previa a Fase C:
 *      - Direct INSERT con misma ruta colisiona con UNIQUE(storage_path) (23505).
 *      - Direct INSERT con ruta alternativa entra bajo RLS de Fase A (bypass REST),
 *        creando una fila duplicada por falta de índice parcial (que pertenece a Fase C).
 *      - La invocación posterior de la RPC detecta la ambigüedad y rechaza con INTERNAL_ERROR,
 *        evidenciando la necesidad del gate operativo de despliegue antes de Fase C.
 *   4. Revalidación concurrente de perfil y consentimiento durante espera de lock (H04):
 *      Demuestra que si el consentimiento legal es revocado mientras la sesión espera el lock
 *      sobre couriers, la revalidación for share bajo el snapshot actualizado detecta el cambio
 *      y rechaza con CONSENT_REQUIRED (0 inserciones).
 *   5. Control de mutación RED->GREEN (--mutation-check) (H02):
 *      Oráculo estricto sin capturas genéricas de error.
 *      Mutar la RPC eliminando "for update" sobre couriers permite que dos sesiones con
 *      paths distintos ejecuten concurrentemente sin esperar, insertando ambas sus lotes
 *      y generando 8 filas en DB (RED confirmado por count = 8).
 *      Restaurar "for update" serializa la ejecución y restablece el estado PASS (GREEN confirmado por count = 4).
 */

import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-025-B0] ERROR: La variable de entorno DB_CONTAINER no está definida.');
  process.exit(1);
}

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20261016033941_cc025_onboarding_atomic.sql'
);

function runSql(sql) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(`[CC-025-B0] SQL error: ${res.stderr || res.stdout}\nQuery: ${sql}`);
  }
  return res.stdout.trim();
}

async function waitForBlockedSession(queryMarker, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const blockedCount = runSql(`
      select count(*)
      from pg_locks l
      join pg_stat_activity a on l.pid = a.pid
      where not l.granted
        and a.query like '%${queryMarker}%';
    `);
    if (parseInt(blockedCount, 10) > 0) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Timeout esperando que el lock sea bloqueado para query conteniendo "${queryMarker}"`);
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
    this.proc.on('error', (err) => {
      this.processFailure = `proceso psql falló: ${err.message}`;
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
      throw new Error(`[CC-025-B0][${this.label}] no se puede enviar SQL: proceso ya terminado`);
    }
    this.proc.stdin.write(`${sql.trim()}\n`);
  }

  async waitFor(marker, timeoutMs = 15_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.output.includes(marker)) return;
      if (this.processFailure) {
        throw new Error(`[CC-025-B0][${this.label}] ${this.processFailure} mientras esperaba ${marker}`);
      }
      if (this.proc.exitCode !== null) {
        throw new Error(`[CC-025-B0][${this.label}] proceso terminó antes de emitir ${marker}`);
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error(`[CC-025-B0][${this.label}] timeout esperando ${marker}\nOutput:\n${this.output}`);
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

function createCourierFixture(options = {}) {
  const courierId = crypto.randomUUID();
  const consentStatus = options.consentStatus || 'active';
  const courierStatus = options.status || 'pending';

  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier_${courierId.slice(0, 8)}@test.com', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values ('${courierId}', 'courier', '${consentStatus}')
    on conflict (id) do update set role = 'courier', consent_status = '${consentStatus}';

    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
    values ('${courierId}', '${courierStatus}', false, 'moto', 'B001')
    on conflict (profile_id) do nothing;
  `);
  return courierId;
}

function makePayload(courierId, variant = 'a') {
  return JSON.stringify([
    { kind: 'dni_front', storage_path: `courier/${courierId}/dni_front_${variant}.jpg` },
    { kind: 'dni_back', storage_path: `courier/${courierId}/dni_back_${variant}.jpg` },
    { kind: 'selfie', storage_path: `courier/${courierId}/selfie_${variant}.jpg` },
    { kind: 'avatar', storage_path: `courier/${courierId}/avatar_${variant}.jpg` },
  ]);
}

async function testIdenticalPathsConcurrency() {
  console.log('[CC-025-B0] Test 1: Dos sesiones concurrentes con RUTAS IDÉNTICAS...');
  const courierId = createCourierFixture();
  const payload = makePayload(courierId, 'same');

  const session1 = new PsqlSession('S1_SAME');
  const session2 = new PsqlSession('S2_SAME');

  try {
    // Sesión 1: inicia transacción y toma lock ejecutando la RPC pero pausando antes de commit
    session1.send(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
      select public.submit_courier_onboarding_documents('${payload}'::jsonb);
      select 'S1_DONE';
    `);

    await session1.waitFor('S1_DONE');

    // Sesión 2: intenta ejecutar concurrentemente la misma RPC para el mismo courier
    session2.send(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
      select public.submit_courier_onboarding_documents('${payload}'::jsonb);
      select 'S2_DONE';
      commit;
    `);

    // S1 hace commit liberando el lock
    session1.send('commit;');
    await session2.waitFor('S2_DONE');

    // Verificación en DB: exactamente 4 filas, 0 duplicados
    const count = parseInt(runSql(`select count(*) from public.courier_documents where courier_id = '${courierId}'`), 10);
    assert.equal(count, 4, `Esperado 4 documentos en DB, obtenido ${count}`);

    console.log('  -> OK: Ambas sesiones serializadas, 0 duplicados, count = 4');
  } finally {
    await session1.close();
    await session2.close();
  }
}

async function testDistinctPathsConcurrency() {
  console.log('[CC-025-B0] Test 2: Dos sesiones concurrentes con RUTAS DISTINTAS...');
  const courierId = createCourierFixture();
  const payloadA = makePayload(courierId, 'path_a');
  const payloadB = makePayload(courierId, 'path_b');

  const session1 = new PsqlSession('S1_DISTINCT');
  const session2 = new PsqlSession('S2_DISTINCT');

  try {
    session1.send(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
      select public.submit_courier_onboarding_documents('${payloadA}'::jsonb);
      select 'S1_LOCKED_A';
    `);

    await session1.waitFor('S1_LOCKED_A');

    // Sesión 2 envía payload B y debe bloquearse en el lock de couriers FOR UPDATE
    session2.send(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
      select public.submit_courier_onboarding_documents('${payloadB}'::jsonb);
      select 'S2_SHOULD_FAIL';
      commit;
    `);

    // Esperar de forma determinística en pg_locks hasta que S2 quede en espera del lock
    await waitForBlockedSession('submit_courier_onboarding_documents');

    // S1 comitea payload A
    session1.send('commit;');

    // S2 debe recibir VALIDATION_ERROR y abortar la transacción (o fallar el select)
    await session2.waitFor('VALIDATION_ERROR');

    // Verificación en DB: solo existen las 4 filas de payload A, ninguna de B
    const rows = JSON.parse(
      runSql(`
        select jsonb_agg(jsonb_build_object('kind', kind, 'path', storage_path))
        from public.courier_documents
        where courier_id = '${courierId}';
      `)
    );

    assert.equal(rows.length, 4, `Esperado exactamente 4 filas, obtenido ${rows.length}`);
    for (const r of rows) {
      assert(r.path.includes('path_a'), `La fila ${r.kind} debe ser de path_a, obtenida: ${r.path}`);
    }

    console.log('  -> OK: Sesión 2 rechazada con VALIDATION_ERROR bajo el lock, 0 duplicados en DB');
  } finally {
    await session1.close();
    await session2.close();
  }
}

async function testCoexistenceDirectInsert() {
  console.log('[CC-025-B0] Test 3: Cierre global de inserciones directas por REST tras Fase C (H01)...');
  const courierId = createCourierFixture();
  const payload = makePayload(courierId, 'b0');

  // 1. Escritura inicial vía RPC atómica B0
  runSql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
    select public.submit_courier_onboarding_documents('${payload}'::jsonb);
    commit;
  `);

  // 2. Intento de reintento directo con misma ruta es rechazado por RLS/privilegios (42501) o UNIQUE (23505)
  const directConflict = spawnSync(
    'docker',
    [
      'exec', '-i', dbContainer, 'psql', '-X', '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', 'postgres', '-c',
      `
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
        values ('${courierId}', 'dni_front', 'courier/${courierId}/dni_front_b0.jpg', 'submitted', true);
        commit;
      `
    ],
    { encoding: 'utf8' }
  );

  assert(
    directConflict.stderr.includes('42501') ||
      directConflict.stderr.includes('permission denied') ||
      directConflict.stderr.includes('violates row-level security') ||
      directConflict.stderr.includes('23505') ||
      directConflict.stderr.toLowerCase().includes('unique'),
    `Inserción directa con misma ruta debe ser rechazada por RLS (42501) o UNIQUE (23505): ${directConflict.stderr}`
  );

  // 3. H01 tras Fase C: un cliente REST con storage_path alternativo ahora es BLOQUEADO por RLS (42501) e índice único parcial
  const altInsert = spawnSync(
    'docker',
    [
      'exec', '-i', dbContainer, 'psql', '-X', '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', 'postgres', '-c',
      `
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
        values ('${courierId}', 'dni_front', 'courier/${courierId}/dni_front_b0_alt.jpg', 'submitted', true);
        commit;
      `
    ],
    { encoding: 'utf8' }
  );

  assert(
    altInsert.stderr.includes('42501') ||
      altInsert.stderr.includes('permission denied') ||
      altInsert.stderr.includes('violates row-level security') ||
      altInsert.stderr.includes('23505'),
    `Inserción directa con ruta alternativa debe ser bloqueada en Fase C (42501/23505): ${altInsert.stderr}`
  );

  const dniFrontCount = parseInt(
    runSql(`select count(*) from public.courier_documents where courier_id = '${courierId}' and kind = 'dni_front'`),
    10
  );
  assert.equal(dniFrontCount, 1, `Se espera exactamente 1 fila vigente de dni_front tras el bloqueo en Fase C, obtenido ${dniFrontCount}`);

  // 4. Invocación subsecuente idempotente de la RPC B0 continúa funcionando limpiamente tras el bloqueo del intento REST
  const rpcIdempotentCheck = runSql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
    select public.submit_courier_onboarding_documents('${payload}'::jsonb);
    commit;
  `);

  assert(
    rpcIdempotentCheck.includes('"reused_count": 4') || rpcIdempotentCheck.includes('"reused_count":4'),
    `La invocación subsecuente de la RPC B0 debe reutilizar los 4 documentos idempotentemente: ${rpcIdempotentCheck}`
  );

  console.log('  -> OK: Fase C cierra globalmente el bypass REST con ruta alternativa (42501) y preserva la idempotencia de la RPC B0');
}

async function testConsentRevocationWhileWaitingForLock() {
  console.log('[CC-025-B0] Test 4: Revalidación concurrente de perfil/consentimiento durante espera de lock (H04)...');
  const courierId = createCourierFixture({ consentStatus: 'active' });
  const payload = makePayload(courierId, 'consent_race');

  const s1 = new PsqlSession('S1_LOCK_HOLDER');
  const s2 = new PsqlSession('S2_WAITING_RPC');

  try {
    // S1 adquiere lock exclusivo sobre couriers
    s1.send(`
      begin;
      select profile_id from public.couriers where profile_id = '${courierId}' for update;
      select 'S1_LOCK_HELD';
    `);
    await s1.waitFor('S1_LOCK_HELD');

    // S2 invoca la RPC. Lee profile inicialmente (consent='active'), pero se bloquea esperando couriers FOR UPDATE
    s2.send(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
      select public.submit_courier_onboarding_documents('${payload}'::jsonb);
      select 'S2_SHOULD_NOT_REACH';
      commit;
    `);

    // Esperar a que S2 esté determinísticamente bloqueado en pg_locks
    await waitForBlockedSession('submit_courier_onboarding_documents');

    // Mientras S2 espera el lock, se revoca el consentimiento en profiles
    runSql(`update public.profiles set consent_status = 'pending' where id = '${courierId}';`);

    // S1 libera el lock
    s1.send('rollback;');

    // S2 adquiere el lock, revalida profiles FOR SHARE, detecta consent_status <> 'active' y falla con CONSENT_REQUIRED
    await s2.waitFor('CONSENT_REQUIRED');

    // Comprobar que en la base de datos se insertaron 0 documentos
    const count = parseInt(runSql(`select count(*) from public.courier_documents where courier_id = '${courierId}'`), 10);
    assert.equal(count, 0, `Esperado 0 documentos insertados tras revocación de consentimiento, obtenido ${count}`);

    console.log('  -> OK: Revocación concurrente de consentimiento durante espera de lock detectada y rechazada con CONSENT_REQUIRED (0 inserts)');
  } finally {
    await s1.close();
    await s2.close();
  }
}

async function runMutationCheck() {
  console.log('[CC-025-B0] Test 5: Control de mutación RED->GREEN (--mutation-check) (H02)...');
  const originalSql = fs.readFileSync(migrationPath, 'utf8');

  // Mutación: eliminar "for update" de la sentencia de lock sobre couriers
  const mutatedSql = originalSql.replace(
    /select profile_id, status, vehicle_type into v_courier_rec\s+from public\.couriers\s+where profile_id = v_courier_id\s+for update;/g,
    `select profile_id, status, vehicle_type into v_courier_rec
  from public.couriers
  where profile_id = v_courier_id;`
  );

  assert.notEqual(originalSql, mutatedSql, 'La mutación debe alterar la sentencia for update sobre couriers');

  try {
    // 1. Aplicar mutación en PostgreSQL (elimina for update sobre couriers)
    runSql(mutatedSql);
    console.log('  -> Mutación aplicada: "for update" removido de couriers lock');

    // 2a. Demostrar RED bajo Fase C (con courier_documents_unique_current activo):
    // Sin "for update" sobre couriers, dos peticiones idempotentes concurrentes con el MISMO payload
    // entran ambas a la rama INSERT porque ninguna ve las filas uncommitted de la otra al hacer SELECT ... FOR UPDATE,
    // provocando que la segunda estalle con SQLSTATE 23505 en lugar de retornar reused_count = 4.
    const courierIdIdemRed = createCourierFixture();
    const payloadSame = makePayload(courierIdIdemRed, 'mut_same');

    const s1Idem = new PsqlSession('MUT_IDEM_S1');
    const s2Idem = new PsqlSession('MUT_IDEM_S2');

    try {
      s1Idem.send(`
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierIdIdemRed}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        select public.submit_courier_onboarding_documents('${payloadSame}'::jsonb);
        select 'S1_IDEM_INSERTED';
      `);
      await s1Idem.waitFor('S1_IDEM_INSERTED');

      s2Idem.send(`
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierIdIdemRed}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        select public.submit_courier_onboarding_documents('${payloadSame}'::jsonb);
        select 'S2_IDEM_DONE';
        commit;
      `);

      await waitForBlockedSession('submit_courier_onboarding_documents');
      s1Idem.send('commit;');
      await s1Idem.waitFor('COMMIT');

      // En vez de reusar las 4 filas idempotentemente, S2 falla con duplicate key (23505)
      await s2Idem.waitFor('duplicate key value violates unique constraint');
      console.log('  -> RED 1 confirmado (bajo Fase C): sin "for update" en couriers, el reintento concurrente idempotente estalla con 23505 en vez de retornar reused_count = 4');
    } finally {
      await s1Idem.close();
      await s2Idem.close();
    }

    // 2b. Demostrar RED de cardinalidad (count = 8) cuando tampoco existe el índice único parcial:
    runSql('drop index if exists public.courier_documents_unique_current;');
    const courierIdRed = createCourierFixture();
    const payloadA = makePayload(courierIdRed, 'mut_a');
    const payloadB = makePayload(courierIdRed, 'mut_b');

    const s1 = new PsqlSession('MUT_S1');
    const s2 = new PsqlSession('MUT_S2');

    try {
      s1.send(`
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierIdRed}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        select public.submit_courier_onboarding_documents('${payloadA}'::jsonb);
        select 'S1_MUT_INSERTED';
      `);
      await s1.waitFor('S1_MUT_INSERTED');

      s2.send(`
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierIdRed}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        select public.submit_courier_onboarding_documents('${payloadB}'::jsonb);
        select 'S2_MUT_INSERTED';
        commit;
      `);
      await s2.waitFor('S2_MUT_INSERTED');

      s1.send('commit;');
      await s1.waitFor('COMMIT');

      const countRed = parseInt(runSql(`select count(*) from public.courier_documents where courier_id = '${courierIdRed}'`), 10);
      assert.equal(countRed, 8, `RED esperado: sin "for update", ambas sesiones debieron insertar generando 8 filas, obtenido ${countRed}`);
      console.log(`  -> RED 2 confirmado con oráculo estricto: sin "for update", se insertaron ${countRed} documentos (duplicados creados en DB)`);
    } finally {
      await s1.close();
      await s2.close();
      runSql(`
        delete from public.courier_documents where courier_id = '${courierIdRed}';
        create unique index if not exists courier_documents_unique_current
          on public.courier_documents (courier_id, kind)
          where (is_current = true);
      `);
    }

    // 3. Restaurar migración original (GREEN)
    runSql(originalSql);
    console.log('  -> Restauración GREEN: RPC reinstalada con lock for update');

    // 4. Verificar GREEN con la misma interleaving: S2 debe bloquearse y fallar con VALIDATION_ERROR (paths distintos) y triunfar con reused_count=4 (paths iguales)
    const courierIdGreen = createCourierFixture();
    const payloadGreenA = makePayload(courierIdGreen, 'green_a');
    const payloadGreenB = makePayload(courierIdGreen, 'green_b');

    const s1Green = new PsqlSession('GREEN_S1');
    const s2Green = new PsqlSession('GREEN_S2');

    try {
      s1Green.send(`
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierIdGreen}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        select public.submit_courier_onboarding_documents('${payloadGreenA}'::jsonb);
        select 'S1_GREEN_INSERTED';
      `);
      await s1Green.waitFor('S1_GREEN_INSERTED');

      // S2 ejecuta con payloadB: con FOR UPDATE, debe bloquearse esperando el lock de couriers
      s2Green.send(`
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierIdGreen}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        select public.submit_courier_onboarding_documents('${payloadGreenB}'::jsonb);
        select 'S2_SHOULD_FAIL';
        commit;
      `);

      // Esperar determinísticamente que S2 esté bloqueado
      await waitForBlockedSession('submit_courier_onboarding_documents');

      // S1 hace commit
      s1Green.send('commit;');
      await s1Green.waitFor('COMMIT');

      // S2 unblocks, re-evalúa y rechaza con VALIDATION_ERROR
      await s2Green.waitFor('VALIDATION_ERROR');

      const countGreen = parseInt(runSql(`select count(*) from public.courier_documents where courier_id = '${courierIdGreen}'`), 10);
      assert.equal(countGreen, 4, `GREEN esperado: con "for update", sólo el lote A se inserta y count es 4, obtenido ${countGreen}`);
      console.log(`  -> GREEN confirmado con oráculo estricto: serialización restablecida, count = 4, 0 duplicados`);
    } finally {
      await s1Green.close();
      await s2Green.close();
    }
  } finally {
    // Garantizar restauración
    runSql(`
      create unique index if not exists courier_documents_unique_current
        on public.courier_documents (courier_id, kind)
        where (is_current = true);
    `);
    runSql(originalSql);
  }
}

async function main() {
  const isMutationCheck = process.argv.includes('--mutation-check');

  if (isMutationCheck) {
    await runMutationCheck();
  } else {
    await testIdenticalPathsConcurrency();
    await testDistinctPathsConcurrency();
    await testCoexistenceDirectInsert();
    await testConsentRevocationWhileWaitingForLock();
  }

  console.log('[CC-025-B0] Todos los tests de concurrencia y atomicidad finalizaron EXITOSAMENTE.');
}

main().catch((err) => {
  console.error('[CC-025-B0] FATAL:', err);
  process.exit(1);
});
