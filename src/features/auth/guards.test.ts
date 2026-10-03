import { describe, expect, it } from 'vitest';
import {
  evaluateRouteGuard,
  getOnboardingPath,
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

describe('T-317 / PR139-H14: el login de admin entra al circuito MFA', () => {
  const MFA_TO_APPLICANTS = '/login/mfa?redirectTo=%2Fadmin%2Fapplicants';
  const adminAal1: AuthSession = {
    userId: 'adm-1',
    email: 'admin@test.com',
    role: 'admin',
    aal: 'aal1',
    consentStatus: 'active',
  };
  const adminAal2: AuthSession = { ...adminAal1, aal: 'aal2' };

  it('sin redirectTo, el destino post-login del admin es el MFA hacia /admin/applicants y no /', () => {
    const target = resolvePostLoginRedirect(undefined, 'admin', 'active');
    expect(target).toBe(MFA_TO_APPLICANTS);
    expect(target).not.toBe('/');
  });

  it('recorrido completo: /login → /login/mfa?redirectTo=%2Fadmin%2Fapplicants → /admin/applicants', () => {
    const afterLogin = resolvePostLoginRedirect(undefined, 'admin', 'active');
    const [mfaPath, mfaQuery] = afterLogin.split('?');
    expect(mfaPath).toBe('/login/mfa');
    expect(evaluateRouteGuard('/login/mfa', adminAal1)).toEqual({ action: 'allow' });

    const afterMfa = new URLSearchParams(mfaQuery).get('redirectTo');
    expect(afterMfa).toBe('/admin/applicants');
    expect(evaluateRouteGuard('/admin/applicants', adminAal2)).toEqual({ action: 'allow' });
  });

  it('admin AAL1 en /admin/applicants → /login/mfa?redirectTo=%2Fadmin%2Fapplicants', () => {
    expect(evaluateRouteGuard('/admin/applicants', adminAal1)).toEqual({
      action: 'redirect',
      redirectTo: MFA_TO_APPLICANTS,
    });
  });

  it('merchant y courier conservan sus destinos post-login', () => {
    expect(resolvePostLoginRedirect(undefined, 'merchant', 'active')).toBe('/merchant/dashboard');
    expect(resolvePostLoginRedirect(undefined, 'courier', 'active')).toBe('/courier/feed');
  });

  it.each(['https://evil.com', '//evil.com', '/\evil.com', 'javascript:alert(1)', '/login'])(
    'redirectTo hostil o de autenticación (%s) para admin → MFA hacia /admin/applicants',
    (raw) => {
      expect(resolvePostLoginRedirect(raw, 'admin', 'active')).toBe(MFA_TO_APPLICANTS);
    }
  );
});

describe('T-320: Guardas para /auth/confirm y /reset-password', () => {
  it('reconoce /auth/confirm y /reset-password como rutas públicas accesibles sin sesión', () => {
    expect(isPublicRoute('/auth/confirm')).toBe(true);
    expect(isPublicRoute('/reset-password')).toBe(true);
    expect(evaluateRouteGuard('/auth/confirm', null)).toEqual({ action: 'allow' });
    expect(evaluateRouteGuard('/reset-password', null)).toEqual({ action: 'allow' });
  });

  it('no expulsa de /reset-password a un usuario con sesión y consent_status pendiente o reconsent_required', () => {
    const sessionPending: AuthSession = {
      userId: 'usr-pending',
      email: 'user@test.com',
      role: 'courier',
      aal: 'aal1',
      consentStatus: 'pending',
    };
    const sessionReconsent: AuthSession = {
      ...sessionPending,
      consentStatus: 'reconsent_required',
    };

    expect(evaluateRouteGuard('/reset-password', sessionPending)).toEqual({ action: 'allow' });
    expect(evaluateRouteGuard('/reset-password', sessionReconsent)).toEqual({ action: 'allow' });
  });

  it('permite a un usuario autenticado con consent_status activo acceder a /reset-password', () => {
    const sessionActive: AuthSession = {
      userId: 'usr-active',
      email: 'user@test.com',
      role: 'merchant',
      aal: 'aal1',
      consentStatus: 'active',
    };
    expect(evaluateRouteGuard('/reset-password', sessionActive)).toEqual({ action: 'allow' });
  });
});

describe('T-334: onboarding incompleto redirige al onboarding sin loops', () => {
  const baseSession = (
    role: 'merchant' | 'courier' | 'admin',
    onboardingComplete: boolean | undefined,
    consentStatus: AuthSession['consentStatus'] = 'active'
  ): AuthSession => ({
    userId: `user-${role}`,
    email: `${role}@cadeapp.test`,
    role,
    aal: role === 'admin' ? 'aal2' : 'aal1',
    consentStatus,
    onboardingComplete,
  });

  /** Sigue los redirects del guard como lo haría el navegador y falla ante un loop. */
  function followGuard(start: string, session: AuthSession): string {
    const visited: string[] = [];
    let current = start;
    for (let hop = 0; hop < 6; hop += 1) {
      const [pathname = '/'] = current.split('?');
      if (visited.includes(pathname)) {
        throw new Error(`Loop de redirección: ${[...visited, pathname].join(' → ')}`);
      }
      visited.push(pathname);
      const result = evaluateRouteGuard(pathname, session);
      if (result.action === 'allow') return pathname;
      current = result.redirectTo;
    }
    throw new Error(`Demasiados redirects desde ${start}: ${visited.join(' → ')}`);
  }

  const MERCHANT_OPERATIONAL = [
    '/merchant/dashboard',
    '/merchant/history',
    '/merchant/plan',
    '/merchant/requests',
    '/merchant/requests/new',
    '/merchant/requests/req-1',
    '/requests',
    '/requests/new',
    '/requests/req-1',
    '/dashboard',
    '/history',
    '/plan',
  ];
  const COURIER_OPERATIONAL = ['/courier', '/courier/feed', '/courier/offers', '/feed', '/offers'];
  const PUBLIC_ROUTES = ['/', '/design-system', '/forgot-password', '/reset-password', '/auth/confirm'];

  it('expone la ruta de onboarding de cada rol', () => {
    expect(getOnboardingPath('merchant')).toBe('/merchant/onboarding');
    expect(getOnboardingPath('courier')).toBe('/courier/onboarding/identity');
  });

  it.each(MERCHANT_OPERATIONAL)('comercio incompleto en %s termina en /merchant/onboarding', (path) => {
    expect(followGuard(path, baseSession('merchant', false))).toBe('/merchant/onboarding');
  });

  it.each(COURIER_OPERATIONAL)(
    'repartidor incompleto en %s termina en /courier/onboarding/identity',
    (path) => {
      expect(followGuard(path, baseSession('courier', false))).toBe('/courier/onboarding/identity');
    }
  );

  it('rutas de onboarding, públicas, de auth y alias quedan accesibles sin loops (comercio)', () => {
    const session = baseSession('merchant', false);
    expect(followGuard('/merchant/onboarding', session)).toBe('/merchant/onboarding');
    expect(followGuard('/onboarding', session)).toBe('/merchant/onboarding');
    for (const path of PUBLIC_ROUTES) {
      expect(followGuard(path, session)).toBe(path);
    }
    expect(followGuard('/login', session)).toBe('/merchant/onboarding');
    expect(followGuard('/register', session)).toBe('/merchant/onboarding');
    // Rutas del otro rol: terminan en el onboarding propio, sin ciclar.
    expect(followGuard('/courier/feed', session)).toBe('/merchant/onboarding');
  });

  it('rutas de onboarding, perfil, públicas, de auth y alias quedan accesibles sin loops (repartidor)', () => {
    const session = baseSession('courier', false);
    for (const path of [
      '/courier/onboarding/identity',
      '/courier/onboarding/vehicle',
      '/courier/onboarding/status',
    ]) {
      expect(followGuard(path, session)).toBe(path);
    }
    expect(followGuard('/onboarding', session)).toBe('/courier/onboarding/identity');
    expect(followGuard('/onboarding/identity', session)).toBe('/courier/onboarding/identity');
    expect(followGuard('/onboarding/vehicle', session)).toBe('/courier/onboarding/vehicle');
    expect(followGuard('/onboarding/status', session)).toBe('/courier/onboarding/status');
    // El perfil muestra «Completá tu registro» (y tiene el cierre de sesión): no se redirige.
    expect(followGuard('/courier/profile', session)).toBe('/courier/profile');
    expect(followGuard('/profile', session)).toBe('/courier/profile');
    for (const path of PUBLIC_ROUTES) {
      expect(followGuard(path, session)).toBe(path);
    }
    expect(followGuard('/login', session)).toBe('/courier/onboarding/identity');
    expect(followGuard('/merchant/dashboard', session)).toBe('/courier/onboarding/identity');
  });

  it('PR240-H01: la excepción del perfil es exacta; sus subrutas siguen yendo al onboarding', () => {
    // /courier/profile exacto sigue accesible (muestra «Completá tu registro»).
    expect(followGuard('/courier/profile', baseSession('courier', false))).toBe('/courier/profile');
    expect(
      followGuard('/courier/profile/notifications', baseSession('courier', false))
    ).toBe('/courier/onboarding/identity');
  });

  it('con onboarding completo no cambia nada', () => {
    for (const path of ['/merchant/dashboard', '/merchant/requests/new', '/merchant/onboarding']) {
      expect(evaluateRouteGuard(path, baseSession('merchant', true))).toEqual({ action: 'allow' });
    }
    for (const path of ['/courier/feed', '/courier/offers', '/courier/profile']) {
      expect(evaluateRouteGuard(path, baseSession('courier', true))).toEqual({ action: 'allow' });
    }
    expect(followGuard('/login', baseSession('merchant', true))).toBe('/merchant/dashboard');
    expect(followGuard('/login', baseSession('courier', true))).toBe('/courier/feed');
  });

  it('CC-007 sigue primero: consentimiento no activo bloquea antes que el onboarding', () => {
    const result = evaluateRouteGuard(
      '/merchant/dashboard',
      baseSession('merchant', false, 'pending')
    );
    expect(result).toEqual({
      action: 'redirect',
      redirectTo: '/login?consentRequired=1&redirectTo=%2Fmerchant%2Fdashboard',
    });
  });

  it('admin no cambia aunque llegue un dato de onboarding', () => {
    expect(evaluateRouteGuard('/admin/applicants', baseSession('admin', false))).toEqual({
      action: 'allow',
    });
  });

  it('resolvePostLoginRedirect manda al onboarding cuando está incompleto', () => {
    expect(resolvePostLoginRedirect(null, 'merchant', 'active', false)).toBe('/merchant/onboarding');
    expect(resolvePostLoginRedirect(null, 'courier', 'active', false)).toBe(
      '/courier/onboarding/identity'
    );
    expect(resolvePostLoginRedirect('/merchant/requests/new', 'merchant', 'active', false)).toBe(
      '/merchant/onboarding'
    );
    expect(resolvePostLoginRedirect('/courier/onboarding/vehicle', 'courier', 'active', false)).toBe(
      '/courier/onboarding/vehicle'
    );
    // Completo: mismos destinos que antes.
    expect(resolvePostLoginRedirect(null, 'merchant', 'active', true)).toBe('/merchant/dashboard');
    expect(resolvePostLoginRedirect(null, 'courier', 'active', true)).toBe('/courier/feed');
    // CC-007 sigue primero.
    expect(resolvePostLoginRedirect(null, 'courier', 'pending', false)).toBe(
      '/login?consentRequired=1'
    );
  });
});
