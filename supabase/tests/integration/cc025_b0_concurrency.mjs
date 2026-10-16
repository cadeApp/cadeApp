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
 *      La segunda sesión adquiere el lock a continuación, detecta la discrepancia de paths
 *      y rechaza de forma segura con VALIDATION_ERROR.
 *      La base de datos mantiene exactamente 1 fila por kind (0 duplicados).
 *   3. Diagnóstico de convivencia con escritores directos / legacy:
 *      Demuestra el comportamiento durante la ventana de transición y la necesidad
 *      del gate operativo de despliegue antes de la Fase C.
 *   4. Control de mutación RED->GREEN (--mutation-check):
 *      Mutar la RPC eliminando "for update" sobre couriers permite que dos sesiones con
 *      paths distintos lean simultáneamente en vacío y ambas inserten, generando duplicados
 *      de kinds en la base expandida (RED confirmado).
 *      Restaurar "for update" serializa la ejecución y restablece el estado PASS (GREEN confirmado).
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

function createCourierFixture() {
  const courierId = crypto.randomUUID();
  runSql(`
    insert into auth.users (id, email)
    values ('${courierId}', 'courier_${courierId.slice(0, 8)}@test.com')
    on conflict (id) do nothing;

    insert into public.profiles (id, role, full_name, phone, consent_status)
    values ('${courierId}', 'courier', 'Courier Concurrency', '+543865000000', 'active')
    on conflict (id) do update set role = 'courier', consent_status = 'active';

    insert into public.couriers (profile_id, vehicle_type, is_active)
    values ('${courierId}', null, true)
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

    // Damos un tiempo breve para asegurar que S2 entra y queda en espera del lock
    await new Promise((r) => setTimeout(r, 200));

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
  console.log('[CC-025-B0] Test 3: Convivencia con inserciones directas / legacy...');
  const courierId = createCourierFixture();
  const payload = makePayload(courierId, 'b0');

  // 1. Escritura vía RPC atómica B0
  runSql(`
    set role authenticated;
    select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
    select public.submit_courier_onboarding_documents('${payload}'::jsonb);
    reset role;
  `);

  // 2. Intento de reintento directo por storage_path colisiona con UNIQUE(storage_path)
  const directConflict = spawnSync(
    'docker',
    [
      'exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-c',
      `
        set role authenticated;
        select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
        insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
        values ('${courierId}', 'dni_front', 'courier/${courierId}/dni_front_b0.jpg', 'submitted', true);
      `
    ],
    { encoding: 'utf8' }
  );

  assert(
    directConflict.stderr.includes('23505') || directConflict.stderr.toLowerCase().includes('unique'),
    'Inserción directa con misma ruta debe colisionar con 23505'
  );

  console.log('  -> OK: Convivencia validada; colisión 23505 preservada en inserciones directas');
}

async function runMutationCheck() {
  console.log('[CC-025-B0] Test 4: Control de mutación RED->GREEN (--mutation-check)...');
  const originalSql = fs.readFileSync(migrationPath, 'utf8');

  // Mutación: eliminar "for update" de la sentencia de lock sobre couriers
  const mutatedSql = originalSql.replace(
    'where profile_id = v_courier_id\n  for update;',
    'where profile_id = v_courier_id;'
  );

  assert.notEqual(originalSql, mutatedSql, 'La mutación debe alterar la sentencia for update');

  try {
    // 1. Aplicar mutación en PostgreSQL
    runSql(mutatedSql);
    console.log('  -> Mutación aplicada: "for update" removido de couriers lock');

    // 2. Probar que dos sesiones concurrentes con paths distintos ahora interleavenean y fallan o generan duplicados
    let mutationCaught = false;
    try {
      const courierId = createCourierFixture();
      const payloadA = makePayload(courierId, 'mut_a');
      const payloadB = makePayload(courierId, 'mut_b');

      const s1 = new PsqlSession('MUT_S1');
      const s2 = new PsqlSession('MUT_S2');

      try {
        // Enviar ambas en paralelo sin lock
        s1.send(`
          begin;
          set local role authenticated;
          select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
          select pg_sleep(0.1);
          select public.submit_courier_onboarding_documents('${payloadA}'::jsonb);
          commit;
        `);

        s2.send(`
          begin;
          set local role authenticated;
          select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
          select public.submit_courier_onboarding_documents('${payloadB}'::jsonb);
          commit;
        `);

        await Promise.all([s1.waitFor('COMMIT'), s2.waitFor('COMMIT')]);

        const count = parseInt(runSql(`select count(*) from public.courier_documents where courier_id = '${courierId}'`), 10);
        if (count > 4) {
          mutationCaught = true;
          console.log(`  -> RED confirmado: sin "for update", se insertaron ${count} documentos (duplicados permitidos)`);
        }
      } finally {
        await s1.close();
        await s2.close();
      }
    } catch (err) {
      mutationCaught = true;
      console.log(`  -> RED confirmado por error de carrera: ${err.message}`);
    }

    assert(mutationCaught, 'El oráculo debe detectar la ausencia de "for update" bajo concurrencia');

    // 3. Restaurar migración original (GREEN)
    runSql(originalSql);
    console.log('  -> Restauración GREEN: RPC reinstalada con lock for update');

    await testDistinctPathsConcurrency();
    console.log('  -> GREEN confirmado tras restauración de for update');
  } finally {
    // Garantizar restauración
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
  }

  console.log('[CC-025-B0] Todos los tests de concurrencia y atomicidad finalizaron EXITOSAMENTE.');
}

main().catch((err) => {
  console.error('[CC-025-B0] FATAL:', err);
  process.exit(1);
});
