/**
 * Test de integración del backfill de migración CC-025 en DB efímera (H06).
 *
 * Requisito:
 *   1. Sembrar duplicados antiguos en DB efímera ANTES de aplicar la migración real CC-025
 *      (reseteando a 20261014180000 --no-seed).
 *   2. Aplicar la migración original (pnpm supabase migration up).
 *   3. Verificar:
 *      - Documento antiguo (uploaded_at hace 90 días) queda con is_current = false
 *      - purge_after queda en now() + 30 días (> now() + 29 days), según Decisión B
 *      - Documento reciente queda con is_current = true y purge_after null
 *      - Plazos preexistentes de purge_after se preservan intactos
 *      - El índice único courier_documents_unique_current queda activo y válido
 *   4. Control negativo RED->GREEN (--mutation-check):
 *      Mutar en el archivo de migración original 'now() + interval ''30 days''' por
 *      'cd.uploaded_at + interval ''30 days'''. Repetir el flujo y verificar que la aserción
 *      de purge_after > now() + 29 days FALLA (RED).
 *      Restaurar la migración original y verificar que vuelve a PASS (GREEN).
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-025][H06] ERROR: La variable de entorno DB_CONTAINER no está definida.');
  process.exit(1);
}

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
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
    throw new Error(`[CC-025][H06] SQL error: ${res.stderr || res.stdout}\nQuery: ${sql}`);
  }
  return res.stdout.trim();
}

function runCommand(cmd, args, description) {
  console.log(`[CC-025][H06] ${description}...`);
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`[CC-025][H06] Falló ${description}: ${res.stderr || res.stdout}`);
  }
  return res.stdout.trim();
}

function setupPreMigrationFixture(ids) {
  const { courier1Id, courier2Id, docOldId, docRecentId, docPreservedId, docC2RecentId } = ids;

  runSql(`
    -- Usuarios y perfiles
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${courier1Id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1_${courier1Id}@cc025.test', 'pwd', '{"role":"courier"}'::jsonb),
      ('${courier2Id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2_${courier2Id}@cc025.test', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values
      ('${courier1Id}', 'courier', 'active'),
      ('${courier2Id}', 'courier', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';

    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate, license_status)
    values
      ('${courier1Id}', 'pending', false, 'moto', 'H06C1', 'submitted'),
      ('${courier2Id}', 'pending', false, 'moto', 'H06C2', 'submitted')
    on conflict (profile_id) do nothing;

    -- Asegurar que la columna purge_after existe si queremos simular un plazo preexistente
    alter table public.courier_documents add column if not exists purge_after timestamptz;

    -- Documentos de Courier 1 (duplicados de tipo license, uno subido hace 90 días y otro hace 1 día)
    insert into public.courier_documents (id, courier_id, kind, storage_path, status, uploaded_at, purge_after)
    values
      ('${docOldId}', '${courier1Id}', 'license', 'courier/${courier1Id}/lic_old.jpg', 'submitted', now() - interval '90 days', null),
      ('${docRecentId}', '${courier1Id}', 'license', 'courier/${courier1Id}/lic_new.jpg', 'submitted', now() - interval '1 day', null)
    on conflict (id) do nothing;

    -- Documentos de Courier 2 (duplicados con un plazo preexistente de 5 días para verificar preservación)
    insert into public.courier_documents (id, courier_id, kind, storage_path, status, uploaded_at, purge_after)
    values
      ('${docPreservedId}', '${courier2Id}', 'dni_front', 'courier/${courier2Id}/dni_old.jpg', 'rejected', now() - interval '80 days', now() + interval '5 days'),
      ('${docC2RecentId}', '${courier2Id}', 'dni_front', 'courier/${courier2Id}/dni_new.jpg', 'submitted', now() - interval '2 days', null)
    on conflict (id) do nothing;
  `);
}

function verifyBackfillAssertions(ids) {
  const { courier1Id, courier2Id, docOldId, docRecentId, docPreservedId, docC2RecentId } = ids;

  // 1. Courier 1 - Documento reciente debe ser vigente y sin purge_after
  const recentIsCurrent = runSql(`select is_current from public.courier_documents where id = '${docRecentId}';`);
  assert.equal(recentIsCurrent, 't', 'Documento reciente de Courier 1 debe tener is_current = true');

  const recentPurgeAfterNull = runSql(`select purge_after is null from public.courier_documents where id = '${docRecentId}';`);
  assert.equal(recentPurgeAfterNull, 't', 'Documento reciente de Courier 1 debe tener purge_after IS NULL');

  // 2. Courier 1 - Documento antiguo (90 días) debe tener is_current = false y purge_after > now() + 29 days (Decisión B: 30 días desde migración)
  const oldIsCurrent = runSql(`select is_current from public.courier_documents where id = '${docOldId}';`);
  assert.equal(oldIsCurrent, 'f', 'Documento antiguo (90 días) debe tener is_current = false');

  const isPurgeAfterValid = runSql(`
    select (purge_after > now() + interval '29 days' and purge_after <= now() + interval '31 days')
    from public.courier_documents where id = '${docOldId}';
  `);
  assert.equal(
    isPurgeAfterValid,
    't',
    'Documento antiguo debe tener purge_after > now() + 29 days (fijado a 30 días desde migración, no desde uploaded_at de 90 días atrás)'
  );

  // 3. Courier 2 - Plazo preexistente de purge_after debe preservarse intacto
  const preservedPurgeAfter = runSql(`
    select (purge_after <= now() + interval '6 days' and purge_after >= now() + interval '4 days')
    from public.courier_documents where id = '${docPreservedId}';
  `);
  assert.equal(
    preservedPurgeAfter,
    't',
    'Documento con plazo de purge_after preexistente debe conservar dicho plazo sin ser sobreescrito'
  );

  // 4. Unicidad de versión vigente respetada
  const c1CurrentCount = Number(
    runSql(`select count(*)::int from public.courier_documents where courier_id = '${courier1Id}' and is_current = true;`)
  );
  assert.equal(c1CurrentCount, 1, 'Courier 1 debe tener exactamente 1 documento vigente');

  const c2CurrentCount = Number(
    runSql(`select count(*)::int from public.courier_documents where courier_id = '${courier2Id}' and is_current = true;`)
  );
  assert.equal(c2CurrentCount, 1, 'Courier 2 debe tener exactamente 1 documento vigente');

  // 5. Índice único parcial activo y válido
  const indexValid = runSql(`
    select indisvalid from pg_index
    where indexrelid = 'public.courier_documents_unique_current'::regclass;
  `);
  assert.equal(indexValid, 't', 'Índice courier_documents_unique_current debe estar activo y válido');
}

function resetToPrePhaseC() {
  runSql(`
    drop index if exists public.courier_documents_unique_current;
    drop index if exists public.courier_documents_unique_idempotency;
    alter table public.courier_documents drop constraint if exists courier_documents_rejection_code_check;
    alter table public.courier_documents drop constraint if exists courier_documents_expansion_guard;
    update public.courier_documents
      set is_current = true, rejection_code = null, idempotency_key = null
      where is_current is distinct from true or rejection_code is not null or idempotency_key is not null;
    alter table public.courier_documents
      add constraint courier_documents_expansion_guard
      check (is_current = true and rejection_code is null and idempotency_key is null);
    grant update, delete on table public.courier_documents to authenticated;
    delete from supabase_migrations.schema_migrations where version = '20261016210000';
  `);
}

function cleanupBackfillFixture(ids) {
  const { courier1Id, courier2Id } = ids;
  runSql(`
    delete from public.courier_documents where courier_id in ('${courier1Id}', '${courier2Id}');
    delete from public.couriers where profile_id in ('${courier1Id}', '${courier2Id}');
    delete from public.profiles where id in ('${courier1Id}', '${courier2Id}');
    delete from auth.users where id in ('${courier1Id}', '${courier2Id}');
  `);
}

async function runBackfillTest() {
  console.log('[CC-025][H06] === INICIANDO PRUEBA REAL DE BACKFILL (MIGRACIÓN ORIGINAL) ===');

  const ids = {
    courier1Id: crypto.randomUUID(),
    courier2Id: crypto.randomUUID(),
    docOldId: crypto.randomUUID(),
    docRecentId: crypto.randomUUID(),
    docPreservedId: crypto.randomUUID(),
    docC2RecentId: crypto.randomUUID(),
  };

  try {
    // 1. Posicionar el esquema en el estado exacto previo a la Fase C (20261016033941, con A y B0 aplicadas)
    console.log('[CC-025][H06] Posicionando DB en estado pre-Fase C (20261016033941)...');
    resetToPrePhaseC();

    // 2. Sembrar duplicados previos a la migración de contracción
    console.log('[CC-025][H06] Sembrando fixture pre-migración con documentos duplicados (uploaded_at hace 90 días)...');
    setupPreMigrationFixture(ids);

    // 3. Aplicar la migración CC-025 Fase C real con Supabase CLI
    runCommand(pnpmCmd, ['supabase', 'migration', 'up', '--include-all'], 'Aplicando migración CC-025 Fase C con pnpm supabase migration up');

    // 4. Verificar aserciones
    console.log('[CC-025][H06] Verificando aserciones del backfill...');
    verifyBackfillAssertions(ids);

    console.log('[CC-025][H06] === PRUEBA DE BACKFILL GREEN COMPLETADA EXITOSAMENTE ===');
  } finally {
    cleanupBackfillFixture(ids);
  }
}

async function runBackfillMutationCheck() {
  console.log('[CC-025][H06] === INICIANDO CONTROL NEGATIVO RED->GREEN (MUTACIÓN DE BACKFILL) ===');

  const origMigrationContent = fs.readFileSync(migrationPath, 'utf8');
  const targetPattern = "when ranked.rn > 1 and cd.purge_after is null then now() + interval '30 days'";
  const mutatedPattern = "when ranked.rn > 1 and cd.purge_after is null then cd.uploaded_at + interval '30 days'";

  if (!origMigrationContent.includes(targetPattern)) {
    throw new Error(`[CC-025][H06] No se encontró el patrón objetivo en el archivo de migración:\n${targetPattern}`);
  }

  const mutatedMigrationContent = origMigrationContent.replace(targetPattern, mutatedPattern);

  const ids = {
    courier1Id: crypto.randomUUID(),
    courier2Id: crypto.randomUUID(),
    docOldId: crypto.randomUUID(),
    docRecentId: crypto.randomUUID(),
    docPreservedId: crypto.randomUUID(),
    docC2RecentId: crypto.randomUUID(),
  };

  try {
    console.log('[CC-025][H06] Aplicando mutación a migración original: now() + 30 days -> cd.uploaded_at + 30 days...');
    fs.writeFileSync(migrationPath, mutatedMigrationContent, 'utf8');

    // 1. Posicionar DB en estado pre-Fase C (20261016033941)
    resetToPrePhaseC();

    // 2. Sembrar fixture con doc hace 90 días
    setupPreMigrationFixture(ids);

    // 3. Aplicar migración mutada con Supabase CLI
    runCommand(pnpmCmd, ['supabase', 'migration', 'up', '--include-all'], 'Aplicando migración mutada');

    // 4. Verificar que la aserción de purge_after > now() + 29 days FALLA (RED)
    console.log('[CC-025][H06] Ejecutando aserción de retención sobre migración mutada (debe fallar)...');
    let mutanteSobrevivio = false;
    try {
      verifyBackfillAssertions(ids);
      mutanteSobrevivio = true;
    } catch (err) {
      console.log(`[CC-025][H06] RED CONFIRMADO: El test falló como se esperaba: ${err.message}`);
    }

    if (mutanteSobrevivio) {
      throw new Error('[CC-025][H06] ERROR: El mutante de backfill sobrevivió (dio GREEN indebidamente).');
    }

    console.log('[CC-025][H06] -> RED OBTENIDO EXITOSAMENTE AL MUTAR now()+30 A uploaded_at+30');
  } finally {
    cleanupBackfillFixture(ids);
    console.log('[CC-025][H06] Restaurando archivo de migración original...');
    fs.writeFileSync(migrationPath, origMigrationContent, 'utf8');
  }

  // Verificar restauración completa a GREEN reaplicando la migración original
  console.log('[CC-025][H06] Verificando restauración completa a GREEN...');
  await runBackfillTest();
  console.log('[CC-025][H06] -> GREEN OBTENIDO TRAS RESTAURAR MIGRACIÓN ORIGINAL');
}

async function main() {
  if (process.argv.includes('--mutation-check')) {
    await runBackfillMutationCheck();
  } else {
    await runBackfillTest();
  }
}

main().catch((err) => {
  console.error(`[CC-025][H06] ERROR: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  // Asegurar restauración de la migración si falló en medio
  try {
    const content = fs.readFileSync(migrationPath, 'utf8');
    const mutatedPattern = "when ranked.rn > 1 and cd.purge_after is null then cd.uploaded_at + interval '30 days'";
    const targetPattern = "when ranked.rn > 1 and cd.purge_after is null then now() + interval '30 days'";
    if (content.includes(mutatedPattern)) {
      fs.writeFileSync(migrationPath, content.replace(mutatedPattern, targetPattern), 'utf8');
      console.log('[CC-025][H06] Archivo de migración restaurado en handler de error.');
    }
  } catch {}
  process.exitCode = 1;
});
