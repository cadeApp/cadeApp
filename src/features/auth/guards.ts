import type { ProfileRole } from '@/domain/schemas';

export interface AuthSession {
  readonly userId: string;
  readonly email: string;
  readonly role: ProfileRole;
  readonly aal: 'aal1' | 'aal2';
}

export type RouteGuardAction =
  | { readonly action: 'allow' }
  | { readonly action: 'redirect'; readonly redirectTo: string };

export function getRoleDefaultPath(role: ProfileRole): string {
  switch (role) {
    case 'merchant':
      return '/merchant/dashboard';
    case 'courier':
      return '/courier/feed';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

export function isMerchantRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/merchant') ||
    pathname.startsWith('/requests') ||
    pathname.startsWith('/(merchant)')
  );
}

export function isCourierRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/courier') ||
    pathname.startsWith('/offers') ||
    pathname.startsWith('/(courier)')
  );
}

export function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/(admin)');
}

export function isAuthRoute(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/register/')
  );
}

export function isPublicRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    isAuthRoute(pathname) ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/pilot-terms'
  );
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

  // 2. Rutas protegidas de comercio (merchant)
  if (isMerchantRoute(pathname)) {
    if (!session) {
      return {
        action: 'redirect',
        redirectTo: `/login?redirectTo=${encodeURIComponent(pathname)}`,
      };
    }
    if (session.role === 'courier') {
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath('courier'),
      };
    }
    return { action: 'allow' };
  }

  // 3. Rutas protegidas de repartidor (courier)
  if (isCourierRoute(pathname)) {
    if (!session) {
      return {
        action: 'redirect',
        redirectTo: `/login?redirectTo=${encodeURIComponent(pathname)}`,
      };
    }
    if (session.role === 'merchant') {
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath('merchant'),
      };
    }
    return { action: 'allow' };
  }

  // 4. Rutas protegidas de administrador (admin)
  if (isAdminRoute(pathname)) {
    if (!session) {
      return {
        action: 'redirect',
        redirectTo: `/login?redirectTo=${encodeURIComponent(pathname)}`,
      };
    }
    if (session.role !== 'admin') {
      return {
        action: 'redirect',
        redirectTo: getRoleDefaultPath(session.role),
      };
    }
    // Requiere AAL2 (MFA)
    if (session.aal !== 'aal2' && !pathname.startsWith('/admin/mfa')) {
      return {
        action: 'redirect',
        redirectTo: `/admin/mfa?redirectTo=${encodeURIComponent(pathname)}`,
      };
    }
    return { action: 'allow' };
  }

  // 5. Resto de rutas públicas o no restringidas
  return { action: 'allow' };
}
