import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const rootDir = process.cwd();
const adminAppDir = path.join(rootDir, 'src', 'app', '(admin)');
const adminFeatureDir = path.join(rootDir, 'src', 'features', 'admin');

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function scan(files: readonly string[], pattern: RegExp): string[] {
  const violations: string[] = [];
  for (const file of files) {
    fs.readFileSync(file, 'utf-8')
      .split('\n')
      .forEach((line, index) => {
        if (pattern.test(line)) {
          violations.push(`${path.relative(rootDir, file)}:${index + 1}: ${line.trim()}`);
        }
      });
  }
  return violations;
}

const T123_SEGMENTS = ['merchants', 'settings', 'audit'] as const;

describe('T-123 DoD: vistas A03/A04/A06 publicadas bajo /admin/* (D01)', () => {
  it.each(T123_SEGMENTS)('existe page, loading y error para /admin/%s', (segment) => {
    const routeDir = path.join(adminAppDir, 'admin', segment);
    for (const file of ['page.tsx', 'loading.tsx', 'error.tsx']) {
      expect(fs.existsSync(path.join(routeDir, file)), `${segment}/${file}`).toBe(true);
    }
  });

  it.each(T123_SEGMENTS)('/admin/%s reutiliza el shell de T-122 y no declara layout propio', (segment) => {
    expect(fs.existsSync(path.join(adminAppDir, 'admin', segment, 'layout.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(adminAppDir, 'layout.tsx'))).toBe(true);
  });

  it.each(T123_SEGMENTS)(
    '/admin/%s es Server Component y lee datos solo desde @/features/admin/server',
    (segment) => {
      const page = fs.readFileSync(path.join(adminAppDir, 'admin', segment, 'page.tsx'), 'utf-8');
      expect(page).not.toMatch(/['"]use client['"]/);
      expect(page).toContain("from '@/features/admin/server'");
      expect(page).not.toMatch(/@\/server\//);
    }
  );

  it('no se publican rutas sueltas /merchants, /settings ni /audit fuera de /admin', () => {
    for (const segment of T123_SEGMENTS) {
      expect(fs.existsSync(path.join(adminAppDir, segment, 'page.tsx')), segment).toBe(false);
    }
  });

  it('los loading de A03/A04/A06 usan skeletons de la feature, no @/ui/skeleton directo', () => {
    for (const segment of T123_SEGMENTS) {
      const loading = fs.readFileSync(
        path.join(adminAppDir, 'admin', segment, 'loading.tsx'),
        'utf-8'
      );
      expect(loading).not.toContain("from '@/ui/skeleton'");
      expect(loading).toContain("from '@/features/admin'");
    }
  });
});

describe('T-123 DoD: sin CUIT ni Liquidaciones', () => {
  it('ningún archivo del admin (vistas, types, schemas, copy) menciona CUIT', () => {
    const files = [...collectSourceFiles(adminAppDir), ...collectSourceFiles(adminFeatureDir)];
    expect(scan(files, /cuit/i)).toEqual([]);
  });

  it('no existe ruta ni vista de Liquidaciones/settlements en src/app ni en la feature admin', () => {
    const files = [
      ...collectSourceFiles(path.join(rootDir, 'src', 'app')),
      ...collectSourceFiles(adminFeatureDir),
    ];
    expect(scan(files, /liquidaci[oó]n|settlement/i)).toEqual([]);

    const routeDirs: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        routeDirs.push(entry.name);
        walk(path.join(dir, entry.name));
      }
    };
    walk(path.join(rootDir, 'src', 'app'));
    expect(routeDirs.filter((name) => /liquidac|settlement|payout/i.test(name))).toEqual([]);
  });
});

describe('T-123 DoD: las mutaciones solo pasan por RPC auditadas (D02)', () => {
  const adminFiles = () => [
    ...collectSourceFiles(adminAppDir),
    ...collectSourceFiles(adminFeatureDir),
  ];

  it('la feature no escribe merchants ni platform_settings directo', () => {
    const content = adminFiles()
      .map((file) => fs.readFileSync(file, 'utf-8'))
      .join('\n');
    expect(content).not.toMatch(
      /from\(\s*['"](?:merchants|platform_settings)['"]\s*\)\s*\.(?:insert|update|upsert|delete)\(/
    );
  });

  it('la feature nunca modifica ni borra filas de audit_log', () => {
    const content = adminFiles()
      .map((file) => fs.readFileSync(file, 'utf-8'))
      .join('\n');
    expect(content).not.toMatch(/from\(\s*['"]audit_log['"]\s*\)\s*\.(?:update|upsert|delete)\(/);
  });

  it('actions.ts usa los wrappers adminSetSubscriptionRpc y adminUpdateSettingRpc', () => {
    const actions = fs.readFileSync(path.join(adminFeatureDir, 'actions.ts'), 'utf-8');
    expect(actions).toMatch(/adminSetSubscriptionRpc\(/);
    expect(actions).toMatch(/adminUpdateSettingRpc\(/);
  });

  it('A06 no promete inmutabilidad que la base todavía no garantiza', () => {
    const content = adminFiles()
      .map((file) => fs.readFileSync(file, 'utf-8'))
      .join('\n');
    expect(content).not.toMatch(/no se puede (?:editar|modificar) ni borrar|WORM|SHA-256/i);
  });
});

describe('T-123 DoD: A04 carga parámetros y «Últimos cambios» server-side (D04, PR112-H02)', () => {
  const settingsPage = path.join(adminAppDir, 'admin', 'settings', 'page.tsx');

  it('/admin/settings existe', () => {
    expect(fs.existsSync(settingsPage)).toBe(true);
  });

  it('/admin/settings importa las queries desde @/features/admin/server y el panel desde @/features/admin', () => {
    const page = fs.readFileSync(settingsPage, 'utf-8');
    expect(page).toMatch(
      /import\s*\{[^}]*\bgetPlatformSettings\b[^}]*\}\s*from\s*'@\/features\/admin\/server'/
    );
    expect(page).toMatch(
      /import\s*\{[^}]*\bgetRecentSettingChanges\b[^}]*\}\s*from\s*'@\/features\/admin\/server'/
    );
    expect(page).toMatch(
      /import\s*\{[^}]*\bRecentSettingChanges\b[^}]*\}\s*from\s*'@\/features\/admin'/
    );
  });

  it('/admin/settings invoca ambas queries y renderiza RecentSettingChanges', () => {
    const page = fs.readFileSync(settingsPage, 'utf-8');
    expect(page).toMatch(/getPlatformSettings\s*\(/);
    expect(page).toMatch(/getRecentSettingChanges\s*\(/);
    expect(page).toMatch(/<RecentSettingChanges/);
  });
});

describe('T-123 DoD: parámetros sin valores de negocio hardcodeados', () => {
  it('las vistas de parámetros no hardcodean el piso de oferta (1000 / 1.000)', () => {
    const files = [
      ...collectSourceFiles(path.join(adminAppDir, 'admin', 'settings')),
      path.join(adminFeatureDir, 'components', 'platform-settings-form.tsx'),
    ].filter((file) => fs.existsSync(file));
    expect(files.length).toBeGreaterThan(1);
    expect(scan(files, /\b1\.?000\b/)).toEqual([]);
  });
});
