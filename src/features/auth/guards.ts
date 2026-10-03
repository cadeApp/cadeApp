import type { ConsentStatus, ProfileRole } from '@/domain/schemas';

export interface AuthSession {
  readonly userId: string;
  readonly email: string;
  readonly role: ProfileRole;
  readonly aal: 'aal1' | 'aal2';
  readonly consentStatus: ConsentStatus;
  /**
   * T-334: si el comercio o repartidor terminó su onboarding (`business_name` no vacío / `vehicle_type` no nulo).
   * `false` lo manda al onboarding; `undefined` (dato no leído, admin o llamadores que no lo cargan) no cambia nada.
   */
  readonly onboardingComplete?: boolean;
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

/** T-334: primera pantalla del onboarding de cada rol. */
export function getOnboardingPath(role: ProfileRole): string {
  switch (role) {
    case 'merchant':
      return '/merchant/onboarding';
    case 'courier':
      return '/courier/onboarding/identity';
    default:
      return getRoleDefaultPath(role);
  }
}

/**
 * T-334: interpreta la fila de `merchants` (`business_name`) o `couriers` (`vehicle_type`) leída con el cliente del
 * usuario. Sin fila → incompleto. Solo un valor explícito decide; si la columna no llega, el estado queda
 * desconocido (`undefined`) y el guard no redirige.
 */
export function parseOnboardingComplete(role: ProfileRole, row: unknown): boolean | undefined {
  if (role !== 'merchant' && role !== 'courier') return undefined;
  if (row === null) return false;
  if (typeof row !== 'object' || row === undefined) return undefined;
  const value = (row as Record<string, unknown>)[role === 'merchant' ? 'business_name' : 'vehicle_type'];
  if (role === 'merchant') {
    return typeof value === 'string' ? value.trim() !== '' : undefined;
  }
  if (value === null) return false;
  return typeof value === 'string' ? true : undefined;
}

/** El chequeo de onboarding aplica solo a comercio y repartidor con consentimiento activo (CC-007 va antes). */
function hasIncompleteOnboarding(session: AuthSession): boolean {
  return (
    (session.role === 'merchant' || session.role === 'courier') &&
    session.consentStatus === 'active' &&
    session.onboardingComplete === false
  );
}

/** Inicio de la sesión: el onboarding si está incompleto, si no el panel del rol. */
function getSessionHomePath(session: AuthSession): string {
  return hasIncompleteOnboarding(session)
    ? getOnboardingPath(session.role)
    : getRoleDefaultPath(session.role);
}

/**
 * Rutas propias del rol que siguen abiertas con onboarding incompleto: el onboarding y, para el repartidor, el
 * perfil (muestra «Completá tu registro» y el cierre de sesión). Sin esta excepción, el redirect haría loop.
 */
function isAllowedWhileOnboardingIncomplete(pathname: string, role: ProfileRole): boolean {
  if (role === 'merchant') {
    return matchesSegment(pathname, '/merchant/onboarding');
  }
  if (role === 'courier') {
    return (
      matchesSegment(pathname, '/courier/onboarding') ||
      pathname === '/courier/profile'
    );
  }
  return false;
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
  const publicPrefixes = ['/forgot-password', '/design-system', '/auth/confirm', '/reset-password'];
  return publicPrefixes.some((prefix) => matchesSegment(pathname, prefix));
}

const EXISTING_SHARED_ROUTES = new Set<string>(['/', '/design-system', '/reset-password']);

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

/** Pantalla de inicio del admin. El guard la protege con MFA (AAL2). */
const ADMIN_HOME = '/admin/applicants';

/**
 * Destino por defecto después del login. Para el admin no es `getRoleDefaultPath` (`/`): un login con
 * contraseña deja la sesión en AAL1, así que el guard decide el paso por el MFA antes de `/admin/applicants`.
 */
function defaultPostLoginPath(
  role: ProfileRole,
  consentStatus: ConsentStatus,
  onboardingComplete: boolean | undefined
): string {
  if (role !== 'admin') {
    return getSessionHomePath({
      userId: 'check',
      email: '',
      role,
      aal: 'aal1',
      consentStatus,
      onboardingComplete,
    });
  }
  const guardResult = evaluateRouteGuard(ADMIN_HOME, {
    userId: 'check',
    email: '',
    role,
    aal: 'aal1',
    consentStatus,
  });
  return guardResult.action === 'redirect' ? guardResult.redirectTo : ADMIN_HOME;
}

export function resolvePostLoginRedirect(
  rawRedirectTo: unknown,
  role: ProfileRole,
  consentStatus: ConsentStatus,
  onboardingComplete?: boolean
): string {
  if (role !== 'admin' && consentStatus !== 'active') {
    return '/login?consentRequired=1';
  }

  if (
    typeof rawRedirectTo !== 'string' ||
    !rawRedirectTo.startsWith('/') ||
    rawRedirectTo.startsWith('//') ||
    rawRedirectTo.includes('://') ||
    rawRedirectTo.includes('\\') ||
    /[\r\n]/.test(rawRedirectTo)
  ) {
    return defaultPostLoginPath(role, consentStatus, onboardingComplete);
  }

  const [pathname, query] = rawRedirectTo.split('?');
  if (
    !pathname ||
    isAuthRoute(pathname) ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/auth/confirm'
  ) {
    return defaultPostLoginPath(role, consentStatus, onboardingComplete);
  }

  const mockSession: AuthSession = {
    userId: 'check',
    email: '',
    role,
    aal: 'aal1',
    consentStatus,
    onboardingComplete,
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

  return defaultPostLoginPath(role, consentStatus, onboardingComplete);
}

export function evaluateRouteGuard(
  pathname: string,
  session: AuthSession | null
): RouteGuardAction {
  // 1. Rutas de autenticación pública (login / register)
  if (isAuthRoute(pathname)) {
    if (session) {
      if (session.role !== 'admin' && session.consentStatus !== 'active') {
        return { action: 'allow' };
      }
      return {
        action: 'redirect',
        redirectTo: getSessionHomePath(session),
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

  // 2.a. Bloqueo operativo por consent_status (CC-007 / D06 / D07 / D08)
  // Perfiles merchant o courier en pending o reconsent_required no tienen acceso operativo a rutas protegidas
  if (session.role !== 'admin' && session.consentStatus !== 'active') {
    if (
      isMerchantRoute(pathname) ||
      isCourierRoute(pathname) ||
      pathname === '/onboarding' ||
      pathname.startsWith('/onboarding/') ||
      pathname === '/requests' ||
      pathname.startsWith('/requests/') ||
      pathname === '/feed' ||
      pathname === '/offers' ||
      pathname === '/profile'
    ) {
      return {
        action: 'redirect',
        redirectTo: `/login?consentRequired=1&redirectTo=${encodeURIComponent(pathname)}`,
      };
    }
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

  // 2.c. T-334: onboarding incompleto. Toda ruta propia del rol va al onboarding, salvo las exentas (sin loop).
  if (
    hasIncompleteOnboarding(session) &&
    ((session.role === 'merchant' && isMerchantRoute(pathname)) ||
      (session.role === 'courier' && isCourierRoute(pathname))) &&
    !isAllowedWhileOnboardingIncomplete(pathname, session.role)
  ) {
    return { action: 'redirect', redirectTo: getOnboardingPath(session.role) };
  }

  // 3. Rutas protegidas de administrador (admin)
  if (isAdminRoute(pathname)) {
    if (session.role !== 'admin') {
      return {
        action: 'redirect',
        redirectTo: getSessionHomePath(session),
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
        redirectTo: `/login/mfa?redirectTo=${encodeURIComponent(pathname)}`,
      };
    }
    return { action: 'allow' };
  }

  // 4. Rutas protegidas de comercio (merchant) - Lista blanca estricta
  if (isMerchantRoute(pathname)) {
    if (session.role !== 'merchant') {
      return {
        action: 'redirect',
        redirectTo: getSessionHomePath(session),
      };
    }
    return { action: 'allow' };
  }

  // 5. Rutas protegidas de repartidor (courier) - Lista blanca estricta
  if (isCourierRoute(pathname)) {
    if (session.role !== 'courier') {
      return {
        action: 'redirect',
        redirectTo: getSessionHomePath(session),
      };
    }
    return { action: 'allow' };
  }

  // 6. Resto de rutas (públicas o comunes autenticadas como /trips, /onboarding)
  return { action: 'allow' };
}
