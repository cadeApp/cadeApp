import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext } from '@playwright/test';
import { test, expect } from '../fixtures';

test.describe('T-338 DoD: PWA Standalone Mode Navigation', () => {
  test('en navegador común (sin emulación standalone), / muestra la landing pública', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Tu envío, al precio que elijas/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Tengo un comercio/i })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');

    const wrapper = page.getByTestId('standalone-redirect-wrapper');
    if (await wrapper.count() > 0) {
      const display = await wrapper.evaluate((el) => window.getComputedStyle(el).display);
      expect(display).toBe('contents');
    }
  });

  test('emulando standalone (matchMedia display-mode: standalone), / termina en /login sin mostrar el contenido de la landing ni emitir destello', async ({
    baseURL,
  }) => {
    const effectiveBaseURL = baseURL || process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
    const targetURL = new URL('/', effectiveBaseURL).href;
    const tempProfile = mkdtempSync(join(tmpdir(), 'pw-standalone-'));

    let appContext: BrowserContext | null = null;
    try {
      // Lanzar Chromium completo en nuevo modo headless (channel: 'chromium') con argumento --app
      // para que el motor active nativamente la ventana en modo standalone sin necesidad de Xvfb.
      try {
        appContext = await chromium.launchPersistentContext(tempProfile, {
          channel: 'chromium',
          headless: true,
          args: [`--app=${targetURL}`],
        });
      } catch {
        // Fallback para entornos donde channel: 'chromium' requiera launch estándar
        appContext = await chromium.launchPersistentContext(tempProfile, {
          headless: true,
          args: ['--headless=new', `--app=${targetURL}`],
        });
      }

      const appPage = appContext.pages()[0] || (await appContext.newPage());

      // Registrar sonda pre-navigation que observa visibilidad real en frames antes del primer paint
      await appPage.addInitScript(() => {
        if (window.sessionStorage.getItem('landing_was_visible') === null) {
          window.sessionStorage.setItem('landing_was_visible', 'false');
        }

        const recordWrapperDisplay = () => {
          const wrapper = document.querySelector('[data-testid="standalone-redirect-wrapper"]');
          if (wrapper) {
            const style = window.getComputedStyle(wrapper);
            window.sessionStorage.setItem('wrapper_display_before_redirect', style.display);
          }
        };

        const observer = new MutationObserver(() => {
          recordWrapperDisplay();
        });
        observer.observe(document, { childList: true, subtree: true });
        document.addEventListener('DOMContentLoaded', recordWrapperDisplay);

        function checkLandingVisibility() {
          recordWrapperDisplay();
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

      // Navegar a la URL de la app
      await appPage.goto(targetURL);

      // Verificación estricta y nativa: el motor debe reportar display-mode: standalone
      const emulatedMatches = await appPage.evaluate(
        () => window.matchMedia('(display-mode: standalone)').matches
      );
      expect(
        emulatedMatches,
        'El motor CSS del navegador debe admitir nativamente (display-mode: standalone)'
      ).toBe(true);

      const browserMatches = await appPage.evaluate(
        () => window.matchMedia('(display-mode: browser)').matches
      );
      expect(browserMatches).toBe(false);

      // Verificar que la redirección a /login se completó
      await appPage.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });
      expect(new URL(appPage.url()).pathname).toBe('/login');
      await expect(
        appPage.getByRole('heading', { name: /Tu envío, al precio que elijas/i })
      ).not.toBeVisible();

      // Verificar que la landing nunca fue visible en ningún frame (anti-flash)
      const landingWasVisible = await appPage.evaluate(() =>
        window.sessionStorage.getItem('landing_was_visible')
      );
      expect(landingWasVisible).toBe('false');

      // Verificar que el wrapper estuvo oculto por la hoja CSS de producción antes del redirect
      const wrapperDisplay = await appPage.evaluate(() =>
        window.sessionStorage.getItem('wrapper_display_before_redirect')
      );
      expect(wrapperDisplay).toBe('none');
    } finally {
      if (appContext) {
        await appContext.close();
      }
      try {
        rmSync(tempProfile, { recursive: true, force: true });
      } catch {}
    }
  });
});
