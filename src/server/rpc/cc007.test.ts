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

  it('3. RPC activate_account_consents: SECURITY DEFINER, search_path seguro y REVOKE de execute a authenticated y anon', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.activate_account_consents/i);
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*public,\s*pg_temp/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.activate_account_consents\(uuid,\s*text,\s*text\)\s+from\s+public,\s*anon,\s*authenticated;/i);
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

  it('5. Gate RLS operativo aplicado con app_private.is_active_operational_actor en tablas clave', () => {
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
  });

  it('6. RPCs operativas exigen consent_status active para actores no admin', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // submit_offer
    expect(sql).toMatch(/submit_offer[\s\S]*?v_role\s*<>\s*'courier'\s*or\s*v_consent_status\s*<>\s*'active'/i);
    // withdraw_offer
    expect(sql).toMatch(/withdraw_offer[\s\S]*?v_consent_status\s*<>\s*'active'/i);
    // set_availability
    expect(sql).toMatch(/set_availability[\s\S]*?v_consent_status\s*<>\s*'active'/i);
    // publish_request
    expect(sql).toMatch(/publish_request[\s\S]*?v_consent_status\s*<>\s*'active'/i);
    // accept_offer
    expect(sql).toMatch(/accept_offer[\s\S]*?v_consent_status\s*<>\s*'active'/i);
  });

  it('7. Existe la suite pgTAP con al menos 18 aserciones de invariante', () => {
    expect(fs.existsSync(pgtapTestPath)).toBe(true);
    const sql = fs.readFileSync(pgtapTestPath, 'utf8');
    expect(sql).toMatch(/select\s+plan\(18\);/);
    expect(sql).toMatch(/activate_account_consents\s+cannot\s+be\s+executed\s+by\s+authenticated\s+role/i);
    expect(sql).toMatch(/pending\s+merchant\s+denied\s+operational\s+access/i);
  });

  it('8. Schema Zod de dominio consentStatusSchema valida exactamente los 3 estados', () => {
    expect(consentStatusSchema.safeParse('pending').success).toBe(true);
    expect(consentStatusSchema.safeParse('active').success).toBe(true);
    expect(consentStatusSchema.safeParse('reconsent_required').success).toBe(true);
    expect(consentStatusSchema.safeParse('invalido').success).toBe(false);
  });

  describe('9. Demostración de mutaciones rojas', () => {
    it('mutación A: quitar gate RLS de merchants_select_self hace fallar la aserción de seguridad', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const policyChunk = sql.slice(
        sql.indexOf('create policy merchants_select_self'),
        sql.indexOf('create policy merchants_update_self')
      );
      const mutatedChunk = policyChunk.replace(
        'and app_private.is_active_operational_actor()',
        ''
      );
      expect(policyChunk).toMatch(/using\s*\(.*?app_private\.is_active_operational_actor\(\)\);/s);
      expect(mutatedChunk).not.toMatch(/app_private\.is_active_operational_actor\(\)/i);
    });

    it('mutación B: conceder EXECUTE de activate_account_consents a authenticated hace fallar la aserción de revokes', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const mutatedSql = sql.replace(
        /revoke all on function public\.activate_account_consents\(uuid, text, text\) from public, anon, authenticated;/i,
        'grant execute on function public.activate_account_consents(uuid, text, text) to authenticated;'
      );
      const revokeRegex = /revoke\s+all\s+on\s+function\s+public\.activate_account_consents\(uuid,\s*text,\s*text\)\s+from\s+public,\s*anon,\s*authenticated;/i;
      expect(sql).toMatch(revokeRegex);
      expect(mutatedSql).not.toMatch(revokeRegex);
    });

    it('mutación C: omitir la validación de consent_status en submit_offer falla la aserción de RPC operativa', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const submitOfferSection = sql.slice(
        sql.indexOf('function public.submit_offer'),
        sql.indexOf('function public.withdraw_offer')
      );
      const mutatedSubmitOffer = submitOfferSection.replace(
        /v_role\s*<>\s*'courier'\s*or\s*v_consent_status\s*<>\s*'active'/i,
        "v_role <> 'courier'"
      );
      expect(submitOfferSection).toMatch(/v_role\s*<>\s*'courier'\s*or\s*v_consent_status\s*<>\s*'active'/i);
      expect(mutatedSubmitOffer).not.toMatch(/v_role\s*<>\s*'courier'\s*or\s*v_consent_status\s*<>\s*'active'/i);
    });

    it('mutación D: romper atomicidad permitiendo active sin inserción de consentimientos falla la invariante', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const rpcSection = sql.slice(
        sql.indexOf('function public.activate_account_consents'),
        sql.indexOf('function public.submit_offer')
      );
      const mutatedRpc = rpcSection.replace(
        /insert into public\.consents[^\;]+\;/is,
        '-- OMITTED CONSENTS INSERT'
      );
      expect(rpcSection).toMatch(/'tos'::public\.consent_document/);
      expect(mutatedRpc).not.toMatch(/'tos'::public\.consent_document/);
    });
  });
});
