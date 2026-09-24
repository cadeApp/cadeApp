import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RPC_CONTRACTS } from '@/domain/rpc-contracts';
import { createFakeRpcClient } from '@/domain/testing/rpc-fake';
import {
  adminDecideCourierRpc,
  adminSetSubscriptionRpc,
  adminSuspendCourierRpc,
  adminUpdateSettingRpc,
  adminVerifyDocumentRpc,
  mapAdminRpcError,
  type SupabaseRpcCaller,
} from '@/server/rpc/admin';

const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const MERCHANT_ID = '00000000-0000-4000-8000-0000000000b1';
const COURIER_1_ID = '00000000-0000-4000-8000-0000000000c1';
const DOC_1_ID = '00000000-0000-4000-8000-0000000000d1';

const ADMIN_RPC_NAMES = [
  'admin_decide_courier',
  'admin_suspend_courier',
  'admin_verify_document',
  'admin_set_subscription',
  'admin_update_setting',
] as const;
type AdminRpcName = (typeof ADMIN_RPC_NAMES)[number];

const DEFAULT_SETTINGS = {
  minOfferArs: 1000,
  maxOffersPerMin: 10,
  maxRequestPublicationsPerMin: 10,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 30,
  pilotActive: true,
  pilotTermsVersion: 'v1',
  subscriptionGraceDays: 0,
};

describe('T-105 · Wrappers Server RPC y Pruebas de Contrato para Admin', () => {
  it('1. mapAdminRpcError mapea mensajes conocidos e infraestructurales', () => {
    expect(
      mapAdminRpcError('admin_decide_courier', { message: 'UNAUTHENTICATED' }),
    ).toBe('UNAUTHENTICATED');
    expect(
      mapAdminRpcError('admin_decide_courier', { message: 'AAL2_REQUIRED' }),
    ).toBe('AAL2_REQUIRED');
    expect(
      mapAdminRpcError('admin_decide_courier', { code: '42501', message: 'permission denied' }),
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(
      mapAdminRpcError('admin_decide_courier', { message: 'some database crash' }),
    ).toBe('INTERNAL_ERROR');
  });

  it('2. adminDecideCourierRpc valida inputs y procesa respuesta del servidor / fake', async () => {
    const fake = createFakeRpcClient({
      settings: DEFAULT_SETTINGS,
      initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
      initialCouriers: [
        { courierId: COURIER_1_ID, status: 'pending', available: false },
      ],
    });

    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        if (fn === 'admin_decide_courier') {
          const res = await fake.admin_decide_courier({
            courierId: args?.p_courier_id as string,
            decision: args?.p_decision as 'approved' | 'rejected',
            reason: (args?.p_reason as string | null) ?? undefined,
          });
          if (!res.ok) {
            return { data: null, error: { message: res.code } };
          }
          return { data: res.data, error: null };
        }
        return { data: null, error: { message: 'UNEXPECTED' } };
      },
    };

    // Validation error when decision is invalid
    const invalidRes = await adminDecideCourierRpc(caller, {
      courierId: COURIER_1_ID,
      decision: 'invalid_decision',
    });
    expect(invalidRes.ok).toBe(false);
    if (!invalidRes.ok) {
      expect(invalidRes.code).toBe('VALIDATION_ERROR');
    }

    // Happy path approve
    const okRes = await adminDecideCourierRpc(caller, {
      courierId: COURIER_1_ID,
      decision: 'approved',
    });
    expect(okRes.ok).toBe(true);
    if (!okRes.ok) return;
    expect(okRes.data.courierId).toBe(COURIER_1_ID);
    expect(okRes.data.status).toBe('approved');
  });

  it('3. adminSuspendCourierRpc suspende y devuelve withdrawnOffersCount', async () => {
    const fake = createFakeRpcClient({
      settings: DEFAULT_SETTINGS,
      initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
      initialCouriers: [
        { courierId: COURIER_1_ID, status: 'approved', available: true },
      ],
    });

    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        if (fn === 'admin_suspend_courier') {
          const res = await fake.admin_suspend_courier({
            courierId: args?.p_courier_id as string,
            reason: args?.p_reason as string,
          });
          if (!res.ok) {
            return { data: null, error: { message: res.code } };
          }
          return { data: res.data, error: null };
        }
        return { data: null, error: { message: 'UNEXPECTED' } };
      },
    };

    // Reason required check
    const emptyReasonRes = await adminSuspendCourierRpc(caller, {
      courierId: COURIER_1_ID,
      reason: '',
    });
    expect(emptyReasonRes.ok).toBe(false);

    // Happy path suspend
    const okRes = await adminSuspendCourierRpc(caller, {
      courierId: COURIER_1_ID,
      reason: 'Infracción grave a los términos',
    });
    expect(okRes.ok).toBe(true);
    if (!okRes.ok) return;
    expect(okRes.data.courierId).toBe(COURIER_1_ID);
    expect(okRes.data.status).toBe('suspended');
    expect(typeof okRes.data.withdrawnOffersCount).toBe('number');
  });

  it('4. adminVerifyDocumentRpc verifica documentos y devuelve docLevel', async () => {
    const fake = createFakeRpcClient({
      settings: DEFAULT_SETTINGS,
      initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
      initialCouriers: [
        { courierId: COURIER_1_ID, status: 'pending', available: false },
      ],
      initialDocuments: [
        {
          documentId: DOC_1_ID,
          courierId: COURIER_1_ID,
          kind: 'license',
          status: 'submitted',
        },
      ],
    });

    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        if (fn === 'admin_verify_document') {
          const res = await fake.admin_verify_document({
            documentId: args?.p_document_id as string,
            decision: args?.p_decision as 'verified' | 'rejected',
            reason: (args?.p_reason as string | null) ?? undefined,
          });
          if (!res.ok) {
            return { data: null, error: { message: res.code } };
          }
          return { data: res.data, error: null };
        }
        return { data: null, error: { message: 'UNEXPECTED' } };
      },
    };

    const okRes = await adminVerifyDocumentRpc(caller, {
      documentId: DOC_1_ID,
      decision: 'verified',
    });
    expect(okRes.ok).toBe(true);
    if (!okRes.ok) return;
    expect(okRes.data.documentId).toBe(DOC_1_ID);
    expect(okRes.data.status).toBe('verified');
    expect(okRes.data.docLevel).toBeGreaterThanOrEqual(1);
  });

  it('5. adminSetSubscriptionRpc actualiza la suscripción del comercio', async () => {
    const fake = createFakeRpcClient({
      settings: DEFAULT_SETTINGS,
      initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
      initialMerchants: [
        { merchantId: MERCHANT_ID, subscriptionStatus: 'pilot' },
      ],
    });

    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        if (fn === 'admin_set_subscription') {
          const res = await fake.admin_set_subscription({
            merchantId: args?.p_merchant_id as string,
            subscriptionStatus: args?.p_subscription_status as 'pilot' | 'active' | 'expired' | 'cancelled',
            paidUntil: (args?.p_paid_until as string | null) ?? undefined,
            notes: (args?.p_notes as string | null) ?? undefined,
          });
          if (!res.ok) {
            return { data: null, error: { message: res.code } };
          }
          return { data: res.data, error: null };
        }
        return { data: null, error: { message: 'UNEXPECTED' } };
      },
    };

    const okRes = await adminSetSubscriptionRpc(caller, {
      merchantId: MERCHANT_ID,
      subscriptionStatus: 'active',
      paidUntil: '2026-12-31',
    });
    expect(okRes.ok).toBe(true);
    if (!okRes.ok) return;
    expect(okRes.data.merchantId).toBe(MERCHANT_ID);
    expect(okRes.data.subscriptionStatus).toBe('active');
    expect(okRes.data.paidUntil).toBe('2026-12-31');
  });

  it('6. adminUpdateSettingRpc maneja H06 (p_value directo) y H09 (distinción KEY vs VALUE error)', async () => {
    let capturedArgValue: unknown = null;

    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        if (fn === 'admin_update_setting') {
          capturedArgValue = args?.p_value;
          return {
            data: {
              key: args?.p_key,
              value: args?.p_value,
            },
            error: null,
          };
        }
        return { data: null, error: { message: 'UNEXPECTED' } };
      },
    };

    // H09: Clave inexistente devuelve INVALID_SETTING_KEY
    const invalidKeyRes = await adminUpdateSettingRpc(caller, {
      key: 'clave_inexistente',
      value: 123,
    });
    expect(invalidKeyRes.ok).toBe(false);
    if (!invalidKeyRes.ok) {
      expect(invalidKeyRes.code).toBe('INVALID_SETTING_KEY');
    }

    // H09: Clave válida con valor inválido devuelve INVALID_SETTING_VALUE
    const invalidValRes = await adminUpdateSettingRpc(caller, {
      key: 'min_offer_ars',
      value: -100,
    });
    expect(invalidValRes.ok).toBe(false);
    if (!invalidValRes.ok) {
      expect(invalidValRes.code).toBe('INVALID_SETTING_VALUE');
    }

    // H06: Camino feliz - p_value se envía directamente como number/boolean/string sin stringify
    const okRes = await adminUpdateSettingRpc(caller, {
      key: 'min_offer_ars',
      value: 1500,
    });
    expect(okRes.ok).toBe(true);
    expect(capturedArgValue).toBe(1500);
  });

  it('7. H15: los códigos que levanta cada RPC en SQL coinciden con RPC_CONTRACTS, por función y en los dos sentidos', () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260924013700_rpc_admin_v1.sql'),
      'utf8',
    );
    // Códigos que pone el wrapper (Zod en la frontera), no el SQL.
    const wrapperOnly: Record<AdminRpcName, readonly string[]> = {
      admin_decide_courier: [],
      admin_suspend_courier: ['VALIDATION_ERROR'],
      admin_verify_document: [],
      admin_set_subscription: [],
      admin_update_setting: ['VALIDATION_ERROR'],
    };
    const raisedBy = (text: string, fn: string): Set<string> => {
      const blocks = text.split(/create or replace function /i);
      const body = blocks.find((b) => b.startsWith(fn + '('));
      if (!body) throw new Error(`sin objetivo: no encontré ${fn} en la migración`);
      const codes = new Set([...body.matchAll(/message = '([A-Z0-9_]+)'/g)].map((m) => m[1] ?? ''));
      if (/perform app_private\.assert_admin_aal2\(\)/.test(body)) {
        for (const c of raisedBy(text, 'app_private.assert_admin_aal2')) codes.add(c);
      }
      return codes;
    };
    const check = (text: string) =>
      ADMIN_RPC_NAMES.map((name) => {
        const raised = raisedBy(text, `public.${name}`);
        for (const c of wrapperOnly[name]) raised.add(c);
        const declared = new Set<string>(RPC_CONTRACTS[name].errorCodes);
        return {
          name,
          missing: [...declared].filter((c) => !raised.has(c)),
          undeclared: [...raised].filter((c) => !declared.has(c)),
        };
      });

    for (const r of check(sql)) {
      expect({ name: r.name, missing: r.missing, undeclared: r.undeclared }).toEqual({
        name: r.name,
        missing: [],
        undeclared: [],
      });
    }

    // AG-63: el control detecta una regresión en una copia en memoria.
    const withoutStateCheck = sql.replace(
      /(create or replace function public\.admin_verify_document[\s\S]*?)message = 'INVALID_STATE_TRANSITION'/i,
      "$1message = 'SOMETHING_ELSE'",
    );
    expect(withoutStateCheck).not.toBe(sql);
    const verify = check(withoutStateCheck).find((r) => r.name === 'admin_verify_document');
    expect(verify?.missing).toContain('INVALID_STATE_TRANSITION');
    expect(verify?.undeclared).toContain('SOMETHING_ELSE');

    const withoutPreamble = sql.replace(
      /(create or replace function public\.admin_suspend_courier[\s\S]*?)perform app_private\.assert_admin_aal2\(\);/i,
      '$1',
    );
    expect(withoutPreamble).not.toBe(sql);
    const suspend = check(withoutPreamble).find((r) => r.name === 'admin_suspend_courier');
    expect(suspend?.missing).toEqual(
      expect.arrayContaining(['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'AAL2_REQUIRED']),
    );
  });

  it('8. H08 / D05: Pruebas de contrato y coincidencia de bordes entre fake y RPC (D03, D04 y NOT_FOUND)', async () => {
    const fake = createFakeRpcClient({
      settings: DEFAULT_SETTINGS,
      initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
      initialCouriers: [
        { courierId: COURIER_1_ID, status: 'approved', available: true },
        { courierId: '00000000-0000-4000-8000-0000000000c2', status: 'suspended', available: false },
      ],
      initialDocuments: [
        {
          documentId: DOC_1_ID,
          courierId: COURIER_1_ID,
          kind: 'license',
          status: 'verified',
        },
      ],
    });

    // 1. decide approved -> rejected da INVALID_STATE_TRANSITION (D03)
    const res1 = await fake.admin_decide_courier({
      courierId: COURIER_1_ID,
      decision: 'rejected',
      reason: 'Motivo de rechazo',
    });
    expect(res1.ok).toBe(false);
    if (!res1.ok) expect(res1.code).toBe('INVALID_STATE_TRANSITION');

    // 2. decide suspended -> approved da INVALID_STATE_TRANSITION (D03)
    const res2 = await fake.admin_decide_courier({
      courierId: '00000000-0000-4000-8000-0000000000c2',
      decision: 'approved',
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) expect(res2.code).toBe('INVALID_STATE_TRANSITION');

    // 3. suspender a un suspendido da INVALID_STATE_TRANSITION (H19)
    const res3 = await fake.admin_suspend_courier({
      courierId: '00000000-0000-4000-8000-0000000000c2',
      reason: 'Re-suspensión cautelar',
    });
    expect(res3.ok).toBe(false);
    if (!res3.ok) expect(res3.code).toBe('INVALID_STATE_TRANSITION');

    // 4. verify de un documento verified da INVALID_STATE_TRANSITION (D04)
    const res4 = await fake.admin_verify_document({
      documentId: DOC_1_ID,
      decision: 'rejected',
      reason: 'Nuevo intento',
    });
    expect(res4.ok).toBe(false);
    if (!res4.ok) expect(res4.code).toBe('INVALID_STATE_TRANSITION');

    // 5. decide(inexistente, rejected, sin motivo) da REASON_REQUIRED (valida motivo antes de buscar en DB)
    const res5 = await fake.admin_decide_courier({
      courierId: '00000000-0000-4000-8000-999999999999',
      decision: 'rejected',
    });
    expect(res5.ok).toBe(false);
    if (!res5.ok) expect(res5.code).toBe('REASON_REQUIRED');
  });
});
