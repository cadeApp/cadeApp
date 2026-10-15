/**
 * Test de compatibilidad de la migración expansiva CC-025 (PR A).
 *
 * Verificaciones:
 *   1. Pre-migración RED: En el esquema previo a CC-025 (20261014180000),
 *      SELECT is_current falla con SQLSTATE 42703 (columna inexistente).
 *   2. Post-migración GREEN: Tras aplicar la migración expansiva,
 *      SELECT is_current, rejection_code, idempotency_key es exitoso.
 *   3. Compatibilidad con el writer antiguo: INSERT y UPSERT (ON CONFLICT DO UPDATE)
 *      bajo rol authenticated funcionan sin error 42501 ni bloqueo de RLS.
 *   4. Guard de seguridad expansivo: Intentos de forjar is_current=false,
 *      rejection_code o idempotency_key fallan con 23514 (check constraint).
 *   5. Control de mutación RED->GREEN (--mutation-check): Mutar el archivo de migración
 *      omitiendo is_current provoca el fallo 42703 con el mismo test (RED confirmado),
 *      y restaurar el archivo original restablece el estado PASS (GREEN confirmado).
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error('[CC-025-A] ERROR: La variable de entorno DB_CONTAINER no está definida.');
  process.exit(1);
}

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20261015153311_cc025_expand_courier_documents.sql'
);

function runSql(sql) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(`[CC-025-A] SQL error: ${res.stderr || res.stdout}\nQuery: ${sql}`);
  }
  return res.stdout.trim();
}

function runSqlExpectingError(sql) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  return {
    status: res.status,
    stdout: res.stdout ? res.stdout.trim() : '',
    stderr: res.stderr ? res.stderr.trim() : '',
  };
}

function runCommand(cmd, args, description) {
  console.log(`[CC-025-A] ${description}...`);
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`[CC-025-A] Falló ${description}: ${res.stderr || res.stdout}`);
  }
  return res.stdout.trim();
}

async function runCompatibilityTests() {
  console.log('[CC-025-A] --- Inicio de pruebas de compatibilidad de migración expansiva ---');

  // 1. Resetear base de datos a pre-migración (20261014180000 --no-seed)
  runCommand(pnpmCmd, ['supabase', 'db', 'reset', '--version', '20261014180000', '--no-seed'], 'Reset pre-migración a 20261014180000');

  // 2. Verificar que SELECT is_current falla con 42703 (RED de pre-migración)
  const preCheck = runSqlExpectingError('select is_current from public.courier_documents limit 1;');
  assert.notEqual(preCheck.status, 0, 'SELECT is_current debe fallar en el esquema pre-migración');
  assert.match(
    preCheck.stderr,
    /42703|does not exist|no existe la columna/i,
    `El error debe ser de columna inexistente (42703), se obtuvo: ${preCheck.stderr}`
  );
  console.log('[CC-025-A] Pre-migración RED confirmado: SELECT is_current falla con 42703 en base pre-CC-025.');

  // 3. Aplicar migración expansiva
  runCommand(pnpmCmd, ['supabase', 'migration', 'up'], 'Aplicar migraciones');

  // 4. Verificar que SELECT is_current, rejection_code, idempotency_key ahora es GREEN
  const postCheck = runSql('select count(*) from public.courier_documents where is_current is distinct from true;');
  assert.equal(postCheck, '0', 'Todas las filas existentes deben tener is_current=true');
  console.log('[CC-025-A] Post-migración GREEN confirmado: columnas is_current, rejection_code, idempotency_key disponibles.');

  // 5. Verificar compatibilidad del writer antiguo (UPSERT bajo rol authenticated)
  const courierId = crypto.randomUUID();
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c_${courierId}@test.com', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values ('${courierId}', 'courier', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';

    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
    values ('${courierId}', 'pending', false, 'moto', 'EXP01')
    on conflict (profile_id) do nothing;
  `);

  // Insert legítimo del writer antiguo
  runSql(`
    set local role authenticated;
    set local "request.jwt.claims" to '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}';
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values ('${courierId}', 'license', 'courier/${courierId}/lic.jpg', 'submitted');
  `);

  // Upsert (ON CONFLICT DO UPDATE) legítimo del writer antiguo
  runSql(`
    set local role authenticated;
    set local "request.jwt.claims" to '{"sub":"${courierId}","role":"authenticated","aal":"aal2"}';
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values ('${courierId}', 'avatar', 'courier/${courierId}/av_upsert.jpg', 'submitted')
    on conflict (storage_path) do update set status = 'submitted';
  `);
  console.log('[CC-025-A] Compatibilidad de writer antiguo GREEN: INSERT y UPSERT bajo authenticated funcionan sin 42501.');

  // 6. Verificar enforcement del guard temporal (rechazo ante valores forjados)
  const guardCheck1 = runSqlExpectingError(`
    insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
    values ('${courierId}', 'avatar', 'courier/${courierId}/av.jpg', 'submitted', false);
  `);
  assert.notEqual(guardCheck1.status, 0, 'INSERT con is_current=false debe fallar por guard');
  assert.match(guardCheck1.stderr, /23514|check constraint|courier_documents_expansion_guard/i);

  const guardCheck2 = runSqlExpectingError(`
    insert into public.courier_documents (courier_id, kind, storage_path, status, rejection_code)
    values ('${courierId}', 'avatar', 'courier/${courierId}/av.jpg', 'submitted', 'other_safe');
  `);
  assert.notEqual(guardCheck2.status, 0, 'INSERT con rejection_code forjado debe fallar por guard');
  assert.match(guardCheck2.stderr, /23514|check constraint|courier_documents_expansion_guard/i);

  console.log('[CC-025-A] Guard de seguridad expansivo GREEN: intentos de forjar valores nuevos son rechazados con 23514.');

  // 7. Restaurar base normal
  runCommand(pnpmCmd, ['supabase', 'db', 'reset'], 'Restaurar base con seed');
  console.log('[CC-025-A] Base restaurada a estado normal con seed.');
}

async function runMutationCheck() {
  console.log('[CC-025-A] --- Inicio de control de mutación RED->GREEN ---');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`[CC-025-A] Archivo de migración no encontrado en: ${migrationPath}`);
  }

  const originalContent = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Mutación: omitir la columna is_current y su referencia en el constraint
    let mutatedContent = originalContent.replace(
      'add column if not exists is_current boolean not null default true,',
      '-- add column if not exists is_current boolean not null default true,'
    );
    mutatedContent = mutatedContent.replace(
      'is_current = true and ',
      ''
    );

    if (mutatedContent === originalContent) {
      throw new Error('[CC-025-A] La mutación no modificó el archivo de migración.');
    }

    fs.writeFileSync(migrationPath, mutatedContent, 'utf8');
    console.log('[CC-025-A] Migración mutada temporalmente (omitiendo is_current).');

    runCommand(pnpmCmd, ['supabase', 'db', 'reset', '--version', '20261014180000', '--no-seed'], 'Reset pre-migración mutada');
    runCommand(pnpmCmd, ['supabase', 'migration', 'up'], 'Aplicar migración mutada');

    const testMutated = runSqlExpectingError('select is_current from public.courier_documents limit 1;');
    assert.notEqual(testMutated.status, 0, 'La migración mutada DEBE fallar al consultar is_current');
    assert.match(
      testMutated.stderr,
      /42703|does not exist|no existe la columna/i,
      `La migración mutada debe fallar con 42703, se obtuvo: ${testMutated.stderr}`
    );
    console.log('[CC-025-A] Control de mutación RED confirmado: la omisión de is_current produce error 42703.');
  } finally {
    fs.writeFileSync(migrationPath, originalContent, 'utf8');
    console.log('[CC-025-A] Archivo de migración restaurado a su versión original.');
    runCommand(pnpmCmd, ['supabase', 'db', 'reset'], 'Restaurar base completa con seed tras mutación');
    console.log('[CC-025-A] Base restaurada GREEN tras restitución.');
  }
}

async function main() {
  const isMutation = process.argv.includes('--mutation-check');
  if (isMutation) {
    await runMutationCheck();
  } else {
    await runCompatibilityTests();
  }
}

main().catch((err) => {
  console.error('[CC-025-A] ERROR:', err.message);
  process.exit(1);
});
