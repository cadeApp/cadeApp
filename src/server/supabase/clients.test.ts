import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createClient as createServerClient } from './server';
import { createClient as createBrowserClient } from '@/lib/supabase/browser';
import { createAdminClient } from './admin';

describe('T-002: DoD - Clientes de Supabase y Configuración', () => {
  describe('DoD 1: Existencia e interfaz de los clientes de Supabase', () => {
    it('debe existir src/server/supabase/server.ts y exportar createClient', () => {
      const serverFile = path.resolve('src/server/supabase/server.ts');
      expect(fs.existsSync(serverFile), 'src/server/supabase/server.ts no existe').toBe(true);
      expect(typeof createServerClient).toBe('function');
    });

    it('debe existir src/lib/supabase/browser.ts y exportar createClient (H01)', () => {
      const browserFile = path.resolve('src/lib/supabase/browser.ts');
      expect(fs.existsSync(browserFile), 'src/lib/supabase/browser.ts no existe').toBe(true);
      expect(typeof createBrowserClient).toBe('function');
    });

    it('debe existir src/server/supabase/admin.ts y exportar createAdminClient', () => {
      const adminFile = path.resolve('src/server/supabase/admin.ts');
      expect(fs.existsSync(adminFile), 'src/server/supabase/admin.ts no existe').toBe(true);
      expect(typeof createAdminClient).toBe('function');
    });
  });

  describe('DoD 2: Seguridad y server-only en clientes de servidor', () => {
    it('src/server/supabase/admin.ts debe incluir obligatoriamente import "server-only"', () => {
      const adminFile = path.resolve('src/server/supabase/admin.ts');
      expect(fs.existsSync(adminFile), 'src/server/supabase/admin.ts no existe').toBe(true);
      const content = fs.readFileSync(adminFile, 'utf-8');
      expect(content).toMatch(/import\s+['"]server-only['"]/);
    });

    it('src/server/supabase/server.ts debe incluir obligatoriamente import "server-only" (H02)', () => {
      const serverFile = path.resolve('src/server/supabase/server.ts');
      expect(fs.existsSync(serverFile), 'src/server/supabase/server.ts no existe').toBe(true);
      const content = fs.readFileSync(serverFile, 'utf-8');
      expect(content).toMatch(/import\s+['"]server-only['"]/);
    });

    it('no hay claves reales en el repo (barrido integral H05)', () => {
      function getFiles(dir: string, list: string[] = []): string[] {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === '.next' ||
            entry.name === '.codegraph' ||
            entry.name === 'coverage' ||
            relPath.startsWith('scratch') ||
            relPath.startsWith('.' + 'env') ||
            entry.name.startsWith('.' + 'env') ||
            relPath.endsWith('.png') ||
            relPath.endsWith('.jpg') ||
            relPath.endsWith('.webp') ||
            relPath.endsWith('.ico')
          ) {
            continue;
          }
          if (entry.isDirectory()) {
            getFiles(fullPath, list);
          } else if (entry.isFile()) {
            // Excluir placeholders documentados de .env.example
            if (relPath === '.env.example') continue;
            list.push(fullPath);
          }
        }
        return list;
      }

      const files = getFiles(process.cwd());
      expect(files.length).toBeGreaterThan(10);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        // No JWTs reales
        expect(content, `Posible JWT detectado en ${file}`).not.toMatch(
          /eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
        );
        // No tokens personales de Supabase
        expect(content, `Posible Supabase PAT detectado en ${file}`).not.toMatch(
          /sbp_[a-zA-Z0-9_-]{20,}/
        );
        // No secretos modernos de Supabase
        expect(content, `Posible Supabase Secret detectado en ${file}`).not.toMatch(
          /sb_secret_[a-zA-Z0-9_-]+/
        );
      }
    });
  });

  describe('DoD 3: Configuración de Supabase y scripts en package.json', () => {
    it('debe existir supabase/config.toml con configuración básica', () => {
      const configPath = path.resolve('supabase/config.toml');
      expect(fs.existsSync(configPath), 'supabase/config.toml no existe').toBe(true);
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('project_id');
    });

    it('package.json debe incluir el script db:types apuntando a tools/db-types.mjs sin redirección (H08, H13)', () => {
      const pkgPath = path.resolve('package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.scripts).toHaveProperty('db:types');
      expect(pkg.scripts['db:types']).toBe('node tools/db-types.mjs');
      expect(pkg.scripts['db:types']).not.toContain('>');
      expect(fs.existsSync(path.resolve('tools/db-types.mjs'))).toBe(true);
      const scriptContent = fs.readFileSync(path.resolve('tools/db-types.mjs'), 'utf-8');
      expect(scriptContent).toContain('supabase');
      expect(scriptContent).toContain('gen');
      expect(scriptContent).toContain('types');
    });

    it('tools/db-types.mjs no debe truncar ni modificar el archivo destino si la CLI falla (H13)', () => {
      const tmpDir = os.tmpdir();
      const testFile = path.join(tmpDir, `test-db-types-${Date.now()}.ts`);
      const initialContent = '/* original types content */';
      fs.writeFileSync(testFile, initialContent, 'utf-8');

      try {
        const result = spawnSync('node', [path.resolve('tools/db-types.mjs'), '--invalid-flag-force-fail'], {
          encoding: 'utf-8',
          env: {
            ...process.env,
            DB_TYPES_TARGET_FILE: testFile,
          },
          shell: process.platform === 'win32',
        });

        // La CLI debe fallar
        expect(result.status).not.toBe(0);

        // El archivo destino NO debe haber sido alterado ni truncado a 0 bytes
        const finalContent = fs.readFileSync(testFile, 'utf-8');
        expect(finalContent).toBe(initialContent);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });
});
