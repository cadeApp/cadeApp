import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  evaluateRouteGuard,
  getRoleDefaultPath,
  isMerchantRoute,
  isCourierRoute,
  resolvePostLoginRedirect,
  registerAction,
  type AuthSession,
} from '@/features/auth';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const ROOT_DIR = path.resolve(__dirname, '..');

function resolveSegmentsInDir(baseDir: string, segments: string[]): string | null {
  let currentDir = baseDir;
  for (const seg of segments) {
    if (!fs.existsSync(currentDir)) return null;
    const exactChild = path.join(currentDir, seg);
    if (fs.existsSync(exactChild) && fs.statSync(exactChild).isDirectory()) {
      currentDir = exactChild;
      continue;
    }
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const dynamicChild = entries.find((e) => e.isDirectory() && /^\[.+\]$/.test(e.name));
    if (dynamicChild) {
      currentDir = path.join(currentDir, dynamicChild.name);
      continue;
    }
    return null;
  }
  const pageCandidate = path.join(currentDir, 'page.tsx');
  if (fs.existsSync(pageCandidate)) return pageCandidate;
  const routeCandidate = path.join(currentDir, 'route.ts');
  if (fs.existsSync(routeCandidate)) return routeCandidate;
  return null;
}

function resolveRouteToFilesystemPage(routePath: string): string | null {
  const clean = (routePath.split('?')[0] ?? '/').split('#')[0] ?? '/';
  if (clean === '/') {
    const p = path.join(ROOT_DIR, 'app/page.tsx');
    return fs.existsSync(p) ? p : null;
  }
  const segments = clean.split('/').filter(Boolean);
  const baseDirs = [
    path.join(ROOT_DIR, 'app'),
    path.join(ROOT_DIR, 'app/(public)'),
    path.join(ROOT_DIR, 'app/(merchant)'),
    path.join(ROOT_DIR, 'app/(courier)'),
    path.join(ROOT_DIR, 'app/(admin)'),
  ];
  for (const base of baseDirs) {
    const resolved = resolveSegmentsInDir(base, segments);
    if (resolved) return resolved;
  }
  // /trips/[id] es el destino contractual entre T-114 (my-offers-list.tsx, courier-panel.test.tsx:181) y T-115 (fuera de alcance en T-118.md §Fuera de alcance)
  if (segments.length === 2 && segments[0] === 'trips' && segments[1]) {
    return 'contract:T-115:/trips/[id]';
  }
  return null;
}

function walkProductionFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkProductionFiles(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      results.push(full);
    }
  }
  return results;
}

function getAllT118ScopeFiles(): string[] {
  const dirs = [
    path.join(ROOT_DIR, 'app/(public)'),
    path.join(ROOT_DIR, 'app/(merchant)'),
    path.join(ROOT_DIR, 'app/(courier)'),
    path.join(ROOT_DIR, 'features/auth'),
    path.join(ROOT_DIR, 'features/merchants'),
    path.join(ROOT_DIR, 'features/requests'),
    path.join(ROOT_DIR, 'features/offers/components'),
    path.join(ROOT_DIR, 'features/courier-onboarding'),
    path.join(ROOT_DIR, 'features/availability'),
  ];
  const files = new Set<string>([
    path.join(ROOT_DIR, 'app/page.tsx'),
    path.join(ROOT_DIR, 'app/(public)/layout.tsx'),
  ]);
  for (const d of dirs) {
    for (const f of walkProductionFiles(d)) {
      files.add(f);
    }
  }
  return Array.from(files);
}

function normalizeTemplateRoute(rawCandidate: string): string {
  return rawCandidate.replace(/\$\{[^}]+\}/g, '__dynamic_segment__');
}

function validateInternalRouteCandidate(rawCandidate: string, fileLabel: string): void {
  if (!rawCandidate || rawCandidate.startsWith('//')) return;
  const candidate = normalizeTemplateRoute(rawCandidate);
  if (candidate.startsWith('/brand/') || candidate.startsWith('/icons/')) {
    const publicAsset = path.resolve(ROOT_DIR, '..', 'public', candidate.slice(1));
    if (!fs.existsSync(publicAsset)) {
      throw new Error(`${fileLabel} enlaza a asset público inexistente: ${rawCandidate}`);
    }
    return;
  }
  const pageFile = resolveRouteToFilesystemPage(candidate);
  if (!pageFile) {
    throw new Error(
      `${fileLabel} referencia una ruta interna inexistente en el filesystem: ${rawCandidate}`
    );
  }
}

function assertNoInvalidInternalLinks(sourceCode: string, fileLabel: string): void {
  const patterns = [
    /\bhref\s*[:=]\s*(?:['"](\/[^'"]*)['"]|\{\s*`(\/[^`]*)`\s*\}|`(\/[^`]*)`)/g,
    /\bhref\s*=\s*\{\s*([a-zA-Z_$][\w$]*)\s*\([^}]*\)\s*\}/g,
    /\breturn\s+(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)/g,
    /\bredirectTo\s*:\s*(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)/g,
    /\bredirect\s*\(\s*(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`|([a-zA-Z_$][\w$.]*))\s*\)/g,
    /\brouter\.(?:push|replace)\s*\(\s*(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`|([^)]+))\s*\)/g,
  ];

  // 1) Direct route literals, template literals, nav object properties (href: '/...'), and helper returns (return `/...`)
  const directPatterns = [
    /\bhref\s*[:=]\s*(?:['"](\/[^'"]*)['"]|\{\s*`(\/[^`]*)`\s*\}|`(\/[^`]*)`)/g,
    /\breturn\s+(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)/g,
    /\bredirectTo\s*:\s*(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)/g,
    /\bredirect\s*\(\s*(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)\s*\)/g,
    /\brouter\.(?:push|replace)\s*\(\s*(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)\s*\)/g,
  ];

  for (const regex of directPatterns) {
    let match: RegExpExecArray | null = regex.exec(sourceCode);
    while (match !== null) {
      const rawCandidate = match[1] ?? match[2] ?? match[3];
      if (rawCandidate) {
        validateInternalRouteCandidate(rawCandidate, fileLabel);
      }
      match = regex.exec(sourceCode);
    }
  }

  // 2) Indirect JSX helper calls: href={helperName(...)}
  const helperCallRegex = patterns[1]!;
  helperCallRegex.lastIndex = 0;
  let helperMatch: RegExpExecArray | null = helperCallRegex.exec(sourceCode);
  while (helperMatch !== null) {
    const helperName = helperMatch[1];
    if (helperName) {
      const helperDefRegex = new RegExp(
        `(?:function\\s+${helperName}|(?:const|let|var)\\s+${helperName}\\s*=)[\\s\\S]*?return\\s+(?:['"](\\/[^'"]*)['"]|\`(\\/[^\`]*)\`)`
      );
      const defMatch = helperDefRegex.exec(sourceCode);
      const returnedRoute = defMatch?.[1] ?? defMatch?.[2];
      if (!returnedRoute) {
        throw new Error(
          `${fileLabel} invoca helper de ruta sin destino interno verificable (inexistente): ${helperName}`
        );
      }
      validateInternalRouteCandidate(returnedRoute, fileLabel);
    }
    helperMatch = helperCallRegex.exec(sourceCode);
  }

  // 3) Indirect router.push / router.replace expressions: router.push(targetUrl) / router.push(result.data.redirectTo)
  const routerCallRegex = patterns[5]!;
  routerCallRegex.lastIndex = 0;
  let routerMatch: RegExpExecArray | null = routerCallRegex.exec(sourceCode);
  while (routerMatch !== null) {
    const indirectExpr = routerMatch[3]?.trim();
    if (indirectExpr) {
      // Check any fallback string/template literal inside the expression (e.g. || '/courier/onboarding/status')
      const fallbackMatch = /(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)/.exec(indirectExpr);
      const fallbackRoute = fallbackMatch?.[1] ?? fallbackMatch?.[2];
      if (fallbackRoute) {
        validateInternalRouteCandidate(fallbackRoute, fileLabel);
      }

      if (/^[a-zA-Z_$][\w$]*$/.test(indirectExpr)) {
        const varDefRegex = new RegExp(`(?:const|let|var)\\s+${indirectExpr}\\s*=\\s*([^;\\n]+)`);
        const varDefMatch = varDefRegex.exec(sourceCode);
        const rhs = varDefMatch?.[1]?.trim();
        if (!rhs) {
          throw new Error(
            `${fileLabel} navega a variable sin ruta interna verificable (inexistente): ${indirectExpr}`
          );
        }
        const literalRhs = /^(?:['"](\/[^'"]*)['"]|`(\/[^`]*)`)/.exec(rhs);
        const assignedRoute = literalRhs?.[1] ?? literalRhs?.[2];
        if (assignedRoute) {
          validateInternalRouteCandidate(assignedRoute, fileLabel);
        } else if (rhs.includes('resolvePostLoginRedirect(')) {
          validateInternalRouteCandidate(resolvePostLoginRedirect('/ghost', 'merchant', 'active'), fileLabel);
          validateInternalRouteCandidate(resolvePostLoginRedirect('/ghost', 'courier', 'active'), fileLabel);
        } else {
          throw new Error(
            `${fileLabel} asigna ruta interna inexistente o no verificable a ${indirectExpr}: ${rhs}`
          );
        }
      } else if (indirectExpr.includes('.redirectTo')) {
        const actionProducerMap: ReadonlyArray<readonly [string, string]> = [
          ['registerAction', 'features/auth/actions.ts'],
          ['merchantOnboardingAction', 'features/merchants/actions.ts'],
          ['createDeliveryRequestAction', 'features/requests/actions.ts'],
          ['courierOnboardingAction', 'features/courier-onboarding/actions.ts'],
        ];
        const matchedProducer = actionProducerMap.find(([actionName]) =>
          sourceCode.includes(actionName)
        );
        if (!matchedProducer) {
          throw new Error(
            `${fileLabel} navega a redirectTo indirecto sin productor verificable (inexistente): ${indirectExpr}`
          );
        }
        const actionFilePath = path.join(ROOT_DIR, matchedProducer[1]);
        const actionContent = fs.readFileSync(actionFilePath, 'utf-8');
        assertNoInvalidInternalLinks(actionContent, matchedProducer[1]);
      }
    }
    routerMatch = routerCallRegex.exec(sourceCode);
  }
}

function assertNoTextXs(sourceCode: string, fileLabel: string): void {
  if (/\btext-xs\b/.test(sourceCode)) {
    throw new Error(`${fileLabel} viola el piso tipográfico de 14px usando text-xs`);
  }
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
        consentStatus: 'active',
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
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/courier/onboarding/identity', merchantSession);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe(getRoleDefaultPath('merchant'));
      }
    });
  });

  describe('DoD 4: Destinos de getRoleDefaultPath, enlaces y Redirecciones en TODO el alcance T-118 (PR87-H01, H09)', () => {
    it('getRoleDefaultPath y evaluateRouteGuard para merchant, courier y admin resuelven únicamente a rutas existentes en el filesystem', () => {
      const merchantPath = getRoleDefaultPath('merchant');
      const courierPath = getRoleDefaultPath('courier');
      const adminPath = getRoleDefaultPath('admin');

      expect(merchantPath).toBe('/merchant/dashboard');
      expect(courierPath).toBe('/courier/feed');
      expect(adminPath).toBe('/');
      expect(resolveRouteToFilesystemPage(merchantPath)).not.toBeNull();
      expect(resolveRouteToFilesystemPage(courierPath)).not.toBeNull();
      expect(resolveRouteToFilesystemPage(adminPath)).not.toBeNull();

      const adminAal1: AuthSession = {
        userId: 'adm-1',
        email: 'adm@cade.app',
        role: 'admin',
        aal: 'aal1',
        consentStatus: 'active',
      };
      const guardResult = evaluateRouteGuard('/admin/settings', adminAal1);
      expect(guardResult.action).toBe('redirect');
      if (guardResult.action === 'redirect') {
        expect(guardResult.redirectTo).not.toBe('/admin');
        expect(guardResult.redirectTo).not.toBe('/admin/mfa');
        expect(resolveRouteToFilesystemPage(guardResult.redirectTo)).not.toBeNull();
      }

      for (const probe of [
        '/ruta-inexistente',
        '/ghost',
        '/terms',
        '/privacy',
        '/pilot-terms',
        '/legal',
      ]) {
        const merchantTarget = resolvePostLoginRedirect(probe, 'merchant', 'active');
        const courierTarget = resolvePostLoginRedirect(probe, 'courier', 'active');
        expect(resolveRouteToFilesystemPage(merchantTarget)).not.toBeNull();
        expect(resolveRouteToFilesystemPage(courierTarget)).not.toBeNull();
      }
    });

    it('incluye src/app/(public)/layout.tsx en la auditoría y enlaza documentos legales publicados sin destinos rotos', () => {
      const publicLayoutPath = path.join(ROOT_DIR, 'app/(public)/layout.tsx');
      const publicLayoutContent = fs.readFileSync(publicLayoutPath, 'utf-8');
      expect(publicLayoutContent).toContain('/legal/terms');
      expect(publicLayoutContent).toContain('/legal/privacy');
      expect(publicLayoutContent).toContain('/legal/courier');
      expect(publicLayoutContent).toContain('/legal/pilot');

      const allScopeFiles = getAllT118ScopeFiles();
      expect(allScopeFiles).toContain(publicLayoutPath);

      for (const fullPath of allScopeFiles) {
        const rel = path.relative(path.resolve(ROOT_DIR, '..'), fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf-8');
        expect(() => assertNoInvalidInternalLinks(content, rel)).not.toThrow();
      }
    });

    it('detecta mutaciones inválidas de href o redirectTo hacia cualquier ruta interna inexistente como /ghost o /ruta-inexistente (PR87-H09)', () => {
      expect(() =>
        assertNoInvalidInternalLinks('<Link href="/terms">Términos</Link>', 'mutated-layout.tsx')
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks('<Link href="/ghost">Fantasma</Link>', 'mutated-ghost.tsx')
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          '<Link href="/ruta-inexistente">No existe</Link>',
          'mutated-nonexistent.tsx'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          "return { action: 'redirect', redirectTo: '/ghost' };",
          'mutated-guards.ts'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          '<Link href={`/ghost/${id}`}>Fantasma dinámico</Link>',
          'mutated-template-href.tsx'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks('router.push(`/ghost/${id}`);', 'mutated-template-router.tsx')
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          'return { redirectTo: `/ghost/${id}` };',
          'mutated-template-redirectTo.ts'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks('redirect(`/ghost/${id}`);', 'mutated-template-redirect.ts')
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          '<Link href={`/merchant/requests/${req.id}`}>Detalle válido</Link>',
          'valid-template-href.tsx'
        )
      ).not.toThrow();
      expect(() =>
        assertNoInvalidInternalLinks(
          "return { action: 'redirect', redirectTo: '/admin/mfa' };",
          'mutated-guards.ts'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          "const navItems = [{ label: 'Solicitudes', href: '/merchant/dashboard' }, { label: 'Ghost', href: '/ghost' }];",
          'mutated-merchant-nav.tsx'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          '<Link href={buildNextCursorHref(nextCursor)}>Siguiente</Link>',
          'mutated-orphan-helper-call.tsx'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          'const buildNextCursorHref = () => `/ghost?${params.toString()}`; <Link href={buildNextCursorHref(nextCursor)}>Siguiente</Link>',
          'mutated-helper-return.tsx'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          "const targetUrl = '/ghost'; router.push(targetUrl);",
          'mutated-router-variable.tsx'
        )
      ).toThrow(/inexistente/);
      expect(() =>
        assertNoInvalidInternalLinks(
          'router.push(targetUrl);',
          'mutated-unverified-router-variable.tsx'
        )
      ).toThrow(/inexistente/);
    });

    it('registerAction redirige a onboarding específico de cada rol para usuarios nuevos', async () => {
      const mockInsertConsents = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({ insert: mockInsertConsents }),
        rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

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
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
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
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });

      expect(courierRes.ok).toBe(true);
      if (courierRes.ok) {
        expect(courierRes.data.redirectTo).toBe('/courier/onboarding/identity');
      }
    });
  });

  describe('DoD 5: Integridad de Navegación, 0 text-xs en TODO el alcance T-118 y buttonVariants válidos (PR87-H07, H08, H15)', () => {
    it('merchant-nav.tsx y courier-nav.tsx definen exactamente los 3 destinos canónicos de cada rol sin rutas extra', () => {
      const extractObjectHrefs = (code: string): string[] => {
        const regex = /\bhref\s*:\s*(?:['"]([^'"]+)['"]|`([^`]+)`)/g;
        const found: string[] = [];
        let m: RegExpExecArray | null = regex.exec(code);
        while (m !== null) {
          const href = m[1] ?? m[2];
          if (href) found.push(href);
          m = regex.exec(code);
        }
        return found;
      };

      const merchantNav = fs.readFileSync(
        path.resolve(ROOT_DIR, 'app/(merchant)/merchant-nav.tsx'),
        'utf-8'
      );
      const merchantHrefs = extractObjectHrefs(merchantNav);
      expect(merchantHrefs).toEqual(['/merchant/dashboard', '/merchant/history', '/merchant/plan']);
      for (const href of merchantHrefs) {
        expect(resolveRouteToFilesystemPage(href)).not.toBeNull();
      }

      const courierNav = fs.readFileSync(
        path.resolve(ROOT_DIR, 'app/(courier)/courier-nav.tsx'),
        'utf-8'
      );
      const courierHrefs = extractObjectHrefs(courierNav);
      expect(courierHrefs).toEqual(['/courier/feed', '/courier/offers', '/courier/profile']);
      for (const href of courierHrefs) {
        expect(resolveRouteToFilesystemPage(href)).not.toBeNull();
      }
    });

    it('0 ocurrencias de text-xs y 0 usos de variant: "primary" en TODO el alcance de T-118', () => {
      const allScopeFiles = getAllT118ScopeFiles();
      for (const fullPath of allScopeFiles) {
        const rel = path.relative(path.resolve(ROOT_DIR, '..'), fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf-8');
        expect(() => assertNoTextXs(content, rel)).not.toThrow();
        expect(content, `${rel} no debe invocar variant: 'primary'`).not.toMatch(
          /variant:\s*['"]primary['"]/
        );
      }

      expect(() => assertNoTextXs('<p className="text-xs">12px</p>', 'mutated.tsx')).toThrow(
        /text-xs/
      );
    });
  });

  describe('DoD 6: Esquema real de DB, Prohibición de Datos Fantasma y Paginación (PR87-H02, H03, H04, H05, H14)', () => {
    it('MerchantDashboardPage (/merchant/dashboard/page.tsx) consulta profile_id, business_name en lugar de columnas inexistentes id, name (PR87-H14)', () => {
      const dashboardPage = fs.readFileSync(
        path.resolve(ROOT_DIR, 'app/(merchant)/merchant/dashboard/page.tsx'),
        'utf-8'
      );
      expect(dashboardPage).toContain(".select('profile_id, business_name')");
      expect(dashboardPage).not.toContain(".select('id, name')");
    });

    it('C08 (/merchant/plan/page.tsx + queries.ts + copy.ts) usa el enum real merchant_subscription_status (pilot|active|expired|cancelled) y no contiene AFIP/ARBA ni trial fantasma', () => {
      const planPage = fs.readFileSync(
        path.resolve(ROOT_DIR, 'app/(merchant)/merchant/plan/page.tsx'),
        'utf-8'
      );
      const merchantQueries = fs.readFileSync(
        path.resolve(ROOT_DIR, 'features/merchants/queries.ts'),
        'utf-8'
      );
      const merchantCopy = fs.readFileSync(
        path.resolve(ROOT_DIR, 'features/merchants/copy.ts'),
        'utf-8'
      );
      const combined = `${planPage}\n${merchantQueries}\n${merchantCopy}`;

      expect(combined).not.toMatch(/AFIP/i);
      expect(combined).not.toMatch(/ARBA/i);
      expect(merchantQueries).toContain('subscription_status');
      expect(merchantQueries).toContain('paid_until');
      expect(merchantCopy).toContain("case 'pilot':");
      expect(merchantCopy).toContain("case 'active':");
      expect(merchantCopy).toContain("case 'expired':");
      expect(merchantCopy).toContain("case 'cancelled':");
    });

    it('R08 (/courier/profile/page.tsx + CourierProfileView) usa el enum real document_review_status (none|submitted|verified|rejected) y no solicita CBU/CVU/alias', () => {
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
      expect(profileLeaf).toContain("case 'submitted':");
      expect(profileLeaf).toContain("case 'verified':");
      expect(profileLeaf).toContain("case 'rejected':");
      expect(profileLeaf).toContain("case 'none':");
    });

    it('C07 (src/features/requests/queries.ts) filtra por estado antes de paginar, valida cursor con Zod y no inventa $0 ni distancias', () => {
      const requestsQueries = fs.readFileSync(
        path.resolve(ROOT_DIR, 'features/requests/queries.ts'),
        'utf-8'
      );

      expect(requestsQueries).not.toContain("return '1,0'");
      expect(requestsQueries).not.toContain("?? 'Centro'");
      expect(requestsQueries).not.toContain("?? 'Aguilares'");
      expect(requestsQueries).toContain('merchantHistoryCursorSchema');
      expect(requestsQueries).toContain('getMerchantHistoryRequests');
      expect(requestsQueries).toContain('avgRateArs: number | null = null');
    });

    it('PR106-H01: El filesystem publica las rutas canónicas del panel admin (/admin/applicants, /admin/applicants/[id], /admin/couriers)', () => {
      const canonicalAdminRoutes = [
        '/admin/applicants',
        '/admin/applicants/test-id',
        '/admin/couriers',
      ];
      for (const route of canonicalAdminRoutes) {
        const resolved = resolveRouteToFilesystemPage(route);
        expect(resolved, `La ruta canónica ${route} debe resolver a un archivo de página en el filesystem`).not.toBeNull();
      }
    });
  });
});
