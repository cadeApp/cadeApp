import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revalidatePath } from 'next/cache';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import * as adminRpc from '@/server/rpc/admin';
import {
  decideCourierAction,
  suspendCourierAction,
  verifyCourierDocumentAction,
  viewCourierDocumentAction,
  verifyAdminMfaAction,
  setMerchantSubscriptionAction,
  updatePlatformSettingAction,
} from './actions';
import { sanitizeAdminRedirect } from './redirect';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/server/rpc/admin', () => ({
  adminDecideCourierRpc: vi.fn(),
  adminSuspendCourierRpc: vi.fn(),
  adminVerifyDocumentRpc: vi.fn(),
  adminSetSubscriptionRpc: vi.fn(),
  adminUpdateSettingRpc: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const VALID_COURIER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_DOC_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

describe('Admin Actions (T-122 DoD & PR106-H13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validAdminUser = { id: 'admin-123', email: 'admin@cadeapp.com' };

  describe('1. Verificación de claims AAL2 y permisos de administrador', () => {
    it('rechaza con UNAUTHENTICATED si no hay sesión activa', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await decideCourierAction({
        courierId: VALID_COURIER_ID,
        decision: 'approved',
        reason: 'Documentación válida',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHENTICATED');
      }
    });

    it('rechaza con UNAUTHORIZED_ACTOR si el usuario no tiene rol admin', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-merchant', email: 'merchant@test.com' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'merchant' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await decideCourierAction({
        courierId: VALID_COURIER_ID,
        decision: 'approved',
        reason: 'Documentación válida',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHORIZED_ACTOR');
      }
    });

    it('rechaza con AAL2_REQUIRED si el admin tiene solo nivel AAL1', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validAdminUser },
            error: null,
          }),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: 'aal1', nextLevel: 'aal2' },
              error: null,
            }),
          },
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await decideCourierAction({
        courierId: VALID_COURIER_ID,
        decision: 'approved',
        reason: 'Documentación válida',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('AAL2_REQUIRED');
      }
    });
  });

  describe('2. Validación estricta con Zod en todas las Server Actions (PR106-H13)', () => {
    function setupAal2Admin() {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validAdminUser },
            error: null,
          }),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: 'aal2' },
              error: null,
            }),
          },
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );
      vi.mocked(adminSupabase.createAdminClient).mockClear();
      return mockSupabase;
    }

    it('decideCourierAction rechaza courierId con UUID inválido con VALIDATION_ERROR antes de autenticar', async () => {
      const result = await decideCourierAction({
        courierId: 'courier-no-uuid',
        decision: 'approved',
        reason: 'Documentos correctos',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
      expect(serverSupabase.createClient).not.toHaveBeenCalled();
    });

    it('decideCourierAction rechaza motivo vacío o con solo espacios con VALIDATION_ERROR', async () => {
      const resultEmpty = await decideCourierAction({
        courierId: VALID_COURIER_ID,
        decision: 'rejected',
        reason: '   ',
      });
      expect(resultEmpty.ok).toBe(false);
      if (!resultEmpty.ok) {
        expect(resultEmpty.code).toBe('VALIDATION_ERROR');
      }
    });

    it('decideCourierAction invoca adminDecideCourierRpc con cliente de sesión autenticada (PR106-H04)', async () => {
      const mockSupabase = setupAal2Admin();
      vi.mocked(adminRpc.adminDecideCourierRpc).mockResolvedValue({
        ok: true,
        data: {
          courierId: VALID_COURIER_ID,
          status: 'approved',
          decidedAt: new Date().toISOString(),
        },
      });

      const result = await decideCourierAction({
        courierId: VALID_COURIER_ID,
        decision: 'approved',
        reason: 'DNI y selfie coinciden perfectamente',
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminDecideCourierRpc).toHaveBeenCalledWith(mockSupabase, {
        courierId: VALID_COURIER_ID,
        decision: 'approved',
        reason: 'DNI y selfie coinciden perfectamente',
      });
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('suspendCourierAction rechaza courierId no UUID con VALIDATION_ERROR', async () => {
      const result = await suspendCourierAction({
        courierId: 'invalido',
        reason: 'Infracción',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });

    it('suspendCourierAction rechaza motivo vacío con VALIDATION_ERROR', async () => {
      const resultEmpty = await suspendCourierAction({
        courierId: VALID_COURIER_ID,
        reason: '',
      });
      expect(resultEmpty.ok).toBe(false);
      if (!resultEmpty.ok) {
        expect(resultEmpty.code).toBe('VALIDATION_ERROR');
      }
    });

    it('suspendCourierAction invoca adminSuspendCourierRpc con cliente de sesión autenticada (PR106-H04)', async () => {
      const mockSupabase = setupAal2Admin();
      vi.mocked(adminRpc.adminSuspendCourierRpc).mockResolvedValue({
        ok: true,
        data: {
          courierId: VALID_COURIER_ID,
          status: 'suspended',
          withdrawnOffersCount: 0,
          deactivatedAt: new Date().toISOString(),
        },
      });

      const result = await suspendCourierAction({
        courierId: VALID_COURIER_ID,
        reason: 'Infracción reiterada de términos',
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminSuspendCourierRpc).toHaveBeenCalledWith(mockSupabase, {
        courierId: VALID_COURIER_ID,
        reason: 'Infracción reiterada de términos',
      });
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('verifyCourierDocumentAction rechaza documentId no UUID con VALIDATION_ERROR', async () => {
      const result = await verifyCourierDocumentAction({
        documentId: 'doc-no-uuid',
        verified: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });

    it('verifyCourierDocumentAction con verified=false exige rejectionReason con VALIDATION_ERROR', async () => {
      const resultNoReason = await verifyCourierDocumentAction({
        documentId: VALID_DOC_ID,
        verified: false,
        rejectionReason: '',
      });
      expect(resultNoReason.ok).toBe(false);
      if (!resultNoReason.ok) {
        expect(resultNoReason.code).toBe('VALIDATION_ERROR');
      }

      const resultUndefinedReason = await verifyCourierDocumentAction({
        documentId: VALID_DOC_ID,
        verified: false,
      });
      expect(resultUndefinedReason.ok).toBe(false);
      if (!resultUndefinedReason.ok) {
        expect(resultUndefinedReason.code).toBe('VALIDATION_ERROR');
      }
    });

    it('verifyCourierDocumentAction con verified=true invoca adminVerifyDocumentRpc con decision="verified" y cliente de sesión (PR106-H04, PR106-H05)', async () => {
      const mockSupabase = setupAal2Admin();
      vi.mocked(adminRpc.adminVerifyDocumentRpc).mockResolvedValue({
        ok: true,
        data: {
          documentId: VALID_DOC_ID,
          status: 'verified',
          kind: 'dni_front',
          courierId: VALID_COURIER_ID,
          docLevel: 1,
        },
      });

      const result = await verifyCourierDocumentAction({
        documentId: VALID_DOC_ID,
        verified: true,
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminVerifyDocumentRpc).toHaveBeenCalledWith(mockSupabase, {
        documentId: VALID_DOC_ID,
        decision: 'verified',
        reason: null,
      });
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('verifyCourierDocumentAction con verified=false invoca adminVerifyDocumentRpc con decision="rejected" y reason (PR106-H04, PR106-H05)', async () => {
      const mockSupabase = setupAal2Admin();
      vi.mocked(adminRpc.adminVerifyDocumentRpc).mockResolvedValue({
        ok: true,
        data: {
          documentId: VALID_DOC_ID,
          status: 'rejected',
          kind: 'dni_front',
          courierId: VALID_COURIER_ID,
          docLevel: 0,
        },
      });

      const result = await verifyCourierDocumentAction({
        documentId: VALID_DOC_ID,
        verified: false,
        rejectionReason: 'Documento borroso e ilegible',
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminVerifyDocumentRpc).toHaveBeenCalledWith(mockSupabase, {
        documentId: VALID_DOC_ID,
        decision: 'rejected',
        reason: 'Documento borroso e ilegible',
      });
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('viewCourierDocumentAction rechaza documentId o courierId no UUID con VALIDATION_ERROR', async () => {
      const resultBadDoc = await viewCourierDocumentAction({
        documentId: 'no-uuid',
        courierId: VALID_COURIER_ID,
      });
      expect(resultBadDoc.ok).toBe(false);
      if (!resultBadDoc.ok) {
        expect(resultBadDoc.code).toBe('VALIDATION_ERROR');
      }

      const resultBadCourier = await viewCourierDocumentAction({
        documentId: VALID_DOC_ID,
        courierId: 'no-uuid',
      });
      expect(resultBadCourier.ok).toBe(false);
      if (!resultBadCourier.ok) {
        expect(resultBadCourier.code).toBe('VALIDATION_ERROR');
      }
    });

    it('viewCourierDocumentAction emite signedUrl de 60s e inserta fila en audit_log con UUID válidos', async () => {
      setupAal2Admin();

      const mockInsertAudit = vi.fn().mockResolvedValue({ error: null });
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://supabase.local/storage/v1/object/sign/courier-docs/doc-456?token=abc' },
        error: null,
      });

      const mockAdminSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'courier_documents') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: VALID_DOC_ID,
                        courier_id: VALID_COURIER_ID,
                        kind: 'dni_front',
                        storage_path: 'courier-789/dni_front.webp',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'audit_log') {
            return { insert: mockInsertAudit };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: mockCreateSignedUrl,
          }),
        },
      };
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
        mockAdminSupabase as unknown as ReturnType<typeof adminSupabase.createAdminClient>
      );

      const result = await viewCourierDocumentAction({
        documentId: VALID_DOC_ID,
        courierId: VALID_COURIER_ID,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.expiresInSeconds).toBe(60);
        expect(result.data.signedUrl).toContain('https://');
      }
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('courier-789/dni_front.webp', 60);
      expect(mockInsertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'view_courier_document',
          target_type: 'courier_document',
          target_id: VALID_DOC_ID,
        })
      );
    });
  });

  describe('3. Autenticación MFA con Zod adminMfaSchema (verifyAdminMfaAction)', () => {
    it('rechaza código con longitud distinta a 6 dígitos (5 o 7) o alfanumérico con VALIDATION_ERROR', async () => {
      const result5 = await verifyAdminMfaAction({ code: '12345' });
      expect(result5.ok).toBe(false);
      if (!result5.ok) expect(result5.code).toBe('VALIDATION_ERROR');

      const result7 = await verifyAdminMfaAction({ code: '1234567' });
      expect(result7.ok).toBe(false);
      if (!result7.ok) expect(result7.code).toBe('VALIDATION_ERROR');

      const resultAlpha = await verifyAdminMfaAction({ code: '12345a' });
      expect(resultAlpha.ok).toBe(false);
      if (!resultAlpha.ok) expect(resultAlpha.code).toBe('VALIDATION_ERROR');
    });

    it('verifica MFA exitosamente y sanea redirectTo hostil hacia /admin/applicants (PR106-H03)', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validAdminUser },
            error: null,
          }),
          mfa: {
            listFactors: vi.fn().mockResolvedValue({
              data: { totp: [{ id: 'factor-1' }] },
              error: null,
            }),
            challenge: vi.fn().mockResolvedValue({
              data: { id: 'challenge-1' },
              error: null,
            }),
            verify: vi.fn().mockResolvedValue({
              data: {},
              error: null,
            }),
          },
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await verifyAdminMfaAction({
        code: '123456',
        redirectTo: 'javascript:alert(1)',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.redirectTo).toBe('/admin/applicants');
        expect(result.data.redirectTo).not.toContain('javascript:');
      }
    });
  });

  describe('4. Sanitización de redirectTo (PR106-H03)', () => {
    it('permite rutas relativas de administración seguras', () => {
      expect(sanitizeAdminRedirect('/admin/applicants')).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect('/admin/applicants/123')).toBe('/admin/applicants/123');
      expect(sanitizeAdminRedirect('/admin/couriers')).toBe('/admin/couriers');
    });

    it('neutraliza esquemas externos, open redirects y rutas no admin redirigiendo a /admin/applicants', () => {
      expect(sanitizeAdminRedirect('https://evil.com')).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect('//evil.com/admin')).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect('javascript:alert(1)')).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect('/merchant/dashboard')).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect('/courier/feed')).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect(undefined)).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect('')).toBe('/admin/applicants');
    });
  });
});

// T-123: A03/A04
const MERCHANT_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const ADMIN_USER = { id: 'admin-123', email: 'admin@cadeapp.com' };

type ServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;

function mockSession(options: {
  user?: typeof ADMIN_USER | null;
  role?: string;
  aal?: 'aal1' | 'aal2';
}) {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.role ? { role: options.role } : null,
          error: null,
        }),
      }),
    }),
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === undefined ? ADMIN_USER : options.user },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: options.aal ?? 'aal2', nextLevel: 'aal2' },
          error: null,
        }),
      },
    },
    from,
    rpc: vi.fn(),
  };
  vi.mocked(serverSupabase.createClient).mockResolvedValue(client as unknown as ServerClient);
  return client;
}

function tablesTouched(client: ReturnType<typeof mockSession>): string[] {
  return client.from.mock.calls.map((call: unknown[]) => String(call[0]));
}

describe('T-123: setMerchantSubscriptionAction (A03, pago manual y paid_until)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    merchantId: MERCHANT_ID,
    subscriptionStatus: 'active' as const,
    paidUntil: '2026-10-31',
    notes: 'Pagó en efectivo',
  };

  it('rechaza payload inválido con VALIDATION_ERROR sin llamar a la RPC', async () => {
    mockSession({ role: 'admin' });
    const result = await setMerchantSubscriptionAction({
      ...validInput,
      merchantId: 'no-es-uuid',
    });
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(adminRpc.adminSetSubscriptionRpc).not.toHaveBeenCalled();
  });

  it('rechaza paid_until con formato inválido', async () => {
    mockSession({ role: 'admin' });
    const result = await setMerchantSubscriptionAction({ ...validInput, paidUntil: '31/10/2026' });
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(adminRpc.adminSetSubscriptionRpc).not.toHaveBeenCalled();
  });

  it('sin sesión devuelve UNAUTHENTICATED y no llama a la RPC', async () => {
    mockSession({ user: null });
    const result = await setMerchantSubscriptionAction(validInput);
    expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    expect(adminRpc.adminSetSubscriptionRpc).not.toHaveBeenCalled();
  });

  it('un comercio no puede cambiar planes (UNAUTHORIZED_ACTOR)', async () => {
    mockSession({ role: 'merchant' });
    const result = await setMerchantSubscriptionAction(validInput);
    expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    expect(adminRpc.adminSetSubscriptionRpc).not.toHaveBeenCalled();
  });

  it('un admin con aal1 recibe AAL2_REQUIRED y no llama a la RPC', async () => {
    mockSession({ role: 'admin', aal: 'aal1' });
    const result = await setMerchantSubscriptionAction(validInput);
    expect(result).toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    expect(adminRpc.adminSetSubscriptionRpc).not.toHaveBeenCalled();
  });

  it('con aal2 invoca admin_set_subscription con el cliente de sesión y nunca con service role', async () => {
    const client = mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminSetSubscriptionRpc).mockResolvedValue({
      ok: true,
      data: { merchantId: MERCHANT_ID, subscriptionStatus: 'active', paidUntil: '2026-10-31' },
    });

    const result = await setMerchantSubscriptionAction(validInput);

    expect(result).toEqual({
      ok: true,
      data: { merchantId: MERCHANT_ID, subscriptionStatus: 'active', paidUntil: '2026-10-31' },
    });
    expect(adminRpc.adminSetSubscriptionRpc).toHaveBeenCalledTimes(1);
    expect(adminRpc.adminSetSubscriptionRpc).toHaveBeenCalledWith(client, validInput);
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('la mutación queda auditada por la RPC: la action no escribe merchants ni audit_log directo', async () => {
    const client = mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminSetSubscriptionRpc).mockResolvedValue({
      ok: true,
      data: { merchantId: MERCHANT_ID, subscriptionStatus: 'pilot', paidUntil: null },
    });

    await setMerchantSubscriptionAction({ merchantId: MERCHANT_ID, subscriptionStatus: 'pilot' });

    expect(tablesTouched(client)).not.toContain('merchants');
    expect(tablesTouched(client)).not.toContain('audit_log');
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('revalida A03 y A06 tras el cambio', async () => {
    mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminSetSubscriptionRpc).mockResolvedValue({
      ok: true,
      data: { merchantId: MERCHANT_ID, subscriptionStatus: 'active', paidUntil: '2026-10-31' },
    });

    await setMerchantSubscriptionAction(validInput);

    expect(revalidatePath).toHaveBeenCalledWith('/admin/merchants');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/audit');
  });

  it.each(['AAL2_REQUIRED', 'NOT_FOUND', 'UNAUTHORIZED_ACTOR', 'VALIDATION_ERROR'] as const)(
    'propaga el código %s de la RPC sin revalidar',
    async (code) => {
      mockSession({ role: 'admin' });
      vi.mocked(adminRpc.adminSetSubscriptionRpc).mockResolvedValue({ ok: false, code });

      const result = await setMerchantSubscriptionAction(validInput);

      expect(result).toEqual({ ok: false, code });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );

  it('un error no contemplado de la RPC se devuelve como INTERNAL_ERROR', async () => {
    mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminSetSubscriptionRpc).mockResolvedValue({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
    const result = await setMerchantSubscriptionAction(validInput);
    expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });
});

describe('T-123: updatePlatformSettingAction (A04, admin_update_setting con aal2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('un admin con aal1 recibe AAL2_REQUIRED y no llama a admin_update_setting', async () => {
    mockSession({ role: 'admin', aal: 'aal1' });
    const result = await updatePlatformSettingAction({ key: 'min_offer_ars', value: 1500 });
    expect(result).toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    expect(adminRpc.adminUpdateSettingRpc).not.toHaveBeenCalled();
  });

  it('un repartidor no puede cambiar parámetros', async () => {
    mockSession({ role: 'courier' });
    const result = await updatePlatformSettingAction({ key: 'pilot_active', value: false });
    expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    expect(adminRpc.adminUpdateSettingRpc).not.toHaveBeenCalled();
  });

  it.each([
    { key: 'min_offer_ars', value: 0 },
    { key: 'min_offer_ars', value: 1500.5 },
    { key: 'request_ttl_minutes', value: 0 },
    { key: 'subscription_grace_days', value: -1 },
    { key: 'pilot_terms_version', value: '   ' },
    { key: 'pilot_active', value: 'true' },
  ])('rechaza $key=$value con INVALID_SETTING_VALUE sin llamar a la RPC', async (input) => {
    mockSession({ role: 'admin' });
    const result = await updatePlatformSettingAction(
      input as unknown as Parameters<typeof updatePlatformSettingAction>[0]
    );
    expect(result).toEqual({ ok: false, code: 'INVALID_SETTING_VALUE' });
    expect(adminRpc.adminUpdateSettingRpc).not.toHaveBeenCalled();
  });

  it('rechaza una clave desconocida con INVALID_SETTING_KEY', async () => {
    mockSession({ role: 'admin' });
    const result = await updatePlatformSettingAction({
      key: 'max_offer_ars',
      value: 5000,
    } as unknown as Parameters<typeof updatePlatformSettingAction>[0]);
    expect(result).toEqual({ ok: false, code: 'INVALID_SETTING_KEY' });
    expect(adminRpc.adminUpdateSettingRpc).not.toHaveBeenCalled();
  });

  it.each([
    { key: 'min_offer_ars', value: 1500 },
    { key: 'request_ttl_minutes', value: 45 },
    { key: 'pilot_active', value: false },
    { key: 'pilot_terms_version', value: '1.1' },
    { key: 'subscription_grace_days', value: 3 },
  ] as const)(
    'con aal2 invoca admin_update_setting para $key con el cliente de sesión',
    async (input) => {
      const client = mockSession({ role: 'admin' });
      vi.mocked(adminRpc.adminUpdateSettingRpc).mockResolvedValue({ ok: true, data: input });

      const result = await updatePlatformSettingAction(input);

      expect(result).toEqual({ ok: true, data: input });
      expect(adminRpc.adminUpdateSettingRpc).toHaveBeenCalledWith(client, input);
      expect(tablesTouched(client)).not.toContain('platform_settings');
      expect(tablesTouched(client)).not.toContain('audit_log');
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    }
  );

  it('revalida A04 y A06 tras guardar', async () => {
    mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminUpdateSettingRpc).mockResolvedValue({
      ok: true,
      data: { key: 'min_offer_ars', value: 1500 },
    });

    await updatePlatformSettingAction({ key: 'min_offer_ars', value: 1500 });

    expect(revalidatePath).toHaveBeenCalledWith('/admin/settings');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/audit');
  });

  it.each(['AAL2_REQUIRED', 'INVALID_SETTING_VALUE', 'INVALID_SETTING_KEY', 'UNAUTHORIZED_ACTOR'] as const)(
    'propaga el código %s de la RPC sin revalidar',
    async (code) => {
      mockSession({ role: 'admin' });
      vi.mocked(adminRpc.adminUpdateSettingRpc).mockResolvedValue({ ok: false, code });

      const result = await updatePlatformSettingAction({ key: 'request_ttl_minutes', value: 30 });

      expect(result).toEqual({ ok: false, code });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );
});
