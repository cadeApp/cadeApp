import { describe, expect, it } from 'vitest';
import {
  evaluateRouteGuard,
  getRoleDefaultPath,
  isMerchantRoute,
  isCourierRoute,
  isAdminRoute,
  isPublicRoute,
  type AuthSession,
} from './guards';

describe('T-009: Guardas por rol y protección de rutas', () => {
  it('identifica correctamente las rutas por actor y las rutas públicas', () => {
    expect(isMerchantRoute('/merchant/dashboard')).toBe(true);
    expect(isMerchantRoute('/merchant/history')).toBe(true);
    expect(isMerchantRoute('/requests/new')).toBe(true);
    expect(isMerchantRoute('/courier/feed')).toBe(false);

    expect(isCourierRoute('/courier/feed')).toBe(true);
    expect(isCourierRoute('/courier/offers')).toBe(true);
    expect(isCourierRoute('/courier/profile')).toBe(true);
    expect(isCourierRoute('/merchant/dashboard')).toBe(false);

    expect(isAdminRoute('/admin/couriers')).toBe(true);
    expect(isAdminRoute('/admin')).toBe(true);
    expect(isAdminRoute('/merchant/dashboard')).toBe(false);

    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/register')).toBe(true);
    expect(isPublicRoute('/')).toBe(true);
    expect(isPublicRoute('/merchant/dashboard')).toBe(false);
  });

  it('redirecciona a /login si un usuario no autenticado intenta entrar a rutas protegidas', () => {
    const unauthenticatedSession: AuthSession | null = null;

    const merchantAttempt = evaluateRouteGuard('/merchant/dashboard', unauthenticatedSession);
    expect(merchantAttempt.action).toBe('redirect');
    if (merchantAttempt.action === 'redirect') {
      expect(merchantAttempt.redirectTo).toMatch(/\/login/);
    }

    const courierAttempt = evaluateRouteGuard('/courier/feed', unauthenticatedSession);
    expect(courierAttempt.action).toBe('redirect');
    if (courierAttempt.action === 'redirect') {
      expect(courierAttempt.redirectTo).toMatch(/\/login/);
    }

    const adminAttempt = evaluateRouteGuard('/admin', unauthenticatedSession);
    expect(adminAttempt.action).toBe('redirect');
    if (adminAttempt.action === 'redirect') {
      expect(adminAttempt.redirectTo).toMatch(/\/login/);
    }
  });

  it('courier no entra a (merchant): redirige al dashboard del repartidor', () => {
    const courierSession: AuthSession = {
      userId: 'usr-courier',
      email: 'courier@test.com',
      role: 'courier',
      aal: 'aal1',
    };

    const guardResult = evaluateRouteGuard('/merchant/dashboard', courierSession);
    expect(guardResult.action).toBe('redirect');
    if (guardResult.action === 'redirect') {
      expect(guardResult.redirectTo).toBe(getRoleDefaultPath('courier'));
    }
  });

  it('merchant no entra a (courier): redirige al dashboard del comercio', () => {
    const merchantSession: AuthSession = {
      userId: 'usr-merchant',
      email: 'comercio@test.com',
      role: 'merchant',
      aal: 'aal1',
    };

    const guardResult = evaluateRouteGuard('/courier/feed', merchantSession);
    expect(guardResult.action).toBe('redirect');
    if (guardResult.action === 'redirect') {
      expect(guardResult.redirectTo).toBe(getRoleDefaultPath('merchant'));
    }
  });

  it('merchant accede a sus rutas permitidas sin redirección', () => {
    const merchantSession: AuthSession = {
      userId: 'usr-merchant',
      email: 'comercio@test.com',
      role: 'merchant',
      aal: 'aal1',
    };

    const guardResult = evaluateRouteGuard('/merchant/dashboard', merchantSession);
    expect(guardResult.action).toBe('allow');
  });

  it('courier accede a sus rutas permitidas sin redirección', () => {
    const courierSession: AuthSession = {
      userId: 'usr-courier',
      email: 'courier@test.com',
      role: 'courier',
      aal: 'aal1',
    };

    const guardResult = evaluateRouteGuard('/courier/feed', courierSession);
    expect(guardResult.action).toBe('allow');
  });

  it('rutas de admin exigen rol admin y nivel aal2 (MFA)', () => {
    const adminWithoutAal2: AuthSession = {
      userId: 'usr-admin',
      email: 'admin@test.com',
      role: 'admin',
      aal: 'aal1',
    };

    const adminWithAal2: AuthSession = {
      userId: 'usr-admin',
      email: 'admin@test.com',
      role: 'admin',
      aal: 'aal2',
    };

    const aal1Result = evaluateRouteGuard('/admin/couriers', adminWithoutAal2);
    expect(aal1Result.action).toBe('redirect');
    if (aal1Result.action === 'redirect') {
      expect(aal1Result.redirectTo).toContain('/admin/mfa');
    }

    const aal2Result = evaluateRouteGuard('/admin/couriers', adminWithAal2);
    expect(aal2Result.action).toBe('allow');
  });

  it('usuario autenticado en /login o /register es redirigido a su panel según rol', () => {
    const merchantSession: AuthSession = {
      userId: 'usr-merchant',
      email: 'comercio@test.com',
      role: 'merchant',
      aal: 'aal1',
    };
    const courierSession: AuthSession = {
      userId: 'usr-courier',
      email: 'courier@test.com',
      role: 'courier',
      aal: 'aal1',
    };

    const loginMerchant = evaluateRouteGuard('/login', merchantSession);
    expect(loginMerchant.action).toBe('redirect');
    if (loginMerchant.action === 'redirect') {
      expect(loginMerchant.redirectTo).toBe(getRoleDefaultPath('merchant'));
    }

    const registerCourier = evaluateRouteGuard('/register', courierSession);
    expect(registerCourier.action).toBe('redirect');
    if (registerCourier.action === 'redirect') {
      expect(registerCourier.redirectTo).toBe(getRoleDefaultPath('courier'));
    }
  });
});
