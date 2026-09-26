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
import { sanitizeAdminRedirect } from './redirect';

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
      vi.mocked(adminSupabase.createAdminClient).mockClear();
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
        mockAdminClient as unknown as ReturnType<typeof adminSupabase.createAdminClient>
      );

      return mockSupabase;
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

    it('decideCourierAction invoca adminDecideCourierRpc con cliente de sesión autenticada (PR106-H04)', async () => {
      const mockSupabase = setupAal2Admin();
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
      expect(adminRpc.adminDecideCourierRpc).toHaveBeenCalledWith(mockSupabase, {
        courierId: 'courier-1',
        decision: 'approved',
        reason: 'DNI y selfie coinciden perfectamente',
      });
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
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

    it('suspendCourierAction invoca adminSuspendCourierRpc con cliente de sesión autenticada (PR106-H04)', async () => {
      const mockSupabase = setupAal2Admin();
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
      expect(adminRpc.adminSuspendCourierRpc).toHaveBeenCalledWith(mockSupabase, {
        courierId: 'courier-1',
        reason: 'Infracción reiterada de términos',
      });
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
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

    it('verifyCourierDocumentAction con verified=true invoca adminVerifyDocumentRpc con decision="verified" y cliente de sesión (PR106-H04, PR106-H05)', async () => {
      const mockSupabase = setupAal2Admin();
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
      expect(adminRpc.adminVerifyDocumentRpc).toHaveBeenCalledWith(mockSupabase, {
        documentId: 'doc-1',
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
          documentId: 'doc-1',
          status: 'rejected',
          kind: 'dni_front',
          courierId: 'courier-1',
          docLevel: 0,
        },
      });

      const result = await verifyCourierDocumentAction({
        documentId: 'doc-1',
        verified: false,
        rejectionReason: 'Documento borroso e ilegible',
      });

      expect(result.ok).toBe(true);
      expect(adminRpc.adminVerifyDocumentRpc).toHaveBeenCalledWith(mockSupabase, {
        documentId: 'doc-1',
        decision: 'rejected',
        reason: 'Documento borroso e ilegible',
      });
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
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

  describe('5. Sanitización de redirectTo (PR106-H03)', () => {
    it('PR106-H03: sanitizeAdminRedirect rechaza destinos inseguros y previene Open Redirect / XSS', () => {
      const hostileTargets = [
        'javascript:alert(1)',
        'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>',
        'https://evil.com',
        'http://evil.com/admin',
        '//evil.com',
        '///evil.com',
        '/\\evil.com',
        '\\evil.com',
        '/admin\r\nevil',
        '/admin\nevil',
        '/courier/feed',
        '/merchant/dashboard',
        '',
        null,
        undefined,
      ];

      for (const target of hostileTargets) {
        const safe = sanitizeAdminRedirect(target as unknown as string);
        expect(safe, `El destino "${target}" debe ser neutralizado a /admin/applicants`).toBe('/admin/applicants');
        expect(safe).not.toContain('javascript:');
        expect(safe).not.toContain('evil.com');
      }
    });

    it('PR106-H03: sanitizeAdminRedirect permite destinos válidos dentro de /admin', () => {
      expect(sanitizeAdminRedirect('/admin/applicants')).toBe('/admin/applicants');
      expect(sanitizeAdminRedirect('/admin/applicants/courier-123')).toBe('/admin/applicants/courier-123');
      expect(sanitizeAdminRedirect('/admin/couriers')).toBe('/admin/couriers');
      expect(sanitizeAdminRedirect('/admin/merchants')).toBe('/admin/merchants');
    });
  });
});
