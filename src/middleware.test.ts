import { describe, expect, it } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config } from './middleware';

describe('T-336 / PR248-H05: Configuración y matcher de middleware canónico en src/middleware.ts', () => {
  it('el middleware está ubicado canónicamente dentro de src/ y exporta su configuración', () => {
    expect(config).toBeDefined();
    expect(config.matcher).toBeDefined();
  });

  describe('unstable_doesMiddlewareMatch con la configuración real del middleware', () => {
    // Rutas operativas y gateway que DEBEN ejecutar el middleware
    it.each([
      ['/login', true],
      ['/courier/feed', true],
      ['/t336-404-session-regression', true],
      ['/merchant/dashboard', true],
      ['/admin/applicants', true],
      ['/requests', true],
      ['/feed', true],
      // PR295-A04: extensiones o sufijos no autorizados deben seguir ejecutando el middleware
      ['/manifest.webmanifest.bak', true],
      ['/manifest.webmanifest-extra', true],
      ['/sw.js.map', true],
      ['/sw.js.backup', true],
    ])('ruta %s -> match: %s', (url, expected) => {
      const matched = unstable_doesMiddlewareMatch({
        config,
        url,
      });
      expect(matched).toBe(expected);
    });

    // Rutas de API, assets estáticos, PWA manifest y Service Worker que DEBEN quedar excluidas
    it.each([
      ['/api/health', false],
      ['/api/auth/callback', false],
      ['/favicon.ico', false],
      ['/_next/static/chunks/app/page.js', false],
      ['/_next/image?url=%2Flogo.png&w=128&q=75', false],
      ['/logo.png', false],
      ['/icon.svg', false],
      ['/banner.jpg', false],
      ['/image.webp', false],
      ['/brand/logo.svg', false],
      // PR295-A04: entrega anónima de manifest y service worker para instalación PWA en Chrome
      ['/manifest.webmanifest', false],
      ['/sw.js', false],
    ])('asset o api %s -> match: %s', (url, expected) => {
      const matched = unstable_doesMiddlewareMatch({
        config,
        url,
      });
      expect(matched).toBe(expected);
    });
  });
});
