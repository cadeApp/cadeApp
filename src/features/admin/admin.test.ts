import { describe, it, expect } from 'vitest';
import { evaluateRouteGuard, type AuthSession } from '@/features/auth';
import { ADMIN_NAV_TABS } from './constants';

describe('T-122: DoD - Admin Shell y Route Guard A00', () => {
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

  describe('3. Navegación Desktop A00: 5 pestañas canónicas sin Liquidaciones', () => {
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
