import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import * as adminRpc from '@/server/rpc/admin';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  suspendCourierAction,
  verifyCourierDocumentAction,
  verifyAdminMfaAction,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

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
}));

describe('Admin Actions (T-122 DoD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validAdminUser = { id: 'admin-uuid-1', email: 'admin@cadeapp.ar' };

  describe('1. Seguridad y MFA: AAL2 obligatorio para toda acción admin', () => {
    it('Server Actions rechazan la operación si el admin no cuenta con claim aal2 (AAL2_REQUIRED)', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: validAdminUser },
            error: null,
          }),
          mfa: {
            getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
              data: { currentLevel: 'aal1' },
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

      const resultDoc = await viewCourierDocumentAction({
        documentId: 'doc-123',
        courierId: 'courier-123',
      });
      expect(resultDoc.ok).toBe(false);
      if (!resultDoc.ok) {
        expect(resultDoc.code).toBe('AAL2_REQUIRED');
      }

      const resultDecide = await decideCourierAction({
        courierId: 'courier-123',
        decision: 'approved',
        reason: 'Documentación completa verificada',
      });
      expect(resultDecide.ok).toBe(false);
      if (!resultDecide.ok) {
        expect(resultDecide.code).toBe('AAL2_REQUIRED');
      }
    });

    it('Server Actions rechazan la operación si el usuario no tiene rol admin (UNAUTHORIZED_ACTOR)', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'courier-1', email: 'courier@test.com' } },
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
                data: { role: 'courier' },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await viewCourierDocumentAction({
        documentId: 'doc-123',
        courierId: 'courier-123',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHORIZED_ACTOR');
      }
    });
  });

  describe('2. Decisiones con motivo obligatorio', () => {
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

      const mockAdminClient = {
        rpc: vi.fn(),
      };
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupabase.createAdminClient>
      );
    }

    it('decideCourierAction rechaza motivo vacío con REASON_REQUIRED', async () => {
      setupAal2Admin();

      const resultEmpty = await decideCourierAction({
        courierId: 'courier-1',
        decision: 'rejected',
        reason: '   ',
      });
      expect(resultEmpty.ok).toBe(false);
      if (!resultEmpty.ok) {
        expect(resultEmpty.code).toBe('REASON_REQUIRED');
      }
    });

    it('decideCourierAction invoca adminDecideCourierRpc cuando el motivo es válido', async () => {
      setupAal2Admin();
      vi.mocked(adminRpc.adminDecideCourierRpc).mockResolvedValue({
        ok: true,
        data: {
          courierId: 'courier-1',
          status: 'approved',
          decidedAt: new Date().toISOString(),
        },
      });

      const result = await decideCourierAction({
        courierId: 'courier-1',
        decision: 'approved',
        reason: 'DNI y selfie coinciden perfectamente',
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminDecideCourierRpc).toHaveBeenCalledWith(expect.anything(), {
        courierId: 'courier-1',
        decision: 'approved',
        reason: 'DNI y selfie coinciden perfectamente',
      });
    });

    it('suspendCourierAction rechaza motivo vacío con REASON_REQUIRED', async () => {
      setupAal2Admin();

      const resultEmpty = await suspendCourierAction({
        courierId: 'courier-1',
        reason: '',
      });
      expect(resultEmpty.ok).toBe(false);
      if (!resultEmpty.ok) {
        expect(resultEmpty.code).toBe('REASON_REQUIRED');
      }
    });

    it('suspendCourierAction invoca adminSuspendCourierRpc cuando el motivo es válido', async () => {
      setupAal2Admin();
      vi.mocked(adminRpc.adminSuspendCourierRpc).mockResolvedValue({
        ok: true,
        data: {
          courierId: 'courier-1',
          status: 'suspended',
          withdrawnOffersCount: 0,
          deactivatedAt: new Date().toISOString(),
        },
      });

      const result = await suspendCourierAction({
        courierId: 'courier-1',
        reason: 'Infracción reiterada de términos',
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminSuspendCourierRpc).toHaveBeenCalledWith(expect.anything(), {
        courierId: 'courier-1',
        reason: 'Infracción reiterada de términos',
      });
    });

    it('verifyCourierDocumentAction con verified=false exige rejectionReason con REASON_REQUIRED', async () => {
      setupAal2Admin();

      const resultNoReason = await verifyCourierDocumentAction({
        documentId: 'doc-1',
        verified: false,
        rejectionReason: '',
      });
      expect(resultNoReason.ok).toBe(false);
      if (!resultNoReason.ok) {
        expect(resultNoReason.code).toBe('REASON_REQUIRED');
      }
    });

    it('verifyCourierDocumentAction con verified=true invoca adminVerifyDocumentRpc sin requerir motivo', async () => {
      setupAal2Admin();
      vi.mocked(adminRpc.adminVerifyDocumentRpc).mockResolvedValue({
        ok: true,
        data: {
          documentId: 'doc-1',
          status: 'verified',
          kind: 'dni_front',
          courierId: 'courier-1',
          docLevel: 1,
        },
      });

      const result = await verifyCourierDocumentAction({
        documentId: 'doc-1',
        verified: true,
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminVerifyDocumentRpc).toHaveBeenCalledWith(expect.anything(), {
        documentId: 'doc-1',
        verified: true,
        rejectionReason: null,
      });
    });
  });

  describe('3. Visor documental: URL firmada de 60s y registro inmutable en audit_log', () => {
    it('viewCourierDocumentAction emite signedUrl de 60s e inserta fila en audit_log', async () => {
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
                        id: 'doc-456',
                        courier_id: 'courier-789',
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
        documentId: 'doc-456',
        courierId: 'courier-789',
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
          target_id: 'doc-456',
        })
      );
    });
  });

  describe('4. Autenticación MFA (verifyAdminMfaAction)', () => {
    it('rechaza código con longitud distinta a 6 dígitos con VALIDATION_ERROR', async () => {
      const resultShort = await verifyAdminMfaAction({ code: '123' });
      expect(resultShort.ok).toBe(false);
      if (!resultShort.ok) {
        expect(resultShort.code).toBe('VALIDATION_ERROR');
      }

      const resultAlpha = await verifyAdminMfaAction({ code: '123abc' });
      expect(resultAlpha.ok).toBe(false);
      if (!resultAlpha.ok) {
        expect(resultAlpha.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
