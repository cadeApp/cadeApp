import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  evaluateRouteGuard,
  getRoleDefaultPath,
  isMerchantRoute,
  isCourierRoute,
  isAdminRoute,
  isPublicRoute,
  type AuthSession,
} from './guards';
import { registerSchema, loginSchema } from './schemas';
import { registerAction, loginAction, logoutAction } from './actions';
import { getServerSession } from './queries';
import * as serverSupabase from '@/server/supabase/server';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-009: Auth base - Definición de Terminado (DoD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DoD 1: Registro y validación de roles permitidos', () => {
    it('registerSchema acepta rol merchant y courier', () => {
      const merchantInput = {
        email: 'comercio@test.com',
        password: 'password123',
        role: 'merchant',
      };
      const courierInput = {
        email: 'repartidor@test.com',
        password: 'password123',
        role: 'courier',
      };

      expect(registerSchema.safeParse(merchantInput).success).toBe(true);
      expect(registerSchema.safeParse(courierInput).success).toBe(true);
    });

    it('registerSchema rechaza rol admin y cualquier rol no permitido con error de validación', () => {
      const adminInput = {
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
      };
      const invalidRoleInput = {
        email: 'otro@test.com',
        password: 'password123',
        role: 'superadmin',
      };

      const adminParsed = registerSchema.safeParse(adminInput);
      expect(adminParsed.success).toBe(false);

      const invalidParsed = registerSchema.safeParse(invalidRoleInput);
      expect(invalidParsed.success).toBe(false);
    });

    it('registerAction registra correctamente un usuario con rol merchant', async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'comercio@test.com',
        password: 'password123',
        role: 'merchant',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.role).toBe('merchant');
        expect(result.data.userId).toBe('usr-merchant-1');
      }
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'comercio@test.com',
        password: 'password123',
        options: {
          data: expect.objectContaining({
            role: 'merchant',
          }),
        },
      });
    });

    it('registerAction registra correctamente un usuario con rol courier', async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-courier-1', email: 'courier@test.com' }, session: null },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'courier@test.com',
        password: 'password123',
        role: 'courier',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.role).toBe('courier');
        expect(result.data.userId).toBe('usr-courier-1');
      }
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'courier@test.com',
        password: 'password123',
        options: {
          data: expect.objectContaining({
            role: 'courier',
          }),
        },
      });
    });

    it('registerAction rechaza rol admin con INVALID_SIGNUP_ROLE sin invocar signUp', async () => {
      const mockSignUp = vi.fn();
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const result = await registerAction({
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_SIGNUP_ROLE');
      }
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  describe('DoD 2: Guardas por rol y protección de rutas (merchant vs courier)', () => {
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
      expect(merchantAttempt.redirectTo).toMatch(/\/login/);

      const courierAttempt = evaluateRouteGuard('/courier/feed', unauthenticatedSession);
      expect(courierAttempt.action).toBe('redirect');
      expect(courierAttempt.redirectTo).toMatch(/\/login/);

      const adminAttempt = evaluateRouteGuard('/admin', unauthenticatedSession);
      expect(adminAttempt.action).toBe('redirect');
      expect(adminAttempt.redirectTo).toMatch(/\/login/);
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
      expect(guardResult.redirectTo).toBe(getRoleDefaultPath('courier'));
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
      expect(guardResult.redirectTo).toBe(getRoleDefaultPath('merchant'));
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
      expect(aal1Result.redirectTo).toContain('/admin/mfa');

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

      expect(evaluateRouteGuard('/login', merchantSession).redirectTo).toBe(
        getRoleDefaultPath('merchant')
      );
      expect(evaluateRouteGuard('/register', courierSession).redirectTo).toBe(
        getRoleDefaultPath('courier')
      );
    });
  });

  describe('DoD 3 / H16: Consumo asíncrono obligatorio de await createClient() en server actions y queries', () => {
    it('getServerSession invoca await createClient() y resuelve la sesión asíncronamente', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-test-1', email: 'test@example.com' } },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'merchant' },
              error: null,
            }),
          }),
        }),
      });

      const mockGetAal = vi.fn().mockResolvedValue({
        data: { currentLevel: 'aal1' },
        error: null,
      });

      vi.mocked(serverSupabase.createClient).mockImplementation(async () => {
        // Simula retraso asíncrono para verificar que se espera la promesa
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          auth: {
            getUser: mockGetUser,
            mfa: {
              getAuthenticatorAssuranceLevel: mockGetAal,
            },
          },
          from: mockFrom,
        } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>;
      });

      const session = await getServerSession();

      expect(serverSupabase.createClient).toHaveBeenCalledTimes(1);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe('usr-test-1');
      expect(session?.role).toBe('merchant');
      expect(session?.aal).toBe('aal1');
    });

    it('loginAction consume asíncronamente createClient() y autentica con signInWithPassword', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'usr-merchant-1', email: 'comercio@test.com' },
          session: { access_token: 'jwt' },
        },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'merchant' },
              error: null,
            }),
          }),
        }),
      });

      vi.mocked(serverSupabase.createClient).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          auth: {
            signInWithPassword: mockSignIn,
          },
          from: mockFrom,
        } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>;
      });

      const result = await loginAction({
        email: 'comercio@test.com',
        password: 'password123',
      });

      expect(serverSupabase.createClient).toHaveBeenCalledTimes(1);
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'comercio@test.com',
        password: 'password123',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.role).toBe('merchant');
        expect(result.data.redirectTo).toBe(getRoleDefaultPath('merchant'));
      }
    });

    it('logoutAction consume asíncronamente createClient() y llama a signOut()', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(serverSupabase.createClient).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          auth: {
            signOut: mockSignOut,
          },
        } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>;
      });

      const result = await logoutAction();

      expect(serverSupabase.createClient).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(true);
    });
  });
});
