import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  evaluateRouteGuard,
  getRoleDefaultPath,
  isMerchantRoute,
  isCourierRoute,
  registerAction,
  type AuthSession,
} from '@/features/auth';
import * as serverSupabase from '@/server/supabase/server';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

const ROOT_DIR = path.resolve(__dirname, '..');

describe('T-118: Integridad de Rutas, Shells y Navegación Canónica', () => {
  describe('DoD 1: P01 Landing pública de inicio (src/app/page.tsx)', () => {
    it('no debe contener el placeholder de Fase 0 (T-000) y debe implementar la landing P01 de Aguilares', () => {
      const pagePath = path.join(ROOT_DIR, 'app/page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, 'utf-8');

      // Falla si conserva el scaffold mínimo de T-000
      expect(content).not.toContain('Fase 0 · Scaffold mínimo operativo (T-000)');

      // Debe contener la propuesta de valor y elementos de P01
      expect(content).toMatch(/Aguilares/i);
      expect(content).toMatch(/¿Quién paga el envío\?/i);
      expect(content).toMatch(/Lo paga quien recibe/i);
      expect(content).toMatch(/Tengo un comercio/i);
      expect(content).toMatch(/Quiero repartir/i);
    });
  });

  describe('DoD 2: Existencia de Rutas Canónicas en el Filesystem', () => {
    const requiredFiles = [
      // Rutas públicas
      'src/app/(public)/layout.tsx',
      'src/app/(public)/forgot-password/page.tsx',

      // Rutas canónicas de Comercio (C01, C02, C03, C04/C05, C07, C08)
      'src/app/(merchant)/layout.tsx',
      'src/app/(merchant)/merchant-nav.tsx',
      'src/app/(merchant)/merchant/onboarding/page.tsx',
      'src/app/(merchant)/merchant/dashboard/page.tsx',
      'src/app/(merchant)/merchant/requests/new/page.tsx',
      'src/app/(merchant)/merchant/requests/[id]/page.tsx',
      'src/app/(merchant)/merchant/history/page.tsx',
      'src/app/(merchant)/merchant/plan/page.tsx',

      // Rutas canónicas de Repartidor (R01, R02, R03, R04, R06, R08)
      'src/app/(courier)/courier/onboarding/identity/page.tsx',
      'src/app/(courier)/courier/onboarding/vehicle/page.tsx',
      'src/app/(courier)/courier/onboarding/status/page.tsx',
      'src/app/(courier)/courier/feed/page.tsx',
      'src/app/(courier)/courier/offers/page.tsx',
      'src/app/(courier)/courier/profile/page.tsx',
    ];

    it.each(requiredFiles)('debe existir el archivo canónico: %s', (relativePath) => {
      const fullPath = path.resolve(ROOT_DIR, '..', relativePath);
      expect(fs.existsSync(fullPath), `Falta el archivo canónico: ${relativePath}`).toBe(true);
    });
  });

  describe('DoD 3: Aislamiento de Onboarding por Rol y Guardas', () => {
    it('clasifica las rutas de onboarding bajo sus respectivos roles', () => {
      expect(isMerchantRoute('/merchant/onboarding')).toBe(true);
      expect(isCourierRoute('/courier/onboarding/identity')).toBe(true);
      expect(isCourierRoute('/courier/onboarding/vehicle')).toBe(true);
      expect(isCourierRoute('/courier/onboarding/status')).toBe(true);
    });

    it('impide el cruce de roles en onboarding: courier no accede a onboarding de comercio', () => {
      const courierSession: AuthSession = {
        userId: 'usr-courier',
        email: 'courier@test.com',
        role: 'courier',
        aal: 'aal1',
      };

      const result = evaluateRouteGuard('/merchant/onboarding', courierSession);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe(getRoleDefaultPath('courier'));
      }
    });

    it('impide el cruce de roles en onboarding: merchant no accede a onboarding de repartidor', () => {
      const merchantSession: AuthSession = {
        userId: 'usr-merchant',
        email: 'merchant@test.com',
        role: 'merchant',
        aal: 'aal1',
      };

      const result = evaluateRouteGuard('/courier/onboarding/identity', merchantSession);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe(getRoleDefaultPath('merchant'));
      }
    });
  });

  describe('DoD 4: Destinos de getRoleDefaultPath y Redirecciones de Registro', () => {
    it('getRoleDefaultPath("merchant") resuelve a la ruta canónica existente /merchant/dashboard', () => {
      const defaultPath = getRoleDefaultPath('merchant');
      expect(defaultPath).toBe('/merchant/dashboard');

      const dashboardPagePath = path.resolve(
        ROOT_DIR,
        'app/(merchant)/merchant/dashboard/page.tsx'
      );
      expect(
        fs.existsSync(dashboardPagePath),
        'El destino por defecto de merchant debe existir en el filesystem'
      ).toBe(true);
    });

    it('registerAction redirige a onboarding específico de cada rol para usuarios nuevos', async () => {
      const mockSignUp = vi.fn().mockImplementation(async ({ options }: { options?: { data?: { role?: string } } }) => ({
        data: { user: { id: 'usr-new-1', email: 'test@test.com' }, session: null },
        error: null,
      }));

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const merchantRes = await registerAction({
        email: 'comercio@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
      });

      expect(merchantRes.ok).toBe(true);
      if (merchantRes.ok) {
        expect(merchantRes.data.redirectTo).toBe('/merchant/onboarding');
      }

      const courierRes = await registerAction({
        email: 'courier@test.com',
        password: 'password123',
        role: 'courier',
        acceptTerms: true,
      });

      expect(courierRes.ok).toBe(true);
      if (courierRes.ok) {
        expect(courierRes.data.redirectTo).toBe('/courier/onboarding/identity');
      }
    });
  });

  describe('DoD 5: Integridad de Navegación y Shells (BottomNav / TopBar)', () => {
    it('merchant-nav.tsx define los 3 destinos canónicos de comercio', () => {
      const navPath = path.resolve(ROOT_DIR, 'app/(merchant)/merchant-nav.tsx');
      expect(fs.existsSync(navPath), 'Debe existir merchant-nav.tsx').toBe(true);
      const content = fs.readFileSync(navPath, 'utf-8');

      expect(content).toContain('/merchant/dashboard');
      expect(content).toContain('/merchant/history');
      expect(content).toContain('/merchant/plan');
    });

    it('courier-nav.tsx define los 3 destinos canónicos de repartidor incluyendo perfil R08', () => {
      const navPath = path.resolve(ROOT_DIR, 'app/(courier)/courier-nav.tsx');
      expect(fs.existsSync(navPath), 'Debe existir courier-nav.tsx').toBe(true);
      const content = fs.readFileSync(navPath, 'utf-8');

      expect(content).toContain('/courier/feed');
      expect(content).toContain('/courier/offers');
      expect(content).toContain('/courier/profile');
    });

    it('el layout de comercio src/app/(merchant)/layout.tsx define el contenedor centrado mobile-first', () => {
      const layoutPath = path.resolve(ROOT_DIR, 'app/(merchant)/layout.tsx');
      expect(fs.existsSync(layoutPath), 'Debe existir (merchant)/layout.tsx').toBe(true);
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toMatch(/max-w-\[390px\]/);
      expect(content).toMatch(/mx-auto/);
    });
  });

  describe('DoD 6: Prohibición de Datos Fantasma (D3, D6, D14, D15, S4)', () => {
    it('C08 (/merchant/plan/page.tsx) no debe contener menciones a AFIP, ARBA ni cobro de envíos', () => {
      const planPagePath = path.resolve(ROOT_DIR, 'app/(merchant)/merchant/plan/page.tsx');
      if (fs.existsSync(planPagePath)) {
        const content = fs.readFileSync(planPagePath, 'utf-8');
        expect(content).not.toMatch(/AFIP/i);
        expect(content).not.toMatch(/ARBA/i);
      } else {
        // Falla si el archivo no existe
        expect(fs.existsSync(planPagePath), 'C08 plan/page.tsx debe existir').toBe(true);
      }
    });

    it('R08 (/courier/profile/page.tsx) no debe solicitar CBU ni alias bancario', () => {
      const profilePagePath = path.resolve(ROOT_DIR, 'app/(courier)/courier/profile/page.tsx');
      if (fs.existsSync(profilePagePath)) {
        const content = fs.readFileSync(profilePagePath, 'utf-8');
        expect(content).not.toMatch(/CBU/i);
        expect(content).not.toMatch(/CVU/i);
        expect(content).not.toMatch(/alias bancario/i);
      } else {
        // Falla si el archivo no existe
        expect(fs.existsSync(profilePagePath), 'R08 profile/page.tsx debe existir').toBe(true);
      }
    });
  });
});
