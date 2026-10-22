import { type ConsoleMessage, type Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';

/**
 * T-391 (SEC-05): cabeceras de seguridad en todas las rutas.
 *
 * - Las cabeceras forzadas llegan en páginas públicas, del admin y de `/api`.
 * - La app no se puede embeber en un iframe de otro origen (clickjacking).
 * - La CSP forzada no rompe los flujos: ningún error de consola por CSP salvo los avisos de Report-Only.
 */

const ENFORCED_HEADERS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
} as const;

const ROUTES = ['/', '/login', '/admin/applicants', '/api/health'] as const;

/** Errores de CSP forzada; los de Report-Only se registran pero no bloquean. */
function collectEnforcedCspErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text();
    if (message.type() === 'error' && /Content Security Policy/i.test(text) && !/Report Only/i.test(text)) {
      errors.push(text);
    }
  });
  return errors;
}

test.describe('T-391 — Cabeceras de seguridad (SEC-05)', () => {
  for (const route of ROUTES) {
    test(`${route} envía las cabeceras de seguridad forzadas`, async ({ request }) => {
      // Sigue las redirecciones del middleware (por ejemplo /admin → /login): se verifica la respuesta final.
      const response = await request.get(route);
      const headers = response.headers();

      for (const [name, value] of Object.entries(ENFORCED_HEADERS)) {
        expect(headers[name], name).toBe(value);
      }
      expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(headers['content-security-policy']).toContain("object-src 'none'");
      expect(headers['content-security-policy-report-only']).toContain("default-src 'self'");
      expect(headers['permissions-policy']).toContain('geolocation=(self)');
      expect(headers['x-powered-by']).toBeUndefined();
    });
  }

  test('la app no se renderiza dentro de un iframe de otro origen', async ({ page, baseURL }) => {
    await page.setContent(`<iframe id="embed" src="${baseURL}/login" width="400" height="400"></iframe>`);
    const frameElement = await page.waitForSelector('#embed');
    const frame = await frameElement.contentFrame();

    // Chromium bloquea el documento por X-Frame-Options y frame-ancestors, y deja el frame en su página de error.
    await expect
      .poll(async () => frame?.url() ?? '', { timeout: 15000 })
      .toMatch(/^chrome-error:\/\//);
  });

  test('login, feed del repartidor y nueva solicitud con mapa sin errores de CSP forzada', async ({
    browser,
    baseURL,
    loginAsCourier,
    loginAsMerchant,
  }) => {
    const courierContext = await browser.newContext({ baseURL });
    const merchantContext = await browser.newContext({ baseURL });
    try {
      const courierPage = await courierContext.newPage();
      const courierErrors = collectEnforcedCspErrors(courierPage);
      const { courierPage: courier } = await loginAsCourier(0, courierPage);
      await courier.gotoFeed();
      await waitForNoSkeletons(courierPage);

      const merchantPage = await merchantContext.newPage();
      const merchantErrors = collectEnforcedCspErrors(merchantPage);
      const { merchantPage: merchant } = await loginAsMerchant(merchantPage);
      await merchant.gotoNewRequest();
      await waitForNoSkeletons(merchantPage);

      expect(courierErrors).toEqual([]);
      expect(merchantErrors).toEqual([]);
    } finally {
      await courierContext.close();
      await merchantContext.close();
    }
  });
});
