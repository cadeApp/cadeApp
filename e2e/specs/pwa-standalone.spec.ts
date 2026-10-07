import { test, expect } from '../fixtures';

test.describe('T-338 DoD: PWA Standalone Mode Navigation', () => {
  test('en navegador común (sin emulación standalone), / muestra la landing pública', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Tu envío, al precio que elijas/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Tengo un comercio/i })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('emulando standalone (matchMedia display-mode: standalone), / termina en /login sin mostrar el contenido de la landing ni emitir destello', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // 1. Emular standalone en matchMedia y navigator
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

      Object.defineProperty(window.navigator, 'standalone', {
        value: true,
        configurable: true,
      });

      // 2. Sonda pre-navigation que observa visibilidad real en frames (no mera existencia en DOM)
      if (window.sessionStorage.getItem('landing_was_visible') === null) {
        window.sessionStorage.setItem('landing_was_visible', 'false');
      }

      function checkLandingVisibility() {
        const headings = document.querySelectorAll('h1');
        for (const heading of headings) {
          if (heading.textContent && /Tu envío, al precio que elijas/i.test(heading.textContent)) {
            const style = window.getComputedStyle(heading);
            const rect = heading.getBoundingClientRect();

            let parentHidden = false;
            let current = heading.parentElement;
            while (current) {
              const pStyle = window.getComputedStyle(current);
              if (
                pStyle.display === 'none' ||
                pStyle.visibility === 'hidden' ||
                pStyle.opacity === '0'
              ) {
                parentHidden = true;
                break;
              }
              current = current.parentElement;
            }

            const isVisible =
              !parentHidden &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              rect.width > 0 &&
              rect.height > 0;

            if (isVisible) {
              window.sessionStorage.setItem('landing_was_visible', 'true');
            }
          }
        }
        requestAnimationFrame(checkLandingVisibility);
      }

      requestAnimationFrame(checkLandingVisibility);
    });

    await page.goto('/');

    await page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/login');
    await expect(page.getByRole('heading', { name: /Tu envío, al precio que elijas/i })).not.toBeVisible();

    const landingWasVisible = await page.evaluate(() =>
      window.sessionStorage.getItem('landing_was_visible')
    );
    expect(landingWasVisible).toBe('false');
  });
});

