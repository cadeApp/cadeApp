import type { Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { expect } from '../fixtures';

// REVIEW ONLY / NEVER MERGE (T-350): helpers de las auditorías provisionales por rol.
// No es un *.spec.ts, así que importarlo no registra tests.

// Nunca imprime la clave: se tapa el parámetro `key` de cualquier URL.
function redactKey(text: string) {
  return text.replace(/([?&]key=)[^&\s"']+/gi, '$1REDACTED');
}

export function attachMapsDiagnostics(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[T-350 console ${msg.type()}] ${redactKey(msg.text()).slice(0, 400)}`);
    }
  });
  page.on('pageerror', (error) => {
    console.log(`[T-350 pageerror] ${redactKey(error.message).slice(0, 400)}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (/maps\.googleapis\.com|maps\.gstatic\.com/.test(url) && (response.status() >= 300 || /Authenticat|Quota/i.test(url))) {
      console.log(`[T-350 maps response] ${response.status()} ${redactKey(url).slice(0, 200)}`);
    }
  });
}

export async function expectRealGoogleMap(page: Page) {
  await expect(page.getByTestId('trip-route-map')).toBeVisible();
  await expect(page.getByTestId('route-map-fallback')).toHaveCount(0);
  await expect(page.getByTestId('map-pin-pickup')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('map-pin-dropoff')).toBeVisible({ timeout: 20_000 });
  // Canvas real de Google Maps: el contenedor que el SDK monta con su región accesible.
  await expect(page.locator('[data-testid="trip-route-map"] .gm-style')).toBeVisible({ timeout: 20_000 });
}

export async function logAriaHiddenFocusOrigin(page: Page, label: string) {
  // Da tiempo a que el SDK termine de montar su DOM (incluido un eventual diálogo de error).
  await page.locator('[data-testid="trip-route-map"] .gm-style').waitFor({ timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  const report = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-hidden="true"][tabindex]')).map((node) => {
      const ancestors: string[] = [];
      let current = node.parentElement;
      while (current && ancestors.length < 8) {
        const attrs = Array.from(current.attributes)
          .filter((a) => a.name !== 'style')
          .map((a) => `${a.name}="${a.value.slice(0, 60)}"`)
          .join(' ');
        ancestors.push(`<${current.tagName.toLowerCase()} ${attrs}>`);
        current = current.parentElement;
      }
      const siblings = node.parentElement
        ? Array.from(node.parentElement.children).map((c) => c.outerHTML.slice(0, 160))
        : [];
      return { html: node.outerHTML.slice(0, 200), insideGmStyle: Boolean(node.closest('.gm-style')), ancestors, siblings };
    })
  );
  console.log(`[T-350 aria-hidden-focus ${label}] ${JSON.stringify(report, null, 2)}`);
}

export async function auditTrip(page: Page) {
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
  expect(audit.passes.length).toBeGreaterThan(0);
}
