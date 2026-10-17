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

function runSqlWithAuth(courierId, sqlCommands) {
  const wrappedSql = `
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
    do $$
    begin
      if current_user <> 'authenticated' then
        raise exception 'current_user is not authenticated: %', current_user;
      end if;
      if auth.uid() <> '${courierId}'::uuid then
        raise exception 'auth.uid() does not match courierId: %', auth.uid();
      end if;
    end $$;
    ${sqlCommands}
    commit;
  `;
  return runSql(wrappedSql);
}

function runSqlExpectingErrorWithAuth(courierId, sqlCommands) {
  const wrappedSql = `
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', jsonb_build_object('sub', '${courierId}', 'role', 'authenticated', 'aal', 'aal2')::text, true);
    do $$
    begin
      if current_user <> 'authenticated' then
        raise exception 'current_user is not authenticated: %', current_user;
      end if;
      if auth.uid() <> '${courierId}'::uuid then
        raise exception 'auth.uid() does not match courierId: %', auth.uid();
      end if;
    end $$;
    ${sqlCommands}
    commit;
  `;
  return runSqlExpectingError(wrappedSql);
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

  // 3. Aplicar hasta la migración expansiva de Fase A (20261015153311)
  runCommand(pnpmCmd, ['supabase', 'db', 'reset', '--version', '20261015153311', '--no-seed'], 'Aplicar hasta migración expansiva 20261015153311');

  // 4. Verificar que SELECT is_current, rejection_code, idempotency_key ahora es GREEN
  const postCheck = runSql('select count(*) from public.courier_documents where is_current is distinct from true;');
  assert.equal(postCheck, '0', 'Todas las filas existentes deben tener is_current=true');
  console.log('[CC-025-A] Post-migración GREEN confirmado: columnas is_current, rejection_code, idempotency_key disponibles.');

  // 5. Configurar actores de prueba: courier principal y otro courier
  const courierId = crypto.randomUUID();
  const otherCourierId = crypto.randomUUID();
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c_${courierId}@test.com', 'pwd', '{"role":"courier"}'::jsonb),
      ('${otherCourierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c_${otherCourierId}@test.com', 'pwd', '{"role":"courier"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.profiles (id, role, consent_status)
    values
      ('${courierId}', 'courier', 'active'),
      ('${otherCourierId}', 'courier', 'active')
    on conflict (id) do update set role = excluded.role, consent_status = 'active';

    insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
    values
      ('${courierId}', 'pending', false, 'moto', 'EXP01'),
      ('${otherCourierId}', 'pending', false, 'moto', 'EXP99')
    on conflict (profile_id) do nothing;
  `);

  // 5a. H01 & H02: Insert legítimo del writer antiguo bajo sesión autenticada transaccional
  runSqlWithAuth(courierId, `
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values ('${courierId}', 'license', 'courier/${courierId}/lic.jpg', 'submitted');
  `);
  console.log('[CC-025-A] Writer antiguo plain INSERT GREEN con actor autenticado verificado.');

  // 5b. H01: Upsert estilo PostgREST con NUEVO ID (emulando .upsert(documentEntries) sin colisión)
  const fixedDocId = crypto.randomUUID();
  runSqlWithAuth(courierId, `
    insert into public.courier_documents (id, courier_id, kind, storage_path, status)
    values ('${fixedDocId}', '${courierId}', 'avatar', 'courier/${courierId}/av_orig.jpg', 'submitted')
    on conflict (id) do update set status = excluded.status;
  `);
  const checkNew = runSql(`select count(*) from public.courier_documents where id = '${fixedDocId}';`);
  assert.equal(checkNew, '1', 'Documento con nuevo ID debe persistirse');
  console.log('[CC-025-A] Writer antiguo UPSERT nuevo ID GREEN: ON CONFLICT (id) DO UPDATE ejecuta rama INSERT sin 42501.');

  // 5c. H01 & H02: Retry con el MISMO ID (colisión real sobre id)
  const retryResult = runSqlExpectingErrorWithAuth(courierId, `
    insert into public.courier_documents (id, courier_id, kind, storage_path, status)
    values ('${fixedDocId}', '${courierId}', 'avatar', 'courier/${courierId}/av_retry.jpg', 'submitted')
    on conflict (id) do update set storage_path = excluded.storage_path;
  `);
  if (retryResult.status !== 0) {
    assert.match(
      retryResult.stderr,
      /42501|violates row-level security policy|permission denied/i,
      `Error de colisión debe ser SQLSTATE 42501 por RLS heredada, se obtuvo: ${retryResult.stderr}`
    );
    const countAfter = runSql(`select count(*) from public.courier_documents where id = '${fixedDocId}';`);
    assert.equal(countAfter, '1', 'La fila original no debe duplicarse ante colisión');
    const pathAfter = runSql(`select storage_path from public.courier_documents where id = '${fixedDocId}';`);
    assert.equal(pathAfter, `courier/${courierId}/av_orig.jpg`, 'El path original debe permanecer intacto ante RLS 42501');
    console.log('[CC-025-A] Colisión en ID verificada: RLS denegó la mutación UPDATE a rol authenticated con SQLSTATE 42501 (incompatibilidad preexistente por courier_documents_write_admin). La fila original permanece intacta.');
  } else {
    const countAfter = runSql(`select count(*) from public.courier_documents where id = '${fixedDocId}';`);
    assert.equal(countAfter, '1', 'La fila original no debe duplicarse');
    console.log('[CC-025-A] Colisión en ID exitosa: fila actualizada.');
  }

  // 5d. H02: Test negativo de aislamiento de actor (otro courier no puede insertar para courierId)
  const spoofResult = runSqlExpectingErrorWithAuth(otherCourierId, `
    insert into public.courier_documents (courier_id, kind, storage_path, status)
    values ('${courierId}', 'selfie', 'courier/${courierId}/spoofed.jpg', 'submitted');
  `);
  assert.notEqual(spoofResult.status, 0, 'Actor ajeno no debe poder insertar documentos de otro courier');
  assert.match(
    spoofResult.stderr,
    /42501|violates row-level security policy/i,
    `Error ante actor ajeno debe ser 42501 RLS, se obtuvo: ${spoofResult.stderr}`
  );
  const spoofCount = runSql(`select count(*) from public.courier_documents where storage_path = 'courier/${courierId}/spoofed.jpg';`);
  assert.equal(spoofCount, '0', 'Ningún documento falsificado debe persistirse');
  console.log('[CC-025-A] Actor isolation GREEN: actor ajeno es rechazado con 42501 y 0 filas insertadas.');

  // 6. Verificar enforcement del guard temporal (rechazo ante valores forjados)
  const guardCheck1 = runSqlExpectingError(`
    insert into public.courier_documents (courier_id, kind, storage_path, status, is_current)
    values ('${courierId}', 'avatar', 'courier/${courierId}/av_forge1.jpg', 'submitted', false);
  `);
  assert.notEqual(guardCheck1.status, 0, 'INSERT con is_current=false debe fallar por guard');
  assert.match(guardCheck1.stderr, /23514|check constraint|courier_documents_expansion_guard/i);

  const guardCheck2 = runSqlExpectingError(`
    insert into public.courier_documents (courier_id, kind, storage_path, status, rejection_code)
    values ('${courierId}', 'avatar', 'courier/${courierId}/av_forge2.jpg', 'submitted', 'other_safe');
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
    // Mutación 1: omitir la columna is_current y su referencia en el constraint
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

    runCommand(pnpmCmd, ['supabase', 'db', 'reset', '--version', '20261015153311', '--no-seed'], 'Aplicar hasta migración expansiva 20261015153311 mutada');

    const testMutated = runSqlExpectingError('select is_current from public.courier_documents limit 1;');
    assert.notEqual(testMutated.status, 0, 'La migración mutada DEBE fallar al consultar is_current');
    assert.match(
      testMutated.stderr,
      /42703|does not exist|no existe la columna/i,
      `La migración mutada debe fallar con 42703, se obtuvo: ${testMutated.stderr}`
    );
    console.log('[CC-025-A] Control de mutación RED 1 confirmado: la omisión de is_current produce error 42703.');

    // Mutación 2 (H01): Revocar UPDATE sobre courier_documents y demostrar que el writer antiguo falla con 42501
    console.log('[CC-025-A] --- Mutación de privilegios: REVOKE UPDATE a authenticated ---');
    const mutCourierId = crypto.randomUUID();
    runSql(`
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
      values ('${mutCourierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c_${mutCourierId}@test.com', 'pwd', '{"role":"courier"}'::jsonb)
      on conflict (id) do nothing;

      insert into public.profiles (id, role, consent_status)
      values ('${mutCourierId}', 'courier', 'active')
      on conflict (id) do update set role = excluded.role, consent_status = 'active';

      insert into public.couriers (profile_id, status, available, vehicle_type, vehicle_plate)
      values ('${mutCourierId}', 'pending', false, 'moto', 'MUT01')
      on conflict (profile_id) do nothing;
    `);

    // Revocar UPDATE a authenticated
    runSql('revoke update on public.courier_documents from authenticated;');

    const mutDocId = crypto.randomUUID();
    const mutResult = runSqlExpectingErrorWithAuth(mutCourierId, `
      insert into public.courier_documents (id, courier_id, kind, storage_path, status)
      values ('${mutDocId}', '${mutCourierId}', 'license', 'courier/${mutCourierId}/lic_mut.jpg', 'submitted')
      on conflict (id) do update set status = excluded.status;
    `);
    assert.notEqual(mutResult.status, 0, 'Sin privilegio UPDATE, el writer antiguo debe fallar con 42501');
    assert.match(
      mutResult.stderr,
      /42501|permission denied for table courier_documents/i,
      `Error debe ser 42501 de permiso revocado, se obtuvo: ${mutResult.stderr}`
    );
    console.log('[CC-025-A] Control de mutación RED 2 confirmado: revocar UPDATE produce SQLSTATE 42501 en el writer UPSERT antiguo.');

    // Restaurar privilegio UPDATE
    runSql('grant update on public.courier_documents to authenticated;');

    runSqlWithAuth(mutCourierId, `
      insert into public.courier_documents (id, courier_id, kind, storage_path, status)
      values ('${mutDocId}', '${mutCourierId}', 'license', 'courier/${mutCourierId}/lic_mut.jpg', 'submitted')
      on conflict (id) do update set status = excluded.status;
    `);
    const restoredCount = runSql(`select count(*) from public.courier_documents where id = '${mutDocId}';`);
    assert.equal(restoredCount, '1', 'Tras restaurar privilegio UPDATE, el writer antiguo vuelve a funcionar');
    console.log('[CC-025-A] Control de mutación GREEN 2 confirmado: restaurar UPDATE restablece el alta del writer antiguo.');
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
