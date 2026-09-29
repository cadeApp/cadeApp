import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RPC_CONTRACTS } from '@/domain/rpc-contracts';
import { createFakeRpcClient } from '@/domain/testing/rpc-fake';
import {
  adminDecideCourierRpc,
  adminListIncidentsRpc,
  adminResolveIncidentRpc,
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

  describe('CC-012 · admin_resolve_incident y admin_list_incidents', () => {
    const INCIDENT_ID = 'e0000000-0000-4000-8000-000000000a01';
    const COURIER_A = '00000000-0000-4000-8000-0000000000c5';

    it('9. adminResolveIncidentRpc valida con Zod, envía solo incidentId/decision/reason y parsea la salida', async () => {
      const calls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
      const caller: SupabaseRpcCaller = {
        async rpc(fn, args) {
          calls.push({ fn, args });
          return {
            data: {
              incidentId: INCIDENT_ID,
              status: 'resolved',
              decision: 'preventive_suspension',
              courierId: COURIER_A,
              withdrawnOffersCount: 2,
            },
            error: null,
          };
        },
      };

      for (const bad of [
        { incidentId: 'x', decision: 'warning', reason: 'Motivo' },
        { incidentId: INCIDENT_ID, decision: 'ban_forever', reason: 'Motivo' },
        { incidentId: INCIDENT_ID, decision: 'warning', reason: '   ' },
        { incidentId: INCIDENT_ID, decision: 'warning', reason: 'x'.repeat(501) },
      ]) {
        expect(await adminResolveIncidentRpc(caller, bad)).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      }
      expect(calls).toHaveLength(0);

      const res = await adminResolveIncidentRpc(caller, {
        incidentId: INCIDENT_ID,
        decision: 'preventive_suspension',
        reason: '  Reclamo grave  ',
        courierId: '00000000-0000-4000-8000-0000000000c6',
      });
      expect(res).toEqual({
        ok: true,
        data: {
          incidentId: INCIDENT_ID,
          status: 'resolved',
          decision: 'preventive_suspension',
          courierId: COURIER_A,
          withdrawnOffersCount: 2,
        },
      });
      // D06-A: aunque el caller intente mandar un courierId, nunca viaja a la RPC.
      expect(calls).toEqual([
        {
          fn: 'admin_resolve_incident',
          args: { p_incident_id: INCIDENT_ID, p_decision: 'preventive_suspension', p_reason: 'Reclamo grave' },
        },
      ]);
    });

    it('10. adminResolveIncidentRpc mapea errores de la RPC y rechaza salidas mal formadas', async () => {
      const failing: SupabaseRpcCaller = {
        async rpc() {
          return { data: null, error: { message: 'INVALID_STATE_TRANSITION' } };
        },
      };
      expect(
        await adminResolveIncidentRpc(failing, { incidentId: INCIDENT_ID, decision: 'warning', reason: 'Motivo' })
      ).toEqual({ ok: false, code: 'INVALID_STATE_TRANSITION' });

      const malformed: SupabaseRpcCaller = {
        async rpc() {
          return { data: { incidentId: INCIDENT_ID, status: 'open' }, error: null };
        },
      };
      expect(
        await adminResolveIncidentRpc(malformed, { incidentId: INCIDENT_ID, decision: 'warning', reason: 'Motivo' })
      ).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    });

    it('11. adminListIncidentsRpc envía el cursor compuesto y funciona contra el fake', async () => {
      const calls: Array<Record<string, unknown> | undefined> = [];
      const fake = createFakeRpcClient({
        settings: DEFAULT_SETTINGS,
        initialActor: { userId: ADMIN_ID, role: 'admin', aal: 'aal2' },
        initialIncidents: [
          {
            incidentId: INCIDENT_ID,
            requestId: '00000000-0000-4000-8000-0000000000e3',
            reporterId: MERCHANT_ID,
            reporterRole: 'merchant',
            reporterName: 'Comercio',
            kind: 'other',
            description: 'Demora',
            createdAt: '2026-09-27T12:00:00.000Z',
          },
        ],
      });
      const caller: SupabaseRpcCaller = {
        async rpc(fn, args) {
          calls.push(args);
          if (fn !== 'admin_list_incidents') return { data: null, error: { message: 'UNEXPECTED' } };
          const res = await fake.admin_list_incidents({
            statuses: args?.p_statuses as ['open'],
            cursor:
              args?.p_cursor_created_at && args?.p_cursor_id
                ? { createdAt: args.p_cursor_created_at as string, id: args.p_cursor_id as string }
                : null,
            limit: (args?.p_limit as number | null) ?? undefined,
          });
          return res.ok ? { data: res.data, error: null } : { data: null, error: { message: res.code } };
        },
      };

      const first = await adminListIncidentsRpc(caller, { statuses: ['open', 'reviewing'] });
      expect(first.ok && first.data.items.map((item) => item.id)).toEqual([INCIDENT_ID]);
      expect(calls[0]).toEqual({
        p_statuses: ['open', 'reviewing'],
        p_cursor_created_at: null,
        p_cursor_id: null,
        p_limit: null,
      });

      await adminListIncidentsRpc(caller, {
        statuses: ['open'],
        cursor: { createdAt: '2026-09-27T12:00:00.123456Z', id: INCIDENT_ID },
        limit: 10,
      });
      expect(calls[1]).toEqual({
        p_statuses: ['open'],
        p_cursor_created_at: '2026-09-27T12:00:00.123456Z',
        p_cursor_id: INCIDENT_ID,
        p_limit: 10,
      });

      expect(await adminListIncidentsRpc(caller, { statuses: ['closed'] })).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
      expect(calls).toHaveLength(2);
    });

    it('12. los códigos que levanta la SQL de CC-012 coinciden con RPC_CONTRACTS en los dos sentidos', () => {
      const cc012 = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/migrations/20260927120000_cc012_incidents_contract.sql'),
        'utf8',
      );
      const preamble = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/migrations/20260924013700_rpc_admin_v1.sql'),
        'utf8',
      );
      const bodyOf = (text: string, fn: string): string => {
        const body = text.split(/create or replace function /i).find((b) => b.startsWith(fn + '('));
        if (!body) throw new Error(`sin objetivo: no encontré ${fn}`);
        return body;
      };
      const codesOf = (body: string) => new Set([...body.matchAll(/message = '([A-Z0-9_]+)'/g)].map((m) => m[1] ?? ''));
      const raised = (fn: string, text: string = cc012): Set<string> => {
        const body = bodyOf(text, fn);
        const codes = codesOf(body);
        if (/perform app_private\.assert_admin_aal2\(\)/.test(body)) {
          for (const c of codesOf(bodyOf(preamble, 'app_private.assert_admin_aal2'))) codes.add(c);
        }
        return codes;
      };
      // Códigos que no levanta la función en sí: Zod en el wrapper o la infraestructura (settings).
      const extra = {
        admin_resolve_incident: [],
        admin_list_incidents: [],
        report_incident: ['INTERNAL_ERROR'],
      } as const;
      const check = (name: keyof typeof extra, text: string = cc012) => {
        const got = raised(`public.${name}`, text);
        for (const c of extra[name]) got.add(c);
        const declared = new Set<string>(RPC_CONTRACTS[name].errorCodes);
        return {
          missing: [...declared].filter((c) => !got.has(c)),
          undeclared: [...got].filter((c) => !declared.has(c)),
        };
      };

      for (const name of ['admin_resolve_incident', 'admin_list_incidents', 'report_incident'] as const) {
        expect({ name, ...check(name) }).toEqual({ name, missing: [], undeclared: [] });
      }

      // D06-A: la firma pública no recibe courierId.
      expect(bodyOf(cc012, 'public.admin_resolve_incident')).toMatch(
        /^public\.admin_resolve_incident\(\s*p_incident_id uuid,\s*p_decision text,\s*p_reason text\s*\)/,
      );

      // El control detecta una regresión en una copia en memoria.
      const withoutPreamble = cc012.replace(
        /(create or replace function public\.admin_resolve_incident[\s\S]*?)perform app_private\.assert_admin_aal2\(\);/i,
        '$1',
      );
      expect(withoutPreamble).not.toBe(cc012);
      expect(check('admin_resolve_incident', withoutPreamble).missing).toEqual(
        expect.arrayContaining(['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'AAL2_REQUIRED']),
      );
    });
  });

  describe('T-206: Purga de push_subscriptions en suspensión y deshabilitación administrativa', () => {
    it('adminSuspendCourierRpc purga las suscripciones del repartidor suspendido tras el éxito de la RPC', async () => {
      const adminSupabase = await import('@/server/supabase/admin');
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      let rpcExecuted = false;
      let purgedPostCommit = false;
      const caller: SupabaseRpcCaller = {
        async rpc(fn, args) {
          if (fn === 'admin_suspend_courier') {
            rpcExecuted = true;
            return {
              data: {
                courierId: args?.p_courier_id as string,
                status: 'suspended',
                withdrawnOffersCount: 2,
                deactivatedAt: '2026-09-28T03:00:00.000Z',
              },
              error: null,
            };
          }
          return { data: null, error: { message: 'UNEXPECTED' } };
        },
      };

      mockDeleteEq.mockImplementationOnce(async () => {
        purgedPostCommit = rpcExecuted;
        return { error: null };
      });

      const result = await adminSuspendCourierRpc(caller, {
        courierId: COURIER_1_ID,
        reason: 'Incumplimiento de términos',
      });

      expect(result.ok).toBe(true);
      expect(purgedPostCommit).toBe(true);
      expect(mockAdminFrom).toHaveBeenCalledWith('push_subscriptions');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith('user_id', COURIER_1_ID);
    });

    it('adminSuspendCourierRpc NO purga suscripciones si la RPC falla', async () => {
      const adminSupabase = await import('@/server/supabase/admin');
      const mockDelete = vi.fn();
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const caller: SupabaseRpcCaller = {
        async rpc() {
          return { data: null, error: { message: 'AAL2_REQUIRED' } };
        },
      };

      const result = await adminSuspendCourierRpc(caller, {
        courierId: COURIER_1_ID,
        reason: 'Incumplimiento',
      });

      expect(result.ok).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('adminResolveIncidentRpc purga suscripciones si la decisión es preventive_suspension con repartidor', async () => {
      const adminSupabase = await import('@/server/supabase/admin');
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      let rpcExecuted = false;
      let purgedPostCommit = false;
      const caller: SupabaseRpcCaller = {
        async rpc(fn) {
          if (fn === 'admin_resolve_incident') {
            rpcExecuted = true;
            return {
              data: {
                incidentId: '00000000-0000-4000-8000-0000000000e1',
                status: 'resolved',
                decision: 'preventive_suspension',
                courierId: COURIER_1_ID,
                withdrawnOffersCount: 1,
              },
              error: null,
            };
          }
          return { data: null, error: { message: 'UNEXPECTED' } };
        },
      };

      mockDeleteEq.mockImplementationOnce(async () => {
        purgedPostCommit = rpcExecuted;
        return { error: null };
      });

      const result = await adminResolveIncidentRpc(caller, {
        incidentId: '00000000-0000-4000-8000-0000000000e1',
        decision: 'preventive_suspension',
        reason: 'Agresión física reportada',
      });

      expect(result.ok).toBe(true);
      expect(purgedPostCommit).toBe(true);
      expect(mockAdminFrom).toHaveBeenCalledWith('push_subscriptions');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith('user_id', COURIER_1_ID);
    });

    it('adminResolveIncidentRpc NO purga suscripciones si la decisión es no_action o warning', async () => {
      const adminSupabase = await import('@/server/supabase/admin');
      const mockDelete = vi.fn();
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const caller: SupabaseRpcCaller = {
        async rpc(fn) {
          if (fn === 'admin_resolve_incident') {
            return {
              data: {
                incidentId: '00000000-0000-4000-8000-0000000000e1',
                status: 'resolved',
                decision: 'warning',
                courierId: COURIER_1_ID,
                withdrawnOffersCount: 0,
              },
              error: null,
            };
          }
          return { data: null, error: { message: 'UNEXPECTED' } };
        },
      };

      const result = await adminResolveIncidentRpc(caller, {
        incidentId: '00000000-0000-4000-8000-0000000000e1',
        decision: 'warning',
        reason: 'Llegada tarde sin aviso',
      });

      expect(result.ok).toBe(true);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('adminDecideCourierRpc purga suscripciones si la decisión es rejected', async () => {
      const adminSupabase = await import('@/server/supabase/admin');
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      let rpcExecuted = false;
      let purgedPostCommit = false;
      const caller: SupabaseRpcCaller = {
        async rpc(fn, args) {
          if (fn === 'admin_decide_courier') {
            rpcExecuted = true;
            return {
              data: {
                courierId: args?.p_courier_id as string,
                status: 'rejected',
                decidedAt: '2026-09-28T03:00:00.000Z',
              },
              error: null,
            };
          }
          return { data: null, error: { message: 'UNEXPECTED' } };
        },
      };

      mockDeleteEq.mockImplementationOnce(async () => {
        purgedPostCommit = rpcExecuted;
        return { error: null };
      });

      const result = await adminDecideCourierRpc(caller, {
        courierId: COURIER_1_ID,
        decision: 'rejected',
        reason: 'Documentación apócrifa',
      });

      expect(result.ok).toBe(true);
      expect(purgedPostCommit).toBe(true);
      expect(mockAdminFrom).toHaveBeenCalledWith('push_subscriptions');
      expect(mockDeleteEq).toHaveBeenCalledWith('user_id', COURIER_1_ID);
    });

    it('adminDecideCourierRpc NO purga suscripciones si la decisión es approved', async () => {
      const adminSupabase = await import('@/server/supabase/admin');
      const mockDelete = vi.fn();
      const mockAdminFrom = vi.fn().mockReturnValue({ delete: mockDelete });

      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockAdminFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const caller: SupabaseRpcCaller = {
        async rpc(fn, args) {
          if (fn === 'admin_decide_courier') {
            return {
              data: {
                courierId: args?.p_courier_id as string,
                status: 'approved',
                decidedAt: '2026-09-28T03:00:00.000Z',
              },
              error: null,
            };
          }
          return { data: null, error: { message: 'UNEXPECTED' } };
        },
      };

      const result = await adminDecideCourierRpc(caller, {
        courierId: COURIER_1_ID,
        decision: 'approved',
      });

      expect(result.ok).toBe(true);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});

