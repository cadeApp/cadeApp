import { describe, expect, it } from 'vitest';
import {
  evaluateRouteGuard,
  getRoleDefaultPath,
  isMerchantRoute,
  isCourierRoute,
  isAdminRoute,
  isPublicRoute,
  resolvePostLoginRedirect,
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
      consentStatus: 'active',
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
      consentStatus: 'active',
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
      consentStatus: 'active',
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
      consentStatus: 'active',
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
      consentStatus: 'active',
    };

    const adminWithAal2: AuthSession = {
      userId: 'usr-admin',
      email: 'admin@test.com',
      role: 'admin',
      aal: 'aal2',
      consentStatus: 'active',
    };

    const aal1Result = evaluateRouteGuard('/admin/couriers', adminWithoutAal2);
    expect(aal1Result.action).toBe('redirect');
    if (aal1Result.action === 'redirect') {
      expect(aal1Result.redirectTo).toBe('/login/mfa?redirectTo=%2Fadmin%2Fcouriers');
    }

    const aal2Result = evaluateRouteGuard('/admin/couriers', adminWithAal2);
    expect(aal2Result.action).toBe('allow');
  });

  it('PR106-H02: Flujo MFA completo - admin aal1 intenta entrar a /admin/... -> directo a /login/mfa?redirectTo=... -> permite MFA -> con aal2 accede al destino original', () => {
    const adminAal1: AuthSession = {
      userId: 'admin-1',
      email: 'admin@cadeapp.ar',
      role: 'admin',
      aal: 'aal1',
      consentStatus: 'active',
    };

    // Paso 1: Admin intenta acceder a ruta protegida admin con aal1
    const step1 = evaluateRouteGuard('/admin/applicants', adminAal1);
    expect(step1.action).toBe('redirect');
    if (step1.action === 'redirect') {
      expect(step1.redirectTo).toBe('/login/mfa?redirectTo=%2Fadmin%2Fapplicants');
    }

    // Paso 2: Admin aal1 llega a la pantalla /login/mfa
    const step2 = evaluateRouteGuard('/login/mfa', adminAal1);
    expect(step2.action).toBe('allow');

    // Paso 3: Tras verificar TOTP, la sesión pasa a aal2 y accede a la ruta original
    const adminAal2: AuthSession = {
      ...adminAal1,
      aal: 'aal2',
    };
    const step3 = evaluateRouteGuard('/admin/applicants', adminAal2);
    expect(step3.action).toBe('allow');
  });

  it('usuario autenticado en /login o /register es redirigido a su panel según rol', () => {
    const merchantSession: AuthSession = {
      userId: 'usr-merchant',
      email: 'comercio@test.com',
      role: 'merchant',
      aal: 'aal1',
      consentStatus: 'active',
    };
    const courierSession: AuthSession = {
      userId: 'usr-courier',
      email: 'courier@test.com',
      role: 'courier',
      aal: 'aal1',
      consentStatus: 'active',
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

  it('PR60-H02: evita colisión de startsWith con /couriers y /merchants de admin', () => {
    expect(isCourierRoute('/couriers')).toBe(false);
    expect(isAdminRoute('/couriers')).toBe(true);

    expect(isMerchantRoute('/merchants')).toBe(false);
    expect(isAdminRoute('/merchants')).toBe(true);
  });

  it('PR60-H02: default-deny en rutas de App Router sin route group para usuario anon', () => {
    const unauthenticatedSession: AuthSession | null = null;
    const tripsAttempt = evaluateRouteGuard('/trips/trip-1', unauthenticatedSession);
    expect(tripsAttempt.action).toBe('redirect');

    const feedAttempt = evaluateRouteGuard('/feed', unauthenticatedSession);
    expect(feedAttempt.action).toBe('redirect');

    const incidentsAttempt = evaluateRouteGuard('/incidents', unauthenticatedSession);
    expect(incidentsAttempt.action).toBe('redirect');
  });

  it('PR60-H02: admin con aal1 no entra a merchant ni courier y no cicla en /login/mfa', () => {
    const adminAal1: AuthSession = {
      userId: 'usr-admin',
      email: 'admin@test.com',
      role: 'admin',
      aal: 'aal1',
      consentStatus: 'active',
    };

    const merchantAttempt = evaluateRouteGuard('/merchant/dashboard', adminAal1);
    expect(merchantAttempt.action).toBe('redirect');
    if (merchantAttempt.action === 'redirect') {
      expect(merchantAttempt.redirectTo).toBe(getRoleDefaultPath('admin'));
    }

    const mfaAttempt = evaluateRouteGuard('/login/mfa', adminAal1);
    expect(mfaAttempt.action).toBe('allow');
  });

  it('PR60-H04: resolvePostLoginRedirect previene Open Redirect y respeta rol', () => {
    // Open redirect attempts
    expect(resolvePostLoginRedirect('https://evil.com', 'merchant', 'active')).toBe('/merchant/dashboard');
    expect(resolvePostLoginRedirect('//evil.com', 'courier', 'active')).toBe('/courier/feed');
    expect(resolvePostLoginRedirect('/login', 'merchant', 'active')).toBe('/merchant/dashboard');

    // PR60-H08: rechazo de barras invertidas para evitar bypass con normalización WHATWG
    expect(resolvePostLoginRedirect('/\\evil.com', 'merchant', 'active')).toBe('/merchant/dashboard');
    expect(resolvePostLoginRedirect('/foo\\bar', 'courier', 'active')).toBe('/courier/feed');

    // Cross-role redirect attempt
    expect(resolvePostLoginRedirect('/merchant/dashboard', 'courier', 'active')).toBe('/courier/feed');
    expect(resolvePostLoginRedirect('/courier/feed', 'merchant', 'active')).toBe('/merchant/dashboard');

    // Valid internal redirect for role
    expect(resolvePostLoginRedirect('/merchant/history', 'merchant', 'active')).toBe('/merchant/history');
    expect(resolvePostLoginRedirect('/merchant/requests/req-123', 'merchant', 'active')).toBe(
      '/merchant/requests/req-123'
    );
    expect(resolvePostLoginRedirect('/courier/offers', 'courier', 'active')).toBe('/courier/offers');
    expect(resolvePostLoginRedirect('/', 'merchant', 'active')).toBe('/');
    expect(resolvePostLoginRedirect('/design-system', 'courier', 'active')).toBe('/design-system');

    // PR87-H01: ningún redirect post-login puede terminar en 404 (rutas inexistentes o legales pendientes de T-311)
    expect(resolvePostLoginRedirect('/ruta-inexistente', 'merchant', 'active')).toBe('/merchant/dashboard');
    expect(resolvePostLoginRedirect('/ghost', 'courier', 'active')).toBe('/courier/feed');
    expect(resolvePostLoginRedirect('/terms', 'merchant', 'active')).toBe('/merchant/dashboard');
    expect(resolvePostLoginRedirect('/privacy', 'courier', 'active')).toBe('/courier/feed');
    expect(resolvePostLoginRedirect('/pilot-terms', 'merchant', 'active')).toBe('/merchant/dashboard');
    expect(resolvePostLoginRedirect('/legal', 'courier', 'active')).toBe('/courier/feed');

    expect(isPublicRoute('/terms')).toBe(false);
    expect(isPublicRoute('/privacy')).toBe(false);
    expect(isPublicRoute('/pilot-terms')).toBe(false);
    expect(isPublicRoute('/legal')).toBe(false);
  });

  describe('CC-007: Invariante de consentimiento legal obligatorio en guards', () => {
    it('bloquea a merchant con consentStatus = pending redirigiéndolo fuera de rutas protegidas', () => {
      const pendingMerchant: AuthSession = {
        userId: 'usr-m-pending',
        email: 'm@test.com',
        role: 'merchant',
        aal: 'aal1',
        consentStatus: 'pending',
      };
      const result = evaluateRouteGuard('/merchant/dashboard', pendingMerchant);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toContain('/login?consentRequired=1');
      }
    });

    it('bloquea a courier con consentStatus = reconsent_required en rutas protegidas', () => {
      const reconsentCourier: AuthSession = {
        userId: 'usr-c-reconsent',
        email: 'c@test.com',
        role: 'courier',
        aal: 'aal1',
        consentStatus: 'reconsent_required',
      };
      const result = evaluateRouteGuard('/courier/feed', reconsentCourier);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toContain('/login?consentRequired=1');
      }
    });

    it('permite acceso normal a merchant con consentStatus = active', () => {
      const activeMerchant: AuthSession = {
        userId: 'usr-m-active',
        email: 'm@test.com',
        role: 'merchant',
        aal: 'aal1',
        consentStatus: 'active',
      };
      const result = evaluateRouteGuard('/merchant/dashboard', activeMerchant);
      expect(result.action).toBe('allow');
    });

    it('admin queda exento del gate de consentimiento operativo', () => {
      const adminPending: AuthSession = {
        userId: 'usr-admin',
        email: 'admin@test.com',
        role: 'admin',
        aal: 'aal2',
        consentStatus: 'pending',
      };
      const result = evaluateRouteGuard('/admin', adminPending);
      expect(result.action).toBe('allow');
    });

    it('resolvePostLoginRedirect no envía a dashboard a usuarios pending o reconsent_required', () => {
      expect(resolvePostLoginRedirect('/merchant/dashboard', 'merchant', 'pending')).toBe(
        '/login?consentRequired=1'
      );
      expect(resolvePostLoginRedirect('/courier/feed', 'courier', 'reconsent_required')).toBe(
        '/login?consentRequired=1'
      );
      expect(resolvePostLoginRedirect('/merchant/dashboard', 'merchant', 'active')).toBe(
        '/merchant/dashboard'
      );
    });

    it('permite rutas públicas y login a usuarios pending para regularización', () => {
      const pendingUser: AuthSession = {
        userId: 'usr-pending',
        email: 'p@test.com',
        role: 'merchant',
        aal: 'aal1',
        consentStatus: 'pending',
      };
      expect(evaluateRouteGuard('/', pendingUser).action).toBe('allow');
      expect(evaluateRouteGuard('/login', pendingUser).action).toBe('allow');
      expect(evaluateRouteGuard('/register', pendingUser).action).toBe('allow');
    });

    it('mutación adversarial: si se omite el bloqueo de consent_status en el guard, se produce acceso indebido', () => {
      // Simula un guard mutado donde se omite la validación de consent_status
      function mutantEvaluateRouteGuard(pathname: string, session: AuthSession | null) {
        if (session && session.role === 'merchant') {
          return { action: 'allow' as const };
        }
        return evaluateRouteGuard(pathname, session);
      }

      const pendingMerchant: AuthSession = {
        userId: 'usr-m-pending',
        email: 'm@test.com',
        role: 'merchant',
        aal: 'aal1',
        consentStatus: 'pending',
      };

      const realResult = evaluateRouteGuard('/merchant/dashboard', pendingMerchant);
      const mutantResult = mutantEvaluateRouteGuard('/merchant/dashboard', pendingMerchant);

      expect(realResult.action).toBe('redirect');
      expect(mutantResult.action).toBe('allow');
    });
  });
});
