import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest';

function readPngDimensions(filePath: string) {
  const png = fs.readFileSync(filePath);
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

function getFileSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('T-201: Web App Manifest & Maskable Icons (PR117-H09)', () => {
  it('DoD: el manifest debe cumplir con el estándar PWA y referenciar los 3 paths canónicos de S00', () => {
    const data = manifest();

    expect(data.name).toContain('cadeApp');
    expect(data.short_name).toBe('cadeApp');
    expect(data.start_url).toBe('/login');
    expect(data.id).toBe('/');
    expect(data.display).toBe('standalone');
    expect(data.theme_color).toBe('#09BABD');
    expect(data.background_color).toBe('#12182C');
    expect(data.orientation).toBe('portrait');

    const icons = data.icons ?? [];
    expect(Array.isArray(icons)).toBe(true);

    const icon192 = icons.find((i) => i.src === '/icons/icon-192.png');
    const icon512 = icons.find((i) => i.src === '/icons/icon-512.png');
    const maskable512 = icons.find((i) => i.src === '/icons/icon-maskable-512.png');

    expect(icon192, 'Manifest debe referenciar /icons/icon-192.png').toBeDefined();
    expect(icon192?.sizes).toBe('192x192');
    expect(icon192?.type).toBe('image/png');
    expect(icon192?.purpose).toBe('any');

    expect(icon512, 'Manifest debe referenciar /icons/icon-512.png').toBeDefined();
    expect(icon512?.sizes).toBe('512x512');
    expect(icon512?.type).toBe('image/png');
    expect(icon512?.purpose).toBe('any');

    expect(maskable512, 'Manifest debe referenciar /icons/icon-maskable-512.png').toBeDefined();
    expect(maskable512?.sizes).toBe('512x512');
    expect(maskable512?.type).toBe('image/png');
    expect(maskable512?.purpose).toBe('maskable');
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

  it('PR117-H09: verificación exacta de dimensiones IHDR de PNGs y assets Safari S00', () => {
    const publicDir = path.resolve(process.cwd(), 'public');

    // 1. icon-192.png -> 192x192
    const icon192 = readPngDimensions(path.resolve(publicDir, 'icons/icon-192.png'));
    expect(icon192.width).toBe(192);
    expect(icon192.height).toBe(192);

    // 2. icon-512.png -> 512x512
    const icon512 = readPngDimensions(path.resolve(publicDir, 'icons/icon-512.png'));
    expect(icon512.width).toBe(512);
    expect(icon512.height).toBe(512);

    // 3. icon-maskable-512.png -> 512x512
    const maskable512 = readPngDimensions(path.resolve(publicDir, 'icons/icon-maskable-512.png'));
    expect(maskable512.width).toBe(512);
    expect(maskable512.height).toBe(512);

    // 4. ambos apple-touch -> 180x180
    const appleTouchIcons = readPngDimensions(path.resolve(publicDir, 'icons/apple-touch-icon.png'));
    expect(appleTouchIcons.width).toBe(180);
    expect(appleTouchIcons.height).toBe(180);

    const appleTouchRoot = readPngDimensions(path.resolve(publicDir, 'apple-touch-icon.png'));
    expect(appleTouchRoot.width).toBe(180);
    expect(appleTouchRoot.height).toBe(180);
  });

  it('PR117-H09: SHA-256(maskable-512) NO debe ser igual a SHA-256(icon-512)', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    const hashNormal = getFileSha256(path.resolve(publicDir, 'icons/icon-512.png'));
    const hashMaskable = getFileSha256(path.resolve(publicDir, 'icons/icon-maskable-512.png'));

    expect(hashMaskable).not.toBe(hashNormal);
  });
});
