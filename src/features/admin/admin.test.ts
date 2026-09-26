import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { evaluateRouteGuard, type AuthSession } from '@/features/auth';
import { ADMIN_NAV_TABS } from './constants';

describe('T-122: DoD - Admin Shell y Route Guard A00', () => {
  describe('1. Seguridad y MFA: sin aal2 no se entra', () => {
    it('evaluateRouteGuard redirige directamente a /login/mfa si el admin solo tiene aal1 en /admin/applicants', () => {
      const adminAal1Session: AuthSession = {
        userId: 'admin-uuid-1',
        email: 'admin@cadeapp.ar',
        role: 'admin',
        aal: 'aal1',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', adminAal1Session);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe('/login/mfa?redirectTo=%2Fadmin%2Fapplicants');
      }
    });

    it('evaluateRouteGuard permite el acceso a /admin/applicants si el admin tiene aal2', () => {
      const adminAal2Session: AuthSession = {
        userId: 'admin-uuid-1',
        email: 'admin@cadeapp.ar',
        role: 'admin',
        aal: 'aal2',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', adminAal2Session);
      expect(result.action).toBe('allow');
    });
  });

  describe('2. Control de rol: merchant/courier no atraviesan el shell admin', () => {
    it('evaluateRouteGuard bloquea a merchant redirigiéndolo a su panel', () => {
      const merchantSession: AuthSession = {
        userId: 'merchant-uuid',
        email: 'merchant@test.com',
        role: 'merchant',
        aal: 'aal1',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', merchantSession);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe('/merchant/dashboard');
      }
    });

    it('evaluateRouteGuard bloquea a courier redirigiéndolo a su feed', () => {
      const courierSession: AuthSession = {
        userId: 'courier-uuid',
        email: 'courier@test.com',
        role: 'courier',
        aal: 'aal1',
        consentStatus: 'active',
      };

      const result = evaluateRouteGuard('/admin/applicants', courierSession);
      expect(result.action).toBe('redirect');
      if (result.action === 'redirect') {
        expect(result.redirectTo).toBe('/courier/feed');
      }
    });
  });

  describe('3. Navegación Desktop A00: 5 pestañas canónicas sin Liquidaciones', () => {
    it('ADMIN_NAV_TABS contiene exactamente las 5 pestañas canónicas', () => {
      expect(ADMIN_NAV_TABS).toHaveLength(5);
      const labels = ADMIN_NAV_TABS.map((t) => t.label);
      expect(labels).toEqual([
        'Postulantes',
        'Comercios',
        'Incidentes',
        'Parámetros',
        'Auditoría',
      ]);
      const hrefs = ADMIN_NAV_TABS.map((t) => t.href);
      expect(hrefs).toEqual([
        '/admin/applicants',
        '/admin/merchants',
        '/admin/incidents',
        '/admin/settings',
        '/admin/audit',
      ]);
    });

    it('ADMIN_NAV_TABS no incluye ninguna solapa de Liquidaciones', () => {
      const labels = ADMIN_NAV_TABS.map((t) => t.label.toLowerCase());
      expect(labels).not.toContain('liquidaciones');
      expect(labels).not.toContain('settlements');
      const hrefs = ADMIN_NAV_TABS.map((t) => t.href.toLowerCase());
      expect(hrefs.some((h) => h.includes('liquidaciones') || h.includes('settlements'))).toBe(false);
    });
  });

  describe('4. PR106-H09: Control estático anti-12px (text-xs prohibido en todo el alcance admin)', () => {
    it('no contiene ninguna ocurrencia de text-xs en src/app/(admin) ni src/features/admin', () => {
      const rootDir = process.cwd();
      const targetDirs = [
        path.join(rootDir, 'src', 'app', '(admin)'),
        path.join(rootDir, 'src', 'features', 'admin'),
      ];

      function findFiles(dir: string): string[] {
        if (!fs.existsSync(dir)) return [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findFiles(fullPath));
          } else if (
            (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
            !entry.name.includes('.test.')
          ) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const filesToScan = targetDirs.flatMap(findFiles);
      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of filesToScan) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('text-xs')) {
            violations.push({
              file: path.relative(rootDir, file),
              line: idx + 1,
              text: line.trim(),
            });
          }
        });
      }

      expect(violations).toEqual([]);
    });
  });

  describe('5. PR106-H06: Adopción vinculante de primitivas shadcn CC-010', () => {
    it('MfaForm adopta InputOTP de @/ui/input-otp y no usa input manual', () => {
      const rootDir = process.cwd();
      const mfaFormPath = path.join(rootDir, 'src', 'features', 'admin', 'components', 'mfa-form.tsx');
      const content = fs.readFileSync(mfaFormPath, 'utf-8');

      expect(content).toContain("from '@/ui/input-otp'");
      expect(content).toContain('<InputOTP');
      expect(content).toContain('<InputOTPGroup');
      expect(content).toContain('<InputOTPSlot');
      expect(content).not.toContain('<input');
    });

    it('ApplicantsQueue adopta Table y Tabs oficiales y no usa primitivas manuales', () => {
      const rootDir = process.cwd();
      const queuePath = path.join(rootDir, 'src', 'features', 'admin', 'components', 'applicants-queue.tsx');
      const content = fs.readFileSync(queuePath, 'utf-8');

      expect(content).toContain("from '@/ui/table'");
      expect(content).toContain("from '@/ui/tabs'");
      expect(content).toContain('<Table');
      expect(content).toContain('<TableHeader');
      expect(content).toContain('<TableBody');
      expect(content).toContain('<TableRow');
      expect(content).toContain('<TableCell');
      expect(content).toContain('<Tabs');
      expect(content).toContain('<TabsList');
      expect(content).toContain('<TabsTrigger');
      expect(content).toContain('<TabsContent');
      // No debe usar tabla ni tabs manuales
      expect(content).not.toContain('<table className=');
      expect(content).not.toContain('role="tablist"');
    });
  });

  describe('6. PR106-H10: Botón Salir en AdminNav ejecuta logoutAction()', () => {
    it('AdminNav no usa form action="/login" estático sino logoutAction real', () => {
      const rootDir = process.cwd();
      const navPath = path.join(rootDir, 'src', 'app', '(admin)', 'admin-nav.tsx');
      const content = fs.readFileSync(navPath, 'utf-8');

      expect(content).not.toContain('action="/login"');
      expect(content).toMatch(/logoutAction/);
    });
  });

  describe('7. PR106-H16: Convenciones UI, tokens, skeletons y copy centralizado', () => {
    const rootDir = process.cwd();
    const adminDirs = [
      path.join(rootDir, 'src', 'app', '(admin)'),
      path.join(rootDir, 'src', 'features', 'admin'),
    ];

    function getAdminFiles(dirs: string[]): string[] {
      const files: string[] = [];
      for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...getAdminFiles([fullPath]));
          } else if (
            (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
            !entry.name.includes('.test.')
          ) {
            files.push(fullPath);
          }
        }
      }
      return files;
    }

    it('A. (admin)/layout.tsx no incluye Toaster duplicado', () => {
      const layoutPath = path.join(rootDir, 'src', 'app', '(admin)', 'layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');
      expect(content).not.toContain('<Toaster');
      expect(content).not.toContain('@/ui/toaster');
    });

    it('B. No existen colores fuera de tokens (hexadecimales arbitrarios, slate, amber) en admin', () => {
      const files = getAdminFiles(adminDirs);
      const forbiddenPattern = /(#[0-9a-fA-F]{3,6}|(?<![a-zA-Z0-9_-])(?:bg|text|border)-slate-(?:50|100|200|700|800)|(?<![a-zA-Z0-9_-])(?:bg|text|border)-amber-(?:50|200|600|900))/;
      const violations: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (forbiddenPattern.test(line)) {
            violations.push(`${path.relative(rootDir, file)}:${idx + 1}: ${line.trim()}`);
          }
        });
      }

      expect(violations).toEqual([]);
    });

    it('C. No existen medidas arbitrarias en corchetes ni transform inline en componentes admin', () => {
      const files = getAdminFiles(adminDirs);
      const forbiddenClassPattern = /(min-h-\[[^\]]+\]|max-h-\[[^\]]+\]|max-w-\[1280px\])/;
      const violations: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (forbiddenClassPattern.test(line)) {
            violations.push(`${path.relative(rootDir, file)}:${idx + 1}: ${line.trim()}`);
          }
          if (line.includes('style={{') && line.includes('transform')) {
            violations.push(`${path.relative(rootDir, file)}:${idx + 1}: inline transform`);
          }
        });
      }

      expect(violations).toEqual([]);
    });

    it('D. Los skeletons se exportan desde features/admin y las rutas loading no importan @/ui/skeleton directamente', async () => {
      const adminModule = await import('./index');
      expect(adminModule.ApplicantsQueueSkeleton).toBeDefined();
      expect(adminModule.ApplicantDetailSkeleton).toBeDefined();

      const loadingFiles = [
        path.join(rootDir, 'src', 'app', '(admin)', 'admin', 'applicants', 'loading.tsx'),
        path.join(rootDir, 'src', 'app', '(admin)', 'admin', 'applicants', '[id]', 'loading.tsx'),
      ];

      for (const lf of loadingFiles) {
        const content = fs.readFileSync(lf, 'utf-8');
        expect(content).not.toContain("from '@/ui/skeleton'");
        expect(content).toContain("from '@/features/admin'");
      }
    });

    it('E. Las fechas en componentes admin se formatean con formatDate de @/lib/format y no con toLocaleDateString/toLocaleString', () => {
      const files = getAdminFiles(adminDirs);
      const violations: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('.toLocaleDateString') || line.includes('.toLocaleString')) {
            violations.push(`${path.relative(rootDir, file)}:${idx + 1}: ${line.trim()}`);
          }
        });
      }

      expect(violations).toEqual([]);
    });

    it('F. copy.ts existe, centraliza los textos y está exportado en index.ts', () => {
      const copyPath = path.join(rootDir, 'src', 'features', 'admin', 'copy.ts');
      expect(fs.existsSync(copyPath)).toBe(true);

      const indexPath = path.join(rootDir, 'src', 'features', 'admin', 'index.ts');
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      expect(indexContent).toContain("from './copy'");
    });
  });
});


