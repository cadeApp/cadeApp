import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

describe('T-002: DoD - Clientes de Supabase y Configuración', () => {
  describe('DoD 1: Existencia e interfaz de los clientes de Supabase', () => {
    it('debe existir src/server/supabase/server.ts y exportar createClient', async () => {
      const serverFile = path.resolve('src/server/supabase/server.ts');
      expect(fs.existsSync(serverFile), 'src/server/supabase/server.ts no existe').toBe(true);

      if (fs.existsSync(serverFile)) {
        const serverModule = await import(pathToFileURL(serverFile).href);
        expect(typeof serverModule.createClient).toBe('function');
      }
    });

    it('debe existir src/server/supabase/browser.ts y exportar createClient', async () => {
      const browserFile = path.resolve('src/server/supabase/browser.ts');
      expect(fs.existsSync(browserFile), 'src/server/supabase/browser.ts no existe').toBe(true);

      if (fs.existsSync(browserFile)) {
        const browserModule = await import(pathToFileURL(browserFile).href);
        expect(typeof browserModule.createClient).toBe('function');
      }
    });

    it('debe existir src/server/supabase/admin.ts y exportar createAdminClient', async () => {
      const adminFile = path.resolve('src/server/supabase/admin.ts');
      expect(fs.existsSync(adminFile), 'src/server/supabase/admin.ts no existe').toBe(true);

      if (fs.existsSync(adminFile)) {
        const adminModule = await import(pathToFileURL(adminFile).href);
        expect(typeof adminModule.createAdminClient).toBe('function');
      }
    });
  });

  describe('DoD 2: Seguridad y server-only en cliente admin', () => {
    it('src/server/supabase/admin.ts debe incluir obligatoriamente import "server-only"', () => {
      const adminFile = path.resolve('src/server/supabase/admin.ts');
      expect(fs.existsSync(adminFile), 'src/server/supabase/admin.ts no existe').toBe(true);
      if (fs.existsSync(adminFile)) {
        const content = fs.readFileSync(adminFile, 'utf-8');
        expect(content).toMatch(/import\s+['"]server-only['"]/);
      }
    });

    it('los clientes no deben contener claves o URLs hardcodeadas', () => {
      const supabaseDir = path.resolve('src/server/supabase');
      expect(fs.existsSync(supabaseDir), 'Directorio src/server/supabase no existe').toBe(true);
      if (fs.existsSync(supabaseDir)) {
        const files = fs.readdirSync(supabaseDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
        expect(files.length).toBeGreaterThanOrEqual(3);
        for (const file of files) {
          const content = fs.readFileSync(path.join(supabaseDir, file), 'utf-8');
          expect(content).not.toMatch(/eyJhbGciOi/); // No JWTs hardcodeados
          expect(content).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/); // No URLs hardcodeadas
        }
      }
    });
  });

  describe('DoD 3: Configuración de Supabase y scripts en package.json', () => {
    it('debe existir supabase/config.toml con configuración básica', () => {
      const configPath = path.resolve('supabase/config.toml');
      expect(fs.existsSync(configPath), 'supabase/config.toml no existe').toBe(true);
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        expect(content).toContain('project_id');
      }
    });

    it('package.json debe incluir el script db:types', () => {
      const pkgPath = path.resolve('package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.scripts).toHaveProperty('db:types');
      expect(pkg.scripts['db:types']).toContain('supabase gen types');
    });
  });
});
