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

function resolveRouteToFilesystemPage(routePath: string): string | null {
  const clean = routePath.split('?')[0] ?? '/';
  if (clean === '/') {
    const p = path.join(ROOT_DIR, 'app/page.tsx');
    return fs.existsSync(p) ? p : null;
  }
  const candidates = [
    path.join(ROOT_DIR, 'app', clean, 'page.tsx'),
    path.join(ROOT_DIR, 'app/(public)', clean, 'page.tsx'),
    path.join(ROOT_DIR, 'app/(merchant)', clean, 'page.tsx'),
    path.join(ROOT_DIR, 'app/(courier)', clean, 'page.tsx'),
    path.join(ROOT_DIR, 'app/(admin)', clean, 'page.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

describe('T-118: Integridad de Rutas, Shells y Navegación Canónica', () => {
  describe('DoD 1: P01 Landing pública de inicio (src/app/page.tsx)', () => {
    it('no debe contener el placeholder de Fase 0 (T-000) y debe implementar la landing P01 de Aguilares', () => {
      const pagePath = path.join(ROOT_DIR, 'app/page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).not.toContain('Fase 0 · Scaffold mínimo operativo (T-000)');
      expect(content).toMatch(/Aguilares/i);
      expect(content).toMatch(/¿Quién paga el envío\?/i);
      expect(content).toMatch(/Lo paga quien recibe/i);
      expect(content).toMatch(/Tengo un comercio/i);
      expect(content).toMatch(/Quiero repartir/i);
    });
  });

  describe('DoD 2: Existencia de Rutas Canónicas y Boundaries loading/error (PR87-H06)', () => {
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

      // Boundaries loading.tsx y error.tsx en segmentos canónicos con datos (PR87-H06)
      'src/app/(merchant)/merchant/onboarding/loading.tsx',
      'src/app/(merchant)/merchant/onboarding/error.tsx',
      'src/app/(merchant)/merchant/dashboard/loading.tsx',
      'src/app/(merchant)/merchant/dashboard/error.tsx',
      'src/app/(merchant)/merchant/requests/new/loading.tsx',
      'src/app/(merchant)/merchant/requests/new/error.tsx',
      'src/app/(merchant)/merchant/requests/[id]/loading.tsx',
      'src/app/(merchant)/merchant/requests/[id]/error.tsx',
      'src/app/(merchant)/merchant/history/loading.tsx',
      'src/app/(merchant)/merchant/history/error.tsx',
      'src/app/(merchant)/merchant/plan/loading.tsx',
      'src/app/(merchant)/merchant/plan/error.tsx',
      'src/app/(courier)/courier/onboarding/status/loading.tsx',
      'src/app/(courier)/courier/onboarding/status/error.tsx',
      'src/app/(courier)/courier/feed/loading.tsx',
      'src/app/(courier)/courier/feed/error.tsx',
      'src/app/(courier)/courier/offers/loading.tsx',
      'src/app/(courier)/courier/offers/error.tsx',
      'src/app/(courier)/courier/profile/loading.tsx',
      'src/app/(courier)/courier/profile/error.tsx',
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

  describe('DoD 4: Destinos de getRoleDefaultPath, enlaces y Redirecciones (PR87-H01)', () => {
    it('getRoleDefaultPath para merchant, courier y admin resuelve únicamente a rutas existentes en el filesystem', () => {
      const merchantPath = getRoleDefaultPath('merchant');
      const courierPath = getRoleDefaultPath('courier');
      const adminPath = getRoleDefaultPath('admin');

      expect(merchantPath).toBe('/merchant/dashboard');
      expect(courierPath).toBe('/courier/feed');
      expect(resolveRouteToFilesystemPage(merchantPath)).not.toBeNull();
      expect(resolveRouteToFilesystemPage(courierPath)).not.toBeNull();
      expect(resolveRouteToFilesystemPage(adminPath)).not.toBeNull();
    });

    it('no emite enlaces rotos hacia /admin, /terms ni /privacy en las vistas auditadas', () => {
      const auditedFiles = [
        'src/app/page.tsx',
        'src/features/auth/components/register-form.tsx',
        'src/app/(merchant)/merchant/plan/page.tsx',
        'src/features/courier-onboarding/components/courier-profile-view.tsx',
      ];

      for (const rel of auditedFiles) {
        const content = fs.readFileSync(path.resolve(ROOT_DIR, '..', rel), 'utf-8');
        expect(content, `${rel} no debe enlazar a /terms inexistente`).not.toContain('href="/terms"');
        expect(content, `${rel} no debe enlazar a /privacy inexistente`).not.toContain('href="/privacy"');
      }
    });

    it('registerAction redirige a onboarding específico de cada rol para usuarios nuevos', async () => {
      const mockSignUp = vi.fn().mockImplementation(async () => ({
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

  describe('DoD 5: Integridad de Navegación, Tipografía >=14px y Targets >=48px (PR87-H07, PR87-H08)', () => {
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

    it('respeta piso tipográfico de 14px (sin text-xs), targets >=48px y ausencia de CSS/hex arbitrarios en vistas auditadas', () => {
      const auditedViews = [
        'src/app/(merchant)/layout.tsx',
        'src/app/(courier)/layout.tsx',
        'src/app/(merchant)/merchant/plan/page.tsx',
        'src/features/courier-onboarding/components/courier-profile-view.tsx',
        'src/features/requests/components/merchant-history-view.tsx',
      ];

      for (const rel of auditedViews) {
        const content = fs.readFileSync(path.resolve(ROOT_DIR, '..', rel), 'utf-8');
        expect(content, `${rel} no debe usar text-xs`).not.toMatch(/\btext-xs\b/);
        expect(content, `${rel} no debe usar switch h-7 w-12`).not.toMatch(/h-7 w-12/);
        expect(content, `${rel} no debe usar tabs min-h-10`).not.toMatch(/min-h-10/);
        expect(content, `${rel} no debe inyectar <style>`).not.toMatch(/<style>/);
        expect(content, `${rel} no debe usar hex arbitrario #25D366`).not.toMatch(/#25D366/i);
      }
    });
  });

  describe('DoD 6: Prohibición de Datos Fantasma y Paginación en Unidades Reales (PR87-H02, H03, H04, H05, H09)', () => {
    it('C08 (/merchant/plan/page.tsx + queries.ts) lee subscription_status/paid_until y no contiene AFIP, ARBA ni estados fijos fantasma', () => {
      const planPage = fs.readFileSync(
        path.resolve(ROOT_DIR, 'app/(merchant)/merchant/plan/page.tsx'),
        'utf-8'
      );
      const merchantQueries = fs.readFileSync(
        path.resolve(ROOT_DIR, 'features/merchants/queries.ts'),
        'utf-8'
      );
      const combined = `${planPage}\n${merchantQueries}`;

      expect(combined).not.toMatch(/AFIP/i);
      expect(combined).not.toMatch(/ARBA/i);
      expect(planPage).not.toMatch(/Piloto activo|piloto gratis/i);
      expect(merchantQueries).toContain('subscription_status');
      expect(merchantQueries).toContain('paid_until');
    });

    it('R08 (/courier/profile/page.tsx + CourierProfileView) no solicita CBU/CVU/alias ni fabrica estados moto/approved/Verificado fijos', () => {
      const profilePage = fs.readFileSync(
        path.resolve(ROOT_DIR, 'app/(courier)/courier/profile/page.tsx'),
        'utf-8'
      );
      const profileLeaf = fs.readFileSync(
        path.resolve(ROOT_DIR, 'features/courier-onboarding/components/courier-profile-view.tsx'),
        'utf-8'
      );
      const combined = `${profilePage}\n${profileLeaf}`;

      expect(combined).not.toMatch(/CBU/i);
      expect(combined).not.toMatch(/CVU/i);
      expect(combined).not.toMatch(/alias bancario/i);
      expect(combined).not.toMatch(/\|\|\s*'moto'/);
      expect(combined).not.toMatch(/\|\|\s*'approved'/);
      expect(combined).not.toMatch(/Aprobado|Verificad/);
    });

    it('C07 (src/features/requests/queries.ts) pagina a máximo 50 con cursor y no fabrica 1,0 km ni Centro/Aguilares ante datos ausentes', () => {
      const requestsQueries = fs.readFileSync(
        path.resolve(ROOT_DIR, 'features/requests/queries.ts'),
        'utf-8'
      );

      expect(requestsQueries).not.toContain("return '1,0'");
      expect(requestsQueries).not.toContain("?? 'Centro'");
      expect(requestsQueries).not.toContain("?? 'Aguilares'");
      expect(requestsQueries).toMatch(/\.limit\(/);
      expect(requestsQueries).toContain('nextCursor');
    });
  });
});
