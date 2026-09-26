import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateRouteGuard, type AuthSession } from '@/features/auth';
import { ADMIN_NAV_TABS } from './constants';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  suspendCourierAction,
  verifyCourierDocumentAction,
} from './actions';
import { getApplicantsQueue, getApplicantDetail } from './queries';

// Mocks de infraestructura de Supabase
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('T-122: DoD - Admin de repartidores y Shell A00', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Seguridad y MFA: sin aal2 no se entra', () => {
    it('evaluateRouteGuard redirige a login con mfaRequired=1 si el admin solo tiene aal1 en /admin/applicants', () => {
      const adminAal1Session: AuthSession = {
        userId: 'admin-uuid-1',
        email: 'admin@cadeapp.ar',
        role: 'admin',
        aal: 'aal1',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', adminAal1Session);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toContain('mfaRequired=1');
      }
    });

    it('evaluateRouteGuard permite el acceso a /admin/applicants si el admin tiene aal2', () => {
      const adminAal2Session: AuthSession = {
        userId: 'admin-uuid-1',
        email: 'admin@cadeapp.ar',
        role: 'admin',
        aal: 'aal2',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', adminAal2Session);
      expect(result.action).toBe('allow');
    });

    it('Server Actions rechazan la operación si el admin no cuenta con claim aal2 (AAL2_REQUIRED)', async () => {
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
  });

  describe('2. Control de rol: merchant/courier no atraviesan el shell admin', () => {
    it('evaluateRouteGuard bloquea a merchant redirigiéndolo a su panel', () => {
      const merchantSession: AuthSession = {
        userId: 'merchant-uuid',
        email: 'merchant@test.com',
        role: 'merchant',
        aal: 'aal1',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', merchantSession);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe('/merchant/dashboard');
      }
    });

    it('evaluateRouteGuard bloquea a courier redirigiéndolo a su feed', () => {
      const courierSession: AuthSession = {
        userId: 'courier-uuid',
        email: 'courier@test.com',
        role: 'courier',
        aal: 'aal1',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', courierSession);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe('/courier/feed');
      }
    });
  });

  describe('3. Decisiones con motivo obligatorio', () => {
    it('decideCourierAction rechaza motivo vacío con REASON_REQUIRED', async () => {
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

    it('suspendCourierAction rechaza motivo vacío con REASON_REQUIRED', async () => {
      const resultEmpty = await suspendCourierAction({
        courierId: 'courier-1',
        reason: '',
      });
      expect(resultEmpty.ok).toBe(false);
      if (!resultEmpty.ok) {
        expect(resultEmpty.code).toBe('REASON_REQUIRED');
      }
    });

    it('verifyCourierDocumentAction con verified=false exige rejectionReason con REASON_REQUIRED', async () => {
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
  });

  describe('4. Visor documental: URL firmada de 60s y registro inmutable en audit_log', () => {
    it('viewCourierDocumentAction emite signedUrl de 60s e inserta fila en audit_log', async () => {
      const result = await viewCourierDocumentAction({
        documentId: 'doc-456',
        courierId: 'courier-789',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.expiresInSeconds).toBe(60);
        expect(result.data.signedUrl).toContain('https://');
      }
    });
  });

  describe('5. Cola y detalle de postulantes: CBU/alias bancario no aparece', () => {
    it('getApplicantsQueue retorna lista de postulantes', async () => {
      const queue = await getApplicantsQueue('pending');
      expect(Array.isArray(queue)).toBe(true);
      expect(queue.length).toBeGreaterThan(0);
    });

    it('getApplicantDetail no contiene campos bancarios (CBU / Alias extirpado)', async () => {
      const detail = await getApplicantDetail('courier-1');
      expect(detail).not.toBeNull();
      if (detail) {
        const keys = Object.keys(detail);
        const forbiddenFields = ['cbu', 'alias', 'bank_account', 'bank', 'cbu_alias'];
        for (const field of forbiddenFields) {
          expect(keys).not.toContain(field);
        }
      }
    });
  });

  describe('6. Navegación Desktop A00: 5 pestañas canónicas sin Liquidaciones', () => {
    it('ADMIN_NAV_TABS contiene exactamente las 5 pestañas canónicas', () => {
      expect(ADMIN_NAV_TABS).toHaveLength(5);
      const labels = ADMIN_NAV_TABS.map((t) => t.label);
      expect(labels).toEqual([
        'Postulantes',
        'Comercios',
        'Incidentes',
        'Parámetros',
        'Auditoría',
      ]);
      const hrefs = ADMIN_NAV_TABS.map((t) => t.href);
      expect(hrefs).toEqual([
        '/admin/applicants',
        '/admin/merchants',
        '/admin/incidents',
        '/admin/settings',
        '/admin/audit',
      ]);
    });

    it('ADMIN_NAV_TABS no incluye ninguna solapa de Liquidaciones', () => {
      const labels = ADMIN_NAV_TABS.map((t) => t.label.toLowerCase());
      expect(labels).not.toContain('liquidaciones');
      expect(labels).not.toContain('settlements');
      const hrefs = ADMIN_NAV_TABS.map((t) => t.href.toLowerCase());
      expect(hrefs.some((h) => h.includes('liquidaciones') || h.includes('settlements'))).toBe(false);
    });
  });
});
