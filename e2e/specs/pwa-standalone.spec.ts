import { test, expect } from '../fixtures';

test.describe('T-338 DoD: PWA Standalone Mode Navigation', () => {
  test('en navegador común (sin emulación standalone), / muestra la landing pública', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Tu envío, al precio que elijas/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Tengo un comercio/i })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('emulando standalone (matchMedia display-mode: standalone), / termina en /login sin mostrar el contenido de la landing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (query: string) => {
        if (query === '(display-mode: standalone)') {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as unknown as MediaQueryList;
        }
        return originalMatchMedia
          ? originalMatchMedia.call(window, query)
          : ({
              matches: false,
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => false,
            } as unknown as MediaQueryList);
      };
    });

    await page.goto('/');

    await page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/login');
    await expect(page.getByRole('heading', { name: /Tu envío, al precio que elijas/i })).not.toBeVisible();
  });
});
