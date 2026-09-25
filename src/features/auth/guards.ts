import type { ProfileRole } from '@/domain/schemas';

export interface AuthSession {
  readonly userId: string;
  readonly email: string;
  readonly role: ProfileRole;
  readonly aal: 'aal1' | 'aal2';
}

export type RouteGuardAction =
  { readonly action: 'allow' } | { readonly action: 'redirect'; readonly redirectTo: string };

function matchesSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getRoleDefaultPath(role: ProfileRole): string {
  switch (role) {
    case 'merchant':
      return '/merchant/dashboard';
    case 'courier':
      return '/courier/feed';
    case 'admin':
      return '/';
    default:
      return '/';
  }
}

export function isAdminRoute(pathname: string): boolean {
  const adminPrefixes = [
    '/admin',
    '/couriers',
    '/merchants',
    '/settings',
    '/incidents',
    '/applicants',
    '/audit',
    '/login/mfa',
    '/admin/mfa',
    '/(admin)',
  ];
  return adminPrefixes.some((prefix) => matchesSegment(pathname, prefix));
}

export function isMerchantRoute(pathname: string): boolean {
  // Las rutas de gestión administrativa como /merchants pertenecen a admin
  if (isAdminRoute(pathname)) {
    return false;
  }
  const merchantPrefixes = [
    '/merchant',
    '/requests',
    '/dashboard',
    '/history',
    '/plan',
    '/(merchant)',
  ];
  return merchantPrefixes.some((prefix) => matchesSegment(pathname, prefix));
}

export function isCourierRoute(pathname: string): boolean {
  // Las rutas de gestión administrativa como /couriers pertenecen a admin
  if (isAdminRoute(pathname)) {
    return false;
  }
  const courierPrefixes = ['/courier', '/offers', '/feed', '/profile', '/(courier)'];
  return courierPrefixes.some((prefix) => matchesSegment(pathname, prefix));
}

export function isAuthRoute(pathname: string): boolean {
  // /login/mfa pertenece al flujo MFA de admin y no debe actuar como auth pública
  if (pathname === '/login/mfa') {
    return false;
  }
  return (
    pathname === '/login' ||
    (pathname.startsWith('/login/') && pathname !== '/login/mfa') ||
    pathname === '/register' ||
    pathname.startsWith('/register/')
  );
}

export function isPublicRoute(pathname: string): boolean {
  if (pathname === '/' || isAuthRoute(pathname)) {
    return true;
  }
  const publicPrefixes = ['/forgot-password', '/design-system'];
  return publicPrefixes.some((prefix) => matchesSegment(pathname, prefix));
}

const EXISTING_SHARED_ROUTES = new Set<string>(['/', '/design-system']);

const EXISTING_MERCHANT_EXACT_ROUTES = new Set<string>([
  '/merchant/dashboard',
  '/merchant/history',
  '/merchant/onboarding',
  '/merchant/plan',
  '/merchant/requests',
  '/merchant/requests/new',
]);

const EXISTING_COURIER_EXACT_ROUTES = new Set<string>([
  '/courier',
  '/courier/feed',
  '/courier/offers',
  '/courier/profile',
  '/courier/onboarding/identity',
  '/courier/onboarding/vehicle',
  '/courier/onboarding/status',
]);

export function isKnownExistingRouteForRole(pathname: string, role: ProfileRole): boolean {
  if (EXISTING_SHARED_ROUTES.has(pathname)) {
    return true;
  }
  if (role === 'merchant') {
    if (EXISTING_MERCHANT_EXACT_ROUTES.has(pathname)) {
      return true;
    }
    return /^\/merchant\/requests\/[^/]+$/.test(pathname);
  }
  if (role === 'courier') {
    return EXISTING_COURIER_EXACT_ROUTES.has(pathname);
  }
  return false;
}

export function resolvePostLoginRedirect(rawRedirectTo: unknown, role: ProfileRole): string {
  if (
    typeof rawRedirectTo !== 'string' ||
    !rawRedirectTo.startsWith('/') ||
    rawRedirectTo.startsWith('//') ||
    rawRedirectTo.includes('://') ||
    rawRedirectTo.includes('\\') ||
    /[\r\n]/.test(rawRedirectTo)
  ) {
    return getRoleDefaultPath(role);
  }

  const [pathname, query] = rawRedirectTo.split('?');
  if (!pathname || isAuthRoute(pathname) || pathname === '/forgot-password') {
    return getRoleDefaultPath(role);
  }

  const mockSession: AuthSession = {
    userId: 'check',
    email: '',
    role,
    aal: 'aal1',
  };

  const guardResult = evaluateRouteGuard(pathname, mockSession);
  if (guardResult.action === 'allow' && isKnownExistingRouteForRole(pathname, role)) {
    return rawRedirectTo;
  }

  if (guardResult.action === 'redirect') {
    const [targetPathname] = guardResult.redirectTo.split('?');
    if (targetPathname && isKnownExistingRouteForRole(targetPathname, role)) {
      return query ? `${targetPathname}?${query}` : guardResult.redirectTo;
    }
  }

  return getRoleDefaultPath(role);
}

export function evaluateRouteGuard(
  pathname: string,
  session: AuthSession | null
): RouteGuardAction {
  // 1. Rutas de autenticación pública (login / register)
  if (isAuthRoute(pathname)) {
    if (session) {
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath(session.role),
      };
    }
    return { action: 'allow' };
  }

  // 2. Default-deny para usuarios no autenticados en cualquier ruta no pública
  if (!session) {
    if (isPublicRoute(pathname)) {
      return { action: 'allow' };
    }
    return {
      action: 'redirect',
      redirectTo: `/login?redirectTo=${encodeURIComponent(pathname)}`,
    };
  }

  // 2.b. Redirecciones de aliases heredados a sus rutas canónicas (evita loops y unifica destinos)
  if (pathname === '/onboarding') {
    if (session.role === 'merchant') {
      return { action: 'redirect', redirectTo: '/merchant/onboarding' };
    }
    if (session.role === 'courier') {
      return { action: 'redirect', redirectTo: '/courier/onboarding/identity' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/onboarding/identity') {
    if (session.role === 'courier') {
      return { action: 'redirect', redirectTo: '/courier/onboarding/identity' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/onboarding/vehicle') {
    if (session.role === 'courier') {
      return { action: 'redirect', redirectTo: '/courier/onboarding/vehicle' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/onboarding/status') {
    if (session.role === 'courier') {
      return { action: 'redirect', redirectTo: '/courier/onboarding/status' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/requests') {
    if (session.role === 'merchant') {
      return { action: 'redirect', redirectTo: '/merchant/dashboard' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/requests/new') {
    if (session.role === 'merchant') {
      return { action: 'redirect', redirectTo: '/merchant/requests/new' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname.startsWith('/requests/')) {
    const requestId = pathname.slice('/requests/'.length);
    if (session.role === 'merchant' && requestId && !requestId.includes('/')) {
      return { action: 'redirect', redirectTo: `/merchant/requests/${requestId}` };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/feed') {
    if (session.role === 'courier') {
      return { action: 'redirect', redirectTo: '/courier/feed' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/offers') {
    if (session.role === 'courier') {
      return { action: 'redirect', redirectTo: '/courier/offers' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  if (pathname === '/profile') {
    if (session.role === 'courier') {
      return { action: 'redirect', redirectTo: '/courier/profile' };
    }
    return { action: 'redirect', redirectTo: getRoleDefaultPath(session.role) };
  }

  // 3. Rutas protegidas de administrador (admin)
  if (isAdminRoute(pathname)) {
    if (session.role !== 'admin') {
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath(session.role),
      };
    }
    // Pantallas de ingreso MFA para admin
    if (pathname === '/login/mfa' || pathname === '/admin/mfa') {
      if (session.aal === 'aal1') {
        return { action: 'allow' };
      }
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath('admin'),
      };
    }
    // Resto de admin exige MFA (AAL2)
    if (session.aal !== 'aal2') {
      return {
        action: 'redirect',
        redirectTo: `/login?mfaRequired=1&redirectTo=${encodeURIComponent(pathname)}`,
      };
    }
    return { action: 'allow' };
  }

  // 4. Rutas protegidas de comercio (merchant) - Lista blanca estricta
  if (isMerchantRoute(pathname)) {
    if (session.role !== 'merchant') {
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath(session.role),
      };
    }
    return { action: 'allow' };
  }

  // 5. Rutas protegidas de repartidor (courier) - Lista blanca estricta
  if (isCourierRoute(pathname)) {
    if (session.role !== 'courier') {
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath(session.role),
      };
    }
    return { action: 'allow' };
  }

  // 6. Resto de rutas (públicas o comunes autenticadas como /trips, /onboarding)
  return { action: 'allow' };
}
