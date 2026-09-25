import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { consentStatusSchema } from '@/domain/schemas';

describe('CC-007 · Invariante de consentimiento legal obligatorio: análisis estático y mutaciones', () => {
  const migrationPath = path.resolve('supabase/migrations/20260925170000_cc007_consent_enforcement.sql');
  const pgtapTestPath = path.resolve('supabase/tests/cc007_consent_enforcement.sql');

  it('1. Existe la migración de CC-007 y define enum consent_status con los 3 estados', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/create\s+type\s+public\.consent_status\s+as\s+enum\s*\(\s*'pending',\s*'active',\s*'reconsent_required'\s*\);/i);
    expect(sql).toMatch(/alter\s+table\s+public\.profiles\s+add\s+column\s+consent_status\s+public\.consent_status\s+not\s+null\s+default\s+'pending';/i);
  });

  it('2. Backfill determinista: admin es active, merchant/courier solo si existen ambos (tos + privacy)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Admin exento
    expect(sql).toMatch(/when\s+p\.role\s*=\s*'admin'\s+then\s+'active'::public\.consent_status/i);
    // Verificación de ambos consentimientos
    expect(sql).toMatch(/document\s*=\s*'tos'/i);
    expect(sql).toMatch(/document\s*=\s*'privacy'/i);
    expect(sql).toMatch(/else\s+'pending'::public\.consent_status/i);
  });

  it('3. RPC activate_account_consents: SECURITY DEFINER, search_path seguro, revoke a public/anon/authenticated y grant explícito a service_role (H03)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.activate_account_consents/i);
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*public,\s*pg_temp/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.activate_account_consents\(uuid,\s*text,\s*text\)\s+from\s+public,\s*anon,\s*authenticated;/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.activate_account_consents\(uuid,\s*text,\s*text\)\s+to\s+service_role;/i);
  });

  it('4. Atomicidad en activate_account_consents: nunca active sin ambas filas en consents', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Debe contener FOR UPDATE para lock pesimista
    expect(sql).toMatch(/for\s+update/i);
    // Debe rechazar admin
    expect(sql).toMatch(/ADMIN_EXEMPT/);
    // Inserta ambos documentos obligatorios en la misma sentencia
    expect(sql).toMatch(/'tos'::public\.consent_document/);
    expect(sql).toMatch(/'privacy'::public\.consent_document/);
    // Solo actualiza a active tras insertar
    const insertIdx = sql.indexOf("insert into public.consents");
    const updateIdx = sql.indexOf("set consent_status = 'active'::public.consent_status");
    expect(insertIdx).toBeGreaterThan(0);
    expect(updateIdx).toBeGreaterThan(insertIdx);
  });

  it('5. Gate RLS operativo aplicado con app_private.is_active_operational_actor en tablas clave y drop de consents_insert_self (H08)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/app_private\.is_active_operational_actor\(\)/);
    // Aplicado en merchants
    expect(sql).toMatch(/create\s+policy\s+merchants_select_self\s+on\s+public\.merchants[^\;]+app_private\.is_active_operational_actor\(\)/is);
    // Aplicado en couriers
    expect(sql).toMatch(/create\s+policy\s+couriers_select_self\s+on\s+public\.couriers[^\;]+app_private\.is_active_operational_actor\(\)/is);
    // Aplicado en delivery_requests
    expect(sql).toMatch(/create\s+policy\s+delivery_requests_select_merchant\s+on\s+public\.delivery_requests[^\;]+app_private\.is_active_operational_actor\(\)/is);
    // Aplicado en offers
    expect(sql).toMatch(/create\s+policy\s+offers_select_courier\s+on\s+public\.offers[^\;]+app_private\.is_active_operational_actor\(\)/is);
    // consents_insert_self eliminado para impedir fabricación SDK desde el cliente (H08)
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+consents_insert_self\s+on\s+public\.consents;/i);
  });

  it('6. RPCs operativas exigen consent_status active para actores no admin (incluyendo request_cycle H02)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // submit_offer
    expect(sql).toMatch(/submit_offer[\s\S]*?v_role\s*<>\s*'courier'\s*or\s*v_consent_status\s*<>\s*'active'/i);
    // withdraw_offer
    expect(sql).toMatch(/withdraw_offer[\s\S]*?v_consent_status\s*<>\s*'active'/i);
    // set_availability
    expect(sql).toMatch(/set_availability[\s\S]*?v_consent_status\s*<>\s*'active'/i);
    // app_private.request_cycle central (H02)
    expect(sql).toMatch(/request_cycle[\s\S]*?v_role\s*<>\s*'admin'\s*and\s*v_consent_status\s*<>\s*'active'/i);
  });

  it('7. Existe la suite pgTAP con al menos 28 aserciones de invariante (H02, H03, H08)', () => {
    expect(fs.existsSync(pgtapTestPath)).toBe(true);
    const sql = fs.readFileSync(pgtapTestPath, 'utf8');
    expect(sql).toMatch(/select\s+plan\(28\);/);
    expect(sql).toMatch(/activate_account_consents\s+cannot\s+be\s+executed\s+by\s+authenticated\s+role/i);
    expect(sql).toMatch(/pending\s+merchant\s+denied\s+operational\s+access/i);
    expect(sql).toMatch(/authenticated\s+cannot\s+directly\s+insert\s+into\s+public\.consents/i);
    expect(sql).toMatch(/service_role\s+can\s+execute\s+activate_account_consents/i);
  });

  it('8. Schema Zod de dominio consentStatusSchema valida exactamente los 3 estados', () => {
    expect(consentStatusSchema.safeParse('pending').success).toBe(true);
    expect(consentStatusSchema.safeParse('active').success).toBe(true);
    expect(consentStatusSchema.safeParse('reconsent_required').success).toBe(true);
    expect(consentStatusSchema.safeParse('invalido').success).toBe(false);
  });

  describe('9. Demostración de mutaciones rojas reales (H06)', () => {
    function executeMutation(
      filePath: string,
      mutator: (content: string) => string,
      testArgs: string[]
    ) {
      const original = fs.readFileSync(filePath, 'utf8');
      const mutated = mutator(original);
      if (mutated === original) {
        throw new Error(`Target text to mutate was not found in: ${filePath}`);
      }

      try {
        fs.writeFileSync(filePath, mutated, 'utf8');
        const res = spawnSync('pnpm', testArgs, {
          shell: true,
          encoding: 'utf8',
        });
        return res;
      } finally {
        fs.writeFileSync(filePath, original, 'utf8');
      }
    }

    it(
      'mutación A: omitir verificación de consentStatus en guards hace fallar guards.test.ts con exit != 0',
      { timeout: 15000 },
      () => {
        const guardsFile = path.resolve('src/features/auth/guards.ts');
        const res = executeMutation(
          guardsFile,
          (content) =>
            content.replace(
              "session.role !== 'admin' && session.consentStatus !== 'active'",
              "false && session.role !== 'admin'"
            ),
          ['vitest', 'run', 'src/features/auth/guards.test.ts']
        );

        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toMatch(/FAIL|failed/i);
      }
    );

    it(
      'mutación B: ignorar validación de consent_status en getServerSession hace fallar queries.test.ts con exit != 0',
      { timeout: 15000 },
      () => {
        const queriesFile = path.resolve('src/features/auth/queries.ts');
        const res = executeMutation(
          queriesFile,
          (content) =>
            content.replace(
              'const consentParsed = consentStatusSchema.safeParse(profileResult.data.consent_status);',
              "const consentParsed = { success: true, data: 'active' as const };"
            ),
          ['vitest', 'run', 'src/features/auth/queries.test.ts']
        );

        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toMatch(/FAIL|failed/i);
      }
    );

    it(
      'mutación C: hardcodear consentStatus active en loginAction hace fallar actions.test.ts con exit != 0',
      { timeout: 15000 },
      () => {
        const actionsFile = path.resolve('src/features/auth/actions.ts');
        const res = executeMutation(
          actionsFile,
          (content) =>
            content.replace(
              'const consentStatus = consentParsed.data;',
              "const consentStatus = 'active' as const;"
            ),
          ['vitest', 'run', 'src/features/auth/actions.test.ts']
        );

        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toMatch(/FAIL|failed/i);
      }
    );

    it(
      'mutación D: omitir gate app_private.is_active_operational_actor en migración hace fallar aserción estática de RLS',
      { timeout: 15000 },
      () => {
        const res = executeMutation(
          migrationPath,
          (content) =>
            content.replace(
              'using (profile_id = auth.uid() and app_private.is_active_operational_actor());',
              'using (profile_id = auth.uid());'
            ),
          ['vitest', 'run', 'src/server/rpc/cc007.test.ts', '-t', '5. Gate RLS operativo']
        );

        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toMatch(/FAIL|failed/i);
      }
    );
  });
});
