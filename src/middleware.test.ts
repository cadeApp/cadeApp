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
    ])('ruta %s -> match: %s', (url, expected) => {
      const matched = unstable_doesMiddlewareMatch({
        config,
        url,
      });
      expect(matched).toBe(expected);
    });

    // Rutas de API, assets estáticos e imágenes que DEBEN quedar excluidas
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
    ])('asset o api %s -> match: %s', (url, expected) => {
      const matched = unstable_doesMiddlewareMatch({
        config,
        url,
      });
      expect(matched).toBe(expected);
    });
  });
});
