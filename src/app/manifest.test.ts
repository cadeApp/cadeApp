import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('T-201: Web App Manifest & Maskable Icons', () => {
  it('DoD: el manifest debe cumplir con el estándar PWA y la identidad de cadeApp', () => {
    const data = manifest();

    expect(data.name).toContain('cadeApp');
    expect(data.short_name).toBe('cadeApp');
    expect(data.start_url).toBe('/');
    expect(data.display).toBe('standalone');
    expect(data.theme_color).toBe('#09BABD');
    expect(data.background_color).toBe('#12182C');
    expect(data.orientation).toBe('portrait');

    const icons = data.icons ?? [];
    expect(Array.isArray(data.icons)).toBe(true);
    expect(icons.length).toBeGreaterThanOrEqual(2);

    const has192 = icons.some(
      (icon) => icon.sizes === '192x192' && icon.type === 'image/png'
    );
    const has512 = icons.some(
      (icon) => icon.sizes === '512x512' && icon.type === 'image/png'
    );
    const hasMaskable = icons.some(
      (icon) => icon.purpose?.includes('maskable')
    );

    expect(has192, 'Debe incluir ícono 192x192 PNG').toBe(true);
    expect(has512, 'Debe incluir ícono 512x512 PNG').toBe(true);
    expect(hasMaskable, 'Debe incluir al menos un ícono con propósito maskable').toBe(true);
  });

  it('DoD: los archivos de íconos declarados deben existir físicamente en public/', () => {
    const data = manifest();
    const publicDir = path.resolve(process.cwd(), 'public');
    const icons = data.icons ?? [];

    for (const icon of icons) {
      const iconPath = path.resolve(publicDir, icon.src.replace(/^\//, ''));
      expect(
        fs.existsSync(iconPath),
        `El ícono ${icon.src} declarado en el manifest no existe en public/`
      ).toBe(true);

      const stats = fs.statSync(iconPath);
      expect(stats.size, `El ícono ${icon.src} está vacío`).toBeGreaterThan(100);
    }
  });
});
